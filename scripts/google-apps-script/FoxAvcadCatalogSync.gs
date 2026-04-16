/**
 * Fox AVCAD equipment sheet → Rack+ Postgres catalog
 *
 * Setup (Extensions → Apps Script):
 * 1. Project Settings → Script Properties:
 *    - RACKPLUS_CATALOG_URL  full path to structured webhook (not the site root), e.g.
 *      http://lamacstudio01.foxnewsnyc.com:4000/api/catalog/sync-structured-webhook
 *    - RACKPLUS_CATALOG_SECRET  same value as backend CATALOG_WEBHOOK_SECRET
 *    - RACKPLUS_SPREADSHEET_ID  (required for Web app / doGet / doPost — see below)
 *    - RACKPLUS_SHEET_NAME  (optional; tab name; default first sheet)
 *    - RACKPLUS_WEBAPP_TOKEN  (required to call the deployed Web app URL safely)
 * 2. Run authorizeCatalogSync_() once to grant UrlFetch.
 * 3. Run createCatalogMenu_() once, then use the new menu on the spreadsheet, or run installCatalogEditTrigger_()
 *    for throttled sync after edits (recommended: 90s minimum interval).
 *
 * Web app deployment (Deploy → New deployment → Web app):
 * - Hitting …/exec does nothing until doGet/doPost exist (this file includes them).
 * - Example: GET …/exec?token=YOUR_WEBAPP_TOKEN&prune=0
 * - Use a long random RACKPLUS_WEBAPP_TOKEN; do not reuse the Rack+ server secret in URLs you log.
 *
 * Sheet: header row with Manufacturer, Model, Category, Power, Width, Height, Depth, Ins, Outs, Notes
 * (column names are matched case-insensitively; Ins/Outs optional).
 */

function getCatalogProps_() {
  const p = PropertiesService.getScriptProperties();
  const url = (p.getProperty('RACKPLUS_CATALOG_URL') || '').trim();
  const secret = (p.getProperty('RACKPLUS_CATALOG_SECRET') || '').trim();
  if (!url) throw new Error('Set Script property RACKPLUS_CATALOG_URL');
  if (!secret) throw new Error('Set Script property RACKPLUS_CATALOG_SECRET');
  return { url: url, secret: secret };
}

/** Lowercase header → original column index (first occurrence wins). */
function headerIndexMap_(headerRow) {
  const map = {};
  for (var c = 0; c < headerRow.length; c++) {
    var key = String(headerRow[c] || '')
      .trim()
      .toLowerCase();
    if (key && map[key] === undefined) map[key] = c;
  }
  return map;
}

function pickCell_(row, map, names) {
  for (var i = 0; i < names.length; i++) {
    var ix = map[names[i]];
    if (ix !== undefined) return row[ix];
  }
  return '';
}

function rowToObject_(row, map) {
  return {
    manufacturer: String(pickCell_(row, map, ['manufacturer']) || '').trim(),
    model: String(pickCell_(row, map, ['model']) || '').trim(),
    category: String(pickCell_(row, map, ['category']) || '').trim(),
    power: String(pickCell_(row, map, ['power']) || '').trim(),
    width: pickCell_(row, map, ['width']),
    height: pickCell_(row, map, ['height']),
    depth: pickCell_(row, map, ['depth']),
    ins: String(pickCell_(row, map, ['ins', 'in', 'inputs']) || '').trim(),
    outs: String(pickCell_(row, map, ['outs', 'out', 'outputs']) || '').trim(),
    notes: String(pickCell_(row, map, ['notes']) || '').trim(),
  };
}

/** Spreadsheet bound to this project; web app runs must use RACKPLUS_SPREADSHEET_ID. */
function getSpreadsheetForSync_() {
  var p = PropertiesService.getScriptProperties();
  var id = (p.getProperty('RACKPLUS_SPREADSHEET_ID') || '').trim();
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss)
    throw new Error(
      'No active spreadsheet. For Web app / triggers, set Script property RACKPLUS_SPREADSHEET_ID to this file’s spreadsheet id.',
    );
  return ss;
}

function getDataSheet_(ss) {
  var p = PropertiesService.getScriptProperties();
  var name = (p.getProperty('RACKPLUS_SHEET_NAME') || '').trim();
  if (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) throw new Error('Sheet not found: ' + name);
    return sh;
  }
  return ss.getSheets()[0];
}

function buildPayloadFromSheet_() {
  var sh = getDataSheet_(getSpreadsheetForSync_());
  var range = sh.getDataRange();
  var values = range.getValues();
  if (!values || values.length < 2) return { rows: [] };
  var map = headerIndexMap_(values[0]);
  if (map['manufacturer'] === undefined || map['model'] === undefined || map['category'] === undefined) {
    throw new Error('Sheet must have Manufacturer, Model, and Category in row 1');
  }
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var o = rowToObject_(values[r], map);
    if (!o.manufacturer && !o.model) continue;
    if (!o.manufacturer || !o.model) continue;
    rows.push(o);
  }
  return { rows: rows };
}

/**
 * POST JSON to Rack+. Use menu “Rack+ catalog → Push now”.
 * @param {boolean} pruneMissing  when true, append ?prune=1 (full catalog replace on server).
 */
function pushFoxCatalogToRackPlus_(pruneMissing) {
  var prune = pruneMissing === true;
  var props = getCatalogProps_();
  var body = buildPayloadFromSheet_();
  var url = props.url;
  if (url.indexOf('?') >= 0) url += prune ? '&prune=1' : '';
  else url += prune ? '?prune=1' : '';
  var res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(body),
    headers: { 'X-Catalog-Webhook-Secret': props.secret },
  });
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Rack+ sync failed HTTP ' + code + ': ' + text.slice(0, 500));
  }
  return JSON.parse(text);
}

function authorizeCatalogSync_() {
  pushFoxCatalogToRackPlus_(false);
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Rack+ catalog')
      .addItem('Push now', 'menuPushFoxCatalogToRackPlus')
      .addItem('Install edit trigger (throttled)', 'menuInstallCatalogEditTrigger')
      .addToUi();
  } catch (e) {
    /* no UI (e.g. time-driven) */
  }
}

function menuPushFoxCatalogToRackPlus() {
  var out = pushFoxCatalogToRackPlus_(false);
  SpreadsheetApp.getActive().toast('Synced: ' + JSON.stringify(out), 'Rack+', 8);
}

var CATALOG_LAST_PUSH_MS_ = 'CATALOG_LAST_PUSH_MS';

function maybePushFoxCatalogThrottled_() {
  var p = PropertiesService.getScriptProperties();
  var now = new Date().getTime();
  var last = parseInt(p.getProperty(CATALOG_LAST_PUSH_MS_) || '0', 10) || 0;
  if (now - last < 90000) return;
  p.setProperty(CATALOG_LAST_PUSH_MS_, String(now));
  pushFoxCatalogToRackPlus_(false);
}

/** Simple onEdit → throttled push (does not pass event range; always syncs whole tab). */
function onEditCatalogSync_(e) {
  maybePushFoxCatalogThrottled_();
}

function menuInstallCatalogEditTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditCatalogSync_') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('onEditCatalogSync_').forSpreadsheet(SpreadsheetApp.getActive()).onEdit().create();
  SpreadsheetApp.getUi().alert('Installed onEdit → Rack+ (max about once per 90s while editing).');
}

function createCatalogMenu_() {
  onOpen();
}

function jsonResponse_(obj) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

/**
 * Validate token for Web app (GET query or POST JSON body { "token": "..." }).
 */
function validateWebAppToken_(e) {
  var p = PropertiesService.getScriptProperties();
  var expected = (p.getProperty('RACKPLUS_WEBAPP_TOKEN') || '').trim();
  if (!expected) {
    return { ok: false, status: 503, body: { ok: false, error: 'Set Script property RACKPLUS_WEBAPP_TOKEN to use the Web app URL' } };
  }
  var got = (e.parameter && String(e.parameter.token || '')) || '';
  if (e.postData && e.postData.type === 'application/json' && e.postData.contents) {
    try {
      var j = JSON.parse(e.postData.contents);
      if (j && j.token) got = String(j.token);
    } catch (x) {
      /* ignore */
    }
  }
  if (got !== expected) {
    return { ok: false, status: 401, body: { ok: false, error: 'Unauthorized' } };
  }
  return { ok: true };
}

/**
 * Web app entrypoint — use the Deployment “Web app” URL ending in /exec
 * Example: …/exec?token=SECRET&prune=0
 */
function doGet(e) {
  e = e || {};
  var v = validateWebAppToken_(e);
  if (!v.ok) return jsonResponse_(v.body);
  var prune = String((e.parameter && e.parameter.prune) || '') === '1';
  try {
    var result = pushFoxCatalogToRackPlus_(prune);
    return jsonResponse_({ ok: true, source: 'webapp', prune: prune, result: result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  e = e || {};
  var v = validateWebAppToken_(e);
  if (!v.ok) return jsonResponse_(v.body);
  var prune = false;
  if (e.parameter && String(e.parameter.prune) === '1') prune = true;
  if (e.postData && e.postData.contents) {
    try {
      var j = JSON.parse(e.postData.contents);
      if (j && j.prune === true) prune = true;
    } catch (x) {
      /* body not JSON */
    }
  }
  try {
    var result = pushFoxCatalogToRackPlus_(prune);
    return jsonResponse_({ ok: true, source: 'webapp', prune: prune, result: result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

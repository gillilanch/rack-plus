/**
 * Rack+ catalog sync — Google Apps Script
 *
 * SETUP (run once from the script editor after pasting this file):
 * 1. Extensions → Apps Script → paste this code.
 * 2. Run `saveRackPlusWebhookConfig()` once and authorize. Edit the function body
 *    to set your public API URL and the same secret as backend CATALOG_WEBHOOK_SECRET,
 *    OR set Script Properties manually (File → Project settings → Script properties):
 *      RACKPLUS_WEBHOOK_URL  = https://your-host.example.com/api/catalog/sync-webhook
 *      RACKPLUS_WEBHOOK_SECRET = <long random string matching .env>
 *    Optional:
 *      RACKPLUS_SHEET_NAME = exact tab name to export (default: active sheet)
 * 3. Run `syncCatalogToRackPlus()` once to test.
 * 4. Triggers: run `installEveryFiveMinutesTrigger()` and/or `installOnEditTrigger()`.
 *
 * PRUNE: append ?prune=1 to the URL in RACKPLUS_WEBHOOK_URL only if you want each
 * upload to delete DB catalog rows missing from the sheet (full replace).
 */

/** One-time: saves URL + secret to Script Properties (remove secrets from code after running). */
function saveRackPlusWebhookConfig() {
  var props = PropertiesService.getScriptProperties();
  props.setProperties({
    RACKPLUS_WEBHOOK_URL: 'https://YOUR-HOST.example.com/api/catalog/sync-webhook',
    RACKPLUS_WEBHOOK_SECRET: 'PASTE_SAME_VALUE_AS_CATALOG_WEBHOOK_SECRET',
    // RACKPLUS_SHEET_NAME: 'Equipment', // optional; omit to use whichever sheet is active when sync runs
  });
}

/** Export a sheet’s data range to CSV (RFC-style quoting). */
function sheetToCsv_(sheet) {
  var values = sheet.getDataRange().getValues();
  return values
    .map(function (row) {
      return row
        .map(function (cell) {
          var s = cell == null ? '' : String(cell);
          if (/[",\n\r]/.test(s)) {
            return '"' + s.replace(/"/g, '""') + '"';
          }
          return s;
        })
        .join(',');
    })
    .join('\n');
}

function getTargetSheet_() {
  var props = PropertiesService.getScriptProperties();
  var name = props.getProperty('RACKPLUS_SHEET_NAME');
  var ss = SpreadsheetApp.getActive();
  if (name && String(name).trim()) {
    var sh = ss.getSheetByName(String(name).trim());
    if (!sh) {
      throw new Error('Sheet not found: ' + name);
    }
    return sh;
  }
  return ss.getActiveSheet();
}

/**
 * Reads the configured tab, POSTs CSV to Rack+ /api/catalog/sync-webhook.
 * Call manually, from a time-driven trigger, or from onEdit (throttled).
 */
function syncCatalogToRackPlus() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('RACKPLUS_WEBHOOK_URL');
  var secret = props.getProperty('RACKPLUS_WEBHOOK_SECRET');
  if (!url || !secret) {
    throw new Error('Set RACKPLUS_WEBHOOK_URL and RACKPLUS_WEBHOOK_SECRET (run saveRackPlusWebhookConfig or Script Properties).');
  }

  var sheet = getTargetSheet_();
  var csv = sheetToCsv_(sheet);
  if (!csv || !String(csv).trim()) {
    throw new Error('Sheet is empty; nothing to send.');
  }

  var options = {
    method: 'post',
    contentType: 'text/csv; charset=utf-8',
    payload: csv,
    muteHttpExceptions: true,
    headers: {
      'x-catalog-webhook-secret': secret,
    },
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();
  var body = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Rack+ sync failed HTTP ' + code + ': ' + body.slice(0, 500));
  }
  return JSON.parse(body);
}

/** Time-driven: every 5 minutes (adjust in Apps Script UI if needed). */
function installEveryFiveMinutesTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncCatalogToRackPlus') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('syncCatalogToRackPlus').timeBased().everyMinutes(5).create();
}

/**
 * Installable on-edit: throttles to at most once per 60 seconds per spreadsheet
 * (reduces spam while someone is typing).
 */
var EDIT_THROTTLE_SEC_ = 60;

function onEditInstallableCatalogSync() {
  var cache = CacheService.getScriptCache();
  var key = 'rackplusCatalogSyncThrottle';
  var hit = cache.get(key);
  if (hit) {
    return;
  }
  cache.put(key, '1', EDIT_THROTTLE_SEC_);
  syncCatalogToRackPlus();
}

function installOnEditTrigger() {
  var ssId = SpreadsheetApp.getActive().getId();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onEditInstallableCatalogSync') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('onEditInstallableCatalogSync')
    .forSpreadsheet(ssId)
    .onEdit()
    .create();
}

function menuPushCatalogToRackPlus() {
  try {
    syncCatalogToRackPlus();
    SpreadsheetApp.getUi().alert('Rack+ catalog sync completed.');
  } catch (e) {
    SpreadsheetApp.getUi().alert('Rack+ sync failed: ' + (e.message || e));
  }
}

/** Adds Spreadsheet menu “Rack+ sync” → Push catalog to Rack+ now */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Rack+ sync').addItem('Push catalog to Rack+ now', 'menuPushCatalogToRackPlus').addToUi();
}

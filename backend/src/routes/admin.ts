import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { localhostOnly } from '../middleware/localhostOnly';
import * as rackRepo from '../repos/rackRepo';
import {
  syncCatalogFromConfiguredFile,
  syncCatalogFromConfiguredUrl,
  syncCatalogFromCsvText,
  syncCatalogFromGoogleSheet,
} from '../services/catalogSync';

function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    next();
    return;
  }
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
  const header = typeof req.headers['x-admin-token'] === 'string' ? req.headers['x-admin-token'].trim() : undefined;
  const token = bearer || header;
  if (token !== expected) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

const adminPageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rack+ Admin</title>
  <style>
    :root { font-family: system-ui, sans-serif; line-height: 1.4; }
    body { max-width: 52rem; margin: 2rem auto; padding: 0 1rem; color: #111; }
    h1 { font-size: 1.25rem; }
    .row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin: 0.35rem 0; }
    button { cursor: pointer; padding: 0.35rem 0.65rem; }
    button.danger { background: #b91c1c; color: #fff; border: none; border-radius: 4px; }
    button.warn { background: #ca8a04; color: #111; border: none; border-radius: 4px; }
    input[type="text"], input[type="password"] { min-width: 14rem; padding: 0.35rem 0.5rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; font-size: 0.9rem; }
    th, td { text-align: left; padding: 0.45rem 0.5rem; border-bottom: 1px solid #e5e5e5; }
    .muted { color: #666; font-size: 0.85rem; }
    #msg { margin-top: 0.75rem; white-space: pre-wrap; }
    .err { color: #b91c1c; }
    .ok { color: #15803d; }
  </style>
</head>
<body>
  <h1>Rack+ admin</h1>
  <p class="muted">Only works from this machine (<code>localhost</code>). Remote browsers on the LAN cannot access this page.</p>
  <div class="row">
    <label>Admin token <span class="muted">(if configured in <code>ADMIN_TOKEN</code>)</span></label>
    <input type="password" id="token" placeholder="Paste token" autocomplete="off" />
    <button type="button" id="saveToken">Remember in browser</button>
  </div>
  <div class="row">
    <button type="button" id="reload">Refresh list</button>
    <button type="button" class="warn" id="restart">Restart backend</button>
    <button type="button" id="syncCatalog">Sync catalog (local CSV → DB)</button>
    <button type="button" id="syncCatalogUrl">Sync catalog (CSV URL → DB)</button>
    <button type="button" id="syncCatalogUrlPrune">Sync CSV URL + delete removed rows</button>
    <button type="button" id="syncGoogle">Sync catalog (live Google Sheet → DB)</button>
  </div>
  <p class="muted">Local CSV: <code>FOX_CATALOG_CSV_PATH</code> or the default AVCAD file. <strong>Without Google Cloud:</strong> set <code>FOX_CATALOG_CSV_URL</code> to a CSV URL or a normal Sheet link (<code>…/spreadsheets/d/…/edit…</code>) — the server uses Google’s CSV export URL. If you do <em>not</em> set fetch headers, that path needs <strong>Anyone with the link can view</strong>. For a <strong>private</strong> CSV URL (presigned object store, internal API), set <code>FOX_CATALOG_CSV_FETCH_AUTHORIZATION</code> (full header value, e.g. <code>Bearer …</code>) and/or <code>FOX_CATALOG_CSV_FETCH_HEADERS_JSON</code> (one JSON object: string keys → string values). <strong>Private sheet, no public link:</strong> <code>POST /api/catalog/sync-webhook</code> with the CSV as the body and <code>x-catalog-webhook-secret</code> equal to <code>CATALOG_WEBHOOK_SECRET</code> (e.g. Apps Script on a timer). Rows removed from the source stay in Postgres until <strong>Sync CSV URL + delete removed rows</strong> or <code>FOX_CATALOG_PRUNE_ON_SYNC=1</code>.</p>
  <p class="muted"><strong>Google Sheet API (optional):</strong> <code>GOOGLE_SHEETS_SPREADSHEET_ID</code>, <code>GOOGLE_SERVICE_ACCOUNT_JSON</code> (or <code>GOOGLE_APPLICATION_CREDENTIALS</code>), optional <code>GOOGLE_SHEETS_RANGE</code>. Share the sheet with the service account (Viewer). Poll with <code>FOX_CATALOG_SYNC_INTERVAL_MS</code> (≥ 15000 ms). Webhook pull (only when Sheet API is configured): <code>POST /api/catalog/sync-google-webhook</code> with <code>x-catalog-webhook-secret</code>. Served at <code>/api/catalog/devices</code>.</p>
  <p class="muted">Restart exits the Node process. Use launchd with KeepAlive or PM2 so it comes back; plain <code>npm start</code> in Terminal will stay down until you start it again.</p>
  <div class="row">
    <input type="text" id="deleteAllConfirm" placeholder="Type DELETE_ALL_RACKS to enable wipe" autocomplete="off" />
    <button type="button" class="danger" id="deleteAll" disabled>Delete all racks</button>
  </div>
  <div id="msg"></div>
  <table>
    <thead><tr><th>Name</th><th>Updated</th><th>ID</th><th></th></tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <script>
    const prefix = '/admin/api';
    const tokenKey = 'rackplus_admin_token';
    const tokenInput = document.getElementById('token');
    tokenInput.value = localStorage.getItem(tokenKey) || '';
    document.getElementById('saveToken').onclick = () => {
      localStorage.setItem(tokenKey, tokenInput.value.trim());
      setMsg('Saved token to local storage (this browser only).', 'ok');
      load();
    };
    function authHeaders() {
      const t = tokenInput.value.trim() || localStorage.getItem(tokenKey) || '';
      const h = { 'Content-Type': 'application/json' };
      if (t) h['Authorization'] = 'Bearer ' + t;
      return h;
    }
    const msgEl = document.getElementById('msg');
    function setMsg(text, cls) {
      msgEl.textContent = text;
      msgEl.className = cls || '';
    }
    async function load() {
      setMsg('');
      try {
        const r = await fetch(prefix + '/racks', { headers: authHeaders() });
        if (r.status === 401) { setMsg('401 Unauthorized — set Admin token if ADMIN_TOKEN is configured.', 'err'); return; }
        if (!r.ok) { setMsg('Failed to load racks: ' + r.status, 'err'); return; }
        const rows = await r.json();
        const tb = document.getElementById('tbody');
        tb.innerHTML = '';
        for (const row of rows) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td>' + escapeHtml(row.name) + '</td><td>' + escapeHtml(row.updatedAt) + '</td><td><code>' + escapeHtml(row.id) + '</code></td><td></td>';
          const del = document.createElement('button');
          del.textContent = 'Delete';
          del.onclick = () => deleteOne(row.id, row.name);
          tr.lastElementChild.appendChild(del);
          tb.appendChild(tr);
        }
        if (!rows.length) setMsg('No racks.', 'muted');
      } catch (e) {
        setMsg(String(e), 'err');
      }
    }
    function escapeHtml(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    async function deleteOne(id, name) {
      if (!confirm('Delete rack "' + name + '"?')) return;
      setMsg('');
      const r = await fetch(prefix + '/racks/' + encodeURIComponent(id), { method: 'DELETE', headers: authHeaders() });
      if (r.status === 401) { setMsg('401 Unauthorized', 'err'); return; }
      if (r.status === 404) { setMsg('Rack not found', 'err'); return; }
      if (!r.ok) { setMsg('Delete failed: ' + r.status, 'err'); return; }
      setMsg('Deleted.', 'ok');
      load();
    }
    document.getElementById('reload').onclick = load;
    function catalogSyncMsg(j, extra) {
      const pr = j.pruned != null && j.pruned > 0 ? ' Removed ' + j.pruned + ' DB row(s) no longer in the sheet.' : '';
      return extra + pr;
    }
    document.getElementById('syncCatalog').onclick = async () => {
      if (!confirm('Upsert all rows from the configured CSV file into the database?')) return;
      setMsg('');
      const r = await fetch(prefix + '/catalog/sync', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ source: 'file', prune: false }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setMsg('401 Unauthorized', 'err'); return; }
      if (!r.ok) { setMsg(j.error || 'Sync failed: ' + r.status, 'err'); return; }
      setMsg(
        catalogSyncMsg(
          j,
          'Catalog sync OK — ' +
            (j.sheetRowsParsed != null ? j.sheetRowsParsed + ' sheet row(s) parsed, ' : '') +
            'upserted ' +
            (j.upserted ?? '?') +
            ' time(s) from ' +
            (j.source || 'file') +
            ' (same Manufacturer+Model updates the same DB row; last row wins).',
        ),
        'ok',
      );
    };
    document.getElementById('syncCatalogUrl').onclick = async () => {
      if (!confirm('Fetch FOX_CATALOG_CSV_URL and upsert into the database?')) return;
      setMsg('');
      const r = await fetch(prefix + '/catalog/sync', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ source: 'url', prune: false }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setMsg('401 Unauthorized', 'err'); return; }
      if (!r.ok) { setMsg(j.error || 'Sync failed: ' + r.status, 'err'); return; }
      setMsg(
        catalogSyncMsg(
          j,
          'CSV URL sync OK — ' +
            (j.sheetRowsParsed != null ? j.sheetRowsParsed + ' sheet row(s) parsed, ' : '') +
            'upserted ' +
            (j.upserted ?? '?') +
            ' time(s).',
        ),
        'ok',
      );
    };
    document.getElementById('syncCatalogUrlPrune').onclick = async () => {
      if (!confirm('Fetch CSV URL, upsert, AND delete Postgres catalog rows that are NOT in this sheet anymore? (Use when you removed joke rows.)')) return;
      setMsg('');
      const r = await fetch(prefix + '/catalog/sync', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ source: 'url', prune: true }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setMsg('401 Unauthorized', 'err'); return; }
      if (!r.ok) { setMsg(j.error || 'Sync failed: ' + r.status, 'err'); return; }
      setMsg(
        catalogSyncMsg(
          j,
          'CSV URL sync + prune OK — ' +
            (j.sheetRowsParsed != null ? j.sheetRowsParsed + ' sheet row(s) parsed, ' : '') +
            'upserted ' +
            (j.upserted ?? '?') +
            ' time(s).',
        ),
        'ok',
      );
    };
    document.getElementById('syncGoogle').onclick = async () => {
      if (!confirm('Pull the live Google Sheet and upsert into the database?')) return;
      setMsg('');
      const r = await fetch(prefix + '/catalog/sync', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ source: 'google', prune: false }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setMsg('401 Unauthorized', 'err'); return; }
      if (!r.ok) { setMsg(j.error || String(j.message || 'Sync failed: ' + r.status), 'err'); return; }
      setMsg(
        'Google Sheet sync OK — ' +
          (j.sheetRowsParsed != null ? j.sheetRowsParsed + ' sheet row(s) parsed, ' : '') +
          'upserted ' +
          (j.upserted ?? '?') +
          ' time(s). ' +
          (j.source || '') +
          ' (unique devices = distinct Manufacturer+Model; duplicates update the same row).',
        'ok',
      );
    };
    document.getElementById('restart').onclick = async () => {
      if (!confirm('Restart backend now?')) return;
      setMsg('');
      const r = await fetch(prefix + '/restart', { method: 'POST', headers: authHeaders() });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setMsg('401 Unauthorized', 'err'); return; }
      setMsg(j.message || JSON.stringify(j), r.ok ? 'ok' : 'err');
    };
    const delAllInput = document.getElementById('deleteAllConfirm');
    const delAllBtn = document.getElementById('deleteAll');
    delAllInput.addEventListener('input', () => {
      delAllBtn.disabled = delAllInput.value.trim() !== 'DELETE_ALL_RACKS';
    });
    delAllBtn.onclick = async () => {
      if (!confirm('Delete ALL racks and devices? This cannot be undone.')) return;
      setMsg('');
      const r = await fetch(prefix + '/racks/delete-all', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ confirm: 'DELETE_ALL_RACKS' }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { setMsg('401 Unauthorized', 'err'); return; }
      if (!r.ok) { setMsg(j.error || 'Failed: ' + r.status, 'err'); return; }
      setMsg('Deleted ' + (j.deleted ?? '?') + ' rack(s).', 'ok');
      load();
    };
    load();
  </script>
</body>
</html>`;

export const adminRouter = Router();

adminRouter.use(localhostOnly);

adminRouter.get('/', (_req, res) => {
  res.type('html').send(adminPageHtml);
});

const api = Router();
api.use(requireAdminToken);

api.get('/racks', async (_req, res, next) => {
  try {
    const rows = await rackRepo.listRacks();
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        totalHeight: r.totalHeightU,
        rackWidthInches: r.rackWidthInches,
        rackDepthInches: r.rackDepthInches,
        deviceCount: r._count.devices,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        savedByDisplayName: r.savedByDisplayName,
        savedByVerified: r.savedByVerified,
      })),
    );
  } catch (e) {
    next(e);
  }
});

api.delete('/racks/:id', async (req, res, next) => {
  try {
    const ok = await rackRepo.deleteRackById(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Rack not found' });
      return;
    }
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

api.post('/racks/delete-all', async (req, res, next) => {
  try {
    const body = req.body as { confirm?: string };
    if (body?.confirm !== 'DELETE_ALL_RACKS') {
      res.status(400).json({ error: 'Invalid confirmation; send { "confirm": "DELETE_ALL_RACKS" }' });
      return;
    }
    const { count } = await rackRepo.deleteAllRacks();
    res.json({ deleted: count });
  } catch (e) {
    next(e);
  }
});

api.post('/restart', (_req, res) => {
  setTimeout(() => process.exit(0), 750);
  res.json({ ok: true, message: 'Exiting; supervisor should restart the process.' });
});

api.post('/catalog/sync', async (req, res, next) => {
  try {
    const body = req.body as {
      prune?: boolean;
      csvText?: string;
      source?: 'file' | 'url' | 'google';
    };
    const prune = !!body?.prune;
    if (typeof body?.csvText === 'string' && body.csvText.trim()) {
      const result = await syncCatalogFromCsvText(body.csvText, { pruneMissing: prune });
      res.json({ ok: true, ...result, source: 'inline' });
      return;
    }
    if (body?.source === 'google') {
      const result = await syncCatalogFromGoogleSheet({ pruneMissing: prune });
      res.json({ ok: true, ...result });
      return;
    }
    if (body?.source === 'url') {
      const result = await syncCatalogFromConfiguredUrl({ pruneMissing: prune });
      res.json({ ok: true, ...result });
      return;
    }
    const result = await syncCatalogFromConfiguredFile({ pruneMissing: prune });
    res.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof Error) {
      res.status(400).json({ error: e.message });
      return;
    }
    next(e);
  }
});

adminRouter.use('/api', express.json(), api);

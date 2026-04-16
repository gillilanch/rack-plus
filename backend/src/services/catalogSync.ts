import fs from 'fs';
import path from 'path';
import {
  parseFoxCatalogCsv,
  upsertCatalogRows,
  catalogDeviceRowsFromStructured,
  type SyncResult,
} from '../repos/catalogDeviceRepo';

export { syncCatalogFromGoogleSheet } from './googleSheetsCatalog';

const DEFAULT_CSV_FILENAME = 'AVCAD SHEETS DATABASE - Consolidated Equipment List Table.csv';

function resolveDefaultCsvPath(): string {
  const override = process.env.FOX_CATALOG_CSV_PATH?.trim();
  if (override) return path.isAbsolute(override) ? override : path.resolve(process.cwd(), override);
  return path.resolve(process.cwd(), DEFAULT_CSV_FILENAME);
}

/**
 * Turn a normal "open in browser" Sheets link into the CSV export endpoint so
 * FOX_CATALOG_CSV_URL can be pasted as /edit?usp=sharing (no Google Cloud API).
 * Without optional fetch headers, the sheet must be "Anyone with the link: Viewer".
 * With FOX_CATALOG_CSV_FETCH_AUTHORIZATION or FOX_CATALOG_CSV_FETCH_HEADERS_JSON,
 * use any URL that returns CSV (presigned S3, internal API, etc.).
 */
export function normalizeGoogleSheetsUrlToCsvExport(url: string): string {
  const trimmed = url.trim();
  if (/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?/i.test(trimmed)) {
    return trimmed;
  }
  const idMatch = trimmed.match(
    /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|\?|#|$)/i,
  );
  if (!idMatch) return trimmed;
  const id = idMatch[1]!;
  let gid: string | undefined;
  try {
    const parsed = new URL(trimmed);
    const q = parsed.searchParams.get('gid');
    if (q) gid = q;
    if (!gid && parsed.hash) {
      const hm = parsed.hash.match(/gid=(\d+)/);
      if (hm) gid = hm[1];
    }
  } catch {
    const hm = trimmed.match(/[#?&]gid=(\d+)/);
    if (hm) gid = hm[1];
  }
  let out = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`;
  if (gid) out += `&gid=${encodeURIComponent(gid)}`;
  return out;
}

const MAX_CATALOG_FETCH_HEADER_ENTRIES = 16;
const MAX_CATALOG_FETCH_HEADER_KEY_LEN = 128;
const MAX_CATALOG_FETCH_HEADER_VALUE_LEN = 8192;

/**
 * Optional headers for `FOX_CATALOG_CSV_URL` fetches so the CSV can live behind auth
 * (presigned URL, internal API, etc.) without making a Google Sheet world-readable.
 *
 * - `FOX_CATALOG_CSV_FETCH_HEADERS_JSON` — JSON object of string header names → values.
 * - `FOX_CATALOG_CSV_FETCH_AUTHORIZATION` — if set, sets/overrides the `Authorization` header
 *   (e.g. `Bearer <token>`).
 */
export function buildCatalogCsvFetchHeaders(): Headers {
  const headers = new Headers();
  const rawJson = process.env.FOX_CATALOG_CSV_FETCH_HEADERS_JSON?.trim();
  if (rawJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson) as unknown;
    } catch {
      throw new Error('FOX_CATALOG_CSV_FETCH_HEADERS_JSON is not valid JSON');
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('FOX_CATALOG_CSV_FETCH_HEADERS_JSON must be a flat JSON object');
    }
    let n = 0;
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (n >= MAX_CATALOG_FETCH_HEADER_ENTRIES) {
        throw new Error(`FOX_CATALOG_CSV_FETCH_HEADERS_JSON: at most ${MAX_CATALOG_FETCH_HEADER_ENTRIES} entries`);
      }
      if (typeof v !== 'string') {
        throw new Error(`FOX_CATALOG_CSV_FETCH_HEADERS_JSON: value for "${k}" must be a string`);
      }
      const name = k.trim();
      if (!name || name.length > MAX_CATALOG_FETCH_HEADER_KEY_LEN) {
        throw new Error(`FOX_CATALOG_CSV_FETCH_HEADERS_JSON: invalid header name "${k.slice(0, 40)}"`);
      }
      if (v.length > MAX_CATALOG_FETCH_HEADER_VALUE_LEN) {
        throw new Error(`FOX_CATALOG_CSV_FETCH_HEADERS_JSON: value for "${name}" is too long`);
      }
      headers.set(name, v);
      n += 1;
    }
  }
  const auth = process.env.FOX_CATALOG_CSV_FETCH_AUTHORIZATION?.trim();
  if (auth) headers.set('Authorization', auth);
  return headers;
}

export async function loadCatalogCsvTextFromUrl(url: string): Promise<string> {
  const u = normalizeGoogleSheetsUrlToCsvExport(url);
  const headers = buildCatalogCsvFetchHeaders();
  const res = await fetch(u, { redirect: 'follow', headers });
  if (!res.ok) {
    throw new Error(`Fetch catalog CSV failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

export async function syncCatalogFromCsvText(
  text: string,
  options: { pruneMissing: boolean },
): Promise<SyncResult> {
  const rows = parseFoxCatalogCsv(text);
  return upsertCatalogRows(rows, options.pruneMissing);
}

/** Google Apps Script / JSON automation: array of row objects (Manufacturer, Model, Category, …). */
export async function syncCatalogFromStructuredRows(
  rawRows: Array<Record<string, unknown>>,
  options: { pruneMissing: boolean },
): Promise<SyncResult> {
  const rows = catalogDeviceRowsFromStructured(rawRows);
  return upsertCatalogRows(rows, options.pruneMissing);
}

export async function syncCatalogFromConfiguredFile(options: {
  pruneMissing: boolean;
  filePath?: string;
}): Promise<SyncResult & { source: string }> {
  const p = options.filePath?.trim()
    ? path.resolve(options.filePath)
    : resolveDefaultCsvPath();
  const text = await fs.promises.readFile(p, 'utf8');
  const result = await syncCatalogFromCsvText(text, options);
  return { ...result, source: p };
}

export async function syncCatalogFromConfiguredUrl(options: {
  pruneMissing: boolean;
  url?: string;
}): Promise<SyncResult & { source: string }> {
  const url = (options.url ?? process.env.FOX_CATALOG_CSV_URL ?? '').trim();
  if (!url) throw new Error('FOX_CATALOG_CSV_URL is not set');
  const text = await loadCatalogCsvTextFromUrl(url);
  const result = await syncCatalogFromCsvText(text, options);
  return { ...result, source: normalizeGoogleSheetsUrlToCsvExport(url) };
}

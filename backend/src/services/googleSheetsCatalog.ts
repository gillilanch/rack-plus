import fs from 'fs';
import path from 'path';
import { JWT } from 'google-auth-library';
import { parseFoxCatalogGrid, upsertCatalogRows, type SyncResult } from '../repos/catalogDeviceRepo';

const SHEETS_READONLY = 'https://www.googleapis.com/auth/spreadsheets.readonly';

type ServiceAccountCreds = { client_email: string; private_key: string };

async function loadServiceAccountCredentials(): Promise<ServiceAccountCreds> {
  const inline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    const o = JSON.parse(inline) as { client_email?: string; private_key?: string };
    if (!o.client_email || !o.private_key) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must include client_email and private_key');
    }
    return {
      client_email: o.client_email,
      private_key: o.private_key.replace(/\\n/g, '\n'),
    };
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (credPath) {
    const resolved = path.isAbsolute(credPath) ? credPath : path.resolve(process.cwd(), credPath);
    const raw = await fs.promises.readFile(resolved, 'utf8');
    const o = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!o.client_email || !o.private_key) {
      throw new Error('Service account JSON file must include client_email and private_key');
    }
    return {
      client_email: o.client_email,
      private_key: o.private_key.replace(/\\n/g, '\n'),
    };
  }
  throw new Error(
    'Google Sheets sync requires GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS',
  );
}

async function getSheetsAccessToken(): Promise<string> {
  const creds = await loadServiceAccountCredentials();
  const client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [SHEETS_READONLY],
  });
  const { token } = await client.getAccessToken();
  if (!token) throw new Error('Google auth returned no access token');
  return token;
}

async function sheetsGetJson<T>(url: string, accessToken: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Sheets API ${res.status}: ${text.slice(0, 800)}`);
  }
  return JSON.parse(text) as T;
}

type SpreadsheetMeta = {
  sheets?: { properties?: { title?: string } }[];
};

type ValueRange = {
  values?: unknown[][];
};

async function resolveDefaultRange(
  spreadsheetId: string,
  accessToken: string,
): Promise<string> {
  const meta = await sheetsGetJson<SpreadsheetMeta>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    accessToken,
  );
  const title = meta.sheets?.[0]?.properties?.title?.trim();
  if (!title) throw new Error('Spreadsheet has no sheets; set GOOGLE_SHEETS_RANGE explicitly');
  // Wide default so Manufacturer/Model/Category/… past column Z are not silently dropped.
  return `'${title.replace(/'/g, "''")}'!A:ZZ`;
}

/**
 * Read the live tab from Google Sheets (service account) and upsert the equipment catalog.
 *
 * Env:
 * - GOOGLE_SHEETS_SPREADSHEET_ID — from the sheet URL (.../d/<id>/...)
 * - GOOGLE_SHEETS_RANGE — optional A1 notation, e.g. `'My Tab'!A:I` or `Sheet1!A2:ZZ`. If omitted, uses first tab `A:ZZ`.
 *
 * Share the spreadsheet with the service account email (Viewer is enough).
 */
export async function syncCatalogFromGoogleSheet(options: {
  pruneMissing: boolean;
  spreadsheetId?: string;
  range?: string;
}): Promise<SyncResult & { source: string }> {
  const spreadsheetId = (options.spreadsheetId ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID ?? '').trim();
  if (!spreadsheetId) {
    throw new Error('Set GOOGLE_SHEETS_SPREADSHEET_ID to the Google Sheet document id');
  }

  const accessToken = await getSheetsAccessToken();
  let range = (options.range ?? process.env.GOOGLE_SHEETS_RANGE ?? '').trim();
  if (!range) {
    range = await resolveDefaultRange(spreadsheetId, accessToken);
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const body = await sheetsGetJson<ValueRange>(url, accessToken);
  const values = body.values ?? [];
  if (!values.length) {
    throw new Error('Google Sheet range returned no rows');
  }

  const rows = parseFoxCatalogGrid(values as unknown[][]);
  const result = await upsertCatalogRows(rows, options.pruneMissing);
  const source = `google:${spreadsheetId}:${range}`;
  return { ...result, source };
}

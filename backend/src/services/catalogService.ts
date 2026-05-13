import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../db/client';
import { ApiError } from '../http/apiError';
import { deleteCatalogDeviceById, listCatalogDevicesJson } from '../repos/catalogDeviceRepo';
import { syncCatalogFromCsvText, syncCatalogFromStructuredRows } from './catalogSync';
import { syncCatalogFromGoogleSheet } from './googleSheetsCatalog';

export function pruneFromValue(value: unknown): boolean {
  return String(value ?? '') === '1' || String(value ?? '') === 'true';
}

export async function listCatalogDevices() {
  return listCatalogDevicesJson();
}

export async function deleteCatalogDevice(idParam: unknown) {
  const id = typeof idParam === 'string' ? idParam.trim() : '';
  if (!id) throw ApiError.badRequest('Missing device id');
  const ok = await deleteCatalogDeviceById(id);
  if (!ok) throw ApiError.notFound('Catalog device not found');
  return { ok: true };
}

export async function getCatalogStatus() {
  const catalogDeviceCount = await prisma.catalogDevice.count();
  return {
    ok: true,
    catalogDeviceCount,
    webhookSecretConfigured: Boolean(env.CATALOG_WEBHOOK_SECRET),
  };
}

export async function syncCatalogFromGoogleWebhook(pruneMissing: boolean) {
  if (!env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    throw ApiError.serviceUnavailable(
      'Google Sheets API is not configured (set GOOGLE_SHEETS_SPREADSHEET_ID and service account credentials). For no-GCP sync use POST /api/catalog/sync-webhook with CSV body.',
      'google_sheets_not_configured',
    );
  }
  return { ok: true, ...(await syncCatalogFromGoogleSheet({ pruneMissing })) };
}

export async function syncCatalogFromRawCsv(rawBody: unknown, pruneMissing: boolean) {
  const buf = rawBody as Buffer | undefined;
  const text = buf != null ? buf.toString('utf8') : '';
  if (!text.trim()) throw ApiError.badRequest('Empty body; send CSV text');
  return { ok: true, ...(await syncCatalogFromCsvText(text, { pruneMissing })) };
}

const structuredCatalogBodySchema = z
  .object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    devices: z.array(z.record(z.string(), z.unknown())).optional(),
    data: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .refine((b) => (b.rows?.length ?? 0) + (b.devices?.length ?? 0) + (b.data?.length ?? 0) > 0, {
    message: 'Provide non-empty "rows", "devices", or "data" array',
  });

function structuredRowsFromBody(body: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(body)) {
    if (body.length === 0) return null;
    return body as Array<Record<string, unknown>>;
  }
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    const parsed = structuredCatalogBodySchema.safeParse(body);
    if (parsed.success) {
      const raw = parsed.data.rows ?? parsed.data.devices ?? parsed.data.data ?? [];
      return raw.length > 0 ? (raw as Array<Record<string, unknown>>) : null;
    }
  }
  return null;
}

export async function syncCatalogFromStructuredBody(rawBody: unknown, pruneMissing: boolean) {
  const raw = structuredRowsFromBody(rawBody);
  if (!raw) {
    throw ApiError.badRequest(
      'Send a JSON array of row objects, or { "rows": [ ... ] }. Each row needs manufacturer and model; other fields optional.',
    );
  }
  return { ok: true, ...(await syncCatalogFromStructuredRows(raw, { pruneMissing })) };
}

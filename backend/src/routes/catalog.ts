import crypto from 'crypto';
import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { listCatalogDevicesJson } from '../repos/catalogDeviceRepo';
import { syncCatalogFromCsvText, syncCatalogFromStructuredRows } from '../services/catalogSync';
import { syncCatalogFromGoogleSheet } from '../services/googleSheetsCatalog';

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** `X-Catalog-Webhook-Secret` or `Authorization: Bearer <same secret>`. */
function getCatalogSecretFromRequest(req: Request): string {
  const headerSecret =
    (typeof req.headers['x-catalog-webhook-secret'] === 'string'
      ? req.headers['x-catalog-webhook-secret']
      : '')?.trim() ?? '';
  if (headerSecret) return headerSecret;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return '';
}

export const catalogRouter = Router();

catalogRouter.get('/devices', async (_req, res, next) => {
  try {
    const rows = await listCatalogDevicesJson();
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/**
 * Quick health check for sync debugging: device count + whether webhook secret is set (no auth).
 * Example: `curl -s http://127.0.0.1:4000/api/catalog/status`
 */
catalogRouter.get('/status', async (_req, res, next) => {
  try {
    const catalogDeviceCount = await prisma.catalogDevice.count();
    const webhookSecretConfigured = Boolean(process.env.CATALOG_WEBHOOK_SECRET?.trim());
    res.json({ ok: true, catalogDeviceCount, webhookSecretConfigured });
  } catch (e) {
    next(e);
  }
});

function requireCatalogWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.CATALOG_WEBHOOK_SECRET?.trim();
  if (!expected) {
    res.status(503).json({ error: 'CATALOG_WEBHOOK_SECRET is not configured' });
    return;
  }
  const got = getCatalogSecretFromRequest(req);
  if (!got || !timingSafeEqualUtf8(got, expected)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

/**
 * Push sync for Google Apps Script / automation: POST raw CSV as body (text/plain or text/csv).
 * Query: ?prune=1 removes DB rows absent from this upload (full replace).
 */
/**
 * Trigger a pull from Google Sheets using server-side credentials (same secret as CSV webhook).
 * Optional query: ?prune=1
 */
catalogRouter.post('/sync-google-webhook', requireCatalogWebhookSecret, async (req, res, next) => {
  try {
    if (!process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()) {
      res
        .status(503)
        .json({
          error:
            'Google Sheets API is not configured (set GOOGLE_SHEETS_SPREADSHEET_ID and service account credentials). For no-GCP sync use POST /api/catalog/sync-webhook with CSV body.',
        });
      return;
    }
    const prune = String(req.query.prune ?? '') === '1' || String(req.query.prune ?? '') === 'true';
    const result = await syncCatalogFromGoogleSheet({ pruneMissing: prune });
    res.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof Error) {
      res.status(400).json({ error: e.message });
      return;
    }
    next(e);
  }
});

catalogRouter.post(
  '/sync-webhook',
  express.raw({
    type: ['text/csv', 'text/plain', 'application/csv', 'application/octet-stream'],
    limit: '25mb',
  }),
  requireCatalogWebhookSecret,
  async (req, res, next) => {
    try {
      const buf = req.body as Buffer | undefined;
      const text = buf != null ? buf.toString('utf8') : '';
      if (!text.trim()) {
        res.status(400).json({ error: 'Empty body; send CSV text' });
        return;
      }
      const prune = String(req.query.prune ?? '') === '1' || String(req.query.prune ?? '') === 'true';
      const result = await syncCatalogFromCsvText(text, { pruneMissing: prune });
      res.json({ ok: true, ...result });
    } catch (e) {
      next(e);
    }
  },
);

const structuredCatalogBodySchema = z
  .object({
    rows: z.array(z.record(z.string(), z.unknown())).optional(),
    devices: z.array(z.record(z.string(), z.unknown())).optional(),
    data: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .refine((b) => (b.rows?.length ?? 0) + (b.devices?.length ?? 0) + (b.data?.length ?? 0) > 0, {
    message: 'Provide non-empty "rows", "devices", or "data" array',
  });

/**
 * Normalize Apps Script / client bodies: raw array `[ {...}, ... ]`, or `{ rows | devices | data: [...] }`.
 */
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

const jsonStructuredLimit = express.json({ limit: '25mb' });

async function handleStructuredCatalogSync(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const raw = structuredRowsFromBody(req.body);
    if (!raw) {
      res.status(400).json({
        error:
          'Send a JSON array of row objects, or { "rows": [ ... ] }. Each row needs manufacturer, model, and category.',
      });
      return;
    }
    const prune = String(req.query.prune ?? '') === '1' || String(req.query.prune ?? '') === 'true';
    const result = await syncCatalogFromStructuredRows(raw, { pruneMissing: prune });
    res.json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
}

/**
 * Same auth: `X-Catalog-Webhook-Secret` or `Authorization: Bearer <CATALOG_WEBHOOK_SECRET>`.
 *
 * Body: **JSON array** `[ { "Manufacturer": "...", "Model": "...", ... }, ... ]` (sheet headers as keys — matched case-insensitively on server), **or** `{ "rows": [ ... ] }`.
 */
catalogRouter.post('/sync-structured-webhook', jsonStructuredLimit, requireCatalogWebhookSecret, handleStructuredCatalogSync);

/** Short alias — use e.g. `https://host/api/catalog/webhook` in Apps Script `BACKEND_URL`. */
catalogRouter.post('/webhook', jsonStructuredLimit, requireCatalogWebhookSecret, handleStructuredCatalogSync);

import crypto from 'crypto';
import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ApiError } from '../http/apiError';
import { asyncHandler } from '../http/asyncHandler';
import {
  deleteCatalogDevice,
  getCatalogStatus,
  listCatalogDevices,
  pruneFromValue,
  syncCatalogFromGoogleWebhook,
  syncCatalogFromRawCsv,
  syncCatalogFromStructuredBody,
} from '../services/catalogService';

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

catalogRouter.get(
  '/devices',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=30');
    res.json(await listCatalogDevices());
  }),
);

/** Delete one Postgres catalog row. Same auth as sync webhooks (`X-Catalog-Webhook-Secret`). */
catalogRouter.delete(
  '/devices/:id',
  requireCatalogWebhookSecret,
  asyncHandler(async (req, res) => {
    res.json(await deleteCatalogDevice(req.params.id));
  }),
);

/**
 * Quick health check for sync debugging: device count + whether webhook secret is set (no auth).
 * Example: `curl -s http://127.0.0.1:4000/api/catalog/status`
 */
catalogRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    res.json(await getCatalogStatus());
  }),
);

function requireCatalogWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = env.CATALOG_WEBHOOK_SECRET;
  if (!expected) {
    next(ApiError.serviceUnavailable('CATALOG_WEBHOOK_SECRET is not configured', 'catalog_secret_not_configured'));
    return;
  }
  const got = getCatalogSecretFromRequest(req);
  if (!got || !timingSafeEqualUtf8(got, expected)) {
    next(ApiError.unauthorized());
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
catalogRouter.post(
  '/sync-google-webhook',
  requireCatalogWebhookSecret,
  asyncHandler(async (req, res) => {
    res.json(await syncCatalogFromGoogleWebhook(pruneFromValue(req.query.prune)));
  }),
);

catalogRouter.post(
  '/sync-webhook',
  express.raw({
    type: ['text/csv', 'text/plain', 'application/csv', 'application/octet-stream'],
    limit: '25mb',
  }),
  requireCatalogWebhookSecret,
  asyncHandler(async (req, res) => {
    res.json(await syncCatalogFromRawCsv(req.body, pruneFromValue(req.query.prune)));
  }),
);

const jsonStructuredLimit = express.json({ limit: '25mb' });

const handleStructuredCatalogSync = asyncHandler(async (req, res) => {
  res.json(await syncCatalogFromStructuredBody(req.body, pruneFromValue(req.query.prune)));
});

/**
 * Same auth: `X-Catalog-Webhook-Secret` or `Authorization: Bearer <CATALOG_WEBHOOK_SECRET>`.
 *
 * Body: **JSON array** `[ { "Manufacturer": "...", "Model": "...", ... }, ... ]` (sheet headers as keys — matched case-insensitively on server), **or** `{ "rows": [ ... ] }`.
 */
catalogRouter.post('/sync-structured-webhook', jsonStructuredLimit, requireCatalogWebhookSecret, handleStructuredCatalogSync);

/** Short alias — use e.g. `https://host/api/catalog/webhook` in Apps Script `BACKEND_URL`. */
catalogRouter.post('/webhook', jsonStructuredLimit, requireCatalogWebhookSecret, handleStructuredCatalogSync);

import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './db/client';
import { racksRouter } from './routes/racks';
import { employeesRouter } from './routes/employees';
import { adminRouter } from './routes/admin';
import { catalogRouter } from './routes/catalog';
import { deviceCategoriesRouter } from './routes/deviceCategories';
import { errorHandler } from './middleware/errorHandler';
import {
  syncCatalogFromConfiguredFile,
  syncCatalogFromConfiguredUrl,
  syncCatalogFromGoogleSheet,
} from './services/catalogSync';

dotenv.config();

/** Minimum catalog poll interval (ms). Below this, scheduled sync is disabled to avoid hammering Google CSV export. */
const MIN_CATALOG_SYNC_INTERVAL_MS = 5_000;

function catalogPruneMissingFromEnv(): boolean {
  const v = process.env.FOX_CATALOG_PRUNE_ON_SYNC?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

function resolveFrontendDist(): string {
  const override = process.env.FRONTEND_DIST?.trim();
  if (override) return path.resolve(override);
  return path.join(__dirname, '../../frontend/dist');
}

app.use(cors());
app.use(express.json());

if (!isProduction) {
  app.get('/', (_req, res) => {
    res.send('Backend running');
  });
}

app.get('/health', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    let catalogDeviceCount: number | null = null;
    try {
      catalogDeviceCount = await prisma.catalogDevice.count();
    } catch {
      /* migration not applied or table missing */
    }
    const webhookSecretConfigured = Boolean(process.env.CATALOG_WEBHOOK_SECRET?.trim());
    res.json({ ok: true, catalogDeviceCount, webhookSecretConfigured });
  } catch (e) {
    next(e);
  }
});

app.use('/api/employees', employeesRouter);
app.use('/api/racks', racksRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/device-categories', deviceCategoriesRouter);
app.use('/admin', adminRouter);

function scheduleFoxCatalogSync(): void {
  const ms = Number(process.env.FOX_CATALOG_SYNC_INTERVAL_MS ?? 0);
  if (!Number.isFinite(ms) || ms <= 0) return;
  if (ms < MIN_CATALOG_SYNC_INTERVAL_MS) {
    console.warn(
      `[catalog] FOX_CATALOG_SYNC_INTERVAL_MS=${ms} is below minimum ${MIN_CATALOG_SYNC_INTERVAL_MS}ms; scheduled CSV/sheet sync disabled.`,
    );
    return;
  }
  const prune = catalogPruneMissingFromEnv();
  const tick = async () => {
    try {
      if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()) {
        await syncCatalogFromGoogleSheet({ pruneMissing: prune });
      } else if (process.env.FOX_CATALOG_CSV_URL?.trim()) {
        await syncCatalogFromConfiguredUrl({ pruneMissing: prune });
      } else {
        await syncCatalogFromConfiguredFile({ pruneMissing: prune });
      }
    } catch (e) {
      console.error('[catalog] scheduled sync failed', e);
    }
  };
  void tick();
  setInterval(() => void tick(), ms);
}

if (process.env.FOX_CATALOG_SYNC_ON_STARTUP === '1') {
  void (async () => {
    try {
      const prune = catalogPruneMissingFromEnv();
      if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim()) {
        await syncCatalogFromGoogleSheet({ pruneMissing: prune });
      } else if (process.env.FOX_CATALOG_CSV_URL?.trim()) {
        await syncCatalogFromConfiguredUrl({ pruneMissing: prune });
      } else {
        await syncCatalogFromConfiguredFile({ pruneMissing: prune });
      }
      console.log('[catalog] startup sync completed');
    } catch (e) {
      console.warn('[catalog] startup sync skipped or failed:', e);
    }
  })();
}

scheduleFoxCatalogSync();

if (isProduction) {
  const distPath = resolveFrontendDist();
  const indexPath = path.join(distPath, 'index.html');
  const distOk = fs.existsSync(indexPath);

  if (distOk) {
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.method !== 'GET') {
        next();
        return;
      }
      const p = req.path;
      if (p.startsWith('/api') || p.startsWith('/admin') || p === '/health') {
        next();
        return;
      }
      res.sendFile(indexPath, (err) => {
        if (err) next(err);
      });
    });
  } else {
    console.warn(
      `[server] NODE_ENV=production but frontend dist missing at ${indexPath}. Run frontend build or set FRONTEND_DIST.`,
    );
    app.get('/', (_req, res) => {
      res
        .status(503)
        .type('text')
        .send('Frontend dist not found. Build the frontend and restart, or set FRONTEND_DIST.');
    });
  }
}

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (Number(process.env.FOX_CATALOG_SYNC_INTERVAL_MS ?? 0) >= MIN_CATALOG_SYNC_INTERVAL_MS) {
    console.log(
      `[catalog] polling sync every ${process.env.FOX_CATALOG_SYNC_INTERVAL_MS}ms (Google Sheet API, CSV URL, or local file)`,
    );
  }
});

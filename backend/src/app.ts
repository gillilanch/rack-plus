import path from 'path';
import fs from 'fs';
import express from 'express';
import type { Express } from 'express';
import cors from 'cors';
import { prisma } from './db/client';
import { racksRouter } from './routes/racks';
import { employeesRouter } from './routes/employees';
import { adminRouter } from './routes/admin';
import { catalogRouter } from './routes/catalog';
import { deviceCategoriesRouter } from './routes/deviceCategories';
import { errorHandler } from './middleware/errorHandler';
import { env } from './config/env';

function resolveFrontendDist(): string {
  const override = env.FRONTEND_DIST;
  if (override) return path.resolve(override);
  return path.join(__dirname, '../../frontend/dist');
}

function mountProductionFrontend(app: Express): void {
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
    return;
  }

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

export function createApp(): Express {
  const app = express();
  const isProduction = env.NODE_ENV === 'production';

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
      const webhookSecretConfigured = Boolean(env.CATALOG_WEBHOOK_SECRET);
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

  if (isProduction) {
    mountProductionFrontend(app);
  }

  app.use(errorHandler);

  return app;
}

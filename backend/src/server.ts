import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './db/client';
import { racksRouter } from './routes/racks';
import { employeesRouter } from './routes/employees';
import { adminRouter } from './routes/admin';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

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
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.use('/api/employees', employeesRouter);
app.use('/api/racks', racksRouter);
app.use('/admin', adminRouter);

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
});

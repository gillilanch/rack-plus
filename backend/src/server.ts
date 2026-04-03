import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './db/client';
import { racksRouter } from './routes/racks';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/', (_req, res) => {
  res.send('Backend running');
});

app.get('/health', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

app.use('/api/racks', racksRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

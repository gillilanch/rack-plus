import path from 'path';
import dotenv from 'dotenv';

/** Load `backend/.env` before any module that imports Prisma (import this file first in `server.ts`). */
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
    res.status(400).json({ error: message || 'Validation failed' });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    // Common after pulling code before `npx prisma migrate deploy`
    if (err.code === 'P2022' || err.message.includes('does not exist')) {
      console.error(err);
      res.status(500).json({
        error:
          'Database schema is out of date. On the server run: cd backend && npx prisma migrate deploy',
      });
      return;
    }
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

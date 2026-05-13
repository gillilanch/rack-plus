import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { isApiError } from '../http/apiError';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (isApiError(err)) {
    const body: { error: string; code?: string } = { error: err.message };
    if (err.code) body.code = err.code;
    res.status(err.statusCode).json(body);
    return;
  }
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
    // Table/column missing (P2021 table, P2022 column) or similar — usually migrations not applied
    const schemaCodes = new Set(['P2021', 'P2022', 'P2010']);
    if (
      schemaCodes.has(err.code) ||
      /does not exist/i.test(err.message) ||
      /relation .+ does not exist/i.test(err.message)
    ) {
      console.error(err);
      res.status(500).json({
        error:
          'Database schema is out of date. From the backend folder run: npx prisma migrate deploy',
      });
      return;
    }
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const msg = err.message;
    if (/does not exist|relation .+ does not exist|fox_employee_extra/i.test(msg)) {
      console.error(err);
      res.status(500).json({
        error:
          'Database schema is out of date. From the backend folder run: npx prisma migrate deploy',
      });
      return;
    }
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}

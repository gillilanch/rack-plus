import { Router } from 'express';
import { asyncHandler } from '../http/asyncHandler';
import { getHealthStatus } from '../services/healthService';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await getHealthStatus());
  }),
);

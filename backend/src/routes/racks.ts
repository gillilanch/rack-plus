import { Router } from 'express';
import { asyncHandler } from '../http/asyncHandler';
import {
  createRackConfig,
  deleteRackConfig,
  getRackConfig,
  listRackSummaries,
  updateRackConfig,
} from '../services/rackService';

export const racksRouter = Router();

racksRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listRackSummaries());
  }),
);

racksRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await getRackConfig(req.params.id));
  }),
);

racksRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await createRackConfig(req.body));
  }),
);

racksRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await updateRackConfig(req.params.id, req.body));
  }),
);

racksRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteRackConfig(req.params.id);
    res.status(204).send();
  }),
);

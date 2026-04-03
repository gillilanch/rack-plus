import { Router } from 'express';
import { createRackBodySchema, updateRackBodySchema } from '../types/rackApi';
import * as rackRepo from '../repos/rackRepo';

export const racksRouter = Router();

racksRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await rackRepo.listRacks();
    res.json(
      rows.map((r) => ({
        id: r.id,
        name: r.name,
        totalHeight: r.totalHeightU,
        updatedAt: r.updatedAt.toISOString(),
      })),
    );
  } catch (e) {
    next(e);
  }
});

racksRouter.get('/:id', async (req, res, next) => {
  try {
    const config = await rackRepo.getRackById(req.params.id);
    if (!config) {
      res.status(404).json({ error: 'Rack not found' });
      return;
    }
    res.json(config);
  } catch (e) {
    next(e);
  }
});

racksRouter.post('/', async (req, res, next) => {
  try {
    const body = createRackBodySchema.parse(req.body);
    const config = await rackRepo.createRack(body);
    res.status(201).json(config);
  } catch (e) {
    next(e);
  }
});

racksRouter.put('/:id', async (req, res, next) => {
  try {
    const body = updateRackBodySchema.parse(req.body);
    const config = await rackRepo.upsertRackFull(req.params.id, body);
    res.json(config);
  } catch (e) {
    next(e);
  }
});

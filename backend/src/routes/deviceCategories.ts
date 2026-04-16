import { Router } from 'express';
import * as deviceCategoryRepo from '../repos/deviceCategoryRepo';

export const deviceCategoriesRouter = Router();

deviceCategoriesRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await deviceCategoryRepo.listDeviceCategoriesOrdered();
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

deviceCategoriesRouter.post('/', async (req, res, next) => {
  try {
    const name = (req.body as { name?: string })?.name;
    if (typeof name !== 'string') {
      res.status(400).json({ error: 'Send JSON { "name": "Category label" }' });
      return;
    }
    const row = await deviceCategoryRepo.upsertDeviceCategoryByName(name);
    res.status(201).json(row);
  } catch (e) {
    next(e);
  }
});

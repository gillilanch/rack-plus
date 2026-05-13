import { Router } from 'express';
import { asyncHandler } from '../http/asyncHandler';
import { createDeviceCategory, listDeviceCategories } from '../services/deviceCategoryService';

export const deviceCategoriesRouter = Router();

deviceCategoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=15');
    res.json(await listDeviceCategories());
  }),
);

deviceCategoriesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await createDeviceCategory(req.body));
  }),
);

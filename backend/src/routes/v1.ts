import { Router } from 'express';
import { catalogRouter } from './catalog';
import { deviceCategoriesRouter } from './deviceCategories';
import { employeesRouter } from './employees';
import { healthRouter } from './health';
import { racksRouter } from './racks';

export const v1Router = Router();

v1Router.get('/', (_req, res) => {
  res.json({
    name: 'Rack+ API',
    version: 'v1',
    endpoints: {
      health: '/api/v1/health',
      racks: '/api/v1/racks',
      catalog: '/api/v1/catalog',
      deviceCategories: '/api/v1/device-categories',
      employees: '/api/v1/employees',
    },
  });
});

v1Router.use('/health', healthRouter);
v1Router.use('/employees', employeesRouter);
v1Router.use('/racks', racksRouter);
v1Router.use('/catalog', catalogRouter);
v1Router.use('/device-categories', deviceCategoriesRouter);

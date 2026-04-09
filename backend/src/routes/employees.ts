import { Router } from 'express';
import { FOX_EMPLOYEE_NAMES } from '../data/foxEmployees';

export const employeesRouter = Router();

employeesRouter.get('/', (_req, res) => {
  res.json({ names: [...FOX_EMPLOYEE_NAMES] });
});

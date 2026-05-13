import { Router } from 'express';
import { asyncHandler } from '../http/asyncHandler';
import { addEmployeeExtra, listEmployees, removeEmployeeExtra } from '../services/employeeService';

export const employeesRouter = Router();

employeesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await listEmployees());
  }),
);

employeesRouter.post(
  '/extras',
  asyncHandler(async (req, res) => {
    res.status(201).json(await addEmployeeExtra(req.body));
  }),
);

employeesRouter.delete(
  '/extras',
  asyncHandler(async (req, res) => {
    await removeEmployeeExtra(req.body);
    res.status(204).send();
  }),
);

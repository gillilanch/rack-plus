import { Router } from 'express';
import { FOX_EMPLOYEE_NAMES } from '../data/foxEmployees';
import * as foxEmployeeExtrasRepo from '../repos/foxEmployeeExtrasRepo';
import { employeeExtraBodySchema } from '../types/employeeExtrasApi';

export const employeesRouter = Router();

function mergeSortedUnique(directory: readonly string[], extras: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (n: string) => {
    const t = n.trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  for (const n of directory) push(n);
  for (const n of extras) push(n);
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

employeesRouter.get('/', async (_req, res, next) => {
  try {
    const extras = await foxEmployeeExtrasRepo.listFoxEmployeeExtras();
    const directory = [...FOX_EMPLOYEE_NAMES];
    const names = mergeSortedUnique(directory, extras);
    res.json({ directory, extras, names });
  } catch (e) {
    next(e);
  }
});

employeesRouter.post('/extras', async (req, res, next) => {
  try {
    const { name } = employeeExtraBodySchema.parse(req.body);
    const result = await foxEmployeeExtrasRepo.addFoxEmployeeExtra(name);
    if (!result.ok) {
      if (result.code === 'empty') {
        res.status(400).json({ error: 'Name is required.' });
        return;
      }
      if (result.code === 'duplicate_directory') {
        res.status(409).json({ error: 'That name is already in the Fox directory on this server.' });
        return;
      }
      res.status(409).json({ error: 'That name is already in the added list.' });
      return;
    }
    res.status(201).json({ name: result.displayName });
  } catch (e) {
    next(e);
  }
});

employeesRouter.delete('/extras', async (req, res, next) => {
  try {
    const { name } = employeeExtraBodySchema.parse(req.body);
    const removed = await foxEmployeeExtrasRepo.removeFoxEmployeeExtraByDisplayName(name);
    if (!removed) {
      res.status(404).json({ error: 'Name not found in the added list.' });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

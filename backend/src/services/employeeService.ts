import { FOX_EMPLOYEE_NAMES } from '../data/foxEmployees';
import { ApiError } from '../http/apiError';
import * as foxEmployeeExtrasRepo from '../repos/foxEmployeeExtrasRepo';
import { employeeExtraBodySchema } from '../types/employeeExtrasApi';

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

export async function listEmployees() {
  const extras = await foxEmployeeExtrasRepo.listFoxEmployeeExtras();
  const directory = [...FOX_EMPLOYEE_NAMES];
  const names = mergeSortedUnique(directory, extras);
  return { directory, extras, names };
}

export async function addEmployeeExtra(rawBody: unknown) {
  const { name } = employeeExtraBodySchema.parse(rawBody);
  const result = await foxEmployeeExtrasRepo.addFoxEmployeeExtra(name);
  if (result.ok) return { name: result.displayName };

  if (result.code === 'empty') {
    throw ApiError.badRequest('Name is required.');
  }
  if (result.code === 'duplicate_directory') {
    throw ApiError.conflict('That name is already in the Fox directory on this server.', 'duplicate_directory_employee');
  }
  throw ApiError.conflict('That name is already in the added list.', 'duplicate_extra_employee');
}

export async function removeEmployeeExtra(rawBody: unknown): Promise<void> {
  const { name } = employeeExtraBodySchema.parse(rawBody);
  const removed = await foxEmployeeExtrasRepo.removeFoxEmployeeExtraByDisplayName(name);
  if (!removed) throw ApiError.notFound('Name not found in the added list.');
}

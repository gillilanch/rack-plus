import { mergeFoxEmployeeLists } from '../utils/foxEmployeeExtras';

const BASE = '/api/employees';

/** Official directory from the server (Fox engineering list). */
export async function listFoxEmployees(): Promise<string[]> {
  const res = await fetch(BASE);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || res.statusText);
  }
  const data = (await res.json()) as { names: string[] };
  return data.names ?? [];
}

/** Directory + names added in this browser (Device database → Fox Employees). */
export async function listFoxEmployeesMerged(): Promise<string[]> {
  try {
    const directory = await listFoxEmployees();
    return mergeFoxEmployeeLists(directory);
  } catch {
    return mergeFoxEmployeeLists([]);
  }
}

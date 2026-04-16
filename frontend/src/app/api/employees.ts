import { notifyFoxEmployeesChanged } from '../utils/foxEmployeeExtras';
import { apiUrl } from './apiUrl';

const pathEmployees = '/api/employees';

export type EmployeesCatalogResponse = {
  directory: string[];
  extras: string[];
  names: string[];
};

export async function fetchEmployeesCatalog(): Promise<EmployeesCatalogResponse> {
  let res: Response;
  try {
    res = await fetch(apiUrl(pathEmployees));
  } catch (e) {
    throw new Error(
      e instanceof TypeError
        ? 'Cannot reach the API. Start the backend (port in backend/.env) or set VITE_API_BASE_URL in frontend/.env.development.'
        : 'Request failed',
    );
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || res.statusText);
  }
  const data = (await res.json()) as Partial<EmployeesCatalogResponse> & { names?: string[] };
  const directory = data.directory ?? [];
  const extras = data.extras ?? [];
  const names =
    data.names ??
    (() => {
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
    })();
  return { directory, extras, names };
}

/** Merged directory + server extras (for autocomplete). */
export async function listFoxEmployees(): Promise<string[]> {
  const c = await fetchEmployeesCatalog();
  return c.names;
}

export async function listFoxEmployeesMerged(): Promise<string[]> {
  try {
    return (await fetchEmployeesCatalog()).names;
  } catch {
    return [];
  }
}

export async function addFoxEmployeeExtra(
  name: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(apiUrl(`${pathEmployees}/extras`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      notifyFoxEmployeesChanged();
      return { ok: true };
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, reason: body.error || 'Could not add name.' };
  } catch (e) {
    const msg =
      e instanceof TypeError
        ? 'Cannot reach the API. Start the backend (see README) or set VITE_API_BASE_URL in frontend/.env.development.'
        : 'Could not add name.';
    return { ok: false, reason: msg };
  }
}

export async function removeFoxEmployeeExtra(name: string): Promise<boolean> {
  try {
    const res = await fetch(apiUrl(`${pathEmployees}/extras`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      notifyFoxEmployeesChanged();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

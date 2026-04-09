const STORAGE_KEY = 'rackPlus_foxEmployeeExtras';

export const FOX_EMPLOYEES_CHANGED_EVENT = 'rack-plus-fox-employees-changed';

function notify(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FOX_EMPLOYEES_CHANGED_EVENT));
  }
}

export function getFoxEmployeeExtras(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string');
  } catch {
    return [];
  }
}

export function mergeFoxEmployeeLists(directoryNames: readonly string[]): string[] {
  const extras = getFoxEmployeeExtras();
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
  for (const n of directoryNames) push(n);
  for (const n of extras) push(n);
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function addFoxEmployeeExtra(raw: string): { ok: true } | { ok: false; reason: string } {
  const t = raw.trim();
  if (!t) return { ok: false, reason: 'Enter a name.' };
  const lower = t.toLowerCase();
  const extras = getFoxEmployeeExtras();
  if (extras.some((n) => n.trim().toLowerCase() === lower)) {
    return { ok: false, reason: 'That name is already in your local list.' };
  }
  extras.push(t);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(extras));
  notify();
  return { ok: true };
}

export function removeFoxEmployeeExtra(name: string): void {
  const target = name.trim().toLowerCase();
  const next = getFoxEmployeeExtras().filter((n) => n.trim().toLowerCase() !== target);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notify();
}

export const FOX_EMPLOYEES_CHANGED_EVENT = 'rack-plus-fox-employees-changed';

export function notifyFoxEmployeesChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FOX_EMPLOYEES_CHANGED_EVENT));
  }
}

/** Merge directory + server-stored extras without duplicates (case-insensitive). */
export function mergeFoxEmployeeLists(
  directoryNames: readonly string[],
  extraNames: readonly string[],
): string[] {
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
  for (const n of extraNames) push(n);
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

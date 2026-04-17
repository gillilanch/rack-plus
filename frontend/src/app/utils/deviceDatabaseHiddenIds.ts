/** Client-side “removed from this list” for built-in and server rows when API delete isn’t used. */

const K_BUILTIN = 'rack-plus-device-db-hidden-builtin-ids';
const K_SERVER = 'rack-plus-device-db-hidden-server-catalog-ids';

function loadIds(key: string): Set<string> {
  try {
    const s = localStorage.getItem(key);
    if (!s) return new Set();
    const a = JSON.parse(s) as unknown;
    if (!Array.isArray(a)) return new Set();
    return new Set(a.filter((x): x is string => typeof x === 'string' && x.length > 0));
  } catch {
    return new Set();
  }
}

function saveIds(key: string, ids: Set<string>): void {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

export function getHiddenBuiltinDeviceIds(): Set<string> {
  return loadIds(K_BUILTIN);
}

export function hideBuiltinDeviceId(id: string): void {
  const s = loadIds(K_BUILTIN);
  s.add(id);
  saveIds(K_BUILTIN, s);
}

export function getHiddenServerCatalogDeviceIds(): Set<string> {
  return loadIds(K_SERVER);
}

export function hideServerCatalogDeviceId(id: string): void {
  const s = loadIds(K_SERVER);
  s.add(id);
  saveIds(K_SERVER, s);
}

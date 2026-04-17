import { devices as builtInDevices } from '../data/equipment';
import { apiUrl } from '../api/apiUrl';
import { getCustomDevices } from './customDevices';
import { getServerCatalogDevices } from './serverCatalogCache';

type CategoryRow = { id: string; name: string };

let cachedNames: string[] = [];
let inflight: Promise<void> | undefined;

export function getDeviceCategoryNames(): string[] {
  return [...cachedNames];
}

/**
 * Dropdown list: Postgres `device-categories` plus every distinct `category` string from the AVCAD
 * server catalog sheet, built-in devices, and browser-saved custom devices (case-insensitive dedupe).
 */
export function getMergedDeviceCategoryNames(): string[] {
  const merged = new Map<string, string>();
  const add = (raw: string) => {
    const t = raw.trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (!merged.has(k)) merged.set(k, t);
  };
  for (const n of cachedNames) add(n);
  for (const d of getServerCatalogDevices()) add(d.category);
  for (const d of getCustomDevices()) add(d.category);
  for (const d of builtInDevices) add(d.category);
  return [...merged.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export async function prefetchDeviceCategories(): Promise<void> {
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const r = await fetch(apiUrl('/api/device-categories'));
      if (!r.ok) return;
      const rows = (await r.json()) as CategoryRow[];
      if (!Array.isArray(rows)) return;
      cachedNames = rows.map((x) => x.name).filter((n) => n.trim().length > 0);
    } catch {
      /* offline */
    }
  })();
  inflight = p;
  try {
    await p;
  } finally {
    inflight = undefined;
  }
}

/** Register a category in Postgres (no-op if it already exists). Ignores network / server errors. */
export async function ensureDeviceCategoryInDb(name: string): Promise<void> {
  const t = name.trim();
  if (!t) return;
  try {
    const r = await fetch(apiUrl('/api/device-categories'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: t }),
    });
    if (!r.ok) return;
    await prefetchDeviceCategories();
  } catch {
    /* offline or server down — device save still proceeds */
  }
}

import type { Device } from '../data/equipment';
import { devices as builtInDevices } from '../data/equipment';
import { getDeviceSearchBlob } from './deviceDisplay';
import { getCustomDevices } from './customDevices';

export function mergeBuiltInAndCustomDevices(): Device[] {
  return [...builtInDevices, ...getCustomDevices()];
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) row[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

function scoreNameMatch(query: string, deviceName: string): number {
  const q = query.trim().toLowerCase();
  const n = deviceName.toLowerCase();
  if (!q) return 0;
  if (n === q) return 100_000;
  if (n.startsWith(q)) return 50_000 - n.length;
  const idx = n.indexOf(q);
  if (idx >= 0) return 30_000 - idx * 10 - Math.abs(n.length - q.length);
  const maxLen = Math.max(q.length, n.length);
  if (maxLen === 0) return 0;
  const dist = levenshtein(q, n);
  const sim = 1 - dist / maxLen;
  if (sim >= 0.5 && dist <= Math.max(3, Math.floor(maxLen * 0.35))) {
    return Math.floor(sim * 10_000);
  }
  return 0;
}

function deviceMatchScore(query: string, d: Device): number {
  const q = query.trim();
  if (!q) return 0;
  const blob = getDeviceSearchBlob(d);
  const parts = [blob, d.name, d.manufacturer ?? '', d.model ?? ''].filter(Boolean);
  let best = 0;
  for (const p of parts) {
    best = Math.max(best, scoreNameMatch(q, p));
  }
  return best;
}

/** Ranked suggestions for autocomplete (built-in + Fox / custom saved devices). */
export function searchDevicesByName(query: string, pool: Device[], limit = 8): Device[] {
  const q = query.trim();
  if (!q) return [];
  const seen = new Set<string>();
  const scored = pool
    .map((d) => ({ d, s: deviceMatchScore(q, d) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const out: Device[] = [];
  for (const { d } of scored) {
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    out.push(d);
    if (out.length >= limit) break;
  }
  return out;
}

export function findExactDeviceByName(name: string, pool: Device[]): Device | undefined {
  const t = name.trim().toLowerCase();
  return pool.find((d) => {
    if (d.name.trim().toLowerCase() === t) return true;
    const m = (d.manufacturer ?? '').trim().toLowerCase();
    const md = (d.model ?? '').trim().toLowerCase();
    if (m && md && `${m} ${md}` === t) return true;
    return false;
  });
}

/**
 * Map a parts-list / CSV row name to a built-in or Fox device when confident enough.
 * Uses exact name first, then the same ranking as manual-add autocomplete with a fuzzy floor
 * so unrelated strings do not pick up random catalog rows.
 */
export function resolvePartsNameToCatalogDevice(
  partsName: string,
  pool: Device[],
): { device: Device; match: 'exact' | 'fuzzy' } | null {
  const trimmed = partsName.trim();
  if (!trimmed) return null;

  const exact = findExactDeviceByName(trimmed, pool);
  if (exact) return { device: exact, match: 'exact' };

  if (trimmed.length < 2) return null;

  const ranked = pool
    .map((d) => ({ d, s: deviceMatchScore(trimmed, d) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);

  const top = ranked[0];
  if (!top) return null;

  const MIN_FUZZY_SCORE = 7200;
  if (top.s >= MIN_FUZZY_SCORE) return { device: top.d, match: 'fuzzy' };
  return null;
}



/*can delete LABELS later */
export function manualCategoryToDeviceCategory(manual: string): Device['category'] {
  const map: Record<string, Device['category']> = {
    Camera: 'Camera',
    Laptop: 'Laptop',
    Recording: 'Recording Deck',
    'Recording Deck': 'Recording Deck',
    Audio: 'Audio',
    Monitor: 'Monitor',
    Interface: 'Interface',
    Network: 'Interface',
    Power: 'Interface',
    Other: 'Interface',
  };
  return map[manual] ?? 'Interface';
}

export function deviceCategoryToManualLabel(cat: Device['category']): string {
  if (cat === 'Recording Deck') return 'Recording';
  return cat;
}

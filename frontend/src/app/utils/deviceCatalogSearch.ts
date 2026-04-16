import type { Device } from '../data/equipment';
import { devices as builtInDevices } from '../data/equipment';
import { getDeviceSearchBlob } from './deviceDisplay';
import { getCustomDevices } from './customDevices';
import { getServerCatalogDevices } from './serverCatalogCache';

export function mergeBuiltInAndCustomDevices(): Device[] {
  return [...builtInDevices, ...getCustomDevices(), ...getServerCatalogDevices()];
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

/** O(1) exact lookup for CSV import (name or "manufacturer model" lower key). */
export function buildDeviceExactLookup(pool: Device[]): Map<string, Device> {
  const idx = new Map<string, Device>();
  for (const d of pool) {
    idx.set(d.name.trim().toLowerCase(), d);
    const m = (d.manufacturer ?? '').trim().toLowerCase();
    const md = (d.model ?? '').trim().toLowerCase();
    if (m && md) idx.set(`${m} ${md}`, d);
  }
  return idx;
}

/** Collapse spaces/hyphens for tolerant model line matching (PXW-FX9 vs PXW FX9). */
function normalizeMfrModelToken(s: string): string {
  return s.trim().toLowerCase().replace(/[\s\-_.]+/g, '');
}

/**
 * When CSV display text does not fuzzy-match, still link rows that match catalog manufacturer+model
 * (handles hyphen/spacing differences vs AVCAD / server catalog).
 */
export function findDeviceByManufacturerModelLoose(manufacturer: string, model: string, pool: Device[]): Device | null {
  const m = manufacturer.trim();
  const md = model.trim();
  if (!m || !md) return null;
  const mL = m.toLowerCase();
  const mdL = md.toLowerCase();
  const nM = normalizeMfrModelToken(m);
  const nMd = normalizeMfrModelToken(md);
  for (const d of pool) {
    const dm = (d.manufacturer ?? '').trim();
    const dmd = (d.model ?? '').trim();
    if (!dm || !dmd) continue;
    if (dm.toLowerCase() === mL && dmd.toLowerCase() === mdL) return d;
    if (normalizeMfrModelToken(dm) === nM && normalizeMfrModelToken(dmd) === nMd) return d;
  }
  return null;
}

/**
 * CSV row → catalog device: match on full label first, then manufacturer+model (strict/loose).
 */
export function resolveCsvImportRowToCatalogDevice(
  c: { text: string; manufacturer?: string; model?: string },
  pool: Device[],
  exactLookup: Map<string, Device>,
): { device: Device; match: 'exact' | 'fuzzy' } | null {
  const textNorm = c.text.trim().replace(/\s+/g, ' ');
  let r = resolvePartsNameToCatalogDevice(textNorm, pool, exactLookup);
  if (r) return r;

  const mfr = c.manufacturer?.trim();
  const mdl = c.model?.trim();
  if (mfr && mdl) {
    const loose = findDeviceByManufacturerModelLoose(mfr, mdl, pool);
    if (loose) return { device: loose, match: 'exact' };
    const combined = `${mfr} ${mdl}`.replace(/\s+/g, ' ');
    r = resolvePartsNameToCatalogDevice(combined, pool, exactLookup);
    if (r) return r;
  }
  return null;
}

/**
 * Map a parts-list / CSV row name to a built-in or Fox device when confident enough.
 * Uses exact name first, then the same ranking as manual-add autocomplete with a fuzzy floor
 * so unrelated strings do not pick up random catalog rows.
 */
export function resolvePartsNameToCatalogDevice(
  partsName: string,
  pool: Device[],
  exactLookup?: Map<string, Device>,
): { device: Device; match: 'exact' | 'fuzzy' } | null {
  const trimmed = partsName.trim();
  if (!trimmed) return null;

  const t = trimmed.toLowerCase();
  const exact = exactLookup?.get(t) ?? findExactDeviceByName(trimmed, pool);
  if (exact) return { device: exact, match: 'exact' };

  if (trimmed.length < 2) return null;

  let fuzzyPool = pool;
  if (pool.length > 120) {
    const prefix = t.slice(0, Math.min(4, t.length));
    if (prefix.length >= 2) {
      const narrowed = pool.filter((d) => {
        const blob = getDeviceSearchBlob(d).toLowerCase();
        return blob.includes(prefix) || d.name.toLowerCase().includes(prefix);
      });
      if (narrowed.length > 0) fuzzyPool = narrowed;
    }
  }

  const ranked = fuzzyPool
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
/** Legacy rack labels → canonical string; otherwise pass through. */
export function manualCategoryToDeviceCategory(manual: string): string {
  const t = manual.trim();
  if (!t) return 'Other';
  const legacy: Record<string, string> = {
    Recording: 'Recording',
    'Recording Deck': 'Recording',
  };
  return legacy[t] ?? t;
}

export function deviceCategoryToManualLabel(cat: string): string {
  if (cat === 'Recording Deck') return 'Recording';
  return cat;
}

/**
 * Use sheet category on the device: match DB list case-insensitively (canonical spelling),
 * otherwise keep the sheet text (not forced to Other). Empty → Other.
 */
export function resolveImportCategory(sheetCategory: string, dbNames: string[]): string {
  const t = sheetCategory.trim();
  if (!t) return 'Other';
  const lower = t.toLowerCase();
  for (const n of dbNames) {
    if (n.trim().toLowerCase() === lower) return n.trim();
  }
  return t;
}

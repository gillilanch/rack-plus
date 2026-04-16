import type { Device } from '../data/equipment';
import { buildDeviceExactLookup, resolvePartsNameToCatalogDevice } from './deviceCatalogSearch';
import { getDeviceDisplayName, inferManufacturerModelFromLegacyName } from './deviceDisplay';
import { DEFAULT_INCHES_PER_RU, ruFromInches } from './rackUnits';

/**
 * CSV row → one rack import candidate. Identity from:
 * `manufacturer` + `model`, or `name`, or (when those are missing) other cells matched to the catalog
 * or parsed as manufacturer-style text. Row settings: category, power, width, height, depth;
 * numbers next to `RU` in any cell set rack height (U) when no explicit U column.
 */

export type CsvCellCandidate = {
  /** Single display / match string (manufacturer + model, or name column). */
  text: string;
  heightInU: number;
  category: string;
  /** Face height in inches from the sheet (0 if missing / non-numeric). */
  physicalHeightInches: number;
  fromNameColumn: boolean;
  manufacturer?: string;
  model?: string;
  /** Front width in inches (0 if missing). Placement still uses default width when 0. */
  deviceWidthInches: number;
  /** Depth in inches (0 if missing). */
  deviceDepthInches: number;
  sheetPower: string;
  /** True when this row's object keys include a header whose name contains "height" (case-insensitive). */
  sheetHadHeightColumn: boolean;
  sheetHadDepthColumn: boolean;
  sheetHadWidthColumn: boolean;
};

const PURE_NUMBER = /^\d+(\.\d+)?$/;

/** Skip cells that are obviously not equipment names (legacy matrix mode). */
export function shouldSkipCellValue(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2) return true;
  if (PURE_NUMBER.test(t)) return true;
  return false;
}

function pickValue(row: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map<string, unknown>();
  for (const [k, v] of Object.entries(row)) {
    lower.set(k.toLowerCase(), v);
  }
  for (const k of keys) {
    const direct = row[k];
    if (direct != null && String(direct).trim() !== '') return direct;
    const lv = lower.get(k.toLowerCase());
    if (lv != null && String(lv).trim() !== '') return lv;
  }
  return undefined;
}

function pickString(row: Record<string, unknown>, keys: string[]): string {
  const raw = pickValue(row, keys);
  if (raw == null) return '';
  return String(raw).trim();
}

/** Non-negative number; missing or invalid → 0. */
export function pickNonNegativeNumber(row: Record<string, unknown>, keys: string[]): number {
  const raw = pickValue(row, keys);
  if (raw == null || raw === '') return 0;
  const n = parseFloat(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Match header labels loosely (e.g. "Rack width" vs rackWidth). */
function pickNonNegativeNumberLoose(row: Record<string, unknown>, headerPatterns: string[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').replace(/-/g, ' ');
  const rowKeys = Object.keys(row);
  for (const pat of headerPatterns) {
    const p = norm(pat);
    for (const k of rowKeys) {
      if (norm(k) !== p) continue;
      const raw = row[k];
      if (raw == null || raw === '') continue;
      const n = parseFloat(String(raw).replace(/,/g, ''));
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }
  return 0;
}

export type SheetRowSettings = {
  heightInU: number;
  category: string;
  physicalHeightInches: number;
  deviceWidthInches: number;
  deviceDepthInches: number;
  sheetPower: string;
  sheetHadHeightColumn: boolean;
  sheetHadDepthColumn: boolean;
  sheetHadWidthColumn: boolean;
};

function rowHeaderDimensionHints(row: Record<string, unknown>): {
  sheetHadHeightColumn: boolean;
  sheetHadDepthColumn: boolean;
  sheetHadWidthColumn: boolean;
} {
  let sheetHadHeightColumn = false;
  let sheetHadDepthColumn = false;
  let sheetHadWidthColumn = false;
  for (const k of Object.keys(row)) {
    const lower = k.toLowerCase();
    if (lower.includes('height')) sheetHadHeightColumn = true;
    if (lower.includes('depth')) sheetHadDepthColumn = true;
    if (lower.includes('width')) sheetHadWidthColumn = true;
  }
  return { sheetHadHeightColumn, sheetHadDepthColumn, sheetHadWidthColumn };
}

/** Integers from patterns like `3 RU`, `2RU`, `12 ru` in any cell (1–100). */
function extractRackUnitsFromRowText(row: Record<string, unknown>): number | null {
  const re = /(\d+(?:\.\d+)?)\s*RU\b/gi;
  let best: number | null = null;
  for (const v of Object.values(row)) {
    if (v == null) continue;
    const s = String(v);
    const matches = s.matchAll(re);
    for (const m of matches) {
      const n = parseFloat(m[1] ?? '');
      if (!Number.isFinite(n) || n <= 0) continue;
      const rounded = Math.max(1, Math.min(100, Math.round(n)));
      best = best == null ? rounded : Math.max(best, rounded);
    }
  }
  return best;
}

/** Category, power, width, height, depth from labeled columns only (defaults: category empty, numbers 0). */
export function parseSheetRowSettings(row: Record<string, unknown>): SheetRowSettings {
  const hints = rowHeaderDimensionHints(row);
  const category = pickString(row, ['category', 'Category']);
  const sheetPower = pickString(row, ['power', 'Power']);
  const deviceWidthInches = Math.max(
    pickNonNegativeNumber(row, [
      'width',
      'Width',
      'rackWidth',
      'RackWidth',
      'rack_width',
      'RackWidthInches',
      'deviceWidth',
      'device_width',
    ]),
    pickNonNegativeNumberLoose(row, ['rack width', 'rack-width', 'rack width inches']),
  );
  const physicalHeightInches = Math.max(
    pickNonNegativeNumber(row, [
      'height',
      'Height',
      'heightInches',
      'HeightInches',
      'height_inches',
    ]),
    pickNonNegativeNumberLoose(row, ['rack height', 'face height', 'height inches']),
  );
  const deviceDepthInches = Math.max(
    pickNonNegativeNumber(row, ['depth', 'Depth', 'deviceDepth', 'device_depth']),
    pickNonNegativeNumberLoose(row, ['rack depth', 'equipment depth']),
  );
  const heightU = pickNonNegativeNumber(row, ['heightU', 'heightu', 'HeightU', 'height_u', 'rackHeightU', 'RackHeightU']);

  const ruFromText = extractRackUnitsFromRowText(row);

  let heightInU = 1;
  if (heightU > 0) {
    heightInU = Math.max(1, Math.round(heightU));
  } else if (ruFromText != null && ruFromText > 0) {
    heightInU = ruFromText;
  } else if (physicalHeightInches > 0) {
    heightInU = ruFromInches(physicalHeightInches, DEFAULT_INCHES_PER_RU);
  }

  return {
    heightInU,
    category: category || '',
    physicalHeightInches,
    deviceWidthInches,
    deviceDepthInches,
    sheetPower,
    ...hints,
  };
}

function getNameFieldKey(fields: string[]): string | undefined {
  return fields.find((f) => f.toLowerCase() === 'name');
}

/** Combined manufacturer + model when both present (trimmed). */
function readManufacturerModelFromRow(row: Record<string, unknown>): { combined: string; mfr: string; mdl: string } | null {
  const mKeys = [
    'manufacturer',
    'Manufacturer',
    'deviceManufacturer',
    'mfr',
    'make',
    'Make',
    'brand',
    'Brand',
    'oem',
    'OEM',
    'vendor',
    'Vendor',
  ];
  const modelKeys = [
    'model',
    'Model',
    'modelNumber',
    'model_number',
    'deviceModel',
    'device_model',
    'partNumber',
    'part_number',
    'Part Number',
    'part number',
    'sku',
    'SKU',
  ];
  let manufacturer = '';
  let model = '';
  for (const k of mKeys) {
    const v = pickValue(row, [k]);
    if (v != null && String(v).trim()) {
      manufacturer = String(v).trim();
      break;
    }
  }
  for (const k of modelKeys) {
    const v = pickValue(row, [k]);
    if (v != null && String(v).trim()) {
      model = String(v).trim();
      break;
    }
  }
  if (!manufacturer || !model) return null;
  const combined = `${manufacturer} ${model}`.trim();
  if (shouldSkipCellValue(combined)) return null;
  return { combined, mfr: manufacturer, mdl: model };
}

function isLikelyMetadataColumnKey(key: string): boolean {
  const l = key.trim().toLowerCase().replace(/\s+/g, ' ');
  if (l === 'name' || l === 'id' || l === 'uuid') return true;
  const tokens = [
    'category',
    'type',
    'power',
    'sku',
    'qty',
    'quantity',
    'price',
    'cost',
    'notes',
    'note',
    'comment',
    'description',
    'location',
    'date',
    'status',
    'serial',
    'part',
    'line',
    'item',
    'row',
    'column',
    'total',
    'sum',
    'weight',
    'voltage',
    'amp',
    'position',
    'slot',
  ];
  for (const t of tokens) {
    if (l === t || l.startsWith(`${t} `) || l.endsWith(` ${t}`) || l.includes(` ${t} `)) return true;
  }
  if (l.includes('height') || l.includes('depth') || l.includes('width')) return true;
  return false;
}

/**
 * When there is no `name` / mfr+model identity, scan other cells: catalog match (exact/fuzzy),
 * else manufacturer-style parse, else longest text that looks like a label.
 */
function inferIdentityFromRow(
  row: Record<string, unknown>,
  pool: Device[],
  exactLookup: Map<string, Device>,
): { text: string; manufacturer?: string; model?: string } | null {
  const candidates: string[] = [];
  const seen = new Set<string>();
  for (const [k, v] of Object.entries(row)) {
    if (isLikelyMetadataColumnKey(k)) continue;
    if (v == null) continue;
    const raw = String(v).replace(/\r\n/g, '\n').split('\n')[0]!.trim();
    if (!raw || shouldSkipCellValue(raw)) continue;
    const lk = raw.toLowerCase();
    if (seen.has(lk)) continue;
    seen.add(lk);
    candidates.push(raw);
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);

  for (const t of candidates) {
    const hit = resolvePartsNameToCatalogDevice(t, pool, exactLookup);
    if (hit) {
      const d = hit.device;
      return {
        text: getDeviceDisplayName({ name: d.name, manufacturer: d.manufacturer, model: d.model }),
        manufacturer: d.manufacturer?.trim() || undefined,
        model: d.model?.trim() || undefined,
      };
    }
  }

  const longest = candidates[0]!;
  const inf = inferManufacturerModelFromLegacyName(longest);
  const label = getDeviceDisplayName({ name: '', manufacturer: inf.manufacturer, model: inf.model }).trim();
  if (label.length >= 3) {
    return {
      text: label,
      manufacturer: inf.manufacturer.trim() || undefined,
      model: inf.model.trim() || undefined,
    };
  }
  if (longest.length >= 4 && /[a-zA-Z]/.test(longest)) {
    return { text: longest };
  }
  return null;
}

/** Excel / Sheets sometimes emit a BOM on the first header — breaks "Manufacturer" key matching. */
function sanitizeCsvRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const clean = k.replace(/^\uFEFF/, '').trim();
    out[clean] = v;
  }
  return out;
}

/**
 * One candidate per data row: label from manufacturer+model, else `name`, else inferred from other cells.
 */
export function extractCandidatesFromObjectRows(
  rows: Record<string, unknown>[],
  fields: string[],
  pool: Device[],
): CsvCellCandidate[] {
  const nameKey = getNameFieldKey(fields);
  const exactLookup = buildDeviceExactLookup(pool);
  const out: CsvCellCandidate[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const clean = sanitizeCsvRowKeys(row as Record<string, unknown>);
    const meta = parseSheetRowSettings(clean);

    const mfrModel = readManufacturerModelFromRow(clean);
    if (mfrModel) {
      out.push({
        text: mfrModel.combined,
        heightInU: meta.heightInU,
        category: meta.category,
        physicalHeightInches: meta.physicalHeightInches,
        fromNameColumn: true,
        manufacturer: mfrModel.mfr,
        model: mfrModel.mdl,
        deviceWidthInches: meta.deviceWidthInches,
        deviceDepthInches: meta.deviceDepthInches,
        sheetPower: meta.sheetPower,
        sheetHadHeightColumn: meta.sheetHadHeightColumn,
        sheetHadDepthColumn: meta.sheetHadDepthColumn,
        sheetHadWidthColumn: meta.sheetHadWidthColumn,
      });
      continue;
    }

    if (nameKey) {
      const nameVal = pickString(clean, [nameKey]);
      if (nameVal && !shouldSkipCellValue(nameVal)) {
        out.push({
          text: nameVal,
          heightInU: meta.heightInU,
          category: meta.category,
          physicalHeightInches: meta.physicalHeightInches,
          fromNameColumn: true,
          deviceWidthInches: meta.deviceWidthInches,
          deviceDepthInches: meta.deviceDepthInches,
          sheetPower: meta.sheetPower,
          sheetHadHeightColumn: meta.sheetHadHeightColumn,
          sheetHadDepthColumn: meta.sheetHadDepthColumn,
          sheetHadWidthColumn: meta.sheetHadWidthColumn,
        });
        continue;
      }
    }

    const inferred = inferIdentityFromRow(clean, pool, exactLookup);
    if (inferred) {
      out.push({
        text: inferred.text,
        heightInU: meta.heightInU,
        category: meta.category,
        physicalHeightInches: meta.physicalHeightInches,
        fromNameColumn: true,
        manufacturer: inferred.manufacturer,
        model: inferred.model,
        deviceWidthInches: meta.deviceWidthInches,
        deviceDepthInches: meta.deviceDepthInches,
        sheetPower: meta.sheetPower,
        sheetHadHeightColumn: meta.sheetHadHeightColumn,
        sheetHadDepthColumn: meta.sheetHadDepthColumn,
        sheetHadWidthColumn: meta.sheetHadWidthColumn,
      });
    }
  }

  return out;
}

/** Headerless matrix: first column per row is the device label (row 0 = header row skipped in caller). */
export function extractCandidatesFromMatrix(rows: unknown[][]): CsvCellCandidate[] {
  const out: CsvCellCandidate[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;
    const v0 = row[0];
    if (v0 == null) continue;
    const str = String(v0).trim();
    if (r === 0 && str.toLowerCase() === 'name') continue;
    if (shouldSkipCellValue(str)) continue;
    out.push({
      text: str,
      heightInU: 1,
      category: '',
      physicalHeightInches: 0,
      fromNameColumn: true,
      deviceWidthInches: 0,
      deviceDepthInches: 0,
      sheetPower: '',
      sheetHadHeightColumn: false,
      sheetHadDepthColumn: false,
      sheetHadWidthColumn: false,
    });
  }

  return out;
}

/** Dedupe by label (case-insensitive); merge numeric settings (max where meaningful). */
export function dedupeCandidates(candidates: CsvCellCandidate[]): CsvCellCandidate[] {
  const map = new Map<string, CsvCellCandidate>();

  for (const c of candidates) {
    const key = c.text.toLowerCase();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...c });
      continue;
    }
    const preferNew =
      (c.fromNameColumn && !prev.fromNameColumn) ||
      (c.fromNameColumn === prev.fromNameColumn && c.heightInU > prev.heightInU);
    if (preferNew) {
      map.set(key, {
        ...c,
        heightInU: Math.max(c.heightInU, prev.heightInU),
        physicalHeightInches: Math.max(c.physicalHeightInches, prev.physicalHeightInches),
        deviceWidthInches: Math.max(c.deviceWidthInches, prev.deviceWidthInches),
        deviceDepthInches: Math.max(c.deviceDepthInches, prev.deviceDepthInches),
        sheetPower: c.sheetPower || prev.sheetPower,
        manufacturer: c.manufacturer ?? prev.manufacturer,
        model: c.model ?? prev.model,
        category: (c.category || prev.category || '').trim(),
        sheetHadHeightColumn: prev.sheetHadHeightColumn || c.sheetHadHeightColumn,
        sheetHadDepthColumn: prev.sheetHadDepthColumn || c.sheetHadDepthColumn,
        sheetHadWidthColumn: prev.sheetHadWidthColumn || c.sheetHadWidthColumn,
      });
    } else {
      map.set(key, {
        ...prev,
        heightInU: Math.max(c.heightInU, prev.heightInU),
        physicalHeightInches: Math.max(c.physicalHeightInches, prev.physicalHeightInches),
        deviceWidthInches: Math.max(c.deviceWidthInches, prev.deviceWidthInches),
        deviceDepthInches: Math.max(c.deviceDepthInches, prev.deviceDepthInches),
        sheetPower: c.sheetPower || prev.sheetPower,
        manufacturer: prev.manufacturer ?? c.manufacturer,
        model: prev.model ?? c.model,
        category: (c.category || prev.category || '').trim(),
        sheetHadHeightColumn: prev.sheetHadHeightColumn || c.sheetHadHeightColumn,
        sheetHadDepthColumn: prev.sheetHadDepthColumn || c.sheetHadDepthColumn,
        sheetHadWidthColumn: prev.sheetHadWidthColumn || c.sheetHadWidthColumn,
      });
    }
  }

  return [...map.values()];
}

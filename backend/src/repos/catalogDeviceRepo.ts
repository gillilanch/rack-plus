import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { parseCsv } from '../utils/parseCsv';
import { mapSheetCategoryToAppCategory } from '../utils/foxCatalogCategory';
import { parseInsOutsCells, type ParsedCatalogPort } from '../utils/avcadSheetPorts';
import { catalogPortsFromJson } from '../utils/catalogPortJson';

const INCHES_PER_U = 1.75;
const MAX_U = 60;

export type CatalogDeviceRow = {
  manufacturer: string;
  model: string;
  sheetCategory: string;
  appCategory: string;
  power: string | null;
  widthInches: number | null;
  heightInches: number | null;
  depthInches: number | null;
  notes: string | null;
  heightInU: number;
  ports: ParsedCatalogPort[];
};

function normalizePart(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function catalogNormalizedKey(manufacturer: string, model: string): string {
  return `${normalizePart(manufacturer)}::${normalizePart(model)}`;
}

function parseNumber(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function heightInUFromInches(heightInches: number | null): number {
  if (heightInches == null || !Number.isFinite(heightInches) || heightInches <= 0) {
    return 1;
  }
  const u = Math.ceil(heightInches / INCHES_PER_U);
  return Math.min(MAX_U, Math.max(1, u));
}

function cellToString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return String(v);
}

type FoxCatalogColIdx = {
  manufacturer: number;
  model: number;
  category: number;
  power: number;
  width: number;
  height: number;
  depth: number;
  notes: number;
  ins: number;
  outs: number;
};

function firstHeaderIndex(header: string[], candidates: string[]): number {
  for (const c of candidates) {
    const i = header.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

function resolveFoxCatalogColumns(headerLower: string[]): FoxCatalogColIdx {
  const idx = (name: string) => headerLower.indexOf(name);
  const mi = idx('manufacturer');
  const moi = idx('model');
  const ci = idx('category');
  if (mi < 0 || moi < 0 || ci < 0) {
    throw new Error('CSV must include Manufacturer, Model, and Category columns');
  }
  const pi = idx('power');
  const wi = idx('width');
  const hi = idx('height');
  const di = idx('depth');
  const ni = idx('notes');
  const insI = firstHeaderIndex(headerLower, ['ins', 'in', 'inputs', 'i/o in']);
  const outsI = firstHeaderIndex(headerLower, ['outs', 'out', 'outputs', 'i/o out']);
  return {
    manufacturer: mi,
    model: moi,
    category: ci,
    power: pi,
    width: wi,
    height: hi,
    depth: di,
    notes: ni,
    ins: insI,
    outs: outsI,
  };
}

function rowStringsToCatalogDevice(row: string[], col: FoxCatalogColIdx): CatalogDeviceRow | null {
  const manufacturer = (row[col.manufacturer] ?? '').trim();
  const model = (row[col.model] ?? '').trim();
  if (!manufacturer && !model) return null;
  if (!manufacturer || !model) return null;

  const sheetCategory = (row[col.category] ?? '').trim() || 'Other';
  const appCategory = mapSheetCategoryToAppCategory(sheetCategory);
  const power = col.power >= 0 ? (row[col.power] ?? '').trim() || null : null;
  const widthInches = col.width >= 0 ? parseNumber(row[col.width] ?? '') : null;
  const heightInches = col.height >= 0 ? parseNumber(row[col.height] ?? '') : null;
  const depthInches = col.depth >= 0 ? parseNumber(row[col.depth] ?? '') : null;
  const notes = col.notes >= 0 ? (row[col.notes] ?? '').trim() || null : null;
  const insCell = col.ins >= 0 ? (row[col.ins] ?? '').trim() : '';
  const outsCell = col.outs >= 0 ? (row[col.outs] ?? '').trim() : '';
  const ports = parseInsOutsCells(insCell, outsCell);
  const heightInU = heightInUFromInches(heightInches);

  return {
    manufacturer,
    model,
    sheetCategory,
    appCategory,
    power,
    widthInches,
    heightInches,
    depthInches,
    notes,
    heightInU,
    ports,
  };
}

/** Parse consolidated equipment list from a header + data grid (CSV row shape). */
export function parseFoxCatalogGrid(gridRaw: unknown[][]): CatalogDeviceRow[] {
  const grid = gridRaw.map((row) => (Array.isArray(row) ? row.map(cellToString) : []));
  if (!grid.length) return [];
  const maxCols = Math.max(...grid.map((r) => r.length), 0);
  for (const row of grid) {
    while (row.length < maxCols) row.push('');
  }
  const header = grid[0]!.map((h) => h.trim().toLowerCase());
  const col = resolveFoxCatalogColumns(header);

  const out: CatalogDeviceRow[] = [];
  for (let r = 1; r < grid.length; r++) {
    const row = grid[r]!;
    const parsed = rowStringsToCatalogDevice(row, col);
    if (parsed) out.push(parsed);
  }
  return out;
}

function parseNumberish(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') return parseNumber(v);
  return null;
}

/** Apps Script / JSON webhook: one object per sheet row (flexible keys). */
export function catalogDeviceRowsFromStructured(
  rows: Array<Record<string, unknown>>,
): CatalogDeviceRow[] {
  const out: CatalogDeviceRow[] = [];
  for (const raw of rows) {
    const m = new Map<string, unknown>();
    for (const [k, v] of Object.entries(raw)) {
      m.set(String(k).trim().toLowerCase(), v);
    }
    const g = (keys: string[]): unknown => {
      for (const k of keys) {
        if (m.has(k)) return m.get(k);
      }
      return undefined;
    };
    const manufacturer = String(g(['manufacturer']) ?? '').trim();
    const model = String(g(['model']) ?? '').trim();
    if (!manufacturer || !model) continue;
    const sheetCategory = String(g(['category', 'sheetcategory']) ?? '').trim() || 'Other';
    const appCategory = mapSheetCategoryToAppCategory(sheetCategory);
    const powerRaw = g(['power']);
    const power =
      powerRaw == null || powerRaw === ''
        ? null
        : String(powerRaw).trim() || null;
    const widthInches = parseNumberish(g(['width', 'widthinches']));
    const heightInches = parseNumberish(g(['height', 'heightinches', 'physicalheight']));
    const depthInches = parseNumberish(g(['depth', 'depthinches']));
    const notesRaw = g(['notes']);
    const notes =
      notesRaw == null || notesRaw === ''
        ? null
        : String(notesRaw).trim() || null;
    const insCell = String(g(['ins', 'in', 'inputs']) ?? '').trim();
    const outsCell = String(g(['outs', 'out', 'outputs']) ?? '').trim();
    const ports = parseInsOutsCells(insCell, outsCell);
    const heightInU = heightInUFromInches(heightInches);
    out.push({
      manufacturer,
      model,
      sheetCategory,
      appCategory,
      power,
      widthInches,
      heightInches,
      depthInches,
      notes,
      heightInU,
      ports,
    });
  }
  return out;
}

/** Parse consolidated equipment list CSV (header row required). */
export function parseFoxCatalogCsv(text: string): CatalogDeviceRow[] {
  const grid = parseCsv(text);
  return parseFoxCatalogGrid(grid);
}

export type SyncResult = {
  upserted: number;
  pruned: number;
  /** Rows from the sheet/grid that were parsed (including duplicates; same mfr+model upserts multiple times, last wins). */
  sheetRowsParsed: number;
};

export async function upsertCatalogRows(rows: CatalogDeviceRow[], pruneMissing: boolean): Promise<SyncResult> {
  const keySet = new Set(rows.map((r) => catalogNormalizedKey(r.manufacturer, r.model)));
  let upserted = 0;
  const now = new Date();

  /** Never prune from an empty parse — would delete the entire catalog. */
  const del =
    pruneMissing && rows.length > 0 && keySet.size > 0
      ? await prisma.catalogDevice.deleteMany({
          where: { normalizedKey: { notIn: [...keySet] } },
        })
      : { count: 0 };

  for (const row of rows) {
    const normalizedKey = catalogNormalizedKey(row.manufacturer, row.model);
    await prisma.catalogDevice.upsert({
      where: { normalizedKey },
      create: {
        normalizedKey,
        manufacturer: row.manufacturer,
        model: row.model,
        sheetCategory: row.sheetCategory,
        appCategory: row.appCategory,
        power: row.power,
        widthInches: row.widthInches,
        heightInches: row.heightInches,
        depthInches: row.depthInches,
        notes: row.notes,
        ports: row.ports as unknown as Prisma.InputJsonValue,
        heightInU: row.heightInU,
        lastSyncedAt: now,
      },
      update: {
        manufacturer: row.manufacturer,
        model: row.model,
        sheetCategory: row.sheetCategory,
        appCategory: row.appCategory,
        power: row.power,
        widthInches: row.widthInches,
        heightInches: row.heightInches,
        depthInches: row.depthInches,
        notes: row.notes,
        ports: row.ports as unknown as Prisma.InputJsonValue,
        heightInU: row.heightInU,
        lastSyncedAt: now,
      },
    });
    upserted++;
  }

  return { upserted, pruned: del.count, sheetRowsParsed: rows.length };
}

/** Shape consumed by Rack+ UI (`Device`-compatible). */
export type CatalogDeviceClientJson = {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  category: string;
  ports: ReturnType<typeof catalogPortsFromJson>;
  heightInU: number;
  deviceWidthInches: number;
  /** Equipment face depth from sheet (inches). */
  deviceDepthInches?: number | null;
  /** Physical height in inches when present on the sheet. */
  physicalHeightInches?: number | null;
  /** Power / PSU line from sheet. */
  power?: string | null;
  /** Freeform notes from sheet. */
  notes?: string | null;
};

export async function listCatalogDevicesJson(): Promise<CatalogDeviceClientJson[]> {
  const rows = await prisma.catalogDevice.findMany({
    orderBy: [{ manufacturer: 'asc' }, { model: 'asc' }],
  });
  return rows.map((r) => {
    const name = [r.manufacturer, r.model].filter(Boolean).join(' ').trim();
    const deviceWidthInches = r.widthInches != null && Number.isFinite(r.widthInches) ? r.widthInches : 19;
    const physicalHeightInches =
      r.heightInches != null && Number.isFinite(r.heightInches) ? r.heightInches : null;
    const deviceDepthInches =
      r.depthInches != null && Number.isFinite(r.depthInches) ? r.depthInches : null;
    return {
      id: r.id,
      name,
      manufacturer: r.manufacturer,
      model: r.model,
      category: r.appCategory,
      ports: catalogPortsFromJson(r.ports),
      heightInU: r.heightInU,
      deviceWidthInches,
      deviceDepthInches,
      physicalHeightInches,
      power: r.power ?? null,
      notes: r.notes ?? null,
    };
  });
}

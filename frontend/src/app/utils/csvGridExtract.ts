/**
 * Collect human-readable text from every cell in a CSV so imports are not limited to the first column.
 */

export type CsvCellCandidate = {
  /** Display string from the sheet */
  text: string;
  heightInU: number;
  category: string;
  physicalHeightInches?: number;
  /** True when this value came from the primary "name" column for that row */
  fromNameColumn: boolean;
};

const PURE_NUMBER = /^\d+(\.\d+)?$/;

/** Skip cells that are obviously not equipment names */
export function shouldSkipCellValue(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 2) return true;
  if (PURE_NUMBER.test(t)) return true;
  return false;
}

function parseHeightFromRow(row: Record<string, unknown>): {
  heightInU: number;
  category: string;
  physicalHeightInches?: number;
} {
  let category = 'Interface';
  let heightInU = 1;
  let physicalHeightInches: number | undefined;

  const catVal = row.category ?? row.Category;
  if (typeof catVal === 'string' && catVal.trim()) {
    category = catVal.trim();
  }

  const hu = row.heightU ?? row.heightu ?? row.HeightU;
  if (hu != null && String(hu).trim() !== '') {
    const n = parseFloat(String(hu));
    if (!Number.isNaN(n)) heightInU = Math.max(1, Math.round(n));
  } else {
    const hi = row.heightInches ?? row.height_inches ?? row.HeightInches;
    if (hi != null && String(hi).trim() !== '') {
      physicalHeightInches = parseFloat(String(hi));
      if (!Number.isNaN(physicalHeightInches)) {
        heightInU = Math.max(1, Math.ceil(physicalHeightInches / 1.75));
      }
    }
  }

  return { heightInU, category, physicalHeightInches };
}

function getNameFieldKey(fields: string[]): string | undefined {
  return fields.find((f) => f.toLowerCase() === 'name');
}

/** If the row has separate manufacturer + model columns, return a single label for catalog matching. */
function readManufacturerModelFromRow(row: Record<string, unknown>): string | null {
  const mKeys = ['manufacturer', 'Manufacturer', 'deviceManufacturer', 'mfr', 'make', 'Make'];
  const modelKeys = ['model', 'Model', 'modelNumber', 'model_number', 'deviceModel', 'device_model'];
  let manufacturer = '';
  let model = '';
  for (const k of mKeys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) {
      manufacturer = v.trim();
      break;
    }
  }
  for (const k of modelKeys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) {
      model = v.trim();
      break;
    }
  }
  if (!manufacturer || !model) return null;
  const combined = `${manufacturer} ${model}`.trim();
  return shouldSkipCellValue(combined) ? null : combined;
}

/**
 * Walk every field on every row; each non-skipped string becomes a candidate.
 * Row-level height/category apply to cells in that row (name column preferred for primary label).
 */
export function extractCandidatesFromObjectRows(
  rows: Record<string, unknown>[],
  fields: string[],
): CsvCellCandidate[] {
  const nameKey = getNameFieldKey(fields);
  const out: CsvCellCandidate[] = [];

  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const meta = parseHeightFromRow(row);

    const combinedMfrModel = readManufacturerModelFromRow(row);
    if (combinedMfrModel) {
      out.push({
        text: combinedMfrModel,
        heightInU: meta.heightInU,
        category: meta.category,
        physicalHeightInches: meta.physicalHeightInches,
        fromNameColumn: true,
      });
    }

    for (const field of fields) {
      const v = row[field];
      if (v == null) continue;
      const str = String(v).trim();
      if (shouldSkipCellValue(str)) continue;

      out.push({
        text: str,
        heightInU: meta.heightInU,
        category: meta.category,
        physicalHeightInches: meta.physicalHeightInches,
        fromNameColumn: nameKey !== undefined && field === nameKey,
      });
    }
  }

  return out;
}

/** Every cell in a headerless row array (array-of-arrays). */
export function extractCandidatesFromMatrix(rows: unknown[][]): CsvCellCandidate[] {
  const out: CsvCellCandidate[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (v == null) continue;
      const str = String(v).trim();
      if (r === 0 && str.toLowerCase() === 'name') continue;
      if (shouldSkipCellValue(str)) continue;
      out.push({
        text: str,
        heightInU: 1,
        category: 'Interface',
        fromNameColumn: c === 0,
      });
    }
  }

  return out;
}

/** Stable order dedupe by lowercase text; merge metadata (prefer name-column + first row height). */
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
      (c.fromNameColumn === prev.fromNameColumn && c.heightInU > 1 && prev.heightInU === 1);
    if (preferNew) {
      map.set(key, {
        ...c,
        heightInU: Math.max(c.heightInU, prev.heightInU),
        physicalHeightInches: c.physicalHeightInches ?? prev.physicalHeightInches,
      });
    }
  }

  return [...map.values()];
}

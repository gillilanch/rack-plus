import type { Device } from '../data/equipment';
import type { CsvCellCandidate } from './csvGridExtract';
import { resolveImportCategory } from './deviceCatalogSearch';

export type CatalogDimensionMerge = {
  heightInU: number;
  physicalHeightInches: number | undefined;
  deviceWidthInches: number | undefined;
  deviceDepthInches: number | undefined;
  sheetPower: string | undefined;
  category: string;
  deviceNotes: string | undefined;
};

/**
 * When a CSV row matches the equipment catalog, fill missing width/depth/U/height/power from the
 * catalog row (database / built-in) instead of leaving zeros or the 1U default from an empty sheet.
 */
export function mergeCsvCandidateWithCatalogDevice(
  c: CsvCellCandidate,
  catalog: Device,
  dbCategoryNames: string[],
): CatalogDimensionMerge {
  const sheetCat = c.category.trim();
  const category = sheetCat
    ? resolveImportCategory(sheetCat, dbCategoryNames)
    : catalog.category?.trim() || 'Other';

  const sp = c.sheetPower.trim();
  const sheetPower = sp || catalog.sheetPower?.trim() || undefined;

  let heightInU = Math.max(1, c.heightInU);
  if (c.physicalHeightInches <= 0) {
    const looksLikeOnlyDefaultU = c.heightInU === 1 && !c.sheetHadHeightColumn;
    if (looksLikeOnlyDefaultU && catalog.heightInU != null && catalog.heightInU >= 1) {
      heightInU = catalog.heightInU;
    }
  }

  const physicalHeightInches =
    c.physicalHeightInches > 0
      ? c.physicalHeightInches
      : catalog.physicalHeightInches != null && catalog.physicalHeightInches > 0
        ? catalog.physicalHeightInches
        : undefined;

  const deviceWidthInches =
    c.deviceWidthInches > 0
      ? c.deviceWidthInches
      : catalog.deviceWidthInches != null && catalog.deviceWidthInches > 0
        ? catalog.deviceWidthInches
        : undefined;

  const deviceDepthInches =
    c.deviceDepthInches > 0
      ? c.deviceDepthInches
      : catalog.deviceDepthInches != null && catalog.deviceDepthInches > 0
        ? catalog.deviceDepthInches
        : undefined;

  const deviceNotes = catalog.notes?.trim() || undefined;

  return {
    heightInU,
    physicalHeightInches,
    deviceWidthInches,
    deviceDepthInches,
    sheetPower,
    category,
    deviceNotes,
  };
}

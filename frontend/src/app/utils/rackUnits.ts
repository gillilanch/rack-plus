/** Standard EIA-310 rack unit height (inches). */
export const DEFAULT_INCHES_PER_RU = 1.75;

/** Typical equipment / front-panel width (19" rack gear). */
export const DEFAULT_RACK_WIDTH_INCHES = 19;

/**
 * Pixel width for the rack face so width:height matches rackWidthInches : (totalHeight × inchesPerRU).
 */
export function rackFaceWidthPx(args: {
  rackHeightPx: number;
  totalHeight: number;
  inchesPerRU: number;
  rackWidthInches: number;
  /** When set, never exceed this width (e.g. parent container). */
  maxWidthPx?: number;
}): number {
  const { rackHeightPx, totalHeight, inchesPerRU, rackWidthInches, maxWidthPx } = args;
  const faceHeightInches = Math.max(totalHeight * inchesPerRU, 1e-6);
  const ideal = rackHeightPx * (rackWidthInches / faceHeightInches);
  const w = Math.max(120, ideal);
  return maxWidthPx !== undefined ? Math.min(w, maxWidthPx) : w;
}

export function inchesFromRU(ru: number, inchesPerRU: number): number {
  return Math.round(Math.max(1, ru) * inchesPerRU * 100) / 100;
}

/** Minimum whole rack units that fit the given physical height. */
export function ruFromInches(inches: number, inchesPerRU: number): number {
  if (!Number.isFinite(inches) || inches <= 0 || !Number.isFinite(inchesPerRU) || inchesPerRU <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(inches / inchesPerRU));
}

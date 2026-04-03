/** Standard EIA-310 rack unit height (inches). */
export const DEFAULT_INCHES_PER_RU = 1.75;

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

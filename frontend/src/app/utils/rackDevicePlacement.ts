import type { RackDevice } from '../types/rack';
import { DEFAULT_RACK_WIDTH_INCHES } from './rackUnits';

/** Short summary for docs / fallback copy. */
export const SIDE_BY_SIDE_PLACEMENT_SUMMARY =
  'On the same rack U, combined device widths cannot exceed the rack width, and horizontal positions must not overlap.';

/** Default front-panel width for rack gear (inches). */
export const DEFAULT_DEVICE_WIDTH_INCHES = 19;

export function getDeviceWidthInches(d: Pick<RackDevice, 'deviceWidthInches'>): number {
  const w = d.deviceWidthInches;
  if (w != null && Number.isFinite(w) && w > 0) return Math.min(w, 120);
  return DEFAULT_DEVICE_WIDTH_INCHES;
}

export function getHorizontalOffsetInches(d: Pick<RackDevice, 'horizontalOffsetInches'>): number {
  const x = d.horizontalOffsetInches;
  if (x != null && Number.isFinite(x)) return Math.max(0, x);
  return 0;
}

export function clampDeviceWidthToRack(widthInches: number, rackWidthInches: number): number {
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  const w = Number.isFinite(widthInches) && widthInches > 0 ? widthInches : DEFAULT_DEVICE_WIDTH_INCHES;
  return Math.min(Math.max(w, 0.25), rw);
}

export function clampHorizontalOffset(offsetInches: number, deviceWidthInches: number, rackWidthInches: number): number {
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  const w = Math.min(deviceWidthInches, rw);
  const maxOff = Math.max(0, rw - w);
  if (!Number.isFinite(offsetInches)) return 0;
  return Math.min(Math.max(offsetInches, 0), maxOff);
}

/** Free-typed width field: blank → default 19". */
export function parseDeviceWidthInchesInput(raw: string, rackWidthInches: number): number {
  const t = raw.trim().replace(/,/g, '.');
  if (t === '') return DEFAULT_DEVICE_WIDTH_INCHES;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return DEFAULT_DEVICE_WIDTH_INCHES;
  return clampDeviceWidthToRack(n, rackWidthInches);
}

/** Free-typed offset field: blank → 0. */
export function parseHorizontalOffsetInchesInput(
  raw: string,
  deviceWidthInches: number,
  rackWidthInches: number,
): number {
  const t = raw.trim().replace(/,/g, '.');
  if (t === '') return 0;
  const n = parseFloat(t);
  if (!Number.isFinite(n)) return 0;
  return clampHorizontalOffset(n, deviceWidthInches, rackWidthInches);
}

/** Apply sane width/offset for a device given rack width. */
export function normalizeDeviceHorizontalFields(device: RackDevice, rackWidthInches: number): RackDevice {
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  const w = clampDeviceWidthToRack(getDeviceWidthInches(device), rw);
  const off = clampHorizontalOffset(getHorizontalOffsetInches(device), w, rw);
  return {
    ...device,
    deviceWidthInches: w,
    horizontalOffsetInches: off,
  };
}

function horizontalSpansOverlapInches(
  left1: number,
  w1: number,
  left2: number,
  w2: number,
): boolean {
  const r1 = left1 + w1;
  const r2 = left2 + w2;
  return left1 < r2 && left2 < r1;
}

/** All devices (normalized) that occupy rack unit index `u` (bottom-based: u = rackPosition .. rackPosition+height-1). */
function devicesOccupyingU(u: number, rowDevices: RackDevice[], rw: number): RackDevice[] {
  return rowDevices
    .filter((d) => d.rackPosition !== undefined)
    .map((d) => normalizeDeviceHorizontalFields(d, rw))
    .filter((d) => {
      const b = d.rackPosition!;
      return u >= b && u < b + d.heightInU;
    });
}

/**
 * Validate `candidate` once placed: for every rack U it occupies, every other placed device on that U
 * must not overlap horizontally, and the **sum of device widths** on that U must be ≤ rack width.
 */
export function validateSideBySidePlacement(
  candidate: RackDevice,
  otherPlacedDevices: RackDevice[],
  rackWidthInches: number,
): { ok: true } | { ok: false; message: string } {
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  if (candidate.rackPosition === undefined) return { ok: true };

  const c = normalizeDeviceHorizontalFields(candidate, rw);
  const cPos = c.rackPosition!;
  const cH = c.heightInU;

  const othersNorm = otherPlacedDevices
    .filter((o) => o.rackPosition !== undefined && o.id !== c.id)
    .map((o) => normalizeDeviceHorizontalFields(o, rw));

  const poolForSlice = [c, ...othersNorm];

  for (let u = cPos; u < cPos + cH; u++) {
    const row = devicesOccupyingU(u, poolForSlice, rw);
    let sumW = 0;
    for (const d of row) {
      sumW += getDeviceWidthInches(d);
    }
    if (sumW > rw + 1e-6) {
      return {
        ok: false,
        message: `Combined width on the same rack U is ${sumW.toFixed(2)}" but this rack is only ${rw}" wide. Narrow devices (edit → device width) or move one to another row.`,
      };
    }
    for (let i = 0; i < row.length; i++) {
      for (let j = i + 1; j < row.length; j++) {
        const a = row[i];
        const b = row[j];
        const aL = getHorizontalOffsetInches(a);
        const aW = getDeviceWidthInches(a);
        const bL = getHorizontalOffsetInches(b);
        const bW = getDeviceWidthInches(b);
        if (horizontalSpansOverlapInches(aL, aW, bL, bW)) {
          return {
            ok: false,
            message: `Devices overlap horizontally on the same U. Fit them within ${rw}" total: change width and/or left offset so boxes do not overlap.`,
          };
        }
      }
    }
  }
  return { ok: true };
}

export function validateAllPlacedDevices(
  devices: RackDevice[],
  rackWidthInches: number,
): { ok: true } | { ok: false; message: string } {
  const placed = devices.filter((d) => d.rackPosition !== undefined);
  for (const d of placed) {
    const others = placed.filter((x) => x.id !== d.id);
    const v = validateSideBySidePlacement(d, others, rackWidthInches);
    if (!v.ok) return v;
  }
  return { ok: true };
}

export function horizontalOffsetInchesFromDropX(args: {
  clientX: number;
  rackLeft: number;
  rackWidthPx: number;
  rackWidthInches: number;
  deviceWidthInches: number;
}): number {
  const { clientX, rackLeft, rackWidthPx, rackWidthInches, deviceWidthInches } = args;
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  const w = clampDeviceWidthToRack(deviceWidthInches, rw);
  const xRel = clientX - rackLeft;
  const frac = rackWidthPx > 0 ? xRel / rackWidthPx : 0;
  const cursorInches = frac * rw;
  const off = cursorInches - w / 2;
  return clampHorizontalOffset(off, w, rw);
}

export function deviceFaceHorizontalSpanPx(
  device: RackDevice,
  rackWidthPx: number,
  rackWidthInches: number,
): { leftPx: number; widthPx: number } {
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  const d = normalizeDeviceHorizontalFields(device, rw);
  const wIn = getDeviceWidthInches(d);
  const offIn = getHorizontalOffsetInches(d);
  const widthPx = (wIn / rw) * rackWidthPx;
  const leftPx = (offIn / rw) * rackWidthPx;
  return { leftPx, widthPx };
}

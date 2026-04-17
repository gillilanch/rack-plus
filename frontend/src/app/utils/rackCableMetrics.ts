import type { RackDevice } from '../types/rack';
import { DEFAULT_RACK_WIDTH_INCHES } from './rackUnits';
import { getDeviceWidthInches, getHorizontalOffsetInches } from './rackDevicePlacement';

/** Treat as straight vertical when horizontal separation (in.) is negligible. */
const STRAIGHT_HORIZONTAL_EPS_INCHES = 0.08;

/** Stored and displayed cable lengths (inches) use this precision. */
export const CABLE_INCH_DISPLAY_DECIMALS = 2;

export function roundCableLengthInches(value: number): number {
  const p = 10 ** CABLE_INCH_DISPLAY_DECIMALS;
  return Math.round((Number.isFinite(value) ? value : 0) * p) / p;
}

/** Format inches for UI (e.g. cable labels `>12.25"`). */
export function formatCableLengthInches(value: number): string {
  return roundCableLengthInches(value).toFixed(CABLE_INCH_DISPLAY_DECIMALS);
}

function verticalCenterU(d: RackDevice): number {
  return d.rackPosition! + d.heightInU / 2;
}

/**
 * Vertical span along the rack face between two anchor Y positions (rack SVG coords, top = 0).
 * Each diagram row is one U tall; multiply by `inchesPerRU` (standard 1.75 in).
 */
export function verticalCableInchesBetweenAnchorYs(
  y1: number,
  y2: number,
  unitHeightPx: number,
  inchesPerRU: number,
): number {
  if (unitHeightPx <= 0) return 0;
  const deltaU = Math.abs(y1 - y2) / unitHeightPx;
  return deltaU * inchesPerRU;
}

/**
 * Horizontal span along the rack front between two anchor X positions (same coords as SVG width).
 */
export function horizontalCableInchesBetweenAnchorXs(
  x1: number,
  x2: number,
  rackWidthPx: number,
  rackWidthInches: number,
): number {
  if (rackWidthPx <= 0) return 0;
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  return (Math.abs(x1 - x2) / rackWidthPx) * rw;
}

/**
 * Straight-line distance along the rack face for a cable between two anchors.
 * Same column (no horizontal run): vertical inches only (each U × inchesPerRU).
 * Otherwise: √(horizontal² + vertical²) with horizontal in inches along the 19" face.
 */
export function cableRunInchesBetweenAnchors(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  unitHeightPx: number,
  inchesPerRU: number,
  rackWidthPx: number,
  rackWidthInches: number,
): number {
  const v = verticalCableInchesBetweenAnchorYs(y1, y2, unitHeightPx, inchesPerRU);
  const h = horizontalCableInchesBetweenAnchorXs(x1, x2, rackWidthPx, rackWidthInches);
  if (h <= STRAIGHT_HORIZONTAL_EPS_INCHES) return v;
  return Math.hypot(h, v);
}

/**
 * Cable run for a vertical-first L: straight along the source column to the destination row,
 * then across the face (horizontal at y2 + spreadY). No detour through mid-rack height.
 * `spreadY` fans bundled cables (px offset on the horizontal run).
 */
export function cableRunInchesOrthogonalAnchors(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  spreadY: number,
  unitHeightPx: number,
  inchesPerRU: number,
  rackWidthPx: number,
  rackWidthInches: number,
): number {
  const yH = y2 + spreadY;
  const v1 = verticalCableInchesBetweenAnchorYs(y1, yH, unitHeightPx, inchesPerRU);
  const h = horizontalCableInchesBetweenAnchorXs(x1, x2, rackWidthPx, rackWidthInches);
  const v2 = verticalCableInchesBetweenAnchorYs(yH, y2, unitHeightPx, inchesPerRU);
  return roundCableLengthInches(v1 + h + v2);
}

/**
 * Geometric minimum between two placed devices (no pixel path): vertical from U centers × inchesPerRU,
 * horizontal from front-panel midpoint to midpoint along the rack width; then straight vs diagonal.
 */
export function minCableInchesBetweenPlacedDevices(
  a: RackDevice,
  b: RackDevice,
  inchesPerRU: number,
  slackFeet: number,
  rackWidthInches: number = DEFAULT_RACK_WIDTH_INCHES,
): number {
  const rw = rackWidthInches > 0 ? rackWidthInches : DEFAULT_RACK_WIDTH_INCHES;
  const du = Math.abs(verticalCenterU(a) - verticalCenterU(b));
  const verticalInches = du * inchesPerRU;

  const wA = getDeviceWidthInches(a);
  const wB = getDeviceWidthInches(b);
  const oA = getHorizontalOffsetInches(a);
  const oB = getHorizontalOffsetInches(b);
  const midA = oA + wA / 2;
  const midB = oB + wB / 2;
  const horizontalInches = Math.abs(midA - midB);

  const run =
    horizontalInches <= STRAIGHT_HORIZONTAL_EPS_INCHES
      ? verticalInches
      : Math.hypot(horizontalInches, verticalInches);
  const slackInches = slackFeet * 12;
  return roundCableLengthInches(run + slackInches);
}

/**
 * Minimum cable length from anchor pixels + global slack (for labels and saved minCableLengthInches).
 */
export function cableRunInchesFromPixelAnchors(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  unitHeightPx: number,
  inchesPerRU: number,
  slackFeet: number,
  extraSlackInches = 0,
  rackWidthPx: number,
  rackWidthInches: number,
): number {
  const run = cableRunInchesBetweenAnchors(
    x1,
    y1,
    x2,
    y2,
    unitHeightPx,
    inchesPerRU,
    rackWidthPx,
    rackWidthInches,
  );
  return roundCableLengthInches(run + slackFeet * 12 + extraSlackInches);
}

/** Geometric face run only (no rack slack), for port-mismatch hints — orthogonal path, same rounding as stored lengths. */
export function dragCableRunDisplayInches(args: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  unitHeightPx: number;
  inchesPerRU: number;
  rackWidthPx: number;
  rackWidthInches: number;
}): number {
  const { x1, y1, x2, y2, unitHeightPx, inchesPerRU, rackWidthPx, rackWidthInches } = args;
  if (unitHeightPx <= 0) return 0;
  const inches = cableRunInchesOrthogonalAnchors(
    x1,
    y1,
    x2,
    y2,
    0,
    unitHeightPx,
    inchesPerRU,
    rackWidthPx,
    rackWidthInches,
  );
  return roundCableLengthInches(inches);
}

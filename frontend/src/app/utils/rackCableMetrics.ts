import type { RackDevice } from '../types/rack';

function verticalCenterU(d: RackDevice): number {
  return d.rackPosition! + d.heightInU / 2;
}

/** Legacy estimate for exports / saved payloads. UI uses {@link cableRunInchesFromPixelAnchors}. */
export function minCableInchesBetweenPlacedDevices(
  a: RackDevice,
  b: RackDevice,
  inchesPerRU: number,
  slackFeet: number,
): number {
  const du = Math.abs(verticalCenterU(a) - verticalCenterU(b));
  const verticalInches = du * inchesPerRU;
  const slackInches = slackFeet * 12;
  const h = 24;
  return Math.ceil(Math.sqrt(verticalInches ** 2 + h ** 2) + slackInches);
}

/**
 * Inches along the drawn cable from device anchor to device anchor (pixel path × RU scale) + slack.
 * When either device moves vertically, y anchors change and this value grows or shrinks.
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
): number {
  if (unitHeightPx <= 0) return Math.ceil(slackFeet * 12 + extraSlackInches);
  const px = Math.hypot(x2 - x1, y2 - y1);
  const inchesPerPixel = inchesPerRU / unitHeightPx;
  return Math.ceil(px * inchesPerPixel + slackFeet * 12 + extraSlackInches);
}

/** Pixel length in rack coordinates → equivalent vertical inches (for live drag readout). */
export function dragLengthToDisplayInches(
  pixelLength: number,
  unitHeightPx: number,
  inchesPerRU: number,
): number {
  if (unitHeightPx <= 0) return 0;
  const ru = pixelLength / unitHeightPx;
  return Math.round(ru * inchesPerRU * 10) / 10;
}

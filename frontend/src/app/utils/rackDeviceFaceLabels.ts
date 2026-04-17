import type { RackDevice } from '../types/rack';
import {
  getDeviceDisplayName,
  getDeviceIdentityTwoLines,
  inferManufacturerModelFromLegacyName,
} from './deviceDisplay';
import { getDeviceWidthInches, normalizeDeviceHorizontalFields } from './rackDevicePlacement';

/** Matches RackVisualizer name column: below this width, compact / side labels apply. */
export const NARROW_DEVICE_NAME_COL_PX = 220;
/** Half-rack / narrow gear — always treat as tight horizontal space. */
export const NARROW_DEVICE_FACE_INCHES = 6.5;
/** Grip + icon column + padding (approx.) subtracted from face width to estimate name column. */
const NAME_COLUMN_GUTTER_PX = 88;

/**
 * When true, manufacturer is drawn vertically on the device edge (RackCableOverlay) so the face
 * can show model or short name without cramming the full identity into a narrow strip.
 */
export function shouldShowManufacturerOnDeviceSide(
  device: RackDevice,
  faceWidthPx: number,
  rackWidthInches: number,
): boolean {
  const placed = normalizeDeviceHorizontalFields(device, rackWidthInches);
  const deviceWidthInches = getDeviceWidthInches(placed);
  if (deviceWidthInches < NARROW_DEVICE_FACE_INCHES) return true;
  const nameColApprox = faceWidthPx - NAME_COLUMN_GUTTER_PX;
  return nameColApprox < NARROW_DEVICE_NAME_COL_PX;
}

/** Best-effort manufacturer string for vertical edge label (same logic as compact rack face). */
export function getDeviceManufacturerSideLabel(device: RackDevice): string {
  const displayName = getDeviceDisplayName(device);
  const identityTwo = getDeviceIdentityTwoLines(device);
  const fromField = (device.manufacturer ?? '').trim();
  if (fromField) return fromField;
  if (identityTwo?.manufacturer) return identityTwo.manufacturer;
  const inf = inferManufacturerModelFromLegacyName(device.name);
  if (inf.manufacturer) return inf.manufacturer;
  const dn = displayName.trim();
  const sp = dn.indexOf(' ');
  if (sp > 0) return dn.slice(0, sp);
  return dn;
}

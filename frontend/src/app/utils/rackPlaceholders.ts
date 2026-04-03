/**
 * Device names stripped when loading a rack from the API (demo / mistaken imports).
 * Matching is by letters+digits only so "Sony px-W-400", "Sony PXW-X400", etc. all match.
 * Remove or edit this list if you legitimately rack these models.
 */
function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Normalized forms (alphanumeric only) of names to drop on hydrate. */
const PLACEHOLDER_NAME_KEYS = new Set([
  'sonypxw400', // Sony px-W-400, Sony PXW-400, Sony pxw 400, …
  'sonypxwx400', // Sony PXW-X400, Sony pxw-x400, …
  'sonypxww400', // Sony PXW-W-400, …
]);

export function filterPlaceholderRackDevices<T extends { name: string }>(devices: T[]): T[] {
  return devices.filter((d) => !PLACEHOLDER_NAME_KEYS.has(normalizeNameKey(d.name)));
}

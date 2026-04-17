/**
 * Manufacturer + model identity for devices (catalog + rack rows).
 * Display name stays backward-compatible; search uses all tokens.
 */

/** Longest first so e.g. "Sound Devices" wins over "Sound". */
const KNOWN_MANUFACTURER_PREFIXES = [
  'Blackmagic',
  'Sound Devices',
  'Flanders Scientific',
  'Allen & Heath',
  'MacBook Pro',
  'MacBook Air',
  'MacBook',
  'Yamaha',
  'Sennheiser',
  'Panasonic',
  'Focusrite',
  'Atomos',
  'Behringer',
  'Roland',
  'Tascam',
  'Presonus',
  'PreSonus',
  'Sony',
  'Canon',
  'Shure',
  'Zoom',
  'Dell',
  'LG',
  'Apple',
  'Red',
  'ARRI',
  'GoPro',
  'Teradek',
  'AJA',
  'NVIDIA',
  'Intel',
].sort((a, b) => b.length - a.length);

export function inferManufacturerModelFromLegacyName(fullName: string): { manufacturer: string; model: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { manufacturer: '', model: '' };

  const lower = trimmed.toLowerCase();
  for (const brand of KNOWN_MANUFACTURER_PREFIXES) {
    const bl = brand.toLowerCase();
    if (lower === bl) return { manufacturer: brand, model: '' };
    if (lower.startsWith(bl + ' ')) {
      return { manufacturer: brand, model: trimmed.slice(brand.length).trim() };
    }
  }

  const space = trimmed.indexOf(' ');
  if (space <= 0) return { manufacturer: trimmed, model: '' };
  return {
    manufacturer: trimmed.slice(0, space).trim(),
    model: trimmed.slice(space + 1).trim(),
  };
}

export function getDeviceDisplayName(d: { name: string; manufacturer?: string; model?: string }): string {
  const m = (d.manufacturer ?? '').trim();
  const md = (d.model ?? '').trim();
  if (m && md) return `${m} ${md}`.trim();
  if (!m && md) return md;
  if (m && !md) return m;
  return (d.name ?? '').trim();
}

/** When both parts exist (or inferred from legacy `name`), show manufacturer + model on two lines in the rack. */
export function getDeviceIdentityTwoLines(d: {
  name: string;
  manufacturer?: string;
  model?: string;
}): { manufacturer: string; model: string } | null {
  let m = (d.manufacturer ?? '').trim();
  let md = (d.model ?? '').trim();
  if (!m && !md && (d.name ?? '').trim()) {
    const inf = inferManufacturerModelFromLegacyName(d.name);
    m = inf.manufacturer;
    md = inf.model;
  }
  if (m && md) return { manufacturer: m, model: md };
  return null;
}

/** Lowercase string used for autocomplete / fuzzy match (includes parts separately so "Yamaha" hits all Yamaha rows). */
export function getDeviceSearchBlob(d: { name: string; manufacturer?: string; model?: string }): string {
  const parts = [
    d.name,
    d.manufacturer,
    d.model,
    `${(d.manufacturer ?? '').trim()} ${(d.model ?? '').trim()}`.trim(),
  ].filter((x) => x && String(x).trim());
  return parts.join(' ').toLowerCase();
}

export function normalizeRackDeviceIdentity<T extends { name: string; manufacturer?: string; model?: string }>(
  d: T,
): T {
  let manufacturer = (d.manufacturer ?? '').trim();
  let model = (d.model ?? '').trim();
  if (!manufacturer && !model && d.name.trim()) {
    const inf = inferManufacturerModelFromLegacyName(d.name);
    manufacturer = inf.manufacturer;
    model = inf.model;
  }
  const name = getDeviceDisplayName({ name: d.name, manufacturer, model });
  return { ...d, manufacturer, model, name };
}

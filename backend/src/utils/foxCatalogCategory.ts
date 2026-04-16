/** Map AVCAD sheet category strings to Rack+ device categories (same buckets as frontend). */
export type AppDeviceCategory =
  | 'Camera'
  | 'Laptop'
  | 'Recording Deck'
  | 'Audio'
  | 'Monitor'
  | 'Interface';

const EXACT: Record<string, AppDeviceCategory> = {
  Camera: 'Camera',
  Laptop: 'Laptop',
  Audio: 'Audio',
  Monitor: 'Monitor',
  Interface: 'Interface',
  'Recording Deck': 'Recording Deck',
  Recording: 'Recording Deck',
};

export function mapSheetCategoryToAppCategory(sheet: string): AppDeviceCategory {
  const t = sheet.trim();
  if (EXACT[t]) return EXACT[t]!;
  const lower = t.toLowerCase();
  if (lower.includes('camera')) return 'Camera';
  if (lower.includes('laptop') || lower.includes('computer')) return 'Laptop';
  if (
    lower.includes('audio') ||
    lower.includes('mic') ||
    lower.includes('speaker') ||
    lower.includes('mixer') ||
    lower.includes('amp')
  ) {
    return 'Audio';
  }
  if (lower.includes('monitor') || lower.includes('display')) return 'Monitor';
  if (lower.includes('deck') || lower.includes('recorder') || lower.includes('recording')) {
    return 'Recording Deck';
  }
  return 'Interface';
}

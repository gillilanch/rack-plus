import type { Prisma } from '@prisma/client';

/** Rack+ UI / Zod port `type` values (matches frontend `ConnectorType`). */
const CONNECTOR_TYPES = new Set([
  'HDMI',
  'SDI',
  'XLR',
  'USB-C',
  'USB-A',
  'Thunderbolt',
  '3.5mm',
  '1/4 TRS',
  'RCA',
  'DisplayPort',
  'Mini DisplayPort',
  'DVI',
  'VGA',
  'Ethernet',
  'BNC',
  'TS',
]);

export type CatalogPortClient = {
  type: string;
  direction: 'input' | 'output' | 'both';
  label?: string;
  count?: number;
};

function isDirection(s: string): s is 'input' | 'output' | 'both' {
  return s === 'input' || s === 'output' || s === 'both';
}

/** Normalize DB/catalog JSON port entries for API responses. */
export function catalogPortsFromJson(value: Prisma.JsonValue | null | undefined): CatalogPortClient[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  const out: CatalogPortClient[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const o = raw as Record<string, unknown>;
    const typeRaw = typeof o.type === 'string' ? o.type.trim() : '';
    const type = CONNECTOR_TYPES.has(typeRaw) ? typeRaw : 'TS';
    const dirRaw = typeof o.direction === 'string' ? o.direction.trim() : '';
    const direction = isDirection(dirRaw) ? dirRaw : 'both';
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : undefined;
    let count: number | undefined;
    if (typeof o.count === 'number' && Number.isFinite(o.count) && o.count > 1) {
      count = Math.floor(o.count);
    }
    out.push({ type, direction, label, count });
  }
  return out;
}

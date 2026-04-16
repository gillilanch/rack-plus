import type { Device, Port } from '../data/equipment';
import { apiUrl } from '../api/apiUrl';

let cached: Device[] = [];
let inflight: Promise<void> | undefined;

const CONNECTOR_TYPES = new Set<string>([
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

function sanitizeCatalogPorts(raw: unknown[]): Port[] {
  const out: Port[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const o = p as Record<string, unknown>;
    const typeRaw = typeof o.type === 'string' ? o.type.trim() : '';
    const type = (CONNECTOR_TYPES.has(typeRaw) ? typeRaw : 'TS') as Port['type'];
    const d = o.direction;
    const direction =
      d === 'input' || d === 'output' || d === 'both' ? d : ('both' as Port['direction']);
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : undefined;
    let count: number | undefined;
    if (typeof o.count === 'number' && Number.isFinite(o.count) && o.count > 1) {
      count = Math.floor(o.count);
    }
    out.push({ type, direction, label, count });
  }
  return out;
}

function normalizeRow(row: Record<string, unknown>): Device | null {
  if (typeof row.id !== 'string' || typeof row.name !== 'string') return null;
  const category = typeof row.category === 'string' ? row.category : 'Other';
  const ports = Array.isArray(row.ports) ? sanitizeCatalogPorts(row.ports as unknown[]) : [];
  return {
    id: row.id,
    name: row.name,
    manufacturer: typeof row.manufacturer === 'string' ? row.manufacturer : undefined,
    model: typeof row.model === 'string' ? row.model : undefined,
    category,
    ports,
    heightInU: typeof row.heightInU === 'number' ? row.heightInU : undefined,
    deviceWidthInches:
      typeof row.deviceWidthInches === 'number' ? row.deviceWidthInches : undefined,
    deviceDepthInches:
      typeof row.deviceDepthInches === 'number' ? row.deviceDepthInches : undefined,
    physicalHeightInches:
      typeof row.physicalHeightInches === 'number' ? row.physicalHeightInches : undefined,
    sheetPower: typeof row.power === 'string' && row.power.trim() ? row.power : undefined,
    notes: typeof row.notes === 'string' && row.notes.trim() ? row.notes : undefined,
  };
}

export function getServerCatalogDevices(): Device[] {
  return cached;
}

/** Load AVCAD / Fox sheet catalog from Postgres (via backend). Safe to call repeatedly. */
export async function prefetchServerCatalogDevices(): Promise<void> {
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const r = await fetch(apiUrl('/api/catalog/devices'));
      if (!r.ok) return;
      const raw = (await r.json()) as unknown;
      if (!Array.isArray(raw)) return;
      const next: Device[] = [];
      for (const item of raw) {
        if (item && typeof item === 'object') {
          const d = normalizeRow(item as Record<string, unknown>);
          if (d) next.push(d);
        }
      }
      cached = next;
    } catch {
      /* offline or CORS */
    }
  })();
  inflight = p;
  try {
    await p;
  } finally {
    inflight = undefined;
  }
}

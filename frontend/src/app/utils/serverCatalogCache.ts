import type { Device, Port } from '../data/equipment';
import { apiUrl } from '../api/apiUrl';

/** Fired after a successful refresh of the Postgres-backed AVCAD catalog (same tab). */
export const FOX_SERVER_CATALOG_CHANGED_EVENT = 'rack-plus-server-catalog-changed';

let cached: Device[] = [];
let inflight: Promise<boolean> | undefined;

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
  const appCategory =
    typeof row.appCategory === 'string' && row.appCategory.trim() ? row.appCategory.trim() : undefined;
  const ports = Array.isArray(row.ports) ? sanitizeCatalogPorts(row.ports as unknown[]) : [];
  return {
    id: row.id,
    name: row.name,
    manufacturer: typeof row.manufacturer === 'string' ? row.manufacturer : undefined,
    model: typeof row.model === 'string' ? row.model : undefined,
    category,
    ...(appCategory ? { appCategory } : {}),
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

export type DeleteCatalogDeviceResult = 'ok' | 'no_secret' | 'not_configured' | 'not_found' | 'unauthorized' | 'error';

/**
 * DELETE row in Postgres when `VITE_CATALOG_WEBHOOK_SECRET` matches backend `CATALOG_WEBHOOK_SECRET`.
 * On success, updates in-memory cache and dispatches {@link FOX_SERVER_CATALOG_CHANGED_EVENT}.
 */
export async function deleteCatalogDeviceOnServer(deviceId: string): Promise<DeleteCatalogDeviceResult> {
  const secret = (import.meta.env.VITE_CATALOG_WEBHOOK_SECRET as string | undefined)?.trim();
  if (!secret) return 'no_secret';
  try {
    const r = await fetch(apiUrl(`/api/catalog/devices/${encodeURIComponent(deviceId)}`), {
      method: 'DELETE',
      headers: { 'X-Catalog-Webhook-Secret': secret },
    });
    if (r.status === 503) return 'not_configured';
    if (r.status === 401) return 'unauthorized';
    if (r.status === 404) return 'not_found';
    if (!r.ok) return 'error';
    cached = cached.filter((d) => d.id !== deviceId);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(FOX_SERVER_CATALOG_CHANGED_EVENT));
    }
    return 'ok';
  } catch {
    return 'error';
  }
}

/**
 * Load AVCAD / Fox sheet catalog from Postgres (via backend). Safe to call repeatedly.
 * @returns true if the HTTP response was OK and the body parsed as an array (may be empty).
 */
export async function prefetchServerCatalogDevices(): Promise<boolean> {
  if (inflight) return inflight;
  const p = (async (): Promise<boolean> => {
    try {
      const r = await fetch(apiUrl('/api/catalog/devices'));
      if (!r.ok) return false;
      const raw = (await r.json()) as unknown;
      if (!Array.isArray(raw)) return false;
      const next: Device[] = [];
      for (const item of raw) {
        if (item && typeof item === 'object') {
          const d = normalizeRow(item as Record<string, unknown>);
          if (d) next.push(d);
        }
      }
      cached = next;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(FOX_SERVER_CATALOG_CHANGED_EVENT));
      }
      return true;
    } catch {
      return false;
    }
  })();
  inflight = p;
  try {
    return await p;
  } finally {
    inflight = undefined;
  }
}

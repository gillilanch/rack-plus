import type { RackConfiguration } from '../types/rack';
import { normalizeRackDeviceIdentity } from '../utils/deviceDisplay';
import { apiUrl } from './apiUrl';

const pathRacks = '/api/racks';

function normalizeConfigDevices(config: RackConfiguration): RackConfiguration {
  return {
    ...config,
    devices: config.devices.map((d) => normalizeRackDeviceIdentity({ ...d }) as RackConfiguration['devices'][0]),
  };
}

export type RackSummary = {
  id: string;
  name: string;
  totalHeight: number;
  rackWidthInches: number;
  /** Present after API / DB support rack depth; older responses may omit. */
  rackDepthInches?: number;
  deviceCount: number;
  updatedAt: string;
  savedByDisplayName?: string | null;
  savedByVerified?: boolean;
};

/** Sent with create/update; server resolves verification vs Guest. */
export type RackSaveAttribution = {
  saveAsGuest: boolean;
  savedByNameRaw: string;
};

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const msg = body.error || res.statusText;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function listRacks(): Promise<RackSummary[]> {
  const res = await fetch(apiUrl(pathRacks));
  return handleJson(res);
}

export async function getRack(id: string): Promise<RackConfiguration> {
  const res = await fetch(apiUrl(`${pathRacks}/${encodeURIComponent(id)}`));
  return handleJson(res);
}

export async function createRack(
  body: Omit<RackConfiguration, 'id' | 'savedByDisplayName' | 'savedByVerified'>,
  attribution: RackSaveAttribution,
): Promise<RackConfiguration> {
  const normalized = normalizeConfigDevices(body as RackConfiguration);
  const res = await fetch(apiUrl(pathRacks), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...normalized,
      saveAsGuest: attribution.saveAsGuest,
      savedByNameRaw: attribution.savedByNameRaw || null,
    }),
  });
  return handleJson(res);
}

export async function saveRack(
  config: RackConfiguration,
  attribution: RackSaveAttribution,
): Promise<RackConfiguration> {
  const normalized = normalizeConfigDevices(config);
  const res = await fetch(apiUrl(`${pathRacks}/${encodeURIComponent(config.id)}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: normalized.name,
      totalHeight: normalized.totalHeight,
      inchesPerRU: normalized.inchesPerRU,
      rackWidthInches: normalized.rackWidthInches,
      rackDepthInches: normalized.rackDepthInches,
      slackAllowance: normalized.slackAllowance,
      devices: normalized.devices,
      connections: normalized.connections,
      saveAsGuest: attribution.saveAsGuest,
      savedByNameRaw: attribution.savedByNameRaw || null,
    }),
  });
  return handleJson(res);
}

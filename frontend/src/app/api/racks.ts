import type { RackConfiguration } from '../types/rack';
import { normalizeRackDeviceIdentity } from '../utils/deviceDisplay';

const BASE = '/api/racks';

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
  const res = await fetch(BASE);
  return handleJson(res);
}

export async function getRack(id: string): Promise<RackConfiguration> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`);
  return handleJson(res);
}

export async function createRack(
  body: Omit<RackConfiguration, 'id' | 'savedByDisplayName' | 'savedByVerified'>,
  attribution: RackSaveAttribution,
): Promise<RackConfiguration> {
  const normalized = normalizeConfigDevices(body as RackConfiguration);
  const res = await fetch(BASE, {
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
  const res = await fetch(`${BASE}/${encodeURIComponent(config.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: normalized.name,
      totalHeight: normalized.totalHeight,
      inchesPerRU: normalized.inchesPerRU,
      rackWidthInches: normalized.rackWidthInches,
      slackAllowance: normalized.slackAllowance,
      devices: normalized.devices,
      connections: normalized.connections,
      saveAsGuest: attribution.saveAsGuest,
      savedByNameRaw: attribution.savedByNameRaw || null,
    }),
  });
  return handleJson(res);
}

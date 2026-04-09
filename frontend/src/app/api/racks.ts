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
  updatedAt: string;
};

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || res.statusText);
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
  body: Omit<RackConfiguration, 'id'>,
): Promise<RackConfiguration> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(normalizeConfigDevices(body as RackConfiguration)),
  });
  return handleJson(res);
}

export async function saveRack(config: RackConfiguration): Promise<RackConfiguration> {
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
    }),
  });
  return handleJson(res);
}

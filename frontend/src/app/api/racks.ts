import type { RackConfiguration } from '../types/rack';

const BASE = '/api/racks';

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
    body: JSON.stringify(body),
  });
  return handleJson(res);
}

export async function saveRack(config: RackConfiguration): Promise<RackConfiguration> {
  const res = await fetch(`${BASE}/${encodeURIComponent(config.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: config.name,
      totalHeight: config.totalHeight,
      inchesPerRU: config.inchesPerRU,
      rackWidthInches: config.rackWidthInches,
      slackAllowance: config.slackAllowance,
      devices: config.devices,
      connections: config.connections,
    }),
  });
  return handleJson(res);
}

import type { Device } from '../data/equipment';
import type { RackDevice } from '../types/rack';
import { getDeviceDisplayName } from './deviceDisplay';

const CATEGORY_MAP: Record<string, string> = {
  Camera: 'Camera',
  Laptop: 'Laptop',
  'Recording Deck': 'Recording Deck',
  Recording: 'Recording Deck',
  Audio: 'Audio',
  Monitor: 'Monitor',
  Interface: 'Interface',
  Network: 'Interface',
  Power: 'Interface',
  Other: 'Interface',
};

/** Map rack rows (CSV/manual categories) to cable-finder device categories. */
export function normalizeRackDeviceForCableFinder(device: RackDevice): Device {
  const cat = String(device.category);
  const category = (CATEGORY_MAP[cat] ?? 'Interface') as Device['category'];
  const display = getDeviceDisplayName(device);
  return {
    id: device.id,
    name: display,
    manufacturer: device.manufacturer,
    model: device.model,
    category,
    ports: device.ports ?? [],
  };
}

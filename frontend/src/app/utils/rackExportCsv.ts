import Papa from 'papaparse';
import type { RackConnection, RackDevice } from '../types/rack';
import { getDeviceDisplayName } from './deviceDisplay';

export function buildRackPartsExportCsv(devices: RackDevice[], connections: RackConnection[]): string {
  const placed = devices.filter((d) => d.rackPosition !== undefined);
  if (placed.length === 0) {
    return 'manufacturer,model,name,category,heightU,rackPositionU,heightInches,connections\n';
  }
  const rows = placed.map((d) => {
    const conns = connections.filter((c) => c.fromDeviceId === d.id || c.toDeviceId === d.id);
    const parts = conns.map((c) => {
      const otherId = c.fromDeviceId === d.id ? c.toDeviceId : c.fromDeviceId;
      const other = devices.find((x) => x.id === otherId);
      const label = other ? getDeviceDisplayName(other) : otherId;
      const fromP = c.fromPort.type + (c.fromPort.label ? ` (${c.fromPort.label})` : '');
      const toP = c.toPort.type + (c.toPort.label ? ` (${c.toPort.label})` : '');
      return `${label}: ${fromP}→${toP}`;
    });
    return {
      manufacturer: (d.manufacturer ?? '').trim(),
      model: (d.model ?? '').trim(),
      name: getDeviceDisplayName(d),
      category: d.category,
      heightU: d.heightInU,
      rackPositionU: d.rackPosition ?? '',
      heightInches: d.physicalHeightInches ?? '',
      connections: parts.join(' | '),
    };
  });
  return Papa.unparse(rows);
}

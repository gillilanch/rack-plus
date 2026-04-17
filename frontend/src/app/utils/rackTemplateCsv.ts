import Papa from 'papaparse';
import type { Device, Port } from '../data/equipment';
import { getDeviceDisplayName } from './deviceDisplay';
import type { RackConnection, RackDevice } from '../types/rack';

/** Columns for “Download template” export of the current rack. */
export const RACK_TEMPLATE_HEADERS = [
  'Rack position',
  'Manufacturer',
  'Model',
  'Category',
  'Power',
  'Width',
  'Height',
  'Depth',
  'Ins',
  'Outs',
  'Notes',
] as const;

const EMPTY_ROW: string[] = ['', '', '', '', '', '', '', '', '', '', ''];

function formatPortForCsv(p: Port): string {
  const lab = p.label?.trim();
  return lab ? `${p.type} (${lab})` : p.type;
}

/**
 * Ins: connections into this device (toPort). Outs: connections out (fromPort).
 * Each entry: `PortConnection_CableName` (cable = connection’s cable type label).
 */
function collectInsOutsFromCables(deviceId: string, connections: RackConnection[]): { ins: string; outs: string } {
  const ins: string[] = [];
  const outs: string[] = [];
  for (const c of connections) {
    const cable = (c.cableType ?? '').trim() || 'Cable';
    if (c.fromDeviceId === deviceId) {
      outs.push(`${formatPortForCsv(c.fromPort)}_${cable}`);
    }
    if (c.toDeviceId === deviceId) {
      ins.push(`${formatPortForCsv(c.toPort)}_${cable}`);
    }
  }
  return { ins: ins.join('; '), outs: outs.join('; ') };
}

/** Catalog / offline: list ports by direction (no cable graph). */
function portListInsOuts(ports: Port[] | undefined): { ins: string; outs: string } {
  const ins: string[] = [];
  const outs: string[] = [];
  for (const p of ports ?? []) {
    const s = formatPortForCsv(p);
    if (p.direction === 'input' || p.direction === 'both') ins.push(s);
    if (p.direction === 'output' || p.direction === 'both') outs.push(s);
  }
  return { ins: ins.join('; '), outs: outs.join('; ') };
}

/** When there are no cables (typical for unassigned gear), list catalog ports by direction. */
function collectInsOutsFromPortList(device: RackDevice): { ins: string; outs: string } {
  return portListInsOuts(device.ports);
}

/** Prefer cable runs; fill missing sides from device port definitions (fixes unassigned + offline gear). */
function collectInsOuts(device: RackDevice, connections: RackConnection[]): { ins: string; outs: string } {
  const fromCables = collectInsOutsFromCables(device.id, connections);
  const fromPorts = collectInsOutsFromPortList(device);
  return {
    ins: fromCables.ins || fromPorts.ins,
    outs: fromCables.outs || fromPorts.outs,
  };
}

function deviceToRow(device: RackDevice, connections: RackConnection[]): string[] {
  const rackPos =
    device.rackPosition != null && Number.isFinite(device.rackPosition) ? `${device.rackPosition} RU` : '';
  const mfr = device.manufacturer ?? '';
  const model = device.model ?? '';
  const category = device.category ?? '';
  const power = device.sheetPower ?? '';
  const width =
    device.deviceWidthInches != null && Number.isFinite(device.deviceWidthInches)
      ? String(device.deviceWidthInches)
      : '';
  let height = '';
  if (device.physicalHeightInches != null && Number.isFinite(device.physicalHeightInches)) {
    height = String(device.physicalHeightInches);
  } else {
    height = `${device.heightInU}U`;
  }
  const depth =
    device.deviceDepthInches != null && Number.isFinite(device.deviceDepthInches)
      ? String(device.deviceDepthInches)
      : '';
  const { ins, outs } = collectInsOuts(device, connections);
  const notes = device.deviceNotes ?? '';
  return [rackPos, mfr, model, category, power, width, height, depth, ins, outs, notes];
}

export function buildRackDevicesTemplateCsv(ctx: {
  rackName?: string;
  totalHeightU: number;
  rackWidthInches: number;
  rackDepthInches: number;
  placedDevices: RackDevice[];
  unassignedDevices: RackDevice[];
  connections: RackConnection[];
}): string {
  const { placedDevices, unassignedDevices, connections } = ctx;
  const placed = [...placedDevices].sort(
    (a, b) => (a.rackPosition ?? 0) - (b.rackPosition ?? 0),
  );
  const rows: string[][] = [];
  for (const d of placed) {
    rows.push(deviceToRow(d, connections));
  }
  if (unassignedDevices.length > 0) {
    if (placed.length > 0) {
      rows.push([...EMPTY_ROW]);
    }
    rows.push(['Unassigned devices', '', '', '', '', '', '', '', '', '', '']);
    for (const d of unassignedDevices) {
      rows.push(deviceToRow(d, connections));
    }
  }

  const tableCsv = Papa.unparse({ fields: [...RACK_TEMPLATE_HEADERS], data: rows });

  const dimText = `${ctx.totalHeightU} U x ${ctx.rackWidthInches} in x ${ctx.rackDepthInches} in`;
  const preambleRows: string[][] = [
    ['Rack dimensions (H x W x D)', dimText],
  ];
  const nameTrim = ctx.rackName?.trim();
  if (nameTrim) {
    preambleRows.unshift(['Rack name', nameTrim]);
  }
  const preambleCsv = Papa.unparse(preambleRows);

  return `${preambleCsv}\n\n${tableCsv}`;
}

/** One CSV row for a catalog `Device` (equipment DB — no rack position or cables). */
function catalogDeviceToCsvRow(device: Device): string[] {
  const rackPos = '';
  const mfr = device.manufacturer ?? '';
  const model = device.model ?? '';
  const category = device.category ?? '';
  const power = device.sheetPower ?? '';
  const width =
    device.deviceWidthInches != null && Number.isFinite(device.deviceWidthInches)
      ? String(device.deviceWidthInches)
      : '';
  let height = '';
  if (device.physicalHeightInches != null && Number.isFinite(device.physicalHeightInches)) {
    height = String(device.physicalHeightInches);
  } else if (device.heightInU != null && device.heightInU >= 1) {
    height = `${device.heightInU}U`;
  } else {
    height = '1U';
  }
  const depth =
    device.deviceDepthInches != null && Number.isFinite(device.deviceDepthInches)
      ? String(device.deviceDepthInches)
      : '';
  const { ins, outs } = portListInsOuts(device.ports);
  const notes = device.notes ?? '';
  return [rackPos, mfr, model, category, power, width, height, depth, ins, outs, notes];
}

/**
 * Full equipment database export: same columns as the rack template download
 * (`Rack position` … `Notes`), with rack position blank and Ins/Outs from port definitions.
 */
export function buildEquipmentDatabaseCsv(devices: Device[]): string {
  const sorted = [...devices].sort((a, b) =>
    getDeviceDisplayName(a).localeCompare(getDeviceDisplayName(b), undefined, { sensitivity: 'base' }),
  );
  const rows = sorted.map(catalogDeviceToCsvRow);
  const tableCsv = Papa.unparse({ fields: [...RACK_TEMPLATE_HEADERS], data: rows });
  const preambleCsv = Papa.unparse([
    ['Source', 'Equipment database'],
    ['Device count', String(sorted.length)],
  ]);
  return `${preambleCsv}\n\n${tableCsv}`;
}

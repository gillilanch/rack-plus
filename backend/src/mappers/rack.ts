import type { DevicePort, Rack, RackDevice } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { CreateRackBody, UpdateRackBody } from '../types/rackApi';

export type RackWithDevices = Rack & {
  devices: (RackDevice & { ports: DevicePort[] })[];
};

function parseConnections(value: Prisma.JsonValue): unknown[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value;
  return [];
}

/** Alphanumeric key; matches Sony px-W-400, PXW-X400, etc. (kept in sync with frontend rackPlaceholders). */
function isPlaceholderRackDeviceName(name: string): boolean {
  const key = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    key === 'sonypxw400' ||
    key === 'sonypxwx400' ||
    key === 'sonypxww400'
  );
}

export function toRackConfiguration(rack: RackWithDevices) {
  const connections = parseConnections(rack.connections);
  const devicesSorted = rack.devices
    .filter((d) => !isPlaceholderRackDeviceName(d.name))
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: rack.id,
    name: rack.name,
    savedByDisplayName: rack.savedByDisplayName ?? undefined,
    savedByVerified: rack.savedByVerified,
    totalHeight: rack.totalHeightU,
    inchesPerRU: rack.inchesPerRU,
    rackWidthInches: rack.rackWidthInches,
    rackDepthInches: rack.rackDepthInches,
    slackAllowance: rack.slackAllowance,
    connections,
    devices: devicesSorted.map((d) => ({
      id: d.id,
      name: d.name,
      manufacturer: d.manufacturer,
      model: d.deviceModel,
      category: d.category,
      heightInU: d.heightInU,
      rackPosition: d.rackPosition ?? undefined,
      physicalHeightInches: d.physicalHeightInches ? Number(d.physicalHeightInches) : undefined,
      deviceWidthInches: d.deviceWidthInches,
      deviceDepthInches: d.deviceDepthInches != null ? Number(d.deviceDepthInches) : undefined,
      sheetPower: d.sheetPower ?? undefined,
      deviceNotes: d.deviceNotes ?? undefined,
      horizontalOffsetInches: d.horizontalOffsetInches,
      ports: d.ports
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((p) => ({
          type: p.connectorType,
          direction: p.direction as 'input' | 'output' | 'both',
          label: p.label ?? undefined,
          count: p.portCount > 1 ? p.portCount : undefined,
        })),
    })),
  };
}


function catalogIdFromDeviceId(deviceId: string): string | null {
  if (deviceId.startsWith('manual-')) return null;
  return deviceId;
}

export type NestedRackDeviceCreate = {
  name: string;
  manufacturer: string;
  deviceModel: string;
  category: string;
  heightInU: number;
  rackPosition: number | null;
  physicalHeightInches: number | null;
  deviceWidthInches: number;
  deviceDepthInches: number | null;
  sheetPower: string | null;
  horizontalOffsetInches: number;
  catalogDeviceId: string | null;
  sortOrder: number;
  ports: { create: Prisma.DevicePortCreateWithoutRackDeviceInput[] };
};

export function buildNestedDevices(
  devices: CreateRackBody['devices'] | UpdateRackBody['devices'],
): NestedRackDeviceCreate[] {
  return devices.map((dev, index) => {
    const manufacturer = (dev.manufacturer ?? '').trim();
    const deviceModel = (dev.model ?? '').trim();
    const name =
      (dev.name ?? '').trim() ||
      [manufacturer, deviceModel].filter(Boolean).join(' ').trim();
    return {
    name,
    manufacturer,
    deviceModel,
    category: dev.category,
    heightInU: dev.heightInU,
    rackPosition: dev.rackPosition ?? null,
    physicalHeightInches:
      dev.physicalHeightInches !== undefined ? dev.physicalHeightInches : null,
    deviceWidthInches:
      dev.deviceWidthInches !== undefined && dev.deviceWidthInches !== null
        ? dev.deviceWidthInches
        : 19,
    deviceDepthInches:
      dev.deviceDepthInches !== undefined && dev.deviceDepthInches !== null
        ? dev.deviceDepthInches
        : null,
    sheetPower: dev.sheetPower?.trim() ? dev.sheetPower.trim() : null,
    deviceNotes: dev.deviceNotes?.trim() ? dev.deviceNotes.trim() : null,
    horizontalOffsetInches: dev.horizontalOffsetInches ?? 0,
    catalogDeviceId: catalogIdFromDeviceId(dev.id),
    sortOrder: index,
    ports: {
      create: dev.ports.map((p, pi) => ({
        connectorType: p.type,
        direction: p.direction,
        label: p.label ?? null,
        portCount: p.count && p.count > 0 ? p.count : 1,
        sortOrder: pi,
      })),
    },
  };
  });
}

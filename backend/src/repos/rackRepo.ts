import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { resolveAttribution } from '../data/foxEmployees';
import { buildNestedDevices, toRackConfiguration, type RackWithDevices } from '../mappers/rack';
import type { CreateRackBody, UpdateRackBody } from '../types/rackApi';

function attributionFromBody(body: CreateRackBody | UpdateRackBody) {
  return resolveAttribution({
    saveAsGuest: body.saveAsGuest ?? false,
    savedByNameRaw: body.savedByNameRaw,
  });
}

export async function findRackNameConflict(name: string, excludeId?: string) {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const rows = await prisma.rack.findMany({
    where: excludeId ? { NOT: { id: excludeId } } : undefined,
    select: { id: true, name: true },
  });
  return rows.find((r) => r.name.trim().toLowerCase() === key) ?? null;
}

const rackInclude = {
  devices: {
    include: { ports: true },
  },
} as const;

export async function listRacks() {
  return prisma.rack.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      totalHeightU: true,
      rackWidthInches: true,
      updatedAt: true,
      savedByDisplayName: true,
      savedByVerified: true,
      _count: { select: { devices: true } },
    },
  });
}

export async function getRackById(id: string) {
  const rack = await prisma.rack.findUnique({
    where: { id },
    include: rackInclude,
  });
  if (!rack) return null;
  return toRackConfiguration(rack as RackWithDevices);
}

export async function createRack(body: CreateRackBody) {
  const nested = buildNestedDevices(body.devices);
  const attr = attributionFromBody(body);
  const rack = await prisma.rack.create({
    data: {
      name: body.name.trim(),
      savedByDisplayName: attr.displayName,
      savedByVerified: attr.verified,
      totalHeightU: body.totalHeight,
      inchesPerRU: body.inchesPerRU,
      rackWidthInches: body.rackWidthInches,
      slackAllowance: body.slackAllowance,
      connections: body.connections as unknown as Prisma.InputJsonValue,
      devices: {
        create: nested,
      },
    },
    include: rackInclude,
  });
  return toRackConfiguration(rack as RackWithDevices);
}

export async function deleteRackById(id: string): Promise<boolean> {
  try {
    await prisma.rack.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function deleteAllRacks(): Promise<{ count: number }> {
  const result = await prisma.rack.deleteMany({});
  return { count: result.count };
}

export async function upsertRackFull(id: string, body: UpdateRackBody) {
  const attr = attributionFromBody(body);
  await prisma.$transaction(async (tx) => {
    await tx.rack.update({
      where: { id },
      data: {
        name: body.name.trim(),
        savedByDisplayName: attr.displayName,
        savedByVerified: attr.verified,
        totalHeightU: body.totalHeight,
        inchesPerRU: body.inchesPerRU,
        rackWidthInches: body.rackWidthInches,
        slackAllowance: body.slackAllowance,
        connections: body.connections as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.rackDevice.deleteMany({ where: { rackId: id } });
    const nested = buildNestedDevices(body.devices);
    for (const data of nested) {
      await tx.rackDevice.create({
        data: {
          rackId: id,
          ...data,
        },
      });
    }
  });
  const rack = await prisma.rack.findUniqueOrThrow({
    where: { id },
    include: rackInclude,
  });
  return toRackConfiguration(rack as RackWithDevices);
}

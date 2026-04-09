import type { Prisma } from '@prisma/client';
import { prisma } from '../db/client';
import { buildNestedDevices, toRackConfiguration, type RackWithDevices } from '../mappers/rack';
import type { CreateRackBody, UpdateRackBody } from '../types/rackApi';

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
      updatedAt: true,
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
  const rack = await prisma.rack.create({
    data: {
      name: body.name,
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
  await prisma.$transaction(async (tx) => {
    await tx.rack.update({
      where: { id },
      data: {
        name: body.name,
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

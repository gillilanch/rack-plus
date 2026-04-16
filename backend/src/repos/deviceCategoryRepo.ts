import { prisma } from '../db/client';

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function listDeviceCategoriesOrdered() {
  return prisma.deviceCategory.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
}

export async function upsertDeviceCategoryByName(rawName: string) {
  const name = rawName.trim();
  if (!name) throw new Error('Category name is required');
  const normalizedKey = normalizeKey(name);
  return prisma.deviceCategory.upsert({
    where: { normalizedKey },
    create: { name, normalizedKey },
    update: {},
    select: { id: true, name: true },
  });
}

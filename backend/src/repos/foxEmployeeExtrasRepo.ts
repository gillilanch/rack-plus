import { Prisma } from '@prisma/client';
import { FOX_EMPLOYEE_NAMES } from '../data/foxEmployees';
import { prisma } from '../db/client';

function normalizeKey(s: string): string {
  return s.trim().toLowerCase();
}

export async function listFoxEmployeeExtras(): Promise<string[]> {
  const rows = await prisma.foxEmployeeExtra.findMany({
    orderBy: { displayName: 'asc' },
    select: { displayName: true },
  });
  return rows.map((r) => r.displayName);
}

export async function addFoxEmployeeExtra(
  rawName: string,
): Promise<
  | { ok: true; displayName: string }
  | { ok: false; code: 'empty' | 'duplicate_directory' | 'duplicate_extra' }
> {
  const displayName = rawName.trim();
  if (!displayName) return { ok: false, code: 'empty' };
  const key = normalizeKey(displayName);
  if (FOX_EMPLOYEE_NAMES.some((n) => n.trim().toLowerCase() === key)) {
    return { ok: false, code: 'duplicate_directory' };
  }
  try {
    const row = await prisma.foxEmployeeExtra.create({
      data: { displayName, normalizedKey: key },
    });
    return { ok: true, displayName: row.displayName };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: false, code: 'duplicate_extra' };
    }
    throw e;
  }
}

export async function removeFoxEmployeeExtraByDisplayName(name: string): Promise<boolean> {
  const key = normalizeKey(name);
  if (!key) return false;
  const result = await prisma.foxEmployeeExtra.deleteMany({
    where: { normalizedKey: key },
  });
  return result.count > 0;
}

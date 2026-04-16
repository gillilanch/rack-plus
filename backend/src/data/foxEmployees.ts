import { prisma } from '../db/client';

/**
 * Fox engineering directory for “saved by” attribution and autocomplete.
 * Extend this list as needed; keep in sync with any future HR import.
 */
export const FOX_EMPLOYEE_NAMES: readonly string[] = [];

export async function resolveAttribution(input: {
  saveAsGuest: boolean;
  savedByNameRaw?: string | null;
}): Promise<{ displayName: string; verified: boolean }> {
  if (input.saveAsGuest) {
    return { displayName: 'Guest', verified: false };
  }
  const raw = (input.savedByNameRaw ?? '').trim();
  if (!raw) {
    return { displayName: 'Guest', verified: false };
  }
  const match = FOX_EMPLOYEE_NAMES.find((n) => n.toLowerCase() === raw.toLowerCase());
  if (match) {
    return { displayName: match, verified: true };
  }
  const key = raw.toLowerCase();
  const extra = await prisma.foxEmployeeExtra.findUnique({
    where: { normalizedKey: key },
    select: { displayName: true },
  });
  if (extra) {
    return { displayName: extra.displayName, verified: true };
  }
  return { displayName: raw, verified: false };
}

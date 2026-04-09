/**
 * Fox engineering directory for “saved by” attribution and autocomplete.
 * Extend this list as needed; keep in sync with any future HR import.
 */
export const FOX_EMPLOYEE_NAMES: readonly string[] = [
 
];

export function resolveAttribution(input: {
  saveAsGuest: boolean;
  savedByNameRaw?: string | null;
}): { displayName: string; verified: boolean } {
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
  return { displayName: raw, verified: false };
}

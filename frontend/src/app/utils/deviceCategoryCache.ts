import { apiUrl } from '../api/apiUrl';

type CategoryRow = { id: string; name: string };

let cachedNames: string[] = [];
let inflight: Promise<void> | undefined;

export function getDeviceCategoryNames(): string[] {
  return [...cachedNames];
}

export async function prefetchDeviceCategories(): Promise<void> {
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const r = await fetch(apiUrl('/api/device-categories'));
      if (!r.ok) return;
      const rows = (await r.json()) as CategoryRow[];
      if (!Array.isArray(rows)) return;
      cachedNames = rows.map((x) => x.name).filter((n) => n.trim().length > 0);
    } catch {
      /* offline */
    }
  })();
  inflight = p;
  try {
    await p;
  } finally {
    inflight = undefined;
  }
}

/** Register a category in Postgres (no-op if it already exists). Ignores network / server errors. */
export async function ensureDeviceCategoryInDb(name: string): Promise<void> {
  const t = name.trim();
  if (!t) return;
  try {
    const r = await fetch(apiUrl('/api/device-categories'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: t }),
    });
    if (!r.ok) return;
    await prefetchDeviceCategories();
  } catch {
    /* offline or server down — device save still proceeds */
  }
}

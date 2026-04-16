/**
 * Build an absolute URL for backend API calls.
 *
 * - Default (empty env): paths stay relative (`/api/...`). Use with Vite dev proxy
 *   (`npm run dev`) or production when Express serves the UI and API on one origin.
 * - `VITE_API_BASE_URL`: set when the UI is opened without a proxy (e.g. `vite preview`,
 *   or a static server) so requests go straight to the backend. Example: `http://127.0.0.1:4000`
 */
export function apiUrl(path: string): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined;
  const base = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : '';
  const p = path.startsWith('/') ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

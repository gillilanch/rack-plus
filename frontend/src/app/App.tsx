import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { router } from './routes';
import { prefetchDeviceCategories } from './utils/deviceCategoryCache';
import { prefetchServerCatalogDevices } from './utils/serverCatalogCache';

export default function App() {
  useEffect(() => {
    void prefetchServerCatalogDevices();
    void prefetchDeviceCategories();
  }, []);

  /** Optional: poll Postgres-backed sheet catalog while the UI is open (e.g. 5000 = every 5s; min 5000). */
  useEffect(() => {
    const raw = import.meta.env.VITE_CATALOG_POLL_MS;
    const ms = raw != null && String(raw).trim() !== '' ? Number(raw) : NaN;
    if (!Number.isFinite(ms) || ms < 5_000) return;
    const id = window.setInterval(() => {
      void prefetchServerCatalogDevices();
    }, ms);
    return () => window.clearInterval(id);
  }, []);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" richColors closeButton theme="dark" />
    </>
  );
}

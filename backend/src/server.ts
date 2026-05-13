import './loadEnv';
import { createApp } from './app';
import { env, MIN_CATALOG_SYNC_INTERVAL_MS } from './config/env';
import {
  syncCatalogFromConfiguredFile,
  syncCatalogFromConfiguredUrl,
  syncCatalogFromGoogleSheet,
} from './services/catalogSync';

const PORT = env.PORT;

function scheduleFoxCatalogSync(): void {
  const ms = env.FOX_CATALOG_SYNC_INTERVAL_MS;
  if (!Number.isFinite(ms) || ms <= 0) return;
  if (ms < MIN_CATALOG_SYNC_INTERVAL_MS) {
    console.warn(
      `[catalog] FOX_CATALOG_SYNC_INTERVAL_MS=${ms} is below minimum ${MIN_CATALOG_SYNC_INTERVAL_MS}ms; scheduled CSV/sheet sync disabled.`,
    );
    return;
  }
  const prune = env.FOX_CATALOG_PRUNE_ON_SYNC;
  const tick = async () => {
    try {
      if (env.GOOGLE_SHEETS_SPREADSHEET_ID) {
        await syncCatalogFromGoogleSheet({ pruneMissing: prune });
      } else if (env.FOX_CATALOG_CSV_URL) {
        await syncCatalogFromConfiguredUrl({ pruneMissing: prune });
      } else {
        await syncCatalogFromConfiguredFile({ pruneMissing: prune });
      }
    } catch (e) {
      console.error('[catalog] scheduled sync failed', e);
    }
  };
  void tick();
  setInterval(() => void tick(), ms);
}

if (env.FOX_CATALOG_SYNC_ON_STARTUP) {
  void (async () => {
    try {
      const prune = env.FOX_CATALOG_PRUNE_ON_SYNC;
      if (env.GOOGLE_SHEETS_SPREADSHEET_ID) {
        await syncCatalogFromGoogleSheet({ pruneMissing: prune });
      } else if (env.FOX_CATALOG_CSV_URL) {
        await syncCatalogFromConfiguredUrl({ pruneMissing: prune });
      } else {
        await syncCatalogFromConfiguredFile({ pruneMissing: prune });
      }
      console.log('[catalog] startup sync completed');
    } catch (e) {
      console.warn('[catalog] startup sync skipped or failed:', e);
    }
  })();
}

scheduleFoxCatalogSync();

const app = createApp();
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  if (env.FOX_CATALOG_SYNC_INTERVAL_MS >= MIN_CATALOG_SYNC_INTERVAL_MS) {
    console.log(
      `[catalog] polling sync every ${env.FOX_CATALOG_SYNC_INTERVAL_MS}ms (Google Sheet API, CSV URL, or local file)`,
    );
  }
});

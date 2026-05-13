import { ApiError } from '../http/apiError';
import * as rackRepo from '../repos/rackRepo';
import {
  syncCatalogFromConfiguredFile,
  syncCatalogFromConfiguredUrl,
  syncCatalogFromCsvText,
  syncCatalogFromGoogleSheet,
} from './catalogSync';
import { deleteRackConfig, listRackSummaries } from './rackService';

const DELETE_ALL_RACKS_CONFIRM = 'DELETE_ALL_RACKS';

export async function listAdminRacks() {
  return listRackSummaries();
}

export async function deleteAdminRack(idParam: unknown): Promise<void> {
  await deleteRackConfig(idParam);
}

export async function deleteAllAdminRacks(rawBody: unknown) {
  const body = rawBody as { confirm?: string } | null | undefined;
  if (body?.confirm !== DELETE_ALL_RACKS_CONFIRM) {
    throw ApiError.badRequest('Invalid confirmation; send { "confirm": "DELETE_ALL_RACKS" }');
  }
  const { count } = await rackRepo.deleteAllRacks();
  return { deleted: count };
}

export async function syncAdminCatalog(rawBody: unknown) {
  const body = rawBody as {
    prune?: boolean;
    csvText?: string;
    source?: 'file' | 'url' | 'google';
  } | null | undefined;
  const prune = !!body?.prune;
  if (typeof body?.csvText === 'string' && body.csvText.trim()) {
    const result = await syncCatalogFromCsvText(body.csvText, { pruneMissing: prune });
    return { ok: true, ...result, source: 'inline' };
  }
  if (body?.source === 'google') {
    return { ok: true, ...(await syncCatalogFromGoogleSheet({ pruneMissing: prune })) };
  }
  if (body?.source === 'url') {
    return { ok: true, ...(await syncCatalogFromConfiguredUrl({ pruneMissing: prune })) };
  }
  return { ok: true, ...(await syncCatalogFromConfiguredFile({ pruneMissing: prune })) };
}

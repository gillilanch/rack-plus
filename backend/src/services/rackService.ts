import { ApiError } from '../http/apiError';
import * as rackRepo from '../repos/rackRepo';
import { createRackBodySchema, updateRackBodySchema } from '../types/rackApi';

const DUPLICATE_NAME =
  'A rack already exists with that name. Please choose a different name.';

function rackIdFromParam(raw: unknown): string {
  const id = typeof raw === 'string' ? raw.trim() : '';
  if (!id) throw ApiError.badRequest('Missing rack id');
  return id;
}

export async function listRackSummaries() {
  const rows = await rackRepo.listRacks();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    totalHeight: r.totalHeightU,
    rackWidthInches: r.rackWidthInches,
    rackDepthInches: r.rackDepthInches,
    deviceCount: r._count.devices,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    savedByDisplayName: r.savedByDisplayName,
    savedByVerified: r.savedByVerified,
  }));
}

export async function getRackConfig(idParam: unknown) {
  const id = rackIdFromParam(idParam);
  const config = await rackRepo.getRackById(id);
  if (!config) throw ApiError.notFound('Rack not found');
  return config;
}

export async function createRackConfig(rawBody: unknown) {
  const body = createRackBodySchema.parse(rawBody);
  const conflict = await rackRepo.findRackNameConflict(body.name);
  if (conflict) throw ApiError.conflict(DUPLICATE_NAME, 'duplicate_rack_name');
  return rackRepo.createRack(body);
}

export async function updateRackConfig(idParam: unknown, rawBody: unknown) {
  const id = rackIdFromParam(idParam);
  const body = updateRackBodySchema.parse(rawBody);
  const conflict = await rackRepo.findRackNameConflict(body.name, id);
  if (conflict) throw ApiError.conflict(DUPLICATE_NAME, 'duplicate_rack_name');
  return rackRepo.upsertRackFull(id, body);
}

export async function deleteRackConfig(idParam: unknown): Promise<void> {
  const id = rackIdFromParam(idParam);
  const ok = await rackRepo.deleteRackById(id);
  if (!ok) throw ApiError.notFound('Rack not found');
}

import { z } from 'zod';
import { ApiError } from '../http/apiError';
import * as deviceCategoryRepo from '../repos/deviceCategoryRepo';

const deviceCategoryBodySchema = z.object({
  name: z.string(),
});

export async function listDeviceCategories() {
  return deviceCategoryRepo.listDeviceCategoriesOrdered();
}

export async function createDeviceCategory(rawBody: unknown) {
  const parsed = deviceCategoryBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    throw ApiError.badRequest('Send JSON { "name": "Category label" }');
  }
  const name = parsed.data.name.trim();
  if (!name) throw ApiError.badRequest('Category name is required');
  return deviceCategoryRepo.upsertDeviceCategoryByName(name);
}

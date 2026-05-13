import { env } from '../config/env';
import { prisma } from '../db/client';

export type HealthStatus = {
  ok: true;
  catalogDeviceCount: number | null;
  webhookSecretConfigured: boolean;
};

export async function getHealthStatus(): Promise<HealthStatus> {
  await prisma.$queryRaw`SELECT 1`;
  let catalogDeviceCount: number | null = null;
  try {
    catalogDeviceCount = await prisma.catalogDevice.count();
  } catch {
    /* migration not applied or table missing */
  }
  return {
    ok: true,
    catalogDeviceCount,
    webhookSecretConfigured: Boolean(env.CATALOG_WEBHOOK_SECRET),
  };
}

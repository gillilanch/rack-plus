import { z } from 'zod';

export const MIN_CATALOG_SYNC_INTERVAL_MS = 5_000;

function emptyStringAsUndefined(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

function numberFromEnv(defaultValue: number) {
  return z.preprocess((value) => {
    const normalized = emptyStringAsUndefined(value);
    if (normalized === undefined) return undefined;
    return Number(normalized);
  }, z.number().finite().default(defaultValue));
}

function booleanFlagFromEnv(defaultValue = false) {
  return z.preprocess((value) => {
    const normalized = emptyStringAsUndefined(value);
    if (normalized === undefined) return undefined;
    if (typeof normalized === 'boolean') return normalized;
    if (typeof normalized === 'string') {
      const v = normalized.toLowerCase();
      return v === '1' || v === 'true' || v === 'yes';
    }
    return Boolean(normalized);
  }, z.boolean().default(defaultValue));
}

const optionalString = z.preprocess(emptyStringAsUndefined, z.string().optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: numberFromEnv(4000).pipe(z.number().int().positive().max(65_535)),
  FRONTEND_DIST: optionalString,
  FOX_CATALOG_CSV_URL: optionalString,
  GOOGLE_SHEETS_SPREADSHEET_ID: optionalString,
  CATALOG_WEBHOOK_SECRET: optionalString,
  FOX_CATALOG_SYNC_INTERVAL_MS: numberFromEnv(0).pipe(z.number().int().nonnegative()),
  FOX_CATALOG_SYNC_ON_STARTUP: booleanFlagFromEnv(false),
  FOX_CATALOG_PRUNE_ON_SYNC: booleanFlagFromEnv(false),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return parsed.data;

  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid backend environment: ${message}`);
}

export const env = readEnv();

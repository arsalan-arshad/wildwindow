import { loadEnv } from '@wildwindow/shared';
import { z } from 'zod';

const boolish = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') {
      return false;
    }
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  });

export const ApiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL_API: z.string().min(1).optional(),
  WEB_ORIGIN: z.string().optional(),
  API_PUBLIC_URL: z.string().optional(),
  /** Firebase project id for firebase-admin (T5.8). Optional so public routes boot without auth. */
  FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  /**
   * Service account JSON string (not a path). Optional; when unset, real token verification
   * is unavailable — inject a mock verifier in tests.
   */
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().min(1).optional(),
  /** Bearer token for early-beta admin CSV export. Required in production when exporting. */
  ADMIN_TOKEN: z.string().min(1).optional(),
  /** When false (default), waitlist confirmation email is a no-op stub. */
  WAITLIST_EMAIL_ENABLED: boolish,
  /** Free-tier watchlist capacity (ARCHITECTURE §7 / T5.9). */
  WATCHLIST_LIMIT_FREE: z.coerce.number().int().positive().default(3),
  /**
   * Tide provider switch (ARCHITECTURE §3.5 / T4.8). MVP: `none` only → factor D is
   * `not_used`. Real providers are added later after licence checks (P3.1).
   */
  TIDE_PROVIDER: z
    .string()
    .optional()
    .transform((value) => {
      const normalized = (value ?? '').trim().toLowerCase();
      return normalized === '' ? 'none' : normalized;
    })
    .pipe(z.literal('none')),
  /**
   * Weather provider switch (ARCHITECTURE §3.4 / T4.7).
   * Empty → `metno` in production, `openmeteo` otherwise. `mock` for offline tests.
   */
  WEATHER_PROVIDER: z.string().optional(),
  /** Identifying User-Agent required by MET Norway (T4.7). */
  WEATHER_USER_AGENT: z.string().optional(),
  /**
   * Object storage driver (ARCHITECTURE §2 / T5.10).
   * Empty → `local` outside production, `s3` in production.
   */
  STORAGE_DRIVER: z.string().optional(),
  /** Private S3 bucket name when `STORAGE_DRIVER=s3`. */
  S3_BUCKET: z.string().min(1).optional(),
  /** AWS region for S3 (default eu-west-2). */
  S3_REGION: z.string().min(1).optional(),
  /** Filesystem root for `STORAGE_DRIVER=local` (default: os tmpdir). */
  LOCAL_STORAGE_DIR: z.string().min(1).optional(),
  /**
   * HMAC secret for local presigned PUT tokens.
   * Required when `STORAGE_DRIVER=local` in production; a fixed dev default otherwise.
   */
  STORAGE_SIGNING_SECRET: z.string().min(1).optional(),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/** Nest DI token for the validated API env (T5.2). */
export const API_ENV = Symbol('WW_API_ENV');

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return loadEnv(ApiEnvSchema, source);
}

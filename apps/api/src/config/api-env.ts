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
   * Empty/unset → `local` in every environment. Opt in with `r2` (Railway) or `s3`.
   * Values: `local` | `r2` | `s3`.
   */
  STORAGE_DRIVER: z.string().optional(),
  /** Private S3 bucket name when `STORAGE_DRIVER=s3`. */
  S3_BUCKET: z.string().min(1).optional(),
  /** AWS region for S3 (default eu-west-2). */
  S3_REGION: z.string().min(1).optional(),
  /** Cloudflare R2 bucket when `STORAGE_DRIVER=r2`. */
  R2_BUCKET: z.string().min(1).optional(),
  /**
   * Full S3 API endpoint for R2, e.g. `https://<accountid>.r2.cloudflarestorage.com`.
   * Optional when `R2_ACCOUNT_ID` is set (endpoint is derived).
   */
  R2_ENDPOINT: z.string().min(1).optional(),
  /** Cloudflare account id used to build the R2 endpoint when `R2_ENDPOINT` is unset. */
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  /** R2 S3 API access key id (Railway secret). */
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  /** R2 S3 API secret access key (Railway secret). */
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  /**
   * Optional public base URL (custom domain or `*.r2.dev`). When set, gallery/export
   * GET URLs use this host instead of signed R2 API URLs. Leave unset for private-only.
   */
  R2_PUBLIC_URL: z.string().min(1).optional(),
  /** Filesystem root for `STORAGE_DRIVER=local` (default: os tmpdir). */
  LOCAL_STORAGE_DIR: z.string().min(1).optional(),
  /**
   * HMAC secret for local presigned PUT tokens.
   * Required when `STORAGE_DRIVER=local` in production; a fixed dev default otherwise.
   */
  STORAGE_SIGNING_SECRET: z.string().min(1).optional(),
  /**
   * AES-256-GCM key for `app.logbook_entries.exact_point_enc` (ARCHITECTURE §6.3 / T5.11).
   * Base64 (32 bytes) or 64-char hex. Required in production at LogbookService boot;
   * a fixed non-secret default is used in development/test when unset.
   */
  LOGBOOK_ENC_KEY: z.string().min(1).optional(),
  /** Optional Sentry DSN (T9.1). When unset, error reporting is a no-op. */
  SENTRY_DSN: z.string().min(1).optional(),
  /** Optional PostHog project key (T9.1). When unset, analytics is a no-op. */
  POSTHOG_KEY: z.string().min(1).optional(),
  /** PostHog host; defaults to EU (`https://eu.i.posthog.com`) in the analytics module. */
  POSTHOG_HOST: z.string().min(1).optional(),
});

export type ApiEnv = z.infer<typeof ApiEnvSchema>;

/** Nest DI token for the validated API env (T5.2). */
export const API_ENV = Symbol('WW_API_ENV');

export function loadApiEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  return loadEnv(ApiEnvSchema, source);
}

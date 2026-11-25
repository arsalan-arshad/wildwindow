import { createDb, ingestRuns, regions, type Database } from '@wildwindow/db';
import { loadEnv } from '@wildwindow/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { createGbifClient, type GbifClient } from './client.js';
import { INGEST_SOURCE_GBIF, INGEST_STATUS } from './ingest-status.js';
import { buildPredicate, type IngestKind, type IngestRegion } from './predicate.js';
import { resolveTaxonKeysForRequest } from './taxon-keys.js';

const requestEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_WORKER: z.string().min(1).optional(),
  GBIF_USER: z.string().min(1),
  GBIF_PASSWORD: z.string().min(1),
  GBIF_EMAIL: z.string().email(),
});

export type GbifRequestOptions = {
  readonly region: IngestRegion;
  readonly kind: IngestKind;
  readonly betaSpeciesPath: string;
  readonly now?: Date;
  readonly client?: GbifClient;
  readonly db?: Database;
  /** When set, skips loadEnv (tests). */
  readonly env?: z.infer<typeof requestEnvSchema>;
};

export type GbifRequestResult = {
  readonly runId: number;
  readonly downloadKey: string;
  readonly status: typeof INGEST_STATUS.requested;
  readonly taxonKeyCount: number;
};

async function resolveRegionId(db: Database, slug: IngestRegion): Promise<number> {
  const rows = await db
    .select({ id: regions.id })
    .from(regions)
    .where(eq(regions.slug, slug))
    .limit(1);
  const row = rows[0];
  if (row === undefined) {
    throw new Error(
      `Region "${slug}" not found in ref.regions — run pnpm db:seed before gbif:request`,
    );
  }
  return row.id;
}

/**
 * `gbif:request` — build predicate, create GBIF download, insert ingest_runs.
 */
export async function runGbifRequest(options: GbifRequestOptions): Promise<GbifRequestResult> {
  const env = options.env ?? loadEnv(requestEnvSchema);
  const now = options.now ?? new Date();

  const taxonKeys = await resolveTaxonKeysForRequest({
    region: options.region,
    kind: options.kind,
    betaSpeciesPath: options.betaSpeciesPath,
  });
  const predicate = buildPredicate({
    region: options.region,
    kind: options.kind,
    taxonKeys,
  });

  const client =
    options.client ??
    createGbifClient({
      credentials: {
        user: env.GBIF_USER,
        password: env.GBIF_PASSWORD,
        email: env.GBIF_EMAIL,
      },
    });

  const downloadKey = await client.requestDownload({ predicate });

  const connectionString = env.DATABASE_URL_WORKER ?? env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('DATABASE_URL_WORKER or DATABASE_URL is required for gbif:request');
  }

  const owned = options.db === undefined;
  const { db, pool } =
    options.db !== undefined ? { db: options.db, pool: undefined } : createDb({ connectionString });

  try {
    const regionId = await resolveRegionId(db, options.region);
    const inserted = await db
      .insert(ingestRuns)
      .values({
        source: INGEST_SOURCE_GBIF,
        regionId,
        kind: options.kind,
        gbifDownloadKey: downloadKey,
        status: INGEST_STATUS.requested,
        startedAt: now,
      })
      .returning({ id: ingestRuns.id });

    const run = inserted[0];
    if (run === undefined) {
      throw new Error('gbif:request failed to insert ingest_runs row');
    }

    return {
      runId: run.id,
      downloadKey,
      status: INGEST_STATUS.requested,
      taxonKeyCount: taxonKeys.length,
    };
  } finally {
    if (owned && pool !== undefined) {
      await pool.end();
    }
  }
}

import path from 'node:path';

import { createDb, ingestRuns, type Database } from '@wildwindow/db';
import { loadEnv } from '@wildwindow/shared';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { createGbifClient, type GbifClient } from './client.js';
import { INGEST_STATUS } from './ingest-status.js';

const fetchEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  DATABASE_URL_WORKER: z.string().min(1).optional(),
  GBIF_USER: z.string().min(1),
  GBIF_PASSWORD: z.string().min(1),
  GBIF_EMAIL: z.string().email(),
});

const TERMINAL_FAIL = new Set(['CANCELLED', 'KILLED', 'FAILED', 'FILE_ERASED']);

export type GbifFetchOptions = {
  readonly runId: number;
  readonly downloadDir: string;
  readonly now?: Date;
  readonly client?: GbifClient;
  readonly db?: Database;
  readonly env?: z.infer<typeof fetchEnvSchema>;
  /** Poll interval (ms). Default 2000. */
  readonly pollIntervalMs?: number;
  /** Max status polls before giving up. Default 1800 (~1h at 2s). */
  readonly maxPolls?: number;
  readonly sleep?: (ms: number) => Promise<void>;
};

export type GbifFetchResult = {
  readonly runId: number;
  readonly status: typeof INGEST_STATUS.succeeded | typeof INGEST_STATUS.failed;
  readonly downloadKey: string;
  readonly doi: string | null;
  readonly total: number | null;
  readonly zipPath: string | null;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * `gbif:fetch` — poll GBIF until ready, download zip, store DOI + totals.
 */
export async function runGbifFetch(options: GbifFetchOptions): Promise<GbifFetchResult> {
  const env = options.env ?? loadEnv(fetchEnvSchema);
  const now = options.now ?? new Date();
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const maxPolls = options.maxPolls ?? 1800;
  const sleep = options.sleep ?? defaultSleep;

  const client =
    options.client ??
    createGbifClient({
      credentials: {
        user: env.GBIF_USER,
        password: env.GBIF_PASSWORD,
        email: env.GBIF_EMAIL,
      },
    });

  const connectionString = env.DATABASE_URL_WORKER ?? env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error('DATABASE_URL_WORKER or DATABASE_URL is required for gbif:fetch');
  }

  const owned = options.db === undefined;
  const { db, pool } =
    options.db !== undefined ? { db: options.db, pool: undefined } : createDb({ connectionString });

  try {
    const rows = await db
      .select({
        id: ingestRuns.id,
        status: ingestRuns.status,
        gbifDownloadKey: ingestRuns.gbifDownloadKey,
      })
      .from(ingestRuns)
      .where(eq(ingestRuns.id, options.runId))
      .limit(1);
    const run = rows[0];
    if (run === undefined) {
      throw new Error(`ingest_runs id=${String(options.runId)} not found`);
    }
    if (run.gbifDownloadKey === null || run.gbifDownloadKey.length === 0) {
      throw new Error(`ingest_runs id=${String(options.runId)} has no gbif_download_key`);
    }
    const downloadKey = run.gbifDownloadKey;

    let doi: string | null = null;
    let total: number | null = null;
    let downloadLink: string | undefined;

    for (let poll = 0; poll < maxPolls; poll++) {
      const status = await client.getDownload(downloadKey);

      if (status.status === 'SUCCEEDED') {
        doi = status.doi ?? null;
        total = status.totalRecords ?? null;
        downloadLink = status.downloadLink;
        break;
      }

      if (TERMINAL_FAIL.has(status.status)) {
        await db
          .update(ingestRuns)
          .set({
            status: INGEST_STATUS.failed,
            finishedAt: now,
          })
          .where(eq(ingestRuns.id, options.runId));

        return {
          runId: options.runId,
          status: INGEST_STATUS.failed,
          downloadKey,
          doi: status.doi ?? null,
          total: status.totalRecords ?? null,
          zipPath: null,
        };
      }

      if (poll + 1 < maxPolls) {
        await sleep(pollIntervalMs);
      }
    }

    if (downloadLink === undefined && doi === null && total === null) {
      await db
        .update(ingestRuns)
        .set({
          status: INGEST_STATUS.failed,
          finishedAt: now,
        })
        .where(eq(ingestRuns.id, options.runId));
      throw new Error(
        `GBIF download ${downloadKey} did not succeed within ${String(maxPolls)} polls`,
      );
    }

    const zipPath = path.join(options.downloadDir, `${String(options.runId)}-${downloadKey}.zip`);
    await client.downloadFile(downloadLink ?? downloadKey, zipPath);

    await db
      .update(ingestRuns)
      .set({
        status: INGEST_STATUS.succeeded,
        doi,
        total,
        finishedAt: now,
      })
      .where(eq(ingestRuns.id, options.runId));

    return {
      runId: options.runId,
      status: INGEST_STATUS.succeeded,
      downloadKey,
      doi,
      total,
      zipPath,
    };
  } finally {
    if (owned && pool !== undefined) {
      await pool.end();
    }
  }
}

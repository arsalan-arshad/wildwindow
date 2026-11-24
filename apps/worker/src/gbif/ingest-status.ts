/** Status values for `app.ingest_runs.status` (Phase 3 bookkeeping). */
export const INGEST_STATUS = {
  requested: 'requested',
  succeeded: 'succeeded',
  failed: 'failed',
} as const;

export type IngestStatus = (typeof INGEST_STATUS)[keyof typeof INGEST_STATUS];

export const INGEST_SOURCE_GBIF = 'gbif';

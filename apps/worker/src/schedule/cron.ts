/**
 * Documented Railway cron expressions for scheduled worker services (T9.3).
 *
 * Schedules are UTC (Railway cron). Keep in sync with
 * `infra/railway/worker-purge.toml` and `infra/railway/worker-ingest.toml`.
 *
 * Dashboard click-path: docs/RAILWAY.md § Scheduled worker jobs.
 */
export const RAILWAY_WORKER_CRON = {
  /**
   * Daily hard-delete of soft-deleted accounts older than 30 days
   * (`purge-deleted`). 04:00 UTC ≈ 09:00 Asia/Karachi / 04:00 Europe/London
   * (GMT; 05:00 BST).
   */
  purgeDeleted: '0 4 * * *',
  /**
   * Monthly GBIF refresh for both beta regions (`ingest:pipeline --region all`).
   * 1st of month 05:00 UTC. Long GBIF downloads may run for hours; Railway
   * skips the next tick if the previous run is still Active.
   */
  ingestPipeline: '0 5 1 * *',
} as const;

export type RailwayWorkerCronJob = keyof typeof RAILWAY_WORKER_CRON;

/**
 * Documented Railway continuous-deploy constants (T9.4).
 *
 * Production deploys via Railway's GitHub integration on `main` — not AWS
 * OIDC/ECS. Keep health paths and public smoke URLs in sync with
 * `infra/railway/*.toml`, `docs/RAILWAY.md` § Continuous deployment, and
 * `.github/workflows/railway-cd.yml`.
 *
 * Optional AWS CD cutover is T9.4b.
 */

/** Services that should autodeploy from `main` with Wait for CI enabled. */
export const RAILWAY_CD_SERVICES = [
  'api',
  'web',
  'worker',
  'migrate',
  'worker-purge',
  'worker-ingest',
] as const;

export type RailwayCdService = (typeof RAILWAY_CD_SERVICES)[number];

/**
 * HTTP healthcheck paths copied into Railway service Deploy settings
 * (and stored in the matching `infra/railway/*.toml`).
 */
export const RAILWAY_HEALTHCHECK = {
  api: '/v1/health',
  web: '/',
} as const;

/**
 * Public production probe URLs for the manual / workflow_dispatch smoke
 * (dry-run acceptance). Not secrets — they are the live beta hosts.
 */
export const RAILWAY_SMOKE_URLS = {
  apiHealth: 'https://api-production-fb747925.up.railway.app/v1/health',
  webHome: 'https://wildwindow.arsalandev.studio/',
} as const;

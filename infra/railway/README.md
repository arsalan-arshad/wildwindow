# Railway service config snippets

Canonical click-path, env checklist, and roles explanation: **[docs/RAILWAY.md](../../docs/RAILWAY.md)**.

| File                 | Service                        | Dockerfile                |
| -------------------- | ------------------------------ | ------------------------- |
| `api.toml`           | `api`                          | `apps/api/Dockerfile`     |
| `web.toml`           | `web`                          | `apps/web/Dockerfile`     |
| `worker.toml`        | `worker` (hello smoke)         | `apps/worker/Dockerfile`  |
| `worker-purge.toml`  | `worker-purge` (daily cron)    | `apps/worker/Dockerfile`  |
| `worker-ingest.toml` | `worker-ingest` (monthly cron) | `apps/worker/Dockerfile`  |
| `migrate.toml`       | `migrate` (one-off)            | `apps/migrate/Dockerfile` |

PostGIS: prefer the Railway **PostGIS** template (`postgis/postgis:18-3.7`), not the plain Postgres plugin.

## Cron services (T9.3)

Railway cron is a **service setting** (Settings → Cron Schedule), not a separate resource type. Create **new** services from the same worker image; leave the hello smoke `worker` alone.

| Service         | Cron (UTC)  | Start command                                   |
| --------------- | ----------- | ----------------------------------------------- |
| `worker-purge`  | `0 4 * * *` | `node dist/cli.js purge-deleted`                |
| `worker-ingest` | `0 5 1 * *` | `node dist/cli.js ingest:pipeline --region all` |

Copy `cronSchedule` / `startCommand` / `restartPolicyType = NEVER` from the matching `.toml`. Prefer pasting into the dashboard (Railway Config-as-Code `railway.toml` is legacy). Full click-path and env: [docs/RAILWAY.md](../../docs/RAILWAY.md) § Scheduled worker jobs.

Constants under test: `RAILWAY_WORKER_CRON` in `apps/worker/src/schedule/cron.ts`.

## Continuous deployment (T9.4)

Production ships via **Railway GitHub Autodeploy** on `main` (Wait for CI recommended). There is no AWS OIDC/ECS workflow in this repo while Railway is production.

| Piece                                | Role                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Railway Autodeploy + Wait for CI     | Build/deploy after green CI on `main`                                                      |
| `migrate.toml` restart **Never**     | Migrate-on-deploy when watch paths (`packages/db/**`, …) change                            |
| `api.toml` / `web.toml` healthchecks | `/v1/health` and `/`                                                                       |
| `.github/workflows/railway-cd.yml`   | Manual dry-run smoke (`workflow_dispatch` only — not on push, avoids Wait-for-CI deadlock) |
| `infra/lib/railway-cd.ts`            | Documented service list + smoke URLs (Vitest in `infra/test/railway-cd.test.ts`)           |

Full click-path: [docs/RAILWAY.md](../../docs/RAILWAY.md) § Continuous deployment. Optional AWS CD is **T9.4b**.

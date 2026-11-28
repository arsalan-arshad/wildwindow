# Railway deploy (production)

WildWindow’s **production host** is **Railway**: PostGIS + `api` + `web` + `worker` (+ cron / migrate). AWS CDK (Phase 9) remains an optional cutover. Prefer Railway over Mac Docker Desktop (battery). Secrets live only in **Railway Variables** (and local `.env`) — never in git or chat.

Config snippets: [`infra/railway/`](../infra/railway/). Dockerfiles: `apps/{api,web,worker,migrate}/Dockerfile`.

---

## What Arsalan must do (click-path)

Agents can prepare the repo and, when `RAILWAY_TOKEN` is injected into the cloud-agent environment, create the project via CLI. Until then, use the dashboard:

### A. Project + GitHub

1. Open [railway.app](https://railway.app) → **New Project**.
2. **Empty Project** (or deploy from GitHub after the empty project exists).
3. Project name e.g. `wildwindow` · pick a region close to you (EU/Asia if offered).
4. **Project Settings → Connect GitHub** → authorize → select `arsalan-arshad/wildwindow`.
5. Default deploy branch: `main` (or the PR branch while testing scaffolding).

### B. PostGIS (not plain Postgres)

Railway’s default Postgres plugin is **not** enough (we need PostGIS).

1. In the project → **+ New** → **Template** → search **PostGIS**.
2. Prefer the template that runs **`postgis/postgis:18-3.7`** (PostgreSQL 18 + PostGIS 3.7). Official image notes: volume mount is `/var/lib/postgresql` (PG 18+).
3. Wait until the service is healthy.
4. Open the PostGIS service → **Variables** and note:
   - Private `DATABASE_URL` (for Railway-internal services) — use this for `api` / `worker` / `migrate`.
   - Public / TCP proxy URL (only if you need `psql` from a laptop).
5. Confirm PostGIS: in Railway Data / Query (or `psql`) run `SELECT postgis_full_version();`.
6. Set `POSTGRES_DB` to `wildwindow` if the template defaulted to something else (or use the DB name the template created and keep URLs consistent).

**Do not** paste connection strings into git, Slack, or agent chat. Copy into Railway Variables only.

### C. Services from this repo

For **each** of `api`, `web`, `worker`, `migrate`:

1. **+ New** → **GitHub Repo** → `arsalan-arshad/wildwindow` (same project).
2. **Settings → Root Directory**: leave empty / `/` (monorepo root).
3. **Settings → Build**:
   - Builder: **Dockerfile**
   - Dockerfile path: see table below.
4. Apply watch patterns / healthchecks from `infra/railway/*.toml` (copy into the UI, or `railway.toml` when linking one service at a time).
5. **Generate domain** for `api` and `web` (Settings → Networking).

| Service         | Dockerfile                | Role                                                                              |
| --------------- | ------------------------- | --------------------------------------------------------------------------------- |
| `api`           | `apps/api/Dockerfile`     | NestJS `/v1` (health: `/v1/health`)                                               |
| `web`           | `apps/web/Dockerfile`     | Next.js App Router                                                                |
| `worker`        | `apps/worker/Dockerfile`  | CLI; default `hello` smoke (no live GBIF)                                         |
| `worker-purge`  | `apps/worker/Dockerfile`  | Cron: daily `purge-deleted` (T9.3) — create as a **separate** service             |
| `worker-ingest` | `apps/worker/Dockerfile`  | Cron: monthly `ingest:pipeline --region all` (T9.3) — create separately           |
| `migrate`       | `apps/migrate/Dockerfile` | One-off: migrations + optional seed (compiled `node …/dist/migrate.js`, not pnpm) |

### D. First migrate, then smoke

1. Paste variables per the checklist below (especially DB + role passwords on `migrate`).
2. Deploy **`migrate` once** (restart policy **never**). Set `RUN_SEED=1` on that run if you want seeds.
3. Deploy `api` → open `https://<api-domain>/v1/health` → expect `{ "status": "ok" }` (DB check may arrive in a later task; today health is liveness).
4. Deploy `web` → open the public URL → landing page.
5. Deploy `worker` → logs should show the `hello` / `ok` smoke (no GBIF). Set the worker **restart policy to Never** (or run as a one-off): `hello` exits 0, so an always-on / restart-on-exit policy loops forever. `ON_FAILURE` is fine only for processes that stay up; not for this smoke.

### E. Optional: CLI token for agents

To let a **new** Cursor cloud agent create/configure Railway for you:

1. Railway → **Account → Tokens** → create a token.
2. Cursor Dashboard → **Cloud Agents → Secrets** → add `RAILWAY_TOKEN` as a **Runtime Secret** on the WildWindow environment.
3. Start a **new** agent run (secrets inject only at boot).

---

## Database roles (`DATABASE_URL` vs `DATABASE_URL_API` / `DATABASE_URL_WORKER`)

From ARCHITECTURE §6.3:

| Role / URL              | Who uses it                        | Privileges                                    |
| ----------------------- | ---------------------------------- | --------------------------------------------- |
| `DATABASE_URL`          | Owner / migrations (`migrate` job) | Owns objects; runs Drizzle migrations         |
| `DATABASE_URL_API`      | `api` service                      | Connect as **`ww_api`** — **no** `raw` schema |
| `DATABASE_URL_WORKER`   | `worker` service                   | Connect as **`ww_worker`** — may use `raw`    |
| `WW_API_DB_PASSWORD`    | `migrate` (and local `db:migrate`) | Creates/updates role `ww_api`                 |
| `WW_WORKER_DB_PASSWORD` | `migrate` (and local `db:migrate`) | Creates/updates role `ww_worker`              |

**Flow:**

1. Railway PostGIS gives you an owner URL → set as `DATABASE_URL` on **`migrate`** (and keep a copy for yourself in a password manager).
2. Choose strong passwords for `WW_API_DB_PASSWORD` and `WW_WORKER_DB_PASSWORD` (you invent these; they are not the PostGIS plugin password).
3. Run **`migrate`** so roles exist.
4. Build role URLs by replacing the username/password in the owner URL:
   - `DATABASE_URL_API` → user `ww_api`, password = `WW_API_DB_PASSWORD`
   - `DATABASE_URL_WORKER` → user `ww_worker`, password = `WW_WORKER_DB_PASSWORD`
5. Put `DATABASE_URL_API` only on **`api`**. Put `DATABASE_URL_WORKER` on **`worker`**. Never give the API the owner URL or `ww_worker` URL.

---

## Per-service env checklist (from `.env.example`)

Paste values yourself in Railway → service → **Variables**.  
**Secret** = treat as credential (Runtime / secret variable). **Public** = safe to expose to browsers or non-sensitive config.  
Blank “needed?” means not required for that service on Railway beta.

Legend: **R** = required for that service to start / do its job · **O** = optional later · **—** = do not set on this service.

| Variable                        | Kind       | `migrate`        | `api`                    | `web`  | `worker` | Notes                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ---------- | ---------------- | ------------------------ | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                      | Public     | R (`production`) | R                        | R      | R        |                                                                                                                                                                                                                                                                                                        |
| `PORT`                          | Public     | —                | **R\*** (`3001`)         | O      | —        | \*Api listens on `PORT` (Dockerfile `EXPOSE 3001`, code default `3001`). If the Railway domain / proxy targets **3001**, set `PORT=3001` on `api` — Railway’s injected `PORT` can differ. Web uses whatever Railway injects (Next reads `PORT`).                                                       |
| `HOSTNAME`                      | Public     | —                | —                        | —†     | —        | †Do **not** set on `web` in Railway Variables. The web Dockerfile sets `HOSTNAME=0.0.0.0` so Next listens on all interfaces; Railway’s default container hostname breaks the `/` healthcheck.                                                                                                          |
| `DATABASE_URL`                  | **Secret** | **R** (owner)    | —                        | —      | O*       | Owner/migrations on migrate. *Also set on **`worker`** for `make-admin` and `purge-deleted` (T5.8 / T5.14) — `ww_worker` has no DML on `app.users` / logbook. Prefer `DATABASE_URL_WORKER` for GBIF/aggregate.                                                                                         |
| `DATABASE_URL_API`              | **Secret** | —                | **R** (when API uses DB) | —      | —        | `ww_api` URL                                                                                                                                                                                                                                                                                           |
| `DATABASE_URL_WORKER`           | **Secret** | —                | —                        | —      | **R**    | `ww_worker` URL                                                                                                                                                                                                                                                                                        |
| `WW_API_DB_PASSWORD`            | **Secret** | **R**            | —                        | —      | —        | Used only while applying roles                                                                                                                                                                                                                                                                         |
| `WW_WORKER_DB_PASSWORD`         | **Secret** | **R**            | —                        | —      | —        | Used only while applying roles                                                                                                                                                                                                                                                                         |
| `RUN_SEED`                      | Public     | O (`1` to seed)  | —                        | —      | —        | Migrate image only                                                                                                                                                                                                                                                                                     |
| `GBIF_USER`                     | **Secret** | —                | —                        | —      | O        | **Do not set until T3.9**                                                                                                                                                                                                                                                                              |
| `GBIF_PASSWORD`                 | **Secret** | —                | —                        | —      | O        | **Do not set until T3.9**                                                                                                                                                                                                                                                                              |
| `GBIF_EMAIL`                    | Public     | —                | —                        | —      | O        | **Do not set until T3.9**                                                                                                                                                                                                                                                                              |
| `GBIF_ENABLED`                  | Public     | —                | —                        | —      | O†       | †Required `"true"` on **`worker-ingest`** for the monthly cron (`ingest:pipeline` refuses otherwise). Leave unset on the hello smoke `worker`.                                                                                                                                                         |
| `INAT_DIRECT_ENABLED`           | Public     | —                | O                        | —      | O        | MVP: leave unset/false                                                                                                                                                                                                                                                                                 |
| `EBIRD_ENABLED`                 | Public     | —                | O                        | —      | O        | Must stay off without written permission                                                                                                                                                                                                                                                               |
| `EBIRD_PERMISSION_REF`          | Public     | —                | O                        | —      | O        | Required only if eBird ever enabled                                                                                                                                                                                                                                                                    |
| `WEATHER_PROVIDER`              | Public     | —                | O                        | —      | —        | Later forecast tasks                                                                                                                                                                                                                                                                                   |
| `WEATHER_USER_AGENT`            | Public     | —                | O                        | —      | —        |                                                                                                                                                                                                                                                                                                        |
| `TIDE_PROVIDER`                 | Public     | —                | O                        | —      | —        |                                                                                                                                                                                                                                                                                                        |
| `OBSERVER_HASH_SALT`            | **Secret** | —                | O                        | —      | O        | When logbook/ingest hashing lands                                                                                                                                                                                                                                                                      |
| `LOGBOOK_ENC_KEY`               | **Secret** | —                | **R** (prod)             | —      | —        | AES-256-GCM key for logbook `exact_point_enc` (T5.11). Base64 of 32 bytes or 64-char hex. Required when `NODE_ENV=production` (API boot); generate e.g. `openssl rand -base64 32` and set on **`api` Variables** only.                                                                                 |
| `FIREBASE_PROJECT_ID`           | Public     | —                | O                        | O      | —        | When auth lands                                                                                                                                                                                                                                                                                        |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Secret** | —                | O                        | —      | —        | API only; never to web                                                                                                                                                                                                                                                                                 |
| `STORAGE_DRIVER`                | Public     | —                | O                        | —      | O†       | †Needed on **`worker`** for `purge-deleted` photo cleanup (T5.14). Same driver as `api`. Empty/unset → `local` in every environment (safe Railway boot without R2 secrets). Set `r2` explicitly for Cloudflare R2. Values: `local` \| `r2` \| `s3`. See **Object storage (Cloudflare R2)** below.      |
| `S3_BUCKET`                     | Public     | —                | O                        | —      | O†       | †Required on worker when `STORAGE_DRIVER=s3` (optional AWS path).                                                                                                                                                                                                                                      |
| `S3_REGION`                     | Public     | —                | O                        | —      | O        | Default `eu-west-2` when unset (`STORAGE_DRIVER=s3` only).                                                                                                                                                                                                                                             |
| `R2_BUCKET`                     | Public     | —                | O‡                       | —      | O‡       | ‡Required on **`api`** + **`worker`** when `STORAGE_DRIVER=r2`.                                                                                                                                                                                                                                        |
| `R2_ENDPOINT`                   | Public     | —                | O‡                       | —      | O‡       | ‡Full S3 API URL, e.g. `https://<accountid>.r2.cloudflarestorage.com`. Optional if `R2_ACCOUNT_ID` is set.                                                                                                                                                                                             |
| `R2_ACCOUNT_ID`                 | Public     | —                | O‡                       | —      | O‡       | ‡Used to derive the endpoint when `R2_ENDPOINT` is unset.                                                                                                                                                                                                                                              |
| `R2_ACCESS_KEY_ID`              | **Secret** | —                | O‡                       | —      | O‡       | ‡R2 S3 API token access key id (Cloudflare dashboard → R2 → Manage R2 API Tokens).                                                                                                                                                                                                                     |
| `R2_SECRET_ACCESS_KEY`          | **Secret** | —                | O‡                       | —      | O‡       | ‡R2 S3 API token secret. Never commit.                                                                                                                                                                                                                                                                 |
| `R2_PUBLIC_URL`                 | Public     | —                | O                        | —      | —        | Optional custom domain / `*.r2.dev` public base. When set, gallery/export GET URLs use this host; leave unset for private signed GETs only.                                                                                                                                                            |
| `LOCAL_STORAGE_DIR`             | Public     | —                | O                        | —      | O        | Shared filesystem root when `STORAGE_DRIVER=local` (api + worker must see the same path for purge).                                                                                                                                                                                                    |
| `STORAGE_SIGNING_SECRET`        | **Secret** | —                | O                        | —      | —        | Local presigned PUT/GET HMAC (api only).                                                                                                                                                                                                                                                               |
| `CLOUDFRONT_KEY_PAIR_ID`        | Public     | —                | O                        | —      | —        | Optional AWS cutover only (T9.3b).                                                                                                                                                                                                                                                                     |
| `CLOUDFRONT_PRIVATE_KEY`        | **Secret** | —                | O                        | —      | —        | Optional AWS cutover only (T9.3b).                                                                                                                                                                                                                                                                     |
| `WATCHLIST_LIMIT_FREE`          | Public     | —                | O                        | —      | —        |                                                                                                                                                                                                                                                                                                        |
| `API_PUBLIC_URL`                | Public     | —                | O                        | —      | —        | Public https URL of `api`                                                                                                                                                                                                                                                                              |
| `WEB_ORIGIN`                    | Public     | —                | **R**†                   | —      | —        | †Public https origin of `web` (no path). API enables CORS from this value (`apps/api` `corsOptionsFromWebOrigin`); trailing slash is normalized. Without it, browsers get no `Access-Control-Allow-Origin`.                                                                                            |
| `ADMIN_TOKEN`                   | **Secret** | —                | **R**§                   | —      | —        | §Bearer / `X-Admin-Token` for `GET /v1/admin/waitlist/export` (early beta CSV). Set on **`api` Variables** only; rotate in Railway; never commit.                                                                                                                                                      |
| `WAITLIST_EMAIL_ENABLED`        | Public     | —                | O (`false`)              | —      | —        | Default off. When `false`/unset, waitlist signup skips sending mail (stub only).                                                                                                                                                                                                                       |
| `EXPO_PUBLIC_API_URL`           | Public     | —                | —                        | —      | —        | Mobile only (EAS / local)                                                                                                                                                                                                                                                                              |
| `EXPO_PUBLIC_SITE_URL`          | Public     | —                | —                        | —      | —        | Mobile only — public web origin for `/api/og/...` share-card previews (T6.11); defaults to the live web host when unset                                                                                                                                                                                |
| `EXPO_PUBLIC_FIREBASE_CONFIG`   | Public     | —                | —                        | —      | —        | Mobile only                                                                                                                                                                                                                                                                                            |
| `NEXT_PUBLIC_API_URL`           | Public     | —                | —                        | **R**‡ | —        | Browser → API base URL (e.g. `https://<api-domain>`). ‡**Build-time only:** Next inlines `NEXT_PUBLIC_*` at `next build`. Set as a Railway **Variable on `web` before/at build** (Dockerfile `ARG` + `ENV` before `pnpm … build`). Runtime-only changes are **not** picked up — trigger a **rebuild**. |
| `NEXT_PUBLIC_SITE_URL`          | Public     | —                | —                        | **R**‡ | —        | Canonical public site origin (e.g. `https://wildwindow.arsalandev.studio`) for metadata. Same build-time inlining as `NEXT_PUBLIC_API_URL` — Dockerfile `ARG`/`ENV` before `next build`.                                                                                                               |
| `NEXT_PUBLIC_FIREBASE_CONFIG`   | Public     | —                | —                        | O‡§    | —        | §JSON string of the Firebase **web** app config (`apiKey`, `authDomain`, `projectId`, `appId`, …). Required for `/admin` sign-in (T7.6). Same build-time inlining as `NEXT_PUBLIC_API_URL` — set before `next build`, then rebuild. Not a secret; restrict the key in the Firebase console.            |
| `SENTRY_DSN`                    | **Secret** | —                | O                        | O      | O        | T9.1 error reporting. Scrubs PII + location before send.                                                                                                                                                                                                                                               |
| `NEXT_PUBLIC_SENTRY_DSN`        | Public     | —                | —                        | O‡     | —        | T9.1 browser Sentry (build-time). Prefer a web-only DSN; still scrubbed client-side.                                                                                                                                                                                                                   |
| `POSTHOG_KEY`                   | **Secret** | —                | O                        | O      | —        | T9.1 PostHog (server). Events go through the shared allowlist (no cells/coords).                                                                                                                                                                                                                       |
| `POSTHOG_HOST`                  | Public     | —                | O                        | O      | —        | Default EU `https://eu.i.posthog.com` when unset.                                                                                                                                                                                                                                                      |
| `NEXT_PUBLIC_POSTHOG_KEY`       | Public     | —                | —                        | O‡     | —        | T9.1 browser PostHog (build-time). Allowlisted events only.                                                                                                                                                                                                                                            |
| `NEXT_PUBLIC_POSTHOG_HOST`      | Public     | —                | —                        | O‡     | —        | Browser PostHog host; defaults to EU when unset.                                                                                                                                                                                                                                                       |

### Minimal paste set for first smoke

**`migrate`:** `NODE_ENV`, `DATABASE_URL`, `WW_API_DB_PASSWORD`, `WW_WORKER_DB_PASSWORD`, optional `RUN_SEED=1`.

**`api`:** `NODE_ENV`, `PORT=3001` (when the public domain targets 3001), `DATABASE_URL_API` (required for waitlist), `API_PUBLIC_URL`, `WEB_ORIGIN` (must match the browser origin of `web`, e.g. `https://wildwindow.arsalandev.studio`), `ADMIN_TOKEN` (waitlist CSV export), `WAITLIST_EMAIL_ENABLED=false`.

**`web`:** `NODE_ENV`, `NEXT_PUBLIC_API_URL` (api public URL), `NEXT_PUBLIC_SITE_URL` (canonical site origin) — both are **build arg / build-time variables**, not runtime-only. Do not override `HOSTNAME`. After changing `NEXT_PUBLIC_*`, use Railway **Redeploy → clear build cache** (or equivalent) so Docker rebuilds with the new `ARG`/`ENV`.

**`worker`:** `NODE_ENV`, `DATABASE_URL_WORKER`. For `make-admin` / `purge-deleted` (T5.14) also set owner `DATABASE_URL`, plus the same `STORAGE_DRIVER` / R2 (or `S3_BUCKET` / `LOCAL_STORAGE_DIR`) as `api` so photo objects can be deleted. Leave all `GBIF_*` unset.

---

## Object storage (Cloudflare R2)

Railway beta uses **Cloudflare R2** (S3-compatible) when opted in. Empty/unset `STORAGE_DRIVER` always resolves to **`local`** (dev and production), so Railway can boot without R2 secrets. For production uploads, set `STORAGE_DRIVER=r2` explicitly and provide the R2_* vars below. Arsalan creates the R2 bucket and API token in the Cloudflare dashboard (agents must **not** create Cloudflare resources or paste secrets into the repo).

Set the same values on **`api`** and **`worker`**:

| Variable               | Kind       | Example shape (do not paste real values)                         |
| ---------------------- | ---------- | ---------------------------------------------------------------- |
| `STORAGE_DRIVER`       | Public     | `r2` (required opt-in; empty → `local`)                          |
| `R2_BUCKET`            | Public     | bucket name                                                      |
| `R2_ENDPOINT`          | Public     | `https://<accountid>.r2.cloudflarestorage.com`                   |
| `R2_ACCOUNT_ID`        | Public     | Cloudflare account id (optional if `R2_ENDPOINT` is set)         |
| `R2_ACCESS_KEY_ID`     | **Secret** | R2 API token access key id                                       |
| `R2_SECRET_ACCESS_KEY` | **Secret** | R2 API token secret access key                                   |
| `R2_PUBLIC_URL`        | Public     | optional `https://…` custom domain or `*.r2.dev` public base URL |

`POST /v1/uploads/presign` returns a signed PUT URL against the R2 S3 API endpoint. Gallery/export GET uses signed R2 URLs unless `R2_PUBLIC_URL` is set (then GETs are `${R2_PUBLIC_URL}/${key}`). GPS EXIF is still rejected before objects are trusted for the logbook.

`STORAGE_DRIVER=s3` remains for an optional later AWS cutover (T9.3b); prefer `r2` on Railway.

Logbook exact points use **`LOGBOOK_ENC_KEY`** (AES-256-GCM on the API). There is no AWS KMS on Railway; T9.3b would add KMS only on the Milestone H CDK path.

---

## Scheduled worker jobs (T9.3)

Railway cron runs a **service’s start command** on a crontab (UTC), then expects the process to **exit** and close DB/storage connections. If a previous run is still `Active`, Railway **skips** the next tick.

Config snippets (copy into the dashboard — do not treat root `railway.toml` as required):

| Snippet                                                                   | Suggested service name | Cron (UTC)  | Start command                                   |
| ------------------------------------------------------------------------- | ---------------------- | ----------- | ----------------------------------------------- |
| [`infra/railway/worker-purge.toml`](../infra/railway/worker-purge.toml)   | `worker-purge`         | `0 4 * * *` | `node dist/cli.js purge-deleted`                |
| [`infra/railway/worker-ingest.toml`](../infra/railway/worker-ingest.toml) | `worker-ingest`        | `0 5 1 * *` | `node dist/cli.js ingest:pipeline --region all` |

Constants under test: `RAILWAY_WORKER_CRON` in `apps/worker/src/schedule/cron.ts` (must match the TOML `cronSchedule` values).

### F. What Arsalan must click (cron services)

Agents must **not** create Railway services or paste secrets. In the [Wild Window](https://railway.com/project/5f95e310-379a-430b-b6dc-ef6307461963) project:

#### Daily purge (`worker-purge`)

1. **+ New** → **GitHub Repo** → `arsalan-arshad/wildwindow` (same project). Name it e.g. `worker-purge`.
2. **Settings → Build**: Dockerfile · path `apps/worker/Dockerfile` · watch patterns from `worker-purge.toml`.
3. **Settings → Deploy**:
   - **Custom Start Command:** `node dist/cli.js purge-deleted`
   - **Cron Schedule:** `0 4 * * *` (daily 04:00 UTC)
   - **Restart Policy:** **Never**
4. **Variables** (same secrets as needed for purge — never commit):
   - `NODE_ENV=production`
   - `DATABASE_URL` — **owner** URL (required; `ww_worker` cannot DML `app.users` / logbook)
   - `STORAGE_DRIVER=r2` plus the same `R2_*` set as on `api` (photo object delete)
5. Deploy once (or wait for the next cron). Confirm logs show JSON `{ "purgedUsers": … }` and the deployment exits (not left Active).

#### Monthly GBIF ingest (`worker-ingest`)

1. **+ New** → another GitHub-linked service from the same repo. Name it e.g. `worker-ingest`.
2. Same Dockerfile / watch patterns as `worker-ingest.toml`.
3. **Settings → Deploy**:
   - **Custom Start Command:** `node dist/cli.js ingest:pipeline --region all`
   - **Cron Schedule:** `0 5 1 * *` (1st of month 05:00 UTC)
   - **Restart Policy:** **Never**
4. **Variables:**
   - `NODE_ENV=production`
   - `DATABASE_URL_WORKER` (`ww_worker`)
   - `GBIF_ENABLED=true` (pipeline **refuses** without this)
   - `GBIF_USER`, `GBIF_PASSWORD`, `GBIF_EMAIL`
   - `OBSERVER_HASH_SALT` (required by `gbif:load`)
5. Optional dry-run before enabling the cron (one-off start command override):  
   `node dist/cli.js ingest:pipeline --region all --dry-run`  
   Expect JSON with `plannedSteps` and no GBIF traffic.
6. First live run can take **hours** (GBIF download + load). Ensure the service has enough ephemeral disk for zips under `data/downloads`. Leave the hello smoke `worker` service as-is (restart Never, command `hello`).

CLI locally / one-off: `pnpm worker ingest:pipeline --region scotland|sindh|all [--dry-run]`.

---

## Continuous deployment (T9.4)

**Production CD path is Railway’s GitHub integration**, not AWS OIDC → ECR → ECS. There is **one** live Railway environment today (no separate staging project). Optional AWS staging/prod CD with manual approval is **T9.4b**.

Constants under test: `RAILWAY_CD_SERVICES` / `RAILWAY_HEALTHCHECK` / `RAILWAY_SMOKE_URLS` in [`infra/lib/railway-cd.ts`](../infra/lib/railway-cd.ts).

### How a merge to `main` ships

1. Squash-merge to `main` → GitHub Actions **CI** runs (lint / typecheck / test / build / `cdk synth`).
2. Each GitHub-linked Railway service with **Autodeploy** on branch `main` starts a deployment.
3. Prefer **Wait for CI** on every app service so Railway stays in `WAITING` until the CI check suite on that commit succeeds (skips deploy on CI failure). Requirements: a workflow with `on.push.branches: [main]` (this repo’s `.github/workflows/ci.yml`).
4. Watch patterns in `infra/railway/*.toml` limit which path changes rebuild which service (paste into Settings → Build → Watch Paths if not already applied).
5. Healthchecks (Deploy settings / TOML):
   - `api` → `/v1/health` (expect JSON `{ "status": "ok" }`)
   - `web` → `/`
6. **Migrate-on-deploy:** keep the `migrate` service Autodeploy + Wait for CI + restart **Never**. When `packages/db/**` (or other migrate watch paths) change on `main`, Railway builds `apps/migrate/Dockerfile` and runs the entrypoint once (Drizzle + roles). Do **not** put migrations in an `api` pre-deploy command — the API image has no migrate entrypoint and must not hold the owner `DATABASE_URL`. Leave `RUN_SEED` unset on routine CD runs.

Cron services (`worker-purge`, `worker-ingest`) also rebuild from `main` when their watch paths change; the crontab still controls when the start command runs.

### G. What Arsalan must click (CD checklist)

In [Wild Window](https://railway.com/project/5f95e310-379a-430b-b6dc-ef6307461963), for **each** of `api`, `web`, `worker`, `migrate`, and (once created) `worker-purge` / `worker-ingest`:

1. **Settings → Source** → repo `arsalan-arshad/wildwindow`, branch **`main`**, Autodeploy **on**.
2. Toggle **Wait for CI** **on** (needs the Railway GitHub App permissions for check suites).
3. Confirm Dockerfile path, watch paths, healthcheck (api/web), and restart policy match `infra/railway/<service>.toml`.
4. Confirm `migrate` restart is **Never** and owner `DATABASE_URL` + `WW_*` passwords are set (no seed flag for CD).

Agents must **not** create Railway environments, flip Wait for CI, or paste tokens into git.

### Dry-run / smoke (acceptance)

After a green CI merge (or anytime):

1. GitHub → **Actions** → **Railway CD smoke** → **Run workflow** (`.github/workflows/railway-cd.yml`, `workflow_dispatch` only).
2. Expect both steps green: api health URL returns 200 + `"status":"ok"`; web `/` returns 200.
3. Or curl locally:

```bash
curl -sS https://api-production-fb747925.up.railway.app/v1/health
# {"status":"ok"}
curl -sS -o /dev/null -w '%{http_code}\n' https://wildwindow.arsalandev.studio/
# 200
```

**Why smoke is not on `push` to `main`:** if Wait for CI is enabled, a push-triggered smoke that waits for Railway while Railway waits for that workflow would deadlock. Manual dispatch (or a laptop curl) is the dry-run.

### Staging vs production

| Lane        | Host                                                                 | Gate                               |
| ----------- | -------------------------------------------------------------------- | ---------------------------------- |
| Production  | This Railway project (api + web + worker + migrate + cron)           | Merge to `main` + CI + Wait for CI |
| Staging     | **Not patterned** — no second Railway environment in this repo yet   | —                                  |
| AWS (later) | T9.4b: build/push images → migrate → staging; manual approval → prod | OIDC to AWS; no long-lived keys    |

---

## Image layout notes (runtime crashes we already fixed)

- **`api`:** CORS is off unless `WEB_ORIGIN` is set. When set, Nest `enableCors` allows that origin (trailing-slash tolerant) with `credentials: true`. Direct curls to `/v1/health` need no CORS header; browser fetches from `web` do.
- **`web`:** Monorepo root `package.json` has `"type":"module"`. Next standalone `server.js` is CommonJS. The web Dockerfile writes `apps/web/package.json` with `"type":"commonjs"` next to `server.js` so Node does not inherit root ESM. It also sets `HOSTNAME=0.0.0.0` (Railway’s container hostname otherwise makes Next bind only there and fail the `/` healthcheck). `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_FIREBASE_CONFIG` are declared as build `ARG`/`ENV` **before** `next build` so Railway Variables present at image build are inlined. Healthcheck remains `/`; user remains non-root `ww`. The waitlist form calls `NEXT_PUBLIC_API_URL` from the browser — rebuild after changing it.
- **`worker`:** The CLI is **bundled with tsup** (`noExternal: /^@wildwindow\//`; `commander` stays external). The runner copies `apps/worker/dist` + root `node_modules` + **`apps/worker/node_modules/commander`** + `data/` — not `packages/*/dist`. That avoids (1) the nested resolve crash where `@wildwindow/db` loaded but `packages/db/dist` could not find `@wildwindow/geoprivacy`, and (2) resolving root-hoisted `commander@2` (from vitest/terser) which lacks `requiredOption` (worker pins commander `^13.1.0` / ≥9; do not bundle commander into the ESM CLI — it breaks Node builtins). Default CMD stays `hello` (no GBIF). **Restart policy: Never** for the hello smoke — see §D step 5.

---

## Shared references between Railway services

Example (names must match your service names):

```text
# on api
DATABASE_URL_API=postgresql://ww_api:<WW_API_DB_PASSWORD>@${{PostGIS.RAILWAY_PRIVATE_DOMAIN}}:5432/${{PostGIS.POSTGRES_DB}}

# on worker
DATABASE_URL_WORKER=postgresql://ww_worker:<WW_WORKER_DB_PASSWORD>@${{PostGIS.RAILWAY_PRIVATE_DOMAIN}}:5432/${{PostGIS.POSTGRES_DB}}
```

Prefer constructing these in the Variables UI (secret values) rather than committing them. Railway [variable references](https://docs.railway.com/guides/variables) can pull host/db name from the PostGIS service; **passwords for `ww_*` roles are yours**, not the plugin’s `POSTGRES_PASSWORD`.

---

## Out of scope / do not do yet

- Creating Railway cron services from an agent (Arsalan applies §F in the dashboard).
- Flipping Wait for CI / Autodeploy from an agent (Arsalan applies §G).
- Committing `.env`, tokens, or service-account JSON.
- Weakening geoprivacy / giving `ww_api` access to `raw`.
- AWS CDK / OIDC CD cutover (T9.3b / T9.4b) — Railway is production; CDK remains optional.
- A push-to-`main` GitHub smoke that waits on Railway while Wait for CI is on (deadlock).

---

## Local vs Railway

| Concern        | Local                         | Railway                                                                      |
| -------------- | ----------------------------- | ---------------------------------------------------------------------------- |
| PostGIS        | `pnpm db:up` (`18-3.7`)       | PostGIS template `18-3.7`                                                    |
| Migrate / seed | `pnpm db:migrate` / `db:seed` | `migrate` service one-off + **migrate-on-deploy** when `packages/db` changes |
| API / web      | `pnpm --filter …`             | Dockerfile services; Autodeploy from `main` + Wait for CI (T9.4)             |
| Worker         | `pnpm worker <cmd>`           | Hello smoke + cron services (`purge-deleted`, `ingest:pipeline`)             |
| CD smoke       | curl health URLs              | Actions → **Railway CD smoke** (`workflow_dispatch`)                         |

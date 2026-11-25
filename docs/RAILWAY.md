# Railway deploy (beta / pre–Milestone H)

WildWindow’s **preferred cloud host** before AWS CDK (Phase 9) is **Railway**: PostGIS + `api` + `web` + `worker`. Prefer this over Mac Docker Desktop (battery). Secrets live only in **Railway Variables** (and local `.env`) — never in git or chat.

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

| Service   | Dockerfile                | Role                                                                              |
| --------- | ------------------------- | --------------------------------------------------------------------------------- |
| `api`     | `apps/api/Dockerfile`     | NestJS `/v1` (health: `/v1/health`)                                               |
| `web`     | `apps/web/Dockerfile`     | Next.js App Router                                                                |
| `worker`  | `apps/worker/Dockerfile`  | CLI; default `hello` smoke (no live GBIF)                                         |
| `migrate` | `apps/migrate/Dockerfile` | One-off: migrations + optional seed (compiled `node …/dist/migrate.js`, not pnpm) |

### D. First migrate, then smoke

1. Paste variables per the checklist below (especially DB + role passwords on `migrate`).
2. Deploy **`migrate` once** (restart policy **never**). Set `RUN_SEED=1` on that run if you want seeds.
3. Deploy `api` → open `https://<api-domain>/v1/health` → expect `{ "status": "ok" }` (DB check may arrive in a later task; today health is liveness).
4. Deploy `web` → open the public URL → landing page.
5. Deploy `worker` → logs should show the `hello` / `ok` smoke (no GBIF).

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

| Variable                        | Kind       | `migrate`        | `api`                    | `web` | `worker` | Notes                                                                                                                                                                                                                                            |
| ------------------------------- | ---------- | ---------------- | ------------------------ | ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                      | Public     | R (`production`) | R                        | R     | R        |                                                                                                                                                                                                                                                  |
| `PORT`                          | Public     | —                | **R\*** (`3001`)         | O     | —        | \*Api listens on `PORT` (Dockerfile `EXPOSE 3001`, code default `3001`). If the Railway domain / proxy targets **3001**, set `PORT=3001` on `api` — Railway’s injected `PORT` can differ. Web uses whatever Railway injects (Next reads `PORT`). |
| `HOSTNAME`                      | Public     | —                | —                        | —†    | —        | †Do **not** set on `web` in Railway Variables. The web Dockerfile sets `HOSTNAME=0.0.0.0` so Next listens on all interfaces; Railway’s default container hostname breaks the `/` healthcheck.                                                    |
| `DATABASE_URL`                  | **Secret** | **R** (owner)    | —                        | —     | O*       | Owner/migrations only on migrate. *Worker may fall back to it in code; prefer `DATABASE_URL_WORKER`.                                                                                                                                             |
| `DATABASE_URL_API`              | **Secret** | —                | **R** (when API uses DB) | —     | —        | `ww_api` URL                                                                                                                                                                                                                                     |
| `DATABASE_URL_WORKER`           | **Secret** | —                | —                        | —     | **R**    | `ww_worker` URL                                                                                                                                                                                                                                  |
| `WW_API_DB_PASSWORD`            | **Secret** | **R**            | —                        | —     | —        | Used only while applying roles                                                                                                                                                                                                                   |
| `WW_WORKER_DB_PASSWORD`         | **Secret** | **R**            | —                        | —     | —        | Used only while applying roles                                                                                                                                                                                                                   |
| `RUN_SEED`                      | Public     | O (`1` to seed)  | —                        | —     | —        | Migrate image only                                                                                                                                                                                                                               |
| `GBIF_USER`                     | **Secret** | —                | —                        | —     | O        | **Do not set until T3.9**                                                                                                                                                                                                                        |
| `GBIF_PASSWORD`                 | **Secret** | —                | —                        | —     | O        | **Do not set until T3.9**                                                                                                                                                                                                                        |
| `GBIF_EMAIL`                    | Public     | —                | —                        | —     | O        | **Do not set until T3.9**                                                                                                                                                                                                                        |
| `GBIF_ENABLED`                  | Public     | —                | —                        | —     | O        | Keep unset/`false` until T3.9                                                                                                                                                                                                                    |
| `INAT_DIRECT_ENABLED`           | Public     | —                | O                        | —     | O        | MVP: leave unset/false                                                                                                                                                                                                                           |
| `EBIRD_ENABLED`                 | Public     | —                | O                        | —     | O        | Must stay off without written permission                                                                                                                                                                                                         |
| `EBIRD_PERMISSION_REF`          | Public     | —                | O                        | —     | O        | Required only if eBird ever enabled                                                                                                                                                                                                              |
| `WEATHER_PROVIDER`              | Public     | —                | O                        | —     | —        | Later forecast tasks                                                                                                                                                                                                                             |
| `WEATHER_USER_AGENT`            | Public     | —                | O                        | —     | —        |                                                                                                                                                                                                                                                  |
| `TIDE_PROVIDER`                 | Public     | —                | O                        | —     | —        |                                                                                                                                                                                                                                                  |
| `OBSERVER_HASH_SALT`            | **Secret** | —                | O                        | —     | O        | When logbook/ingest hashing lands                                                                                                                                                                                                                |
| `LOGBOOK_ENC_KEY`               | **Secret** | —                | O                        | —     | —        | AES key for logbook points                                                                                                                                                                                                                       |
| `FIREBASE_PROJECT_ID`           | Public     | —                | O                        | O     | —        | When auth lands                                                                                                                                                                                                                                  |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | **Secret** | —                | O                        | —     | —        | API only; never to web                                                                                                                                                                                                                           |
| `STORAGE_DRIVER`                | Public     | —                | O                        | —     | O        |                                                                                                                                                                                                                                                  |
| `S3_BUCKET`                     | Public     | —                | O                        | —     | O        |                                                                                                                                                                                                                                                  |
| `CLOUDFRONT_KEY_PAIR_ID`        | Public     | —                | O                        | —     | —        |                                                                                                                                                                                                                                                  |
| `CLOUDFRONT_PRIVATE_KEY`        | **Secret** | —                | O                        | —     | —        |                                                                                                                                                                                                                                                  |
| `WATCHLIST_LIMIT_FREE`          | Public     | —                | O                        | —     | —        |                                                                                                                                                                                                                                                  |
| `API_PUBLIC_URL`                | Public     | —                | O                        | —     | —        | Public https URL of `api`                                                                                                                                                                                                                        |
| `WEB_ORIGIN`                    | Public     | —                | O                        | —     | —        | CORS / links to `web`                                                                                                                                                                                                                            |
| `EXPO_PUBLIC_API_URL`           | Public     | —                | —                        | —     | —        | Mobile only (EAS / local)                                                                                                                                                                                                                        |
| `EXPO_PUBLIC_FIREBASE_CONFIG`   | Public     | —                | —                        | —     | —        | Mobile only                                                                                                                                                                                                                                      |
| `NEXT_PUBLIC_API_URL`           | Public     | —                | —                        | O‡    | —        | Browser → API. ‡**Build-time:** Next inlines `NEXT_PUBLIC_*` at `next build`. Set on the `web` service so Railway injects it during the Docker build (Dockerfile `ARG`/`ENV` wiring). Changing it requires a rebuild, not just a redeploy.       |
| `NEXT_PUBLIC_FIREBASE_CONFIG`   | Public     | —                | —                        | O‡    | —        | Same build-time inlining as `NEXT_PUBLIC_API_URL`.                                                                                                                                                                                               |
| `SENTRY_DSN`                    | **Secret** | —                | O                        | O     | O        |                                                                                                                                                                                                                                                  |
| `POSTHOG_KEY`                   | **Secret** | —                | O                        | O     | —        |                                                                                                                                                                                                                                                  |
| `POSTHOG_HOST`                  | Public     | —                | O                        | O     | —        |                                                                                                                                                                                                                                                  |

### Minimal paste set for first smoke

**`migrate`:** `NODE_ENV`, `DATABASE_URL`, `WW_API_DB_PASSWORD`, `WW_WORKER_DB_PASSWORD`, optional `RUN_SEED=1`.

**`api`:** `NODE_ENV`, `PORT=3001` (when the public domain targets 3001), `DATABASE_URL_API` (when DB wiring exists), `API_PUBLIC_URL`, `WEB_ORIGIN`.

**`web`:** `NODE_ENV`, `NEXT_PUBLIC_API_URL` (api public URL — must be present at **build** time). Do not override `HOSTNAME`.

**`worker`:** `NODE_ENV`, `DATABASE_URL_WORKER`. Leave all `GBIF_*` unset.

---

## Image layout notes (runtime crashes we already fixed)

- **`web`:** Monorepo root `package.json` has `"type":"module"`. Next standalone `server.js` is CommonJS. The web Dockerfile writes `apps/web/package.json` with `"type":"commonjs"` next to `server.js` so Node does not inherit root ESM. It also sets `HOSTNAME=0.0.0.0` (Railway’s container hostname otherwise makes Next bind only there and fail the `/` healthcheck). `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_FIREBASE_CONFIG` are declared as build `ARG`/`ENV` so they are inlined by `next build`. Healthcheck remains `/`; user remains non-root `ww`.
- **`worker`:** The CLI is **bundled with tsup** (`noExternal: /^@wildwindow\//`). The runner copies only `apps/worker/dist` + root `node_modules` + `data/` — not `packages/*/dist` or `apps/worker/node_modules`. That avoids the nested resolve crash where `@wildwindow/db` loaded but `packages/db/dist` could not find `@wildwindow/geoprivacy`. Default CMD stays `hello` (no GBIF).

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

- Live GBIF download (`T3.9`) — needs Arsalan GBIF credentials and an explicit go-ahead.
- Committing `.env`, tokens, or service-account JSON.
- Weakening geoprivacy / giving `ww_api` access to `raw`.
- AWS CDK production cutover (Phase 9) — Railway is the interim host.

---

## Local vs Railway

| Concern        | Local                         | Railway                                |
| -------------- | ----------------------------- | -------------------------------------- |
| PostGIS        | `pnpm db:up` (`18-3.7`)       | PostGIS template `18-3.7`              |
| Migrate / seed | `pnpm db:migrate` / `db:seed` | `migrate` service one-off              |
| API / web      | `pnpm --filter …`             | Dockerfile services                    |
| Worker         | `pnpm worker <cmd>`           | Service smoke + one-off/cron overrides |

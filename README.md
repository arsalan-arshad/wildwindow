# WildWindow (working name)

> Know when wildlife shows up near you, and how to shoot it, without putting it at risk.

WildWindow is a wildlife **photo forecast** app. Pick a species and an area, and it gives you a weekly
**Window score (0–100)** built from historic sightings (season and time of day), golden hour,
weather and tides, plus camera settings and fieldcraft tips. Its **No-Pin Promise** means the app
never shows an exact location for a sensitive species.

Beta regions: **Scotland** and **Sindh (Pakistan)**.

> The name "WildWindow" is a placeholder. Check the trademark and domain before using it in public.

## Repo layout

pnpm + Turborepo monorepo (ARCHITECTURE §10):

```text
apps/          mobile (Expo), web (Next.js), api (NestJS), worker (CLI)
packages/      shared, db, geoprivacy, scoring, config
data/          species YAML, cards, boundaries
assets/        icons, favicon, banners, marketing, social, OG templates
docs/          PRD, ARCHITECTURE, TASKS
```

## Getting started

Requires **Node 22 LTS** (see `.nvmrc`), **pnpm** 9, and **Docker Desktop** for the local database.

```bash
nvm use          # or install Node 22
pnpm install
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

### Local PostGIS

Project standard is **PostgreSQL 18 + PostGIS 3.7** via `docker-compose.yml` (`postgis/postgis:18-3.7`), not a host-only Postgres install. On Apple Silicon the compose file pins `platform: linux/amd64` because that image is amd64-only.

PG 18 Docker images mount data at `/var/lib/postgresql` (not `/var/lib/postgresql/data`). This compose file uses a fresh named volume (`wildwindow_pgdata18`). After upgrading from PG 17, recreate local data:

```bash
pnpm db:down
docker volume rm wildwindow_wildwindow_pgdata 2>/dev/null || true   # old PG17 volume, if present
pnpm db:up
docker compose exec db psql -U postgres -c "SELECT version(); SELECT postgis_full_version();"
pnpm db:migrate   # PostGIS + raw/ref/pub/app schemas (T2.1); safe to re-run
pnpm db:seed
pnpm db:down
```

Default URL: `postgresql://postgres:postgres@localhost:5432/wildwindow` (see `.env.example`).

If **Postgres.app** (or another Postgres) is already listening on `5432`, stop it before `pnpm db:up`, or change the compose host mapping to e.g. `"5433:5432"` and point `DATABASE_URL*` at that port. A host Postgres without the PostGIS extension is not enough for WildWindow.

## Contributing

`main` is **protected**. Do not push commits straight to `main`.

1. Create a branch from an up-to-date `main` (or use a separate git worktree if another agent already has the primary checkout dirty).
2. Open a pull request into `main`.
3. Wait for required GitHub Actions checks to pass (see [CI](#ci) below).
4. Prefer squash merges; keep secrets, coordinates, and unlicensed data out of the diff (see [AGENTS.md](AGENTS.md)).

Direct pushes, force-pushes, and branch deletes on `main` are blocked by a repository ruleset. Stale PR reviews are dismissed when new commits are pushed.

## CI

GitHub Actions workflows live under [`.github/workflows/`](.github/workflows/).

| Workflow                                          | When it runs                                      | What it does                                                                      |
| ------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------- |
| **CI** (`.github/workflows/ci.yml`)               | Every PR and every push to `main`                 | Turborepo-aware jobs with pnpm cache + local `.turbo` cache                       |
| **EAS Build** (`.github/workflows/eas-build.yml`) | Version tags (`v*`) or **workflow_dispatch** only | Native Expo builds — not on every PR, so free EAS minutes are not burned casually |

### Required status checks

Branch protection expects these check **names** (job `name:` fields):

| Check      | Meaning                                                  |
| ---------- | -------------------------------------------------------- |
| `CI`       | Aggregate gate — green only if every job below succeeded |
| `gitleaks` | Secret scan (also required on its own)                   |

Supporting jobs (also reported on the PR, but the ruleset keys off `CI` + `gitleaks`):

- `format` — `pnpm format:check`
- `packages` — `data:validate` plus lint / typecheck / test / build for `packages/*`
- `packages` — shared packages lint / typecheck / test / build + `pnpm db:migrate` (PostGIS service)
- `api` — Nest app lint / typecheck / test / build (PostGIS service)
- `web` — Next.js lint / typecheck / test / build
- `mobile` — Expo lint / typecheck / test (`expo-doctor` is advisory / non-blocking)
- `worker` — worker CLI lint / typecheck / test / build (PostGIS service)

### EAS / mobile native builds

1. Add repository secret **`EXPO_TOKEN`** (Expo access token).
2. Add `apps/mobile/eas.json` when the mobile app is ready for EAS.
3. Run **Actions → EAS Build → Run workflow**, or push a `v*` tag.

Until those exist, the EAS workflow is expected to fail closed rather than silently skip.

## Assets pack

Brand and store imagery lives under [`assets/`](assets/). Placeholders are committed so paths are stable; replace files in place before launch (final product name TBD).

| Path                | Use                                                                  |
| ------------------- | -------------------------------------------------------------------- |
| `assets/icons/`     | App icon sources (`icon-1024.png`, `icon-512.png`, adaptive, splash) |
| `assets/favicon/`   | Web favicon + Apple touch icon                                       |
| `assets/banners/`   | App Store / Play listing banners                                     |
| `assets/marketing/` | Landing / waitlist imagery                                           |
| `assets/social/`    | Twitter/X and LinkedIn share images                                  |
| `assets/og/`        | Open Graph templates for Next `/api/og`                              |

See [`assets/README.md`](assets/README.md) for sizes and replacement notes. Do not commit secrets or raw GPS-bearing photos here.

## Planning docs

| File                                         | What it is                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [docs/PRD.md](docs/PRD.md)                   | Product requirements: problem, personas, MVP scope, user stories, screens, metrics, ethics |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, data pipeline, scoring v1, location protection, schema, API, infra                  |
| [docs/TASKS.md](docs/TASKS.md)               | Phased build tasks, each small enough for one AI agent run                                 |
| [AGENTS.md](AGENTS.md)                       | Rules and conventions for AI coding agents working in this repo                            |
| [CURSOR_PROMPT.md](CURSOR_PROMPT.md)         | Copy-paste prompts to start and continue work with a Cursor agent                          |

Start with `CURSOR_PROMPT.md`.

## Portfolio

Founder site (link out only): [arsalandev.studio](https://arsalandev.studio)

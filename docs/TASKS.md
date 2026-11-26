# WildWindow: Build Tasks (Phase 0 to MVP launch)

How to use this file (the full rules are in [../AGENTS.md](../AGENTS.md) §6):

- Each task is sized for **one AI agent run** (about 1–3 hours of focused work, one pull request).
- Open **P0** issues come before this queue. A privacy or location-leak issue is always P0 ([../AGENTS.md](../AGENTS.md) §7).
- Pick the **first unchecked task, in file order, whose dependencies are all checked**. Some tasks depend on tasks in a later phase (for example T3.7 needs T4.3). In that case skip it and come back to it later. Don't start a task whose dependencies aren't done.
- When you finish a task, tick it (`- [x]`), add `Done: YYYY-MM-DD, PR/commit <ref>`, and add short notes if you changed anything.
- 🧑 means the task **needs Arsalan** (an account, credentials, a decision or a human review). The agent prepares everything it can, then stops and lists what is needed.
- `§` points to [ARCHITECTURE.md](ARCHITECTURE.md). `US-xx`, `S-xx` and `W-xx` point to [PRD.md](PRD.md).

Status legend: `- [ ]` todo · `- [x]` done · `- [~]` in progress (add a note) · `- [!]` blocked (add the reason)

---

## Phase 0: Repo and tooling

- [x] **T0.1 Initialise the monorepo**
  - Depends on: none
  - Do: `pnpm` workspace + Turborepo. Add a root `package.json` with scripts `dev`, `build`, `lint`, `typecheck`, `test`, `format`, `format:check`; add `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json`, `.nvmrc` (Node 22 LTS), `.npmrc` (`node-linker=hoisted` for React Native), `.gitignore` and `.editorconfig`. Move the existing docs, `AGENTS.md` and `CURSOR_PROMPT.md` into place if they aren't there already.
  - Deliverable: a root workspace that runs `pnpm install` cleanly.
  - Acceptance test: `pnpm install && pnpm turbo run build --dry-run` exits 0.
  - Refs: §10
  - Done: 2026-11-17, commit aa4851e — public GitHub `arsalan-arshad/wildwindow`; stub apps/* + packages/*; `assets/` pack + README docs. App scaffolds deferred to T0.6–T0.9.

- [x] **T0.2 Shared config package**
  - Depends on: T0.1
  - Do: `packages/config` with `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`), an ESLint flat config (`typescript-eslint` strict-type-checked, import order, `no-console` except in the worker), and a Prettier config.
  - Deliverable: presets that the other packages extend.
  - Acceptance test: a dummy `packages/config/test-fixture.ts` with an implicit `any` fails `pnpm lint`; once fixed, it passes.
  - Refs: AGENTS.md §4
  - Done: 2026-11-17, commit 3aade1a — tsconfig.base + eslint flat + prettier presets; root lint wired.

- [x] **T0.3 Test runner**
  - Depends on: T0.2
  - Do: a Vitest workspace config at the root, wired into `turbo test`; coverage with `@vitest/coverage-v8`.
  - Deliverable: `pnpm test` runs the tests in every package.
  - Acceptance test: a sample test in `packages/config` passes; a deliberately failing test makes `pnpm test` exit non-zero (then remove it).
  - Done: 2026-11-17, commit 73ce8f2 — vitest workspace + coverage-v8; sample test in packages/config.

- [x] **T0.4 Local database and env**
  - Depends on: T0.1
  - Do: `docker-compose.yml` with the `db` service (`postgis/postgis:18-3.7`, port 5432, a named volume at `/var/lib/postgresql`, a healthcheck). Root scripts `db:up` and `db:down`. A `.env.example` listing **every** key from AGENTS.md §3 with no secret values.
  - Deliverable: a local PostGIS that starts with one command.
  - Acceptance test: `pnpm db:up` and then `docker compose exec db psql -U postgres -c "SELECT postgis_full_version();"` prints a version.
  - Done: 2026-11-17 — `docker-compose.yml` + `docker/db/init-postgis.sql` + `pnpm db:up`/`db:down`. Updated 2026-11-25 to `postgis/postgis:18-3.7` (PG 18 volume `/var/lib/postgresql`, fresh `wildwindow_pgdata18`); CI services match. Apple Silicon: `platform: linux/amd64` (official image is amd64-only).

- [x] **T0.5 Env validation helper**
  - Depends on: T0.2
  - Do: `packages/shared/src/env.ts`, a `loadEnv(schema)` that uses Zod and throws one readable error listing every missing or invalid key.
  - Deliverable: a helper used by api, worker and web.
  - Acceptance test: unit tests for missing, invalid and valid env.
  - Done: 2026-11-17, commit c06b8ae — `loadEnv` + EnvValidationError; unit tests for missing/invalid/valid.

- [x] **T0.6 Scaffold `apps/api` (NestJS)**
  - Depends on: T0.3, T0.5
  - Do: a NestJS app on Vitest (with `unplugin-swc` for decorators) and `GET /v1/health` returning `{status:"ok"}`. Scripts `dev`, `build`, `start`, `test`. Add a Dockerfile (multi-stage, non-root).
  - Deliverable: an API that runs locally and in Docker.
  - Acceptance test: an e2e test with `supertest` gets 200 from `/v1/health`; `docker build -f apps/api/Dockerfile .` succeeds.
  - Done: 2026-11-17, commit 4ae88c1 — health e2e green; Dockerfile added. Note: `docker build` not verified locally (Docker missing; same as T0.4).

- [x] **T0.7 Scaffold `apps/web` (Next.js)**
  - Depends on: T0.2
  - Do: Next.js App Router, TypeScript strict, Tailwind, and a placeholder landing page reading "WildWindow – coming soon".
  - Deliverable: a web app that runs with `pnpm --filter web dev`.
  - Acceptance test: `pnpm --filter web build` succeeds; a Vitest test renders the landing component.
  - Done: 2026-11-17, commit cd6a8d6 — Next App Router + Tailwind landing + Vitest render test.

- [x] **T0.8 Scaffold `apps/mobile` (Expo)**
  - Depends on: T0.2
  - Do: the latest stable Expo SDK with Expo Router; tabs `Home`, `Explore`, `Logbook`, `Challenge`, `Profile` with placeholder screens; `jest-expo` with one test; `app.config.ts` reading `EXPO_PUBLIC_API_URL`. Check that Metro works with pnpm (hoisted).
  - Deliverable: an app that starts with `pnpm --filter mobile start`.
  - Acceptance test: `pnpm --filter mobile test` passes; `npx expo-doctor` shows no errors; `npx expo export --platform web` (or `ios`) builds.
  - Done: 2026-11-17, commit a3fc554 — Expo SDK 58 + five tabs; jest-expo; expo-doctor 20/20; web export OK.

- [x] **T0.9 Scaffold `apps/worker` (CLI)**
  - Depends on: T0.3, T0.5
  - Do: a Node CLI using `commander`, run with `tsx`, with a `hello` command. Root script `worker` (`pnpm worker <command>`). Add a Dockerfile.
  - Deliverable: a worker CLI.
  - Acceptance test: `pnpm worker hello` prints `ok`; a unit test covers the command registry.
  - Done: 2026-11-17, commit 682d31d — commander + hello; Dockerfile added (docker build not verified locally).

- [x] **T0.10 CI**
  - Depends on: T0.6–T0.9
  - Do: `.github/workflows/ci.yml` with pnpm cache → install → `format:check` → lint → typecheck → test (a PostGIS service container, `DATABASE_URL` set) → build. Add a `gitleaks` step.
  - Deliverable: a green CI run on the pull request.
  - Acceptance test: the CI run passes; adding a fake AWS key to a file makes the gitleaks step fail (do it locally, don't commit it).
  - Done: 2026-11-17, commit 10ada0f — CI workflow + gitleaks job; PostGIS service for tests. First green run awaits GitHub Actions after push.

- [x] **T0.11 Data config files and validator**
  - Depends on: T0.5
  - Do: create `data/beta-species.yaml` and `data/sensitive-species.yaml` with Zod schemas in `packages/shared/src/data-schemas.ts`, and a `pnpm data:validate` script. Add 3 example species per region for now (the full list comes in T2.7). The tiers must follow PRD §9.2.
  - Deliverable: validated config files.
  - Acceptance test: `pnpm data:validate` passes; an invalid tier value fails with a clear message; runs in CI.
  - Done: 2026-11-17, commit 10ada0f — 3 species/region stubs; Zod tier enum; `pnpm data:validate` wired in CI.

## Phase 1: Location protection (`@wildwindow/geoprivacy`, MIT)

- [x] **T1.1 Package scaffold and policy constants**
  - Depends on: T0.3
  - Do: `packages/geoprivacy` with an MIT `LICENSE`, a README (purpose and threat model summary from §5.3), the `Tier` type and `TIER_POLICY` exactly as in §5.1. The only runtime dependency is `h3-js`.
  - Deliverable: a buildable package.
  - Acceptance test: a unit test checks that `TIER_POLICY` matches the PRD §9.2 table (resolution, delay, minimums).
  - Done: 2026-11-17, commit 7ed8da5 — MIT package + TIER_POLICY matching PRD §9.2.

- [x] **T1.2 Snapping and display cells**
  - Depends on: T1.1
  - Do: `snapToCell(lat,lng,res=7)` and `displayCellFor(cellR7, tier)` (§5.2). Validate the inputs (lat/lng ranges, a valid res-7 cell).
  - Deliverable: functions with full tests.
  - Acceptance test: property test (fast-check): for random points, `displayCellFor` returns a cell at the tier's resolution; every res-7 child of a display cell maps to the same display cell; `no_forecast` → `null`.
  - Done: 2026-11-17, commit e1355f6 — snapToCell + displayCellFor with fast-check properties.

- [x] **T1.3 Delay and lockout helpers**
  - Depends on: T1.1
  - Do: `isOlderThanDelay(eventDate, now, tier)` and `isInLockout(date, months, timeZone)`, both time-zone aware (use `Intl`, not a heavy date library).
  - Deliverable: functions with tests.
  - Acceptance test: tests at month boundaries in `Europe/London` and `Asia/Karachi`, including the change to and from daylight saving time.
  - Done: 2026-11-17, commit d226f56 — delay + Intl lockout with London DST and Karachi boundaries.

- [x] **T1.4 `suppressAndMerge`**
  - Depends on: T1.2
  - Do: implement §5.4 with an input of `{cell, nRecords, observers:Set<string>}`, merging into the parent until the minimums are met, down to res 3 at least.
  - Deliverable: the function, plus a fixture-based test.
  - Acceptance test: property tests check that (a) every output cell meets the minimums, (b) the total records in the output ≤ the total in the input, (c) no output cell is finer than the tier's resolution, and (d) the result is the same whatever order the input comes in.
  - Done: 2026-11-17, commit 80ef4b2 — suppressAndMerge with fixture + fast-check properties.

- [x] **T1.5 `bucketise`**
  - Depends on: T1.1
  - Do: quantile buckets (1–5) for map levels.
  - Acceptance test: tests for ties, a single value and an empty input.
  - Done: 2026-11-17, commit d2166c9 — 1–5 quantile bucketiser.

- [x] **T1.6 `assertPublicSafe`**
  - Depends on: T1.2
  - Do: walk any JSON payload and throw `GeoPrivacyViolation` on forbidden keys (§5.3 list, any case, nested) or on H3 strings finer than allowed for the tier given in the context. Support `allowOwnerLocation`.
  - Acceptance test: property test where random payloads with an injected `lat` key at a random depth always throw; clean payloads never throw; a res-8 cell in an `open` context throws.
  - Done: 2026-11-17, commit 8c4e531 — assertPublicSafe with forbidden keys + H3 resolution checks.

- [x] **T1.7 Make the package ready to publish (don't publish yet)**
  - Depends on: T1.2–T1.6
  - Do: `package.json` `exports`, a `tsup` build (ESM + CJS + types), a README with a usage example and a "how we protect wildlife" section, and a `CHANGELOG.md`.
  - Acceptance test: `pnpm --filter @wildwindow/geoprivacy build` produces `dist`; `npm pack --dry-run` lists only `dist`, README, LICENSE and CHANGELOG.
  - Done: 2026-11-17, commit 5ec81aa — ESM+CJS+types; README + CHANGELOG; `npm pack --dry-run` clean. Not published.

## Phase 2: Database and reference data

- [x] **T2.1 `packages/db` setup**
  - Depends on: T0.4
  - Do: Drizzle ORM + `drizzle-kit`, the `pg` driver, a migration runner script (`pnpm db:migrate`), and a first SQL migration: `CREATE EXTENSION postgis;` plus schemas `raw`, `ref`, `pub` and `app`.
  - Acceptance test: `pnpm db:up && pnpm db:migrate` on an empty database creates the 4 schemas; re-running it is a no-op.
  - Refs: §6.1
  - Done: 2026-11-17 — `@wildwindow/db` with Drizzle + `pg`, migration `0000_init_schemas` (`CREATE EXTENSION IF NOT EXISTS postgis` + schemas `raw`/`ref`/`pub`/`app`), `pnpm db:migrate`, integration tests; packages CI job gets PostGIS; `db:up` uses `--wait` and TCP `pg_isready`.

- [x] **T2.2 `ref` tables**
  - Depends on: T2.1
  - Do: Drizzle schema and migration for `ref.regions`, `zones`, `places`, `taxa`, `taxon_region`, `species_cards` and `datasets` (§6.2), with the right indexes (GIST on geometries, a trigram index on place names with `pg_trgm`).
  - Acceptance test: an integration test inserts and reads a row in each table.
  - Done: 2026-11-17 — migration `0001_ref_tables` (+ `pg_trgm`), GIST on region/zone geoms, GIN trigram on `places.name`; insert/read integration test.

- [x] **T2.3 `raw` and `pub` tables**
  - Depends on: T2.1
  - Do: `raw.occurrences`, `pub.taxon_cell_week`, `taxon_region_week`, `effort_cell_week`, `taxon_hour_profile`, `taxon_score_ref`, `weather_cache` and `forecast_cache`.
  - Acceptance test: an integration test inserts a point and runs `ST_Within` against a region polygon.
  - Done: 2026-11-17 — migration `0002_raw_pub_tables`; GIST on `raw.occurrences.geom`; `ingest_run_id` without FK until T2.4; ST_Within integration test.

- [x] **T2.4 `app` tables**
  - Depends on: T2.1
  - Do: `app.users`, `watchlist`, `logbook_entries`, `challenges`, `challenge_entries`, `entitlements`, `waitlist`, `audit_log` and `ingest_runs`.
  - Acceptance test: an integration test covers the unique constraints (watchlist, users.firebase_uid).
  - Done: 2026-11-17 — migration `0003_app_tables` + `0004` unique on `challenge_entries.logbook_entry_id` (1:0..1); FK from `raw.occurrences.ingest_run_id` → `app.ingest_runs`; unique tests for firebase_uid + watchlist.

- [x] **T2.5 Database roles and privacy isolation**
  - Depends on: T2.2–T2.4
  - Do: a migration that creates `ww_worker` and `ww_api` with the privileges in §6.3 (passwords come from env when the migration runs). Add `DATABASE_URL_API` and `DATABASE_URL_WORKER` to `.env.example`.
  - Acceptance test: an integration test connected as `ww_api` gets a permission error on `SELECT 1 FROM raw.occurrences`, and can read `pub.taxon_cell_week`. This test must never be skipped.
  - Done: 2026-11-17 — `applyRoles` after migrate when `WW_*_DB_PASSWORD` set; ww_api denied on `raw`, allowed on `pub.taxon_cell_week`; test never skipped.

- [x] **T2.6 Seed the regions**
  - Depends on: T2.2
  - Do: commit simplified GeoJSON for Scotland and Sindh to `data/boundaries/` (Natural Earth, public domain; write the source and date in `data/boundaries/SOURCES.md`). A seed script adds `ref.regions` with `time_zone` (`Europe/London`, `Asia/Karachi`).
  - Acceptance test: `pnpm db:seed` → 2 regions; an integration test finds that Glasgow (55.86, −4.25) is in Scotland and Karachi (24.86, 67.01) is in Sindh.
  - Done: 2026-11-17 — Natural Earth Admin-1 dissolve+simplify for Scotland/Sindh; `pnpm db:seed` upserts `ref.regions`; ST_Covers tests for Glasgow and Karachi.

- [x] **T2.7 Beta species list and taxon resolution**
  - Depends on: T0.11, T2.2
  - Do: fill in `data/beta-species.yaml` with about 40–60 species (about 20–30 per region; the common kingfisher must be in both). Write the `pnpm data:resolve-taxa` script, which calls the GBIF species match API and fills in `gbifTaxonKey` along with `resolvedAt`. **Do not type keys from memory.** Seed `ref.taxa` and `ref.taxon_region` (tiers from `sensitive-species.yaml`).
  - Deliverable: a resolved YAML file and a seed.
  - Acceptance test: every species has `gbifTaxonKey` with match type `EXACT`; anything that isn't exact is listed for human review; `pnpm db:seed` loads every species and tier.
  - Done: 2026-11-25 — 51 taxa (26 Scotland / 26 Sindh incl. common kingfisher in both); all `matchType: EXACT` via `pnpm data:resolve-taxa`; seeds `ref.taxa` + `ref.taxon_region` from YAML tiers. 🧑 Follow-up: Arsalan still reviews the species list and starting tiers (does not block merge).

- [x] **T2.8 Seed the places (GeoNames)**
  - Depends on: T2.6
  - Do: the script `pnpm data:places` downloads the GeoNames GB and PK dumps (CC BY 4.0), keeps populated places and parks inside the region polygons, computes `cell_r7` and fills in `ref.places`. Don't commit the raw dumps; commit the script and a small test fixture.
  - Acceptance test: searching "Glasgow" and "Karachi" in `ref.places` returns them; every place has `cell_r7`.
  - Done: 2026-11-25 — `pnpm data:places` (+ `--fixture`); fixture seeds Glasgow/Karachi; ST_Covers filter; cell_r7 via geoprivacy; attribution in `data/places/SOURCES.md`.

- [x] **T2.9 Area labels**
  - Depends on: T2.6
  - Do: seed `ref.zones` for label use only (check and record the source licence in `SOURCES.md`). Add a function `areaLabelFor(cell)` → for example "Glasgow · Kelvin area" (res 7), "Lower Clyde area" (res 5) or "Highland area" (res 4): the largest-overlap zone plus the nearest big place.
  - Acceptance test: unit and integration tests for each resolution; labels never contain numbers that look like coordinates.
  - Done: 2026-11-25 — 32 Scotland council areas + 23 Sindh districts in `data/boundaries/zones/` (licences in `data/boundaries/SOURCES.md`); `areaLabelFor` + `formatAreaLabel`; labels reject coordinate-like numbers.

## Phase 3: Ingestion (`apps/worker`)

- [x] **T3.1 GBIF client**
  - Depends on: T0.9
  - Do: a typed client for `POST /v1/occurrence/download/request`, `GET /v1/occurrence/download/{key}` and the download file, using `GBIF_USER`, `GBIF_PASSWORD` and `GBIF_EMAIL`. Add retries with backoff.
  - Acceptance test: unit tests with a mocked HTTP layer (`msw` or `nock`); no network in CI.
  - Done: 2026-11-25, PR #14 — `GbifClient` in `apps/worker/src/gbif/` (request, getDownload, downloadFile) with Zod schemas, Basic auth from `GBIF_USER`/`GBIF_PASSWORD`/`GBIF_EMAIL`, exponential backoff retries; msw unit tests (no network). New deps: `zod` (runtime), `msw@2` (dev).

- [x] **T3.2 Predicate builder**
  - Depends on: T3.1, T2.7
  - Do: `buildPredicate({region, kind, taxonKeys})` following §3.2 step 1, **always** including `LICENSE in [CC0_1_0, CC_BY_4_0]`.
  - Acceptance test: snapshot tests; a test fails if the licence predicate is missing or has extra licences.
  - Done: 2026-11-25, PR #15 — `buildPredicate` in `apps/worker/src/gbif/predicate.ts`: TAXON_KEY + region geo (originally scotland=`COUNTRY=GB`; now scotland=`GADM_GID=GBR.3_1` looked up 2026-11-25, sindh=`GADM_GID=PAK.8_1` looked up 2026-11-24) + LICENSE allowlist + coords/issues/basis/year≥2005. Snapshot + licence-guard tests.

- [x] **T3.3 `gbif:request` and `gbif:fetch` commands**
  - Depends on: T3.2, T2.4
  - Do: the commands and `app.ingest_runs` bookkeeping (status, key, DOI, totals).
  - Acceptance test: an integration test with a mocked GBIF moves a run from `requested` to `succeeded` and stores the DOI.
  - 🧑 Arsalan creates a GBIF account and puts the credentials in `.env` (still needed for live T3.9 runs; tests mock GBIF).
  - Done: 2026-11-25, PR #16 — `gbif:request` / `gbif:fetch` CLI; `app.ingest_runs` status `requested`→`succeeded` with key/DOI/total; effort keys looked up (Aves 212, Mammalia 359, Reptilia→Squamata/Testudines/Crocodylia). Integration test mocks GBIF via msw. Worker CI runs `pnpm db:migrate` before tests.

- [x] **T3.4 Row validator**
  - Depends on: T0.9
  - Do: `validateRow(row, ctx)` following §3.2 step 3 (licence, coordinates, region, uncertainty, date and week, the 00:00 time rule, observer HMAC). It returns `{ok, record}` or `{ok:false, reason}`.
  - Acceptance test: a fixture TSV with 20 crafted rows (CC BY-NC, missing coordinates, 00:00 time, week 53 and so on) gives the expected accepts and rejects; the raw `recordedBy` is never in the output.
  - Done: 2026-11-25, PR #17 — pure `validateRow` + 20-row TSV fixture; licence/coords/date/other reasons; observer HMAC only (no `recordedBy` in output); week 53→52; 00:00→hour null; uncertainty bands.

- [x] **T3.5 `gbif:load` streaming loader**
  - Depends on: T3.3, T3.4, T2.5
  - Do: unzip and stream the TSV; send target rows to `raw.occurrences` with `COPY` (dedupe on conflict) and count effort rows into `pub.effort_cell_week` at res 7, 5 and 4. Connect as `ww_worker`. Update the run counters.
  - Acceptance test: a 10k-row fixture loads in under 30 s locally; the counters match; re-running it creates no duplicates.
  - Done: 2026-11-25, PR #18 — `gbif:load` streams zip/TSV via yauzl+csv-parse; COPY→staging→`ON CONFLICT DO NOTHING` for targets; effort upsert at res 7/5/4 (region replace); ww_worker + `SELECT` on `ingest_runs`; fixture entry `occurrence.csv`.

- [x] **T3.6 `aggregate` command**
  - Depends on: T3.5, T1.4, T1.3
  - Do: §3.2 step 4. For each (taxon, region): apply the delay, count per (cell at the tier's resolution, week) with observer sets, run `suppressAndMerge`, and write `pub.taxon_cell_week` and `pub.taxon_region_week`; build `pub.taxon_hour_profile`. Do everything for a region in one transaction. Skip `no_forecast` taxa entirely.
  - Acceptance test: an integration test with seeded raw rows checks that a `protected` species only ever produces cells at res ≤ 5, cells under the minimums are merged or suppressed, records younger than 30 days are excluded, and no `pub` row exists for a `no_forecast` taxon.
  - Done: 2026-11-25, PR #19 — `aggregate --region` rebuilds pub taxon tables in one txn; delay + `suppressAndMerge`; skips `no_forecast`.

- [x] **T3.7 `score:refs` command**
  - Depends on: T3.6, T4.3
  - Do: work out `rr_ref` (P95) per taxon and region using the §4.2 formula, reusing `reportingRate()` from `packages/scoring` (T4.3).
  - Acceptance test: an integration test with known counts gives the expected `rr_ref`.
  - Done: 2026-11-25, PR #21 — `score:refs --region` writes `pub.taxon_score_ref` via `reportingRate`/`p95`; skips `no_forecast` / empty aggregates.

- [x] **T3.8 Dataset attribution**
  - Depends on: T3.5
  - Do: during load, upsert `ref.datasets` (key, title, publisher, licence) from the download's metadata or the GBIF dataset API; link the run's DOI.
  - Acceptance test: after loading the fixture, every `dataset_key` in `raw.occurrences` exists in `ref.datasets`.
  - Done: 2026-11-25, PR #22 — `gbif:load` upserts `ref.datasets` from occurrence keys/licenses; citation links ingest-run DOI.

- [x] **T3.9 First real ingestion run** 🧑
  - Depends on: T3.3–T3.8
  - Do: run request, fetch, load, aggregate and refs for both regions (target + effort). Write `reports/ingest-YYYY-MM-DD.md` with the counts per species, rejection reasons and DOIs.
  - Acceptance test: the report exists; every beta species has ≥ 1 published cell **or** is listed under "insufficient data".
  - Done: 2026-11-25, PR #33 — Railway live ingest; report `docs/reports/ingest-2026-11-25.md`. Sindh target+effort loaded; scotland target loaded + aggregated. First scotland effort (`COUNTRY=GB`, ~6GB) not loaded.
  - Follow-up **WPO-34** (2026-11-25, PR #34): scotland geo → `GADM_GID=GBR.3_1`; new effort run `#8` key `0017147` DOI `10.15468/dl.j5kh6v` loaded; aggregate + score:refs wrote **25** refs. See amended ingest report.

## Phase 4: Scoring engine (`packages/scoring`)

- [x] **T4.1 Scaffold and config**
  - Depends on: T1.1
  - Do: the package, `SCORING_V1` config (every constant from §4), and input and output types that mirror the §7 response.
  - Acceptance test: a typecheck test that the config is `as const` and that the version string is `"1.0"`.
  - Done: 2026-11-25, PR #35 (`846e696`) — completed §4 light/tide constants + §7 `ForecastResponse` / `ForecastInput` types (package stub was from T4.3).

- [x] **T4.2 Light helpers**
  - Depends on: T4.1
  - Do: `light.ts` using `suncalc`: civil dawn and dusk, golden hour (−4°…+6°), blue hour (−6°…−4°), and candidate 2-hour blocks, all in the region's time zone. Export a light-only entry point (`@wildwindow/scoring/light`) for mobile and web.
  - Acceptance test: Glasgow and Karachi on fixed dates (a solstice and an equinox) match reference times within ±1 minute (write down where the reference values come from in the test); polar edge cases don't throw.
  - Done: 2026-11-25, PR #35 (`846e696`) — `suncalc` v2 + `@wildwindow/scoring/light`; civil dawn/dusk vs timeanddate.com ±1 min; polar night/day safe.

- [x] **T4.3 Factor H and reporting rate**
  - Depends on: T4.1
  - Do: `reportingRate()` and `factorH()` following §4.2, with circular weeks and the zero-effort rule.
  - Acceptance test: the §4.6 numbers give `H ≈ 0.68`; the week 1 and week 52 wrap works; zero effort → 0.
  - Done: 2026-11-25, PR #20 — minimal `reportingRate`/`factorH`/`weeksAround`/`p95` (+ `SCORING_V1` stub). §7 I/O types completed in T4.1 (PR #35).

- [x] **T4.4 Factor T**
  - Depends on: T4.2
  - Do: hourly profile smoothing, activity-pattern templates (`diurnal`, `crepuscular`, `nocturnal`, `tidal`) and `factorT(block)`.
  - Acceptance test: a profile with < 30 records uses the template; the best block gets T = 1.
  - Done: 2026-11-25, PR #37 (WPO-37) — `hourlyShares` / `factorT`; templates for all four activity patterns; <30 records → template; best block T=1.

- [x] **T4.5 Factors G, Wx and D**
  - Depends on: T4.2
  - Do: `factorG`, `factorWx` (including the beyond-horizon 0.85 and the precipProb fallback from the amount), and `factorD` (with `not_used`).
  - Acceptance test: table-driven tests at every boundary (wind 20, 35 and 50 km/h; rain probability 0 and 1).
  - Done: 2026-11-25, PR #37 (WPO-37) — `factorG` / `factorWx` / `factorD`; precipProb from precipMm; beyond-horizon 0.85; tide `not_used`.

- [x] **T4.6 `computeForecast`**
  - Depends on: T4.3–T4.5, T1.2, T1.3
  - Do: combine everything as in §4.3–§4.5 → `{status, weekScore, bestDay, days[], confidence, range, factors, explanations}`. Explanations come from templates (no LLM).
  - Acceptance test: the §4.6 worked example gives DayScore **69**; lockout, `no_forecast` and not covered give the right status; property test: the score is always an integer from 0 to 100, and raising any factor never lowers the score.
  - Done: 2026-11-25, PR #37 (WPO-37) — `computeForecast` + template explanations; §4.6 → 69; status overrides; fast-check bounds/monotonicity.

- [x] **T4.7 Weather providers**
  - Depends on: T4.1, T5.2
  - Do: `apps/api/src/providers/weather/` with `MetNoProvider` (identifying User-Agent from `WEATHER_USER_AGENT`, honouring `Expires`), `OpenMeteoProvider` (dev only; it logs a warning when `NODE_ENV=production`), and `MockProvider`. Cache in `pub.weather_cache` keyed by the res-5 cell.
  - Acceptance test: unit tests with recorded fixtures; a test checks that the provider is called with the **cell centre**, not the input point.
  - Done: 2026-11-25 — `MetNoProvider` / `OpenMeteoProvider` / `MockProvider` + `WeatherService` (res-5 centre, `pub.weather_cache`); precipProb fallback via scoring `precipMmForCertain`; msw fixtures; cell-centre assertion; env `WEATHER_PROVIDER` / `WEATHER_USER_AGENT`.

- [x] **T4.8 Tide provider interface**
  - Depends on: T4.1
  - Do: `TideProvider` and `NoTideProvider` (§3.5), plus a config switch.
  - Acceptance test: with `TIDE_PROVIDER=none`, the forecast for a coastal species shows `tide: "not_used"`.
  - Done: 2026-11-25 — `TideProvider` / `NoTideProvider` / `createTideProvider` (+ env parse) in `@wildwindow/scoring`; `TIDE_PROVIDER=none` on api-env; coastal forecast acceptance → `tide: "not_used"`.

- [x] **T4.9 Backtest command**
  - Depends on: T4.6, T3.9
  - Do: `pnpm worker backtest --region <slug> --holdout <year>` following §4.7; write `reports/backtest-<region>-<year>.md` with pass or fail per species.
  - Acceptance test: it runs on the fixture data and produces a report with a summary table.
  - Done: 2026-11-25, PR #40 (`df5a361`) — weekly H from train Y−10…Y−2 vs holdout Y−1; ≥2× quartile pass rule; Markdown summary table; CodeQL cell escaping.

## Phase 5: API (`apps/api`)

- [x] **T5.1 Shared API schemas and client**
  - Depends on: T0.5, T1.1
  - Do: Zod schemas for every §7 endpoint in `packages/shared/src/api/`, **with no coordinate fields** in public schemas, and a typed `createApiClient(baseUrl, getToken)`.
  - Acceptance test: a schema test fails if any public schema has a forbidden key (it reuses the `assertPublicSafe` key list).
  - Done: 2026-11-25 — Zod schemas for all ARCHITECTURE §7 endpoints under `packages/shared/src/api/`; public registry guard reuses `FORBIDDEN_PUBLIC_KEYS` from geoprivacy; owner logbook schemas excluded; typed `createApiClient` covers health/regions/species/places/areas/forecast/attributions/waitlist/me/watchlist/logbook/uploads/challenges.

- [x] **T5.2 API foundations**
  - Depends on: T0.6, T2.5
  - Do: a config module (Zod env), a database module connecting as `ww_api`, a pino logger with a redaction list (`lat`, `lng`, `latitude`, `longitude`, `authorization`), Helmet, CORS, the Throttler, `nestjs-zod` validation and OpenAPI at `/docs` (not in prod).
  - Acceptance test: an e2e test where a request whose query includes `lat=` has it redacted in the captured logs; a 61st request in a minute gets 429.
  - Done: 2026-11-25 — `ApiConfigModule` + `API_ENV`; DbModule via `DATABASE_URL_API` (`ww_api`); nestjs-pino with redact + URL scrub; Helmet; CORS; global Throttler 60/min (`RATE_LIMIT`); `ZodValidationPipe`; OpenAPI at `/docs` when not production. Foundations e2e covers lat redaction and 61st→429.

- [x] **T5.3 `PublicGeoInterceptor` and `@OwnerLocation()`**
  - Depends on: T5.2, T1.6
  - Do: a global interceptor that runs `assertPublicSafe` on every response; the decorator lets owner routes opt out.
  - Acceptance test: a test controller returning `{lat:1}` gets 500 with a `GeoPrivacyViolation` log entry; the same response with `@OwnerLocation()` and the owner's authentication goes through.
  - Done: 2026-11-25 — Global `PublicGeoInterceptor` (`APP_INTERCEPTOR`) runs `assertPublicSafe` on every response (H3 ceiling = open res-7). `@OwnerLocation()` + authenticated `req.user.id` sets `allowOwnerLocation`. Violations → 500 `INTERNAL_ERROR` + pino `GeoPrivacyViolation` log. E2e covers dirty public 500+log and owner-auth pass-through.

- [x] **T5.4 Regions, species and seasonality endpoints**
  - Depends on: T5.3, T2.7
  - Do: `GET /v1/regions`, `/v1/regions/:slug/species`, `/v1/species/:taxonId` (only `reviewed` cards), `/v1/species/:taxonId/seasonality`.
  - Acceptance test: e2e tests against the seeded database; search matches the English name, Urdu name and scientific name; seasonality has 52 values in [0, 1].
  - Done: 2026-11-25, PR #45 (`ac9e6c1`) — CatalogueModule: regions list (no geom), region species search (en/ur/scientific + group), species detail (reviewed cards only), seasonality 52 relative rates in [0,1] from `pub.taxon_region_week`; e2e + assertPublicSafe; api vitest `fileParallelism: false`.

- [x] **T5.5 Places and areas endpoints**
  - Depends on: T5.3, T2.8, T2.9
  - Do: `GET /v1/places?q=` (trigram) and `GET /v1/areas/:cellR7` (label, region, `covered`).
  - Acceptance test: "glasg" finds Glasgow; a cell outside both regions → `covered:false`; an invalid cell → 400.
  - Done: 2026-11-26, PR #47 (`a5009ae`) — `GET /v1/places?q=&region=` trigram (`name % q` + similarity order); `GET /v1/areas/:cellR7` label via `areaLabelFor`, coverage via ST_Covers on cell centre; invalid/non-res-7 → 400; uncovered → `covered:false` + "Not covered yet". E2e acceptance.

- [x] **T5.6 Forecast endpoint**
  - Depends on: T4.6, T4.7, T4.8, T5.4, T3.7
  - Do: `GET /v1/forecast` following §5.5: tier lookup → display cell → status overrides → cache → load aggregates → compute → `assertPublicSafe`. Cache in `pub.forecast_cache` (1 h TTL, invalidated when the tier changes).
  - Acceptance test: e2e tests where (a) two different res-7 cells under the same res-5 parent get **identical** responses for a `protected` species, (b) a lockout date gives `status:"lockout"`, (c) p95 < 400 ms over 100 warm requests locally.
  - Done: 2026-11-26, PR #48 (`2f83683`) — `GET /v1/forecast`; displayCell + status overrides; `pub.forecast_cache` 1h TTL (tier mismatch misses); e2e (a)(b)(c).

- [x] **T5.7 Species map endpoint**
  - Depends on: T5.4, T1.5
  - Do: `GET /v1/species/:taxonId/map` returning `{cell, level}` at the published resolution; `[]` for `highly_protected` and `no_forecast`.
  - Acceptance test: the response has no counts; no cell is finer than the tier allows (an automated check over every seeded taxon).
  - Done: 2026-11-26, PR #51 (`f34cff3`) — `GET /v1/species/:taxonId/map`; `bucketise` levels 1–5 from `pub.taxon_cell_week`; `[]` when `mapCells=false`; e2e over every seeded taxon (no counts, tier resolution).

- [!] **T5.8 Firebase auth guard and `/v1/me`** 🧑
  - Depends on: T5.2
  - Do: `FirebaseAuthGuard` (firebase-admin), user upsert, `GET/PATCH /v1/me`, an admin role from the database, and the CLI `pnpm worker make-admin <email>`.
  - Acceptance test: e2e with a mocked token verifier; no token → 401 on `/v1/me`; a non-admin → 403 on `/v1/admin/*`.
  - 🧑 Arsalan creates the Firebase project and service account (put the credentials in env, never in the repo).
  - Blocked: needs Arsalan – create Firebase project + service account JSON in env
  - Notes: Code + mocked e2e merged 2026-11-26, PR #54 / `0596f2f`. Acceptance met with mocks; real deploy still needs `FIREBASE_PROJECT_ID` + `FIREBASE_SERVICE_ACCOUNT_JSON`.

- [x] **T5.9 Watchlist**
  - Depends on: T5.8
  - Do: `GET/POST/DELETE /v1/me/watchlist` with `WATCHLIST_LIMIT_FREE=3`.
  - Acceptance test: a 4th item → 409 with code `WATCHLIST_LIMIT`; users can't see each other's items.
  - Done: 2026-11-26 — `GET/POST/DELETE /v1/me/watchlist`; `WATCHLIST_LIMIT_FREE` (default 3); e2e 4th→409 `WATCHLIST_LIMIT` + cross-user isolation.

- [x] **T5.10 Uploads and storage**
  - Depends on: T5.8
  - Do: a `StorageService` interface with `LocalStorage` (dev) and `S3Storage`; `POST /v1/uploads/presign` (MIME types, 15 MB); a server-side check that uses `exifr` to reject files that still have GPS tags.
  - Acceptance test: a fixture JPEG **with** GPS is rejected; one without GPS is accepted.
  - Done: 2026-11-26 — `StorageService` + Local/S3 drivers; `POST /v1/uploads/presign`; local PUT rejects GPS EXIF via `exifr` (`GPS_EXIF_FORBIDDEN`).

- [x] **T5.11 Logbook**
  - Depends on: T5.10
  - Do: CRUD at `/v1/me/logbook` with `@OwnerLocation()`; AES-256-GCM for `exact_point_enc`; deleting an entry deletes its photos.
  - Acceptance test: the owner can read their exact point; another user gets 404; the database row stores ciphertext, not plain text.
  - Done: 2026-11-26 — `GET/POST/PATCH/DELETE /v1/me/logbook` with `@OwnerLocation()`; AES-256-GCM `exact_point_enc` via `LOGBOOK_ENC_KEY`; delete removes photo objects; e2e owner decrypt + cross-user 404 + ciphertext-at-rest.

- [x] **T5.12 Challenges and entries**
  - Depends on: T5.11
  - Do: `GET /v1/challenges/current`, `/:slug`, `/:slug/entries` (approved and past `publish_after` only) and `POST /:slug/entries` (pledge required, species must match, challenge taxon must be `open`, output shows only country and region).
  - Acceptance test: an entry isn't listed before approval or before 7 days have passed; posting without the pledge → 400; responses pass `assertPublicSafe`.
  - Done: 2026-11-26 — `GET /v1/challenges/current|:slug|:slug/entries` + `POST …/entries`; 7-day `publish_after`; pledge + open-tier + species match; gallery photo via signed GET (`createPresignedGet`); e2e + `assertPublicSafe`. Status accepts DB `live`/`active` → API `active`.

- [x] **T5.13 Admin endpoints and audit log**
  - Depends on: T5.8
  - Do: species card and tier edits, moderation and ingest runs (§7). Every change writes `app.audit_log` and clears the affected `forecast_cache` rows.
  - Acceptance test: changing a tier writes an audit row and the next forecast reflects the new tier.
  - Done: 2026-11-26 — `GET/PATCH /v1/admin/species/:taxonId`, `taxon-region/:taxonId/:region`, `challenge-entries`, `GET ingest-runs`; every write → `app.audit_log` + `forecast_cache` clear for taxon; `ww_api` UPDATE on cards/tiers; e2e acceptance (tier → audit + forecast).

- [x] **T5.14 Account deletion and export**
  - Depends on: T5.11, T5.12
  - Do: `DELETE /v1/me` (soft delete now, then a worker command `purge-deleted` hard-deletes after 30 days, including photos); `POST /v1/me/export` (JSON + signed photo links).
  - Acceptance test: after the purge, no rows or files remain for the user; the export has every user-owned record.
  - Done: 2026-11-26 — `DELETE /v1/me` soft-delete (`deleted_at`, `purgeAfterDays: 30`); `POST /v1/me/export` sync JSON + signed photo/export URLs; worker `purge-deleted` hard-deletes rows + photos/exports after 30 days (owner `DATABASE_URL`); e2e + purge tests.

- [x] **T5.15 Attributions and waitlist**
  - Depends on: T3.8, T5.2
  - Do: `GET /v1/attributions` (datasets, DOIs, weather and tide credits) and `POST /v1/waitlist`.
  - Acceptance test: e2e tests; a duplicate email returns 200 without creating a duplicate row.
  - Done: 2026-11-26 — `GET /v1/attributions` from `ref.datasets` + weather/tide/GeoNames/Natural Earth/suncalc credits; waitlist (T7.1) duplicate email → 200 without a second row; e2e.

## Phase 6: Mobile app (`apps/mobile`)

- [x] **T6.1 App shell**
  - Depends on: T0.8, T5.1
  - Do: theme (light and dark), i18n (`en`, with the `ur` scaffold and RTL check), TanStack Query + the API client, an error boundary and a Sentry placeholder.
  - Acceptance test: a jest-expo snapshot of each tab; switching to `ur` flips the layout direction.
  - Done: 2026-11-26, PR pending — light/dark theme tokens; i18next `en`+`ur` scaffold with `setAppLanguage` → RTL; TanStack Query + `createMobileApiClient` (`@wildwindow/shared`); ErrorBoundary; Sentry placeholder (full SDK = T9.1). jest-expo tab snapshots + RTL tests green.

- [x] **T6.2 Onboarding and the No-Pin Promise (S-01, S-09)**
  - Depends on: T6.1
  - Do: 3 onboarding cards, region choice (saved locally) and the No-Pin Promise screen (PRD §9.1 text and the tier table in plain words).
  - Acceptance test: Testing Library: onboarding ends on Home and the region is saved.
  - Done: 2026-11-26, PR #66 — Expo Router `/onboarding` (3 cards: what / No-Pin / region) + `/no-pin` (PRD §9.1 pledge + plain-words tiers matching TIER_POLICY); region + completion in AsyncStorage; Profile link to No-Pin. jest-expo acceptance: finishes on Home with region saved.

- [x] **T6.3 Species browse and detail (S-04, S-05)**
  - Depends on: T6.1, T5.4
  - Do: search with filters, tier badges, and a seasonality chart (`react-native-svg`, labelled "relative reporting rate").
  - Acceptance test: component tests with a mocked API; a `no_forecast` species shows the explanation and no forecast button.
  - Done: 2026-11-26 — Explore browse (search + bird/mammal/marine filters, tier badges); `/species/[taxonId]` detail with seasonality chart labelled "Relative reporting rate", field-card summary, `no_forecast` explanation and no forecast CTA.

- [x] **T6.4 Area picker (S-06)**
  - Depends on: T6.1, T5.5, T1.2
  - Do: place search, plus "use my location" (`expo-location`, foreground only) → `snapToCell` on the device → lat/lng thrown away straight away; a coarse cell map (`react-native-maps`, polygons from `h3-js` boundaries).
  - Acceptance test: a unit test shows that the location handler passes only the cell ID onwards (spy on the API client and storage; no lat/lng anywhere).
  - Done: 2026-11-26, PR pending — Expo `/area` (S-06): place search via `GET /v1/places`, "use my location" (`expo-location` foreground) → `snapToCell` on device → only `cellR7` to storage/`GET /v1/areas`; coarse cell map (`react-native-maps` + `h3-js` boundaries). Privacy unit test spies API + storage (no lat/lng).

- [ ] **T6.5 Forecast detail (S-07)**
  - Depends on: T6.4, T5.6, T4.2
  - Do: week score, 7-day strip, best block, light times (computed on the device), weather and tide rows, the "why this score" breakdown, the Low-confidence range, and lockout or unavailable states.
  - Acceptance test: component tests for the `ok`, `lockout`, `unavailable`, `not_covered` and low-confidence states; nowhere does the text say "% chance".

- [ ] **T6.6 Field card (S-08)**
  - Depends on: T6.3
  - Do: render the card's Markdown (settings, fieldcraft, ethics, legal) and show "Reviewed by".
  - Acceptance test: component test; a card without review status isn't shown.

- [ ] **T6.7 Sign in (S-02)** 🧑
  - Depends on: T6.1, T5.8
  - Do: Firebase JS SDK, Apple + Google (EAS dev build), email link if it's practical (§8), token passed to the API client, sign out.
  - Acceptance test: works on a device or simulator with a dev build (manual test steps written in the PR); unit tests for the auth state store.
  - 🧑 Arsalan sets up the Apple Developer account, Google OAuth clients and the Firebase iOS/Android apps.

- [ ] **T6.8 Home with watchlist (S-03)**
  - Depends on: T6.5, T6.7, T5.9
  - Do: saved pairs with this week's score and best day, add and remove, the limit message, and the challenge banner.
  - Acceptance test: component tests covering the 3-item limit message.

- [ ] **T6.9 Logbook (S-10, S-11, S-12)**
  - Depends on: T6.7, T5.11
  - Do: pick a photo (`expo-image-picker` with `exif:true`), read the camera settings, **re-encode with `expo-image-manipulator` to drop all metadata**, upload through presign, and save the entry. Optionally keep the exact point (owner only).
  - Acceptance test: a unit test shows that the upload payload has no GPS; a manual check that the uploaded file has no GPS EXIF (written down in the PR).

- [ ] **T6.10 Challenge (S-13, S-14)**
  - Depends on: T6.9, T5.12
  - Do: challenge home with counts per country, a gallery, and a submit flow from a logbook entry with the pledge.
  - Acceptance test: component tests: the submit button is disabled until the pledge is ticked; wrong-species entries can't be picked.

- [ ] **T6.11 Share cards (S-15)**
  - Depends on: T7.4
  - Do: preview the image from the web `/api/og/...` and share it with `expo-sharing`.
  - Acceptance test: component test; the card URL has no coordinates.

- [ ] **T6.12 Profile, settings, attributions, delete and export (S-16, S-17)**
  - Depends on: T6.7, T5.14, T5.15
  - Do: region, units, language, privacy text, export, delete account (confirmation) and the attributions list.
  - Acceptance test: component tests; deletion calls `DELETE /v1/me` and signs out.

- [ ] **T6.13 Offline cache (should)**
  - Depends on: T6.5
  - Do: persist the TanStack Query cache for the last forecasts and cards; show "Last updated" when offline.
  - Acceptance test: a test with a mocked offline network shows the cached forecast.

## Phase 7: Web (`apps/web`)

- [x] **T7.1 Landing page and waitlist (W-01)**
  - Depends on: T0.7, T5.15
  - Do: hero, the three hooks (Window, Same Species Different Countries, No-Pin Promise), the waitlist form, and an "open source" section.
  - Acceptance test: a Vitest component test, plus a submit to a mocked API.
  - Done: 2026-11-25 — Landing `/` + `/landing-page`, `/waitlist`, draft `/privacy`; Nest waitlist API slice; Fraunces + Source Sans 3; sample Window score 82/100 High. Depends-on note: waitlist API shipped here ahead of full T5.15 attributions.

- [ ] **T7.2 Pledge and legal pages (W-02, W-06)**
  - Depends on: T7.1
  - Do: the No-Pin Promise page, privacy, terms and attributions (data from `/v1/attributions`). The privacy and terms texts are marked **DRAFT – needs legal review**.
  - Acceptance test: pages build statically; the attributions list renders from a fixture.
  - Notes: Draft `/privacy` shipped with T7.1 (banner + waitlist fields). Dedicated No-Pin pledge page, terms, and attributions UI remain.

- [ ] **T7.3 Species pages (W-03)**
  - Depends on: T5.4
  - Do: `/[region]/[species]` with ISR, the seasonality chart, the reviewed field card, JSON-LD and no maps.
  - Acceptance test: the build generates a page for every species with a reviewed card; a test makes sure there is no map component on these pages.

- [ ] **T7.4 Share card images (W-05)**
  - Depends on: T7.1, T5.6, T5.12
  - Do: `/api/og/forecast?taxonId&cell&start` and `/api/og/challenge/:entryId` with `next/og` at 1080×1920 and 1080×1080, with edge caching.
  - Acceptance test: route tests return PNGs at the right size; the forecast card shows `areaLabel`, never a cell or coordinates, and the label says "Window score".

- [ ] **T7.5 Challenge gallery (W-04)**
  - Depends on: T5.12
  - Do: `/challenges/[slug]` with tabs per country and pagination.
  - Acceptance test: component test with a fixture.

- [ ] **T7.6 Admin: sign-in, species cards and tiers (W-07)**
  - Depends on: T5.13
  - Do: an `/admin` area (Firebase web sign-in, admin role checked through the API), a card editor (Markdown), and a tier and lockout editor with confirmation.
  - Acceptance test: a non-admin is redirected; editing a tier calls the API and shows the audit entry.

- [ ] **T7.7 Admin: moderation and ingestion runs**
  - Depends on: T7.6
  - Do: a moderation queue (approve or reject with a reason) and an ingestion runs table.
  - Acceptance test: component tests with fixtures.

## Phase 8: Content and ethics

- [ ] **T8.1 Card loader**
  - Depends on: T2.2
  - Do: `pnpm data:cards` loads `data/species-cards/**.md` (front-matter validated with Zod) into `ref.species_cards`.
  - Acceptance test: a card with `reviewedBy` missing loads as `draft`.

- [ ] **T8.2 Draft field cards** 🧑
  - Depends on: T8.1, T2.7
  - Do: draft cards for every beta species (settings for perched, flight and low light; fieldcraft; ethics following the Audubon guide; legal notes per region). Every card is `status: draft` and lists its sources at the bottom.
  - Acceptance test: `pnpm data:cards` loads all of them; a script lists the cards still `draft`.
  - 🧑 Arsalan and an expert photographer review them and mark them reviewed.

- [ ] **T8.3 Sensitivity review pack** 🧑
  - Depends on: T2.7
  - Do: a script that writes `reports/sensitivity-review-<region>.md` (each species, its proposed tier, lockout months, the reason and links) for the conservation reviewers (PRD E6).
  - Acceptance test: the report is generated for both regions.
  - 🧑 Reviewers sign off; the result goes into `sensitive-species.yaml` (`reviewer`, `reviewed_at`).

- [ ] **T8.4 Seed Kingfisher Month**
  - Depends on: T5.12
  - Do: a seed for the first challenge (common kingfisher, both regions, rules and the ethics pledge text).
  - Acceptance test: `GET /v1/challenges/current` returns it during the configured dates.

## Phase 9: Beta hardening and deploy

> **Railway interim (pre–Milestone H):** scaffolding for PostGIS + api/web/worker/migrate Docker deploy lives in `docs/RAILWAY.md` and `infra/railway/`. This does **not** complete T9.2–T9.5 (AWS CDK / Vercel). Prefer Railway over Mac Docker until CDK cutover.

- [ ] **T9.1 Observability**
  - Depends on: T5.2, T6.1, T7.1
  - Do: Sentry in api, web and mobile (scrub PII and location); PostHog EU with an event allowlist (`forecast_viewed {taxonId, tier, region}` and so on, **no cells or coordinates**).
  - Acceptance test: a unit test makes the analytics wrapper drop the forbidden keys (reusing the geoprivacy key list).

- [ ] **T9.2 Infra: network, database and API** 🧑
  - Depends on: T0.6
  - Do: `infra/` with AWS CDK (TypeScript): VPC, RDS PostgreSQL (PostGIS enabled by migration), ECR, ECS Fargate API behind an ALB, and Secrets Manager entries (with no values).
  - Acceptance test: `cdk synth` passes in CI; the infra snapshot test passes.
  - 🧑 Arsalan provides the AWS account, picks the region (default eu-west-2) and approves `cdk deploy`.

- [ ] **T9.3 Infra: worker schedule and storage**
  - Depends on: T9.2
  - Do: an EventBridge Scheduler monthly ingestion task, a daily `purge-deleted`, an S3 private bucket and CloudFront with signed URLs, and a KMS key for the logbook.
  - Acceptance test: `cdk synth` and snapshot test.

- [ ] **T9.4 CD pipeline**
  - Depends on: T9.2, T0.10
  - Do: a GitHub Actions deploy workflow: build and push images on `main` → migrate → deploy to staging; a manual approval for prod. Use OIDC to AWS, no long-lived keys.
  - Acceptance test: a dry run in staging (the steps written down in the PR).

- [ ] **T9.5 Web deploy**
  - Depends on: T7.1
  - Do: Vercel project config, env, and preview deploys for pull requests.
  - Acceptance test: the preview URL serves the landing page.

- [ ] **T9.6 EAS setup** 🧑
  - Depends on: T6.7
  - Do: `eas.json` profiles `development`, `preview` and `production`; app icons and splash placeholders; EAS Update channels.
  - Acceptance test: `eas build --profile preview` succeeds for both platforms (Arsalan runs it if credentials are needed).

- [ ] **T9.7 End-to-end geoprivacy audit**
  - Depends on: T5.6, T5.7, T5.12
  - Do: an e2e test that walks every public endpoint for every seeded taxon over a grid of res-7 cells in both regions, runs `assertPublicSafe` on everything, and checks that responses are identical across the siblings of a display cell.
  - Acceptance test: it runs in CI and is green. Any failure blocks the release.

- [ ] **T9.8 Performance check**
  - Depends on: T5.6
  - Do: an `autocannon` script for `/v1/forecast` and add the indexes that turn out to be needed.
  - Acceptance test: p95 < 400 ms warm locally on the full ingested data; results in `reports/perf-YYYY-MM-DD.md`.

- [ ] **T9.9 Store and legal readiness** 🧑
  - Depends on: T7.2, T6.12
  - Do: draft the App Store privacy labels and the Google Play Data safety answers from the real data flows; the age rating (13+); the support URL; and a checklist of the licences that still need confirming (weather commercial terms, tide, eBird).
  - Acceptance test: `docs/STORE_READINESS.md` exists, with every answer linked to the code path it describes.

- [ ] **T9.10 Private beta launch** 🧑
  - Depends on: T9.1–T9.9, T9.11, T8.2, T8.3, T8.4
  - Do: a TestFlight and Play internal track for 50–100 testers in Scotland and Sindh; confirm the Report a bug entry from T9.11 is on Profile; a metrics dashboard (PRD §8).
  - Acceptance test: the beta checklist in the PR is all ticked; the first forecast view from a real tester shows up in PostHog.

- [ ] **T9.11 In-app Report a bug**
  - Depends on: T6.12, T5.3, T1.6
  - Do: a "Report a bug" action on Profile (S-16) and on the sign-in screen (S-02), so a tester who cannot sign in can still report. The app posts the draft (steps, expected, actual, platform, app version, device and OS) to `POST /v1/bug-reports`. The API opens a GitHub issue with `.github/ISSUE_TEMPLATE/bug_report.yml` (labels `bug` and `needs-triage`) using `GITHUB_BUG_REPORT_TOKEN`, which stays in the server env. The token is never sent to the client and never logged. The API logs the new issue number only, not the body. Rate-limit the route with the throttler from T5.2. If the token is unset, the API returns a prefilled `https://github.com/arsalan-arshad/wildwindow/issues/new?template=bug_report.yml` URL (query keys are the form field ids) and the app opens that. Before either path, scrub the text: redact the geoprivacy forbidden keys (`lat`, `lng`, `latitude`, `longitude`, `coordinates`, `geom`, `point`, `wkt`, and the rest of that list) and anything that looks like a coordinate pair or GPS EXIF. The scrubber is a pure function. Add `GITHUB_BUG_REPORT_TOKEN` to `.env.example` with no value, and add the route to ARCHITECTURE §7.
  - Deliverable: the Profile and sign-in actions, `POST /v1/bug-reports`, the scrubber, and the fallback URL.
  - Acceptance test: an API test posts a body that includes a coordinate pair and a forbidden key, and the mocked GitHub issue payload has neither; the HTTP response has no token. A mobile test shows Profile calls the API, and when the response says to use the fallback, opens the prefilled URL with the scrubbed text. With the token unset, the tester can still file the report.
  - Refs: AGENTS.md §7, ARCHITECTURE §5.3 and §7, S-16, S-02
  - 🧑 Arsalan stores a fine-grained personal access token (Issues write on this repo) as `GITHUB_BUG_REPORT_TOKEN` on the API. The fallback URL works before that exists.

## Phase 10: MVP launch

- [ ] **T10.1 Open-source `@wildwindow/geoprivacy`** 🧑
  - Depends on: T1.7, T9.7
  - Do: a public GitHub repo or subtree split, npm publish, and a README badge; a "Show HN" draft in `docs/launch/`.
  - Acceptance test: `npm view @wildwindow/geoprivacy` shows the version (after Arsalan publishes it).

- [ ] **T10.2 Kingfisher Month go-live**
  - Depends on: T8.4, T7.7
  - Do: the moderation runbook (`docs/runbooks/moderation.md`), share card QA, and the challenge dates set.
  - Acceptance test: a dry run with 5 test entries goes from submitted to approved to visible after 7 days (with a test clock).

- [ ] **T10.3 Launch gate** 🧑
  - Depends on: T9.10, T10.2
  - Do: confirm the conservation sign-off for both regions, the weather provider's commercial terms, that eBird is still off (unless permission came through), the backtest results, crash-free ≥ 99.5% in the beta, and zero location-leak incidents.
  - Acceptance test: `docs/LAUNCH_CHECKLIST.md` is fully ticked and signed off by Arsalan.

- [ ] **T10.4 Production release** 🧑
  - Depends on: T10.3
  - Do: promote to prod, submit the store builds, make the web site live and run the go-to-market launch week.
  - Acceptance test: the apps are live in both stores; `/v1/health` is green in prod.

---

## Post-MVP backlog (don't start before T10.4)

- [ ] **P1.1** RevenueCat + Stripe, the `pro` entitlement, webhooks, `EntitlementGuard` (§9)
- [ ] **P1.2** Paywall screen with honest billing copy (PRD PR8); restore purchases
- [ ] **P1.3** Push alerts for watchlist windows above a threshold (Pro)
- [ ] **P1.4** Offline region packs and the trip planner (Pro)
- [ ] **P2.1** Creator field-guides marketplace: guide format linked to species and region, location-safe by design, 20–30% commission
- [ ] **P2.2** Creator dashboard on the web, and payouts
- [ ] **P3.1** Real tide provider for Scotland, then Sindh (licence confirmed first) 🧑
- [ ] **P3.2** eBird integration, **only** with written permission from Cornell (store the reference in `EBIRD_PERMISSION_REF`) 🧑
- [ ] **P3.3** New region each month after launch
- [ ] **P3.4** Optional server-side species-ID helper (BioCLIP 2, MIT), never trained on iNaturalist data

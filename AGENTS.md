# AGENTS.md: instructions for AI coding agents

You are working on **WildWindow** (working name), a wildlife **photo forecast** app. Read this file in full before you change anything. Then read the docs for your task:

- Product: [docs/PRD.md](docs/PRD.md)
- Technical source of truth: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (sections are cited as `§`)
- Work queue: [docs/TASKS.md](docs/TASKS.md)
- Railway beta host (PostGIS + api/web/worker): [docs/RAILWAY.md](docs/RAILWAY.md)

### Current status / handoff

Check open **P0** issues first (§7). A privacy or location-leak issue is always P0. Then pick the **first unchecked** task in [docs/TASKS.md](docs/TASKS.md) whose dependencies are done. After each landed task: tick that row in `docs/TASKS.md`, and if you are in the Cursor Project autopilot, also update the Project store `docs/project-context.md`. One PR per task. Name the GitHub issue in the commit and the pull request (`Fixes #123` or `Refs #123`).

## 1. Project overview

- A user picks a **species + area** and gets a weekly **Window score (0–100)**: the best days and best 2-hour block, from historic sightings (season and time of day), golden hour, weather and tides, plus camera settings and fieldcraft.
- **No-Pin Promise:** the app never exposes an exact location. Sensitive species are shown only at coarse H3 cells (or not at all) using sensitivity tiers (§5).
- Growth loop: the monthly **"Same Species, Different Countries"** challenge with shareable cards.
- Beta regions: **Scotland** and **Sindh**. Later: Pro ($4.99/month, $39.99/year) and a creator field-guides marketplace.
- Founder: Arsalan, a solo engineer. Keep solutions simple, typed and well tested.

## 2. Repo structure

```text
apps/mobile      Expo (React Native, Expo Router)    – screens S-01..S-17
apps/web         Next.js (App Router)                – public site, share cards (/api/og), admin
apps/api         NestJS REST API (/v1)               – the only thing clients talk to
apps/worker      Node CLI: GBIF ingestion, aggregation, refs, backtest
packages/shared      Zod API schemas, types, typed API client, env helper
packages/db          Drizzle schema, SQL migrations (PostGIS, roles), seeds
packages/geoprivacy  @wildwindow/geoprivacy – MIT, open source, location protection
packages/scoring     Window score v1 + light (suncalc) + provider interfaces
packages/config      tsconfig / eslint / prettier presets
data/                beta-species.yaml, sensitive-species.yaml, species-cards/, boundaries/
docs/                PRD, ARCHITECTURE, TASKS (+ reports/ for generated reports)
infra/               AWS CDK (Phase 9)
```

Dependency rules (§10): `geoprivacy` imports nothing internal. **Only `apps/worker` may touch the `raw` schema.** Mobile and web import only `shared`, `geoprivacy` (`snapToCell`) and `@wildwindow/scoring/light`.

## 3. Commands

These exist once Phase 0 is done. If one you need is missing, adding it is part of your task.

| Command                                                           | What it does                                                                                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                                    | Install everything (Node 22 LTS; see `.nvmrc`)                                                                              |
| `pnpm dev`                                                        | Run api, web and worker watchers through Turborepo                                                                          |
| `pnpm --filter mobile start`                                      | Expo dev server (sign-in needs an EAS dev build)                                                                            |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build`       | Quality gates (CI runs all of these)                                                                                        |
| `pnpm format` / `pnpm format:check`                               | Prettier                                                                                                                    |
| `pnpm db:up` / `pnpm db:down`                                     | Start or stop local PostGIS (Docker)                                                                                        |
| `pnpm db:migrate` · `pnpm db:seed`                                | Run migrations and seeds                                                                                                    |
| `pnpm data:validate`                                              | Validate the YAML config in `data/`                                                                                         |
| `pnpm data:resolve-taxa` · `pnpm data:places` · `pnpm data:cards` | Data scripts (T2.7, T2.8, T8.1)                                                                                             |
| `pnpm data:cards:check` · `pnpm data:cards:draft`                 | Parse cards without DB; list cards still `draft` (T8.2)                                                                     |
| `pnpm data:sensitivity-review`                                    | Write `reports/sensitivity-review-<region>.md` for reviewers (T8.3 / PRD E6)                                                |
| `pnpm worker <cmd>`                                               | Worker CLI: `gbif:request`, `gbif:fetch`, `gbif:load`, `aggregate`, `score:refs`, `backtest`, `purge-deleted`, `make-admin` |
| `pnpm --filter <pkg> test -- <pattern>`                           | Run one package's tests                                                                                                     |

Environment keys (put them in `.env.example` with **no values**; load them with `loadEnv` from `packages/shared`):

```text
NODE_ENV, DATABASE_URL (owner/migrations), DATABASE_URL_API, DATABASE_URL_WORKER,
WW_API_DB_PASSWORD, WW_WORKER_DB_PASSWORD,
GBIF_USER, GBIF_PASSWORD, GBIF_EMAIL, GBIF_ENABLED,
INAT_DIRECT_ENABLED, EBIRD_ENABLED, EBIRD_PERMISSION_REF,
WEATHER_PROVIDER, WEATHER_USER_AGENT, TIDE_PROVIDER,
OBSERVER_HASH_SALT, LOGBOOK_ENC_KEY,
FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON,
STORAGE_DRIVER, S3_BUCKET, CLOUDFRONT_KEY_PAIR_ID, CLOUDFRONT_PRIVATE_KEY,
WATCHLIST_LIMIT_FREE, API_PUBLIC_URL, WEB_ORIGIN, ADMIN_TOKEN, WAITLIST_EMAIL_ENABLED,
EXPO_PUBLIC_API_URL, EXPO_PUBLIC_SITE_URL, EXPO_PUBLIC_FIREBASE_CONFIG, EXPO_PUBLIC_SENTRY_DSN, EXPO_PUBLIC_POSTHOG_KEY, EXPO_PUBLIC_POSTHOG_HOST,
NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_FIREBASE_CONFIG, NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY, NEXT_PUBLIC_POSTHOG_HOST,
SENTRY_DSN, POSTHOG_KEY, POSTHOG_HOST
```

## 4. Coding conventions

- **TypeScript strict** everywhere (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). No `any`; no `@ts-ignore` (use `@ts-expect-error` with a reason only if there is no other way).
- **Validate at the edges with Zod:** env, HTTP input and output, YAML and front-matter, third-party API responses. Infer types from the schemas, and don't write the same type twice.
- **Pure core:** `geoprivacy` and `scoring` do no I/O and have no hidden clock. Pass `now` in. Network and database code lives in apps.
- **Tests are required.** Every task adds or updates tests:
  - Vitest for packages, api, worker and web; jest-expo + Testing Library for mobile.
  - Property tests (`fast-check`) for anything in `geoprivacy` and the score's bounds.
  - API integration and e2e tests run against the PostGIS container (no database mocks for SQL logic).
  - No network in tests. Mock HTTP with `msw` or `nock`, and keep fixtures under `__fixtures__/`.
- **Lint and format:** ESLint flat config (`typescript-eslint` strict-type-checked) and Prettier. CI fails on warnings in `packages/geoprivacy` and `packages/scoring`.
- **Naming:** files `kebab-case.ts`; React components `PascalCase.tsx`; database columns `snake_case`; JSON fields `camelCase`.
- **Errors:** typed error classes. API errors use `{ code, message }` with stable `code` strings (for example `WATCHLIST_LIMIT`).
- **Time:** store UTC and show it in the region's time zone (`Europe/London`, `Asia/Karachi`). Use `Intl` and avoid heavy date libraries.
- **Commits:** Conventional Commits (`feat(api): forecast endpoint (T5.6)`). Put the task ID in the commit or PR title.
- **Dependencies:** prefer well-maintained libraries with permissive licences (MIT, BSD, Apache-2.0). Explain any new runtime dependency in the PR. No GPL code in `packages/geoprivacy`.
- **Docs:** if you change behaviour described in `docs/*`, update the doc in the same PR.

## 5. Non-negotiable rules

Break any of these and the PR is rejected.

1. **Never expose exact coordinates for any species in a public output, and never for sensitive species anywhere outside the worker.**
   - Raw points live only in `raw.*`, which only the worker reads. The API connects as `ww_api`, which has no access to `raw`.
   - Public responses go through Zod schemas with no coordinate fields **and** `PublicGeoInterceptor` (`assertPublicSafe`). New geography endpoints need a geoprivacy test.
   - Use the tier resolution, delay, minimums and lockouts from `TIER_POLICY` (§5.1). Never add random jitter; snap deterministically.
   - Never weaken a tier in code. Tier changes go only through `data/sensitive-species.yaml` or the audit-logged admin API. If in doubt, use the higher tier.
   - User locations: snap to a res-7 cell **on the device** and throw lat/lng away. Never log, store or send raw user lat/lng to analytics or third parties. Weather and tide calls use cell centres.
   - Strip GPS EXIF from photos before upload, and check on the server.
2. **Respect data licences.**
   - GBIF: only `CC0_1_0` and `CC_BY_4_0` records. Filter in the predicate **and** check row by row. Keep `license` and `dataset_key` on every row and cite the download DOI.
   - eBird: **off**. Never call the eBird API unless `EBIRD_ENABLED=true` **and** `EBIRD_PERMISSION_REF` is set (written permission from Cornell).
   - iNaturalist: no direct API in the MVP. If it is ever enabled: ≤ 1 request/s, ≤ 10,000/day, and **never** use its data or images for AI or ML training.
   - Open-Meteo: development only unless a commercial plan exists. The production default is MET Norway (check its terms).
   - Don't scrape websites. Don't add a data source without a row in ARCHITECTURE §3.1 that states its licence.
   - Don't type GBIF taxon keys, licences or other facts from memory. Look them up with the API or script and record when you did.
3. **No secrets in code.** Use env vars only, keep `.env` git-ignored, keep `.env.example` without values. Never commit service account JSON, keys, tokens or real user data. CI runs gitleaks.
4. **Honest product copy.** The score is an index, so never call it a probability ("% chance"). No dark patterns in billing (no weekly plans, no hidden trials).
5. **Keep to the scope of your task.** Don't build features from PRD "Won't have" (payments, social feed, own ID model, leaderboards) unless the task asks for them.
6. **Don't do irreversible or external actions** (publishing packages, deploying to prod, sending email, creating cloud resources outside `cdk synth`). Prepare them and leave a note for Arsalan.

## 6. How to pick and finish a task (TASKS.md workflow)

1. Check open GitHub issues labelled `P0` (`gh issue list --label P0 --state open`) and fix those first (§7). Then open `docs/TASKS.md`. Pick the **first unchecked task (`- [ ]`), in file order, whose `Depends on` tasks are all `[x]`**. Skip tasks that are blocked (`[!]`) or whose dependencies aren't done.
2. Mark it `- [~]` with a note such as `In progress: <date>`.
3. Read the sections it references (`§`, `US-xx`, `S-xx`). If the docs conflict or the task is unclear, write down your assumption in the PR or task notes and choose the safer option (more privacy, a stricter licence).
4. Do **only that task**. If it is too big for one run, split it into `T<x>.<y>a`, `b` and so on in TASKS.md, finish the first part, and leave the rest unchecked.
5. Make the **Acceptance test** pass, then run `pnpm lint && pnpm typecheck && pnpm test` (at least for the packages you touched, and the whole repo if you changed shared code).
6. Update TASKS.md: `- [x]`, then `Done: YYYY-MM-DD, <commit/PR>`, and notes on any change from the plan. Update the docs if behaviour changed.
7. For 🧑 tasks: do everything you can without the human, then mark the task `- [!] Blocked: needs Arsalan – <exactly what>` and stop.
8. Finish with a short summary: what changed, how you tested it, follow-ups, and the next task ID.

### Definition of done

- The acceptance test is automated (or manual steps are written down when automation is impossible, for example device sign-in).
- Lint, typecheck and tests are green, and no new warnings appear in `geoprivacy` or `scoring`.
- No coordinates, secrets or unlicensed data were added.
- TASKS.md (and the docs, if needed) are updated.

## 7. Bugs and issues

GitHub Issues is the bug tracker. Forms live in `.github/ISSUE_TEMPLATE/` (blank issues are off). Labels are declared in `.github/labels.yml`. `.github/workflows/sync-labels.yml` creates and updates them on `main`, and you can dry-run the same sync with `node .github/scripts/sync-labels.mjs --dry-run`. The sync does not delete extra labels; `--prune` does, and only when you mean it.

1. **P0 before the task queue.** Before a task from `docs/TASKS.md`, look for open issues labelled `P0`. Fix the oldest open P0 you can reproduce before you pick up a task. If you cannot fix it in this run, say so in the handoff and do not start a lower-priority task in its place.
2. **Privacy issues are always P0.** A location leak, an exact coordinate in a public output, a pin on a sensitive species, or GPS left in a photo is `privacy` and `P0`. Do not downgrade it. File it with `.github/ISSUE_TEMPLATE/privacy_report.yml`. That form tells the reporter the issue is public and not to post exact coordinates. Describe the screen and the region in words.
3. **Reference the issue.** Commits and pull requests name the issue (`Fixes #123` when the pull request closes it, `Refs #123` when it does not). Keep the task ID as well: `feat(api): forecast endpoint (T5.6, Fixes #123)`.
4. **A bug outside the task.** When you find a bug you cannot fix inside the current task, open an issue with the bug form (`.github/ISSUE_TEMPLATE/bug_report.yml`): steps to reproduce, expected behaviour, actual behaviour, platform (`iOS`, `Android`, `web`, or `api`), app version, device and OS, and severity (`P0`, `P1`, or `P2`). Use `gh issue create --template bug_report.yml` when you have permission. If you cannot open the issue, paste those same fields in the pull request. Leave coordinates, map pins, GPS EXIF, and raw lat/lng out of the issue and the pull request. Labels: `bug`, `needs-triage`, the platform (`mobile` for iOS and Android, otherwise `web` or `api`), and the severity.
5. **In-app reports.** The beta entry point that files an issue without putting a token on the device is T9.11. Until that lands, open the issue yourself.

The form applies `bug`, `feature`, or `privacy`, plus `needs-triage`. The privacy form also applies `P0`. `.github/workflows/issue-labels.yml` adds the platform and severity from the form body. It only adds labels, and it does not print the body.

| Label | When                                                                   |
| ----- | ---------------------------------------------------------------------- |
| `P0`  | Crash, data loss, the beta is blocked, or any privacy or location leak |
| `P1`  | A major function is broken and a workaround may exist                  |
| `P2`  | Minor, cosmetic, or a rough edge                                       |

`needs-triage` stays until someone has confirmed the severity and the platform.

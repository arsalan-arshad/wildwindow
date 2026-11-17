# WildWindow: Build Tasks (Phase 0 to MVP launch)

How to use this file (the full rules are in [../AGENTS.md](../AGENTS.md) §6):

- Each task is sized for **one AI agent run** (about 1–3 hours of focused work, one pull request).
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
  - Do: `docker-compose.yml` with the `db` service (`postgis/postgis:17-3.5`, port 5432, a named volume, a healthcheck). Root scripts `db:up` and `db:down`. A `.env.example` listing **every** key from AGENTS.md §3 with no secret values.
  - Deliverable: a local PostGIS that starts with one command.
  - Acceptance test: `pnpm db:up` and then `docker compose exec db psql -U postgres -c "SELECT postgis_full_version();"` prints a version.
  - Done: 2026-11-17 — `docker-compose.yml` + `docker/db/init-postgis.sql` + `pnpm db:up`/`db:down`; acceptance printed PostGIS 3.5.2 on PG 17.5. Kept project image `17-3.5` (ARCHITECTURE §2); host Postgres.app 18 has no PostGIS and is not a substitute — free 5432 or remap. Apple Silicon: `platform: linux/amd64` (official image is amd64-only).

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

- [x] **T0.9 Scaffold `apps/worke
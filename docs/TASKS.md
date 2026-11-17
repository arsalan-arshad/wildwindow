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

- [x] **T2.7 Beta species list and taxon resolution**
  - Depends on: T0.11, T2.2
  - Do: fill in `data/beta-species.yaml` with about 40–60 species (about 20–30 per region; the common kingfisher must be in both). Write the `pnpm data:resolve-taxa` script, which calls the GBIF species match API and fills in `gbifTaxonKey` along with `resolvedAt`. **Do not type keys from memory.** Seed `ref.taxa` and `ref.taxon_region` (tiers from `sensitive-species.yaml`).
  - Deliverable: a resolved YAML file and a seed.
  - Acceptance test: every species has `gbifTaxonKey` with match type `EXACT`; anything that isn't exact is listed for human review; `pnpm db:seed` loads every species and tier.
  - 🧑 Arsalan checks the species list and the starting tiers.
  - Done: 2026-11-17 — 51 taxa (kingfisher in both regions); `pnpm data:resolve-taxa` EXACT via GBIF; `pnpm db:seed` loads taxa + tiers. Still needs Arsalan species/tier review.

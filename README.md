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

Requires **Node 22 LTS** (see `.nvmrc`) and **pnpm** 9.

```bash
nvm use          # or install Node 22
pnpm install
pnpm turbo run build --dry-run
```

Later Phase 0 tasks add lint/typecheck/test, local PostGIS (`pnpm db:up`), and app scaffolds.

## Assets pack

Brand and store imagery lives under [`assets/`](assets/). Placeholders are committed so paths are stable; replace files in place before launch (final product name TBD).

| Path | Use |
|---|---|
| `assets/icons/` | App icon sources (`icon-1024.png`, `icon-512.png`, adaptive, splash) |
| `assets/favicon/` | Web favicon + Apple touch icon |
| `assets/banners/` | App Store / Play listing banners |
| `assets/marketing/` | Landing / waitlist imagery |
| `assets/social/` | Twitter/X and LinkedIn share images |
| `assets/og/` | Open Graph templates for Next `/api/og` |

See [`assets/README.md`](assets/README.md) for sizes and replacement notes. Do not commit secrets or raw GPS-bearing photos here.

## Planning docs

| File | What it is |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Product requirements: problem, personas, MVP scope, user stories, screens, metrics, ethics |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, data pipeline, scoring v1, location protection, schema, API, infra |
| [docs/TASKS.md](docs/TASKS.md) | Phased build tasks, each small enough for one AI agent run |
| [AGENTS.md](AGENTS.md) | Rules and conventions for AI coding agents working in this repo |
| [CURSOR_PROMPT.md](CURSOR_PROMPT.md) | Copy-paste prompts to start and continue work with a Cursor agent |

Start with `CURSOR_PROMPT.md`.

## Portfolio

Founder site (link out only): [arsalandev.studio](https://arsalandev.studio)

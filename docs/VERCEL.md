# Vercel deploy (web / PR previews)

WildWindow’s **Next.js web app** (`apps/web`) is intended to run on **Vercel** for production web and **pull-request preview** URLs (ARCHITECTURE §11). Railway still hosts the interim beta web container (`docs/RAILWAY.md`); this path is the TASKS **T9.5** Vercel cutover and does not replace the Railway API/worker/PostGIS stack.

Agents prepare repo config only. **Do not** create a Vercel project, run `vercel deploy`, or paste tokens into git.

Committed config:

| Path                                                    | Role                                                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| [`apps/web/vercel.json`](../apps/web/vercel.json)       | Install/build commands for the pnpm monorepo; serverless region `lhr1` (London, aligns with eu-west-2)                            |
| [`apps/web/next.config.ts`](../apps/web/next.config.ts) | `output: 'standalone'` only when **not** on Vercel (`VERCEL` unset) so Docker/Railway keep standalone and Vercel uses its adapter |

A `.vercel/project.json` **project link** (org + project ids) is **not** committed until Arsalan creates the project and links the GitHub repo — those ids do not exist yet.

---

## How a preview URL serves the landing page

Once the Vercel project is linked to `arsalan-arshad/wildwindow` with **Root Directory** `apps/web` and **Preview** deployments enabled for pull requests:

1. Open or update a PR against `main`.
2. Vercel builds with `apps/web/vercel.json`: install from the monorepo root (`pnpm install --filter web...`), then build `@wildwindow/geoprivacy`, `@wildwindow/shared`, and `web`.
3. Vercel posts a **Preview** deployment comment on the PR (URL like `https://wildwindow-<hash>-<team>.vercel.app`).
4. Open that URL at `/` (or leave the path empty). Next.js App Router serves `apps/web/src/app/page.tsx`, which renders the **Landing** component (hero, three hooks, waitlist form — T7.1).
5. Expect the same landing chrome as Railway production web; waitlist submit needs `NEXT_PUBLIC_API_URL` pointing at a reachable API (Railway API is fine for previews).

**Acceptance check (after Arsalan links the project):** open the PR preview URL → landing loads (status 200, “WildWindow” / waitlist visible). No coordinates or map pins on the page.

Until the project exists, agents verify locally: `pnpm --filter web test` (includes `vercel-config` gates) and optionally `VERCEL=1 pnpm --filter web build` (no `.next/standalone`).

---

## What Arsalan must do (click-path)

1. Open [vercel.com](https://vercel.com) → sign in (GitHub).
2. **Add New… → Project** → Import `arsalan-arshad/wildwindow`.
3. **Root Directory:** `apps/web` (Edit → select that folder). Leave **Include files outside the root directory** enabled (default) so workspace packages resolve.
4. Framework Preset: **Next.js** (auto). Install/Build commands are overridden by committed `vercel.json` — do not fight those in the dashboard unless debugging.
5. **Node.js Version:** 22.x (matches root `engines` / `.nvmrc`).
6. **Environment Variables** (Project → Settings → Environment Variables). Add the keys below for **Preview** and **Production** as needed. Paste values only in the Vercel UI — never in git or chat. Prefer **Encrypted** for anything sensitive.
7. Deploy. Confirm Production URL loads `/` (landing).
8. **Git →** ensure **Preview Deployments** for pull requests are on (default when the GitHub app is connected).
9. Optional CLI link (for local `vercel` / future agents): from a machine with access, `cd apps/web && vercel link`, then commit **only** `.vercel/project.json` if the team wants a checked-in link (orgId + projectId, no secrets). Do **not** commit `.vercel/README.txt` tokens or local auth.

Production custom domain can stay on Railway until cutover; point DNS at Vercel when ready. Until then, use `*.vercel.app` for previews and optional Production.

---

## Env checklist (web on Vercel)

Keys match `.env.example`. **Public** = safe in the browser / build-inlined. **Secret** = server-only or credential-like.

| Key                           | Kind   | Preview          | Production     | Notes                                                                                                   |
| ----------------------------- | ------ | ---------------- | -------------- | ------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`         | Public | Yes              | Yes            | Absolute API origin (e.g. Railway `https://…/`). Inlined at `next build`.                               |
| `NEXT_PUBLIC_SITE_URL`        | Public | Optional         | Yes            | Canonical site origin for metadata/OG. Preview can omit (falls back in code) or set to the preview URL. |
| `NEXT_PUBLIC_FIREBASE_CONFIG` | Public | If testing admin | If using admin | Firebase web-app JSON string (no private keys).                                                         |
| `NEXT_PUBLIC_SENTRY_DSN`      | Public | Optional         | Optional       | Browser Sentry (T9.1).                                                                                  |
| `SENTRY_DSN`                  | Secret | Optional         | Optional       | Server/edge Sentry.                                                                                     |
| `NEXT_PUBLIC_POSTHOG_KEY`     | Public | Optional         | Optional       | PostHog EU product analytics.                                                                           |
| `NEXT_PUBLIC_POSTHOG_HOST`    | Public | Optional         | Optional       | Default `https://eu.i.posthog.com` when unset.                                                          |

Do **not** put `DATABASE_URL*`, GBIF, Firebase **service account**, `ADMIN_TOKEN`, or other API/worker secrets on the Vercel web project. Web talks to the API over HTTPS only.

`WEB_ORIGIN` on the **API** (Railway/AWS) must allow the Vercel production and preview origins (CORS). Preview hostnames change per deployment — either use a Vercel preview wildcard policy when available, or temporarily point previews at a fixed staging API that allows `*.vercel.app` only if the API CORS layer supports it; otherwise set Production CORS to the stable Vercel/custom domain and test waitlist against Railway web until CORS is sorted.

---

## Dual host note

| Host          | Role today                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Railway `web` | Live beta site (`docs/RAILWAY.md`)                                                                  |
| Vercel        | T9.5 target for web + PR previews; create project to unlock acceptance “preview URL serves landing” |

Both use the same `apps/web` app. Docker builds keep `output: 'standalone'`; Vercel builds skip it via `VERCEL=1`.

# Publish `@wildwindow/geoprivacy` (T10.1) — founder checklist

🧑 **Human-gated.** Agents prepare this package and docs; they must **not** run
`npm publish`, create a public GitHub repository, or push to a new remote.
Only Arsalan completes the steps below.

Acceptance after publish: `npm view @wildwindow/geoprivacy` shows the version
(currently prepared as **0.1.0**).

## What is already done in the monorepo

| Item                         | Location                                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| MIT license                  | `packages/geoprivacy/LICENSE`                                             |
| Public-ready README + badges | `packages/geoprivacy/README.md` (npm shield resolves after first publish) |
| CHANGELOG                    | `packages/geoprivacy/CHANGELOG.md`                                        |
| Packable build (ESM+CJS+dts) | `pnpm --filter @wildwindow/geoprivacy build`                              |
| `publishConfig.access`       | `public` in `package.json`                                                |
| Show HN draft                | [show-hn-geoprivacy.md](./show-hn-geoprivacy.md)                          |
| Pack allowlist               | `files`: `dist`, `README.md`, `LICENSE`, `CHANGELOG.md` only              |

`package.json` still has `"private": true` so an accidental publish from CI or
an agent cannot succeed. Flip that only on publish day.

## Prerequisites (accounts)

1. **npm** — logged in as an owner of the `@wildwindow` scope
   (`npm whoami`, `npm access list packages @wildwindow`).
2. **GitHub** (optional but recommended) — a dedicated public repo, e.g.
   `arsalan-arshad/geoprivacy`, for Show HN / discoverability. The monorepo
   path `packages/geoprivacy` already shows the source under MIT.
3. Clean working tree on `main` with the T10.1 prep merged.

## Option A — Publish from the monorepo (recommended for npm)

The published tarball only contains `dist` + docs. Workspace
`devDependencies` (`@wildwindow/config`) never ship to npm consumers.

```bash
cd /path/to/wildwindow
git checkout main && git pull

# 1. Confirm pack contents (must include dist after build)
pnpm --filter @wildwindow/geoprivacy build
pnpm --filter @wildwindow/geoprivacy test
pnpm --filter @wildwindow/geoprivacy exec npm pack --dry-run
# Expect: dist/*, README.md, LICENSE, CHANGELOG.md, package.json — nothing else

# 2. On a throwaway local commit (do not push private:false to main until
#    you are ready), edit packages/geoprivacy/package.json:
#    - set "private": false  (or delete the key)
#    - confirm "version": "0.1.0" (or bump if republishing)
#    - set repository.url / homepage to the public repo if Option B is done

# 3. Publish (OTP if 2FA)
pnpm --filter @wildwindow/geoprivacy publish --access public
# equivalent: cd packages/geoprivacy && npm publish --access public

# 4. Verify
npm view @wildwindow/geoprivacy version
npm view @wildwindow/geoprivacy

# 5. Commit the private:false + any version bump on main (or leave private:true
#    and document that publish used a local override — prefer committing
#    private:false so future releases are honest).
```

`prepublishOnly` runs `build` then `test` so a broken tree cannot publish.

## Option B — Public GitHub repo via `git subtree` split

Use this when you want a small, focused repo for the Show HN link. Source of
truth can remain the monorepo; the public repo is a publishable mirror.

```bash
# From monorepo root, on the commit you want to mirror:
git subtree split --prefix=packages/geoprivacy -b geoprivacy-split

# Create empty public repo on GitHub (arsalan-arshad/geoprivacy), then:
git push git@github.com:arsalan-arshad/geoprivacy.git geoprivacy-split:main

# Optional: keep the split branch for later syncs
# git subtree split --prefix=packages/geoprivacy -b geoprivacy-split
# git push git@github.com:arsalan-arshad/geoprivacy.git geoprivacy-split:main
```

### Standalone repo follow-ups (after first push)

The split package still references `@wildwindow/config` as a workspace
devDependency. For a self-contained public clone:

1. Replace `tsconfig.json` extends with an inlined strict TS config (copy from
   `packages/config/tsconfig.base.json` fields you need).
2. Drop `@wildwindow/config` from `devDependencies` (keep `typescript`,
   `vitest`, `tsup`, `fast-check`, `@types/node`).
3. Add a minimal root `package.json` / `pnpm-lock.yaml` if you want
   `pnpm install && pnpm test` to work without the monorepo.
4. Point `repository`, `homepage`, and `bugs` in `package.json` at the new
   repo URL.
5. Swap the README CI badge from the monorepo placeholder to the new repo’s
   workflow (add a simple `ci.yml`: install, test, build).
6. Re-run Option A publish if `repository` metadata should match npm.

Agents must not create this repo or push the split remote.

## Post-publish checklist

- [ ] `npm view @wildwindow/geoprivacy` returns `0.1.0` (or the shipped version)
- [ ] npm package page shows README, MIT license, and repository link
- [ ] Update web landing / No-Pin links if the public repo URL differs from
      `…/wildwindow/tree/main/packages/geoprivacy`
      (`apps/web/src/components/landing.tsx`, `apps/web/src/lib/no-pin-tiers.ts`,
      privacy page) — remove “An npm publish is coming soon.”
- [ ] README npm badge shows the version (no longer “unknown”)
- [ ] Paste / schedule the [Show HN draft](./show-hn-geoprivacy.md)
- [ ] Tick T10.1 in `docs/TASKS.md`: `- [x]` with `Done: YYYY-MM-DD, npm 0.1.0`
- [ ] Do **not** weaken tiers or ship app secrets in the public tree

## Rollback / unpublish

npm generally does not allow unpublishing after 72 hours or if dependents
exist. Prefer a new patch version with a fix note in `CHANGELOG.md`.

## Security / licence reminders

- No GPL in this package; only `h3-js` (Apache-2.0) at runtime.
- Never include `data/sensitive-species.yaml`, raw coordinates, or app env
  files in the public repo or the npm tarball.
- Tier **policy constants** are public; species→tier **assignments** stay in
  WildWindow app data.

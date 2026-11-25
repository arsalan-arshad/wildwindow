## Linked issue

Fixes #

Task ID (from `docs/TASKS.md`, when this is a task):

## What changed

## Test notes

- [ ] Lint, typecheck, and tests for the packages I touched
- [ ] Acceptance test:

## No-Pin / privacy

- [ ] No exact coordinates in code, tests, fixtures, logs, screenshots, or this pull request
- [ ] Public responses have no coordinate fields, and geography still goes through `assertPublicSafe`
- [ ] User location is snapped on the device; raw lat/lng is not stored, logged, or sent on
- [ ] Tiers are unchanged, or any change is only in `data/sensitive-species.yaml` or the audit-logged admin API
- [ ] Photos have GPS EXIF stripped before upload, and the server checks it
- [ ] Snapping stays deterministic (no jitter), and public cells stay at the tier's resolution

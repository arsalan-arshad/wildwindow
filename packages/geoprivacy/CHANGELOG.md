# Changelog

All notable changes to `@wildwindow/geoprivacy` are documented in this file.

## 0.1.0 — pending publish (T10.1)

### Added

- Public-ready package metadata (`repository`, `homepage`, `bugs`, `keywords`, `engines`)
- README badge placeholders (npm / MIT / CI) and publish links
- `prepublishOnly` runs build + test before npm publish
- Launch docs: `docs/launch/geoprivacy-publish.md`, `docs/launch/show-hn-geoprivacy.md`

### Notes

- Still `"private": true` in the monorepo until Arsalan publishes to npm.
- First public npm tag should be **0.1.0** after flipping `private` and following the publish checklist.

## 0.0.0 — 2026-11-17

### Fixed

- `assertPublicSafe` now defaults to the **coarsest** allowed H3 resolution (and rejects all cells if any tier is `null`); forbids `lon` / `long` keys.

### Added

- `TIER_POLICY` matching PRD §9.2 / ARCHITECTURE §5.1
- `snapToCell` / `displayCellFor`
- `isOlderThanDelay` / `isInLockout`
- `suppressAndMerge`
- `bucketise` (map levels 1–5)
- `assertPublicSafe` / `GeoPrivacyViolation`
- `FORBIDDEN_PUBLIC_KEYS` — exported key list for public API schema guards (T5.1)

Not published to npm yet (human-gated; see T10.1).

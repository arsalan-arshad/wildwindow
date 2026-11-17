# Changelog

All notable changes to `@wildwindow/geoprivacy` are documented in this file.

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

Not published to npm yet (human-gated; see T10.1).

# `@wildwindow/geoprivacy`

Pure TypeScript helpers that enforce WildWindow’s **No-Pin Promise**: never expose wildlife locations finer than a species’ sensitivity tier allows.

Runtime dependency: [`h3-js`](https://github.com/uber/h3) only. No I/O and no hidden clock — pass `now` into time-aware helpers.

> **Status:** packable and tested. **Not published to npm yet** (founder-gated).

## How we protect wildlife

WildWindow never puts a pin on a wild animal. This package is the technical choke point:

1. **Deterministic snapping** — device GPS becomes an H3 res-7 cell; exact lat/lng are discarded. No random jitter that could be averaged out.
2. **Tiered public resolution** — `open` stays at res 7 (~5 km²), `protected` rises to res 5 (~250 km²), `highly_protected` to res 4 (~1,770 km², area labels only), `no_forecast` never publishes a cell.
3. **Delays and lockouts** — recent records are held back per tier; breeding months can suppress forecasts entirely.
4. **Minimum-count merging** — cells with too few records or distinct observers merge into coarser parents (or are dropped) before publication.
5. **Opaque maps** — public heatmaps use quantile levels 1–5, never raw counts.
6. **Fail-closed serialisation** — `assertPublicSafe` throws if a response contains coordinate keys or an H3 cell finer than the tier allows.

Species→tier assignments live in app data (`sensitive-species.yaml`), not in this package. When in doubt, use the higher tier.

## Install (when published)

```bash
npm install @wildwindow/geoprivacy
```

Until then, use the workspace package from this monorepo.

## Usage

```ts
import {
  snapToCell,
  displayCellFor,
  isOlderThanDelay,
  isInLockout,
  suppressAndMerge,
  bucketise,
  assertPublicSafe,
  TIER_POLICY,
} from '@wildwindow/geoprivacy';

// On device: snap and throw away lat/lng
const cellR7 = snapToCell(55.86, -4.25);
const display = displayCellFor(cellR7, 'protected'); // res-5 parent or null

const now = new Date();
const oldEnough = isOlderThanDelay(new Date('2026-01-01'), now, 'protected');
const locked = isInLockout(now, [4, 5, 6], 'Europe/London');

const published = suppressAndMerge(
  [{ cell: cellR7, nRecords: 3, observers: new Set(['a', 'b']) }],
  'open',
);

const levelOf = bucketise([1, 2, 3, 4, 5, 10]);
levelOf(10); // 1–5

assertPublicSafe(
  { status: 'ok', displayCell: display },
  { maxResolutionByTier: { protected: TIER_POLICY.protected.resolution }, h3Tier: 'protected' },
);
```

## Threat model (summary)

| Threat                        | Mitigation                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------- |
| Exact points from an API      | Raw points stay in worker-only storage; public responses use coarse cells.   |
| Averaging random jitter       | No jitter — snapping is deterministic.                                       |
| Differential queries nearby   | Responses keyed on the **display cell** (parent at tier resolution).         |
| Small-count re-identification | Minimum records + distinct observers; merge/suppress otherwise.              |
| Freshness leaks               | Per-tier delays; breeding lockout for highly protected species.              |
| Count leaks on maps           | Public maps show 1–5 quantile levels, not counts.                            |
| Developer mistakes            | `assertPublicSafe` rejects forbidden coordinate keys and over-fine H3 cells. |

## License

MIT

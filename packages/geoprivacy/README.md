# `@wildwindow/geoprivacy`

Pure TypeScript helpers that enforce WildWindow’s **No-Pin Promise**: never expose wildlife locations finer than a species’ sensitivity tier allows.

Runtime dependency: [`h3-js`](https://github.com/uber/h3) only. No I/O, no clock — pass `now` into time-aware helpers.

## Purpose

- Snap device GPS to a deterministic H3 cell and discard exact coordinates.
- Raise cells to the public resolution for each tier (`open` / `protected` / `highly_protected` / `no_forecast`).
- Apply record delays, breeding lockouts, minimum-count merging, and quantile map buckets.
- Fail closed on accidental coordinate fields in public JSON (`assertPublicSafe`).

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

Full policy constants live in `TIER_POLICY` (ARCHITECTURE §5.1 / PRD §9.2).

> Not published to npm yet (T1.7 prepares the package; publish is a later human-gated task).

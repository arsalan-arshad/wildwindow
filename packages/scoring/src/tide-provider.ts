/**
 * Tide provider interface (§3.5 / T4.8).
 *
 * Pure: no network. `NoTideProvider` always returns no extremes so factor D
 * is marked `not_used`. Real providers (licence-checked) land later in the API.
 */
import type { TideExtremes } from './factor-d.js';

/** ARCHITECTURE §3.5 — one high or low tide extreme. */
export type TideExtreme = {
  readonly timeUtc: string;
  readonly type: 'high' | 'low';
  readonly heightM?: number;
};

/** ARCHITECTURE §3.5 — fetch tide extremes at a cell-centre lat/lng. */
export interface TideProvider {
  readonly id: string;
  extremes(lat: number, lng: number, fromUtc: Date, days: number): Promise<readonly TideExtreme[]>;
}

/** MVP / default provider id. Env: `TIDE_PROVIDER=none`. */
export const TIDE_PROVIDER_NONE = 'none' as const;

export type TideProviderId = typeof TIDE_PROVIDER_NONE;

/**
 * Parse `TIDE_PROVIDER` (or equivalent). Empty / unset → `none`.
 * Unknown values throw so misconfiguration fails closed.
 */
export function parseTideProviderId(raw: string | undefined): TideProviderId {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '' || value === TIDE_PROVIDER_NONE) {
    return TIDE_PROVIDER_NONE;
  }
  throw new Error(`Unsupported TIDE_PROVIDER: ${raw ?? '(undefined)'}`);
}

/** Always returns no extremes — tide factor is `not_used` for every species. */
export class NoTideProvider implements TideProvider {
  readonly id = TIDE_PROVIDER_NONE;

  extremes(
    _lat: number,
    _lng: number,
    _fromUtc: Date,
    _days: number,
  ): Promise<readonly TideExtreme[]> {
    return Promise.resolve([]);
  }
}

/** Factories keyed by provider id — extend when a licensed provider is added (P3.1). */
const TIDE_PROVIDER_FACTORIES: {
  readonly [K in TideProviderId]: () => TideProvider;
} = {
  none: () => new NoTideProvider(),
};

/** Config switch: select a tide provider by id (MVP: only `none`). */
export function createTideProvider(id: TideProviderId = TIDE_PROVIDER_NONE): TideProvider {
  return TIDE_PROVIDER_FACTORIES[id]();
}

/** Resolve from a `TIDE_PROVIDER` env string (config switch entry point). */
export function createTideProviderFromEnv(
  raw: string | undefined = process.env['TIDE_PROVIDER'],
): TideProvider {
  return createTideProvider(parseTideProviderId(raw));
}

/** Map provider extremes into the shape `factorD` / `computeForecast` expect. */
export function toTideExtremes(extremes: readonly TideExtreme[]): TideExtremes {
  const highs: Date[] = [];
  const lows: Date[] = [];
  for (const extreme of extremes) {
    const at = new Date(extreme.timeUtc);
    if (Number.isNaN(at.getTime())) {
      throw new RangeError(`Invalid tide timeUtc: ${extreme.timeUtc}`);
    }
    if (extreme.type === 'high') {
      highs.push(at);
    } else {
      lows.push(at);
    }
  }
  return { highs, lows };
}

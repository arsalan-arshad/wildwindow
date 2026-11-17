/**
 * Sensitivity tiers and policy constants — must match ARCHITECTURE §5.1 / PRD §9.2.
 */

export type Tier = 'open' | 'protected' | 'highly_protected' | 'no_forecast';

export type TierPolicy = {
  readonly resolution: number | null;
  readonly kRing: number;
  readonly delayDays: number;
  readonly minRecords: number;
  readonly minObservers: number;
  readonly lockout: boolean | 'optional';
  readonly mapCells: boolean;
};

export const TIER_POLICY = {
  open: {
    resolution: 7,
    kRing: 1,
    delayDays: 0,
    minRecords: 5,
    minObservers: 3,
    lockout: false,
    mapCells: true,
  },
  protected: {
    resolution: 5,
    kRing: 0,
    delayDays: 30,
    minRecords: 10,
    minObservers: 5,
    lockout: 'optional',
    mapCells: true,
  },
  highly_protected: {
    resolution: 4,
    kRing: 0,
    delayDays: 365,
    minRecords: 20,
    minObservers: 8,
    lockout: true,
    mapCells: false,
  },
  no_forecast: {
    resolution: null,
    kRing: 0,
    delayDays: 0,
    minRecords: Number.POSITIVE_INFINITY,
    minObservers: Number.POSITIVE_INFINITY,
    lockout: true,
    mapCells: false,
  },
} as const satisfies Record<Tier, TierPolicy>;

export type TierPolicyMap = typeof TIER_POLICY;

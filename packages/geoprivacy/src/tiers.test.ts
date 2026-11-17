import { describe, expect, it } from 'vitest';

import { TIER_POLICY, type Tier } from './tiers.js';

/** PRD §9.2 / ARCHITECTURE §5.1 acceptance table. */
const PRD_TABLE: Record<
  Tier,
  { resolution: number | null; delayDays: number; minRecords: number; minObservers: number }
> = {
  open: { resolution: 7, delayDays: 0, minRecords: 5, minObservers: 3 },
  protected: { resolution: 5, delayDays: 30, minRecords: 10, minObservers: 5 },
  highly_protected: { resolution: 4, delayDays: 365, minRecords: 20, minObservers: 8 },
  no_forecast: {
    resolution: null,
    delayDays: 0,
    minRecords: Number.POSITIVE_INFINITY,
    minObservers: Number.POSITIVE_INFINITY,
  },
};

describe('TIER_POLICY', () => {
  it('matches PRD §9.2 resolution, delay and minimums for every tier', () => {
    for (const tier of Object.keys(PRD_TABLE) as Tier[]) {
      const policy = TIER_POLICY[tier];
      const expected = PRD_TABLE[tier];
      expect(policy.resolution).toBe(expected.resolution);
      expect(policy.delayDays).toBe(expected.delayDays);
      expect(policy.minRecords).toBe(expected.minRecords);
      expect(policy.minObservers).toBe(expected.minObservers);
    }
  });

  it('keeps lockout and mapCells flags from ARCHITECTURE §5.1', () => {
    expect(TIER_POLICY.open.lockout).toBe(false);
    expect(TIER_POLICY.open.mapCells).toBe(true);
    expect(TIER_POLICY.protected.lockout).toBe('optional');
    expect(TIER_POLICY.protected.mapCells).toBe(true);
    expect(TIER_POLICY.highly_protected.lockout).toBe(true);
    expect(TIER_POLICY.highly_protected.mapCells).toBe(false);
    expect(TIER_POLICY.no_forecast.lockout).toBe(true);
    expect(TIER_POLICY.no_forecast.mapCells).toBe(false);
  });
});

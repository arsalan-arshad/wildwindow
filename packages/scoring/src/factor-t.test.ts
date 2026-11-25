import { describe, expect, it } from 'vitest';

import { ACTIVITY_TEMPLATES } from './activity-templates.js';
import { SCORING_V1 } from './config/v1.js';
import {
  blockMass,
  factorT,
  hourlyShares,
  smoothHourlyCounts,
  startHourFromHm,
} from './factor-t.js';

describe('smoothHourlyCounts', () => {
  it('applies the circular [0.25, 0.5, 0.25] kernel', () => {
    const counts = Array.from({ length: 24 }, (_, h) => (h === 10 ? 4 : 0));
    const smoothed = smoothHourlyCounts(counts);
    expect(smoothed[9]).toBeCloseTo(1, 10);
    expect(smoothed[10]).toBeCloseTo(2, 10);
    expect(smoothed[11]).toBeCloseTo(1, 10);
    expect(smoothed[0]).toBe(0);
  });
});

describe('hourlyShares / factorT (§4.2 T)', () => {
  it('uses the activity template when timed records < 30', () => {
    const sparse: number[] = Array.from({ length: 24 }, (_, h) => (h === 12 ? 5 : 0));
    expect(sparse.reduce((a, b) => a + b, 0)).toBeLessThan(SCORING_V1.hourProfileMinRecords);

    const fromSparse = hourlyShares(sparse, 'diurnal');
    const fromTemplate = hourlyShares(
      ACTIVITY_TEMPLATES.diurnal.map((w) => w),
      'diurnal',
    );
    // Sparse path substitutes the template before smooth+normalize, so shares match
    // a direct template run (template already has plenty of mass).
    for (let h = 0; h < 24; h += 1) {
      expect(fromSparse[h]).toBeCloseTo(fromTemplate[h] ?? 0, 10);
    }
    // And they clearly differ from smoothing the sparse spike alone.
    const empiricalOnly = (() => {
      const smoothed = smoothHourlyCounts(sparse);
      const sum = smoothed.reduce((a, b) => a + b, 0);
      return smoothed.map((v) => v / sum);
    })();
    expect(fromSparse[12]).not.toBeCloseTo(empiricalOnly[12] ?? 0, 2);
  });

  it('uses the empirical profile when timed records ≥ 30', () => {
    const counts: number[] = Array.from({ length: 24 }, (_, h) => (h === 8 || h === 9 ? 20 : 0));
    expect(counts.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(
      SCORING_V1.hourProfileMinRecords,
    );
    const shares = hourlyShares(counts, 'nocturnal');
    // Nocturnal template peaks at night; empirical peaks at 08–09 — must follow empirical.
    const morning = blockMass(shares, 8);
    const night = blockMass(shares, 2);
    expect(morning).toBeGreaterThan(night);
  });

  it('gives T = 1 to the best candidate block', () => {
    const counts = Array.from({ length: 24 }, (_, h) => (h >= 7 && h <= 10 ? 10 : 1));
    const shares = hourlyShares(counts, 'diurnal');
    const candidates = [6, 7, 8, 9, 10, 11];
    let bestH = 6;
    let bestMass = -1;
    for (const h of candidates) {
      const m = blockMass(shares, h);
      if (m > bestMass) {
        bestMass = m;
        bestH = h;
      }
    }
    expect(factorT({ shares, blockStartHour: bestH, candidateStartHours: candidates })).toBe(1);
    const worse = factorT({
      shares,
      blockStartHour: candidates.find((h) => h !== bestH) ?? 6,
      candidateStartHours: candidates,
    });
    expect(worse).toBeLessThanOrEqual(1);
    expect(worse).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 when there are no candidate blocks', () => {
    const shares = hourlyShares(
      Array.from({ length: 24 }, () => 1),
      'diurnal',
    );
    expect(factorT({ shares, blockStartHour: 8, candidateStartHours: [] })).toBe(0);
  });

  it('parses HH:MM start hours', () => {
    expect(startHourFromHm('07:00')).toBe(7);
    expect(startHourFromHm('23:00')).toBe(23);
  });
});

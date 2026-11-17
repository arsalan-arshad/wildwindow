import * as fc from 'fast-check';
import { cellToChildren, cellToParent, getResolution, isValidCell } from 'h3-js';
import { describe, expect, it } from 'vitest';

import { displayCellFor, snapToCell } from './cells.js';
import { GeoPrivacyError } from './errors.js';
import { TIER_POLICY, type Tier } from './tiers.js';

const TIERS = Object.keys(TIER_POLICY) as Tier[];

describe('snapToCell', () => {
  it('returns a valid res-7 cell for Glasgow', () => {
    const cell = snapToCell(55.86, -4.25);
    expect(isValidCell(cell)).toBe(true);
    expect(getResolution(cell)).toBe(7);
  });

  it('is deterministic', () => {
    expect(snapToCell(24.86, 67.01)).toBe(snapToCell(24.86, 67.01));
  });

  it('rejects out-of-range coordinates', () => {
    expect(() => snapToCell(91, 0)).toThrow(GeoPrivacyError);
    expect(() => snapToCell(0, 181)).toThrow(GeoPrivacyError);
  });
});

describe('displayCellFor', () => {
  it('returns null for no_forecast', () => {
    const cell = snapToCell(55.86, -4.25);
    expect(displayCellFor(cell, 'no_forecast')).toBeNull();
  });

  it('rejects non res-7 cells', () => {
    const fine = snapToCell(55.86, -4.25, 8);
    expect(() => displayCellFor(fine, 'open')).toThrow(GeoPrivacyError);
  });

  it('property: display cell matches tier resolution; children map to same parent; no_forecast → null', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -85, max: 85, noNaN: true }),
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.constantFrom(...TIERS),
        (lat, lng, tier) => {
          const cellR7 = snapToCell(lat, lng, 7);
          const display = displayCellFor(cellR7, tier);
          if (tier === 'no_forecast') {
            expect(display).toBeNull();
            return;
          }
          if (display === null) {
            throw new Error('expected display cell');
          }
          // After excluding no_forecast, resolution is always a number.
          const expectedRes = TIER_POLICY[tier].resolution;
          expect(getResolution(display)).toBe(expectedRes);
          if (expectedRes === 7) {
            expect(display).toBe(cellR7);
          } else {
            expect(display).toBe(cellToParent(cellR7, expectedRes));
            for (const child of cellToChildren(display, 7)) {
              expect(displayCellFor(child, tier)).toBe(display);
            }
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

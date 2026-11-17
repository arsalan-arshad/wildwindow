import * as fc from 'fast-check';
import { getResolution, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';

import { assertPublicSafe } from './assert-public-safe.js';
import { GeoPrivacyViolation } from './errors.js';

function injectKeyAtDepth(depth: number, key: string, value: unknown): unknown {
  if (depth <= 0) {
    return { [key]: value };
  }
  return { nest: injectKeyAtDepth(depth - 1, key, value) };
}

describe('assertPublicSafe', () => {
  it('allows a clean public payload', () => {
    expect(() => {
      assertPublicSafe(
        { status: 'ok', displayCell: latLngToCell(55.86, -4.25, 7), score: 69 },
        { maxResolutionByTier: { open: 7 }, h3Tier: 'open' },
      );
    }).not.toThrow();
  });

  it('throws on a res-8 cell in an open context', () => {
    const fine = latLngToCell(55.86, -4.25, 8);
    expect(getResolution(fine)).toBe(8);
    expect(() => {
      assertPublicSafe({ displayCell: fine }, { maxResolutionByTier: { open: 7 }, h3Tier: 'open' });
    }).toThrow(GeoPrivacyViolation);
  });

  it('allows forbidden keys when allowOwnerLocation is true', () => {
    expect(() => {
      assertPublicSafe(
        { lat: 1, lng: 2 },
        { maxResolutionByTier: { open: 7 }, allowOwnerLocation: true },
      );
    }).not.toThrow();
  });

  it('property: injected lat at random depth always throws; clean payloads never throw', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 5 }), (depth) => {
        const dirty = injectKeyAtDepth(depth, 'lat', 55.86);
        expect(() => {
          assertPublicSafe(dirty, { maxResolutionByTier: { open: 7 }, h3Tier: 'open' });
        }).toThrow(GeoPrivacyViolation);

        const clean = injectKeyAtDepth(depth, 'label', 'Glasgow area');
        expect(() => {
          assertPublicSafe(clean, { maxResolutionByTier: { open: 7 }, h3Tier: 'open' });
        }).not.toThrow();
      }),
      { numRuns: 20 },
    );
  });

  it('detects forbidden keys case-insensitively', () => {
    expect(() => {
      assertPublicSafe({ Latitude: 1 }, { maxResolutionByTier: { open: 7 } });
    }).toThrow(GeoPrivacyViolation);
  });
});

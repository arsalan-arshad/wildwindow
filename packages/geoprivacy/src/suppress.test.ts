import * as fc from 'fast-check';
import { cellToChildren, cellToParent, getResolution, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';

import { type CellCount, suppressAndMerge } from './suppress.js';
import { TIER_POLICY } from './tiers.js';

function entry(cell: string, nRecords: number, observers: string[]): CellCount {
  return { cell, nRecords, observers: new Set(observers) };
}

function totalRecords(cells: readonly CellCount[]): number {
  return cells.reduce((sum, cell) => sum + cell.nRecords, 0);
}

function fingerprint(cells: readonly CellCount[]): string {
  return cells
    .map((cell) => {
      const observers = [...cell.observers].sort().join(',');
      return `${cell.cell}:${String(cell.nRecords)}:{${observers}}`;
    })
    .sort()
    .join('|');
}

describe('suppressAndMerge', () => {
  it('fixture: sibling open cells that fail alone merge into a parent that passes', () => {
    const seed = latLngToCell(55.86, -4.25, 7);
    const parent6 = cellToParent(seed, 6);
    const [a, b] = cellToChildren(parent6, 7);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (a === undefined || b === undefined) {
      throw new Error('expected res-7 children');
    }

    const input = [entry(a, 3, ['o1', 'o2']), entry(b, 3, ['o3', 'o4'])];
    const out = suppressAndMerge(input, 'open');
    expect(out).toHaveLength(1);
    const merged = out[0];
    expect(merged).toBeDefined();
    if (merged === undefined) {
      throw new Error('expected merged cell');
    }
    expect(merged.cell).toBe(parent6);
    expect(merged.nRecords).toBe(6);
    expect(merged.observers.size).toBe(4);
    expect(getResolution(merged.cell)).toBe(6);
  });

  it('returns empty for no_forecast', () => {
    const cell = latLngToCell(55.86, -4.25, 7);
    expect(suppressAndMerge([entry(cell, 100, ['a', 'b', 'c'])], 'no_forecast')).toEqual([]);
  });

  it('keeps cells that already meet open minimums', () => {
    const cell = latLngToCell(55.86, -4.25, 7);
    const input = [entry(cell, 5, ['a', 'b', 'c'])];
    expect(fingerprint(suppressAndMerge(input, 'open'))).toBe(fingerprint(input));
  });

  it('drops cells that still fail at res 3', () => {
    const cell = latLngToCell(55.86, -4.25, 7);
    const out = suppressAndMerge([entry(cell, 1, ['only'])], 'open');
    expect(out).toEqual([]);
  });

  it('property: mins, record budget, resolution bound, order-independence', () => {
    const minRecords = TIER_POLICY.open.minRecords;
    const minObservers = TIER_POLICY.open.minObservers;
    const maxRes = TIER_POLICY.open.resolution;

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            lat: fc.double({ min: 55.7, max: 56.0, noNaN: true }),
            lng: fc.double({ min: -4.5, max: -4.0, noNaN: true }),
            nRecords: fc.integer({ min: 1, max: 12 }),
            observers: fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), {
              minLength: 1,
              maxLength: 4,
            }),
          }),
          { minLength: 0, maxLength: 8 },
        ),
        fc.infiniteStream(fc.integer({ min: 0, max: 1000 })),
        (rows, stream) => {
          const byCell = new Map<string, CellCount>();
          for (const row of rows) {
            const cell = latLngToCell(row.lat, row.lng, 7);
            byCell.set(cell, entry(cell, row.nRecords, row.observers));
          }
          const input = [...byCell.values()];
          const shuffled = [...input];
          // Deterministic shuffle from stream
          for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = stream.next().value % (i + 1);
            const left = shuffled[i];
            const right = shuffled[j];
            if (left === undefined || right === undefined) {
              continue;
            }
            shuffled[i] = right;
            shuffled[j] = left;
          }

          const out = suppressAndMerge(input, 'open');
          const out2 = suppressAndMerge(shuffled, 'open');

          for (const cell of out) {
            expect(cell.nRecords).toBeGreaterThanOrEqual(minRecords);
            expect(cell.observers.size).toBeGreaterThanOrEqual(minObservers);
            expect(getResolution(cell.cell)).toBeLessThanOrEqual(maxRes);
          }
          expect(totalRecords(out)).toBeLessThanOrEqual(totalRecords(input));
          expect(fingerprint(out)).toBe(fingerprint(out2));
        },
      ),
      { numRuns: 40 },
    );
  });
});

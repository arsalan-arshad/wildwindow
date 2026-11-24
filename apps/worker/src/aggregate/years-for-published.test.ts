import { cellToParent, gridDisk, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';

import { yearsCoveredForPublished } from './years-for-published.js';

describe('yearsCoveredForPublished', () => {
  it('counts years on an exact bucket cell', () => {
    const cell = latLngToCell(55.5, -4.5, 5);
    const years = new Map<string, Set<number>>([[cell, new Set([2019, 2020, 2020])]]);
    expect(yearsCoveredForPublished(cell, years)).toBe(2);
  });

  it('unions years from children when published at a parent', () => {
    const a = latLngToCell(55.5, -4.5, 5);
    const parent = cellToParent(a, 4);
    const sibling = gridDisk(a, 3).find((cell) => cell !== a && cellToParent(cell, 4) === parent);
    expect(sibling).toBeDefined();
    if (sibling === undefined) {
      throw new Error('expected a res-5 sibling under the same res-4 parent');
    }
    const years = new Map<string, Set<number>>([
      [a, new Set([2018, 2019])],
      [sibling, new Set([2019, 2021])],
    ]);
    expect(yearsCoveredForPublished(parent, years)).toBe(3);
  });
});

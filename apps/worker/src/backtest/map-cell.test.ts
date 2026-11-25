import { snapToCell } from '@wildwindow/geoprivacy';
import { cellToParent } from 'h3-js';
import { describe, expect, it } from 'vitest';

import { mapToPublishedCell } from './run.js';

describe('mapToPublishedCell', () => {
  const lat = 55.466122112322616;
  const lng = -4.5344014230355665;

  it('returns the cell when it is published at the same resolution', () => {
    const cell = snapToCell(lat, lng, 7);
    const published = new Map([[cell, 7]]);
    expect(mapToPublishedCell(cell, published)).toBe(cell);
  });

  it('maps a fine cell onto a coarser published parent', () => {
    const fine = snapToCell(lat, lng, 7);
    const parent = cellToParent(fine, 5);
    const published = new Map([[parent, 5]]);
    expect(mapToPublishedCell(fine, published)).toBe(parent);
  });

  it('returns null when outside published set', () => {
    const cell = snapToCell(lat, lng, 7);
    expect(mapToPublishedCell(cell, new Map())).toBeNull();
  });
});

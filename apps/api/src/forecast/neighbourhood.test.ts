import { displayCellFor } from '@wildwindow/geoprivacy';
import { cellToParent, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';

import { neighbourhoodCells } from './neighbourhood.js';

describe('neighbourhoodCells', () => {
  const glasgowR7 = latLngToCell(55.86515, -4.25763, 7);

  it('returns kRing(1) for open / res-7', () => {
    const cells = neighbourhoodCells(glasgowR7, 'open');
    expect(cells).toContain(glasgowR7);
    expect(cells.length).toBeGreaterThan(1);
  });

  it('returns only the display cell for protected / res-5', () => {
    const display = displayCellFor(glasgowR7, 'protected');
    expect(display).not.toBeNull();
    if (display === null) {
      return;
    }
    expect(neighbourhoodCells(display, 'protected')).toEqual([display]);
    expect(cellToParent(glasgowR7, 5)).toBe(display);
  });

  it('returns empty for no_forecast', () => {
    expect(neighbourhoodCells(glasgowR7, 'no_forecast')).toEqual([]);
  });
});

import { TIER_POLICY } from '@wildwindow/geoprivacy';
import { getResolution, latLngToCell } from 'h3-js';
import { describe, expect, it } from 'vitest';

import { publicMapCells } from './species-map.js';

const GLASGOW_R7 = latLngToCell(55.86515, -4.25763, 7);
const GLASGOW_R5 = latLngToCell(55.86515, -4.25763, 5);
const ABERDEEN_R7 = latLngToCell(57.15, -2.1, 7);

describe('publicMapCells', () => {
  it('returns [] for highly_protected and no_forecast (mapCells=false)', () => {
    const aggregates = [
      { cell: GLASGOW_R7, nRecords: 100 },
      { cell: ABERDEEN_R7, nRecords: 50 },
    ];
    expect(publicMapCells(aggregates, 'highly_protected')).toEqual([]);
    expect(publicMapCells(aggregates, 'no_forecast')).toEqual([]);
    expect(TIER_POLICY.highly_protected.mapCells).toBe(false);
    expect(TIER_POLICY.no_forecast.mapCells).toBe(false);
  });

  it('returns levels 1–5 with no count fields for open tier', () => {
    const aggregates = [
      { cell: GLASGOW_R7, nRecords: 10 },
      { cell: ABERDEEN_R7, nRecords: 100 },
      { cell: latLngToCell(56.0, -4.0, 7), nRecords: 40 },
      { cell: latLngToCell(56.1, -4.1, 7), nRecords: 60 },
      { cell: latLngToCell(56.2, -4.2, 7), nRecords: 80 },
    ];
    const cells = publicMapCells(aggregates, 'open');
    expect(cells.length).toBe(5);
    for (const entry of cells) {
      expect(entry.level).toBeGreaterThanOrEqual(1);
      expect(entry.level).toBeLessThanOrEqual(5);
      expect(TIER_POLICY.open.resolution).toBe(7);
      expect(getResolution(entry.cell)).toBeLessThanOrEqual(7);
      expect(Object.keys(entry).sort()).toEqual(['cell', 'level']);
    }
    // Highest intensity → level 5.
    const top = cells.find((c) => c.cell === ABERDEEN_R7);
    expect(top?.level).toBe(5);
  });

  it('drops cells finer than the protected tier resolution', () => {
    const cells = publicMapCells(
      [
        { cell: GLASGOW_R7, nRecords: 50 },
        { cell: GLASGOW_R5, nRecords: 80 },
      ],
      'protected',
    );
    expect(cells).toHaveLength(1);
    const only = cells[0];
    expect(only).toBeDefined();
    if (only === undefined) {
      return;
    }
    expect(only.cell).toBe(GLASGOW_R5);
    expect(TIER_POLICY.protected.resolution).toBe(5);
    expect(getResolution(only.cell)).toBeLessThanOrEqual(5);
  });

  it('returns [] for empty aggregates', () => {
    expect(publicMapCells([], 'open')).toEqual([]);
  });

  it('sorts cells lexicographically for stable responses', () => {
    const a = latLngToCell(55.8, -4.2, 7);
    const b = latLngToCell(55.9, -4.3, 7);
    const cells = publicMapCells(
      [
        { cell: b, nRecords: 10 },
        { cell: a, nRecords: 20 },
      ],
      'open',
    );
    expect(cells.map((c) => c.cell)).toEqual([a, b].sort((x, y) => x.localeCompare(y)));
  });
});

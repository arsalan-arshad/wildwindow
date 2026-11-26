import { snapToCell } from '@wildwindow/geoprivacy';

import { geometryForCell } from '@/lib/cell-map';

describe('geometryForCell (T6.4)', () => {
  it('builds a closed polygon from an H3 cell without needing GPS', () => {
    const cell = snapToCell(55.86, -4.25, 7);
    const geometry = geometryForCell(cell);
    expect(geometry).not.toBeNull();
    if (geometry === null) {
      throw new Error('expected geometry');
    }
    expect(geometry.cellR7).toBe(cell);
    expect(geometry.coordinates.length).toBeGreaterThanOrEqual(4);
    const first = geometry.coordinates[0];
    const last = geometry.coordinates[geometry.coordinates.length - 1];
    expect(first).toEqual(last);
    expect(Number.isFinite(geometry.centre.latitude)).toBe(true);
    expect(Number.isFinite(geometry.centre.longitude)).toBe(true);
  });

  it('returns null for an invalid cell id', () => {
    expect(geometryForCell('not-a-cell')).toBeNull();
  });
});

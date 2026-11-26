import { snapToCell } from '@wildwindow/geoprivacy';

import {
  AREA_PREF_KEYS,
  loadSelectedCellR7,
  saveSelectedCellR7,
} from '@/lib/area-selection';
import { resolveMyLocationCell } from '@/lib/my-location';
import { createMemoryPreferenceStorage } from '@/lib/preferences';

const GLASGOW_LAT = 55.86;
const GLASGOW_LNG = -4.25;
const GLASGOW_CELL = snapToCell(GLASGOW_LAT, GLASGOW_LNG, 7);

function containsLatLng(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'number') {
    return value === GLASGOW_LAT || value === GLASGOW_LNG;
  }
  if (typeof value === 'string') {
    return value.includes(String(GLASGOW_LAT)) || value.includes(String(GLASGOW_LNG));
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsLatLng(item));
  }
  if (typeof value === 'object') {
    return Object.values(value).some((item) => containsLatLng(item));
  }
  return false;
}

describe('resolveMyLocationCell (T6.4 privacy)', () => {
  it('passes only the cell ID onwards — no lat/lng to API or storage', async () => {
    const storage = createMemoryPreferenceStorage();
    const areasGet = jest.fn(async (cellR7: string) => ({
      cellR7,
      label: 'Glasgow · Kelvin area',
      regionSlug: 'scotland' as const,
      covered: true,
    }));
    const onCellArgs: unknown[] = [];

    const result = await resolveMyLocationCell({
      location: {
        requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
        getCurrentPositionAsync: async () => ({
          coords: { latitude: GLASGOW_LAT, longitude: GLASGOW_LNG },
        }),
      },
      onCell: async (cellR7) => {
        onCellArgs.push(cellR7);
        await saveSelectedCellR7(cellR7, storage);
        await areasGet(cellR7);
      },
    });

    expect(result).toEqual({ ok: true, cellR7: GLASGOW_CELL });
    expect(onCellArgs).toEqual([GLASGOW_CELL]);
    expect(areasGet).toHaveBeenCalledTimes(1);
    expect(areasGet).toHaveBeenCalledWith(GLASGOW_CELL);

    for (const call of areasGet.mock.calls) {
      expect(containsLatLng(call)).toBe(false);
    }
    for (const arg of onCellArgs) {
      expect(containsLatLng(arg)).toBe(false);
      expect(typeof arg).toBe('string');
    }

    const stored = await loadSelectedCellR7(storage);
    expect(stored).toBe(GLASGOW_CELL);
    expect(await storage.getItem(AREA_PREF_KEYS.cellR7)).toBe(GLASGOW_CELL);
    expect(containsLatLng(await storage.getItem(AREA_PREF_KEYS.cellR7))).toBe(false);

    // Storage must only hold the cell key/value — no coordinate keys.
    expect(await storage.getItem('latitude')).toBeNull();
    expect(await storage.getItem('longitude')).toBeNull();
    expect(await storage.getItem('lat')).toBeNull();
    expect(await storage.getItem('lng')).toBeNull();
  });

  it('returns denied without calling onCell when permission is refused', async () => {
    const onCell = jest.fn();
    const result = await resolveMyLocationCell({
      location: {
        requestForegroundPermissionsAsync: async () => ({ status: 'denied' }),
        getCurrentPositionAsync: async () => {
          throw new Error('should not read position');
        },
      },
      onCell,
    });
    expect(result).toEqual({ ok: false, reason: 'denied' });
    expect(onCell).not.toHaveBeenCalled();
  });
});

import { cellToChildren, cellToParent, cellToLatLng, getResolution, isValidCell } from 'h3-js';

import { WEATHER_CACHE_RES } from './types.js';

export type CellCentre = {
  readonly cellR5: string;
  readonly lat: number;
  readonly lng: number;
};

/**
 * Map any valid H3 cell to a res-5 centre for weather (ARCHITECTURE §3.4).
 * Never a user pin — always a cell centre.
 *
 * - Finer than res-5 → parent at res-5
 * - Exactly res-5 → itself
 * - Coarser than res-5 (e.g. highly_protected display res-4) → first
 *   deterministic res-5 child, so every sibling under the same display cell
 *   shares one weather cache key (No-Pin / differential-query property)
 */
export function weatherCellCentre(cell: string): CellCentre {
  if (typeof cell !== 'string' || cell.length === 0 || !isValidCell(cell)) {
    throw new RangeError(`Invalid H3 cell for weather: ${cell}`);
  }
  const resolution = getResolution(cell);
  let cellR5: string;
  if (resolution === WEATHER_CACHE_RES) {
    cellR5 = cell;
  } else if (resolution > WEATHER_CACHE_RES) {
    cellR5 = cellToParent(cell, WEATHER_CACHE_RES);
  } else {
    const children = cellToChildren(cell, WEATHER_CACHE_RES);
    const first = children[0];
    if (first === undefined) {
      throw new RangeError(`No res-${String(WEATHER_CACHE_RES)} child for coarser cell ${cell}`);
    }
    cellR5 = first;
  }
  const [lat, lng] = cellToLatLng(cellR5);
  return { cellR5, lat, lng };
}

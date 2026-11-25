import { cellToParent, cellToLatLng, getResolution, isValidCell } from 'h3-js';

import { WEATHER_CACHE_RES } from './types.js';

export type CellCentre = {
  readonly cellR5: string;
  readonly lat: number;
  readonly lng: number;
};

/**
 * Raise any valid H3 cell to res-5 and return its centre (never a user pin).
 * Finer cells → parent; already res-5 → itself; coarser than 5 → reject
 * (weather cache is keyed at res-5 only).
 */
export function weatherCellCentre(cell: string): CellCentre {
  if (typeof cell !== 'string' || cell.length === 0 || !isValidCell(cell)) {
    throw new RangeError(`Invalid H3 cell for weather: ${cell}`);
  }
  const resolution = getResolution(cell);
  if (resolution < WEATHER_CACHE_RES) {
    throw new RangeError(
      `Weather requires a cell at res-${String(WEATHER_CACHE_RES)} or finer; got res-${String(resolution)}`,
    );
  }
  const cellR5 = resolution === WEATHER_CACHE_RES ? cell : cellToParent(cell, WEATHER_CACHE_RES);
  const [lat, lng] = cellToLatLng(cellR5);
  return { cellR5, lat, lng };
}

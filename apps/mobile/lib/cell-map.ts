/**
 * Coarse cell map helpers (T6.4). Boundaries come from the cell ID via h3-js —
 * never from raw GPS. Used only for on-device polygon display.
 */
import { cellToBoundary, cellToLatLng, isValidCell } from 'h3-js';

export type MapLatLng = {
  readonly latitude: number;
  readonly longitude: number;
};

export type CoarseCellMapGeometry = {
  readonly cellR7: string;
  readonly coordinates: readonly MapLatLng[];
  readonly centre: MapLatLng;
};

/**
 * Convert an H3 cell to a closed polygon + centre for react-native-maps.
 * Returns null when the id is not a valid H3 cell.
 */
export function geometryForCell(cellR7: string): CoarseCellMapGeometry | null {
  if (!isValidCell(cellR7)) {
    return null;
  }
  const boundary = cellToBoundary(cellR7);
  if (boundary.length < 3) {
    return null;
  }
  const coordinates: MapLatLng[] = boundary.map(([lat, lng]) => ({
    latitude: lat as number,
    longitude: lng as number,
  }));
  // Close the ring for Polygon.
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (
    first !== undefined &&
    last !== undefined &&
    (first.latitude !== last.latitude || first.longitude !== last.longitude)
  ) {
    coordinates.push({ latitude: first.latitude, longitude: first.longitude });
  }
  const [centreLat, centreLng] = cellToLatLng(cellR7);
  return {
    cellR7,
    coordinates,
    centre: { latitude: centreLat, longitude: centreLng },
  };
}

/**
 * Ray-casting point-in-polygon for GeoJSON Polygon / MultiPolygon (EPSG:4326).
 * Used by gbif:load so validation stays free of PostGIS round-trips per row.
 */

export type GeoJsonPolygon = {
  readonly type: 'Polygon';
  readonly coordinates: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
};

export type GeoJsonMultiPolygon = {
  readonly type: 'MultiPolygon';
  readonly coordinates: ReadonlyArray<ReadonlyArray<ReadonlyArray<readonly [number, number]>>>;
};

export type RegionGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

function pointInRing(
  lng: number,
  lat: number,
  ring: ReadonlyArray<readonly [number, number]>,
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const pi = ring[i];
    const pj = ring[j];
    if (pi === undefined || pj === undefined) {
      continue;
    }
    const [xi, yi] = pi;
    const [xj, yj] = pj;
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygonCoords(
  lng: number,
  lat: number,
  rings: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
): boolean {
  const outer = rings[0];
  if (outer === undefined || !pointInRing(lng, lat, outer)) {
    return false;
  }
  for (const hole of rings.slice(1)) {
    if (pointInRing(lng, lat, hole)) {
      return false;
    }
  }
  return true;
}

export function pointInRegionGeometry(lat: number, lng: number, geometry: RegionGeometry): boolean {
  if (geometry.type === 'Polygon') {
    return pointInPolygonCoords(lng, lat, geometry.coordinates);
  }
  for (const polygon of geometry.coordinates) {
    if (pointInPolygonCoords(lng, lat, polygon)) {
      return true;
    }
  }
  return false;
}

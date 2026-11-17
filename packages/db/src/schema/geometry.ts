import { customType } from 'drizzle-orm/pg-core';

/**
 * PostGIS MultiPolygon in EPSG:4326.
 * Values are typically written with `sql\`ST_GeomFromText(...)\`` and
 * read with `ST_AsText` / `ST_AsGeoJSON` in queries (ARCHITECTURE §6.2).
 */
export const geometryMultipolygon4326 = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'geometry(MultiPolygon,4326)';
  },
});

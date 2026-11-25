import { areaLabelFor, type AreaLabelLookup, type Database } from '@wildwindow/db';
import { RegionIdSchema, type RegionId } from '@wildwindow/shared';
import { sql } from 'drizzle-orm';
import { cellToLatLng, isValidCell } from 'h3-js';

export type RegionHit = {
  readonly id: number;
  readonly slug: RegionId;
  readonly timeZone: string;
  readonly name: string;
};

/**
 * Find the beta region whose polygon covers the H3 cell centre.
 * Uses the cell centre only — never a raw user pin.
 */
export async function regionCoveringCell(db: Database, cell: string): Promise<RegionHit | null> {
  if (!isValidCell(cell)) {
    throw new RangeError(`invalid H3 cell: ${cell}`);
  }
  const [lat, lng] = cellToLatLng(cell);
  const rows = await db.execute<{
    id: number;
    slug: string;
    time_zone: string;
    name: string;
  }>(sql`
    SELECT r.id, r.slug, r.time_zone, r.name
    FROM ref.regions r
    WHERE ST_Covers(
      r.geom,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)
    )
    ORDER BY r.slug
    LIMIT 1
  `);

  const row = rows.rows[0];
  if (row === undefined) {
    return null;
  }
  const slug = RegionIdSchema.safeParse(row.slug);
  if (!slug.success) {
    return null;
  }
  return {
    id: row.id,
    slug: slug.data,
    timeZone: row.time_zone,
    name: row.name,
  };
}

/**
 * Human area label for a display cell (T2.9). Uses the shared PostGIS helper
 * from `@wildwindow/db` so overlap SQL stays in one place.
 */
export async function labelForDisplayCell(
  connectionString: string,
  displayCell: string,
): Promise<AreaLabelLookup | null> {
  if (!isValidCell(displayCell)) {
    throw new RangeError(`invalid H3 cell: ${displayCell}`);
  }
  return areaLabelFor(connectionString, displayCell);
}

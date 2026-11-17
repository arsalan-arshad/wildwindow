import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from './client.js';
import { migrationsFolder, runMigrations } from './migrate.js';
import {
  effortCellWeek,
  forecastCache,
  occurrences,
  regions,
  taxa,
  taxonCellWeek,
  taxonHourProfile,
  taxonRegionWeek,
  taxonScoreRef,
  weatherCache,
} from './schema/index.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const REGION_POLY = sql`ST_GeomFromText(
  'MULTIPOLYGON(((-4.30 55.84, -4.20 55.84, -4.20 55.88, -4.30 55.88, -4.30 55.84)))',
  4326
)`;

const POINT_INSIDE = sql`ST_SetSRID(ST_MakePoint(-4.25, 55.86), 4326)`;

function requireRow<T>(row: T | undefined, label: string): T {
  if (row === undefined) {
    throw new Error(`expected ${label} row`);
  }
  return row;
}

describe('T2.3 raw/pub tables', () => {
  const { db, pool } = createDb({ connectionString: DATABASE_URL });

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
  });

  afterAll(async () => {
    await pool.end();
  });

  it('inserts a point and ST_Within against a region polygon', async () => {
    const suffix = String(Date.now());

    const [regionRow] = await db
      .insert(regions)
      .values({
        slug: `raw-pub-${suffix}`,
        name: 'RawPub Test Region',
        countryCode: 'GB',
        timeZone: 'Europe/London',
        geom: REGION_POLY,
        minRes: 3,
      })
      .returning({ id: regions.id });
    const region = requireRow(regionRow, 'region');

    const [taxonRow] = await db
      .insert(taxa)
      .values({
        gbifTaxonKey: 2_100_000_000 + (Date.now() % 1_000_000),
        scientificName: 'Testus pointus',
        commonNames: { en: 'Test bird' },
        group: 'bird',
        effortGroup: 'birds',
      })
      .returning({ id: taxa.id });
    const taxon = requireRow(taxonRow, 'taxon');

    const [occRow] = await db
      .insert(occurrences)
      .values({
        source: 'gbif',
        sourceRecordId: `occ-${suffix}`,
        taxonId: taxon.id,
        regionId: region.id,
        geom: POINT_INSIDE,
        eventDate: '2024-06-15',
        year: 2024,
        week: 24,
        hour: 6,
        license: 'CC0_1_0',
        datasetKey: 'test-dataset',
        observerHash: 'abc123hash',
      })
      .returning({ id: occurrences.id });
    const occ = requireRow(occRow, 'occurrence');

    const within = await db.execute<{ inside: boolean }>(sql`
      SELECT ST_Within(o.geom, r.geom) AS inside
      FROM raw.occurrences o
      JOIN ref.regions r ON r.id = o.region_id
      WHERE o.id = ${occ.id}
    `);
    expect(within.rows[0]?.inside).toBe(true);

    await db.insert(taxonCellWeek).values({
      taxonId: taxon.id,
      regionId: region.id,
      res: 7,
      cell: '8719582a8ffffff',
      week: 24,
      nRecords: 1,
      nObservers: 1,
      yearsCovered: 1,
    });
    await db.insert(taxonRegionWeek).values({
      taxonId: taxon.id,
      regionId: region.id,
      week: 24,
      nRecords: 1,
      nEffort: 10,
    });
    await db.insert(effortCellWeek).values({
      effortGroup: 'birds',
      regionId: region.id,
      res: 7,
      cell: '8719582a8ffffff',
      week: 24,
      nRecords: 10,
    });
    await db.insert(taxonHourProfile).values({
      taxonId: taxon.id,
      regionId: region.id,
      hour: 6,
      nRecords: 1,
    });
    await db.insert(taxonScoreRef).values({
      taxonId: taxon.id,
      regionId: region.id,
      rrRef: 0.12,
      computedAt: new Date(),
      scoringVersion: 'v1',
    });
    await db.insert(weatherCache).values({
      provider: 'open-meteo',
      cellR5: '8519582bfffffff',
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
      payload: { tempC: 12 },
    });
    await db.insert(forecastCache).values({
      taxonId: taxon.id,
      displayCell: '8519582bfffffff',
      startDate: '2024-06-10',
      scoringVersion: 'v1',
      payload: { weekScore: 70 },
      expiresAt: new Date(Date.now() + 3600_000),
    });

    const pubCount = await db.execute<{ n: number }>(sql`
      SELECT (
        (SELECT COUNT(*) FROM pub.taxon_cell_week WHERE taxon_id = ${taxon.id})
        + (SELECT COUNT(*) FROM pub.taxon_region_week WHERE taxon_id = ${taxon.id})
        + (SELECT COUNT(*) FROM pub.effort_cell_week WHERE region_id = ${region.id})
        + (SELECT COUNT(*) FROM pub.taxon_hour_profile WHERE taxon_id = ${taxon.id})
        + (SELECT COUNT(*) FROM pub.taxon_score_ref WHERE taxon_id = ${taxon.id})
        + (SELECT COUNT(*) FROM pub.weather_cache WHERE provider = 'open-meteo')
        + (SELECT COUNT(*) FROM pub.forecast_cache WHERE taxon_id = ${taxon.id})
      )::int AS n
    `);
    expect(pubCount.rows[0]?.n).toBeGreaterThanOrEqual(7);
  });
});

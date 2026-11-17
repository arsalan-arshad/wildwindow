import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from './client.js';
import { migrationsFolder, runMigrations } from './migrate.js';
import {
  datasets,
  places,
  regions,
  speciesCards,
  taxa,
  taxonRegion,
  zones,
} from './schema/index.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

/** Tiny square around Glasgow for insert tests (not a real boundary). */
const GLASGOW_SQUARE = sql`ST_GeomFromText(
  'MULTIPOLYGON(((-4.30 55.84, -4.20 55.84, -4.20 55.88, -4.30 55.88, -4.30 55.84)))',
  4326
)`;

function requireRow<T>(row: T | undefined, label: string): T {
  if (row === undefined) {
    throw new Error(`expected ${label} row`);
  }
  return row;
}

describe('T2.2 ref tables insert/read', () => {
  const { db, pool } = createDb({ connectionString: DATABASE_URL });

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
  });

  afterAll(async () => {
    await pool.end();
  });

  it('inserts and reads a row in each ref table', async () => {
    const suffix = String(Date.now());

    const [regionRow] = await db
      .insert(regions)
      .values({
        slug: `scotland-test-${suffix}`,
        name: 'Scotland Test',
        countryCode: 'GB',
        timeZone: 'Europe/London',
        geom: GLASGOW_SQUARE,
        minRes: 3,
      })
      .returning({ id: regions.id, slug: regions.slug, name: regions.name });
    const region = requireRow(regionRow, 'region');
    expect(region.name).toBe('Scotland Test');

    const [zoneRow] = await db
      .insert(zones)
      .values({
        regionId: region.id,
        name: 'Glasgow City',
        kind: 'council_area',
        geom: GLASGOW_SQUARE,
      })
      .returning({ id: zones.id, name: zones.name, kind: zones.kind });
    const zone = requireRow(zoneRow, 'zone');
    expect(zone.kind).toBe('council_area');

    const [placeRow] = await db
      .insert(places)
      .values({
        regionId: region.id,
        name: 'Glasgow',
        altNames: ['Glaschu'],
        kind: 'city',
        cellR7: '8719582a8ffffff',
        population: 600_000,
      })
      .returning({ id: places.id, name: places.name, cellR7: places.cellR7 });
    const place = requireRow(placeRow, 'place');
    expect(place.cellR7).toBe('8719582a8ffffff');

    const [taxonRow] = await db
      .insert(taxa)
      .values({
        gbifTaxonKey: 2_000_000_000 + (Date.now() % 1_000_000),
        scientificName: 'Alcedo atthis',
        commonNames: { en: 'Common Kingfisher', ur: 'کنگ فشر' },
        group: 'bird',
        effortGroup: 'birds',
        coastal: false,
        activityPattern: 'diurnal',
        challengeEligible: true,
      })
      .returning({
        id: taxa.id,
        scientificName: taxa.scientificName,
        gbifTaxonKey: taxa.gbifTaxonKey,
      });
    const taxon = requireRow(taxonRow, 'taxon');
    expect(taxon.scientificName).toBe('Alcedo atthis');

    const [trRow] = await db
      .insert(taxonRegion)
      .values({
        taxonId: taxon.id,
        regionId: region.id,
        tier: 'open',
        lockoutMonths: [],
      })
      .returning({
        taxonId: taxonRegion.taxonId,
        regionId: taxonRegion.regionId,
        tier: taxonRegion.tier,
      });
    const tr = requireRow(trRow, 'taxon_region');
    expect(tr.tier).toBe('open');

    const [cardRow] = await db
      .insert(speciesCards)
      .values({
        taxonId: taxon.id,
        regionId: region.id,
        bodyMd: 'Look along quiet rivers at dawn.',
        settings: { iso: 800 },
        ethicsMd: 'Stay on paths.',
        status: 'draft',
      })
      .returning({ id: speciesCards.id, status: speciesCards.status });
    const card = requireRow(cardRow, 'species_card');
    expect(card.status).toBe('draft');

    const [datasetRow] = await db
      .insert(datasets)
      .values({
        gbifDatasetKey: `test-dataset-${suffix}`,
        title: 'Test GBIF dataset',
        publisher: 'WildWindow CI',
        license: 'CC0_1_0',
        citation: 'Test citation',
      })
      .returning({
        gbifDatasetKey: datasets.gbifDatasetKey,
        license: datasets.license,
      });
    const dataset = requireRow(datasetRow, 'dataset');
    expect(dataset.license).toBe('CC0_1_0');

    const geomCheck = await db.execute<{ ok: boolean }>(sql`
      SELECT ST_IsValid(${GLASGOW_SQUARE}) AS ok
    `);
    expect(geomCheck.rows[0]?.ok).toBe(true);

    const trgm = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS(
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'ref'
          AND indexname = 'places_name_trgm_idx'
      ) AS exists
    `);
    expect(trgm.rows[0]?.exists).toBe(true);

    const gist = await db.execute<{ n: number }>(sql`
      SELECT COUNT(*)::int AS n
      FROM pg_indexes
      WHERE schemaname = 'ref'
        AND indexname IN ('regions_geom_gix', 'zones_geom_gix')
    `);
    expect(gist.rows[0]?.n).toBe(2);
  });
});

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  applyRoles,
  challenges,
  createDb,
  migrationsFolder,
  places,
  regions,
  roleConnectionUrl,
  runMigrations,
  seedAll,
  taxa,
  taxonRegion,
} from '@wildwindow/db';
import { assertPublicSafe, displayCellFor, TIER_POLICY, type Tier } from '@wildwindow/geoprivacy';
import { SensitivityTierSchema } from '@wildwindow/shared';
import { eq } from 'drizzle-orm';
import {
  cellToChildren,
  cellToLatLng,
  cellToParent,
  getResolution,
  gridDisk,
  latLngToCell,
} from 'h3-js';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../app.module.js';
import { apiNestOptions, configureApiApp } from '../bootstrap.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';
const API_PASSWORD = process.env['WW_API_DB_PASSWORD'] ?? 'ww_api_test_password';
const WORKER_PASSWORD = process.env['WW_WORKER_DB_PASSWORD'] ?? 'ww_worker_test_password';

/** Interceptor ceiling: nothing public may be finer than open res-7. */
const PUBLIC_SAFE = {
  maxResolutionByTier: { open: TIER_POLICY.open.resolution },
} as const;

const KINGFISHER_SLUG = 'kingfisher-month-2026-11';
/** Outside typical lockout months (e.g. osprey 3–8). */
const FORECAST_START = '2026-11-16';

/**
 * Sparse anchors inside beta polygons — expanded with gridDisk for the audit
 * grid. Kept small so the full taxon×cell forecast walk stays CI-friendly.
 */
const REGION_ANCHORS: Readonly<
  Record<'scotland' | 'sindh', readonly { lat: number; lng: number }[]>
> = {
  scotland: [
    { lat: 55.86515, lng: -4.25763 }, // Glasgow
    { lat: 55.9533, lng: -3.1883 }, // Edinburgh
  ],
  sindh: [
    { lat: 24.8607, lng: 67.0011 }, // Karachi
    { lat: 25.396, lng: 68.3578 }, // Hyderabad
  ],
};

/** Max covered res-7 cells per region after filtering (still a real grid). */
const GRID_CELLS_PER_REGION = 6;

const REGION_SLUGS = ['scotland', 'sindh'] as const;
type RegionSlug = (typeof REGION_SLUGS)[number];

type SeededLink = {
  readonly taxonId: number;
  readonly regionSlug: RegionSlug;
  readonly tier: Tier;
};

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of Object.keys(snapshot)) {
    const value = snapshot[key];
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key);
    } else {
      process.env[key] = value;
    }
  }
}

function expectPublicSafe(body: unknown): void {
  assertPublicSafe(body, PUBLIC_SAFE);
  expect(JSON.stringify(body)).not.toMatch(
    /"lat"|"lng"|"lon"|"long"|latitude|longitude|coordinates|"geom"|wkt/i,
  );
}

function isRegionSlug(value: string): value is RegionSlug {
  return value === 'scotland' || value === 'sindh';
}

/**
 * Distinct sibling under the same display parent (ARCHITECTURE §5.2).
 * For `no_forecast` (null display), any other covered cell in the region.
 * For `open` (display = self), there is no distinct sibling — returns null.
 */
function findDisplaySibling(
  cellR7: string,
  tier: Tier,
  coveredInRegion: readonly string[],
): string | null {
  const display = displayCellFor(cellR7, tier);
  if (display === null) {
    return coveredInRegion.find((cell) => cell !== cellR7) ?? null;
  }
  const maxRes = TIER_POLICY[tier].resolution;
  if (maxRes === null || maxRes >= 7) {
    return null;
  }
  const covered = new Set(coveredInRegion);
  for (const child of cellToChildren(display, 7)) {
    if (child !== cellR7 && covered.has(child)) {
      return child;
    }
  }
  return null;
}

describe('T9.7 End-to-end geoprivacy audit', () => {
  let app: INestApplication;
  let previousEnv: Record<string, string | undefined>;
  let seededLinks: SeededLink[] = [];
  const cellsByRegion: Record<RegionSlug, string[]> = { scotland: [], sindh: [] };

  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await applyRoles(DATABASE_URL, {
      apiPassword: API_PASSWORD,
      workerPassword: WORKER_PASSWORD,
    });
    await seedAll(DATABASE_URL);

    const { db, pool } = createDb({ connectionString: DATABASE_URL });
    try {
      const linkRows = await db
        .select({
          taxonId: taxa.id,
          regionSlug: regions.slug,
          tier: taxonRegion.tier,
        })
        .from(taxonRegion)
        .innerJoin(taxa, eq(taxa.id, taxonRegion.taxonId))
        .innerJoin(regions, eq(regions.id, taxonRegion.regionId));

      seededLinks = linkRows.flatMap((row) => {
        if (!isRegionSlug(row.regionSlug)) {
          return [];
        }
        return [
          {
            taxonId: row.taxonId,
            regionSlug: row.regionSlug,
            tier: SensitivityTierSchema.parse(row.tier),
          },
        ];
      });
      expect(seededLinks.length).toBeGreaterThan(10);

      const placeRows = await db
        .select({
          cellR7: places.cellR7,
          regionSlug: regions.slug,
        })
        .from(places)
        .innerJoin(regions, eq(regions.id, places.regionId));

      const candidateByRegion: Record<RegionSlug, Set<string>> = {
        scotland: new Set(),
        sindh: new Set(),
      };

      for (const row of placeRows) {
        if (isRegionSlug(row.regionSlug)) {
          candidateByRegion[row.regionSlug].add(row.cellR7);
        }
      }

      for (const slug of REGION_SLUGS) {
        for (const anchor of REGION_ANCHORS[slug]) {
          const centre = latLngToCell(anchor.lat, anchor.lng, 7);
          for (const cell of gridDisk(centre, 1)) {
            candidateByRegion[slug].add(cell);
          }
          // Guarantee a protected/highly_protected sibling pair under one display cell.
          const r5 = cellToParent(centre, 5);
          for (const child of cellToChildren(r5, 7).slice(0, 4)) {
            candidateByRegion[slug].add(child);
          }
        }
      }

      for (const slug of REGION_SLUGS) {
        const covered: string[] = [];
        for (const cell of [...candidateByRegion[slug]].sort()) {
          // cellToLatLng returns [lat, lng]; PostGIS Point is (lon, lat).
          const [lat, lng] = cellToLatLng(cell);
          const hit = await pool.query<{ ok: boolean }>(
            `
            SELECT EXISTS (
              SELECT 1
              FROM ref.regions r
              WHERE r.slug = $1
                AND ST_Covers(
                  r.geom,
                  ST_SetSRID(ST_MakePoint($2::float8, $3::float8), 4326)
                )
            ) AS ok
            `,
            [slug, lng, lat],
          );
          if (hit.rows[0]?.ok === true) {
            covered.push(cell);
          }
        }
        expect(covered.length, `${slug} audit grid`).toBeGreaterThanOrEqual(4);

        // Prefer keeping at least one res-5 sibling pair, then fill up to the cap.
        const picked: string[] = [];
        const seed = covered[0];
        if (seed !== undefined) {
          picked.push(seed);
          const parent5 = cellToParent(seed, 5);
          const sibling = covered.find(
            (cell) => cell !== seed && cellToParent(cell, 5) === parent5,
          );
          if (sibling !== undefined) {
            picked.push(sibling);
          }
        }
        for (const cell of covered) {
          if (picked.length >= GRID_CELLS_PER_REGION) {
            break;
          }
          if (!picked.includes(cell)) {
            picked.push(cell);
          }
        }
        cellsByRegion[slug] = picked;
      }

      // Keep /v1/challenges/current green regardless of wall-clock month.
      const today = new Date();
      const ymd = (d: Date): string => {
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${String(y)}-${m}-${day}`;
      };
      const start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
      );
      const end = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1),
      );
      await db
        .update(challenges)
        .set({ startsOn: ymd(start), endsOn: ymd(end), status: 'live' })
        .where(eq(challenges.slug, KINGFISHER_SLUG));
    } finally {
      await pool.end();
    }

    previousEnv = {
      DATABASE_URL_API: process.env['DATABASE_URL_API'],
      NODE_ENV: process.env['NODE_ENV'],
      WAITLIST_THROTTLE_DISABLED: process.env['WAITLIST_THROTTLE_DISABLED'],
      WEATHER_PROVIDER: process.env['WEATHER_PROVIDER'],
      TIDE_PROVIDER: process.env['TIDE_PROVIDER'],
    };
    process.env['DATABASE_URL_API'] = roleConnectionUrl(DATABASE_URL, 'ww_api', API_PASSWORD);
    process.env['NODE_ENV'] = 'test';
    process.env['WAITLIST_THROTTLE_DISABLED'] = '1';
    process.env['WEATHER_PROVIDER'] = 'mock';
    process.env['TIDE_PROVIDER'] = 'none';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication(apiNestOptions());
    configureApiApp(app);
    await app.init();
  }, 180_000);

  afterAll(async () => {
    await app.close();
    restoreEnv(previousEnv);
  });

  it('static public endpoints pass assertPublicSafe', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    for (const path of [
      '/v1/health',
      '/v1/regions',
      '/v1/attributions',
      '/v1/challenges/current',
      `/v1/challenges/${KINGFISHER_SLUG}`,
      `/v1/challenges/${KINGFISHER_SLUG}/entries`,
    ]) {
      const response = await request(server).get(path).expect(200);
      expectPublicSafe(response.body);
    }
  });

  it('region catalogue endpoints for both beta regions pass assertPublicSafe', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    for (const slug of REGION_SLUGS) {
      const species = await request(server).get(`/v1/regions/${slug}/species`).expect(200);
      expectPublicSafe(species.body);

      const placesRes = await request(server)
        .get('/v1/places')
        .query({ q: 'a', region: slug })
        .expect(200);
      expectPublicSafe(placesRes.body);
    }
  });

  it('every seeded taxon×region: species, seasonality, map pass assertPublicSafe', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    for (const link of seededLinks) {
      const detail = await request(server)
        .get(`/v1/species/${String(link.taxonId)}`)
        .query({ region: link.regionSlug })
        .expect(200);
      expectPublicSafe(detail.body);

      const seasonality = await request(server)
        .get(`/v1/species/${String(link.taxonId)}/seasonality`)
        .query({ region: link.regionSlug })
        .expect(200);
      expectPublicSafe(seasonality.body);

      const map = await request(server)
        .get(`/v1/species/${String(link.taxonId)}/map`)
        .query({ region: link.regionSlug })
        .expect(200);
      expectPublicSafe(map.body);

      // Map cells must not exceed the taxon's published tier resolution.
      const policy = TIER_POLICY[link.tier];
      const cells = (map.body as { cells?: { cell: string }[] }).cells ?? [];
      if (!policy.mapCells) {
        expect(cells).toEqual([]);
      } else if (typeof policy.resolution === 'number') {
        for (const entry of cells) {
          expect(getResolution(entry.cell)).toBeLessThanOrEqual(policy.resolution);
        }
        assertPublicSafe(map.body, {
          maxResolutionByTier: { [link.tier]: policy.resolution },
          h3Tier: link.tier,
        });
      }
    }
  }, 180_000);

  it('every grid cell in both regions: areas pass assertPublicSafe', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    for (const slug of REGION_SLUGS) {
      for (const cell of cellsByRegion[slug]) {
        const response = await request(server).get(`/v1/areas/${cell}`).expect(200);
        expectPublicSafe(response.body);
        expect(response.body).toMatchObject({
          cellR7: cell,
          covered: true,
          regionSlug: slug,
        });
      }
    }
  }, 120_000);

  it('every seeded taxon×region over the res-7 grid: forecast passes assertPublicSafe', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];

    for (const link of seededLinks) {
      const cells = cellsByRegion[link.regionSlug];
      for (const cell of cells) {
        const response = await request(server)
          .get('/v1/forecast')
          .query({
            taxonId: String(link.taxonId),
            cell,
            start: FORECAST_START,
          });
        if (response.status !== 200) {
          throw new Error(
            `forecast ${String(link.taxonId)}@${link.regionSlug}/${cell} → ${String(response.status)} ${JSON.stringify(response.body)}`,
          );
        }
        expectPublicSafe(response.body);
        expect(response.body).toMatchObject({
          taxonId: String(link.taxonId),
          tier: link.tier,
        });
      }
    }
  }, 300_000);

  it('sibling res-7 cells under the same display cell yield identical forecast bodies', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    let pairsChecked = 0;

    for (const link of seededLinks) {
      const cells = cellsByRegion[link.regionSlug];
      let siblingPair: { a: string; b: string } | null = null;

      for (const cell of cells) {
        const sibling = findDisplaySibling(cell, link.tier, cells);
        if (sibling !== null) {
          siblingPair = { a: cell, b: sibling };
          break;
        }
      }

      // Open tier: display cell is the res-7 cell itself — no distinct sibling.
      // Still require stability of a repeated request for the same cell.
      if (siblingPair === null) {
        expect(link.tier === 'open' || cells.length === 0).toBe(true);
        const cell = cells[0];
        if (cell === undefined) {
          continue;
        }
        const first = await request(server)
          .get('/v1/forecast')
          .query({ taxonId: String(link.taxonId), cell, start: FORECAST_START })
          .expect(200);
        const second = await request(server)
          .get('/v1/forecast')
          .query({ taxonId: String(link.taxonId), cell, start: FORECAST_START })
          .expect(200);
        expect(first.body).toEqual(second.body);
        expectPublicSafe(first.body);
        continue;
      }

      const { a, b } = siblingPair;
      if (link.tier !== 'no_forecast') {
        expect(displayCellFor(a, link.tier)).toBe(displayCellFor(b, link.tier));
      }
      expect(a).not.toBe(b);

      const responseA = await request(server)
        .get('/v1/forecast')
        .query({ taxonId: String(link.taxonId), cell: a, start: FORECAST_START })
        .expect(200);
      const responseB = await request(server)
        .get('/v1/forecast')
        .query({ taxonId: String(link.taxonId), cell: b, start: FORECAST_START })
        .expect(200);

      expect(responseA.body).toEqual(responseB.body);
      expectPublicSafe(responseA.body);
      pairsChecked += 1;
    }

    expect(pairsChecked).toBeGreaterThan(0);
  }, 300_000);
});

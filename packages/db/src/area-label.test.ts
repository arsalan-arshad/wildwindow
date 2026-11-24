import { cellToParent, latLngToCell } from 'h3-js';
import { Client } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

import { areaLabelFor, cellToWktPolygon, formatAreaLabel } from './area-label.js';
import { migrationsFolder, runMigrations } from './migrate.js';
import { seedAll } from './seed.js';

const DATABASE_URL =
  process.env['DATABASE_URL'] ?? 'postgresql://postgres:postgres@localhost:5432/wildwindow';

const COORD_LIKE = /[-+]?\d{1,3}\.\d+/;

describe('formatAreaLabel (unit)', () => {
  it('formats res 7 with place and zone', () => {
    expect(
      formatAreaLabel({
        resolution: 7,
        placeName: 'Glasgow',
        zoneName: 'Kelvin',
      }),
    ).toBe('Glasgow · Kelvin area');
  });

  it('formats coarser resolutions as zone-only style', () => {
    expect(
      formatAreaLabel({
        resolution: 5,
        placeName: 'Glasgow',
        zoneName: 'Lower Clyde',
      }),
    ).toBe('Lower Clyde area');
    expect(
      formatAreaLabel({
        resolution: 4,
        placeName: 'Inverness',
        zoneName: 'Highland',
      }),
    ).toBe('Highland area');
  });

  it('rejects coordinate-like numbers in parts', () => {
    expect(() =>
      formatAreaLabel({
        resolution: 7,
        placeName: '55.86',
        zoneName: 'Highland',
      }),
    ).toThrow(/coordinates/);
  });
});

describe('T2.9 area labels (integration)', () => {
  beforeAll(async () => {
    await runMigrations(DATABASE_URL, migrationsFolder());
    await seedAll(DATABASE_URL);
  });

  it('seeds council areas and districts', async () => {
    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
      const result = await client.query<{ slug: string; count: string }>(
        `
        SELECT r.slug, count(*)::text AS count
        FROM ref.zones z
        JOIN ref.regions r ON r.id = z.region_id
        WHERE r.slug = ANY($1::text[])
        GROUP BY r.slug
        ORDER BY r.slug
        `,
        [['scotland', 'sindh']],
      );
      const bySlug = Object.fromEntries(result.rows.map((r) => [r.slug, Number(r.count)]));
      expect(bySlug['scotland']).toBe(32);
      expect(bySlug['sindh']).toBe(23);
    } finally {
      await client.end();
    }
  });

  it('labels Glasgow/Karachi cells at res 7, 5 and 4 without coordinates', async () => {
    const glasgowR7 = latLngToCell(55.86515, -4.25763, 7);
    const karachiR7 = latLngToCell(24.8608, 67.0104, 7);

    for (const [label, cellR7] of [
      ['glasgow', glasgowR7],
      ['karachi', karachiR7],
    ] as const) {
      const res7 = await areaLabelFor(DATABASE_URL, cellR7);
      expect(res7, label).not.toBeNull();
      expect(res7?.resolution).toBe(7);
      expect(res7?.label).toMatch(/ area$/);
      expect(res7?.label).not.toMatch(COORD_LIKE);
      expect(cellToWktPolygon(cellR7)).toMatch(/^POLYGON/);

      const res5Cell = cellToParent(cellR7, 5);
      const res5 = await areaLabelFor(DATABASE_URL, res5Cell);
      expect(res5?.resolution).toBe(5);
      expect(res5?.label).toMatch(/ area$/);
      expect(res5?.label).not.toMatch(COORD_LIKE);
      // Coarser labels should not use the "Place · Zone" form.
      expect(res5?.label.includes('·')).toBe(false);

      const res4Cell = cellToParent(cellR7, 4);
      const res4 = await areaLabelFor(DATABASE_URL, res4Cell);
      expect(res4?.resolution).toBe(4);
      expect(res4?.label).toMatch(/ area$/);
      expect(res4?.label).not.toMatch(COORD_LIKE);
      expect(res4?.label.includes('·')).toBe(false);
    }

    const glasgow = await areaLabelFor(DATABASE_URL, glasgowR7);
    expect(glasgow?.regionSlug).toBe('scotland');
    expect(glasgow?.label.toLowerCase()).toContain('glasgow');

    const karachi = await areaLabelFor(DATABASE_URL, karachiR7);
    expect(karachi?.regionSlug).toBe('sindh');
    expect(karachi?.label.toLowerCase()).toContain('karachi');
  });
});

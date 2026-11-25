import { FORBIDDEN_PUBLIC_KEYS } from '@wildwindow/geoprivacy';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { OwnerExactLocationSchema } from './logbook.js';
import { OWNER_API_SCHEMAS, PUBLIC_API_SCHEMAS } from './registry.js';
import { collectZodObjectKeys } from './schema-keys.js';

const forbidden = new Set(FORBIDDEN_PUBLIC_KEYS.map((key) => key.toLowerCase()));

describe('public API schemas (T5.1)', () => {
  it('exports the assertPublicSafe forbidden key list for reuse', () => {
    expect(FORBIDDEN_PUBLIC_KEYS).toEqual(
      expect.arrayContaining([
        'lat',
        'lng',
        'lon',
        'long',
        'latitude',
        'longitude',
        'coordinates',
        'geom',
        'point',
        'wkt',
      ]),
    );
  });

  it('fails if any public schema declares a forbidden coordinate key', () => {
    const violations: string[] = [];

    for (const [index, schema] of PUBLIC_API_SCHEMAS.entries()) {
      const keys = collectZodObjectKeys(schema);
      for (const key of keys) {
        if (forbidden.has(key.toLowerCase())) {
          violations.push(`schema[${String(index)}] key "${key}"`);
        }
      }
    }

    expect(violations, violations.join('; ')).toEqual([]);
  });

  it('keeps owner-only schemas out of the public registry', () => {
    for (const owner of OWNER_API_SCHEMAS) {
      expect(PUBLIC_API_SCHEMAS).not.toContain(owner);
    }
  });

  it('allows lat/lng only on the owner exact-location schema', () => {
    const ownerKeys = collectZodObjectKeys(OwnerExactLocationSchema);
    expect(ownerKeys.has('lat')).toBe(true);
    expect(ownerKeys.has('lng')).toBe(true);

    // Sanity: a deliberately dirty public schema would be caught.
    const dirty = z.object({ label: z.string(), lat: z.number() });
    const dirtyKeys = collectZodObjectKeys(dirty);
    expect([...dirtyKeys].some((key) => forbidden.has(key.toLowerCase()))).toBe(true);
  });
});

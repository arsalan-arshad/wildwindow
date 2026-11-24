import { describe, expect, it } from 'vitest';

import {
  assertLicenseAllowlist,
  buildPredicate,
  findLicenseInPredicate,
  GBIF_LICENSE_ALLOWLIST,
  type AndPredicate,
  type GbifPredicateNode,
  type InPredicate,
} from './predicate.js';

const SAMPLE_KEYS = [2498262, 5219173] as const;

describe('buildPredicate', () => {
  it('builds a scotland target predicate (snapshot)', () => {
    const predicate = buildPredicate({
      region: 'scotland',
      kind: 'target',
      taxonKeys: SAMPLE_KEYS,
    });
    expect(predicate).toMatchSnapshot();
  });

  it('builds a sindh effort predicate (snapshot)', () => {
    const predicate = buildPredicate({
      region: 'sindh',
      kind: 'effort',
      taxonKeys: [212, 359],
    });
    expect(predicate).toMatchSnapshot();
  });

  it('uses COUNTRY=GB for scotland and GADM_GID=PAK.8_1 for sindh', () => {
    const scotland = buildPredicate({
      region: 'scotland',
      kind: 'target',
      taxonKeys: SAMPLE_KEYS,
    });
    const sindh = buildPredicate({
      region: 'sindh',
      kind: 'target',
      taxonKeys: SAMPLE_KEYS,
    });

    expect(scotland.predicates).toEqual(
      expect.arrayContaining([{ type: 'equals', key: 'COUNTRY', value: 'GB' }]),
    );
    expect(sindh.predicates).toEqual(
      expect.arrayContaining([{ type: 'equals', key: 'GADM_GID', value: 'PAK.8_1' }]),
    );
  });

  it('dedupes and sorts taxon keys as strings', () => {
    const predicate = buildPredicate({
      region: 'scotland',
      kind: 'target',
      taxonKeys: [5219173, 2498262, 2498262],
    });
    const taxon = predicate.predicates.find(
      (p): p is InPredicate => p.type === 'in' && p.key === 'TAXON_KEY',
    );
    expect(taxon?.values).toEqual(['2498262', '5219173']);
  });

  it('rejects an empty taxonKeys list', () => {
    expect(() => buildPredicate({ region: 'scotland', kind: 'target', taxonKeys: [] })).toThrow(
      /at least one taxonKey/,
    );
  });

  it('always includes exactly CC0_1_0 and CC_BY_4_0', () => {
    for (const region of ['scotland', 'sindh'] as const) {
      for (const kind of ['target', 'effort'] as const) {
        const predicate = buildPredicate({
          region,
          kind,
          taxonKeys: SAMPLE_KEYS,
        });
        const license = findLicenseInPredicate(predicate);
        expect(license).toBeDefined();
        expect([...(license?.values ?? [])].sort()).toEqual([...GBIF_LICENSE_ALLOWLIST].sort());
        expect(() => {
          assertLicenseAllowlist(predicate);
        }).not.toThrow();
      }
    }
  });
});

describe('assertLicenseAllowlist', () => {
  function withLicense(values: readonly string[]): AndPredicate {
    return {
      type: 'and',
      predicates: [
        { type: 'equals', key: 'HAS_COORDINATE', value: 'true' },
        { type: 'in', key: 'LICENSE', values },
      ],
    };
  }

  it('fails when LICENSE is missing', () => {
    const predicate: GbifPredicateNode = {
      type: 'and',
      predicates: [{ type: 'equals', key: 'HAS_COORDINATE', value: 'true' }],
    };
    expect(() => {
      assertLicenseAllowlist(predicate);
    }).toThrow(/missing LICENSE/);
  });

  it('fails when an extra licence is present', () => {
    expect(() => {
      assertLicenseAllowlist(withLicense(['CC0_1_0', 'CC_BY_4_0', 'CC_BY_NC_4_0']));
    }).toThrow(/LICENSE allowlist/);
  });

  it('fails when a required licence is dropped', () => {
    expect(() => {
      assertLicenseAllowlist(withLicense(['CC0_1_0']));
    }).toThrow(/LICENSE allowlist/);
  });
});

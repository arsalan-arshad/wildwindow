/**
 * GBIF occurrence download predicate builder (§3.2 step 1).
 *
 * Region geography (ARCHITECTURE):
 * - scotland → GADM_GID = GBR.3_1 (looked up 2026-11-25 via
 *   GET https://api.gbif.org/v1/geocode/gadm/search?q=Scotland —
 *   Constituent Country under United Kingdom; not COUNTRY=GB, which pulls
 *   all of Great Britain and made the T3.9 effort download ~6 GB)
 * - sindh → GADM_GID = PAK.8_1 (looked up 2026-11-24 via
 *   GET https://api.gbif.org/v1/geocode/gadm/search?q=Sindh)
 *
 * `kind` is accepted for the T3.2 API; target vs effort differ only in which
 * `taxonKeys` the caller passes (beta species vs effort-group classes).
 */

export const GBIF_LICENSE_ALLOWLIST = ['CC0_1_0', 'CC_BY_4_0'] as const;

export const GBIF_BASIS_OF_RECORD = [
  'HUMAN_OBSERVATION',
  'MACHINE_OBSERVATION',
  'OBSERVATION',
] as const;

export const GBIF_MIN_YEAR = 2005;

export type IngestRegion = 'scotland' | 'sindh';
export type IngestKind = 'target' | 'effort';

export type EqualsPredicate = {
  readonly type: 'equals';
  readonly key: string;
  readonly value: string;
};

export type InPredicate = {
  readonly type: 'in';
  readonly key: string;
  readonly values: readonly string[];
};

export type GreaterThanOrEqualsPredicate = {
  readonly type: 'greaterThanOrEquals';
  readonly key: string;
  readonly value: string;
};

export type AndPredicate = {
  readonly type: 'and';
  readonly predicates: readonly GbifPredicateNode[];
};

export type GbifPredicateNode =
  EqualsPredicate | InPredicate | GreaterThanOrEqualsPredicate | AndPredicate;

export type BuildPredicateInput = {
  readonly region: IngestRegion;
  readonly kind: IngestKind;
  readonly taxonKeys: readonly number[];
};

/** Exact licence set required in every download predicate. */
export function licenseAllowlistValues(): readonly string[] {
  return [...GBIF_LICENSE_ALLOWLIST];
}

function regionGeoPredicate(region: IngestRegion): EqualsPredicate {
  if (region === 'scotland') {
    return { type: 'equals', key: 'GADM_GID', value: 'GBR.3_1' };
  }
  return { type: 'equals', key: 'GADM_GID', value: 'PAK.8_1' };
}

function licensePredicate(): InPredicate {
  return {
    type: 'in',
    key: 'LICENSE',
    values: licenseAllowlistValues(),
  };
}

/**
 * Walk a predicate tree and return the LICENSE `in` node, if present.
 */
export function findLicenseInPredicate(node: GbifPredicateNode): InPredicate | undefined {
  if (node.type === 'in' && node.key === 'LICENSE') {
    return node;
  }
  if (node.type === 'and') {
    for (const child of node.predicates) {
      const found = findLicenseInPredicate(child);
      if (found !== undefined) {
        return found;
      }
    }
  }
  return undefined;
}

/**
 * Assert the predicate always allows only CC0_1_0 and CC_BY_4_0.
 * Throws when LICENSE is missing or the value set differs.
 */
export function assertLicenseAllowlist(predicate: GbifPredicateNode): void {
  const license = findLicenseInPredicate(predicate);
  if (license === undefined) {
    throw new Error('GBIF predicate is missing LICENSE allowlist');
  }
  const expected = licenseAllowlistValues();
  const actual = [...license.values].sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((v, i) => v !== wanted[i])) {
    throw new Error(
      `GBIF LICENSE allowlist must be exactly [${wanted.join(', ')}]; got [${actual.join(', ')}]`,
    );
  }
}

/**
 * Build the §3.2 download predicate for a region + kind + taxon key set.
 */
export function buildPredicate(input: BuildPredicateInput): AndPredicate {
  if (input.taxonKeys.length === 0) {
    throw new Error('buildPredicate requires at least one taxonKey');
  }

  const uniqueSortedKeys = [...new Set(input.taxonKeys)]
    .filter((k) => Number.isInteger(k) && k > 0)
    .sort((a, b) => a - b);

  if (uniqueSortedKeys.length === 0) {
    throw new Error('buildPredicate requires positive integer taxonKeys');
  }

  // kind is part of the public API; both kinds share the same predicate shape.
  // Callers pass different taxonKeys for target vs effort.
  switch (input.kind) {
    case 'target':
    case 'effort':
      break;
    default: {
      const _exhaustive: never = input.kind;
      throw new Error(`buildPredicate: unsupported kind ${String(_exhaustive)}`);
    }
  }

  const predicate: AndPredicate = {
    type: 'and',
    predicates: [
      {
        type: 'in',
        key: 'TAXON_KEY',
        values: uniqueSortedKeys.map(String),
      },
      regionGeoPredicate(input.region),
      licensePredicate(),
      { type: 'equals', key: 'HAS_COORDINATE', value: 'true' },
      { type: 'equals', key: 'HAS_GEOSPATIAL_ISSUE', value: 'false' },
      {
        type: 'in',
        key: 'BASIS_OF_RECORD',
        values: [...GBIF_BASIS_OF_RECORD],
      },
      {
        type: 'greaterThanOrEquals',
        key: 'YEAR',
        value: String(GBIF_MIN_YEAR),
      },
    ],
  };

  assertLicenseAllowlist(predicate);
  return predicate;
}

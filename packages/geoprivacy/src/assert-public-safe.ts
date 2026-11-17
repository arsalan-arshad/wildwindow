import { getResolution, isValidCell } from 'h3-js';

import { GeoPrivacyViolation } from './errors.js';
import { type Tier } from './tiers.js';

/** Forbidden coordinate / geometry keys (any case) — ARCHITECTURE §5.3. */
const FORBIDDEN_KEYS = new Set(
  ['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'geom', 'point', 'wkt'].map((key) =>
    key.toLowerCase(),
  ),
);

export type AssertPublicSafeOptions = {
  /** Maximum allowed H3 resolution for each tier present in the payload context. */
  maxResolutionByTier: Partial<Record<Tier, number | null>>;
  /** When true, skip forbidden-key checks (owner-only routes). H3 resolution still enforced. */
  allowOwnerLocation?: boolean;
  /**
   * Tier used when validating H3 strings found in the payload.
   * Defaults to the coarsest (lowest resolution number allowed) across maxResolutionByTier.
   */
  h3Tier?: Tier;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function looksLikeH3(value: string): boolean {
  return /^[0-9a-f]+$/i.test(value) && value.length >= 15 && isValidCell(value);
}

function maxAllowedResolution(opts: AssertPublicSafeOptions): number | null {
  if (opts.h3Tier !== undefined) {
    const fromTier = opts.maxResolutionByTier[opts.h3Tier];
    return fromTier === undefined ? null : fromTier;
  }
  let max: number | null = null;
  for (const raw of Object.values(opts.maxResolutionByTier)) {
    if (typeof raw !== 'number') {
      continue;
    }
    if (max === null || raw > max) {
      max = raw;
    }
  }
  return max;
}

function walk(value: unknown, opts: AssertPublicSafeOptions, path: string): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walk(item, opts, `${path}[${String(index)}]`);
    });
    return;
  }

  if (typeof value === 'string' && looksLikeH3(value)) {
    const allowed = maxAllowedResolution(opts);
    if (allowed === null) {
      throw new GeoPrivacyViolation(
        `H3 cell at ${path || '(root)'} is forbidden when no public resolution is allowed`,
      );
    }
    const resolution = getResolution(value);
    if (resolution > allowed) {
      throw new GeoPrivacyViolation(
        `H3 cell at ${path || '(root)'} has res-${String(resolution)} finer than allowed res-${String(allowed)}`,
      );
    }
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (!opts.allowOwnerLocation && FORBIDDEN_KEYS.has(key.toLowerCase())) {
      throw new GeoPrivacyViolation(`Forbidden key "${key}" at ${path || '(root)'}`);
    }
    const childPath = path.length === 0 ? key : `${path}.${key}`;
    walk(child, opts, childPath);
  }
}

/**
 * Walk any JSON-like payload and throw `GeoPrivacyViolation` on forbidden
 * coordinate keys or H3 cells finer than the tier allows (§5.3 / §5.2).
 */
export function assertPublicSafe(payload: unknown, opts: AssertPublicSafeOptions): void {
  walk(payload, opts, '');
}

import { cellToParent, getResolution, isValidCell, latLngToCell } from 'h3-js';

import { GeoPrivacyError } from './errors.js';
import { TIER_POLICY, type Tier } from './tiers.js';

const DEFAULT_RES = 7;

function assertFiniteNumber(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GeoPrivacyError(`${name} must be a finite number`);
  }
}

/**
 * Snap WGS84 coordinates to an H3 cell (default res 7). Deterministic — no jitter.
 * Used on-device; callers must discard lat/lng after snapping.
 */
export function snapToCell(lat: number, lng: number, res = DEFAULT_RES): string {
  assertFiniteNumber('lat', lat);
  assertFiniteNumber('lng', lng);
  assertFiniteNumber('res', res);
  if (lat < -90 || lat > 90) {
    throw new GeoPrivacyError(`lat out of range: ${String(lat)}`);
  }
  if (lng < -180 || lng > 180) {
    throw new GeoPrivacyError(`lng out of range: ${String(lng)}`);
  }
  if (!Number.isInteger(res) || res < 0 || res > 15) {
    throw new GeoPrivacyError(`res must be an integer 0–15, got ${String(res)}`);
  }
  return latLngToCell(lat, lng, res);
}

function assertValidRes7Cell(cellR7: string): void {
  if (typeof cellR7 !== 'string' || cellR7.length === 0) {
    throw new GeoPrivacyError('cellR7 must be a non-empty H3 index string');
  }
  if (!isValidCell(cellR7)) {
    throw new GeoPrivacyError(`invalid H3 cell: ${cellR7}`);
  }
  const resolution = getResolution(cellR7);
  if (resolution !== DEFAULT_RES) {
    throw new GeoPrivacyError(`expected res-${String(DEFAULT_RES)} cell, got res-${String(resolution)}`);
  }
}

/**
 * Raise a user res-7 cell to the public display resolution for `tier`.
 * Returns `null` for `no_forecast`.
 */
export function displayCellFor(userCellR7: string, tier: Tier): string | null {
  assertValidRes7Cell(userCellR7);
  if (!(tier in TIER_POLICY)) {
    throw new GeoPrivacyError(`unknown tier: ${tier}`);
  }
  const resolution = TIER_POLICY[tier].resolution;
  if (resolution === null) {
    return null;
  }
  if (resolution === DEFAULT_RES) {
    return userCellR7;
  }
  if (resolution > DEFAULT_RES) {
    throw new GeoPrivacyError(`tier resolution ${String(resolution)} is finer than res-7 input`);
  }
  return cellToParent(userCellR7, resolution);
}

/**
 * Activity-pattern hourly templates (§4.2 T / T4.4).
 * Relative weights for hours 0–23 (local). Used when a taxon hour profile
 * has fewer than `SCORING_V1.hourProfileMinRecords` timed records.
 *
 * Shapes are qualitative priors (not fitted to data):
 * - diurnal: day-active, peak mid-morning to mid-afternoon
 * - crepuscular: dawn and dusk peaks
 * - nocturnal: night-active
 * - tidal: relatively flat clock prior (tide drives more than hour-of-day)
 */
import type { ActivityPattern } from './activity-pattern.js';

function weights(values: readonly number[]): readonly number[] {
  if (values.length !== 24) {
    throw new RangeError(`activity template must have 24 hours, got ${String(values.length)}`);
  }
  return values;
}

/** Relative (unnormalized) hourly weights — smoothed + normalized by `hourlyShares`. */
export const ACTIVITY_TEMPLATES: Readonly<Record<ActivityPattern, readonly number[]>> = {
  diurnal: weights([
    0.05, 0.05, 0.05, 0.05, 0.05, 0.15, 0.5, 0.5, 0.7, 1, 1, 1, 1, 1, 1, 0.7, 0.5, 0.5, 0.15, 0.05,
    0.05, 0.05, 0.05, 0.05,
  ]),
  crepuscular: weights([
    0.1, 0.1, 0.1, 0.1, 0.4, 1, 1, 0.7, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.7, 1, 1,
    0.4, 0.1, 0.1, 0.1, 0.1,
  ]),
  nocturnal: weights([
    1, 1, 1, 1, 1, 0.7, 0.3, 0.15, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.15, 0.3, 0.7,
    1, 1, 1, 1, 1,
  ]),
  tidal: weights([
    0.4, 0.4, 0.45, 0.5, 0.55, 0.65, 0.75, 0.85, 0.95, 1, 1.05, 1.1, 1.1, 1.05, 1, 0.95, 0.85, 0.75,
    0.65, 0.55, 0.5, 0.45, 0.4, 0.4,
  ]),
};

export { SCORING_V1, type ScoringV1 } from './config/v1.js';
export {
  factorH,
  p95,
  percentile,
  reportingRate,
  type FactorHInput,
  type ReportingRateInput,
} from './reporting-rate.js';
export { weeksAround } from './weeks.js';
export type {
  Confidence,
  DayFactors,
  DayLightWindows,
  ForecastDay,
  ForecastInput,
  ForecastLockout,
  ForecastNotCovered,
  ForecastOk,
  ForecastResponse,
  ForecastStatus,
  ForecastUnavailable,
  LocalHm,
  TimeBlock,
} from './types.js';
// Light helpers also available via `@wildwindow/scoring/light` for mobile/web.
export {
  candidateBlocks,
  goldenFraction,
  lightForDay,
  sunAltitudeDeg,
  type LatLng,
  type LightDay,
  type LightInterval,
} from './light.js';

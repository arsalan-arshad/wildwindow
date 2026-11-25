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

export { ACTIVITY_PATTERNS, isActivityPattern, type ActivityPattern } from './activity-pattern.js';
export { ACTIVITY_TEMPLATES } from './activity-templates.js';
export {
  blockMass,
  factorT,
  hourlyShares,
  smoothHourlyCounts,
  startHourFromHm,
} from './factor-t.js';
export { factorG } from './factor-g.js';
export {
  factorWx,
  rainFactor,
  resolvePrecipProb,
  windFactor,
  type FactorWxResult,
  type HourlyWeatherSample,
} from './factor-wx.js';
export { factorD, type FactorDResult, type TideExtremes } from './factor-d.js';
export { isTidePref, TIDE_PREFS, type TidePref } from './tide-pref.js';
export {
  createTideProvider,
  createTideProviderFromEnv,
  NoTideProvider,
  parseTideProviderId,
  TIDE_PROVIDER_NONE,
  toTideExtremes,
  type TideExtreme,
  type TideProvider,
  type TideProviderId,
} from './tide-provider.js';
export { conditionsC, dayScore } from './combine.js';
export { confidenceLabel, confidenceRange, type ConfidenceInput } from './confidence.js';
export {
  computeForecast,
  type ComputeForecastInput,
  type DayWeatherInput,
  type HistoryInput,
} from './compute-forecast.js';

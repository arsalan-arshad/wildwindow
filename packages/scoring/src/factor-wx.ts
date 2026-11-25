/**
 * Factor Wx — weather for a 2-hour block (§4.2 / T4.5).
 */
import { SCORING_V1 } from './config/v1.js';

export type HourlyWeatherSample = {
  /** 0..1 when the provider supplies it; omit/null to derive from precipMm. */
  readonly precipProb?: number | null;
  readonly precipMm: number;
  readonly windKph: number;
};

export type FactorWxResult = {
  readonly value: number;
  /** Numeric Wx, or the beyond-horizon flag for the day breakdown (§4.2). */
  readonly weather: number | 'no_forecast_yet';
};

/**
 * Derive precip probability when the provider only gives amount
 * (ARCHITECTURE §3.4: `min(1, precipMm / precipMmForCertain)`).
 */
export function resolvePrecipProb(sample: {
  readonly precipProb?: number | null;
  readonly precipMm: number;
}): number {
  if (
    typeof sample.precipMm !== 'number' ||
    !Number.isFinite(sample.precipMm) ||
    sample.precipMm < 0
  ) {
    throw new RangeError(`precipMm must be a non-negative finite number`);
  }
  if (sample.precipProb !== undefined && sample.precipProb !== null) {
    if (
      typeof sample.precipProb !== 'number' ||
      !Number.isFinite(sample.precipProb) ||
      sample.precipProb < 0 ||
      sample.precipProb > 1
    ) {
      throw new RangeError(`precipProb must be in [0, 1], got ${String(sample.precipProb)}`);
    }
    return sample.precipProb;
  }
  return Math.min(1, sample.precipMm / SCORING_V1.weather.precipMmForCertain);
}

/** Rain factor from max precip probability in the block. */
export function rainFactor(maxPrecipProb: number): number {
  if (
    typeof maxPrecipProb !== 'number' ||
    !Number.isFinite(maxPrecipProb) ||
    maxPrecipProb < 0 ||
    maxPrecipProb > 1
  ) {
    throw new RangeError(`maxPrecipProb must be in [0, 1], got ${String(maxPrecipProb)}`);
  }
  return 1 - SCORING_V1.weather.rainWeight * maxPrecipProb;
}

/**
 * Wind factor from max wind speed (km/h) in the block.
 * ≤ calm → 1; ≥ gale → floor; linear between.
 */
export function windFactor(maxWindKph: number): number {
  if (typeof maxWindKph !== 'number' || !Number.isFinite(maxWindKph) || maxWindKph < 0) {
    throw new RangeError(`maxWindKph must be a non-negative finite number`);
  }
  const { windCalmKph, windGaleKph, windFloor } = SCORING_V1.weather;
  if (maxWindKph <= windCalmKph) {
    return 1;
  }
  if (maxWindKph >= windGaleKph) {
    return windFloor;
  }
  // 1 − 0.5 · (V − 20) / 30  for 20 < V < 50
  return 1 - windFloor * ((maxWindKph - windCalmKph) / (windGaleKph - windCalmKph));
}

/**
 * Wx_b = f_rain · f_wind over hourly samples inside the block.
 * Beyond the provider horizon → 0.85 and flag `no_forecast_yet`.
 */
export function factorWx(params: {
  readonly beyondHorizon?: boolean;
  readonly hours: readonly HourlyWeatherSample[];
}): FactorWxResult {
  if (params.beyondHorizon === true) {
    const value = SCORING_V1.weather.beyondHorizon;
    return { value, weather: 'no_forecast_yet' };
  }
  if (params.hours.length === 0) {
    // No samples and not explicitly beyond horizon — treat as unknown/neutral.
    const value = SCORING_V1.weather.beyondHorizon;
    return { value, weather: 'no_forecast_yet' };
  }

  let maxProb = 0;
  let maxWind = 0;
  for (const hour of params.hours) {
    if (typeof hour.windKph !== 'number' || !Number.isFinite(hour.windKph) || hour.windKph < 0) {
      throw new RangeError(`windKph must be a non-negative finite number`);
    }
    maxProb = Math.max(maxProb, resolvePrecipProb(hour));
    maxWind = Math.max(maxWind, hour.windKph);
  }

  const value = rainFactor(maxProb) * windFactor(maxWind);
  return { value, weather: value };
}

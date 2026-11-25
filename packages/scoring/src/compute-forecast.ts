/**
 * `computeForecast` — Window score v1 for a 7-day window (§4.3–§4.5 / T4.6).
 * Pure: caller supplies history, hour profile, weather and tide samples.
 */
import { isInLockout } from '@wildwindow/geoprivacy';

import { conditionsC, dayScore } from './combine.js';
import { confidenceLabel, confidenceRange } from './confidence.js';
import { SCORING_V1 } from './config/v1.js';
import { buildExplanations } from './explanations.js';
import { factorD, type TideExtremes } from './factor-d.js';
import { factorG } from './factor-g.js';
import { factorT, hourlyShares, startHourFromHm } from './factor-t.js';
import { factorWx, type HourlyWeatherSample } from './factor-wx.js';
import { goldenFraction, lightForDay } from './light.js';
import { factorH } from './reporting-rate.js';
import { formatLocalYmd, zonedLocalDateTime } from './tz.js';

import type { ActivityPattern } from './activity-pattern.js';
import type { TidePref } from './tide-pref.js';
import type { DayFactors, ForecastDay, ForecastInput, ForecastResponse } from './types.js';

export type HistoryInput = {
  readonly nSpecies: number;
  readonly nEffort: number;
  readonly regionEffort: number;
  readonly regionRate: number;
  readonly rrRef: number;
  readonly distinctYears: number;
};

export type DayWeatherInput = {
  /** True when this local day is beyond the provider forecast horizon. */
  readonly beyondHorizon?: boolean;
  /**
   * Hourly samples keyed by local hour 0–23 (values used for hours inside each block).
   * Missing hours inside a block are treated as beyond-horizon for that block.
   */
  readonly byHour?: Readonly<Partial<Record<number, HourlyWeatherSample>>>;
};

export type ComputeForecastInput = ForecastInput & {
  /** False when the display cell is outside beta coverage (§4.5). */
  readonly covered: boolean;
  readonly history: HistoryInput;
  readonly hourProfile: {
    readonly counts: readonly number[];
    readonly activityPattern: ActivityPattern;
  };
  readonly weatherByDate: Readonly<Record<string, DayWeatherInput>>;
  readonly tidePref?: TidePref | null;
  /** Tide extremes per local date; omit/null → tide not used. */
  readonly tidesByDate?: Readonly<Record<string, TideExtremes | null>>;
  /** Optional common name for explanation templates. */
  readonly commonName?: string;
};

const FORECAST_DAYS = 7;

function addLocalDays(startYmd: string, timeZone: string, days: number): string {
  const noon = zonedLocalDateTime(startYmd, '12:00', timeZone);
  const shifted = new Date(noon.getTime() + days * 24 * 60 * 60 * 1000);
  return formatLocalYmd(shifted, timeZone);
}

function emptyUnavailable(
  input: ComputeForecastInput,
  explanations: readonly string[],
): ForecastResponse {
  return {
    status: 'unavailable',
    scoringVersion: SCORING_V1.version,
    taxonId: input.taxonId,
    tier: input.tier,
    timeZone: input.timeZone,
    displayCell: null,
    areaLabel: null,
    weekScore: null,
    bestDay: null,
    confidence: null,
    range: null,
    days: null,
    explanations,
  };
}

function weatherForBlock(params: {
  readonly date: string;
  readonly startHour: number;
  readonly weatherByDate: Readonly<Record<string, DayWeatherInput>>;
}): ReturnType<typeof factorWx> {
  const dayWx = params.weatherByDate[params.date];
  if (dayWx === undefined || dayWx.beyondHorizon === true) {
    return factorWx({ beyondHorizon: true, hours: [] });
  }
  const hours: HourlyWeatherSample[] = [];
  for (let i = 0; i < SCORING_V1.light.blockHours; i += 1) {
    const h = (params.startHour + i) % 24;
    const sample = dayWx.byHour?.[h];
    if (sample === undefined) {
      return factorWx({ beyondHorizon: true, hours: [] });
    }
    hours.push(sample);
  }
  return factorWx({ hours });
}

function scoreOneDay(params: {
  readonly date: string;
  readonly input: ComputeForecastInput;
  readonly h: number;
  readonly shares: readonly number[];
}): ForecastDay {
  const { date, input, h, shares } = params;
  const light = lightForDay({
    date,
    timeZone: input.timeZone,
    lat: input.lat,
    lng: input.lng,
  });

  const candidateStartHours = light.candidateBlocks.map((b) => startHourFromHm(b.start));

  // Golden windows as Date pairs for fraction overlap.
  const goldenAm =
    light.goldenAm === null
      ? null
      : ([
          zonedLocalDateTime(date, light.goldenAm[0], input.timeZone),
          zonedLocalDateTime(date, light.goldenAm[1], input.timeZone),
        ] as const);
  const goldenPm =
    light.goldenPm === null
      ? null
      : ([
          zonedLocalDateTime(date, light.goldenPm[0], input.timeZone),
          zonedLocalDateTime(date, light.goldenPm[1], input.timeZone),
        ] as const);

  type Candidate = {
    readonly block: { readonly start: string; readonly end: string };
    readonly startHour: number;
    readonly c: number;
    readonly factors: DayFactors;
  };

  const scored: Candidate[] = [];

  for (const block of light.candidateBlocks) {
    const startHour = startHourFromHm(block.start);
    const blockStart = zonedLocalDateTime(date, block.start, input.timeZone);
    const blockEnd = zonedLocalDateTime(date, block.end, input.timeZone);

    const t = factorT({
      shares,
      blockStartHour: startHour,
      candidateStartHours,
    });
    const gFrac = goldenFraction({
      blockStart,
      blockEnd,
      goldenAm,
      goldenPm,
    });
    const g = factorG(gFrac);
    const wx = weatherForBlock({
      date,
      startHour,
      weatherByDate: input.weatherByDate,
    });
    const tide = factorD({
      tidePref: input.tidePref,
      blockStart,
      blockEnd,
      tides: input.tidesByDate?.[date] ?? null,
    });
    const c = conditionsC({ t, g, wx: wx.value, d: tide.value });
    scored.push({
      block,
      startHour,
      c,
      factors: {
        seasonality: h,
        timeOfDay: t,
        light: g,
        weather: wx.weather,
        tide: tide.tide,
      },
    });
  }

  if (scored.length === 0) {
    return {
      date,
      score: dayScore(h, 0),
      bestBlock: { start: '00:00', end: '02:00' },
      factors: {
        seasonality: h,
        timeOfDay: 0,
        light: factorG(0),
        weather: 'no_forecast_yet',
        tide: 'not_used',
      },
      light: {
        goldenAm: light.goldenAm,
        goldenPm: light.goldenPm,
      },
    };
  }

  let best = scored[0];
  if (best === undefined) {
    throw new Error('scored candidates unexpectedly empty');
  }
  for (const cand of scored) {
    if (cand.c > best.c) {
      best = cand;
    }
  }

  return {
    date,
    score: dayScore(h, best.c),
    bestBlock: { start: best.block.start, end: best.block.end },
    factors: best.factors,
    light: {
      goldenAm: light.goldenAm,
      goldenPm: light.goldenPm,
    },
  };
}

/**
 * Compute a 7-day Window score forecast.
 * Status overrides (§4.5) are checked before scoring.
 */
export function computeForecast(input: ComputeForecastInput): ForecastResponse {
  const version = SCORING_V1.version;

  if (input.tier === 'no_forecast') {
    return emptyUnavailable(input, [
      'Forecasts are not published for this species (sensitivity tier)',
    ]);
  }

  if (!input.covered) {
    return {
      status: 'not_covered',
      scoringVersion: version,
      taxonId: input.taxonId,
      tier: input.tier,
      timeZone: input.timeZone,
      displayCell: null,
      areaLabel: input.areaLabel,
      weekScore: null,
      bestDay: null,
      confidence: null,
      range: null,
      days: null,
      explanations: ['This area is outside the current beta coverage'],
    };
  }

  // Lockout: any day in the 7-day window whose local month is in lockoutMonths.
  if (input.lockoutMonths.length > 0) {
    for (let i = 0; i < FORECAST_DAYS; i += 1) {
      const date = addLocalDays(input.startDate, input.timeZone, i);
      const noon = zonedLocalDateTime(date, '12:00', input.timeZone);
      if (isInLockout(noon, input.lockoutMonths, input.timeZone)) {
        const reason =
          input.lockoutReason ??
          'Forecasts are paused during the breeding / nesting lockout period';
        return {
          status: 'lockout',
          scoringVersion: version,
          taxonId: input.taxonId,
          tier: input.tier,
          timeZone: input.timeZone,
          displayCell: input.displayCell,
          areaLabel: input.areaLabel,
          weekScore: null,
          bestDay: null,
          confidence: null,
          range: null,
          days: null,
          reason,
          explanations: [reason],
        };
      }
    }
  }

  const h = factorH({
    nSpecies: input.history.nSpecies,
    nEffort: input.history.nEffort,
    regionEffort: input.history.regionEffort,
    regionRate: input.history.regionRate,
    rrRef: input.history.rrRef,
  });

  const shares = hourlyShares(input.hourProfile.counts, input.hourProfile.activityPattern);

  const days: ForecastDay[] = [];
  for (let i = 0; i < FORECAST_DAYS; i += 1) {
    const date = addLocalDays(input.startDate, input.timeZone, i);
    days.push(scoreOneDay({ date, input, h, shares }));
  }

  let best = days[0];
  if (best === undefined) {
    throw new Error('forecast days unexpectedly empty');
  }
  for (const day of days) {
    if (day.score > best.score) {
      best = day;
    }
  }

  const confidence = confidenceLabel({
    nSpecies: input.history.nSpecies,
    nEffort: input.history.nEffort,
    distinctYears: input.history.distinctYears,
    regionEffort: input.history.regionEffort,
  });
  const weekScore = best.score;
  const range = confidenceRange(weekScore, confidence);

  const explanations = buildExplanations({
    ...(input.commonName === undefined ? {} : { commonName: input.commonName }),
    bestDay: best,
    confidence,
  });

  return {
    status: 'ok',
    scoringVersion: version,
    taxonId: input.taxonId,
    tier: input.tier,
    timeZone: input.timeZone,
    displayCell: input.displayCell,
    areaLabel: input.areaLabel,
    weekScore,
    bestDay: best.date,
    confidence,
    range,
    days,
    explanations,
  };
}

/** Exported for the §4.6 worked-example unit test without full light/weather. */
export { conditionsC, dayScore };

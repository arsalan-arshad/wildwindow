import type { ForecastOk } from '@wildwindow/shared/api';

import { assertCardCopyPublicSafe } from '@/lib/og/public-safe';

/** Public fields only — never cell ids or coordinates (T7.4 acceptance). */
export type ForecastCardModel = {
  readonly commonName: string;
  readonly scientificName: string;
  readonly areaLabel: string;
  readonly weekScore: number;
  readonly confidence: string;
  readonly bestDayLabel: string;
  readonly bestBlockLabel: string;
  readonly siteHost: string;
  /** Always the honest product label — never "% chance". */
  readonly scoreLabel: 'Window score';
};

export type ForecastSpeciesNames = {
  readonly commonName: string;
  readonly scientificName: string;
};

/**
 * Build the forecast share-card model from an ok forecast + species names.
 * `displayCell` and the request `cell` are intentionally dropped.
 */
export function buildForecastCardModel(
  forecast: ForecastOk,
  species: ForecastSpeciesNames,
  siteHost: string,
): ForecastCardModel {
  const bestDay = forecast.days.find((day) => day.date === forecast.bestDay) ?? forecast.days[0]!;
  const model: ForecastCardModel = {
    commonName: species.commonName,
    scientificName: species.scientificName,
    areaLabel: forecast.areaLabel,
    weekScore: forecast.weekScore,
    confidence: formatConfidence(forecast.confidence),
    bestDayLabel: formatBestDay(forecast.bestDay, forecast.timeZone),
    bestBlockLabel: `${bestDay.bestBlock.start}–${bestDay.bestBlock.end}`,
    siteHost,
    scoreLabel: 'Window score',
  };

  assertCardCopyPublicSafe(
    [
      model.commonName,
      model.scientificName,
      model.areaLabel,
      model.confidence,
      model.bestDayLabel,
      model.bestBlockLabel,
      model.siteHost,
      model.scoreLabel,
      String(model.weekScore),
    ],
    'forecast card',
  );

  return model;
}

function formatConfidence(confidence: ForecastOk['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'High';
    case 'medium':
      return 'Medium';
    case 'low':
      return 'Low';
    default: {
      const _exhaustive: never = confidence;
      return _exhaustive;
    }
  }
}

function formatBestDay(isoDate: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (match === null) {
    return isoDate;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Noon UTC avoids DST edge cases when formatting a calendar date.
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return isoDate;
  }
}

export function siteHostFromUrl(siteUrl: string): string {
  try {
    return new URL(siteUrl).host;
  } catch {
    return siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
}

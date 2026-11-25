/**
 * Template explanations for forecast responses (§4.3 / T4.6). No LLM.
 */
import type { Confidence, DayFactors, ForecastDay } from './types.js';

function seasonPhrase(h: number): string {
  if (h >= 0.75) {
    return 'reported here often at this time of year';
  }
  if (h >= 0.4) {
    return 'sometimes reported here at this time of year';
  }
  return 'rarely reported here at this time of year';
}

function weatherPhrase(weather: DayFactors['weather']): string | null {
  if (weather === 'no_forecast_yet') {
    return 'Weather forecast is not available yet for part of this window';
  }
  if (weather >= 0.9) {
    return 'Conditions look calm with low rain risk in the best block';
  }
  if (weather >= 0.7) {
    return 'Weather is mixed in the best block — check closer to the day';
  }
  return 'Wind or rain may cut into the best block';
}

function lightPhrase(light: number): string | null {
  if (light >= 0.85) {
    return 'The best block overlaps golden hour well';
  }
  if (light <= 0.55) {
    return 'The best block sits mostly outside golden hour';
  }
  return null;
}

export function buildExplanations(params: {
  readonly commonName?: string;
  readonly bestDay: ForecastDay;
  readonly confidence: Confidence;
}): readonly string[] {
  const name = params.commonName ?? 'This species';
  const { bestDay, confidence } = params;
  const lines: string[] = [];

  lines.push(`${name} is ${seasonPhrase(bestDay.factors.seasonality)}`);

  const wx = weatherPhrase(bestDay.factors.weather);
  if (wx !== null) {
    lines.push(wx);
  }

  const light = lightPhrase(bestDay.factors.light);
  if (light !== null) {
    lines.push(light);
  }

  if (bestDay.factors.tide === 'not_used') {
    lines.push('Tide is not used for this forecast');
  } else if (typeof bestDay.factors.tide === 'number' && bestDay.factors.tide < 1) {
    lines.push('The best block sits outside the preferred tide window');
  }

  if (confidence === 'low') {
    lines.push('Confidence is low — treat the score as a rough guide');
  }

  return lines;
}

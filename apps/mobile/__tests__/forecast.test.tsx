import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { snapToCell } from '@wildwindow/geoprivacy';

import { ForecastDetailView } from '@/components/forecast/ForecastDetailView';
import type { ForecastOk, ForecastResponse, LightDay } from '@/lib/forecast';
import type { SpeciesDetail } from '@/lib/species';
import { textImpliesPercentChance } from '@/lib/forecast';
import { createMockSpeciesApiClient, forecastFixtureKey } from '../testing/mock-api-client';
import { renderWithProviders } from '../testing/test-utils';

const CELL = snapToCell(55.86, -4.25, 7);
const NOW = new Date('2026-11-20T10:00:00.000Z');
const START = '2026-11-20';

const SPECIES: SpeciesDetail = {
  taxonId: '2481',
  scientificName: 'Alcedo atthis',
  commonNames: { en: 'Common kingfisher' },
  group: 'bird',
  regionSlug: 'scotland',
  tier: 'open',
  coastal: false,
  tidePref: null,
  activityPattern: 'diurnal',
  challengeEligible: true,
  card: null,
};

function day(
  date: string,
  score: number,
  overrides: Partial<ForecastOk['days'][number]> = {},
): ForecastOk['days'][number] {
  return {
    date,
    score,
    bestBlock: { start: '07:00', end: '09:00' },
    factors: {
      seasonality: 0.68,
      timeOfDay: 0.9,
      light: 0.75,
      weather: 0.94,
      tide: 'not_used',
    },
    light: {
      goldenAm: ['07:31', '08:40'],
      goldenPm: ['15:22', '16:31'],
    },
    ...overrides,
  };
}

const DAYS = [
  day('2026-11-20', 55),
  day('2026-11-21', 69),
  day('2026-11-22', 61),
  day('2026-11-23', 48),
  day('2026-11-24', 52),
  day('2026-11-25', 58),
  day('2026-11-26', 50),
] as const;

function okForecast(overrides: Partial<ForecastOk> = {}): ForecastOk {
  return {
    status: 'ok',
    scoringVersion: '1.0',
    taxonId: '2481',
    tier: 'open',
    timeZone: 'Europe/London',
    displayCell: CELL,
    areaLabel: 'Glasgow · Kelvin area',
    weekScore: 69,
    bestDay: '2026-11-21',
    confidence: 'medium',
    range: null,
    days: [...DAYS],
    explanations: [
      'Common kingfisher is reported here often at this time of year',
      'Tide is not used for this forecast',
    ],
    ...overrides,
  };
}

const FIXED_LIGHT: LightDay = {
  date: '2026-11-21',
  timeZone: 'Europe/London',
  civilDawn: '06:50',
  civilDusk: '17:10',
  goldenAm: ['07:31', '08:40'],
  goldenPm: ['15:22', '16:31'],
  blueAm: ['06:50', '07:31'],
  bluePm: ['16:31', '17:10'],
  candidateBlocks: [{ start: '07:00', end: '09:00' }],
};

function mockClient(forecast: ForecastResponse) {
  return createMockSpeciesApiClient(
    {
      list: [],
      detailById: { '2481': SPECIES },
      seasonalityById: {},
    },
    {},
    {
      byKey: {
        [forecastFixtureKey('2481', CELL, START)]: forecast,
      },
    },
  );
}

async function renderForecast(forecast: ForecastResponse) {
  return renderWithProviders(
    <ForecastDetailView
      taxonId="2481"
      cell={CELL}
      region="scotland"
      now={NOW}
      lightForCell={() => FIXED_LIGHT}
    />,
    {
      apiClient: mockClient(forecast),
      initialPreferences: { region: 'scotland', onboardingComplete: true },
    },
  );
}

function collectText(view: { toJSON?: () => unknown; root?: unknown }): string {
  const chunks: string[] = [];
  const walk = (node: unknown): void => {
    if (node === null || node === undefined) {
      return;
    }
    if (typeof node === 'string' || typeof node === 'number') {
      chunks.push(String(node));
      return;
    }
    if (typeof node !== 'object') {
      return;
    }
    const record = node as { children?: unknown; props?: { children?: unknown } };
    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        walk(child);
      }
    } else if (record.children !== undefined) {
      walk(record.children);
    }
    if (record.props?.children !== undefined) {
      walk(record.props.children);
    }
  };
  walk(view.toJSON?.() ?? view.root ?? null);
  return chunks.join(' ');
}

describe('Forecast detail (T6.5 S-07)', () => {
  it('renders the ok state with week score, day strip, best block, light, weather/tide and breakdown', async () => {
    const view = await renderForecast(okForecast());

    await waitFor(() => {
      expect(view.getByTestId('forecast-ok')).toBeTruthy();
    });

    expect(view.getByText('Common kingfisher')).toBeTruthy();
    expect(view.getByText('Glasgow · Kelvin area')).toBeTruthy();
    expect(view.getByTestId('forecast-week-score')).toBeTruthy();
    expect(view.getByText('69')).toBeTruthy();
    expect(view.getByText('Window score')).toBeTruthy();
    expect(view.getByText('Medium')).toBeTruthy();
    expect(view.getByTestId('forecast-day-strip')).toBeTruthy();
    expect(view.getByTestId('forecast-day-2026-11-21')).toBeTruthy();
    expect(view.getByTestId('forecast-best-block')).toBeTruthy();
    expect(view.getByText('07:00–09:00')).toBeTruthy();
    expect(view.getByTestId('forecast-light-times')).toBeTruthy();
    expect(view.getByText('07:31–08:40')).toBeTruthy();
    expect(view.getByTestId('forecast-weather-tide')).toBeTruthy();
    expect(view.getAllByText('Not used').length).toBeGreaterThan(0);
    expect(view.getByTestId('forecast-breakdown')).toBeTruthy();
    expect(view.getByTestId('forecast-factor-seasonality')).toBeTruthy();
    expect(view.getByText('Scoring version 1.0')).toBeTruthy();

    const text = collectText(view);
    expect(textImpliesPercentChance(text)).toBe(false);
    expect(text).not.toMatch(/%\s*chance/i);
  });

  it('shows the low-confidence range and limited-data note', async () => {
    const view = await renderForecast(
      okForecast({
        confidence: 'low',
        range: [40, 65],
        weekScore: 52,
      }),
    );

    await waitFor(() => {
      expect(view.getByTestId('forecast-low-confidence')).toBeTruthy();
    });

    expect(view.getByText('40–65')).toBeTruthy();
    expect(view.getByText('Limited data in this area')).toBeTruthy();
    expect(view.getByText('Low')).toBeTruthy();
    expect(collectText(view)).not.toMatch(/%\s*chance/i);
  });

  it('renders lockout as resting season with the reason', async () => {
    const view = await renderForecast({
      status: 'lockout',
      scoringVersion: '1.0',
      taxonId: '2481',
      tier: 'highly_protected',
      timeZone: 'Europe/London',
      displayCell: CELL,
      areaLabel: 'Lower Clyde area',
      weekScore: null,
      bestDay: null,
      confidence: null,
      range: null,
      days: null,
      reason: 'Osprey breeding lockout — April to August in Scotland.',
      explanations: ['Forecasts are paused during the breeding / nesting lockout period'],
    });

    await waitFor(() => {
      expect(view.getByTestId('forecast-status-lockout')).toBeTruthy();
    });

    expect(view.getByText('Resting season: no forecast')).toBeTruthy();
    expect(view.getByText('Osprey breeding lockout — April to August in Scotland.')).toBeTruthy();
    expect(view.queryByTestId('forecast-week-score')).toBeNull();
    expect(collectText(view)).not.toMatch(/%\s*chance/i);
  });

  it('renders unavailable without a score', async () => {
    const view = await renderForecast({
      status: 'unavailable',
      scoringVersion: '1.0',
      taxonId: '2481',
      tier: 'no_forecast',
      timeZone: 'Europe/London',
      displayCell: null,
      areaLabel: null,
      weekScore: null,
      bestDay: null,
      confidence: null,
      range: null,
      days: null,
      explanations: ['No public forecast for this species in this region'],
    });

    await waitFor(() => {
      expect(view.getByTestId('forecast-status-unavailable')).toBeTruthy();
    });

    expect(view.getByText('Forecast unavailable')).toBeTruthy();
    expect(view.getByText('No public forecast for this species in this region')).toBeTruthy();
    expect(view.queryByTestId('forecast-day-strip')).toBeNull();
  });

  it('renders not_covered for cells outside beta regions', async () => {
    const view = await renderForecast({
      status: 'not_covered',
      scoringVersion: '1.0',
      taxonId: '2481',
      tier: 'open',
      timeZone: 'Europe/London',
      displayCell: null,
      areaLabel: 'Not covered yet',
      weekScore: null,
      bestDay: null,
      confidence: null,
      range: null,
      days: null,
      explanations: ['This cell is outside the beta regions'],
    });

    await waitFor(() => {
      expect(view.getByTestId('forecast-status-not_covered')).toBeTruthy();
    });

    expect(view.getByTestId('forecast-status-callout')).toBeTruthy();
    expect(view.getAllByText('Not covered yet').length).toBeGreaterThan(0);
    expect(
      view.getByText('This area is outside the Scotland and Sindh beta regions.'),
    ).toBeTruthy();
  });

  it('lets the user select another day in the strip', async () => {
    const view = await renderForecast(
      okForecast({
        days: [
          day('2026-11-20', 55),
          day('2026-11-21', 69),
          day('2026-11-22', 61, {
            bestBlock: { start: '15:00', end: '17:00' },
            factors: {
              seasonality: 0.5,
              timeOfDay: 0.6,
              light: 0.7,
              weather: 'no_forecast_yet',
              tide: 'not_used',
            },
          }),
          day('2026-11-23', 48),
          day('2026-11-24', 52),
          day('2026-11-25', 58),
          day('2026-11-26', 50),
        ],
      }),
    );

    await waitFor(() => {
      expect(view.getByTestId('forecast-ok')).toBeTruthy();
    });

    fireEvent.press(view.getByTestId('forecast-day-2026-11-22'));

    await waitFor(() => {
      expect(view.getByText('15:00–17:00')).toBeTruthy();
    });
    expect(view.getAllByText('Not available yet').length).toBeGreaterThan(0);
  });
});

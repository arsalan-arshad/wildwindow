import { snapToCell } from '@wildwindow/geoprivacy';

import {
  forecastStartForRegion,
  formatBlock,
  lightForDisplayCell,
  localYmd,
  textImpliesPercentChance,
  weekScoreDisplay,
  type ForecastOk,
} from '@/lib/forecast';

describe('forecast helpers (T6.5)', () => {
  it('formats a local start date in the region time zone', () => {
    // 2026-11-25 22:30 UTC → still 25th in Karachi (+5), already 26th in London (GMT).
    const at = new Date('2026-11-25T22:30:00.000Z');
    expect(localYmd(at, 'Asia/Karachi')).toBe('2026-11-26');
    expect(localYmd(at, 'Europe/London')).toBe('2026-11-25');
    expect(forecastStartForRegion('sindh', at)).toBe('2026-11-26');
    expect(forecastStartForRegion('scotland', at)).toBe('2026-11-25');
  });

  it('computes on-device light from a display cell centre without persisting lat/lng', () => {
    const cell = snapToCell(55.86, -4.25, 7);
    const light = lightForDisplayCell({
      displayCell: cell,
      date: '2026-11-21',
      timeZone: 'Europe/London',
    });
    expect(light).not.toBeNull();
    expect(light?.goldenAm).not.toBeNull();
    expect(light?.goldenPm).not.toBeNull();
    expect(formatBlock({ start: '07:00', end: '09:00' })).toBe('07:00–09:00');
  });

  it('shows a range for low confidence and never frames the score as a chance', () => {
    const low: ForecastOk = {
      status: 'ok',
      scoringVersion: '1.0',
      taxonId: '2481',
      tier: 'open',
      timeZone: 'Europe/London',
      displayCell: '871f1d489ffffff',
      areaLabel: 'Glasgow · Kelvin area',
      weekScore: 52,
      bestDay: '2026-11-21',
      confidence: 'low',
      range: [37, 67],
      days: [],
      explanations: ['Limited data'],
    };
    const display = weekScoreDisplay(low);
    expect(display.primary).toBe('37–67');
    expect(display.lowConfidence).toBe(true);
    expect(textImpliesPercentChance('Window score 82/100')).toBe(false);
    expect(textImpliesPercentChance('82% chance of a sighting')).toBe(true);
  });
});

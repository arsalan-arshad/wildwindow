import { describe, expect, it } from 'vitest';

import { ogForecastOk } from '@/__fixtures__/og-cards';
import { buildForecastCardModel, siteHostFromUrl } from '@/lib/og/forecast-model';
import { textLooksLikeCellOrCoord } from '@/lib/og/public-safe';

describe('buildForecastCardModel (T7.4)', () => {
  it('uses areaLabel, labels Window score, and never carries cell or coordinates', () => {
    const model = buildForecastCardModel(
      ogForecastOk,
      { commonName: 'Common kingfisher', scientificName: 'Alcedo atthis' },
      'wildwindow.example.test',
    );

    expect(model.areaLabel).toBe('Glasgow · Kelvin area');
    expect(model.scoreLabel).toBe('Window score');
    expect(model.weekScore).toBe(82);
    expect(model.bestBlockLabel).toBe('06:30–08:30');
    expect(model.confidence).toBe('High');

    const copy = [
      model.commonName,
      model.scientificName,
      model.areaLabel,
      model.confidence,
      model.bestDayLabel,
      model.bestBlockLabel,
      model.siteHost,
      model.scoreLabel,
    ].join(' | ');

    expect(copy).toContain('Window score');
    expect(copy).toContain('Glasgow · Kelvin area');
    expect(copy).not.toContain(ogForecastOk.displayCell);
    expect(copy).not.toMatch(/871909ac5ffffff/i);
    expect(textLooksLikeCellOrCoord(copy)).toBe(false);
    expect(model).not.toHaveProperty('cell');
    expect(model).not.toHaveProperty('displayCell');
  });

  it('rejects copy that embeds a cell id', () => {
    expect(() =>
      buildForecastCardModel(
        { ...ogForecastOk, areaLabel: `Near ${ogForecastOk.displayCell}` },
        { commonName: 'Otter', scientificName: 'Lutra lutra' },
        'example.test',
      ),
    ).toThrow(/cells or coordinates/);
  });

  it('parses site host from URL', () => {
    expect(siteHostFromUrl('https://wildwindow.arsalandev.studio/')).toBe(
      'wildwindow.arsalandev.studio',
    );
  });
});

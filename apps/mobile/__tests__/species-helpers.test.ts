import {
  canRequestForecast,
  displayCommonName,
  formatReviewedAt,
  isSpeciesBrowseGroup,
  isSensitivityTier,
} from '@/lib/species';

describe('species helpers (T6.3)', () => {
  it('picks Urdu common name when language is ur', () => {
    expect(
      displayCommonName({ en: 'Kingfisher', ur: 'کنگ فششر' }, 'ur'),
    ).toBe('کنگ فششر');
    expect(displayCommonName({ en: 'Kingfisher' }, 'ur')).toBe('Kingfisher');
    expect(displayCommonName({ en: 'Kingfisher', ur: 'کنگ فششر' }, 'en')).toBe('Kingfisher');
  });

  it('blocks forecast CTA for no_forecast only', () => {
    expect(canRequestForecast('open')).toBe(true);
    expect(canRequestForecast('protected')).toBe(true);
    expect(canRequestForecast('highly_protected')).toBe(true);
    expect(canRequestForecast('no_forecast')).toBe(false);
  });

  it('narrows tier and browse group strings', () => {
    expect(isSensitivityTier('no_forecast')).toBe(true);
    expect(isSensitivityTier('secret')).toBe(false);
    expect(isSpeciesBrowseGroup('bird')).toBe(true);
    expect(isSpeciesBrowseGroup('reptile')).toBe(false);
  });

  it('formats reviewedAt as a calendar date in UTC', () => {
    expect(formatReviewedAt('2026-03-15T12:00:00.000Z', 'en')).toMatch(/15/);
    expect(formatReviewedAt('not-a-date', 'en')).toBe('not-a-date');
  });
});

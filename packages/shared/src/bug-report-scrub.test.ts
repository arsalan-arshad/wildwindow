import { FORBIDDEN_PUBLIC_KEYS } from '@wildwindow/geoprivacy';
import { describe, expect, it } from 'vitest';

import { BUG_REPORT_REDACT, scrubBugReportFields, scrubBugReportText } from './bug-report-scrub.js';

describe('scrubBugReportText (T9.11)', () => {
  it('redacts a decimal coordinate pair', () => {
    const scrubbed = scrubBugReportText('Saw it near 55.865, -4.257 yesterday');
    expect(scrubbed).not.toMatch(/55\.865/);
    expect(scrubbed).not.toMatch(/-4\.257/);
    expect(scrubbed).toContain(BUG_REPORT_REDACT);
  });

  it('redacts forbidden keys in key=value and JSON-like forms', () => {
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      const colon = scrubBugReportText(`debug ${key}: 55.865 end`);
      expect(colon.toLowerCase()).not.toContain(`${key.toLowerCase()}:`);
      expect(colon).not.toMatch(/55\.865/);

      const equals = scrubBugReportText(`${key}=12.345`);
      expect(equals).toBe(BUG_REPORT_REDACT);

      const jsonish = scrubBugReportText(`{"${key}": 1.234}`);
      expect(jsonish.toLowerCase()).not.toContain(`"${key.toLowerCase()}"`);
      expect(jsonish).not.toMatch(/1\.234/);
    }
  });

  it('redacts GPS EXIF tag names', () => {
    const scrubbed = scrubBugReportText('EXIF had GPSLatitude and GPSLongitudeRef');
    expect(scrubbed).not.toMatch(/GPSLatitude/i);
    expect(scrubbed).not.toMatch(/GPSLongitudeRef/i);
    expect(scrubbed).toContain(BUG_REPORT_REDACT);
  });

  it('leaves ordinary prose without coordinates alone', () => {
    const prose = 'Open Explore, pick kingfisher, tap forecast. Score looked low.';
    expect(scrubBugReportText(prose)).toBe(prose);
  });

  it('does not strip the English word "point" outside key context', () => {
    const prose = 'That’s a good point about the forecast.';
    expect(scrubBugReportText(prose)).toBe(prose);
  });

  it('scrubs every free-text field on a draft', () => {
    const scrubbed = scrubBugReportFields({
      steps: 'stood at 55.865, -4.257',
      expected: 'no crash',
      actual: 'latitude: 55.1 shown',
      version: '1.0.0',
      device: 'Pixel 8, Android 15',
    });
    expect(scrubbed.steps).not.toMatch(/55\.865/);
    expect(scrubbed.actual).not.toMatch(/latitude/i);
    expect(scrubbed.actual).not.toMatch(/55\.1/);
    expect(scrubbed.expected).toBe('no crash');
    expect(scrubbed.version).toBe('1.0.0');
  });
});

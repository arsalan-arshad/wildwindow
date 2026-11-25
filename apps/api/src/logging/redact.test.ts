import { describe, expect, it } from 'vitest';

import { LOG_REDACT_CENSOR, scrubSensitiveQueryFromUrl } from './redact.js';

describe('scrubSensitiveQueryFromUrl', () => {
  it('redacts lat/lng query values', () => {
    const scrubbed = scrubSensitiveQueryFromUrl('/v1/health?lat=55.86&lng=-4.25&cell=abc');
    expect(scrubbed).not.toContain('55.86');
    expect(scrubbed).not.toContain('-4.25');
    expect(decodeURIComponent(scrubbed)).toContain(LOG_REDACT_CENSOR);
    expect(scrubbed).toContain('cell=abc');
  });

  it('leaves urls without sensitive keys unchanged', () => {
    expect(scrubSensitiveQueryFromUrl('/v1/health?cell=abc')).toBe('/v1/health?cell=abc');
  });

  it('leaves path-only urls unchanged', () => {
    expect(scrubSensitiveQueryFromUrl('/v1/health')).toBe('/v1/health');
  });
});

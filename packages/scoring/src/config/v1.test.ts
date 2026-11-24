import { describe, expect, it } from 'vitest';

import { SCORING_V1 } from './v1.js';

describe('SCORING_V1', () => {
  it('is as const with version "1.0"', () => {
    expect(SCORING_V1.version).toBe('1.0');
    // as const → literal type, not widened string
    const version: '1.0' = SCORING_V1.version;
    expect(version).toBe('1.0');
    expect(SCORING_V1.alpha).toBe(20);
  });
});

import { describe, expect, it } from 'vitest';

import { normalizeChallengeStatus } from './challenges.service.js';

describe('normalizeChallengeStatus', () => {
  it('maps API active and ARCHITECTURE live to active', () => {
    expect(normalizeChallengeStatus('active')).toBe('active');
    expect(normalizeChallengeStatus('live')).toBe('active');
  });

  it('passes draft and closed through', () => {
    expect(normalizeChallengeStatus('draft')).toBe('draft');
    expect(normalizeChallengeStatus('closed')).toBe('closed');
  });
});

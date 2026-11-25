import { describe, expect, it } from 'vitest';

import { loadApiEnv } from './api-env.js';

describe('ApiEnv TIDE_PROVIDER (T4.8)', () => {
  it('defaults unset / empty to none', () => {
    expect(loadApiEnv({}).TIDE_PROVIDER).toBe('none');
    expect(loadApiEnv({ TIDE_PROVIDER: '' }).TIDE_PROVIDER).toBe('none');
    expect(loadApiEnv({ TIDE_PROVIDER: '  none  ' }).TIDE_PROVIDER).toBe('none');
  });

  it('rejects unknown providers', () => {
    expect(() => loadApiEnv({ TIDE_PROVIDER: 'worldtides' })).toThrow();
  });
});

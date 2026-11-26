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

describe('ApiEnv Firebase (T5.8)', () => {
  it('allows missing Firebase keys (public routes boot without auth)', () => {
    const env = loadApiEnv({});
    expect(env.FIREBASE_PROJECT_ID).toBeUndefined();
    expect(env.FIREBASE_SERVICE_ACCOUNT_JSON).toBeUndefined();
  });

  it('passes through Firebase keys when set', () => {
    const env = loadApiEnv({
      FIREBASE_PROJECT_ID: 'ww-dev',
      FIREBASE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}',
    });
    expect(env.FIREBASE_PROJECT_ID).toBe('ww-dev');
    expect(env.FIREBASE_SERVICE_ACCOUNT_JSON).toBe('{"type":"service_account"}');
  });
});

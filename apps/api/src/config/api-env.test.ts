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

describe('ApiEnv WATCHLIST_LIMIT_FREE (T5.9)', () => {
  it('defaults to 3 when unset', () => {
    expect(loadApiEnv({}).WATCHLIST_LIMIT_FREE).toBe(3);
  });

  it('parses a positive integer', () => {
    expect(loadApiEnv({ WATCHLIST_LIMIT_FREE: '5' }).WATCHLIST_LIMIT_FREE).toBe(5);
  });

  it('rejects non-positive values', () => {
    expect(() => loadApiEnv({ WATCHLIST_LIMIT_FREE: '0' })).toThrow();
  });
});

describe('ApiEnv storage (T5.10)', () => {
  it('allows missing storage keys (resolved at driver factory)', () => {
    const env = loadApiEnv({});
    expect(env.STORAGE_DRIVER).toBeUndefined();
    expect(env.S3_BUCKET).toBeUndefined();
    expect(env.LOCAL_STORAGE_DIR).toBeUndefined();
  });

  it('passes through storage keys when set', () => {
    const env = loadApiEnv({
      STORAGE_DRIVER: 'local',
      S3_BUCKET: 'ww-photos',
      S3_REGION: 'eu-west-2',
      LOCAL_STORAGE_DIR: '/tmp/ww',
      STORAGE_SIGNING_SECRET: 'test-secret',
    });
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.S3_BUCKET).toBe('ww-photos');
    expect(env.S3_REGION).toBe('eu-west-2');
    expect(env.LOCAL_STORAGE_DIR).toBe('/tmp/ww');
    expect(env.STORAGE_SIGNING_SECRET).toBe('test-secret');
  });
});

describe('ApiEnv LOGBOOK_ENC_KEY (T5.11)', () => {
  it('allows missing key (resolved in LogbookService)', () => {
    expect(loadApiEnv({}).LOGBOOK_ENC_KEY).toBeUndefined();
  });

  it('passes through when set', () => {
    const key = Buffer.alloc(32, 3).toString('base64');
    expect(loadApiEnv({ LOGBOOK_ENC_KEY: key }).LOGBOOK_ENC_KEY).toBe(key);
  });
});

describe('ApiEnv observability (T9.1)', () => {
  it('allows missing Sentry / PostHog keys', () => {
    const env = loadApiEnv({});
    expect(env.SENTRY_DSN).toBeUndefined();
    expect(env.POSTHOG_KEY).toBeUndefined();
    expect(env.POSTHOG_HOST).toBeUndefined();
  });

  it('passes through observability keys when set', () => {
    const env = loadApiEnv({
      SENTRY_DSN: 'https://example@sentry.invalid/1',
      POSTHOG_KEY: 'phc_test',
      POSTHOG_HOST: 'https://eu.i.posthog.com',
    });
    expect(env.SENTRY_DSN).toBe('https://example@sentry.invalid/1');
    expect(env.POSTHOG_KEY).toBe('phc_test');
    expect(env.POSTHOG_HOST).toBe('https://eu.i.posthog.com');
  });
});

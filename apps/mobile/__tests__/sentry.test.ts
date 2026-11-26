import { captureException, initSentry, isSentryEnabled } from '@/lib/sentry';

describe('sentry placeholder (T6.1)', () => {
  const originalDsn = process.env['EXPO_PUBLIC_SENTRY_DSN'];

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env['EXPO_PUBLIC_SENTRY_DSN'];
    } else {
      process.env['EXPO_PUBLIC_SENTRY_DSN'] = originalDsn;
    }
    initSentry();
  });

  it('stays disabled without a DSN', () => {
    delete process.env['EXPO_PUBLIC_SENTRY_DSN'];
    initSentry();
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureException(new Error('shell'))).not.toThrow();
  });

  it('marks enabled when a DSN is present (still no SDK until T9.1)', () => {
    process.env['EXPO_PUBLIC_SENTRY_DSN'] = 'https://example@sentry.invalid/1';
    initSentry();
    expect(isSentryEnabled()).toBe(true);
  });
});

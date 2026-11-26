import { captureException, initSentry, isSentryEnabled } from '@/lib/sentry';
import * as Sentry from '@sentry/react-native';

describe('mobile sentry (T9.1)', () => {
  const originalDsn = process.env['EXPO_PUBLIC_SENTRY_DSN'];

  afterEach(() => {
    if (originalDsn === undefined) {
      delete process.env['EXPO_PUBLIC_SENTRY_DSN'];
    } else {
      process.env['EXPO_PUBLIC_SENTRY_DSN'] = originalDsn;
    }
    jest.mocked(Sentry.init).mockClear();
    jest.mocked(Sentry.captureException).mockClear();
    initSentry();
  });

  it('stays disabled without a DSN', () => {
    delete process.env['EXPO_PUBLIC_SENTRY_DSN'];
    initSentry();
    expect(isSentryEnabled()).toBe(false);
    expect(() => captureException(new Error('shell'))).not.toThrow();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('inits the SDK with beforeSend scrubbing when a DSN is present', () => {
    process.env['EXPO_PUBLIC_SENTRY_DSN'] = 'https://example@sentry.invalid/1';
    initSentry();
    expect(isSentryEnabled()).toBe(true);
    expect(Sentry.init).toHaveBeenCalledTimes(1);
    const options = jest.mocked(Sentry.init).mock.calls[0]?.[0] as unknown as {
      dsn: string;
      beforeSend: (event: Record<string, unknown>) => Record<string, unknown>;
    };
    expect(options.dsn).toBe('https://example@sentry.invalid/1');
    const scrubbed = options.beforeSend({
      extra: { lat: 1, region: 'scotland', email: 'a@b.c' },
    });
    expect(scrubbed['extra']).toEqual({ region: 'scotland', email: '[Filtered]' });
  });
});

import { ANALYTICS_FORBIDDEN_KEYS } from '@wildwindow/shared/analytics';

import { initAnalytics, isAnalyticsEnabled, trackEvent } from '@/lib/analytics';

describe('mobile analytics (T9.1)', () => {
  const originalKey = process.env['EXPO_PUBLIC_POSTHOG_KEY'];

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env['EXPO_PUBLIC_POSTHOG_KEY'];
    } else {
      process.env['EXPO_PUBLIC_POSTHOG_KEY'] = originalKey;
    }
    initAnalytics();
  });

  it('stays disabled without a PostHog key', () => {
    delete process.env['EXPO_PUBLIC_POSTHOG_KEY'];
    initAnalytics();
    expect(isAnalyticsEnabled()).toBe(false);
    // Still scrubbing locally so callers get a safe payload shape.
    expect(
      trackEvent('forecast_viewed', {
        taxonId: '1',
        tier: 'open',
        region: 'scotland',
        lat: 55.86,
      }),
    ).toEqual({
      name: 'forecast_viewed',
      properties: { taxonId: '1', tier: 'open', region: 'scotland' },
    });
  });

  it('drops forbidden geoprivacy keys from allowlisted events', () => {
    process.env['EXPO_PUBLIC_POSTHOG_KEY'] = 'phc_mobile';
    initAnalytics();
    expect(isAnalyticsEnabled()).toBe(true);

    const props: Record<string, unknown> = {
      taxonId: '2498260',
      tier: 'open',
      region: 'scotland',
      cell: '8928308280fffff',
    };
    for (const key of ANALYTICS_FORBIDDEN_KEYS) {
      props[key] = 'leak';
    }

    expect(trackEvent('forecast_viewed', props)).toEqual({
      name: 'forecast_viewed',
      properties: { taxonId: '2498260', tier: 'open', region: 'scotland' },
    });
    expect(trackEvent('not_allowlisted', { region: 'sindh' })).toBeNull();
  });
});

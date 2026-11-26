import { FORBIDDEN_PUBLIC_KEYS } from '@wildwindow/geoprivacy';
import { PostHog } from 'posthog-node';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('posthog-node', () => {
  const capture = vi.fn();
  const shutdown = vi.fn(() => Promise.resolve());
  return {
    PostHog: vi.fn().mockImplementation(() => ({ capture, shutdown })),
  };
});

import {
  initApiAnalytics,
  isApiAnalyticsEnabled,
  shutdownApiAnalytics,
  trackApiEvent,
} from './analytics.js';

describe('api analytics (T9.1)', () => {
  afterEach(async () => {
    await shutdownApiAnalytics();
    delete process.env['POSTHOG_KEY'];
    delete process.env['POSTHOG_HOST'];
    vi.clearAllMocks();
  });

  it('stays disabled without POSTHOG_KEY', () => {
    initApiAnalytics();
    expect(isApiAnalyticsEnabled()).toBe(false);
    expect(
      trackApiEvent('forecast_viewed', { taxonId: 1, tier: 'open', region: 'scotland' }),
    ).toEqual({
      name: 'forecast_viewed',
      properties: { taxonId: 1, tier: 'open', region: 'scotland' },
    });
    expect(PostHog).not.toHaveBeenCalled();
  });

  it('drops forbidden keys before PostHog capture', () => {
    process.env['POSTHOG_KEY'] = 'phc_test';
    initApiAnalytics();
    expect(isApiAnalyticsEnabled()).toBe(true);

    const props: Record<string, unknown> = {
      taxonId: 9,
      tier: 'protected',
      region: 'sindh',
      cell: '8928308280fffff',
    };
    for (const key of FORBIDDEN_PUBLIC_KEYS) {
      props[key] = 'leak';
    }

    trackApiEvent('forecast_viewed', props);

    const instance = vi.mocked(PostHog).mock.results[0]?.value as {
      capture: ReturnType<typeof vi.fn>;
    };
    expect(instance.capture).toHaveBeenCalledWith({
      distinctId: 'api-server',
      event: 'forecast_viewed',
      properties: { taxonId: 9, tier: 'protected', region: 'sindh' },
    });
  });
});

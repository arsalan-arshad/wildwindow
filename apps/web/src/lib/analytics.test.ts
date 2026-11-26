import { ANALYTICS_FORBIDDEN_KEYS } from '@wildwindow/shared/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.fn();
const init = vi.fn();

vi.mock('posthog-js', () => ({
  default: {
    init: (...args: unknown[]) => init(...args),
    capture: (...args: unknown[]) => capture(...args),
  },
}));

describe('web analytics (T9.1)', () => {
  beforeEach(() => {
    vi.resetModules();
    capture.mockClear();
    init.mockClear();
    delete process.env['NEXT_PUBLIC_POSTHOG_KEY'];
    delete process.env['NEXT_PUBLIC_POSTHOG_HOST'];
  });

  it('drops geoprivacy forbidden keys before PostHog capture', async () => {
    process.env['NEXT_PUBLIC_POSTHOG_KEY'] = 'phc_web';
    const { initWebAnalytics, trackEvent } = await import('./analytics');

    initWebAnalytics();

    const props: Record<string, unknown> = {
      taxonId: 42,
      tier: 'open',
      region: 'scotland',
      cellR7: '8928308280fffff',
    };
    for (const key of ANALYTICS_FORBIDDEN_KEYS) {
      props[key] = 'leak';
    }

    expect(trackEvent('forecast_viewed', props)).toEqual({
      name: 'forecast_viewed',
      properties: { taxonId: 42, tier: 'open', region: 'scotland' },
    });
    expect(capture).toHaveBeenCalledWith('forecast_viewed', {
      taxonId: 42,
      tier: 'open',
      region: 'scotland',
    });
  });
});

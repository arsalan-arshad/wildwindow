/**
 * PostHog EU product analytics for mobile (T9.1).
 * Every event goes through the shared allowlist + geoprivacy key scrubber.
 */
import {
  createAnalytics,
  POSTHOG_EU_HOST,
  type AnalyticsEventName,
  type AnalyticsProperties,
  type SanitizedAnalyticsEvent,
} from '@wildwindow/shared/analytics';
import { PostHog } from 'posthog-react-native';

let client: PostHog | null = null;
let analytics = createAnalytics(null);

function readKey(): string | undefined {
  const key = process.env['EXPO_PUBLIC_POSTHOG_KEY']?.trim();
  return key !== undefined && key.length > 0 ? key : undefined;
}

function readHost(): string {
  return process.env['EXPO_PUBLIC_POSTHOG_HOST']?.trim() || POSTHOG_EU_HOST;
}

/**
 * Init PostHog when `EXPO_PUBLIC_POSTHOG_KEY` is set. Safe no-op otherwise.
 */
export function initAnalytics(): void {
  const key = readKey();
  if (key === undefined) {
    client = null;
    analytics = createAnalytics(null);
    return;
  }

  client = new PostHog(key, { host: readHost() });
  analytics = createAnalytics({
    capture(name: AnalyticsEventName, properties) {
      client?.capture(name, properties);
    },
  });
}

export function trackEvent(
  name: string,
  properties?: AnalyticsProperties,
): SanitizedAnalyticsEvent | null {
  return analytics.track(name, properties);
}

export function isAnalyticsEnabled(): boolean {
  return analytics.isEnabled();
}

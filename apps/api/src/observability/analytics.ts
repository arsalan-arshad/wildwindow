import {
  createAnalytics,
  POSTHOG_EU_HOST,
  type AnalyticsEventName,
} from '@wildwindow/shared/analytics';
import { PostHog } from 'posthog-node';

let client: PostHog | null = null;
let analytics = createAnalytics(null);

/**
 * Optional server-side PostHog (EU). No-op when `POSTHOG_KEY` is unset.
 * All events go through the shared allowlist + geoprivacy scrubber.
 */
export function initApiAnalytics(): void {
  const key = process.env['POSTHOG_KEY']?.trim();
  if (key === undefined || key.length === 0) {
    client = null;
    analytics = createAnalytics(null);
    return;
  }

  const host = process.env['POSTHOG_HOST']?.trim() || POSTHOG_EU_HOST;
  client = new PostHog(key, { host });
  analytics = createAnalytics({
    capture(name: AnalyticsEventName, properties) {
      client?.capture({
        distinctId: 'api-server',
        event: name,
        properties,
      });
    },
  });
}

export function trackApiEvent(
  name: string,
  properties?: Readonly<Record<string, unknown>>,
): ReturnType<typeof analytics.track> {
  return analytics.track(name, properties);
}

export async function shutdownApiAnalytics(): Promise<void> {
  if (client !== null) {
    await client.shutdown();
    client = null;
  }
  analytics = createAnalytics(null);
}

export function isApiAnalyticsEnabled(): boolean {
  return analytics.isEnabled();
}

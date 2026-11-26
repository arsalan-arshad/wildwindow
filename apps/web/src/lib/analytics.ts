'use client';

import {
  createAnalytics,
  POSTHOG_EU_HOST,
  type AnalyticsEventName,
  type AnalyticsProperties,
  type SanitizedAnalyticsEvent,
} from '@wildwindow/shared/analytics';
import posthog from 'posthog-js';

let started = false;
let analytics = createAnalytics(null);

function readKey(): string | undefined {
  const key = process.env['NEXT_PUBLIC_POSTHOG_KEY']?.trim();
  return key !== undefined && key.length > 0 ? key : undefined;
}

function readHost(): string {
  return process.env['NEXT_PUBLIC_POSTHOG_HOST']?.trim() || POSTHOG_EU_HOST;
}

/**
 * Browser PostHog (EU) with the shared event allowlist + location scrub (T9.1).
 */
export function initWebAnalytics(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const key = readKey();
  if (key === undefined) {
    analytics = createAnalytics(null);
    started = false;
    return;
  }
  if (!started) {
    posthog.init(key, {
      api_host: readHost(),
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: false,
      persistence: 'memory',
    });
    started = true;
  }
  analytics = createAnalytics({
    capture(name: AnalyticsEventName, properties) {
      posthog.capture(name, properties);
    },
  });
}

export function trackEvent(
  name: string,
  properties?: AnalyticsProperties,
): SanitizedAnalyticsEvent | null {
  if (!started) {
    initWebAnalytics();
  }
  return analytics.track(name, properties);
}

export function isWebAnalyticsEnabled(): boolean {
  return analytics.isEnabled();
}

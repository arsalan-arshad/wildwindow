'use client';

import { useEffect } from 'react';

import { initWebAnalytics } from '@/lib/analytics';
import { initSentry } from '@/lib/sentry';

/**
 * Client-side Sentry + PostHog bootstrap (T9.1). No-op when public keys unset.
 */
export function ObservabilityProvider({ children }: { readonly children: React.ReactNode }) {
  useEffect(() => {
    void initSentry();
    initWebAnalytics();
  }, []);

  return <>{children}</>;
}

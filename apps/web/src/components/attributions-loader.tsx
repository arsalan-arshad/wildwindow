'use client';

import { useEffect, useState } from 'react';

import type { AttributionsResponse } from '@wildwindow/shared/api';

import { AttributionsList } from '@/components/attributions-list';
import { getBrowserApiClient } from '@/lib/api';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ok'; readonly data: AttributionsResponse }
  | { readonly status: 'error'; readonly message: string };

/** Client loader for GET /v1/attributions (keeps the page statically generated). */
export function AttributionsLoader() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await getBrowserApiClient().attributions.list();
        if (!cancelled) {
          setState({ status: 'ok', data });
        }
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Could not load attributions.';
          setState({ status: 'error', message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <p className="text-ink-muted" role="status">
        Loading attributions…
      </p>
    );
  }

  if (state.status === 'error') {
    return (
      <p className="text-danger" role="alert">
        {state.message}
      </p>
    );
  }

  return <AttributionsList data={state.data} />;
}

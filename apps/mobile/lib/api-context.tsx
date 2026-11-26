import type { ApiClient } from '@wildwindow/shared/client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createMobileApiClient } from '@/lib/api';

const ApiClientContext = createContext<ApiClient | null>(null);

export type ApiClientProviderProps = {
  readonly children: ReactNode;
  /** Override for tests. */
  readonly client?: ApiClient;
  /** Auth token supplier (T6.7). Ignored when `client` is provided. */
  readonly getToken?: () => string | undefined | Promise<string | undefined>;
};

export function ApiClientProvider({ children, client, getToken }: ApiClientProviderProps) {
  const value = useMemo(
    () =>
      client ??
      createMobileApiClient({
        ...(getToken !== undefined ? { getToken } : {}),
      }),
    [client, getToken],
  );
  return <ApiClientContext.Provider value={value}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (client === null) {
    throw new Error('useApiClient must be used within ApiClientProvider');
  }
  return client;
}

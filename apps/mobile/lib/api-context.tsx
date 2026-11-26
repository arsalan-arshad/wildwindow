import type { ApiClient } from '@wildwindow/shared/client';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { createMobileApiClient } from '@/lib/api';

const ApiClientContext = createContext<ApiClient | null>(null);

export type ApiClientProviderProps = {
  readonly children: ReactNode;
  /** Override for tests. */
  readonly client?: ApiClient;
};

export function ApiClientProvider({ children, client }: ApiClientProviderProps) {
  const value = useMemo(() => client ?? createMobileApiClient(), [client]);
  return <ApiClientContext.Provider value={value}>{children}</ApiClientContext.Provider>;
}

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext);
  if (client === null) {
    throw new Error('useApiClient must be used within ApiClientProvider');
  }
  return client;
}

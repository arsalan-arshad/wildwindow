import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { ApiClientProvider } from '@/lib/api-context';
import { i18n, initI18n } from '@/lib/i18n';
import type { ApiClient } from '@wildwindow/shared/client';

initI18n();

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
      },
    },
  });
}

export type AppProvidersProps = {
  readonly children: ReactNode;
  /** Test overrides. */
  readonly queryClient?: QueryClient;
  readonly apiClient?: ApiClient;
};

export function AppProviders({ children, queryClient, apiClient }: AppProvidersProps) {
  const [ownedClient] = useState(createQueryClient);
  const client = queryClient ?? ownedClient;

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        {apiClient !== undefined ? (
          <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
        ) : (
          <ApiClientProvider>{children}</ApiClientProvider>
        )}
      </QueryClientProvider>
    </I18nextProvider>
  );
}

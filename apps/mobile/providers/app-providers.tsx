import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { ApiClientProvider } from '@/lib/api-context';
import { i18n, initI18n } from '@/lib/i18n';
import { PreferencesProvider } from '@/lib/preferences-context';
import type { AppPreferences, PreferenceStorage } from '@/lib/preferences';
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
  readonly preferenceStorage?: PreferenceStorage;
  readonly initialPreferences?: AppPreferences;
};

export function AppProviders({
  children,
  queryClient,
  apiClient,
  preferenceStorage,
  initialPreferences,
}: AppProvidersProps) {
  const [ownedClient] = useState(createQueryClient);
  const client = queryClient ?? ownedClient;

  const apiTree =
    apiClient !== undefined ? (
      <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>
    ) : (
      <ApiClientProvider>{children}</ApiClientProvider>
    );

  let preferencesTree: ReactNode;
  if (preferenceStorage !== undefined && initialPreferences !== undefined) {
    preferencesTree = (
      <PreferencesProvider storage={preferenceStorage} initial={initialPreferences}>
        {apiTree}
      </PreferencesProvider>
    );
  } else if (preferenceStorage !== undefined) {
    preferencesTree = (
      <PreferencesProvider storage={preferenceStorage}>{apiTree}</PreferencesProvider>
    );
  } else if (initialPreferences !== undefined) {
    preferencesTree = (
      <PreferencesProvider initial={initialPreferences}>{apiTree}</PreferencesProvider>
    );
  } else {
    preferencesTree = <PreferencesProvider>{apiTree}</PreferencesProvider>;
  }

  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>{preferencesTree}</QueryClientProvider>
    </I18nextProvider>
  );
}

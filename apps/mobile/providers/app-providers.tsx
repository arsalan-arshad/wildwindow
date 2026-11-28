import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { ApiClientProvider } from '@/lib/api-context';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import type { AuthClient } from '@/lib/auth/types';
import { i18n, initI18n } from '@/lib/i18n';
import { setupOnlineManager } from '@/lib/online';
import { PreferencesProvider } from '@/lib/preferences-context';
import type { AppPreferencesInit, PreferenceStorage } from '@/lib/preferences';
import {
  createAppQueryClient,
  QUERY_CACHE_MAX_AGE_MS,
  shouldPersistQuery,
} from '@/lib/query-client';
import { createQueryPersister } from '@/lib/query-persist';
import type { ApiClient } from '@wildwindow/shared/client';

initI18n();

export type AppProvidersProps = {
  readonly children: ReactNode;
  /** Test overrides. */
  readonly queryClient?: QueryClient;
  readonly apiClient?: ApiClient;
  readonly authClient?: AuthClient;
  readonly preferenceStorage?: PreferenceStorage;
  readonly initialPreferences?: AppPreferencesInit;
};

/**
 * Wires Auth → API client so Bearer tokens from Firebase reach Nest (T6.7).
 * When tests pass `apiClient`, the auth token hook is skipped.
 */
function AuthAwareApiTree({
  children,
  apiClient,
}: {
  readonly children: ReactNode;
  readonly apiClient?: ApiClient;
}) {
  const { getIdToken } = useAuth();

  if (apiClient !== undefined) {
    return <ApiClientProvider client={apiClient}>{children}</ApiClientProvider>;
  }

  return <ApiClientProvider getToken={getIdToken}>{children}</ApiClientProvider>;
}

export function AppProviders({
  children,
  queryClient,
  apiClient,
  authClient,
  preferenceStorage,
  initialPreferences,
}: AppProvidersProps) {
  const [ownedClient] = useState(createAppQueryClient);
  const [persister] = useState(() => createQueryPersister());
  const client = queryClient ?? ownedClient;
  const persistEnabled = queryClient === undefined;

  useEffect(() => {
    setupOnlineManager();
  }, []);

  const apiTree =
    apiClient !== undefined ? (
      <AuthAwareApiTree apiClient={apiClient}>{children}</AuthAwareApiTree>
    ) : (
      <AuthAwareApiTree>{children}</AuthAwareApiTree>
    );

  const authTree =
    authClient !== undefined ? (
      <AuthProvider client={authClient}>{apiTree}</AuthProvider>
    ) : (
      <AuthProvider>{apiTree}</AuthProvider>
    );

  let preferencesTree: ReactNode;
  if (preferenceStorage !== undefined && initialPreferences !== undefined) {
    preferencesTree = (
      <PreferencesProvider storage={preferenceStorage} initial={initialPreferences}>
        {authTree}
      </PreferencesProvider>
    );
  } else if (preferenceStorage !== undefined) {
    preferencesTree = (
      <PreferencesProvider storage={preferenceStorage}>{authTree}</PreferencesProvider>
    );
  } else if (initialPreferences !== undefined) {
    preferencesTree = (
      <PreferencesProvider initial={initialPreferences}>{authTree}</PreferencesProvider>
    );
  } else {
    preferencesTree = <PreferencesProvider>{authTree}</PreferencesProvider>;
  }

  const queryTree = persistEnabled ? (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{
        persister,
        maxAge: QUERY_CACHE_MAX_AGE_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: shouldPersistQuery,
        },
      }}
    >
      {preferencesTree}
    </PersistQueryClientProvider>
  ) : (
    <QueryClientProvider client={client}>{preferencesTree}</QueryClientProvider>
  );

  return <I18nextProvider i18n={i18n}>{queryTree}</I18nextProvider>;
}

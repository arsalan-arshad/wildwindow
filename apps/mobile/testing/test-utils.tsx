import { QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react-native';
import type { ApiClient } from '@wildwindow/shared/client';
import type { ReactElement, ReactNode } from 'react';

import type { AuthClient } from '@/lib/auth/types';
import { AppProviders } from '@/providers/app-providers';
import { initI18n, type AppLanguage } from '@/lib/i18n';
import type { AppPreferencesInit, PreferenceStorage } from '@/lib/preferences';
import { createMockAuthClient } from '@/testing/mock-auth-client';

export type RenderWithProvidersOptions = RenderOptions & {
  readonly language?: AppLanguage;
  readonly preferenceStorage?: PreferenceStorage;
  readonly initialPreferences?: AppPreferencesInit;
  readonly apiClient?: ApiClient;
  readonly authClient?: AuthClient;
  readonly queryClient?: QueryClient;
};

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

export async function renderWithProviders(
  ui: ReactElement,
  options?: RenderWithProvidersOptions,
): Promise<RenderResult> {
  const language = options?.language ?? 'en';
  initI18n(language);

  const preferenceStorage = options?.preferenceStorage;
  const initialPreferences: AppPreferencesInit =
    options?.initialPreferences ??
    ({
      region: null,
      onboardingComplete: true,
      units: 'metric',
      language: null,
    } satisfies AppPreferencesInit);
  const apiClient = options?.apiClient;
  // Default to an in-memory auth client so screens that call useAuth do not
  // hit the real Firebase SDK in Jest.
  const authClient = options?.authClient ?? createMockAuthClient({ initialUser: null });
  const queryClient = options?.queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <AppProviders
        queryClient={queryClient}
        authClient={authClient}
        {...(preferenceStorage !== undefined ? { preferenceStorage } : {})}
        {...(initialPreferences !== undefined ? { initialPreferences } : {})}
        {...(apiClient !== undefined ? { apiClient } : {})}
      >
        {children}
      </AppProviders>
    );
  }

  const {
    language: _language,
    preferenceStorage: _storage,
    initialPreferences: _prefs,
    apiClient: _api,
    authClient: _auth,
    queryClient: _qc,
    ...renderOptions
  } = options ?? {};
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

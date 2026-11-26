import { QueryClient } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react-native';
import type { ApiClient } from '@wildwindow/shared/client';
import type { ReactElement, ReactNode } from 'react';

import { AppProviders } from '@/providers/app-providers';
import { initI18n, type AppLanguage } from '@/lib/i18n';
import type { AppPreferences, PreferenceStorage } from '@/lib/preferences';

export type RenderWithProvidersOptions = RenderOptions & {
  readonly language?: AppLanguage;
  readonly preferenceStorage?: PreferenceStorage;
  readonly initialPreferences?: AppPreferences;
  readonly apiClient?: ApiClient;
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
  const initialPreferences =
    options?.initialPreferences ??
    ({
      region: null,
      onboardingComplete: true,
    } satisfies AppPreferences);
  const apiClient = options?.apiClient;
  const queryClient = options?.queryClient ?? createTestQueryClient();

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <AppProviders
        queryClient={queryClient}
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
    queryClient: _qc,
    ...renderOptions
  } = options ?? {};
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

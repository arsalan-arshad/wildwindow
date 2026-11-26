import { render, type RenderOptions, type RenderResult } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { AppProviders } from '@/providers/app-providers';
import { initI18n, type AppLanguage } from '@/lib/i18n';
import type { AppPreferences, PreferenceStorage } from '@/lib/preferences';

export type RenderWithProvidersOptions = RenderOptions & {
  readonly language?: AppLanguage;
  readonly preferenceStorage?: PreferenceStorage;
  readonly initialPreferences?: AppPreferences;
};

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

  function Wrapper({ children }: { readonly children: ReactNode }) {
    if (preferenceStorage !== undefined) {
      return (
        <AppProviders preferenceStorage={preferenceStorage} initialPreferences={initialPreferences}>
          {children}
        </AppProviders>
      );
    }
    return <AppProviders initialPreferences={initialPreferences}>{children}</AppProviders>;
  }

  const {
    language: _language,
    preferenceStorage: _storage,
    initialPreferences: _prefs,
    ...renderOptions
  } = options ?? {};
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

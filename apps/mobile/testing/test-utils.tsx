import { render, type RenderOptions, type RenderResult } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';

import { AppProviders } from '@/providers/app-providers';
import { initI18n, type AppLanguage } from '@/lib/i18n';

export async function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions & { readonly language?: AppLanguage },
): Promise<RenderResult> {
  const language = options?.language ?? 'en';
  initI18n(language);

  function Wrapper({ children }: { readonly children: ReactNode }) {
    return <AppProviders>{children}</AppProviders>;
  }

  const { language: _language, ...renderOptions } = options ?? {};
  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

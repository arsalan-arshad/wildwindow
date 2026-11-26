import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { I18nManager } from 'react-native';

import en from './locales/en.json';
import ur from './locales/ur.json';

export const SUPPORTED_LANGUAGES = ['en', 'ur'] as const;
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const RTL_LANGUAGES: ReadonlySet<AppLanguage> = new Set(['ur']);

/** App-owned direction. RN's I18nManager.isRTL is not always updated in tests / until reload. */
let layoutDirection: 'ltr' | 'rtl' = 'ltr';

export function isAppLanguage(value: string): value is AppLanguage {
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export function isRtlLanguage(language: string): boolean {
  const base = language.split('-')[0] ?? language;
  return isAppLanguage(base) && RTL_LANGUAGES.has(base);
}

/**
 * Apply React Native layout direction for the active language.
 * Returns whether the layout is RTL after the change.
 * Native apps may still need a reload for some native views; JS layout uses this flag.
 */
export function applyLayoutDirection(language: string): boolean {
  const rtl = isRtlLanguage(language);
  layoutDirection = rtl ? 'rtl' : 'ltr';
  // Prefer allowing RTL whenever Urdu may be selected; force matches the active language.
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(rtl);
  return rtl;
}

export function getLayoutDirection(): 'ltr' | 'rtl' {
  return layoutDirection;
}

function resolveInitialLanguage(): AppLanguage {
  const locales = Localization.getLocales();
  const first = locales[0];
  const code = first?.languageCode ?? 'en';
  return isAppLanguage(code) ? code : 'en';
}

let initialized = false;

export function initI18n(language?: AppLanguage): typeof i18n {
  const lng = language ?? resolveInitialLanguage();
  applyLayoutDirection(lng);

  if (!initialized) {
    void i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        ur: { translation: ur },
      },
      lng,
      fallbackLng: 'en',
      supportedLngs: [...SUPPORTED_LANGUAGES],
      interpolation: { escapeValue: false },
      // Tests and SSR-safe: avoid suspense on first paint.
      react: { useSuspense: false },
    });
    initialized = true;
  } else if (i18n.language !== lng) {
    void i18n.changeLanguage(lng);
  }

  return i18n;
}

/**
 * Switch UI language and flip layout direction when moving to/from Urdu.
 */
export async function setAppLanguage(language: AppLanguage): Promise<'ltr' | 'rtl'> {
  initI18n(language);
  await i18n.changeLanguage(language);
  applyLayoutDirection(language);
  return getLayoutDirection();
}

export { i18n };

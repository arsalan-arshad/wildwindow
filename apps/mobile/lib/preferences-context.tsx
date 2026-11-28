import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  completeOnboarding as persistOnboarding,
  loadPreferences,
  normalizePreferences,
  saveLanguage,
  saveRegion,
  saveUnits,
  type AppPreferencesInit,
  type PreferenceStorage,
  type UnitSystem,
} from '@/lib/preferences';
import { setAppLanguage, type AppLanguage } from '@/lib/i18n';
import type { RegionId } from '@/lib/regions';

export type PreferencesContextValue = {
  readonly ready: boolean;
  readonly region: RegionId | null;
  readonly onboardingComplete: boolean;
  readonly units: UnitSystem;
  readonly language: AppLanguage | null;
  readonly setRegion: (region: RegionId) => Promise<void>;
  readonly setUnits: (units: UnitSystem) => Promise<void>;
  readonly setLanguage: (language: AppLanguage) => Promise<void>;
  readonly finishOnboarding: (region: RegionId) => Promise<void>;
  readonly refresh: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export type PreferencesProviderProps = {
  readonly children: ReactNode;
  /** Injected storage for tests. */
  readonly storage?: PreferenceStorage;
  /** Skip async load (tests). */
  readonly initial?: AppPreferencesInit;
};

export function PreferencesProvider({ children, storage, initial }: PreferencesProviderProps) {
  const boot = initial !== undefined ? normalizePreferences(initial) : null;
  const [ready, setReady] = useState(boot !== null);
  const [region, setRegionState] = useState<RegionId | null>(boot?.region ?? null);
  const [onboardingComplete, setOnboardingComplete] = useState(boot?.onboardingComplete ?? false);
  const [units, setUnitsState] = useState<UnitSystem>(boot?.units ?? 'metric');
  const [language, setLanguageState] = useState<AppLanguage | null>(boot?.language ?? null);

  const refresh = useCallback(async () => {
    try {
      const prefs = await loadPreferences(storage);
      setRegionState(prefs.region);
      setOnboardingComplete(prefs.onboardingComplete);
      setUnitsState(prefs.units);
      setLanguageState(prefs.language);
      if (prefs.language !== null) {
        await setAppLanguage(prefs.language);
      }
    } catch (error) {
      // deviceStorage already soft-falls back; this keeps the UI unblocked if
      // an unexpected storage failure still escapes.
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn('[preferences] load failed; using defaults', error);
      }
      setRegionState(null);
      setOnboardingComplete(false);
      setUnitsState('metric');
      setLanguageState(null);
    } finally {
      setReady(true);
    }
  }, [storage]);

  useEffect(() => {
    if (initial !== undefined) {
      const lang = normalizePreferences(initial).language;
      if (lang !== null) {
        void setAppLanguage(lang);
      }
      return;
    }
    void refresh();
  }, [initial, refresh]);

  const setRegion = useCallback(
    async (next: RegionId) => {
      await saveRegion(next, storage);
      setRegionState(next);
    },
    [storage],
  );

  const setUnits = useCallback(
    async (next: UnitSystem) => {
      await saveUnits(next, storage);
      setUnitsState(next);
    },
    [storage],
  );

  const setLanguagePref = useCallback(
    async (next: AppLanguage) => {
      await saveLanguage(next, storage);
      await setAppLanguage(next);
      setLanguageState(next);
    },
    [storage],
  );

  const finishOnboarding = useCallback(
    async (next: RegionId) => {
      const prefs = await persistOnboarding(next, storage);
      setRegionState(prefs.region);
      setOnboardingComplete(prefs.onboardingComplete);
      setUnitsState(prefs.units);
      setLanguageState(prefs.language);
    },
    [storage],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ready,
      region,
      onboardingComplete,
      units,
      language,
      setRegion,
      setUnits,
      setLanguage: setLanguagePref,
      finishOnboarding,
      refresh,
    }),
    [
      ready,
      region,
      onboardingComplete,
      units,
      language,
      setRegion,
      setUnits,
      setLanguagePref,
      finishOnboarding,
      refresh,
    ],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (ctx === null) {
    throw new Error('usePreferences must be used within PreferencesProvider');
  }
  return ctx;
}

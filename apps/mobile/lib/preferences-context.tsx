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
  saveRegion,
  type AppPreferences,
  type PreferenceStorage,
} from '@/lib/preferences';
import type { RegionId } from '@/lib/regions';

export type PreferencesContextValue = {
  readonly ready: boolean;
  readonly region: RegionId | null;
  readonly onboardingComplete: boolean;
  readonly setRegion: (region: RegionId) => Promise<void>;
  readonly finishOnboarding: (region: RegionId) => Promise<void>;
  readonly refresh: () => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export type PreferencesProviderProps = {
  readonly children: ReactNode;
  /** Injected storage for tests. */
  readonly storage?: PreferenceStorage;
  /** Skip async load (tests). */
  readonly initial?: AppPreferences;
};

export function PreferencesProvider({ children, storage, initial }: PreferencesProviderProps) {
  const [ready, setReady] = useState(initial !== undefined);
  const [region, setRegionState] = useState<RegionId | null>(initial?.region ?? null);
  const [onboardingComplete, setOnboardingComplete] = useState(
    initial?.onboardingComplete ?? false,
  );

  const refresh = useCallback(async () => {
    const prefs = await loadPreferences(storage);
    setRegionState(prefs.region);
    setOnboardingComplete(prefs.onboardingComplete);
    setReady(true);
  }, [storage]);

  useEffect(() => {
    if (initial !== undefined) {
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

  const finishOnboarding = useCallback(
    async (next: RegionId) => {
      const prefs = await persistOnboarding(next, storage);
      setRegionState(prefs.region);
      setOnboardingComplete(prefs.onboardingComplete);
    },
    [storage],
  );

  const value = useMemo<PreferencesContextValue>(
    () => ({
      ready,
      region,
      onboardingComplete,
      setRegion,
      finishOnboarding,
      refresh,
    }),
    [ready, region, onboardingComplete, setRegion, finishOnboarding, refresh],
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

/**
 * Local device preferences for onboarding, home region, units and language (T6.2 / T6.12).
 * Region is stored on-device; units stay local (not on /v1/me). Language may sync via PATCH.
 * Nothing here sends coordinates.
 */
import { deviceStorage, type DeviceStorage } from '@/lib/device-storage';
import { isAppLanguage, type AppLanguage } from '@/lib/i18n';
import { isRegionId, type RegionId } from '@/lib/regions';

export const PREF_KEYS = {
  region: 'ww.homeRegion',
  onboardingComplete: 'ww.onboardingComplete',
  units: 'ww.units',
  language: 'ww.language',
} as const;

export const UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type UnitSystem = (typeof UNIT_SYSTEMS)[number];

export function isUnitSystem(value: string): value is UnitSystem {
  return (UNIT_SYSTEMS as readonly string[]).includes(value);
}

export type PreferenceStorage = DeviceStorage;

export type AppPreferences = {
  readonly region: RegionId | null;
  readonly onboardingComplete: boolean;
  readonly units: UnitSystem;
  readonly language: AppLanguage | null;
};

/** Partial preferences for tests / provider bootstrap. Missing fields get defaults. */
export type AppPreferencesInit = {
  readonly region?: RegionId | null;
  readonly onboardingComplete?: boolean;
  readonly units?: UnitSystem;
  readonly language?: AppLanguage | null;
};

export function normalizePreferences(init: AppPreferencesInit = {}): AppPreferences {
  return {
    region: init.region ?? null,
    onboardingComplete: init.onboardingComplete ?? false,
    units: init.units ?? 'metric',
    language: init.language ?? null,
  };
}

const defaultStorage: PreferenceStorage = deviceStorage;

let activeStorage: PreferenceStorage = defaultStorage;

/** Swap storage (tests). Call resetPreferenceStorage after. */
export function setPreferenceStorage(storage: PreferenceStorage): void {
  activeStorage = storage;
}

export function resetPreferenceStorage(): void {
  activeStorage = defaultStorage;
}

export function createMemoryPreferenceStorage(
  initial: Record<string, string> = {},
): PreferenceStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    async getItem(key) {
      return map.get(key) ?? null;
    },
    async setItem(key, value) {
      map.set(key, value);
    },
    async removeItem(key) {
      map.delete(key);
    },
  };
}

function parseRegion(raw: string | null): RegionId | null {
  if (raw === null) return null;
  return isRegionId(raw) ? raw : null;
}

function parseOnboardingComplete(raw: string | null): boolean {
  return raw === 'true';
}

function parseUnits(raw: string | null): UnitSystem {
  if (raw !== null && isUnitSystem(raw)) {
    return raw;
  }
  return 'metric';
}

function parseLanguage(raw: string | null): AppLanguage | null {
  if (raw === null) return null;
  return isAppLanguage(raw) ? raw : null;
}

export async function loadPreferences(
  storage: PreferenceStorage = activeStorage,
): Promise<AppPreferences> {
  const [regionRaw, completeRaw, unitsRaw, languageRaw] = await Promise.all([
    storage.getItem(PREF_KEYS.region),
    storage.getItem(PREF_KEYS.onboardingComplete),
    storage.getItem(PREF_KEYS.units),
    storage.getItem(PREF_KEYS.language),
  ]);
  return {
    region: parseRegion(regionRaw),
    onboardingComplete: parseOnboardingComplete(completeRaw),
    units: parseUnits(unitsRaw),
    language: parseLanguage(languageRaw),
  };
}

export async function saveRegion(
  region: RegionId,
  storage: PreferenceStorage = activeStorage,
): Promise<void> {
  if (!isRegionId(region)) {
    throw new Error(`Invalid region: ${String(region)}`);
  }
  await storage.setItem(PREF_KEYS.region, region);
}

export async function saveUnits(
  units: UnitSystem,
  storage: PreferenceStorage = activeStorage,
): Promise<void> {
  if (!isUnitSystem(units)) {
    throw new Error(`Invalid units: ${String(units)}`);
  }
  await storage.setItem(PREF_KEYS.units, units);
}

export async function saveLanguage(
  language: AppLanguage,
  storage: PreferenceStorage = activeStorage,
): Promise<void> {
  if (!isAppLanguage(language)) {
    throw new Error(`Invalid language: ${String(language)}`);
  }
  await storage.setItem(PREF_KEYS.language, language);
}

export async function markOnboardingComplete(
  storage: PreferenceStorage = activeStorage,
): Promise<void> {
  await storage.setItem(PREF_KEYS.onboardingComplete, 'true');
}

/**
 * Finish onboarding: persist region + completion flag together.
 */
export async function completeOnboarding(
  region: RegionId,
  storage: PreferenceStorage = activeStorage,
): Promise<AppPreferences> {
  await saveRegion(region, storage);
  await markOnboardingComplete(storage);
  const prefs = await loadPreferences(storage);
  return { ...prefs, region, onboardingComplete: true };
}

export { BETA_REGIONS } from '@/lib/regions';

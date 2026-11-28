/**
 * Local device preferences for onboarding and home region (T6.2).
 * Region is stored on-device only; nothing here sends coordinates.
 */
import { deviceStorage, type DeviceStorage } from '@/lib/device-storage';
import { isRegionId, type RegionId } from '@/lib/regions';

export const PREF_KEYS = {
  region: 'ww.homeRegion',
  onboardingComplete: 'ww.onboardingComplete',
} as const;

export type PreferenceStorage = DeviceStorage;

export type AppPreferences = {
  readonly region: RegionId | null;
  readonly onboardingComplete: boolean;
};

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

export async function loadPreferences(
  storage: PreferenceStorage = activeStorage,
): Promise<AppPreferences> {
  const [regionRaw, completeRaw] = await Promise.all([
    storage.getItem(PREF_KEYS.region),
    storage.getItem(PREF_KEYS.onboardingComplete),
  ]);
  return {
    region: parseRegion(regionRaw),
    onboardingComplete: parseOnboardingComplete(completeRaw),
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
  return { region, onboardingComplete: true };
}

export { BETA_REGIONS } from '@/lib/regions';

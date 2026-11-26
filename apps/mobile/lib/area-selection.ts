/**
 * Persist the user's chosen H3 res-7 cell (T6.4). Never stores lat/lng.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PreferenceStorage } from '@/lib/preferences';

export const AREA_PREF_KEYS = {
  cellR7: 'ww.selectedCellR7',
} as const;

const CELL_R7_PATTERN = /^[0-9a-f]{15}$/i;

const defaultStorage: PreferenceStorage = AsyncStorage;

function isCellR7(value: string): boolean {
  return CELL_R7_PATTERN.test(value);
}

export async function loadSelectedCellR7(
  storage: PreferenceStorage = defaultStorage,
): Promise<string | null> {
  const raw = await storage.getItem(AREA_PREF_KEYS.cellR7);
  if (raw === null || !isCellR7(raw)) {
    return null;
  }
  return raw.toLowerCase();
}

export async function saveSelectedCellR7(
  cellR7: string,
  storage: PreferenceStorage = defaultStorage,
): Promise<void> {
  if (!isCellR7(cellR7)) {
    throw new Error(`Invalid cellR7: ${cellR7}`);
  }
  await storage.setItem(AREA_PREF_KEYS.cellR7, cellR7.toLowerCase());
}

export async function clearSelectedCellR7(
  storage: PreferenceStorage = defaultStorage,
): Promise<void> {
  await storage.removeItem(AREA_PREF_KEYS.cellR7);
}

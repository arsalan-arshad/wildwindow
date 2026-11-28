import {
  createFallbackDeviceStorage,
  createMemoryDeviceStorage,
  type DeviceStorage,
} from '@/lib/device-storage';
import { loadPreferences, PREF_KEYS } from '@/lib/preferences';

describe('device-storage fallback (Expo Go / AsyncStorage v3 mismatch)', () => {
  it('falls back when primary throws Native module is null', async () => {
    const primary: DeviceStorage = {
      async getItem() {
        throw new Error('Native module is null, cannot access legacy storage');
      },
      async setItem() {
        throw new Error('Native module is null, cannot access legacy storage');
      },
      async removeItem() {
        throw new Error('Native module is null, cannot access legacy storage');
      },
    };
    const fallback = createMemoryDeviceStorage();
    const storage = createFallbackDeviceStorage(primary, fallback);

    await expect(storage.getItem('missing')).resolves.toBeNull();
    await storage.setItem(PREF_KEYS.region, 'scotland');
    await expect(storage.getItem(PREF_KEYS.region)).resolves.toBe('scotland');
    // After first failure, later calls stay on fallback (primary unused).
    await expect(loadPreferences(storage)).resolves.toEqual({
      region: 'scotland',
      onboardingComplete: false,
      units: 'metric',
      language: null,
    });
  });

  it('rethrows non-native-module errors from primary', async () => {
    const primary: DeviceStorage = {
      async getItem() {
        throw new Error('disk full');
      },
      async setItem() {
        throw new Error('disk full');
      },
      async removeItem() {
        throw new Error('disk full');
      },
    };
    const storage = createFallbackDeviceStorage(primary, createMemoryDeviceStorage());
    await expect(storage.getItem('k')).rejects.toThrow(/disk full/);
  });
});

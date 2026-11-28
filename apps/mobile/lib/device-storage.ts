/**
 * Device key-value storage for Expo Go / web / native.
 *
 * Expo SDK 58 ships AsyncStorage **2.x** in Expo Go. AsyncStorage **3.x** throws
 * `Native module is null, cannot access legacy storage` there. Prefer 2.2.0, and
 * still fall back to memory (or localStorage on web) if the native module is gone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type DeviceStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export function createMemoryDeviceStorage(initial: Record<string, string> = {}): DeviceStorage {
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

function createWebLocalStorage(): DeviceStorage {
  return {
    async getItem(key) {
      try {
        return globalThis.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
    async setItem(key, value) {
      try {
        globalThis.localStorage?.setItem(key, value);
      } catch {
        // Quota / private mode — ignore; caller already got a write attempt.
      }
    },
    async removeItem(key) {
      try {
        globalThis.localStorage?.removeItem(key);
      } catch {
        // ignore
      }
    },
  };
}

function isNativeModuleMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('native module is null') ||
    message.includes('native module') ||
    message.includes('asyncstorage')
  );
}

/**
 * Prefer `primary`; on first native-module failure, stick to `fallback` for the
 * rest of the process (session-scoped). Other errors still rethrow.
 */
export function createFallbackDeviceStorage(
  primary: DeviceStorage,
  fallback: DeviceStorage,
): DeviceStorage {
  let useFallback = false;
  const run = async <T>(op: (storage: DeviceStorage) => Promise<T>): Promise<T> => {
    if (useFallback) {
      return op(fallback);
    }
    try {
      return await op(primary);
    } catch (error) {
      if (!isNativeModuleMissingError(error)) {
        throw error;
      }
      useFallback = true;
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
          '[device-storage] AsyncStorage native module unavailable; using in-memory/web fallback',
          error,
        );
      }
      return op(fallback);
    }
  };
  return {
    getItem: (key) => run((s) => s.getItem(key)),
    setItem: (key, value) => run((s) => s.setItem(key, value)),
    removeItem: (key) => run((s) => s.removeItem(key)),
  };
}

const sessionFallback: DeviceStorage =
  Platform.OS === 'web' ? createWebLocalStorage() : createMemoryDeviceStorage();

/** Default app storage: Expo-compatible AsyncStorage with a soft fallback. */
export const deviceStorage: DeviceStorage = createFallbackDeviceStorage(
  AsyncStorage,
  sessionFallback,
);

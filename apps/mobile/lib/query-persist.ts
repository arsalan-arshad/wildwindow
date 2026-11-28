/**
 * AsyncStorage persister for the TanStack Query cache (T6.13).
 */
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

import { deviceStorage, type DeviceStorage } from '@/lib/device-storage';

export const QUERY_PERSIST_KEY = 'ww.tanstack-query';

export type QueryPersistStorage = DeviceStorage;

export type QueryPersister = ReturnType<typeof createAsyncStoragePersister>;

export function createQueryPersister(storage: QueryPersistStorage = deviceStorage): QueryPersister {
  return createAsyncStoragePersister({
    storage,
    key: QUERY_PERSIST_KEY,
    // Immediate flush — avoids hanging Jest open handles from the default throttle.
    throttleTime: 0,
  });
}

/** In-memory storage for unit tests (no AsyncStorage side effects). */
export function createMemoryQueryPersistStorage(
  initial: Record<string, string> = {},
): QueryPersistStorage {
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

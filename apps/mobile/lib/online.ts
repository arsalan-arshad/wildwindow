/**
 * Online / offline bridge for TanStack Query (T6.13).
 * Uses NetInfo on device; tests can call `onlineManager.setOnline(false)`.
 */
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

let listenerAttached = false;

/** Wire NetInfo → TanStack `onlineManager` once per JS runtime. */
export function setupOnlineManager(): void {
  if (listenerAttached) {
    return;
  }
  listenerAttached = true;

  onlineManager.setEventListener((setOnline) => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected === true;
      // `isInternetReachable` is null while unknown — treat as online then.
      const reachable = state.isInternetReachable !== false;
      setOnline(connected && reachable);
    });
    return unsubscribe;
  });
}

/** Reset for tests so setup can re-attach. */
export function resetOnlineManagerForTests(): void {
  listenerAttached = false;
  onlineManager.setOnline(true);
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => onlineManager.subscribe(onStoreChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Locale-aware absolute stamp for the "Last updated" line. */
export function formatLastUpdated(dataUpdatedAt: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dataUpdatedAt));
}

/**
 * Foreground "use my location" for S-06 / US-02.
 * Snaps on-device with snapToCell, then discards lat/lng before any API or storage call.
 */
import { snapToCell } from '@wildwindow/geoprivacy';

export type ForegroundLocationCoords = {
  readonly latitude: number;
  readonly longitude: number;
};

export type ForegroundLocationProvider = {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  getCurrentPositionAsync: () => Promise<{ coords: ForegroundLocationCoords }>;
};

export type MyLocationSuccess = {
  readonly ok: true;
  readonly cellR7: string;
};

export type MyLocationFailure = {
  readonly ok: false;
  readonly reason: 'denied' | 'unavailable' | 'error';
};

export type MyLocationResult = MyLocationSuccess | MyLocationFailure;

export type ResolveMyLocationCellOptions = {
  readonly location: ForegroundLocationProvider;
  /**
   * Called only with the snapped cell ID. Must never receive lat/lng.
   * Used for storage + GET /v1/areas/:cellR7.
   */
  readonly onCell: (cellR7: string) => Promise<void>;
  /** Override for tests; production uses @wildwindow/geoprivacy. */
  readonly snap?: (lat: number, lng: number, res?: number) => string;
};

/**
 * Request foreground permission, read GPS once, snap to H3 res-7, throw away
 * coordinates, then pass only `cellR7` to `onCell`.
 */
export async function resolveMyLocationCell(
  options: ResolveMyLocationCellOptions,
): Promise<MyLocationResult> {
  const snap = options.snap ?? snapToCell;

  try {
    const permission = await options.location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') {
      return { ok: false, reason: 'denied' };
    }

    const position = await options.location.getCurrentPositionAsync();
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const cellR7 = snap(lat, lng, 7);
    // lat/lng must not escape this function — only cellR7 continues.
    await options.onCell(cellR7);
    return { ok: true, cellR7 };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

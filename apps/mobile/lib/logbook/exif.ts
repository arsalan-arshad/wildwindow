/**
 * Camera EXIF helpers for the logbook (T6.9 / US-11).
 * GPS keys are stripped before any upload or create-body `exif` field.
 * Exact coordinates (when the owner opts in) travel only as `exactLocation`.
 */
import { FORBIDDEN_PUBLIC_KEYS, snapToCell } from '@wildwindow/geoprivacy';

/** Camera settings persisted on the logbook row (never GPS). */
export type LogbookCameraExif = {
  readonly camera?: string;
  readonly lens?: string;
  readonly focalLength?: string;
  readonly shutter?: string;
  readonly aperture?: string;
  readonly iso?: string;
  readonly dateTimeOriginal?: string;
};

export type OwnerExactPoint = {
  readonly lat: number;
  readonly lng: number;
};

const FORBIDDEN_KEY_SET = new Set(
  FORBIDDEN_PUBLIC_KEYS.map((key) => key.toLowerCase()).concat([
    'gps',
    'gpslatitude',
    'gpslongitude',
    'gpslatituderef',
    'gpslongituderef',
    'gpsaltitude',
    'gpsaltituderef',
    'gpsimgdirection',
    'gpsimgdirectionref',
    'gpsdestbearing',
    'gpsdestbearingref',
    'gpsspeed',
    'gpsspeedref',
    'gpstimestamp',
    'gpsdatestamp',
    'gpsareainformation',
    'gpsdop',
    'gpsstatus',
    'gpsmeasuremode',
    'gpsmapdatum',
    'gpsversionid',
    'gpsprocessingmethod',
    'gpssatellites',
    'altitude',
    'altituderef',
  ]),
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keyLooksLikeGps(key: string): boolean {
  const lower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (FORBIDDEN_KEY_SET.has(lower)) {
    return true;
  }
  return lower.startsWith('gps');
}

/**
 * True when a JSON-like value still carries a GPS / coordinate key.
 * Used by the acceptance test for the upload + create payload.
 */
export function containsGpsKey(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsGpsKey(item));
  }
  if (!isPlainObject(value)) {
    return false;
  }
  for (const [key, child] of Object.entries(value)) {
    if (keyLooksLikeGps(key)) {
      return true;
    }
    if (containsGpsKey(child)) {
      return true;
    }
  }
  return false;
}

export function assertNoGpsInExif(exif: Record<string, unknown>): void {
  if (containsGpsKey(exif)) {
    throw new Error('Logbook EXIF payload must not contain GPS or coordinate keys');
  }
}

function readString(raw: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return undefined;
}

function formatShutter(raw: Record<string, unknown>): string | undefined {
  const exposure = raw['ExposureTime'] ?? raw['ShutterSpeedValue'] ?? raw['shutter'];
  if (typeof exposure === 'number' && Number.isFinite(exposure) && exposure > 0) {
    if (exposure >= 1) {
      return `${exposure}s`;
    }
    const denom = Math.round(1 / exposure);
    return `1/${String(denom)}`;
  }
  if (typeof exposure === 'string' && exposure.trim().length > 0) {
    return exposure.trim();
  }
  return undefined;
}

function formatAperture(raw: Record<string, unknown>): string | undefined {
  const fnumber = raw['FNumber'] ?? raw['ApertureValue'] ?? raw['aperture'];
  if (typeof fnumber === 'number' && Number.isFinite(fnumber)) {
    return `f/${fnumber}`;
  }
  if (typeof fnumber === 'string' && fnumber.trim().length > 0) {
    const trimmed = fnumber.trim();
    return trimmed.startsWith('f') ? trimmed : `f/${trimmed}`;
  }
  return undefined;
}

function formatIso(raw: Record<string, unknown>): string | undefined {
  const iso = raw['ISOSpeedRatings'] ?? raw['PhotographicSensitivity'] ?? raw['ISO'] ?? raw['iso'];
  if (typeof iso === 'number' && Number.isFinite(iso)) {
    return String(Math.round(iso));
  }
  if (Array.isArray(iso) && typeof iso[0] === 'number' && Number.isFinite(iso[0])) {
    return String(Math.round(iso[0]));
  }
  if (typeof iso === 'string' && iso.trim().length > 0) {
    return iso.trim();
  }
  return undefined;
}

function formatFocalLength(raw: Record<string, unknown>): string | undefined {
  const focal = raw['FocalLength'] ?? raw['focalLength'];
  if (typeof focal === 'number' && Number.isFinite(focal)) {
    return `${focal}mm`;
  }
  if (typeof focal === 'string' && focal.trim().length > 0) {
    const trimmed = focal.trim();
    return trimmed.toLowerCase().endsWith('mm') ? trimmed : `${trimmed}mm`;
  }
  return undefined;
}

/**
 * Pull camera settings from picker EXIF. Drops every GPS / coordinate key.
 */
export function extractCameraExif(
  raw: Record<string, unknown> | null | undefined,
): LogbookCameraExif {
  if (raw === null || raw === undefined) {
    return {};
  }

  const make = readString(raw, ['Make', 'make']);
  const model = readString(raw, ['Model', 'model']);
  const camera =
    make !== undefined && model !== undefined
      ? `${make} ${model}`
      : (model ?? make ?? readString(raw, ['camera']));

  const lens = readString(raw, ['LensModel', 'LensMake', 'Lens', 'lens']);
  const dateTimeOriginal = readString(raw, [
    'DateTimeOriginal',
    'DateTimeDigitized',
    'DateTime',
    'dateTimeOriginal',
  ]);

  const focalLength = formatFocalLength(raw);
  const shutter = formatShutter(raw);
  const aperture = formatAperture(raw);
  const iso = formatIso(raw);

  const out: LogbookCameraExif = {
    ...(camera !== undefined ? { camera } : {}),
    ...(lens !== undefined ? { lens } : {}),
    ...(focalLength !== undefined ? { focalLength } : {}),
    ...(shutter !== undefined ? { shutter } : {}),
    ...(aperture !== undefined ? { aperture } : {}),
    ...(iso !== undefined ? { iso } : {}),
    ...(dateTimeOriginal !== undefined ? { dateTimeOriginal } : {}),
  };

  assertNoGpsInExif(out);
  return out;
}

function dmsToDecimal(dms: unknown, ref: unknown): number | null {
  let degrees: number | null = null;
  if (typeof dms === 'number' && Number.isFinite(dms)) {
    degrees = dms;
  } else if (Array.isArray(dms) && dms.length >= 1) {
    const d = typeof dms[0] === 'number' ? dms[0] : Number.NaN;
    const m = typeof dms[1] === 'number' ? dms[1] : 0;
    const s = typeof dms[2] === 'number' ? dms[2] : 0;
    if (!Number.isFinite(d)) {
      return null;
    }
    degrees = Math.abs(d) + Math.abs(m) / 60 + Math.abs(s) / 3600;
  }
  if (degrees === null || !Number.isFinite(degrees)) {
    return null;
  }
  const refStr = typeof ref === 'string' ? ref.toUpperCase() : '';
  if (refStr === 'S' || refStr === 'W') {
    return -degrees;
  }
  return degrees;
}

/**
 * Read GPS from picker EXIF for the optional owner-only exact point.
 * Returns null when GPS is missing or invalid. Never put this into `exif`.
 */
export function extractGpsFromExif(
  raw: Record<string, unknown> | null | undefined,
): OwnerExactPoint | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  const latDirect = raw['latitude'] ?? raw['Latitude'] ?? raw['lat'];
  const lngDirect = raw['longitude'] ?? raw['Longitude'] ?? raw['lng'] ?? raw['lon'];
  if (
    typeof latDirect === 'number' &&
    typeof lngDirect === 'number' &&
    Number.isFinite(latDirect) &&
    Number.isFinite(lngDirect) &&
    latDirect >= -90 &&
    latDirect <= 90 &&
    lngDirect >= -180 &&
    lngDirect <= 180
  ) {
    return { lat: latDirect, lng: lngDirect };
  }

  const lat = dmsToDecimal(raw['GPSLatitude'], raw['GPSLatitudeRef']);
  const lng = dmsToDecimal(raw['GPSLongitude'], raw['GPSLongitudeRef']);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  return { lat, lng };
}

/**
 * Parse EXIF DateTimeOriginal ("YYYY:MM:DD HH:MM:SS") to an ISO-8601 UTC string.
 * Falls back to `fallbackIso` when missing or unparseable.
 */
export function takenAtFromExif(camera: LogbookCameraExif, fallbackIso: string): string {
  const raw = camera.dateTimeOriginal;
  if (raw === undefined) {
    return fallbackIso;
  }
  // Common EXIF: "2024:06:15 07:30:00" or already ISO.
  const normalized = raw.includes('T')
    ? raw
    : raw.replace(/^(\d{4}):(\d{2}):(\d{2})[ T]/, '$1-$2-$3T').replace(/ /, 'T');
  const withZone = /Z$|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  if (Number.isNaN(date.getTime())) {
    return fallbackIso;
  }
  return date.toISOString();
}

/** Snap owner exact point to a res-7 cell for the coarse `cellR7` field. */
export function cellR7FromExactPoint(point: OwnerExactPoint): string {
  return snapToCell(point.lat, point.lng, 7);
}

/** JSON-safe camera EXIF object for POST /v1/me/logbook (no GPS keys). */
export function cameraExifToRecord(camera: LogbookCameraExif): Record<string, unknown> {
  const record: Record<string, unknown> = { ...camera };
  assertNoGpsInExif(record);
  return record;
}

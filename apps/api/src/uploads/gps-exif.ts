import exifr from 'exifr';

type GpsReading = {
  readonly latitude?: number;
  readonly longitude?: number;
};

/**
 * True when the image still carries GPS EXIF (ARCHITECTURE §5.3 / §12, T5.10).
 * Uses `exifr` — rejects any GPS IFD tags or decoded lat/lng.
 */
export async function hasGpsExif(buffer: Buffer): Promise<boolean> {
  // exifr is CommonJS; named ESM imports are unavailable at runtime.
  // eslint-disable-next-line import-x/no-named-as-default-member -- CJS default export API
  const gpsUnknown: unknown = await exifr.gps(buffer);
  if (isGpsReading(gpsUnknown)) {
    if (typeof gpsUnknown.latitude === 'number' || typeof gpsUnknown.longitude === 'number') {
      return true;
    }
  }

  // eslint-disable-next-line import-x/no-named-as-default-member -- CJS default export API
  const parsedUnknown: unknown = await exifr.parse(buffer, { gps: true });
  if (!isRecord(parsedUnknown)) {
    return false;
  }
  for (const key of Object.keys(parsedUnknown)) {
    if (key === 'latitude' || key === 'longitude' || key.startsWith('GPS')) {
      return true;
    }
  }
  return false;
}

/** Throw when GPS tags are present. Caller maps to HTTP `GPS_EXIF_FORBIDDEN`. */
export async function assertNoGpsExif(buffer: Buffer): Promise<void> {
  if (await hasGpsExif(buffer)) {
    throw new GpsExifPresentError();
  }
}

export class GpsExifPresentError extends Error {
  readonly code = 'GPS_EXIF_FORBIDDEN' as const;

  constructor(message = 'Upload still contains GPS EXIF; strip location metadata before upload') {
    super(message);
    this.name = 'GpsExifPresentError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGpsReading(value: unknown): value is GpsReading {
  return isRecord(value);
}

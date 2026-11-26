/**
 * Pick → read EXIF → re-encode (strip metadata) → build a GPS-free upload payload (T6.9).
 */
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';

import {
  assertNoGpsInExif,
  cameraExifToRecord,
  cellR7FromExactPoint,
  extractCameraExif,
  extractGpsFromExif,
  takenAtFromExif,
  type LogbookCameraExif,
  type OwnerExactPoint,
} from '@/lib/logbook/exif';

/** Matches `@wildwindow/shared` UPLOAD_MAX_BYTES (ARCHITECTURE §7 / T5.10). */
export const LOGBOOK_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

/** Re-encoded uploads are always JPEG after ImageManipulator. */
export type LogbookUploadMimeType = 'image/jpeg';

export type PickedPhotoAsset = {
  readonly uri: string;
  readonly mimeType?: string | null;
  readonly fileSize?: number | null;
  readonly exif?: Record<string, unknown> | null;
};

export type ImageManipulatorLike = {
  manipulateAsync: (
    uri: string,
    actions: readonly unknown[],
    options: { readonly compress: number; readonly format: typeof SaveFormat.JPEG },
  ) => Promise<{ readonly uri: string; readonly width: number; readonly height: number }>;
};

export type LocalBlobReader = (uri: string) => Promise<{
  readonly blob: Blob;
  readonly byteSize: number;
}>;

/** Everything needed to PUT then POST /v1/me/logbook — no GPS in file or exif. */
export type PreparedLogbookUpload = {
  /** Re-encoded JPEG URI (manipulator drops EXIF). */
  readonly uploadUri: string;
  readonly mimeType: LogbookUploadMimeType;
  readonly byteSize: number;
  readonly blob: Blob;
  /** Camera settings only. */
  readonly exif: LogbookCameraExif;
  /** JSON body field — same as exif, asserted GPS-free. */
  readonly exifRecord: Record<string, unknown>;
  readonly takenAt: string;
  /** From source EXIF GPS when present; never embedded in upload bytes or exifRecord. */
  readonly photoGps: OwnerExactPoint | null;
  readonly suggestedCellR7: string | null;
};

export type PrepareLogbookPhotoOptions = {
  readonly asset: PickedPhotoAsset;
  /** Injected clock for tests. */
  readonly now?: Date;
  readonly manipulator?: ImageManipulatorLike;
  readonly readBlob?: LocalBlobReader;
};

const defaultManipulator: ImageManipulatorLike = {
  manipulateAsync: (uri, actions, options) => manipulateAsync(uri, actions as never, options),
};

async function defaultReadBlob(uri: string): Promise<{ blob: Blob; byteSize: number }> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Could not read re-encoded photo (${String(response.status)})`);
  }
  const blob = await response.blob();
  return { blob, byteSize: blob.size };
}

/**
 * Re-encode the picked asset to JPEG (strips all metadata), extract camera
 * settings, and return an upload payload that contains no GPS keys.
 */
export async function prepareLogbookPhoto(
  options: PrepareLogbookPhotoOptions,
): Promise<PreparedLogbookUpload> {
  const now = options.now ?? new Date();
  const manipulator = options.manipulator ?? defaultManipulator;
  const readBlob = options.readBlob ?? defaultReadBlob;
  const { asset } = options;

  const camera = extractCameraExif(asset.exif ?? null);
  const photoGps = extractGpsFromExif(asset.exif ?? null);
  const takenAt = takenAtFromExif(camera, now.toISOString());
  const suggestedCellR7 = photoGps !== null ? cellR7FromExactPoint(photoGps) : null;

  // Empty actions = re-encode only. New JPEG has no EXIF / GPS (ARCHITECTURE §5.3).
  const stripped = await manipulator.manipulateAsync(asset.uri, [], {
    compress: 0.92,
    format: SaveFormat.JPEG,
  });

  const { blob, byteSize } = await readBlob(stripped.uri);
  if (byteSize <= 0) {
    throw new Error('Re-encoded photo is empty');
  }
  if (byteSize > LOGBOOK_UPLOAD_MAX_BYTES) {
    throw new Error(`Photo exceeds the ${String(LOGBOOK_UPLOAD_MAX_BYTES)} byte upload limit`);
  }

  const exifRecord = cameraExifToRecord(camera);
  assertNoGpsInExif(exifRecord);

  return {
    uploadUri: stripped.uri,
    mimeType: 'image/jpeg',
    byteSize,
    blob,
    exif: camera,
    exifRecord,
    takenAt,
    photoGps,
    suggestedCellR7,
  };
}

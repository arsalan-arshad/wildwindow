/**
 * Presign + PUT a GPS-stripped JPEG, then build the logbook create body (T6.9).
 */
import type { ApiClient } from '@wildwindow/shared/client';
import type { LogbookCreateRequest, OwnerExactLocation } from '@wildwindow/shared';

import { assertNoGpsInExif, containsGpsKey, type OwnerExactPoint } from '@/lib/logbook/exif';
import type { PreparedLogbookUpload } from '@/lib/logbook/prepare-photo';

export type LogbookUploadPutResult = {
  readonly photoKey: string;
  readonly uploadUrl: string;
};

export type PutPreparedPhotoOptions = {
  readonly api: Pick<ApiClient, 'uploads'>;
  readonly prepared: PreparedLogbookUpload;
  /** Override fetch for tests. */
  readonly fetchImpl?: typeof fetch;
};

/**
 * Presign then PUT the re-encoded JPEG. The body is the stripped blob — no EXIF.
 */
export async function putPreparedLogbookPhoto(
  options: PutPreparedPhotoOptions,
): Promise<LogbookUploadPutResult> {
  const { api, prepared } = options;
  const fetchImpl = options.fetchImpl ?? fetch;

  assertNoGpsInExif(prepared.exifRecord);
  if (containsGpsKey(prepared.exifRecord)) {
    throw new Error('Refusing to upload: EXIF record still has GPS keys');
  }

  const presign = await api.uploads.presign({
    mimeType: prepared.mimeType,
    byteSize: prepared.byteSize,
  });

  const headers: Record<string, string> = {
    ...presign.headers,
    'content-type': prepared.mimeType,
  };

  const response = await fetchImpl(presign.uploadUrl, {
    method: 'PUT',
    headers,
    body: prepared.blob,
  });

  if (!response.ok) {
    throw new Error(`Photo upload failed (${String(response.status)})`);
  }

  return { photoKey: presign.photoKey, uploadUrl: presign.uploadUrl };
}

export type BuildLogbookCreateBodyOptions = {
  readonly prepared: PreparedLogbookUpload;
  readonly photoKey: string;
  readonly taxonId?: string | null;
  readonly notes?: string;
  readonly cellR7?: string | null;
  /**
   * When true and photo GPS was available, include owner-only `exactLocation`.
   * Never copies GPS into `exif`.
   */
  readonly keepExactPoint?: boolean;
};

/**
 * Build POST /v1/me/logbook body. Guarantees `exif` has no GPS keys.
 */
export function buildLogbookCreateBody(
  options: BuildLogbookCreateBodyOptions,
): LogbookCreateRequest {
  const { prepared, photoKey } = options;
  assertNoGpsInExif(prepared.exifRecord);

  let exactLocation: OwnerExactLocation | undefined;
  if (options.keepExactPoint === true && prepared.photoGps !== null) {
    const point: OwnerExactPoint = prepared.photoGps;
    exactLocation = { lat: point.lat, lng: point.lng };
  }

  const cellR7 =
    options.cellR7 !== undefined
      ? options.cellR7
      : exactLocation !== undefined
        ? prepared.suggestedCellR7
        : (prepared.suggestedCellR7 ?? null);

  const body: LogbookCreateRequest = {
    takenAt: prepared.takenAt,
    photoKey,
    exif: prepared.exifRecord,
    ...(options.taxonId !== undefined ? { taxonId: options.taxonId } : {}),
    ...(options.notes !== undefined && options.notes.trim().length > 0
      ? { notes: options.notes.trim() }
      : {}),
    ...(cellR7 !== null && cellR7 !== undefined ? { cellR7 } : {}),
    ...(exactLocation !== undefined ? { exactLocation } : {}),
  };

  if (containsGpsKey(body.exif ?? {})) {
    throw new Error('Logbook create body exif must not contain GPS');
  }

  return body;
}

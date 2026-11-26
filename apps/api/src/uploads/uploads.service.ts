import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import {
  PresignUploadRequestSchema,
  UPLOAD_MAX_BYTES,
  UploadMimeTypeSchema,
  type PresignUploadRequest,
  type PresignUploadResponse,
  type UploadMimeType,
} from '@wildwindow/shared';

import { validationError } from '../http/api-error.js';
import { verifyLocalPutToken } from '../storage/local-put-token.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.types.js';

import { assertNoGpsExif, GpsExifPresentError } from './gps-exif.js';
import { gpsExifForbiddenError } from './uploads.errors.js';

/** Presigned upload URL lifetime (seconds). */
export const PRESIGN_EXPIRES_SECONDS = 15 * 60;

const MIME_EXTENSION: Record<UploadMimeType, string> = {
  'image/jpeg': '.jpg',
  'image/heic': '.heic',
  'image/webp': '.webp',
};

@Injectable()
export class UploadsService {
  constructor(@Inject(STORAGE_SERVICE) private readonly storage: StorageService) {}

  async presign(userId: string, body: unknown): Promise<PresignUploadResponse> {
    const parsed = PresignUploadRequestSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((issue) => issue.message).join('; ');
      throw validationError(message.length > 0 ? message : 'Invalid upload request');
    }
    const request: PresignUploadRequest = parsed.data;
    if (request.byteSize > UPLOAD_MAX_BYTES) {
      throw validationError(`byteSize must be ≤ ${String(UPLOAD_MAX_BYTES)}`);
    }

    const photoKey = buildPhotoKey(userId, request.mimeType);
    const result = await this.storage.createPresignedPut({
      key: photoKey,
      mimeType: request.mimeType,
      byteSize: request.byteSize,
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
    });

    return {
      uploadUrl: result.uploadUrl,
      photoKey,
      headers: { ...result.headers },
      expiresAt: result.expiresAt.toISOString(),
    };
  }

  /**
   * Local-driver PUT: verify token, MIME/size, reject GPS EXIF, then store.
   * S3 uploads go straight to the bucket; GPS is checked when the API next reads the object
   * (e.g. logbook) via {@link assertStoredObjectSafe}.
   */
  async putLocal(
    token: string,
    body: Buffer,
    contentTypeHeader: string | undefined,
    signingSecret: string,
    nowMs: number = Date.now(),
  ): Promise<{ ok: true; photoKey: string }> {
    const payload = verifyLocalPutToken(token, signingSecret, nowMs);
    if (payload === null) {
      throw validationError('Invalid or expired upload token');
    }

    const mimeParsed = UploadMimeTypeSchema.safeParse(payload.mimeType);
    if (!mimeParsed.success) {
      throw validationError('Unsupported MIME type');
    }

    if (body.byteLength === 0) {
      throw validationError('Empty upload body');
    }
    if (body.byteLength > UPLOAD_MAX_BYTES) {
      throw validationError(`Upload exceeds ${String(UPLOAD_MAX_BYTES)} bytes`);
    }
    if (body.byteLength !== payload.byteSize) {
      throw validationError('Content-Length does not match presigned byteSize');
    }

    const headerMime = normalizeMime(contentTypeHeader);
    if (headerMime !== undefined && headerMime !== payload.mimeType) {
      throw validationError('Content-Type does not match presigned mimeType');
    }

    await this.rejectIfGps(body);

    await this.storage.putObject(payload.key, body, payload.mimeType);
    return { ok: true, photoKey: payload.key };
  }

  /** Server-side GPS gate for a buffer (acceptance: fixture with GPS rejected). */
  async rejectIfGps(buffer: Buffer): Promise<void> {
    try {
      await assertNoGpsExif(buffer);
    } catch (err: unknown) {
      if (err instanceof GpsExifPresentError) {
        throw gpsExifForbiddenError(err.message);
      }
      throw err;
    }
  }

  /** Fetch a stored object and reject it when GPS EXIF remains. */
  async assertStoredObjectSafe(photoKey: string): Promise<Buffer> {
    const body = await this.storage.getObject(photoKey);
    if (body === null) {
      throw validationError('Upload not found');
    }
    await this.rejectIfGps(body);
    return body;
  }
}

function buildPhotoKey(userId: string, mimeType: UploadMimeType): string {
  const ext = MIME_EXTENSION[mimeType];
  return `uploads/${userId}/${randomUUID()}${ext}`;
}

function normalizeMime(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) {
    return undefined;
  }
  const semi = trimmed.indexOf(';');
  return semi === -1 ? trimmed : trimmed.slice(0, semi).trim();
}

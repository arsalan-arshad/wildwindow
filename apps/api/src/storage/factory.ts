import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalStorage } from './local.storage.js';
import { S3Storage } from './s3.storage.js';
import { type StorageDriverId, type StorageService } from './storage.types.js';

export type CreateStorageServiceOptions = {
  readonly driver: StorageDriverId;
  readonly nodeEnv: string;
  readonly apiPublicUrl?: string;
  readonly localRootDir?: string;
  readonly signingSecret?: string;
  readonly s3Bucket?: string;
  readonly s3Region?: string;
};

/**
 * Resolve `STORAGE_DRIVER`: empty → `local` outside production, `s3` in production.
 */
export function resolveStorageDriverId(raw: string | undefined, nodeEnv: string): StorageDriverId {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (normalized === '') {
    return nodeEnv === 'production' ? 's3' : 'local';
  }
  if (normalized === 'local' || normalized === 's3') {
    return normalized;
  }
  throw new Error(`Unsupported STORAGE_DRIVER: ${raw ?? ''}`);
}

export function createStorageService(options: CreateStorageServiceOptions): StorageService {
  switch (options.driver) {
    case 'local': {
      const publicBaseUrl = resolveLocalPublicBaseUrl(options.apiPublicUrl, options.nodeEnv);
      const signingSecret = resolveSigningSecret(options.signingSecret, options.nodeEnv);
      const rootDir =
        options.localRootDir !== undefined && options.localRootDir.trim().length > 0
          ? options.localRootDir.trim()
          : join(tmpdir(), 'wildwindow-uploads');
      return new LocalStorage({
        rootDir,
        publicBaseUrl,
        signingSecret,
      });
    }
    case 's3': {
      const bucket = options.s3Bucket?.trim() ?? '';
      if (bucket.length === 0) {
        throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
      }
      const region = (options.s3Region ?? '').trim() || 'eu-west-2';
      return new S3Storage({ bucket, region });
    }
    default: {
      const _exhaustive: never = options.driver;
      throw new Error(`Unsupported storage driver: ${String(_exhaustive)}`);
    }
  }
}

function resolveLocalPublicBaseUrl(raw: string | undefined, nodeEnv: string): string {
  const trimmed = (raw ?? '').trim().replace(/\/$/, '');
  if (trimmed.length > 0) {
    return trimmed;
  }
  if (nodeEnv === 'production') {
    throw new Error('API_PUBLIC_URL is required when STORAGE_DRIVER=local in production');
  }
  return 'http://127.0.0.1:3001';
}

function resolveSigningSecret(raw: string | undefined, nodeEnv: string): string {
  const trimmed = raw?.trim() ?? '';
  if (trimmed.length > 0) {
    return trimmed;
  }
  if (nodeEnv === 'production') {
    throw new Error('STORAGE_SIGNING_SECRET is required when STORAGE_DRIVER=local in production');
  }
  // Deterministic non-secret for local/test only — never use in production.
  return 'ww-local-storage-dev-signing-secret';
}

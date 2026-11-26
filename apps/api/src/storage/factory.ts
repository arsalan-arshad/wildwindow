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
  readonly r2Bucket?: string;
  readonly r2Endpoint?: string;
  readonly r2AccountId?: string;
  readonly r2AccessKeyId?: string;
  readonly r2SecretAccessKey?: string;
  readonly r2PublicUrl?: string;
};

/**
 * Resolve `STORAGE_DRIVER`: empty → `local` outside production, `r2` in production
 * (Railway beta uses Cloudflare R2; AWS S3 remains available via `STORAGE_DRIVER=s3`).
 */
export function resolveStorageDriverId(raw: string | undefined, nodeEnv: string): StorageDriverId {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (normalized === '') {
    return nodeEnv === 'production' ? 'r2' : 'local';
  }
  if (normalized === 'local' || normalized === 's3' || normalized === 'r2') {
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
      return new S3Storage({ bucket, region, driver: 's3' });
    }
    case 'r2': {
      return createR2Storage(options);
    }
    default: {
      const _exhaustive: never = options.driver;
      throw new Error(`Unsupported storage driver: ${String(_exhaustive)}`);
    }
  }
}

function createR2Storage(options: CreateStorageServiceOptions): S3Storage {
  const bucket = options.r2Bucket?.trim() ?? '';
  if (bucket.length === 0) {
    throw new Error('R2_BUCKET is required when STORAGE_DRIVER=r2');
  }

  const endpoint = resolveR2Endpoint(options.r2Endpoint, options.r2AccountId);
  const accessKeyId = options.r2AccessKeyId?.trim() ?? '';
  const secretAccessKey = options.r2SecretAccessKey?.trim() ?? '';
  if (accessKeyId.length === 0) {
    throw new Error('R2_ACCESS_KEY_ID is required when STORAGE_DRIVER=r2');
  }
  if (secretAccessKey.length === 0) {
    throw new Error('R2_SECRET_ACCESS_KEY is required when STORAGE_DRIVER=r2');
  }

  return new S3Storage({
    driver: 'r2',
    bucket,
    region: 'auto',
    ...(options.r2PublicUrl !== undefined && options.r2PublicUrl.trim().length > 0
      ? { publicBaseUrl: options.r2PublicUrl.trim() }
      : {}),
    clientConfig: {
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    },
  });
}

/**
 * Prefer explicit `R2_ENDPOINT`; otherwise build
 * `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`.
 */
export function resolveR2Endpoint(
  endpointRaw: string | undefined,
  accountIdRaw: string | undefined,
): string {
  const endpoint = endpointRaw?.trim() ?? '';
  if (endpoint.length > 0) {
    return endpoint.replace(/\/$/, '');
  }
  const accountId = accountIdRaw?.trim() ?? '';
  if (accountId.length > 0) {
    return `https://${accountId}.r2.cloudflarestorage.com`;
  }
  throw new Error('R2_ENDPOINT or R2_ACCOUNT_ID is required when STORAGE_DRIVER=r2');
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

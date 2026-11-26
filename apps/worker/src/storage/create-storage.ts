import { readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { loadEnv } from '@wildwindow/shared';
import { z } from 'zod';

const purgeStorageEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  STORAGE_DRIVER: z.string().optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_REGION: z.string().min(1).optional(),
  LOCAL_STORAGE_DIR: z.string().min(1).optional(),
});

export type PurgeStorageEnv = z.infer<typeof purgeStorageEnvSchema>;

/** Minimal object storage used by `purge-deleted` (delete keys + user export prefix). */
export type PurgeStorage = {
  readonly driver: 'local' | 's3';
  deleteObject(key: string): Promise<void>;
  /** Delete every object under `exports/{userId}/` (best-effort). */
  deleteUserExportPrefix(userId: string): Promise<number>;
};

export function loadPurgeStorageEnv(source: NodeJS.ProcessEnv = process.env): PurgeStorageEnv {
  return loadEnv(purgeStorageEnvSchema, source);
}

export function resolvePurgeStorageDriver(
  raw: string | undefined,
  nodeEnv: string,
): 'local' | 's3' {
  const normalized = (raw ?? '').trim().toLowerCase();
  if (normalized === '') {
    return nodeEnv === 'production' ? 's3' : 'local';
  }
  if (normalized === 'local' || normalized === 's3') {
    return normalized;
  }
  throw new Error(`Unsupported STORAGE_DRIVER: ${raw ?? ''}`);
}

export function createPurgeStorage(env: PurgeStorageEnv = loadPurgeStorageEnv()): PurgeStorage {
  const driver = resolvePurgeStorageDriver(env.STORAGE_DRIVER, env.NODE_ENV);
  if (driver === 'local') {
    const rootDir =
      env.LOCAL_STORAGE_DIR !== undefined && env.LOCAL_STORAGE_DIR.trim().length > 0
        ? resolve(env.LOCAL_STORAGE_DIR.trim())
        : join(tmpdir(), 'wildwindow-uploads');
    return new LocalPurgeStorage(rootDir);
  }

  const bucket = env.S3_BUCKET?.trim() ?? '';
  if (bucket.length === 0) {
    throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3');
  }
  const region = (env.S3_REGION ?? '').trim() || 'eu-west-2';
  return new S3PurgeStorage(bucket, region);
}

class LocalPurgeStorage implements PurgeStorage {
  readonly driver = 'local' as const;

  constructor(private readonly rootDir: string) {}

  async deleteObject(key: string): Promise<void> {
    const path = this.resolveKeyPath(key);
    try {
      await rm(path, { force: true });
    } catch (err: unknown) {
      if (isNotFound(err)) {
        return;
      }
      throw err;
    }
  }

  async deleteUserExportPrefix(userId: string): Promise<number> {
    const prefixDir = this.resolveKeyPath(`exports/${userId}`);
    try {
      const info = await stat(prefixDir);
      if (!info.isDirectory()) {
        await rm(prefixDir, { force: true });
        return 1;
      }
      const entries = await readdir(prefixDir);
      await rm(prefixDir, { recursive: true, force: true });
      return entries.length;
    } catch (err: unknown) {
      if (isNotFound(err)) {
        return 0;
      }
      throw err;
    }
  }

  private resolveKeyPath(key: string): string {
    if (key.length === 0 || key.includes('\0') || key.includes('..')) {
      throw new Error('Invalid storage key');
    }
    const absolute = resolve(this.rootDir, key);
    const rootWithSep = this.rootDir.endsWith(sep) ? this.rootDir : `${this.rootDir}${sep}`;
    if (absolute !== this.rootDir && !absolute.startsWith(rootWithSep)) {
      throw new Error('Invalid storage key');
    }
    return join(this.rootDir, key);
  }
}

class S3PurgeStorage implements PurgeStorage {
  readonly driver = 's3' as const;
  private readonly client: S3Client;

  constructor(
    private readonly bucket: string,
    region: string,
  ) {
    this.client = new S3Client({ region });
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async deleteUserExportPrefix(userId: string): Promise<number> {
    const prefix = `exports/${userId}/`;
    let deleted = 0;
    let continuationToken: string | undefined;
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ...(continuationToken !== undefined ? { ContinuationToken: continuationToken } : {}),
        }),
      );
      const keys = (listed.Contents ?? [])
        .map((obj) => obj.Key)
        .filter((key): key is string => typeof key === 'string' && key.length > 0);
      for (const key of keys) {
        await this.deleteObject(key);
        deleted += 1;
      }
      continuationToken = listed.IsTruncated === true ? listed.NextContinuationToken : undefined;
    } while (continuationToken !== undefined);
    return deleted;
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';
}

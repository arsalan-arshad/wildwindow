import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createStorageService, resolveStorageDriverId } from './factory.js';
import { LocalStorage } from './local.storage.js';
import { S3Storage } from './s3.storage.js';

describe('storage factory (T5.10)', () => {
  it('defaults to local outside production and s3 in production', () => {
    expect(resolveStorageDriverId(undefined, 'development')).toBe('local');
    expect(resolveStorageDriverId('', 'test')).toBe('local');
    expect(resolveStorageDriverId(undefined, 'production')).toBe('s3');
    expect(resolveStorageDriverId('LOCAL', 'production')).toBe('local');
    expect(resolveStorageDriverId('s3', 'development')).toBe('s3');
  });

  it('creates LocalStorage and S3Storage', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ww-storage-'));
    try {
      const local = createStorageService({
        driver: 'local',
        nodeEnv: 'test',
        apiPublicUrl: 'http://127.0.0.1:3001',
        localRootDir: root,
        signingSecret: 'secret',
      });
      expect(local).toBeInstanceOf(LocalStorage);
      expect(local.driver).toBe('local');

      const s3 = createStorageService({
        driver: 's3',
        nodeEnv: 'test',
        s3Bucket: 'ww-test-bucket',
        s3Region: 'eu-west-2',
      });
      expect(s3).toBeInstanceOf(S3Storage);
      expect(s3.driver).toBe('s3');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('requires S3_BUCKET for s3', () => {
    expect(() =>
      createStorageService({
        driver: 's3',
        nodeEnv: 'test',
      }),
    ).toThrow(/S3_BUCKET/);
  });
});

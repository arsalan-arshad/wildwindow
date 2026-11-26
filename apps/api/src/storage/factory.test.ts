import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createStorageService, resolveR2Endpoint, resolveStorageDriverId } from './factory.js';
import { LocalStorage } from './local.storage.js';
import { S3Storage } from './s3.storage.js';

describe('storage factory (T5.10)', () => {
  it('defaults empty/unset to local in every environment; r2 is explicit opt-in', () => {
    expect(resolveStorageDriverId(undefined, 'development')).toBe('local');
    expect(resolveStorageDriverId('', 'test')).toBe('local');
    expect(resolveStorageDriverId(undefined, 'production')).toBe('local');
    expect(resolveStorageDriverId('  ', 'production')).toBe('local');
    expect(resolveStorageDriverId('LOCAL', 'production')).toBe('local');
    expect(resolveStorageDriverId('s3', 'development')).toBe('s3');
    expect(resolveStorageDriverId('r2', 'development')).toBe('r2');
    expect(resolveStorageDriverId('r2', 'production')).toBe('r2');
  });

  it('creates LocalStorage, S3Storage, and R2 (S3-compatible) storage', async () => {
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

      const r2 = createStorageService({
        driver: 'r2',
        nodeEnv: 'test',
        r2Bucket: 'ww-r2-bucket',
        r2Endpoint: 'https://abc123.r2.cloudflarestorage.com',
        r2AccessKeyId: 'r2-key',
        r2SecretAccessKey: 'r2-secret',
      });
      expect(r2).toBeInstanceOf(S3Storage);
      expect(r2.driver).toBe('r2');
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

  it('requires R2 bucket, endpoint/account, and credentials', () => {
    expect(() =>
      createStorageService({
        driver: 'r2',
        nodeEnv: 'test',
        r2Endpoint: 'https://abc.r2.cloudflarestorage.com',
        r2AccessKeyId: 'k',
        r2SecretAccessKey: 's',
      }),
    ).toThrow(/R2_BUCKET/);

    expect(() =>
      createStorageService({
        driver: 'r2',
        nodeEnv: 'test',
        r2Bucket: 'b',
        r2AccessKeyId: 'k',
        r2SecretAccessKey: 's',
      }),
    ).toThrow(/R2_ENDPOINT or R2_ACCOUNT_ID/);

    expect(() =>
      createStorageService({
        driver: 'r2',
        nodeEnv: 'test',
        r2Bucket: 'b',
        r2AccountId: 'acct',
        r2SecretAccessKey: 's',
      }),
    ).toThrow(/R2_ACCESS_KEY_ID/);

    expect(() =>
      createStorageService({
        driver: 'r2',
        nodeEnv: 'test',
        r2Bucket: 'b',
        r2AccountId: 'acct',
        r2AccessKeyId: 'k',
      }),
    ).toThrow(/R2_SECRET_ACCESS_KEY/);
  });

  it('builds R2 endpoint from account id when endpoint unset', () => {
    expect(resolveR2Endpoint(undefined, 'acct123')).toBe(
      'https://acct123.r2.cloudflarestorage.com',
    );
    expect(resolveR2Endpoint('https://custom.example/', undefined)).toBe('https://custom.example');
  });
});

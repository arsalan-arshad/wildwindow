import { describe, expect, it, vi } from 'vitest';

import {
  createPurgeStorage,
  resolvePurgeStorageDriver,
  resolveR2Endpoint,
} from './create-storage.js';

vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    readonly config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
    send = vi.fn();
  }
  return {
    S3Client: MockS3Client,
    DeleteObjectCommand: class DeleteObjectCommand {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
    ListObjectsV2Command: class ListObjectsV2Command {
      input: unknown;
      constructor(input: unknown) {
        this.input = input;
      }
    },
  };
});

describe('purge storage (R2)', () => {
  it('defaults to local outside production and r2 in production', () => {
    expect(resolvePurgeStorageDriver(undefined, 'development')).toBe('local');
    expect(resolvePurgeStorageDriver('', 'test')).toBe('local');
    expect(resolvePurgeStorageDriver(undefined, 'production')).toBe('r2');
    expect(resolvePurgeStorageDriver('s3', 'production')).toBe('s3');
    expect(resolvePurgeStorageDriver('r2', 'development')).toBe('r2');
  });

  it('builds R2 endpoint from account id', () => {
    expect(resolveR2Endpoint(undefined, 'acct')).toBe('https://acct.r2.cloudflarestorage.com');
  });

  it('creates an R2 purge client with endpoint credentials', () => {
    const storage = createPurgeStorage({
      NODE_ENV: 'test',
      STORAGE_DRIVER: 'r2',
      R2_BUCKET: 'ww-photos',
      R2_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
    });
    expect(storage.driver).toBe('r2');
  });

  it('requires R2 credentials when STORAGE_DRIVER=r2', () => {
    expect(() =>
      createPurgeStorage({
        NODE_ENV: 'test',
        STORAGE_DRIVER: 'r2',
        R2_BUCKET: 'ww-photos',
        R2_ACCOUNT_ID: 'acct',
      }),
    ).toThrow(/R2_ACCESS_KEY_ID/);
  });
});

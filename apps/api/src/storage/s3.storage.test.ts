import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { describe, expect, it, vi } from 'vitest';

import { S3Storage } from './s3.storage.js';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(() => Promise.resolve('https://s3.example/presigned-put')),
}));

describe('S3Storage', () => {
  it('creates a presigned PUT URL with content headers', async () => {
    const send = vi.fn();
    const client = { send } as unknown as S3Client;
    const storage = new S3Storage({
      bucket: 'ww-photos',
      region: 'eu-west-2',
      client,
    });

    const result = await storage.createPresignedPut({
      key: 'uploads/u1/a.jpg',
      mimeType: 'image/jpeg',
      byteSize: 2048,
      expiresInSeconds: 900,
    });

    expect(result.uploadUrl).toBe('https://s3.example/presigned-put');
    expect(result.headers).toEqual({
      'Content-Type': 'image/jpeg',
      'Content-Length': '2048',
    });
    expect(getSignedUrl).toHaveBeenCalledOnce();
    const calls = vi.mocked(getSignedUrl).mock.calls;
    const first = calls[0];
    expect(first).toBeDefined();
    if (first === undefined) {
      throw new Error('expected getSignedUrl call');
    }
    const [, command, opts] = first;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(opts).toEqual({ expiresIn: 900 });
  });

  it('put/get/delete delegate to the S3 client', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({}) // put
      .mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2, 3])),
        },
      })
      .mockResolvedValueOnce({}) // delete
      .mockRejectedValueOnce(Object.assign(new Error('missing'), { name: 'NoSuchKey' }));

    const client = { send } as unknown as S3Client;
    const storage = new S3Storage({
      bucket: 'ww-photos',
      region: 'eu-west-2',
      client,
    });

    await storage.putObject('k', Buffer.from([1, 2, 3]), 'image/webp');
    await expect(storage.getObject('k')).resolves.toEqual(Buffer.from([1, 2, 3]));
    await storage.deleteObject('k');
    await expect(storage.getObject('missing')).resolves.toBeNull();
    expect(send).toHaveBeenCalledTimes(4);
  });
});

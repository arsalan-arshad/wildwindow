import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { verifyLocalGetToken } from './local-get-token.js';
import { verifyLocalPutToken } from './local-put-token.js';
import { LocalStorage } from './local.storage.js';

describe('LocalStorage', () => {
  it('presigns a PUT, writes, reads, and deletes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ww-local-'));
    try {
      const storage = new LocalStorage({
        rootDir: root,
        publicBaseUrl: 'http://127.0.0.1:3001',
        signingSecret: 'secret',
      });
      const key = 'uploads/u1/photo.jpg';
      const presign = await storage.createPresignedPut({
        key,
        mimeType: 'image/jpeg',
        byteSize: 4,
        expiresInSeconds: 600,
      });
      expect(presign.uploadUrl.startsWith('http://127.0.0.1:3001/v1/uploads/put/')).toBe(true);
      expect(presign.headers['Content-Type']).toBe('image/jpeg');

      const token = decodeURIComponent(presign.uploadUrl.split('/').pop() ?? '');
      const payload = verifyLocalPutToken(token, 'secret');
      expect(payload?.key).toBe(key);

      await storage.putObject(key, Buffer.from('test'), 'image/jpeg');
      await expect(storage.getObject(key)).resolves.toEqual(Buffer.from('test'));
      await storage.deleteObject(key);
      await expect(storage.getObject(key)).resolves.toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('presigns a GET URL with a verifiable token', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ww-local-get-'));
    try {
      const storage = new LocalStorage({
        rootDir: root,
        publicBaseUrl: 'http://127.0.0.1:3001',
        signingSecret: 'secret',
      });
      const key = 'uploads/u1/gallery.jpg';
      const presign = await storage.createPresignedGet({ key, expiresInSeconds: 300 });
      expect(presign.url.startsWith('http://127.0.0.1:3001/v1/uploads/object/')).toBe(true);
      const token = decodeURIComponent(presign.url.split('/').pop() ?? '');
      expect(verifyLocalGetToken(token, 'secret')?.key).toBe(key);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects path traversal keys', async () => {
    const root = await mkdtemp(join(tmpdir(), 'ww-local-'));
    try {
      const storage = new LocalStorage({
        rootDir: root,
        publicBaseUrl: 'http://127.0.0.1:3001',
        signingSecret: 'secret',
      });
      await expect(
        storage.putObject('../escape.jpg', Buffer.from('x'), 'image/jpeg'),
      ).rejects.toThrow(/Invalid storage key/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

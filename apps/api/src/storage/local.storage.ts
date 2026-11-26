import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { mintLocalGetToken, type LocalGetTokenPayload } from './local-get-token.js';
import { mintLocalPutToken, type LocalPutTokenPayload } from './local-put-token.js';
import {
  type PresignGetInput,
  type PresignGetResult,
  type PresignPutInput,
  type PresignPutResult,
  type StorageService,
} from './storage.types.js';

export type LocalStorageOptions = {
  readonly rootDir: string;
  /** Public API origin used in local presigned PUT URLs (no trailing slash). */
  readonly publicBaseUrl: string;
  readonly signingSecret: string;
};

/**
 * Dev/test filesystem driver.
 * Presigned PUTs hit `/v1/uploads/put/:token`; GETs hit `/v1/uploads/object/:token`.
 */
export class LocalStorage implements StorageService {
  readonly driver = 'local' as const;

  private readonly rootDir: string;
  private readonly publicBaseUrl: string;
  private readonly signingSecret: string;

  constructor(options: LocalStorageOptions) {
    this.rootDir = resolve(options.rootDir);
    this.publicBaseUrl = options.publicBaseUrl.replace(/\/$/, '');
    this.signingSecret = options.signingSecret;
  }

  createPresignedPut(input: PresignPutInput): Promise<PresignPutResult> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const payload: LocalPutTokenPayload = {
      key: input.key,
      mimeType: input.mimeType,
      byteSize: input.byteSize,
      exp: Math.floor(expiresAt.getTime() / 1000),
    };
    const token = mintLocalPutToken(payload, this.signingSecret);
    return Promise.resolve({
      uploadUrl: `${this.publicBaseUrl}/v1/uploads/put/${encodeURIComponent(token)}`,
      headers: {
        'Content-Type': input.mimeType,
        'Content-Length': String(input.byteSize),
      },
      expiresAt,
    });
  }

  createPresignedGet(input: PresignGetInput): Promise<PresignGetResult> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    const payload: LocalGetTokenPayload = {
      key: input.key,
      exp: Math.floor(expiresAt.getTime() / 1000),
    };
    const token = mintLocalGetToken(payload, this.signingSecret);
    return Promise.resolve({
      url: `${this.publicBaseUrl}/v1/uploads/object/${encodeURIComponent(token)}`,
      expiresAt,
    });
  }

  async putObject(key: string, body: Buffer, _contentType: string): Promise<void> {
    const path = this.resolveKeyPath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async getObject(key: string): Promise<Buffer | null> {
    const path = this.resolveKeyPath(key);
    try {
      return await readFile(path);
    } catch (err: unknown) {
      if (isNotFound(err)) {
        return null;
      }
      throw err;
    }
  }

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

function isNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'ENOENT';
}

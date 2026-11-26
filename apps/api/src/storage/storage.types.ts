/** Nest DI token for the object storage driver (T5.10). */
export const STORAGE_SERVICE = Symbol('WW_STORAGE_SERVICE');

export type StorageDriverId = 'local' | 's3' | 'r2';

export type PresignPutInput = {
  readonly key: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly expiresInSeconds: number;
};

export type PresignPutResult = {
  readonly uploadUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
};

export type PresignGetInput = {
  readonly key: string;
  readonly expiresInSeconds: number;
};

export type PresignGetResult = {
  readonly url: string;
  readonly expiresAt: Date;
};

/**
 * Private object storage for logbook / challenge photos (ARCHITECTURE §2 / T5.10).
 * Clients upload via `createPresignedPut`; the API never stores exact coordinates.
 * Public challenge gallery uses `createPresignedGet` (S3/R2 signed GET / local token GET).
 */
export interface StorageService {
  readonly driver: StorageDriverId;

  createPresignedPut(input: PresignPutInput): Promise<PresignPutResult>;

  createPresignedGet(input: PresignGetInput): Promise<PresignGetResult>;

  putObject(key: string, body: Buffer, contentType: string): Promise<void>;

  getObject(key: string): Promise<Buffer | null>;

  deleteObject(key: string): Promise<void>;
}

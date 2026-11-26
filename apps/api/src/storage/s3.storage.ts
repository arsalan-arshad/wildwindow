import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  type PresignGetInput,
  type PresignGetResult,
  type PresignPutInput,
  type PresignPutResult,
  type StorageDriverId,
  type StorageService,
} from './storage.types.js';

export type S3CompatibleDriverId = Extract<StorageDriverId, 's3' | 'r2'>;

export type S3StorageOptions = {
  readonly bucket: string;
  readonly region: string;
  /** Defaults to `s3`. Use `r2` for Cloudflare R2 (S3-compatible). */
  readonly driver?: S3CompatibleDriverId;
  /**
   * Optional public base URL (custom domain / r2.dev). When set, GET URLs are
   * `${publicBaseUrl}/${key}` instead of signed S3/R2 API URLs. PUT always uses
   * signed URLs against the API endpoint.
   */
  readonly publicBaseUrl?: string;
  /** Injected in tests; production uses the default credential chain (or R2 keys). */
  readonly client?: S3Client;
  readonly clientConfig?: S3ClientConfig;
};

/**
 * Private S3-compatible bucket driver with presigned PUT/GET URLs (ARCHITECTURE §2 / T5.10).
 * Used for AWS S3 and Cloudflare R2. CloudFront signed URLs (CLOUDFRONT_*) remain for the
 * optional AWS cutover (T9.x); Railway beta uses R2 (`STORAGE_DRIVER=r2`).
 */
export class S3Storage implements StorageService {
  readonly driver: S3CompatibleDriverId;

  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly publicBaseUrl: string | undefined;

  constructor(options: S3StorageOptions) {
    this.driver = options.driver ?? 's3';
    this.bucket = options.bucket;
    this.publicBaseUrl =
      options.publicBaseUrl !== undefined && options.publicBaseUrl.trim().length > 0
        ? options.publicBaseUrl.trim().replace(/\/$/, '')
        : undefined;
    this.client =
      options.client ??
      new S3Client({
        region: options.region,
        ...(options.clientConfig ?? {}),
      });
  }

  async createPresignedPut(input: PresignPutInput): Promise<PresignPutResult> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
      ContentType: input.mimeType,
      ContentLength: input.byteSize,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    });
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    return {
      uploadUrl,
      headers: {
        'Content-Type': input.mimeType,
        'Content-Length': String(input.byteSize),
      },
      expiresAt,
    };
  }

  async createPresignedGet(input: PresignGetInput): Promise<PresignGetResult> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    if (this.publicBaseUrl !== undefined) {
      return {
        url: `${this.publicBaseUrl}/${input.key}`,
        expiresAt,
      };
    }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: input.key,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    });
    return { url, expiresAt };
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Buffer | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (result.Body === undefined) {
        return null;
      }
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (err: unknown) {
      if (isNoSuchKey(err)) {
        return null;
      }
      throw err;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }
}

function isNoSuchKey(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const name = 'name' in err ? err.name : undefined;
  const code = 'Code' in err ? err.Code : undefined;
  const metadata = '$metadata' in err ? err.$metadata : undefined;
  const httpStatus =
    typeof metadata === 'object' && metadata !== null && 'httpStatusCode' in metadata
      ? metadata.httpStatusCode
      : undefined;
  return name === 'NoSuchKey' || code === 'NoSuchKey' || httpStatus === 404;
}

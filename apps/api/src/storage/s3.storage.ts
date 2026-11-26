import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import {
  type PresignPutInput,
  type PresignPutResult,
  type StorageService,
} from './storage.types.js';

export type S3StorageOptions = {
  readonly bucket: string;
  readonly region: string;
  /** Injected in tests; production uses the default credential chain. */
  readonly client?: S3Client;
  readonly clientConfig?: S3ClientConfig;
};

/**
 * Private S3 bucket driver with presigned PUT URLs (ARCHITECTURE §2 / T5.10).
 */
export class S3Storage implements StorageService {
  readonly driver = 's3' as const;

  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
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

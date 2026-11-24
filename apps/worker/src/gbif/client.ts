import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { GbifHttpError, GbifResponseError, GbifRetryExhaustedError } from './errors.js';
import {
  GbifDownloadRequestSchema,
  GbifDownloadSchema,
  type GbifDownload,
  type GbifDownloadFormat,
  type GbifPredicate,
} from './schemas.js';

export const GBIF_API_BASE_URL = 'https://api.gbif.org';

export type GbifCredentials = {
  readonly user: string;
  readonly password: string;
  readonly email: string;
};

export type GbifClientOptions = {
  readonly credentials: GbifCredentials;
  /** Override API origin (tests). Default: https://api.gbif.org */
  readonly baseUrl?: string;
  readonly fetchImpl?: typeof fetch;
  /** Injected clock sleep for backoff (tests). */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Max attempts including the first try. Default: 4 */
  readonly maxAttempts?: number;
  /** Base delay in ms before exponential growth. Default: 250 */
  readonly backoffBaseMs?: number;
};

export type RequestDownloadInput = {
  readonly predicate: GbifPredicate;
  readonly format?: GbifDownloadFormat;
  readonly sendNotification?: boolean;
};

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function basicAuthHeader(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`;
}

function backoffDelayMs(attemptIndex: number, baseMs: number): number {
  // attemptIndex is 0-based for the retry about to happen (after first failure).
  const exp = baseMs * 2 ** attemptIndex;
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(baseMs / 2)));
  return exp + jitter;
}

function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

/**
 * Typed GBIF occurrence download client (§3.2).
 * Covers request, status polling payload, and zip download with retries.
 */
export class GbifClient {
  private readonly credentials: GbifCredentials;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxAttempts: number;
  private readonly backoffBaseMs: number;

  constructor(options: GbifClientOptions) {
    this.credentials = options.credentials;
    this.baseUrl = (options.baseUrl ?? GBIF_API_BASE_URL).replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxAttempts = options.maxAttempts ?? 4;
    this.backoffBaseMs = options.backoffBaseMs ?? 250;
  }

  /**
   * POST /v1/occurrence/download/request → download key (plain text body).
   */
  async requestDownload(input: RequestDownloadInput): Promise<string> {
    const body = GbifDownloadRequestSchema.parse({
      creator: this.credentials.user,
      notificationAddresses: [this.credentials.email],
      sendNotification: input.sendNotification ?? true,
      format: input.format ?? 'SIMPLE_CSV',
      predicate: input.predicate,
    });

    const response = await this.fetchWithRetry('/v1/occurrence/download/request', {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(this.credentials.user, this.credentials.password),
        'Content-Type': 'application/json',
        Accept: 'text/plain',
      },
      body: JSON.stringify(body),
    });

    const key = (await response.text()).trim();
    if (key.length === 0) {
      throw new GbifResponseError('GBIF download request returned an empty key');
    }
    return key;
  }

  /**
   * GET /v1/occurrence/download/{key} → status, DOI, download link, totals.
   */
  async getDownload(key: string): Promise<GbifDownload> {
    const encoded = encodeURIComponent(key);
    const response = await this.fetchWithRetry(`/v1/occurrence/download/${encoded}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    const json: unknown = await response.json();
    const parsed = GbifDownloadSchema.safeParse(json);
    if (!parsed.success) {
      throw new GbifResponseError(
        `GBIF download status failed validation: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  /**
   * Download the zip for a succeeded download key (or an absolute downloadLink).
   * Writes to `destPath` using a stream; creates parent directories.
   */
  async downloadFile(keyOrLink: string, destPath: string): Promise<void> {
    const url =
      keyOrLink.startsWith('http://') || keyOrLink.startsWith('https://')
        ? keyOrLink
        : `${this.baseUrl}/v1/occurrence/download/request/${encodeURIComponent(keyOrLink)}.zip`;

    const response = await this.fetchWithRetryAbsolute(url, {
      method: 'GET',
      headers: {
        Accept: 'application/zip, application/octet-stream',
      },
      redirect: 'follow',
    });

    if (response.body === null) {
      throw new GbifResponseError('GBIF download file response had no body');
    }

    await mkdir(path.dirname(destPath), { recursive: true });
    // fetch body is a web ReadableStream; Node's fromWeb accepts it at runtime.
    const nodeStream = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]);
    await pipeline(nodeStream, createWriteStream(destPath));
  }

  private async fetchWithRetry(apiPath: string, init: RequestInit): Promise<Response> {
    return this.fetchWithRetryAbsolute(`${this.baseUrl}${apiPath}`, init, apiPath);
  }

  private async fetchWithRetryAbsolute(
    url: string,
    init: RequestInit,
    logPath: string = url,
  ): Promise<Response> {
    let lastStatus: number | undefined;
    let lastBody = '';

    for (let attempt = 0; attempt < this.maxAttempts; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, init);
      } catch (err) {
        if (attempt + 1 >= this.maxAttempts) {
          const detail = err instanceof Error ? err.message : String(err);
          throw new GbifRetryExhaustedError(
            `GBIF request failed after ${String(this.maxAttempts)} attempts for ${logPath}: ${detail}`,
            this.maxAttempts,
          );
        }
        await this.sleep(backoffDelayMs(attempt, this.backoffBaseMs));
        continue;
      }

      if (response.ok) {
        return response;
      }

      lastStatus = response.status;
      lastBody = await response.text().catch(() => '');

      if (!isRetryableStatus(response.status) || attempt + 1 >= this.maxAttempts) {
        if (isRetryableStatus(response.status) && attempt + 1 >= this.maxAttempts) {
          throw new GbifRetryExhaustedError(
            `GBIF request exhausted retries (${String(this.maxAttempts)}) for ${logPath}: HTTP ${String(response.status)}`,
            this.maxAttempts,
            response.status,
          );
        }
        throw new GbifHttpError(response.status, logPath, lastBody);
      }

      await this.sleep(backoffDelayMs(attempt, this.backoffBaseMs));
    }

    throw new GbifRetryExhaustedError(
      `GBIF request exhausted retries for ${logPath}`,
      this.maxAttempts,
      lastStatus,
    );
  }
}

export function createGbifClient(options: GbifClientOptions): GbifClient {
  return new GbifClient(options);
}

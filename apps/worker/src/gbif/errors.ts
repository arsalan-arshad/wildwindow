/** Typed errors for the GBIF occurrence download client. */

export class GbifHttpError extends Error {
  readonly status: number;
  readonly path: string;
  readonly body: string;

  constructor(status: number, path: string, body: string) {
    super(`GBIF HTTP ${String(status)} for ${path}: ${body.slice(0, 200)}`);
    this.name = 'GbifHttpError';
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export class GbifRetryExhaustedError extends Error {
  readonly causeStatus?: number;
  readonly attempts: number;

  constructor(message: string, attempts: number, causeStatus?: number) {
    super(message);
    this.name = 'GbifRetryExhaustedError';
    this.attempts = attempts;
    if (causeStatus !== undefined) {
      this.causeStatus = causeStatus;
    }
  }
}

export class GbifResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GbifResponseError';
  }
}

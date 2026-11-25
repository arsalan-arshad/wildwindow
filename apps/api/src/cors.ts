/**
 * Nest CORS options derived from `WEB_ORIGIN`.
 * Pure: no I/O; pass the env value in (tests supply fixtures).
 */

export type ApiCorsOptions = {
  /** Exact origin echoed in Access-Control-Allow-Origin (never `*`). */
  origin: (
    requestOrigin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => void;
  credentials: true;
};

/** Strip whitespace and a single trailing slash so env vs browser Origin match. */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/u, '');
}

/**
 * Build CORS options for Nest `enableCors`.
 * Returns `undefined` when `WEB_ORIGIN` is missing/blank (CORS stays off —
 * server-to-server and same-origin still work; cross-origin browsers fail).
 */
export function corsOptionsFromWebOrigin(
  webOrigin: string | undefined,
): ApiCorsOptions | undefined {
  if (webOrigin === undefined) {
    return undefined;
  }
  const allowed = normalizeOrigin(webOrigin);
  if (allowed === '') {
    return undefined;
  }

  return {
    credentials: true,
    origin: (requestOrigin, callback) => {
      // Non-browser clients (curl, healthchecks) send no Origin — allow.
      if (requestOrigin === undefined || requestOrigin === '') {
        callback(null, true);
        return;
      }
      callback(null, normalizeOrigin(requestOrigin) === allowed);
    },
  };
}

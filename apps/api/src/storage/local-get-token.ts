import { createHmac, timingSafeEqual } from 'node:crypto';

export type LocalGetTokenPayload = {
  readonly key: string;
  /** Unix seconds. */
  readonly exp: number;
};

function b64urlEncode(buf: Buffer): string {
  return buf.toString('base64url');
}

function b64urlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function sign(payloadB64: string, secret: string): string {
  return b64urlEncode(createHmac('sha256', secret).update(`get:${payloadB64}`).digest());
}

/** Encode a time-limited local GET token (HMAC-SHA256). Distinct from PUT tokens. */
export function mintLocalGetToken(payload: LocalGetTokenPayload, secret: string): string {
  const payloadB64 = b64urlEncode(Buffer.from(JSON.stringify(payload), 'utf8'));
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/**
 * Verify and decode a local GET token.
 * Returns `null` when the signature is wrong, the payload is malformed, or it has expired.
 */
export function verifyLocalGetToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): LocalGetTokenPayload | null {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) {
    return null;
  }
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payloadB64, secret);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(b64urlDecode(payloadB64).toString('utf8')) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  const key = record['key'];
  const exp = record['exp'];
  if (
    typeof key !== 'string' ||
    key.length === 0 ||
    typeof exp !== 'number' ||
    !Number.isFinite(exp)
  ) {
    return null;
  }
  if (nowMs >= exp * 1000) {
    return null;
  }
  return { key, exp };
}

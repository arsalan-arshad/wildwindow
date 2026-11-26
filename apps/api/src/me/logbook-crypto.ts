import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { OwnerExactLocation } from '@wildwindow/shared';

/** Version byte for AES-256-GCM payloads stored in `exact_point_enc`. */
export const LOGBOOK_ENC_VERSION = 1 as const;

const ALGORITHM = 'aes-256-gcm' as const;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/**
 * Fixed 32-byte key for local/test only — never use in production.
 * Base64: `d3ctZGV2LWxvZ2Jvb2stYWVzMjU2LWdjbS1rZXkhISE=`
 */
export const DEV_LOGBOOK_ENC_KEY = Buffer.from('ww-dev-logbook-aes256-gcm-key!!!', 'utf8');

/**
 * Parse `LOGBOOK_ENC_KEY` as a 32-byte AES key.
 * Accepts standard base64 (with or without padding) or a 64-char hex string.
 */
export function parseLogbookEncKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('LOGBOOK_ENC_KEY is empty');
  }

  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex');
  }

  const decoded = Buffer.from(trimmed, 'base64');
  if (decoded.byteLength !== KEY_BYTES) {
    throw new Error(
      `LOGBOOK_ENC_KEY must decode to ${String(KEY_BYTES)} bytes (got ${String(decoded.byteLength)})`,
    );
  }
  return decoded;
}

/**
 * Resolve the encryption key from env.
 * Production requires `LOGBOOK_ENC_KEY`; other environments fall back to a fixed
 * non-secret default so tests and local boot work without Railway secrets.
 */
export function resolveLogbookEncKey(raw: string | undefined, nodeEnv: string): Buffer {
  const trimmed = raw?.trim() ?? '';
  if (trimmed.length > 0) {
    return parseLogbookEncKey(trimmed);
  }
  if (nodeEnv === 'production') {
    throw new Error('LOGBOOK_ENC_KEY is required in production');
  }
  if (DEV_LOGBOOK_ENC_KEY.byteLength !== KEY_BYTES) {
    throw new Error('Internal error: DEV_LOGBOOK_ENC_KEY length');
  }
  return Buffer.from(DEV_LOGBOOK_ENC_KEY);
}

/**
 * Encrypt an owner exact point for `app.logbook_entries.exact_point_enc`.
 * Wire format: `version(1) || iv(12) || tag(16) || ciphertext`.
 */
export function encryptExactPoint(point: OwnerExactLocation, key: Buffer): Buffer {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify({ lat: point.lat, lng: point.lng }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([LOGBOOK_ENC_VERSION]), iv, tag, encrypted]);
}

/**
 * Decrypt `exact_point_enc`. Returns null when the column is null.
 * Throws on truncated/tampered ciphertext or wrong key.
 */
export function decryptExactPoint(
  ciphertext: Buffer | null,
  key: Buffer,
): OwnerExactLocation | null {
  if (ciphertext === null) {
    return null;
  }
  assertKey(key);
  const minLen = 1 + IV_BYTES + TAG_BYTES + 1;
  if (ciphertext.byteLength < minLen) {
    throw new Error('exact_point_enc is truncated');
  }
  const version = ciphertext[0];
  if (version !== LOGBOOK_ENC_VERSION) {
    throw new Error(`Unsupported exact_point_enc version: ${String(version)}`);
  }
  const iv = ciphertext.subarray(1, 1 + IV_BYTES);
  const tag = ciphertext.subarray(1 + IV_BYTES, 1 + IV_BYTES + TAG_BYTES);
  const encrypted = ciphertext.subarray(1 + IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  const parsed: unknown = JSON.parse(plaintext.toString('utf8'));
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('lat' in parsed) ||
    !('lng' in parsed) ||
    typeof (parsed as { lat: unknown }).lat !== 'number' ||
    typeof (parsed as { lng: unknown }).lng !== 'number'
  ) {
    throw new Error('exact_point_enc payload is not a lat/lng object');
  }
  const { lat, lng } = parsed as { lat: number; lng: number };
  return { lat, lng };
}

/**
 * True when `buffer` looks like ciphertext (not a UTF-8 JSON lat/lng leak).
 * Used in acceptance tests.
 */
export function looksLikeCiphertext(buffer: Buffer): boolean {
  if (buffer.byteLength < 1 + IV_BYTES + TAG_BYTES + 1) {
    return false;
  }
  if (buffer[0] !== LOGBOOK_ENC_VERSION) {
    return false;
  }
  const asUtf8 = buffer.toString('utf8');
  if (asUtf8.includes('"lat"') || asUtf8.includes('"lng"')) {
    return false;
  }
  return true;
}

function assertKey(key: Buffer): void {
  if (key.byteLength !== KEY_BYTES) {
    throw new Error(`AES-256 key must be ${String(KEY_BYTES)} bytes`);
  }
}

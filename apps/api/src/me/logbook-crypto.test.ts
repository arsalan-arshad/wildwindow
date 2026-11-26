import { describe, expect, it } from 'vitest';

import {
  DEV_LOGBOOK_ENC_KEY,
  decryptExactPoint,
  encryptExactPoint,
  looksLikeCiphertext,
  parseLogbookEncKey,
  resolveLogbookEncKey,
} from './logbook-crypto.js';

describe('logbook AES-256-GCM (T5.11)', () => {
  it('round-trips an exact point', () => {
    const key = DEV_LOGBOOK_ENC_KEY;
    const point = { lat: 55.8642, lng: -4.2518 };
    const enc = encryptExactPoint(point, key);
    expect(looksLikeCiphertext(enc)).toBe(true);
    expect(enc.toString('utf8')).not.toContain('55.8642');
    expect(enc.toString('utf8')).not.toContain('"lat"');
    expect(decryptExactPoint(enc, key)).toEqual(point);
  });

  it('uses a fresh IV each encryption', () => {
    const key = DEV_LOGBOOK_ENC_KEY;
    const point = { lat: 24.86, lng: 67.01 };
    const a = encryptExactPoint(point, key);
    const b = encryptExactPoint(point, key);
    expect(a.equals(b)).toBe(false);
    expect(decryptExactPoint(a, key)).toEqual(point);
    expect(decryptExactPoint(b, key)).toEqual(point);
  });

  it('returns null for a null column', () => {
    expect(decryptExactPoint(null, DEV_LOGBOOK_ENC_KEY)).toBeNull();
  });

  it('rejects a wrong key', () => {
    const enc = encryptExactPoint({ lat: 1, lng: 2 }, DEV_LOGBOOK_ENC_KEY);
    const other = Buffer.alloc(32, 7);
    expect(() => decryptExactPoint(enc, other)).toThrow();
  });

  it('parses base64 and hex keys', () => {
    const key = Buffer.alloc(32, 9);
    expect(parseLogbookEncKey(key.toString('base64')).equals(key)).toBe(true);
    expect(parseLogbookEncKey(key.toString('hex')).equals(key)).toBe(true);
  });

  it('requires LOGBOOK_ENC_KEY in production', () => {
    expect(() => resolveLogbookEncKey(undefined, 'production')).toThrow(/LOGBOOK_ENC_KEY/);
    expect(resolveLogbookEncKey(undefined, 'test').equals(DEV_LOGBOOK_ENC_KEY)).toBe(true);
  });
});

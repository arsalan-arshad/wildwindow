import { describe, expect, it } from 'vitest';

import { mintLocalPutToken, verifyLocalPutToken } from './local-put-token.js';

describe('local put token', () => {
  const secret = 'test-signing-secret';

  it('round-trips a valid token', () => {
    const payload = {
      key: 'uploads/user/a.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1024,
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const token = mintLocalPutToken(payload, secret);
    expect(verifyLocalPutToken(token, secret)).toEqual(payload);
  });

  it('rejects a tampered token and an expired token', () => {
    const payload = {
      key: 'uploads/user/a.jpg',
      mimeType: 'image/jpeg',
      byteSize: 1024,
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    const token = mintLocalPutToken(payload, secret);
    expect(verifyLocalPutToken(`${token}x`, secret)).toBeNull();
    expect(verifyLocalPutToken(token, 'other-secret')).toBeNull();

    const expired = mintLocalPutToken(
      { ...payload, exp: Math.floor(Date.now() / 1000) - 1 },
      secret,
    );
    expect(verifyLocalPutToken(expired, secret)).toBeNull();
  });
});

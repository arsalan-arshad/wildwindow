import { describe, expect, it } from 'vitest';

import { mintLocalGetToken, verifyLocalGetToken } from './local-get-token.js';

describe('local-get-token', () => {
  const secret = 'test-secret';

  it('round-trips a valid token', () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const token = mintLocalGetToken({ key: 'uploads/u1/a.jpg', exp }, secret);
    expect(verifyLocalGetToken(token, secret)).toEqual({ key: 'uploads/u1/a.jpg', exp });
  });

  it('rejects a wrong secret, tampered payload, or expired token', () => {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const token = mintLocalGetToken({ key: 'uploads/u1/a.jpg', exp }, secret);
    expect(verifyLocalGetToken(token, 'other')).toBeNull();
    expect(verifyLocalGetToken(`${token}x`, secret)).toBeNull();
    expect(verifyLocalGetToken(token, secret, (exp + 1) * 1000)).toBeNull();
  });

  it('does not accept a PUT-shaped signature (get: prefix)', () => {
    // PUT tokens use a different HMAC input; a forged "put" payload must not verify as GET.
    const exp = Math.floor(Date.now() / 1000) + 600;
    const putLike = mintLocalGetToken({ key: 'uploads/u1/a.jpg', exp }, secret);
    // Flip the first character of the signature segment.
    const [payload, sig] = putLike.split('.');
    if (payload === undefined || sig === undefined || sig.length === 0) {
      throw new Error('expected token parts');
    }
    const flipped = `${sig[0] === 'a' ? 'b' : 'a'}${sig.slice(1)}`;
    expect(verifyLocalGetToken(`${payload}.${flipped}`, secret)).toBeNull();
  });
});

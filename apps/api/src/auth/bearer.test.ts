import { describe, expect, it } from 'vitest';

import { extractBearerToken } from './bearer.js';

describe('extractBearerToken', () => {
  it('parses a normal Bearer token', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('is case-insensitive on Bearer', () => {
    expect(extractBearerToken('bearer tok')).toBe('tok');
    expect(extractBearerToken('BEARER tok')).toBe('tok');
  });

  it('returns undefined without a token', () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken('')).toBeUndefined();
    expect(extractBearerToken('Basic x')).toBeUndefined();
    expect(extractBearerToken('Bearer')).toBeUndefined();
    expect(extractBearerToken('Bearer ')).toBeUndefined();
  });
});

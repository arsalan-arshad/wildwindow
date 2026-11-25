import { describe, expect, it } from 'vitest';

import { hasAuthenticatedOwner } from './owner-location.js';

describe('hasAuthenticatedOwner', () => {
  it('is true for a non-empty user id', () => {
    expect(hasAuthenticatedOwner({ user: { id: 'u1' } })).toBe(true);
  });

  it('is false when user is missing or id is empty', () => {
    expect(hasAuthenticatedOwner({})).toBe(false);
    expect(hasAuthenticatedOwner({ user: undefined })).toBe(false);
    expect(hasAuthenticatedOwner({ user: { id: '' } })).toBe(false);
  });
});

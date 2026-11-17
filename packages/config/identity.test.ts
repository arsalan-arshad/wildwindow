import { describe, expect, it } from 'vitest';

import { identity } from './test-fixture.js';

describe('identity', () => {
  it('returns the same value', () => {
    expect(identity('wildwindow')).toBe('wildwindow');
    expect(identity(42)).toBe(42);
  });
});

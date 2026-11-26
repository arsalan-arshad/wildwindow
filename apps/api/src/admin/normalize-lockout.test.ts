import { describe, expect, it } from 'vitest';

import { normalizeLockoutMonths } from './admin.service.js';

describe('normalizeLockoutMonths', () => {
  it('sorts and dedupes months', () => {
    expect(normalizeLockoutMonths([8, 3, 3, 4, 1])).toEqual([1, 3, 4, 8]);
  });

  it('returns empty for empty input', () => {
    expect(normalizeLockoutMonths([])).toEqual([]);
  });
});

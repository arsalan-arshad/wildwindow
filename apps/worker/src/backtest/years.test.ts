import { describe, expect, it } from 'vitest';

import { yearWindowForHoldout } from './years.js';

describe('yearWindowForHoldout (§4.7)', () => {
  it('maps holdout H to training H−9 … H−1', () => {
    expect(yearWindowForHoldout(2023)).toEqual({
      holdoutYear: 2023,
      trainFromYear: 2014,
      trainToYear: 2022,
    });
  });

  it('rejects non-integer / out-of-range years', () => {
    expect(() => yearWindowForHoldout(2023.5)).toThrow(/holdout year/);
    expect(() => yearWindowForHoldout(1999)).toThrow(/holdout year/);
  });
});

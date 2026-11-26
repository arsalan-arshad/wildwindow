import { describe, expect, it } from 'vitest';

import { isTierLowering } from '@/lib/admin/tier-rank';

describe('isTierLowering', () => {
  it('detects privacy weakenings', () => {
    expect(isTierLowering('highly_protected', 'protected')).toBe(true);
    expect(isTierLowering('protected', 'open')).toBe(true);
    expect(isTierLowering('no_forecast', 'open')).toBe(true);
  });

  it('allows raising or same tier', () => {
    expect(isTierLowering('open', 'protected')).toBe(false);
    expect(isTierLowering('protected', 'protected')).toBe(false);
    expect(isTierLowering('protected', 'no_forecast')).toBe(false);
  });
});

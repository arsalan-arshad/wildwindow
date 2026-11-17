import { describe, expect, it } from 'vitest';

import { SensitivityTierSchema, SensitiveSpeciesFileSchema } from './data-schemas.js';

describe('SensitivityTierSchema', () => {
  it('accepts PRD §9.2 tiers', () => {
    for (const tier of ['open', 'protected', 'highly_protected', 'no_forecast'] as const) {
      expect(SensitivityTierSchema.parse(tier)).toBe(tier);
    }
  });

  it('rejects an invalid tier with a clear message', () => {
    const result = SensitivityTierSchema.safeParse('secret');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message.toLowerCase()).toContain('invalid');
    }
  });
});

describe('SensitiveSpeciesFileSchema', () => {
  it('rejects an invalid tier in a file payload', () => {
    const result = SensitiveSpeciesFileSchema.safeParse({
      version: 1,
      species: [{ scientificName: 'Alcedo atthis', region: 'scotland', tier: 'hidden' }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(' ');
      expect(message.toLowerCase()).toMatch(/invalid|enum/);
    }
  });
});

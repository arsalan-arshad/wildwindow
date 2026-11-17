import { describe, expect, it } from 'vitest';

import { bucketise } from './bucketise.js';

describe('bucketise', () => {
  it('returns level 1 for an empty input', () => {
    const bucket = bucketise([]);
    expect(bucket(0)).toBe(1);
    expect(bucket(99)).toBe(1);
  });

  it('returns level 1 for a single value (and any query)', () => {
    const bucket = bucketise([42]);
    expect(bucket(42)).toBe(1);
    expect(bucket(0)).toBe(1);
  });

  it('puts equal values into the same bucket (ties)', () => {
    const bucket = bucketise([10, 10, 10, 10, 10]);
    expect(bucket(10)).toBe(1);
  });

  it('spreads a strictly increasing sample across buckets', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const bucket = bucketise(values);
    const levels = values.map(bucket);
    expect(new Set(levels).size).toBeGreaterThan(1);
    expect(bucket(1)).toBe(1);
    expect(bucket(10)).toBe(5);
  });
});

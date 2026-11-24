import { describe, expect, it } from 'vitest';

import { effortGroupFromClass } from './effort-group-from-class.js';

describe('effortGroupFromClass', () => {
  it('maps Aves and Mammalia directly', () => {
    expect(effortGroupFromClass('Aves')).toBe('Aves');
    expect(effortGroupFromClass('Mammalia')).toBe('Mammalia');
  });

  it('maps Reptilia successors to Reptilia', () => {
    expect(effortGroupFromClass('Squamata')).toBe('Reptilia');
    expect(effortGroupFromClass('Testudines')).toBe('Reptilia');
    expect(effortGroupFromClass('Crocodylia')).toBe('Reptilia');
    expect(effortGroupFromClass('Reptilia')).toBe('Reptilia');
  });

  it('returns undefined for unknown or empty', () => {
    expect(effortGroupFromClass(undefined)).toBeUndefined();
    expect(effortGroupFromClass('')).toBeUndefined();
    expect(effortGroupFromClass('Insecta')).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { doiFromCitation } from './doi.js';

describe('doiFromCitation', () => {
  it('extracts a DOI from a doi.org citation URL', () => {
    expect(doiFromCitation('https://doi.org/10.15468/dl.j5kh6v')).toBe('10.15468/dl.j5kh6v');
  });

  it('accepts dx.doi.org and http', () => {
    expect(doiFromCitation('http://dx.doi.org/10.15468/dl.abc123')).toBe('10.15468/dl.abc123');
  });

  it('returns null when no DOI is present', () => {
    expect(doiFromCitation('GBIF occurrence download')).toBeNull();
    expect(doiFromCitation('')).toBeNull();
  });

  it('strips trailing punctuation', () => {
    expect(doiFromCitation('See https://doi.org/10.15468/dl.xyz.')).toBe('10.15468/dl.xyz');
  });
});

import { describe, expect, it } from 'vitest';

import { forecastUrl, percentile, P95_BUDGET_MS } from './run-forecast-perf.js';

describe('T9.8 forecast perf helpers', () => {
  it('builds a forecast URL without leaking coordinate query params', () => {
    const url = forecastUrl('http://127.0.0.1:3001/', '42', '8719582a8ffffff', '2026-11-16');
    expect(url).toBe(
      'http://127.0.0.1:3001/v1/forecast?taxonId=42&cell=8719582a8ffffff&start=2026-11-16',
    );
    expect(url).not.toMatch(/lat|lng|latitude|longitude|coordinates/i);
  });

  it('computes p95 for the warm gate budget', () => {
    const samples = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(samples, 95)).toBe(95);
    expect(P95_BUDGET_MS).toBe(400);
  });
});

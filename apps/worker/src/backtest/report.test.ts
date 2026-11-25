import { describe, expect, it } from 'vitest';

import { formatBacktestReport } from './report.js';

import type { SpeciesBacktestResult } from './evaluate.js';

describe('formatBacktestReport', () => {
  it('includes a summary table and per-species rows', () => {
    const results: SpeciesBacktestResult[] = [
      {
        taxonId: 1,
        scientificName: 'Alcedo atthis',
        commonName: 'Common kingfisher',
        tier: 'open',
        status: 'pass',
        topMeanRr: 0.04,
        bottomMeanRr: 0.01,
        ratio: 4,
        confidence: 'high',
        weeksEvaluated: 26,
        note: 'ratio 4.00 ≥ 2',
      },
      {
        taxonId: 2,
        scientificName: 'Tetrao urogallus',
        commonName: 'Capercaillie',
        tier: 'no_forecast',
        status: 'skipped',
        topMeanRr: null,
        bottomMeanRr: null,
        ratio: null,
        confidence: null,
        weeksEvaluated: 0,
        note: 'tier no_forecast',
      },
    ];

    const md = formatBacktestReport({
      regionSlug: 'scotland',
      window: { holdoutYear: 2023, trainFromYear: 2014, trainToYear: 2022 },
      scoringVersion: '1.0',
      generatedAt: new Date('2026-11-25T12:00:00.000Z'),
      results,
    });

    expect(md).toContain('# Backtest: scotland holdout 2023');
    expect(md).toContain('| Pass | 1 |');
    expect(md).toContain('Common kingfisher');
    expect(md).toContain('| pass |');
    expect(md).toContain('## Summary');
    expect(md).toContain('## Per species');
  });

  it('escapes backslashes before pipes in markdown table cells', () => {
    const md = formatBacktestReport({
      regionSlug: 'scotland',
      window: { holdoutYear: 2023, trainFromYear: 2014, trainToYear: 2022 },
      scoringVersion: '1.0',
      generatedAt: new Date('2026-11-25T12:00:00.000Z'),
      results: [
        {
          taxonId: 1,
          scientificName: 'Foo\\bar|baz',
          commonName: 'pipe|name',
          tier: 'open',
          status: 'insufficient',
          topMeanRr: null,
          bottomMeanRr: null,
          ratio: null,
          confidence: 'low',
          weeksEvaluated: 0,
          note: 'path\\with|pipe',
        },
      ],
    });
    expect(md).toContain('Foo\\\\bar\\|baz');
    expect(md).toContain('pipe\\|name');
    expect(md).toContain('path\\\\with\\|pipe');
  });
});

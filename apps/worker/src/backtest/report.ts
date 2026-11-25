/**
 * Markdown report for `backtest --region --holdout` (§4.7 / S6).
 */
import type { SpeciesBacktestResult } from './evaluate.js';
import type { BacktestYearWindow } from './years.js';

export type BacktestReportInput = {
  readonly regionSlug: string;
  readonly window: BacktestYearWindow;
  readonly scoringVersion: string;
  readonly generatedAt: Date;
  readonly results: readonly SpeciesBacktestResult[];
  readonly effortNote?: string;
};

function fmtRr(value: number | null): string {
  if (value === null) {
    return '—';
  }
  if (value === 0) {
    return '0';
  }
  if (value >= 0.01) {
    return value.toFixed(4);
  }
  return value.toExponential(2);
}

function fmtRatio(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return value.toFixed(2);
}

function escapeCell(value: string): string {
  // Escape backslashes first so a trailing `\` cannot defeat the `|` escape.
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

/**
 * Build `reports/backtest-<region>-<year>.md` body.
 */
export function formatBacktestReport(input: BacktestReportInput): string {
  const { regionSlug, window, scoringVersion, generatedAt, results } = input;
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const insufficient = results.filter((r) => r.status === 'insufficient').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const highPass = results.filter((r) => r.status === 'pass' && r.confidence === 'high').length;
  const highTotal = results.filter(
    (r) => r.confidence === 'high' && (r.status === 'pass' || r.status === 'fail'),
  ).length;

  const lines: string[] = [
    `# Backtest: ${regionSlug} holdout ${String(window.holdoutYear)}`,
    '',
    `- Region: \`${regionSlug}\``,
    `- Training years: ${String(window.trainFromYear)}–${String(window.trainToYear)} (Y−10 … Y−2)`,
    `- Holdout year: ${String(window.holdoutYear)} (Y−1)`,
    `- Scoring version: \`${scoringVersion}\``,
    `- Generated (UTC): ${generatedAt.toISOString()}`,
    `- Pass rule: top-quartile weeks (by training H) have ≥ 2× holdout reporting rate of bottom-quartile weeks (§4.7 / PRD §8)`,
  ];

  if (input.effortNote !== undefined && input.effortNote.length > 0) {
    lines.push(`- Effort note: ${input.effortNote}`);
  }

  lines.push(
    '',
    '## Summary',
    '',
    `| Metric | Count |`,
    `| --- | ---: |`,
    `| Species evaluated | ${String(results.length)} |`,
    `| Pass | ${String(passed)} |`,
    `| Fail | ${String(failed)} |`,
    `| Insufficient | ${String(insufficient)} |`,
    `| Skipped (\`no_forecast\`) | ${String(skipped)} |`,
    `| High-confidence pass / evaluated | ${String(highPass)} / ${String(highTotal)} |`,
    '',
    '## Per species',
    '',
    `| Species | Scientific | Tier | Result | Top RR | Bottom RR | Ratio | Confidence | Weeks | Notes |`,
    `| --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | --- |`,
  );

  for (const row of results) {
    lines.push(
      `| ${escapeCell(row.commonName)} | ${escapeCell(row.scientificName)} | ${row.tier} | ${row.status} | ${fmtRr(row.topMeanRr)} | ${fmtRr(row.bottomMeanRr)} | ${fmtRatio(row.ratio)} | ${row.confidence ?? '—'} | ${String(row.weeksEvaluated)} | ${escapeCell(row.note)} |`,
    );
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function defaultBacktestReportName(regionSlug: string, holdoutYear: number): string {
  return `backtest-${regionSlug}-${String(holdoutYear)}.md`;
}

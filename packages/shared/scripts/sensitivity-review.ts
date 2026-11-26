/**
 * T8.3 — write sensitivity review packs for conservation reviewers (PRD E6).
 *
 * Usage: `pnpm data:sensitivity-review`
 * Output: `reports/sensitivity-review-<region>.md` for scotland and sindh.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeSensitivityReviewReports } from '../src/sensitivity-review.js';
import { validateDataDir } from '../src/validate-data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const dataDir = process.argv[2] ?? path.join(repoRoot, 'data');
const reportsDir = process.argv[3] ?? path.join(repoRoot, 'reports');

try {
  const written = await writeSensitivityReviewReports({
    dataDir,
    reportsDir,
    loadData: validateDataDir,
  });
  for (const outPath of written) {
    console.log(`wrote ${path.relative(repoRoot, outPath)}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

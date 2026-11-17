import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveTaxaFile } from '../src/resolve-taxa.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const betaPath = path.join(repoRoot, 'data', 'beta-species.yaml');

async function main(): Promise<void> {
  const result = await resolveTaxaFile(betaPath, { write: true });
  // eslint-disable-next-line no-console -- CLI progress
  console.log(
    `Resolved ${String(result.exactCount)}/${String(result.file.species.length)} taxa as EXACT`,
  );
  if (result.reviewNeeded.length > 0) {
    // eslint-disable-next-line no-console -- human review list (T2.7 acceptance)
    console.log('Needs human review (non-EXACT match):');
    for (const row of result.reviewNeeded) {
      // eslint-disable-next-line no-console -- human review list
      console.log(`  - ${row.scientificName}: matchType=${row.matchType}`);
    }
    process.exitCode = 1;
    return;
  }
  // eslint-disable-next-line no-console -- CLI success
  console.log(`Wrote ${betaPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console -- CLI error path
  console.error(`data:resolve-taxa failed: ${message}`);
  process.exitCode = 1;
});

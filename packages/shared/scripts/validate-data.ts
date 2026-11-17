import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateDataDir } from '../src/validate-data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const dataDir = process.argv[2] ?? path.join(repoRoot, 'data');

try {
  const result = validateDataDir(dataDir);
  console.log(
    `OK: ${String(result.betaSpecies.species.length)} beta species, ${String(result.sensitiveSpecies.species.length)} sensitive-species rows`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

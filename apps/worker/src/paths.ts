import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Repo root (apps/worker/src → ../../..). */
export function repoRoot(): string {
  return resolve(here, '..', '..', '..');
}

export function defaultBetaSpeciesPath(): string {
  return resolve(repoRoot(), 'data', 'beta-species.yaml');
}

export function defaultDownloadDir(): string {
  return resolve(repoRoot(), 'data', 'downloads');
}

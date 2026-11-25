import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Railway migrate image (no corepack at runtime)', () => {
  it('entrypoint runs compiled migrate/seed via node', () => {
    const entrypoint = readFileSync(resolve(repoRoot, 'apps/migrate/docker-entrypoint.sh'), 'utf8');
    expect(entrypoint).toContain('node packages/db/dist/migrate.js');
    expect(entrypoint).toContain('node packages/db/dist/seed.js');
    // No pnpm invocations (comments mentioning pnpm are fine).
    expect(entrypoint).not.toMatch(/^\s*pnpm\b/m);
  });

  it('Dockerfile runner stage does not enable corepack', () => {
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/migrate/Dockerfile'), 'utf8');
    const runnerStage = dockerfile.split('AS runner')[1];
    expect(runnerStage).toBeDefined();
    // Strip comments so doc mentions of corepack/pnpm do not fail the check.
    const runnerCode = (runnerStage ?? '')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');
    expect(runnerCode).not.toMatch(/corepack/);
    // No pnpm CLI / install in the runner (pnpm-workspace.yaml copy is fine).
    expect(runnerCode).not.toMatch(/(?:^|[^\w-])pnpm(?:\s|$)/m);
    expect(runnerCode).toMatch(/USER ww/);
  });
});

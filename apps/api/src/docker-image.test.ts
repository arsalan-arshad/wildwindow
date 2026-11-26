import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function stripComments(dockerfileStage: string): string {
  return dockerfileStage
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

describe('Railway api image includes @wildwindow/scoring', () => {
  it('Dockerfile deps stage copies scoring package.json', () => {
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/api/Dockerfile'), 'utf8');
    const depsStage = dockerfile.split('AS deps')[1]?.split('AS build')[0];
    expect(depsStage).toBeDefined();
    const depsCode = stripComments(depsStage ?? '');
    expect(depsCode).toMatch(/COPY packages\/scoring\/package\.json packages\/scoring\//);
  });

  it('Dockerfile build stage copies and builds scoring before api', () => {
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/api/Dockerfile'), 'utf8');
    const buildStage = dockerfile.split('AS build')[1]?.split('AS runner')[0];
    expect(buildStage).toBeDefined();
    const buildCode = stripComments(buildStage ?? '');
    expect(buildCode).toMatch(/COPY packages\/scoring packages\/scoring/);
    expect(buildCode).toMatch(/pnpm --filter @wildwindow\/scoring build/);
    const scoringIdx = buildCode.indexOf('pnpm --filter @wildwindow/scoring build');
    const apiIdx = buildCode.indexOf('pnpm --filter api build');
    expect(scoringIdx).toBeGreaterThan(-1);
    expect(apiIdx).toBeGreaterThan(scoringIdx);
  });

  it('api package.json depends on @wildwindow/scoring', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'apps/api/package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies['@wildwindow/scoring']).toMatch(/^workspace:/);
  });

  it('Railway api.toml watches packages/scoring', () => {
    const toml = readFileSync(resolve(repoRoot, 'infra/railway/api.toml'), 'utf8');
    expect(toml).toMatch(/packages\/scoring\/\*\*/);
  });

  it('tsup keeps yaml external (bundling it crashes ESM with Dynamic require of process)', () => {
    const tsup = readFileSync(resolve(repoRoot, 'apps/api/tsup.config.ts'), 'utf8');
    expect(tsup).toMatch(/noExternal:\s*\[\s*\/\^@wildwindow\\\//);
    expect(tsup).toMatch(/external:\s*\[[^\]]*['"]yaml['"]/);
  });

  it('api package.json depends on yaml for the externalised runtime import', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'apps/api/package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
    };
    expect(pkg.dependencies.yaml).toMatch(/\^?2\./);
  });
});

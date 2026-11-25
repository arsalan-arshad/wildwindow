import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function writeFakeDbPackage(root: string): void {
  mkdirSync(join(root, 'packages/db/dist'), { recursive: true });
  writeFileSync(
    join(root, 'packages/db/package.json'),
    JSON.stringify({
      name: '@wildwindow/db',
      type: 'module',
      exports: { '.': { import: './dist/index.js' } },
    }),
  );
  writeFileSync(join(root, 'packages/db/dist/index.js'), 'export const ok = 1;\n');
}

/** Run an ESM import of @wildwindow/db as if from apps/worker/dist/cli.js. */
function tryImportDbFromWorkerDist(root: string): {
  status: number | null;
  stderr: string;
  stdout: string;
} {
  writeFileSync(
    join(root, 'apps/worker/dist/cli.js'),
    "import '@wildwindow/db';\nconsole.log('resolved');\n",
  );
  const result = spawnSync(process.execPath, ['dist/cli.js'], {
    cwd: join(root, 'apps/worker'),
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
  });
  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

describe('Railway worker image (workspace package resolution)', () => {
  it('Dockerfile copies apps/worker/node_modules so @wildwindow/* resolve', () => {
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/worker/Dockerfile'), 'utf8');
    const runnerStage = dockerfile.split('AS runner')[1];
    expect(runnerStage).toBeDefined();
    const runnerCode = (runnerStage ?? '')
      .split('\n')
      .filter((line) => !/^\s*#/.test(line))
      .join('\n');

    // Root hoist alone is not enough with node-linker=hoisted — workspace
    // packages are linked under the app's own node_modules.
    expect(runnerCode).toMatch(
      /COPY --from=build\s+\/app\/apps\/worker\/node_modules\s+\.\/apps\/worker\/node_modules/,
    );
    expect(runnerCode).toMatch(
      /COPY --from=build\s+\/app\/packages\/db\/package\.json\s+\.\/packages\/db\/package\.json/,
    );
    expect(runnerCode).toMatch(/USER ww/);
    expect(runnerCode).toMatch(/CMD\s*\[\s*"hello"\s*\]/);
  });

  it('simulated runner layout resolves @wildwindow/db from apps/worker/dist', () => {
    const root = mkdtempSync(join(tmpdir(), 'ww-worker-runner-'));
    try {
      mkdirSync(join(root, 'apps/worker/dist'), { recursive: true });
      mkdirSync(join(root, 'apps/worker/node_modules/@wildwindow'), { recursive: true });
      writeFakeDbPackage(root);
      // Same relative link pnpm creates under apps/worker/node_modules/@wildwindow.
      symlinkSync('../../../../packages/db', join(root, 'apps/worker/node_modules/@wildwindow/db'));

      const result = tryImportDbFromWorkerDist(root);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('resolved');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('without apps/worker/node_modules, @wildwindow/db does not resolve (regression)', () => {
    const root = mkdtempSync(join(tmpdir(), 'ww-worker-broken-'));
    try {
      mkdirSync(join(root, 'apps/worker/dist'), { recursive: true });
      mkdirSync(join(root, 'node_modules'), { recursive: true });
      writeFakeDbPackage(root);

      const result = tryImportDbFromWorkerDist(root);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/Cannot find package '@wildwindow\/db'/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

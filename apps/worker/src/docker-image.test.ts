import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function stripComments(dockerfileStage: string): string {
  return dockerfileStage
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

describe('Railway worker image (bundled CLI, no nested workspace resolve)', () => {
  it('tsup inlines @wildwindow/* so packages/db nesting cannot break the runner', () => {
    const tsup = readFileSync(resolve(repoRoot, 'apps/worker/tsup.config.ts'), 'utf8');
    expect(tsup).toMatch(/noExternal:\s*\[\s*\/\^@wildwindow\\\//);
    expect(tsup).toMatch(/splitting:\s*false/);
  });

  it('Dockerfile runner ships only bundled dist + root node_modules (not packages/*)', () => {
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/worker/Dockerfile'), 'utf8');
    const runnerStage = dockerfile.split('AS runner')[1];
    expect(runnerStage).toBeDefined();
    const runnerCode = stripComments(runnerStage ?? '');

    expect(runnerCode).toMatch(
      /COPY --from=build\s+\/app\/apps\/worker\/dist\s+\.\/apps\/worker\/dist/,
    );
    expect(runnerCode).toMatch(/COPY --from=build\s+\/app\/node_modules\s+\.\/node_modules/);
    // Must not revive the #27 layout that still failed on packages/db → geoprivacy.
    expect(runnerCode).not.toMatch(/apps\/worker\/node_modules/);
    expect(runnerCode).not.toMatch(/packages\/db\/dist/);
    expect(runnerCode).not.toMatch(/packages\/geoprivacy/);
    expect(runnerCode).not.toMatch(/packages\/shared\/dist/);
    expect(runnerCode).toMatch(/USER ww/);
    expect(runnerCode).toMatch(/CMD\s*\[\s*"hello"\s*\]/);
  });

  it('nested packages/db → @wildwindow/geoprivacy fails without packages/db/node_modules', () => {
    // Reproduces the post-#27 Railway crash: apps/worker can resolve @wildwindow/db,
    // but packages/db/dist still imports @wildwindow/geoprivacy via its own package root.
    const root = mkdtempSync(join(tmpdir(), 'ww-worker-nested-'));
    try {
      mkdirSync(join(root, 'apps/worker/dist'), { recursive: true });
      mkdirSync(join(root, 'apps/worker/node_modules/@wildwindow'), { recursive: true });
      mkdirSync(join(root, 'packages/db/dist'), { recursive: true });
      mkdirSync(join(root, 'packages/geoprivacy/dist'), { recursive: true });

      writeFileSync(
        join(root, 'packages/db/package.json'),
        JSON.stringify({
          name: '@wildwindow/db',
          type: 'module',
          exports: { '.': { import: './dist/index.js' } },
          dependencies: { '@wildwindow/geoprivacy': 'workspace:*' },
        }),
      );
      writeFileSync(
        join(root, 'packages/db/dist/index.js'),
        "import '@wildwindow/geoprivacy';\nexport const ok = 1;\n",
      );
      writeFileSync(
        join(root, 'packages/geoprivacy/package.json'),
        JSON.stringify({
          name: '@wildwindow/geoprivacy',
          type: 'module',
          exports: { '.': { import: './dist/index.js' } },
        }),
      );
      writeFileSync(join(root, 'packages/geoprivacy/dist/index.js'), 'export const cell = 1;\n');

      // Worker resolves @wildwindow/db (the #27 fix) but db cannot see geoprivacy.
      symlinkSync('../../../../packages/db', join(root, 'apps/worker/node_modules/@wildwindow/db'));

      writeFileSync(
        join(root, 'apps/worker/dist/cli.js'),
        "import '@wildwindow/db';\nconsole.log('should-not-reach');\n",
      );

      const result = spawnSync(process.execPath, ['dist/cli.js'], {
        cwd: join(root, 'apps/worker'),
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'test' },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/Cannot find package '@wildwindow\/geoprivacy'/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('bundled cli.js runs without any @wildwindow package on disk', () => {
    const root = mkdtempSync(join(tmpdir(), 'ww-worker-bundled-'));
    try {
      mkdirSync(join(root, 'apps/worker/dist'), { recursive: true });
      // Mimic tsup output: workspace code inlined; only a plain npm dep left external.
      writeFileSync(
        join(root, 'apps/worker/dist/cli.js'),
        [
          "import { Command } from 'commander';",
          'const program = new Command();',
          "program.name('worker').command('hello').action(() => console.log('ok'));",
          'await program.parseAsync(process.argv);',
          '',
        ].join('\n'),
      );
      writeFileSync(
        join(root, 'apps/worker/package.json'),
        JSON.stringify({ name: 'worker', type: 'module' }),
      );

      // Root-hoisted third-party dep only — no packages/*, no apps/worker/node_modules.
      mkdirSync(join(root, 'node_modules/commander'), { recursive: true });
      writeFileSync(
        join(root, 'node_modules/commander/package.json'),
        JSON.stringify({ name: 'commander', type: 'module', main: './index.js' }),
      );
      writeFileSync(
        join(root, 'node_modules/commander/index.js'),
        [
          'export class Command {',
          '  name() { return this; }',
          '  command() { return this; }',
          '  action(fn) { this._fn = fn; return this; }',
          '  async parseAsync(argv) { if (argv.includes("hello")) this._fn(); }',
          '}',
          '',
        ].join('\n'),
      );

      const result = spawnSync(process.execPath, ['dist/cli.js', 'hello'], {
        cwd: join(root, 'apps/worker'),
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'test' },
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('ok');
      expect(result.stderr).not.toMatch(/Cannot find package '@wildwindow/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

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
  it('tsup inlines @wildwindow/* and keeps commander external', () => {
    const tsup = readFileSync(resolve(repoRoot, 'apps/worker/tsup.config.ts'), 'utf8');
    expect(tsup).toMatch(/noExternal:\s*\[\s*\/\^@wildwindow\\\//);
    expect(tsup).toMatch(/external:\s*\[[^\]]*['"]commander['"]/);
    expect(tsup).toMatch(/splitting:\s*false/);
    // Must not force-bundle commander (breaks Node builtins in ESM).
    expect(tsup).not.toMatch(/noExternal:\s*\[[^\]]*['"]commander['"]/);
  });

  it('worker package.json pins commander ≥9 (requiredOption API)', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(repoRoot, 'apps/worker/package.json'), 'utf8'),
    ) as { dependencies: { commander: string } };
    const range = pkg.dependencies.commander;
    expect(range).toMatch(/\^?13\.|>=\s*9|>=9/);
  });

  it('Railway worker.toml uses NEVER restart for hello smoke (exits 0)', () => {
    const toml = readFileSync(resolve(repoRoot, 'infra/railway/worker.toml'), 'utf8');
    expect(toml).toMatch(/restartPolicyType\s*=\s*"NEVER"/);
    expect(toml).toMatch(/hello/);
  });

  it('Dockerfile runner ships bundled dist + root node_modules + worker commander', () => {
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/worker/Dockerfile'), 'utf8');
    const runnerStage = dockerfile.split('AS runner')[1];
    expect(runnerStage).toBeDefined();
    const runnerCode = stripComments(runnerStage ?? '');

    expect(runnerCode).toMatch(
      /COPY --from=build\s+\/app\/apps\/worker\/dist\s+\.\/apps\/worker\/dist/,
    );
    expect(runnerCode).toMatch(/COPY --from=build\s+\/app\/node_modules\s+\.\/node_modules/);
    // Ship worker-local commander@≥9 so root-hoisted commander@2 is not resolved.
    expect(runnerCode).toMatch(
      /COPY --from=build\s+\/app\/apps\/worker\/node_modules\/commander\s+\.\/apps\/worker\/node_modules\/commander/,
    );
    // Must not revive the #27 layout that still failed on packages/db → geoprivacy.
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

  it('external commander@2 (root hoist) makes requiredOption crash — the #28 Railway bug', () => {
    const root = mkdtempSync(join(tmpdir(), 'ww-worker-cmd2-'));
    try {
      mkdirSync(join(root, 'apps/worker/dist'), { recursive: true });
      writeFileSync(
        join(root, 'apps/worker/dist/cli.js'),
        [
          "import { Command } from 'commander';",
          'const program = new Command();',
          "program.command('gbif:request').description('x').requiredOption('--region <slug>', 'r');",
          '',
        ].join('\n'),
      );
      writeFileSync(
        join(root, 'apps/worker/package.json'),
        JSON.stringify({ name: 'worker', type: 'module' }),
      );

      // Mimic Docker runner: only root node_modules, with terser-era commander@2.
      mkdirSync(join(root, 'node_modules/commander'), { recursive: true });
      writeFileSync(
        join(root, 'node_modules/commander/package.json'),
        JSON.stringify({
          name: 'commander',
          version: '2.20.3',
          type: 'module',
          main: './index.js',
        }),
      );
      writeFileSync(
        join(root, 'node_modules/commander/index.js'),
        [
          'export class Command {',
          '  command() { return this; }',
          '  description() { return this; }',
          '  // deliberately no requiredOption — commander@2',
          '}',
          '',
        ].join('\n'),
      );

      const result = spawnSync(process.execPath, ['dist/cli.js'], {
        cwd: join(root, 'apps/worker'),
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'test' },
      });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toMatch(/requiredOption is not a function/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('worker-local commander@≥9 wins over root commander@2 (Dockerfile layout)', () => {
    const root = mkdtempSync(join(tmpdir(), 'ww-worker-cmd13-'));
    try {
      mkdirSync(join(root, 'apps/worker/dist'), { recursive: true });
      mkdirSync(join(root, 'apps/worker/node_modules/commander'), { recursive: true });
      writeFileSync(
        join(root, 'apps/worker/dist/cli.js'),
        [
          "import { Command } from 'commander';",
          'const program = new Command();',
          "program.name('worker').command('hello').action(() => console.log('ok'));",
          "program.command('gbif:request').description('x').requiredOption('--region <slug>', 'r');",
          'await program.parseAsync(process.argv);',
          '',
        ].join('\n'),
      );
      writeFileSync(
        join(root, 'apps/worker/package.json'),
        JSON.stringify({ name: 'worker', type: 'module' }),
      );

      // Poison root hoist (what Docker would copy from monorepo root).
      mkdirSync(join(root, 'node_modules/commander'), { recursive: true });
      writeFileSync(
        join(root, 'node_modules/commander/package.json'),
        JSON.stringify({
          name: 'commander',
          version: '2.20.3',
          type: 'module',
          main: './index.js',
        }),
      );
      writeFileSync(
        join(root, 'node_modules/commander/index.js'),
        'throw new Error("root commander@2 must not load when worker-local exists");\n',
      );

      // Ship worker-local commander with requiredOption (Dockerfile COPY target).
      writeFileSync(
        join(root, 'apps/worker/node_modules/commander/package.json'),
        JSON.stringify({
          name: 'commander',
          version: '13.1.0',
          type: 'module',
          main: './index.js',
        }),
      );
      writeFileSync(
        join(root, 'apps/worker/node_modules/commander/index.js'),
        [
          'export class Command {',
          '  name() { return this; }',
          '  command() { return this; }',
          '  description() { return this; }',
          '  requiredOption() { return this; }',
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
      expect(result.stderr).not.toMatch(/requiredOption is not a function/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

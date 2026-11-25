import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Minimal CommonJS file that uses require (like Next standalone server.js). */
const cjsServerSource = "const path = require('node:path');\nconsole.log(path.basename('.'));\n";

function stripComments(stage: string): string {
  return stage
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join('\n');
}

describe('Railway web image (standalone server.js is CommonJS)', () => {
  it('runner pins a non-ESM package.json next to server.js', () => {
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/web/Dockerfile'), 'utf8');
    const runnerStage = dockerfile.split('AS runner')[1];
    expect(runnerStage).toBeDefined();
    const runnerCode = stripComments(runnerStage ?? '');

    // Must write a local package.json so root type:module does not apply.
    expect(runnerCode).toMatch(/apps\/web\/package\.json/);
    expect(runnerCode).toMatch(/"type"\s*:\s*"commonjs"/);
    expect(runnerCode).toMatch(/USER ww/);
    expect(runnerCode).toMatch(/CMD\s*\[\s*"node",\s*"server\.js"\s*\]/);
  });

  it('runner forces HOSTNAME=0.0.0.0 so Next listens for Railway healthchecks', () => {
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/web/Dockerfile'), 'utf8');
    const runnerStage = dockerfile.split('AS runner')[1];
    expect(runnerStage).toBeDefined();
    const runnerCode = stripComments(runnerStage ?? '');
    expect(runnerCode).toMatch(/ENV\s+HOSTNAME=0\.0\.0\.0/);
  });

  it('build stage wires NEXT_PUBLIC_* as ARG/ENV for next build inlining', () => {
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/web/Dockerfile'), 'utf8');
    const buildStage = dockerfile.split('AS build')[1]?.split('AS runner')[0];
    expect(buildStage).toBeDefined();
    const buildCode = stripComments(buildStage ?? '');
    expect(buildCode).toMatch(/ARG\s+NEXT_PUBLIC_API_URL/);
    expect(buildCode).toMatch(/ENV\s+NEXT_PUBLIC_API_URL=/);
    expect(buildCode).toMatch(/ARG\s+NEXT_PUBLIC_FIREBASE_CONFIG/);
    expect(buildCode).toMatch(/ENV\s+NEXT_PUBLIC_FIREBASE_CONFIG=/);
  });

  it('root package.json still declares type module (the bug we guard against)', () => {
    const rootPkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
      type?: string;
    };
    expect(rootPkg.type).toBe('module');
  });

  it('local commonjs package.json stops root type:module from breaking require', () => {
    const root = mkdtempSync(join(tmpdir(), 'ww-web-runner-'));
    try {
      mkdirSync(join(root, 'apps/web'), { recursive: true });
      writeFileSync(join(root, 'package.json'), JSON.stringify({ type: 'module' }));
      writeFileSync(join(root, 'apps/web/server.js'), cjsServerSource);

      const broken = spawnSync(process.execPath, ['server.js'], {
        cwd: join(root, 'apps/web'),
        encoding: 'utf8',
      });
      expect(broken.status).not.toBe(0);
      expect(broken.stderr).toMatch(/require is not defined/);

      writeFileSync(join(root, 'apps/web/package.json'), JSON.stringify({ type: 'commonjs' }));
      const fixed = spawnSync(process.execPath, ['server.js'], {
        cwd: join(root, 'apps/web'),
        encoding: 'utf8',
      });
      expect(fixed.status).toBe(0);
      expect(fixed.stderr).not.toMatch(/require is not defined/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

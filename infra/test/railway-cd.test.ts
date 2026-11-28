import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RAILWAY_CD_SERVICES, RAILWAY_HEALTHCHECK, RAILWAY_SMOKE_URLS } from '../lib/railway-cd.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

function readRepo(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), 'utf8');
}

describe('Railway CD config (T9.4)', () => {
  it('lists the GitHub-linked services that autodeploy from main', () => {
    expect(RAILWAY_CD_SERVICES).toEqual([
      'api',
      'web',
      'worker',
      'migrate',
      'worker-purge',
      'worker-ingest',
    ]);
  });

  it('api.toml healthcheck matches RAILWAY_HEALTHCHECK.api', () => {
    const toml = readRepo('infra/railway/api.toml');
    expect(toml).toMatch(new RegExp(`healthcheckPath\\s*=\\s*"${RAILWAY_HEALTHCHECK.api}"`));
    expect(toml).toMatch(/restartPolicyType\s*=\s*"ON_FAILURE"/);
  });

  it('web.toml healthcheck matches RAILWAY_HEALTHCHECK.web', () => {
    const toml = readRepo('infra/railway/web.toml');
    expect(toml).toMatch(new RegExp(`healthcheckPath\\s*=\\s*"${RAILWAY_HEALTHCHECK.web}"`));
    expect(toml).toMatch(/restartPolicyType\s*=\s*"ON_FAILURE"/);
  });

  it('migrate.toml is a one-off that watches packages/db for schema CD', () => {
    const toml = readRepo('infra/railway/migrate.toml');
    expect(toml).toMatch(/restartPolicyType\s*=\s*"NEVER"/);
    expect(toml).toMatch(/packages\/db\/\*\*/);
    expect(toml).toMatch(/dockerfilePath\s*=\s*"apps\/migrate\/Dockerfile"/);
  });

  it('railway-cd.yml probes the documented public smoke URLs', () => {
    const workflow = readRepo('.github/workflows/railway-cd.yml');
    expect(workflow).toMatch(/workflow_dispatch/);
    expect(workflow).toContain(RAILWAY_SMOKE_URLS.apiHealth);
    expect(workflow).toContain(RAILWAY_SMOKE_URLS.webHome);
    // Must not run on push to main — Wait for CI would deadlock with a
    // smoke that waits for Railway while Railway waits for this workflow.
    expect(workflow).not.toMatch(/push:\s*\n\s*branches:\s*\n\s*-\s*main/);
  });

  it('RAILWAY.md documents Wait for CI and migrate-on-deploy', () => {
    const doc = readRepo('docs/RAILWAY.md');
    expect(doc).toMatch(/Continuous deployment \(T9\.4\)/);
    expect(doc).toMatch(/Wait for CI/);
    expect(doc).toMatch(/migrate-on-deploy|migrate.*autodeploy|Autodeploy.*migrate/i);
    expect(doc).toContain(RAILWAY_SMOKE_URLS.apiHealth);
    expect(doc).toContain(RAILWAY_SMOKE_URLS.webHome);
  });
});

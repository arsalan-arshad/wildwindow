import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { RAILWAY_WORKER_CRON } from './cron.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

function readToml(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('RAILWAY_WORKER_CRON (T9.3)', () => {
  it('documents daily purge and monthly ingest UTC schedules', () => {
    expect(RAILWAY_WORKER_CRON.purgeDeleted).toBe('0 4 * * *');
    expect(RAILWAY_WORKER_CRON.ingestPipeline).toBe('0 5 1 * *');
  });

  it('matches infra/railway worker-purge.toml cronSchedule + startCommand', () => {
    const toml = readToml('infra/railway/worker-purge.toml');
    expect(toml).toContain(`cronSchedule = "${RAILWAY_WORKER_CRON.purgeDeleted}"`);
    expect(toml).toMatch(/startCommand\s*=\s*"node dist\/cli\.js purge-deleted"/);
    expect(toml).toMatch(/restartPolicyType\s*=\s*"NEVER"/);
  });

  it('matches infra/railway worker-ingest.toml cronSchedule + startCommand', () => {
    const toml = readToml('infra/railway/worker-ingest.toml');
    expect(toml).toContain(`cronSchedule = "${RAILWAY_WORKER_CRON.ingestPipeline}"`);
    expect(toml).toMatch(/startCommand\s*=\s*"node dist\/cli\.js ingest:pipeline --region all"/);
    expect(toml).toMatch(/restartPolicyType\s*=\s*"NEVER"/);
  });
});

/**
 * T9.8 CLI — autocannon `/v1/forecast` performance check.
 *
 * Full (local, after migrate/seed/ingest/aggregate):
 *   PERF_TAXON_ID=… PERF_CELL=… PERF_START=YYYY-MM-DD pnpm perf:forecast
 *
 * Smoke (CI / no data — exits 0 when API or params are missing):
 *   pnpm perf:forecast:smoke
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ForecastPerfEnvSchema,
  runForecastPerf,
  type ForecastPerfMode,
} from '../src/perf/run-forecast-perf.js';

function parseMode(argv: readonly string[]): ForecastPerfMode {
  if (argv.includes('--smoke')) {
    return 'smoke';
  }
  if (argv.includes('--full')) {
    return 'full';
  }
  return process.env['PERF_MODE'] === 'smoke' ? 'smoke' : 'full';
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const env = ForecastPerfEnvSchema.parse({
    PERF_BASE_URL: process.env['PERF_BASE_URL'],
    PERF_TAXON_ID: process.env['PERF_TAXON_ID'],
    PERF_CELL: process.env['PERF_CELL'],
    PERF_START: process.env['PERF_START'],
    PERF_REPORT_DIR: process.env['PERF_REPORT_DIR'],
  });

  // Default report dir: repo root `reports/` when launched via pnpm from root.
  const here = fileURLToPath(new URL('.', import.meta.url));
  const defaultReportDir = resolve(here, '../../../reports');

  const outcome = await runForecastPerf({
    mode,
    baseUrl: env.PERF_BASE_URL,
    taxonId: env.PERF_TAXON_ID ?? '',
    cell: env.PERF_CELL ?? '',
    start: env.PERF_START ?? '',
    ...(env.PERF_REPORT_DIR !== undefined
      ? { reportDir: env.PERF_REPORT_DIR }
      : { reportDir: defaultReportDir }),
  });

  if (outcome.status === 'skipped') {
    // eslint-disable-next-line no-console -- CLI progress
    console.log(`[perf:forecast] skipped (${outcome.mode}): ${outcome.reason}`);
    return;
  }

  // eslint-disable-next-line no-console -- CLI progress
  console.log(
    `[perf:forecast] ${outcome.mode} ok url=${outcome.url}` +
      (outcome.sequentialP95Ms !== null
        ? ` sequentialP95Ms=${outcome.sequentialP95Ms.toFixed(1)}`
        : '') +
      ` autocannonP97_5Ms=${outcome.autocannon.p97_5Ms.toFixed(1)}` +
      ` rps=${outcome.autocannon.requestsPerSec.toFixed(1)}` +
      (outcome.reportPath !== null ? ` report=${outcome.reportPath}` : ''),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // eslint-disable-next-line no-console -- CLI error path
  console.error(`[perf:forecast] failed: ${message}`);
  process.exitCode = 1;
});

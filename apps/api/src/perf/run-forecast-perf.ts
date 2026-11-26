import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import autocannon from 'autocannon';
import { z } from 'zod';

/** Subset of autocannon's Result we read (CJS `export =` has no ESM named types). */
type AutocannonResult = {
  readonly latency: {
    readonly mean: number;
    readonly p90: number;
    readonly p97_5: number;
    readonly p99: number;
  };
  readonly requests: {
    readonly average: number;
  };
  readonly non2xx: number;
  readonly errors: number;
};

const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start must be YYYY-MM-DD');

export const ForecastPerfEnvSchema = z.object({
  PERF_BASE_URL: z.string().url().default('http://127.0.0.1:3001'),
  PERF_TAXON_ID: z.string().regex(/^\d+$/).optional(),
  PERF_CELL: z.string().min(1).optional(),
  PERF_START: IsoDateSchema.optional(),
  /** Directory for reports/perf-YYYY-MM-DD.md (repo root in normal use). */
  PERF_REPORT_DIR: z.string().optional(),
});

export type ForecastPerfMode = 'full' | 'smoke';

export type ForecastPerfOptions = {
  readonly mode: ForecastPerfMode;
  readonly baseUrl: string;
  readonly taxonId: string;
  readonly cell: string;
  readonly start: string;
  /** Warm sequential samples before the gate (full mode). */
  readonly warmSequential?: number;
  /** Measured sequential samples for p95 (full mode). */
  readonly sequentialSamples?: number;
  readonly connections?: number;
  readonly durationSec?: number;
  readonly warmupSec?: number;
  readonly reportDir?: string;
  /** Injected clock for report dates (tests). */
  readonly now?: () => Date;
  /** Skip writing the markdown report (tests / smoke). */
  readonly writeReport?: boolean;
  readonly fetchImpl?: typeof fetch;
};

export type ForecastPerfOutcome =
  | {
      readonly status: 'ok';
      readonly mode: ForecastPerfMode;
      readonly url: string;
      readonly sequentialP95Ms: number | null;
      readonly autocannon: {
        readonly p90Ms: number;
        readonly p97_5Ms: number;
        readonly p99Ms: number;
        readonly meanMs: number;
        readonly requestsPerSec: number;
        readonly non2xx: number;
        readonly errors: number;
      };
      readonly reportPath: string | null;
      readonly gatePassed: boolean;
    }
  | {
      readonly status: 'skipped';
      readonly mode: ForecastPerfMode;
      readonly reason: string;
    };

const DEFAULT_SMOKE = {
  connections: 2,
  durationSec: 2,
  warmupSec: 0,
  warmSequential: 2,
  sequentialSamples: 0,
} as const;

const DEFAULT_FULL = {
  connections: 10,
  durationSec: 15,
  warmupSec: 3,
  warmSequential: 20,
  sequentialSamples: 100,
} as const;

const P95_BUDGET_MS = 400;

function percentile(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) {
    throw new Error('empty sample');
  }
  const idx = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  const value = sortedAsc[idx];
  if (value === undefined) {
    throw new Error('percentile index out of range');
  }
  return value;
}

function forecastUrl(baseUrl: string, taxonId: string, cell: string, start: string): string {
  const root = baseUrl.replace(/\/$/, '');
  const qs = new URLSearchParams({ taxonId, cell, start });
  return `${root}/v1/forecast?${qs.toString()}`;
}

async function probeReachable(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ ok: true; status: number } | { ok: false; reason: string }> {
  try {
    const response = await fetchImpl(url, { method: 'GET' });
    return { ok: true, status: response.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `API unreachable: ${message}` };
  }
}

async function measureSequentialP95(
  url: string,
  warm: number,
  samples: number,
  fetchImpl: typeof fetch,
): Promise<number> {
  for (let i = 0; i < warm; i += 1) {
    const response = await fetchImpl(url);
    if (!response.ok) {
      throw new Error(`warm request failed: HTTP ${String(response.status)}`);
    }
  }
  const times: number[] = [];
  for (let i = 0; i < samples; i += 1) {
    const t0 = performance.now();
    const response = await fetchImpl(url);
    const elapsed = performance.now() - t0;
    if (!response.ok) {
      throw new Error(`sample request failed: HTTP ${String(response.status)}`);
    }
    times.push(elapsed);
  }
  times.sort((a, b) => a - b);
  return percentile(times, 95);
}

function runAutocannon(options: {
  readonly url: string;
  readonly connections: number;
  readonly durationSec: number;
  readonly warmupSec: number;
}): Promise<AutocannonResult> {
  return new Promise((resolvePromise, reject) => {
    const instance = autocannon(
      {
        url: options.url,
        connections: options.connections,
        duration: options.durationSec,
        ...(options.warmupSec > 0
          ? { warmup: { duration: options.warmupSec, connections: options.connections } }
          : {}),
      },
      (err, result) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        resolvePromise(result);
      },
    );
    // Suppress default interactive output when not a TTY / in CI.
    if (!process.stdout.isTTY) {
      instance.on('reqError', () => undefined);
    }
  });
}

function formatReport(args: {
  readonly dateYmd: string;
  readonly url: string;
  readonly sequentialP95Ms: number;
  readonly result: AutocannonResult;
  readonly gatePassed: boolean;
  readonly indexes: readonly string[];
}): string {
  const { dateYmd, url, sequentialP95Ms, result, gatePassed, indexes } = args;
  const lines = [
    `# Forecast performance — ${dateYmd}`,
    '',
    'WildWindow **T9.8** warm `/v1/forecast` check (ARCHITECTURE §5.5 / PRD performance).',
    '',
    '## Target',
    '',
    `- Warm sequential **p95 < ${String(P95_BUDGET_MS)} ms** on full ingested data.`,
    '- Concurrent load via `autocannon` (report p90 / p97.5 / p99; autocannon has no p95 bucket).',
    '',
    '## Run',
    '',
    '```bash',
    'pnpm db:up && pnpm db:migrate && pnpm db:seed',
    '# After GBIF ingest + aggregate + score:refs for beta regions:',
    'pnpm --filter api start   # or pnpm --filter api dev',
    'PERF_TAXON_ID=<id> PERF_CELL=<res7> PERF_START=YYYY-MM-DD pnpm perf:forecast',
    '```',
    '',
    'Smoke (CI / no full data — never fails the p95 gate):',
    '',
    '```bash',
    'pnpm perf:forecast:smoke',
    '```',
    '',
    '## Indexes (T9.8)',
    '',
    ...indexes.map((name) => `- \`${name}\``),
    '',
    '## Results',
    '',
    `| Metric | Value |`,
    `| ------ | ----- |`,
    `| URL | \`${url}\` |`,
    `| Sequential warm p95 (ms) | ${sequentialP95Ms.toFixed(1)} |`,
    `| Autocannon mean latency (ms) | ${result.latency.mean.toFixed(1)} |`,
    `| Autocannon p90 (ms) | ${result.latency.p90.toFixed(1)} |`,
    `| Autocannon p97.5 (ms) | ${result.latency.p97_5.toFixed(1)} |`,
    `| Autocannon p99 (ms) | ${result.latency.p99.toFixed(1)} |`,
    `| Requests / s | ${result.requests.average.toFixed(1)} |`,
    `| Non-2xx | ${String(result.non2xx)} |`,
    `| Errors | ${String(result.errors)} |`,
    `| Gate (p95 < ${String(P95_BUDGET_MS)} ms) | ${gatePassed ? 'PASS' : 'FAIL'} |`,
    '',
  ];
  return `${lines.join('\n')}\n`;
}

/**
 * Run the T9.8 forecast performance check.
 *
 * - `smoke`: light autocannon burst; if the API is down or query params are
 *   missing, returns `{ status: 'skipped' }` (exit 0) so CI without full
 *   ingested data stays green.
 * - `full`: requires taxon/cell/start; measures sequential warm p95; fails the
 *   gate when p95 ≥ 400 ms; writes `reports/perf-YYYY-MM-DD.md`.
 */
export async function runForecastPerf(options: ForecastPerfOptions): Promise<ForecastPerfOutcome> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const defaults = options.mode === 'smoke' ? DEFAULT_SMOKE : DEFAULT_FULL;
  const connections = options.connections ?? defaults.connections;
  const durationSec = options.durationSec ?? defaults.durationSec;
  const warmupSec = options.warmupSec ?? defaults.warmupSec;
  const warmSequential = options.warmSequential ?? defaults.warmSequential;
  const sequentialSamples = options.sequentialSamples ?? defaults.sequentialSamples;
  const writeReport = options.writeReport ?? options.mode === 'full';
  const now = options.now ?? (() => new Date());

  if (
    options.taxonId.trim().length === 0 ||
    options.cell.trim().length === 0 ||
    options.start.trim().length === 0
  ) {
    if (options.mode === 'smoke') {
      return {
        status: 'skipped',
        mode: 'smoke',
        reason:
          'PERF_TAXON_ID / PERF_CELL / PERF_START unset — smoke skips without full forecast params',
      };
    }
    throw new Error('PERF_TAXON_ID, PERF_CELL, and PERF_START are required for full mode');
  }

  const url = forecastUrl(options.baseUrl, options.taxonId, options.cell, options.start);
  const probe = await probeReachable(url, fetchImpl);
  if (!probe.ok) {
    if (options.mode === 'smoke') {
      return { status: 'skipped', mode: 'smoke', reason: probe.reason };
    }
    throw new Error(probe.reason);
  }

  if (probe.status >= 500) {
    if (options.mode === 'smoke') {
      return {
        status: 'skipped',
        mode: 'smoke',
        reason: `forecast returned HTTP ${String(probe.status)} (likely missing data)`,
      };
    }
    throw new Error(`forecast returned HTTP ${String(probe.status)}`);
  }

  let sequentialP95Ms: number | null = null;
  if (sequentialSamples > 0) {
    sequentialP95Ms = await measureSequentialP95(url, warmSequential, sequentialSamples, fetchImpl);
  } else if (warmSequential > 0) {
    for (let i = 0; i < warmSequential; i += 1) {
      const response = await fetchImpl(url);
      if (!response.ok && options.mode === 'full') {
        throw new Error(`warm request failed: HTTP ${String(response.status)}`);
      }
    }
  }

  const result = await runAutocannon({ url, connections, durationSec, warmupSec });

  const gatePassed =
    sequentialP95Ms === null ? true : sequentialP95Ms < P95_BUDGET_MS && result.non2xx === 0;

  const indexes = [
    'pub.taxon_cell_week_taxon_region_week_cell_idx',
    'pub.effort_cell_week_group_region_week_cell_idx',
  ] as const;

  let reportPath: string | null = null;
  if (writeReport && sequentialP95Ms !== null) {
    const dateYmd = now().toISOString().slice(0, 10);
    const dir = options.reportDir ?? resolve(process.cwd(), 'reports');
    reportPath = resolve(dir, `perf-${dateYmd}.md`);
    const body = formatReport({
      dateYmd,
      url,
      sequentialP95Ms,
      result,
      gatePassed,
      indexes,
    });
    await writeFile(reportPath, body, 'utf8');
  }

  if (options.mode === 'full' && !gatePassed) {
    throw new Error(
      `Forecast p95 gate failed: sequential p95=${String(sequentialP95Ms)} ms (budget ${String(P95_BUDGET_MS)}), non2xx=${String(result.non2xx)}`,
    );
  }

  return {
    status: 'ok',
    mode: options.mode,
    url,
    sequentialP95Ms,
    autocannon: {
      p90Ms: result.latency.p90,
      p97_5Ms: result.latency.p97_5,
      p99Ms: result.latency.p99,
      meanMs: result.latency.mean,
      requestsPerSec: result.requests.average,
      non2xx: result.non2xx,
      errors: result.errors,
    },
    reportPath,
    gatePassed,
  };
}

export { P95_BUDGET_MS, forecastUrl, percentile };

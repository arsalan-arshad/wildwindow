import { z } from 'zod';

import { runAggregate, type AggregateResult } from '../aggregate/run.js';
import { runGbifFetch, type GbifFetchResult } from '../gbif/fetch.js';
import { INGEST_STATUS } from '../gbif/ingest-status.js';
import { runGbifLoad, type GbifLoadResult } from '../gbif/load.js';
import { type IngestKind, type IngestRegion } from '../gbif/predicate.js';
import { runGbifRequest, type GbifRequestResult } from '../gbif/request.js';
import { defaultBetaSpeciesPath, defaultDownloadDir } from '../paths.js';
import { runScoreRefs, type ScoreRefsResult } from '../score-refs/run.js';

/** Both beta regions, scotland then sindh (ARCHITECTURE §3.2 schedule). */
export const INGEST_PIPELINE_REGIONS = [
  'scotland',
  'sindh',
] as const satisfies readonly IngestRegion[];

/** Target then effort so aggregate/score:refs see both after load. */
export const INGEST_PIPELINE_KINDS = ['target', 'effort'] as const satisfies readonly IngestKind[];

const pipelineEnvSchema = z.object({
  /**
   * Safety gate for scheduled / live GBIF downloads. Must be the string
   * `"true"` (case-sensitive). Unset/false refuses the pipeline so a cron
   * service cannot request downloads without an explicit opt-in.
   */
  GBIF_ENABLED: z.string().optional(),
});

export type IngestPipelineEnv = z.infer<typeof pipelineEnvSchema>;

export type KindStepResult = {
  readonly kind: IngestKind;
  readonly request: GbifRequestResult;
  readonly fetch: GbifFetchResult;
  readonly load: GbifLoadResult;
};

export type RegionPipelineResult = {
  readonly region: IngestRegion;
  readonly kinds: readonly KindStepResult[];
  readonly aggregate: AggregateResult;
  readonly scoreRefs: ScoreRefsResult;
};

export type IngestPipelineDryRunResult = {
  readonly dryRun: true;
  readonly regions: readonly IngestRegion[];
  readonly plannedSteps: readonly string[];
};

export type IngestPipelineLiveResult = {
  readonly dryRun: false;
  readonly regions: readonly RegionPipelineResult[];
  readonly plannedSteps: readonly string[];
};

export type IngestPipelineResult = IngestPipelineDryRunResult | IngestPipelineLiveResult;

export type IngestPipelineDeps = {
  readonly request: (opts: {
    region: IngestRegion;
    kind: IngestKind;
    betaSpeciesPath: string;
  }) => Promise<GbifRequestResult>;
  readonly fetch: (opts: { runId: number; downloadDir: string }) => Promise<GbifFetchResult>;
  readonly load: (opts: { runId: number; zipPath: string }) => Promise<GbifLoadResult>;
  readonly aggregate: (opts: { region: IngestRegion }) => Promise<AggregateResult>;
  readonly scoreRefs: (opts: { region: IngestRegion }) => Promise<ScoreRefsResult>;
};

export type IngestPipelineOptions = {
  readonly regions: readonly IngestRegion[];
  readonly kinds?: readonly IngestKind[];
  readonly betaSpeciesPath?: string;
  readonly downloadDir?: string;
  /** When true, print the plan and exit without calling GBIF or the DB. */
  readonly dryRun?: boolean;
  readonly env?: IngestPipelineEnv;
  readonly deps?: Partial<IngestPipelineDeps>;
};

function defaultDeps(): IngestPipelineDeps {
  return {
    request: (opts) => runGbifRequest(opts),
    fetch: (opts) => runGbifFetch(opts),
    load: (opts) => runGbifLoad(opts),
    aggregate: (opts) => runAggregate(opts),
    scoreRefs: (opts) => runScoreRefs(opts),
  };
}

export function assertGbifEnabled(env: IngestPipelineEnv): void {
  if (env.GBIF_ENABLED !== 'true') {
    throw new Error(
      'ingest:pipeline refused: set GBIF_ENABLED=true on the worker-ingest service to run live GBIF downloads (docs/RAILWAY.md)',
    );
  }
}

export function parsePipelineRegions(value: string): readonly IngestRegion[] {
  if (value === 'all') {
    return INGEST_PIPELINE_REGIONS;
  }
  if (value === 'scotland' || value === 'sindh') {
    return [value];
  }
  throw new Error(`--region must be scotland|sindh|all (got ${value})`);
}

function planSteps(regions: readonly IngestRegion[], kinds: readonly IngestKind[]): string[] {
  const steps: string[] = [];
  for (const region of regions) {
    for (const kind of kinds) {
      steps.push(`gbif:request --region ${region} --kind ${kind}`);
      steps.push(`gbif:fetch --run <id>`);
      steps.push(`gbif:load --run <id> --file <zip>`);
    }
    steps.push(`aggregate --region ${region}`);
    steps.push(`score:refs --region ${region}`);
  }
  return steps;
}

/**
 * Monthly (or on-demand) GBIF refresh for one or both beta regions:
 * request → fetch → load for each kind, then aggregate + score:refs.
 * Idempotent at the aggregate/refs layer (rebuilds pub.* in a transaction).
 */
export async function runIngestPipeline(
  options: IngestPipelineOptions,
): Promise<IngestPipelineResult> {
  const kinds = options.kinds ?? INGEST_PIPELINE_KINDS;
  const dryRun = options.dryRun === true;
  const betaSpeciesPath = options.betaSpeciesPath ?? defaultBetaSpeciesPath();
  const downloadDir = options.downloadDir ?? defaultDownloadDir();
  const env = options.env ?? pipelineEnvSchema.parse(process.env);
  const deps: IngestPipelineDeps = { ...defaultDeps(), ...options.deps };

  if (!dryRun) {
    assertGbifEnabled(env);
  }

  const plannedSteps = planSteps(options.regions, kinds);
  if (dryRun) {
    return {
      dryRun: true,
      regions: options.regions,
      plannedSteps,
    };
  }

  const regionResults: RegionPipelineResult[] = [];

  for (const region of options.regions) {
    const kindResults: KindStepResult[] = [];
    for (const kind of kinds) {
      const request = await deps.request({ region, kind, betaSpeciesPath });
      const fetch = await deps.fetch({ runId: request.runId, downloadDir });
      if (fetch.status !== INGEST_STATUS.succeeded || fetch.zipPath === null) {
        throw new Error(
          `ingest:pipeline ${region}/${kind}: gbif:fetch did not succeed (status=${fetch.status})`,
        );
      }
      const load = await deps.load({ runId: request.runId, zipPath: fetch.zipPath });
      kindResults.push({ kind, request, fetch, load });
    }
    const aggregate = await deps.aggregate({ region });
    const scoreRefs = await deps.scoreRefs({ region });
    regionResults.push({ region, kinds: kindResults, aggregate, scoreRefs });
  }

  return {
    dryRun: false,
    regions: regionResults,
    plannedSteps,
  };
}

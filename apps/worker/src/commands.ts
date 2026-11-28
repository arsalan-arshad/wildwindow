import { Command } from 'commander';

import { runAggregate } from './aggregate/run.js';
import { runBacktest } from './backtest/run.js';
import { runGbifFetch } from './gbif/fetch.js';
import { runGbifLoad } from './gbif/load.js';
import { runGbifRequest } from './gbif/request.js';
import { runMakeAdmin } from './make-admin.js';
import { defaultBetaSpeciesPath, defaultDownloadDir } from './paths.js';
import { runPurgeDeleted } from './purge-deleted.js';
import { parsePipelineRegions, runIngestPipeline } from './schedule/ingest-pipeline.js';
import { runScoreRefs } from './score-refs/run.js';

import type { IngestKind, IngestRegion } from './gbif/predicate.js';

function parseRegion(value: string): IngestRegion {
  if (value === 'scotland' || value === 'sindh') {
    return value;
  }
  throw new Error(`--region must be scotland|sindh (got ${value})`);
}

function parseKind(value: string): IngestKind {
  if (value === 'target' || value === 'effort') {
    return value;
  }
  throw new Error(`--kind must be target|effort (got ${value})`);
}

export function createProgram(): Command {
  const program = new Command();
  program.name('worker').description('WildWindow worker CLI').version('0.0.0');

  program
    .command('hello')
    .description('Sanity-check command')
    .action(() => {
      console.log('ok');
    });

  program
    .command('gbif:request')
    .description('Request a GBIF occurrence download and create an ingest_runs row')
    .requiredOption('--region <slug>', 'scotland|sindh')
    .requiredOption('--kind <kind>', 'target|effort')
    .option('--beta <path>', 'path to beta-species.yaml', defaultBetaSpeciesPath())
    .action(async (opts: { region: string; kind: string; beta: string }) => {
      const result = await runGbifRequest({
        region: parseRegion(opts.region),
        kind: parseKind(opts.kind),
        betaSpeciesPath: opts.beta,
      });
      console.log(
        JSON.stringify({
          runId: result.runId,
          downloadKey: result.downloadKey,
          status: result.status,
          taxonKeyCount: result.taxonKeyCount,
        }),
      );
    });

  program
    .command('gbif:fetch')
    .description('Poll a GBIF download, save the zip, and store DOI/totals on the run')
    .requiredOption('--run <id>', 'ingest_runs id', (v) => Number.parseInt(v, 10))
    .option('--dir <path>', 'directory for zip downloads', defaultDownloadDir())
    .action(async (opts: { run: number; dir: string }) => {
      if (!Number.isInteger(opts.run) || opts.run <= 0) {
        throw new Error(`--run must be a positive integer (got ${String(opts.run)})`);
      }
      const result = await runGbifFetch({
        runId: opts.run,
        downloadDir: opts.dir,
      });
      console.log(
        JSON.stringify({
          runId: result.runId,
          status: result.status,
          downloadKey: result.downloadKey,
          doi: result.doi,
          total: result.total,
          zipPath: result.zipPath,
        }),
      );
    });

  program
    .command('gbif:load')
    .description('Stream-parse a GBIF zip/TSV into raw.occurrences or effort cells')
    .requiredOption('--run <id>', 'ingest_runs id', (v) => Number.parseInt(v, 10))
    .requiredOption('--file <path>', 'path to download .zip or .tsv')
    .action(async (opts: { run: number; file: string }) => {
      if (!Number.isInteger(opts.run) || opts.run <= 0) {
        throw new Error(`--run must be a positive integer (got ${String(opts.run)})`);
      }
      const result = await runGbifLoad({
        runId: opts.run,
        zipPath: opts.file,
      });
      console.log(
        JSON.stringify({
          runId: result.runId,
          kind: result.kind,
          total: result.total,
          loaded: result.loaded,
          rejectedLicence: result.rejectedLicence,
          rejectedCoords: result.rejectedCoords,
          rejectedOther: result.rejectedOther,
        }),
      );
    });

  program
    .command('aggregate')
    .description('Rebuild pub taxon aggregates for a region (tier delay + suppressAndMerge)')
    .requiredOption('--region <slug>', 'scotland|sindh')
    .action(async (opts: { region: string }) => {
      const result = await runAggregate({
        region: parseRegion(opts.region),
      });
      console.log(
        JSON.stringify({
          regionId: result.regionId,
          regionSlug: result.regionSlug,
          taxaProcessed: result.taxaProcessed,
          taxaSkippedNoForecast: result.taxaSkippedNoForecast,
          cellWeekRows: result.cellWeekRows,
          regionWeekRows: result.regionWeekRows,
          hourProfileRows: result.hourProfileRows,
        }),
      );
    });

  program
    .command('score:refs')
    .description('Compute pub.taxon_score_ref.rr_ref (P95 reporting rate) for a region')
    .requiredOption('--region <slug>', 'scotland|sindh')
    .action(async (opts: { region: string }) => {
      const result = await runScoreRefs({
        region: parseRegion(opts.region),
      });
      console.log(
        JSON.stringify({
          regionId: result.regionId,
          regionSlug: result.regionSlug,
          taxaProcessed: result.taxaProcessed,
          taxaSkipped: result.taxaSkipped,
          refsWritten: result.refsWritten,
        }),
      );
    });

  program
    .command('backtest')
    .description('Holdout-year validation report (§4.7) → reports/backtest-<region>-<year>.md')
    .requiredOption('--region <slug>', 'scotland|sindh')
    .requiredOption('--holdout <year>', 'held-out year Y−1', (v) => Number.parseInt(v, 10))
    .option('--out <path>', 'output markdown path (default reports/backtest-<region>-<year>.md)')
    .action(async (opts: { region: string; holdout: number; out?: string }) => {
      if (!Number.isInteger(opts.holdout)) {
        throw new Error(`--holdout must be an integer year (got ${String(opts.holdout)})`);
      }
      const result = await runBacktest({
        region: parseRegion(opts.region),
        holdoutYear: opts.holdout,
        ...(opts.out === undefined ? {} : { outPath: opts.out }),
      });
      console.log(
        JSON.stringify({
          regionId: result.regionId,
          regionSlug: result.regionSlug,
          holdoutYear: result.holdoutYear,
          outPath: result.outPath,
          passed: result.passed,
          failed: result.failed,
          insufficient: result.insufficient,
          skipped: result.skipped,
        }),
      );
    });

  program
    .command('make-admin')
    .description('Set app.users.role = admin for a user by email (T5.8; uses DATABASE_URL)')
    .argument('<email>', 'user email (must already exist from a prior sign-in upsert)')
    .action(async (email: string) => {
      const result = await runMakeAdmin({ email });
      console.log(
        JSON.stringify({
          userId: result.userId,
          email: result.email,
          role: result.role,
          alreadyAdmin: result.alreadyAdmin,
        }),
      );
    });

  program
    .command('purge-deleted')
    .description(
      'Hard-delete soft-deleted accounts older than 30 days, including photos (T5.14; uses DATABASE_URL)',
    )
    .option(
      '--retention-days <n>',
      'days after soft-delete before hard purge (default 30)',
      (v) => Number.parseInt(v, 10),
      30,
    )
    .action(async (opts: { retentionDays: number }) => {
      if (!Number.isInteger(opts.retentionDays) || opts.retentionDays < 0) {
        throw new Error(
          `--retention-days must be a non-negative integer (got ${String(opts.retentionDays)})`,
        );
      }
      const result = await runPurgeDeleted({ retentionDays: opts.retentionDays });
      console.log(
        JSON.stringify({
          purgedUsers: result.purgedUsers,
          deletedObjects: result.deletedObjects,
          userIds: result.userIds,
        }),
      );
    });

  program
    .command('ingest:pipeline')
    .description(
      'Monthly GBIF refresh: request→fetch→load (target+effort) then aggregate+score:refs (T9.3 Railway cron)',
    )
    .requiredOption('--region <slug>', 'scotland|sindh|all')
    .option('--beta <path>', 'path to beta-species.yaml', defaultBetaSpeciesPath())
    .option('--dir <path>', 'directory for zip downloads', defaultDownloadDir())
    .option('--dry-run', 'print planned steps without calling GBIF or the database', false)
    .action(async (opts: { region: string; beta: string; dir: string; dryRun: boolean }) => {
      const regions = parsePipelineRegions(opts.region);
      const result = await runIngestPipeline({
        regions,
        betaSpeciesPath: opts.beta,
        downloadDir: opts.dir,
        dryRun: opts.dryRun,
      });
      if (result.dryRun) {
        console.log(
          JSON.stringify({
            dryRun: true,
            regions: result.regions,
            plannedSteps: result.plannedSteps,
          }),
        );
        return;
      }
      const regionSummaries = result.regions.map((regionResult) => ({
        region: regionResult.region,
        kinds: regionResult.kinds.map((kindResult) => ({
          kind: kindResult.kind,
          runId: kindResult.request.runId,
          downloadKey: kindResult.request.downloadKey,
          doi: kindResult.fetch.doi,
          total: kindResult.fetch.total,
          loaded: kindResult.load.loaded,
          rejectedLicence: kindResult.load.rejectedLicence,
        })),
        aggregate: {
          taxaProcessed: regionResult.aggregate.taxaProcessed,
          cellWeekRows: regionResult.aggregate.cellWeekRows,
        },
        scoreRefs: {
          taxaProcessed: regionResult.scoreRefs.taxaProcessed,
          refsWritten: regionResult.scoreRefs.refsWritten,
        },
      }));
      console.log(JSON.stringify({ dryRun: false, regions: regionSummaries }));
    });

  return program;
}

export function listCommands(program: Command): string[] {
  return program.commands.map((command) => command.name());
}

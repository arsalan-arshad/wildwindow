import { Command } from 'commander';

import { runAggregate } from './aggregate/run.js';
import { runGbifFetch } from './gbif/fetch.js';
import { runGbifLoad } from './gbif/load.js';
import { runGbifRequest } from './gbif/request.js';
import { defaultBetaSpeciesPath, defaultDownloadDir } from './paths.js';

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

  return program;
}

export function listCommands(program: Command): string[] {
  return program.commands.map((command) => command.name());
}

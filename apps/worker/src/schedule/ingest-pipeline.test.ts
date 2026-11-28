import { describe, expect, it, vi } from 'vitest';

import { INGEST_STATUS } from '../gbif/ingest-status.js';

import {
  assertGbifEnabled,
  INGEST_PIPELINE_KINDS,
  INGEST_PIPELINE_REGIONS,
  parsePipelineRegions,
  runIngestPipeline,
  type IngestPipelineDeps,
} from './ingest-pipeline.js';

import type { IngestKind, IngestRegion } from '../gbif/predicate.js';

function stubDeps(overrides: Partial<IngestPipelineDeps> = {}): IngestPipelineDeps {
  let runId = 100;
  const deps: IngestPipelineDeps = {
    request: ({
      region,
      kind,
    }: {
      region: IngestRegion;
      kind: IngestKind;
      betaSpeciesPath: string;
    }) => {
      runId += 1;
      return Promise.resolve({
        runId,
        downloadKey: `key-${region}-${kind}`,
        status: INGEST_STATUS.requested,
        taxonKeyCount: 3,
      });
    },
    fetch: ({ runId: id }: { runId: number; downloadDir: string }) =>
      Promise.resolve({
        runId: id,
        status: INGEST_STATUS.succeeded,
        downloadKey: `key-${String(id)}`,
        doi: `10.15468/dl.${String(id)}`,
        total: 10,
        zipPath: `/tmp/run-${String(id)}.zip`,
      }),
    load: ({ runId: id }: { runId: number; zipPath: string }) =>
      Promise.resolve({
        runId: id,
        kind: 'target',
        total: 10,
        loaded: 8,
        rejectedLicence: 1,
        rejectedCoords: 1,
        rejectedOther: 0,
      }),
    aggregate: ({ region }: { region: IngestRegion }) =>
      Promise.resolve({
        regionId: region === 'scotland' ? 1 : 2,
        regionSlug: region,
        taxaProcessed: 5,
        taxaSkippedNoForecast: 0,
        cellWeekRows: 20,
        regionWeekRows: 4,
        hourProfileRows: 24,
      }),
    scoreRefs: ({ region }: { region: IngestRegion }) =>
      Promise.resolve({
        regionId: region === 'scotland' ? 1 : 2,
        regionSlug: region,
        taxaProcessed: 5,
        taxaSkipped: 0,
        refsWritten: 5,
      }),
  };
  return {
    request: vi.fn(deps.request),
    fetch: vi.fn(deps.fetch),
    load: vi.fn(deps.load),
    aggregate: vi.fn(deps.aggregate),
    scoreRefs: vi.fn(deps.scoreRefs),
    ...overrides,
  };
}

describe('ingest:pipeline (T9.3)', () => {
  it('parsePipelineRegions accepts scotland|sindh|all', () => {
    expect(parsePipelineRegions('scotland')).toEqual(['scotland']);
    expect(parsePipelineRegions('sindh')).toEqual(['sindh']);
    expect(parsePipelineRegions('all')).toEqual([...INGEST_PIPELINE_REGIONS]);
    expect(() => parsePipelineRegions('wales')).toThrow(/scotland\|sindh\|all/);
  });

  it('assertGbifEnabled requires GBIF_ENABLED=true', () => {
    expect(() => {
      assertGbifEnabled({});
    }).toThrow(/GBIF_ENABLED=true/);
    expect(() => {
      assertGbifEnabled({ GBIF_ENABLED: 'false' });
    }).toThrow(/GBIF_ENABLED=true/);
    expect(() => {
      assertGbifEnabled({ GBIF_ENABLED: 'true' });
    }).not.toThrow();
  });

  it('dry-run returns the planned steps without calling deps', async () => {
    const deps = stubDeps();
    const result = await runIngestPipeline({
      regions: ['scotland'],
      dryRun: true,
      env: {},
      deps,
    });
    expect(result.dryRun).toBe(true);
    expect(result.regions).toEqual(['scotland']);
    expect(result.plannedSteps).toEqual([
      'gbif:request --region scotland --kind target',
      'gbif:fetch --run <id>',
      'gbif:load --run <id> --file <zip>',
      'gbif:request --region scotland --kind effort',
      'gbif:fetch --run <id>',
      'gbif:load --run <id> --file <zip>',
      'aggregate --region scotland',
      'score:refs --region scotland',
    ]);
    expect(deps.request).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
  });

  it('runs request→fetch→load for each kind then aggregate+score:refs', async () => {
    const deps = stubDeps();
    const result = await runIngestPipeline({
      regions: ['sindh'],
      env: { GBIF_ENABLED: 'true' },
      deps,
      betaSpeciesPath: '/tmp/beta.yaml',
      downloadDir: '/tmp/downloads',
    });
    expect(result.dryRun).toBe(false);
    expect(deps.request).toHaveBeenCalledTimes(INGEST_PIPELINE_KINDS.length);
    expect(deps.fetch).toHaveBeenCalledTimes(2);
    expect(deps.load).toHaveBeenCalledTimes(2);
    expect(deps.aggregate).toHaveBeenCalledWith({ region: 'sindh' });
    expect(deps.scoreRefs).toHaveBeenCalledWith({ region: 'sindh' });
    expect(result.regions).toHaveLength(1);
    const region = result.regions[0];
    expect(region).toMatchObject({ region: 'sindh' });
  });

  it('refuses live runs when GBIF_ENABLED is not true', async () => {
    const deps = stubDeps();
    await expect(
      runIngestPipeline({
        regions: ['scotland'],
        env: { GBIF_ENABLED: 'false' },
        deps,
      }),
    ).rejects.toThrow(/GBIF_ENABLED=true/);
    expect(deps.request).not.toHaveBeenCalled();
  });

  it('fails when gbif:fetch does not produce a zip', async () => {
    const deps = stubDeps({
      fetch: vi.fn(({ runId }: { runId: number; downloadDir: string }) =>
        Promise.resolve({
          runId,
          status: INGEST_STATUS.failed,
          downloadKey: 'k',
          doi: null,
          total: null,
          zipPath: null,
        }),
      ),
    });
    await expect(
      runIngestPipeline({
        regions: ['scotland'],
        kinds: ['target'],
        env: { GBIF_ENABLED: 'true' },
        deps,
      }),
    ).rejects.toThrow(/gbif:fetch did not succeed/);
  });
});

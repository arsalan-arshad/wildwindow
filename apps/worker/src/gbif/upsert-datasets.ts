import type { PoolClient } from 'pg';

export type DatasetAttribution = {
  readonly datasetKey: string;
  readonly license: string;
  readonly title?: string;
  readonly publisher?: string;
};

/**
 * Upsert `ref.datasets` for keys seen during load (§3.2 / T3.8).
 * Citation links the ingest run DOI when present.
 */
export async function upsertDatasets(
  client: PoolClient,
  attributions: readonly DatasetAttribution[],
  doi: string | null,
): Promise<number> {
  let upserted = 0;
  const citation =
    doi !== null && doi.length > 0 ? `https://doi.org/${doi}` : 'GBIF occurrence download';

  for (const entry of attributions) {
    const title = entry.title ?? `GBIF dataset ${entry.datasetKey}`;
    const publisher = entry.publisher ?? 'GBIF';
    await client.query(
      `
      INSERT INTO ref.datasets (gbif_dataset_key, title, publisher, license, citation)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (gbif_dataset_key) DO UPDATE
      SET title = EXCLUDED.title,
          publisher = EXCLUDED.publisher,
          license = EXCLUDED.license,
          citation = EXCLUDED.citation
      `,
      [entry.datasetKey, title, publisher, entry.license, citation],
    );
    upserted += 1;
  }
  return upserted;
}

/** Deduplicate dataset keys, keeping the first license seen per key. */
export function collectDatasetAttributions(
  rows: readonly { readonly datasetKey: string; readonly license: string }[],
): DatasetAttribution[] {
  const map = new Map<string, DatasetAttribution>();
  for (const row of rows) {
    if (map.has(row.datasetKey)) {
      continue;
    }
    map.set(row.datasetKey, {
      datasetKey: row.datasetKey,
      license: row.license,
    });
  }
  return [...map.values()].sort((a, b) => a.datasetKey.localeCompare(b.datasetKey));
}

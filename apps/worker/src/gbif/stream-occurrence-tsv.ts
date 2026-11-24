import { createReadStream } from 'node:fs';

import { parse } from 'csv-parse';
import yauzl from 'yauzl';

import type { GbifOccurrenceRow } from './validate-row.js';
import type { Readable } from 'node:stream';

/**
 * Open a GBIF download zip and return a readable stream of the first .csv/.tsv entry.
 */
export async function openOccurrenceTsvStream(zipPath: string): Promise<Readable> {
  const zipFile = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(zip);
    });
  });

  return await new Promise<Readable>((resolve, reject) => {
    let settled = false;
    const fail = (error: Error): void => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    zipFile.on('error', (error: Error) => {
      fail(error);
    });
    zipFile.on('entry', (entry: yauzl.Entry) => {
      const name = entry.fileName.toLowerCase();
      if (!name.endsWith('.csv') && !name.endsWith('.tsv')) {
        zipFile.readEntry();
        return;
      }
      zipFile.openReadStream(entry, (err, readStream) => {
        if (err) {
          fail(err);
          return;
        }
        readStream.on('end', () => {
          zipFile.close();
        });
        if (!settled) {
          settled = true;
          resolve(readStream);
        }
      });
    });
    zipFile.on('end', () => {
      fail(new Error(`no .csv/.tsv entry in ${zipPath}`));
    });
    zipFile.readEntry();
  });
}

/** Stream-parse a tab-separated occurrence file (plain TSV or zip). */
export async function* iterateOccurrenceRows(
  sourcePath: string,
): AsyncGenerator<GbifOccurrenceRow> {
  const isZip = sourcePath.toLowerCase().endsWith('.zip');
  const byteStream = isZip
    ? await openOccurrenceTsvStream(sourcePath)
    : createReadStream(sourcePath);

  const parser = byteStream.pipe(
    parse({
      columns: true,
      delimiter: '\t',
      relax_column_count: true,
      skip_empty_lines: true,
      relax_quotes: true,
    }),
  );

  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    yield record;
  }
}

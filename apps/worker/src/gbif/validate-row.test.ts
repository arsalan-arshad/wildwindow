import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  hashObserver,
  parseEventDate,
  validateRow,
  type GbifOccurrenceRow,
  type ValidateRejectReason,
  type ValidateRowResult,
} from './validate-row.js';

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '__fixtures__',
  'validate-rows.tsv',
);

/** Test region: lat [55,56], lng [-5,-4]. */
function isInsideRegion(lat: number, lng: number): boolean {
  return lat >= 55 && lat <= 56 && lng >= -5 && lng <= -4;
}

const CTX = {
  observerHashSalt: 'test-salt',
  isInsideRegion,
};

function parseTsv(text: string): GbifOccurrenceRow[] {
  const lines = text.trimEnd().split('\n');
  const headerLine = lines[0];
  if (headerLine === undefined) {
    throw new Error('empty fixture');
  }
  const headers = headerLine.split('\t');
  return lines.slice(1).map((line) => {
    const cols = line.split('\t');
    const row: Record<string, string> = {};
    for (const [i, header] of headers.entries()) {
      row[header] = cols[i] ?? '';
    }
    return row;
  });
}

const EXPECTED: Record<string, { ok: true } | { ok: false; reason: ValidateRejectReason }> = {
  '1001': { ok: true },
  '1002': { ok: true },
  '1003': { ok: false, reason: 'licence' },
  '1004': { ok: false, reason: 'coords' },
  '1005': { ok: false, reason: 'coords' },
  '1006': { ok: false, reason: 'coords' },
  '1007': { ok: false, reason: 'coords' },
  '1008': { ok: true },
  '1009': { ok: true },
  '1010': { ok: true },
  '1011': { ok: true },
  '1012': { ok: true },
  '1013': { ok: true },
  '1014': { ok: false, reason: 'date' },
  '1015': { ok: false, reason: 'date' },
  '1016': { ok: false, reason: 'other' },
  '1017': { ok: false, reason: 'other' },
  '1018': { ok: false, reason: 'coords' },
  '1019': { ok: false, reason: 'coords' },
  '1020': { ok: true },
};

describe('validateRow fixture (20 rows)', () => {
  it('accepts and rejects the crafted rows as expected', async () => {
    const rows = parseTsv(await readFile(FIXTURE, 'utf8'));
    expect(rows).toHaveLength(20);

    const results: ValidateRowResult[] = rows.map((row) => validateRow(row, CTX));

    for (const [index, row] of rows.entries()) {
      const id = row.gbifID ?? '';
      const expected = EXPECTED[id];
      const result = results[index];
      expect(expected, `missing expectation for ${id}`).toBeDefined();
      expect(result, `missing result for ${id}`).toBeDefined();
      if (expected === undefined || result === undefined) {
        continue;
      }
      if (expected.ok) {
        expect(result.ok, `row ${id} should accept`).toBe(true);
      } else {
        expect(result).toEqual({ ok: false, reason: expected.reason });
      }
    }
  });

  it('never puts recordedBy (or raw observer text) in accepted output', async () => {
    const rows = parseTsv(await readFile(FIXTURE, 'utf8'));
    for (const row of rows) {
      const result = validateRow(row, CTX);
      if (!result.ok) {
        continue;
      }
      const json = JSON.stringify(result.record);
      expect(json).not.toMatch(/recordedBy/i);
      if (row.recordedBy !== undefined && row.recordedBy.length > 0) {
        expect(json).not.toContain(row.recordedBy);
        expect(json).not.toContain(row.recordedBy.toLowerCase());
      }
      expect(result.record.observerHash).toMatch(/^[0-9a-f]{64}$/);
      expect(result.record.observerHash).toBe(
        hashObserver(CTX.observerHashSalt, row.recordedBy ?? ''),
      );
    }
  });

  it('applies uncertainty defaults and maxRes bands', async () => {
    const rows = parseTsv(await readFile(FIXTURE, 'utf8'));
    const byId = new Map(rows.map((r) => [r.gbifID, r]));

    const missingRow = byId.get('1008');
    const coarseRow = byId.get('1009');
    expect(missingRow).toBeDefined();
    expect(coarseRow).toBeDefined();
    if (missingRow === undefined || coarseRow === undefined) {
      return;
    }

    const missing = validateRow(missingRow, CTX);
    expect(missing.ok && missing.record.uncertaintyM).toBe(1000);
    expect(missing.ok && missing.record.maxRes).toBe(7);

    const coarse = validateRow(coarseRow, CTX);
    expect(coarse.ok && coarse.record.uncertaintyM).toBe(5000);
    expect(coarse.ok && coarse.record.maxRes).toBe(5);
  });

  it('nulls hour for 00:00 and keeps real hours', async () => {
    const rows = parseTsv(await readFile(FIXTURE, 'utf8'));
    const byId = new Map(rows.map((r) => [r.gbifID, r]));

    const midnightRow = byId.get('1010');
    const realRow = byId.get('1012');
    expect(midnightRow).toBeDefined();
    expect(realRow).toBeDefined();
    if (midnightRow === undefined || realRow === undefined) {
      return;
    }

    const midnight = validateRow(midnightRow, CTX);
    expect(midnight.ok && midnight.record.hour).toBeNull();

    const real = validateRow(realRow, CTX);
    expect(real.ok && real.record.hour).toBe(14);
  });

  it('merges ISO week 53 into 52', () => {
    // 2020-12-31 is ISO week 53 of 2020.
    const parsed = parseEventDate('2020-12-31');
    expect(parsed?.week).toBe(52);
    expect(parsed?.year).toBe(2020);
  });
});

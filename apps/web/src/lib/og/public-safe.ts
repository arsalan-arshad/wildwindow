/**
 * No-Pin helpers for share-card copy (ARCHITECTURE §5).
 * Cards may never show H3 cell ids or coordinate-like numbers.
 */

const H3_CELL_PATTERN = /\b[0-9a-f]{15,}\b/i;
/** Decimal degrees-ish fragments (e.g. 55.865, -4.257). */
const COORD_FRAGMENT_PATTERN = /[-+]?\d{1,3}\.\d{3,}/;

export function textLooksLikeCellOrCoord(text: string): boolean {
  return H3_CELL_PATTERN.test(text) || COORD_FRAGMENT_PATTERN.test(text);
}

/** Concatenate every string field on a card model and assert No-Pin. */
export function assertCardCopyPublicSafe(
  values: ReadonlyArray<string | null | undefined>,
  context: string,
): void {
  for (const value of values) {
    if (value === null || value === undefined || value.length === 0) {
      continue;
    }
    if (textLooksLikeCellOrCoord(value)) {
      throw new Error(`${context}: share card copy must not include cells or coordinates`);
    }
  }
}

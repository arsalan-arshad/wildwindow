import { cellToParent, getResolution } from 'h3-js';

/**
 * Count distinct years that contribute to a published cell after suppress/merge.
 * Initial buckets are at the tier resolution; published cells may be coarser parents.
 */
export function yearsCoveredForPublished(
  publishedCell: string,
  bucketYears: ReadonlyMap<string, ReadonlySet<number>>,
): number {
  const publishedRes = getResolution(publishedCell);
  const years = new Set<number>();
  for (const [bucketCell, cellYears] of bucketYears) {
    const bucketRes = getResolution(bucketCell);
    let matches = false;
    if (bucketRes === publishedRes) {
      matches = bucketCell === publishedCell;
    } else if (bucketRes > publishedRes) {
      matches = cellToParent(bucketCell, publishedRes) === publishedCell;
    }
    if (!matches) {
      continue;
    }
    for (const year of cellYears) {
      years.add(year);
    }
  }
  return years.size;
}

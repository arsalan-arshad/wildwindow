import { cellToParent, getResolution, isValidCell } from 'h3-js';

import { GeoPrivacyError } from './errors.js';
import { TIER_POLICY, type Tier } from './tiers.js';

/** Minimum H3 resolution for suppress/merge (§5.4). */
export const SUPPRESS_MIN_RESOLUTION = 3;

export type CellCount = {
  cell: string;
  nRecords: number;
  observers: Set<string>;
};

function meetsMinimums(cell: CellCount, minRecords: number, minObservers: number): boolean {
  return cell.nRecords >= minRecords && cell.observers.size >= minObservers;
}

function mergeCellCounts(a: CellCount, b: CellCount): CellCount {
  const observers = new Set<string>(a.observers);
  for (const observer of b.observers) {
    observers.add(observer);
  }
  return {
    cell: a.cell,
    nRecords: a.nRecords + b.nRecords,
    observers,
  };
}

function cloneCell(cell: CellCount): CellCount {
  return {
    cell: cell.cell,
    nRecords: cell.nRecords,
    observers: new Set(cell.observers),
  };
}

/**
 * Merge cells that fail tier minimums into coarser parents until each surviving
 * cell meets `minRecords` / `minObservers`, down to res 3 (§5.4).
 */
export function suppressAndMerge(cells: readonly CellCount[], tier: Tier): CellCount[] {
  const policy = TIER_POLICY[tier];
  const tierRes = policy.resolution;
  if (tierRes === null) {
    return [];
  }

  const { minRecords, minObservers } = policy;
  let working: CellCount[] = cells.map(cloneCell);

  for (const entry of working) {
    if (!isValidCell(entry.cell)) {
      throw new GeoPrivacyError(`invalid H3 cell: ${entry.cell}`);
    }
    if (getResolution(entry.cell) > tierRes) {
      throw new GeoPrivacyError(
        `cell ${entry.cell} is finer than tier resolution ${String(tierRes)}`,
      );
    }
    if (!Number.isFinite(entry.nRecords) || entry.nRecords < 0) {
      throw new GeoPrivacyError('nRecords must be a non-negative finite number');
    }
  }

  // Normalize: raise any coarser-than-current inputs? Spec assumes cells at tier res.
  // Accept mixed by only merging among the current finest failing set per round.
  let currentRes: number = tierRes;

  while (currentRes >= SUPPRESS_MIN_RESOLUTION) {
    const atRes = working.filter((entry) => getResolution(entry.cell) === currentRes);
    const others = working.filter((entry) => getResolution(entry.cell) !== currentRes);

    const failing = atRes.filter((entry) => !meetsMinimums(entry, minRecords, minObservers));
    const passing = atRes.filter((entry) => meetsMinimums(entry, minRecords, minObservers));

    if (failing.length === 0) {
      working = [...others, ...passing];
      break;
    }

    if (currentRes === SUPPRESS_MIN_RESOLUTION) {
      // Drop anything still failing at the floor.
      working = [...others, ...passing];
      break;
    }

    const parentRes = currentRes - 1;
    const parentMap = new Map<string, CellCount>();
    for (const entry of failing) {
      const parentCell = cellToParent(entry.cell, parentRes);
      const asParent: CellCount = {
        cell: parentCell,
        nRecords: entry.nRecords,
        observers: new Set(entry.observers),
      };
      const existing = parentMap.get(parentCell);
      parentMap.set(parentCell, existing === undefined ? asParent : mergeCellCounts(existing, asParent));
    }

    // Also merge into any already-present parent at parentRes among others.
    const nextOthers: CellCount[] = [];
    for (const entry of others) {
      const pendingParent = parentMap.get(entry.cell);
      if (getResolution(entry.cell) === parentRes && pendingParent !== undefined) {
        parentMap.set(entry.cell, mergeCellCounts(pendingParent, entry));
      } else {
        nextOthers.push(entry);
      }
    }

    working = [...nextOthers, ...passing, ...parentMap.values()];
    currentRes = parentRes;
  }

  // Final filter: only cells meeting minimums (and not finer than tier).
  return working
    .filter((entry) => meetsMinimums(entry, minRecords, minObservers))
    .filter((entry) => getResolution(entry.cell) <= tierRes)
    .map(cloneCell)
    .sort((a, b) => a.cell.localeCompare(b.cell));
}

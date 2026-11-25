/**
 * Confidence label and Low range (§4.4).
 */
import { SCORING_V1 } from './config/v1.js';

import type { Confidence } from './types.js';

export type ConfidenceInput = {
  readonly nSpecies: number;
  readonly nEffort: number;
  readonly distinctYears: number;
  /** When region-week effort is zero, confidence is Low (§4.2). */
  readonly regionEffort: number;
};

export function confidenceLabel(input: ConfidenceInput): Confidence {
  const { nSpecies, nEffort, distinctYears, regionEffort } = input;
  if (regionEffort === 0) {
    return 'low';
  }
  const { highMinSpecies, highMinYears, highMinEffort, mediumMinSpecies, mediumMinYears } =
    SCORING_V1.confidence;
  if (nSpecies >= highMinSpecies && distinctYears >= highMinYears && nEffort >= highMinEffort) {
    return 'high';
  }
  if (nSpecies >= mediumMinSpecies && distinctYears >= mediumMinYears) {
    return 'medium';
  }
  return 'low';
}

/** Low-confidence range around the week score (§4.4). */
export function confidenceRange(
  score: number,
  confidence: Confidence,
): readonly [number, number] | null {
  if (confidence !== 'low') {
    return null;
  }
  const pad = SCORING_V1.confidence.rangePad;
  return [Math.max(0, score - pad), Math.min(100, score + pad)];
}

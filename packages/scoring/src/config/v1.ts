/**
 * Window score v1 constants — ARCHITECTURE §4.
 * Changing any weight bumps `version`.
 */
export const SCORING_V1 = {
  version: '1.0',
  /** Empirical-Bayes shrink strength for reporting rate (§4.2). */
  alpha: 20,
  /** Circular kernel for hourly profile smoothing (§4.2 T). */
  hourKernel: [0.25, 0.5, 0.25] as const,
  /** Timed-record threshold before falling back to activity templates. */
  hourProfileMinRecords: 30,
  conditions: {
    timeBase: 0.6,
    timeWeight: 0.4,
    lightBase: 0.7,
    lightWeight: 0.3,
  },
  weather: {
    rainWeight: 0.6,
    windCalmKph: 20,
    windGaleKph: 50,
    windFloor: 0.5,
    beyondHorizon: 0.85,
  },
  tide: {
    preferred: 1.0,
    outside: 0.6,
  },
  confidence: {
    highMinSpecies: 50,
    highMinYears: 3,
    highMinEffort: 500,
    mediumMinSpecies: 15,
    mediumMinYears: 2,
    rangePad: 15,
  },
} as const;

export type ScoringV1 = typeof SCORING_V1;

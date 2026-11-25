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
  /** Sun altitude bands in degrees (§4.2 T/G and T4.2). */
  light: {
    /** Civil dawn / dusk: sun altitude ≥ this. */
    civilAltitudeDeg: -6,
    /** Blue hour: sun between low and high (exclusive of golden). */
    blueHourLowDeg: -6,
    blueHourHighDeg: -4,
    /** Golden hour: sun between low and high. */
    goldenHourLowDeg: -4,
    goldenHourHighDeg: 6,
    /** Candidate blocks are this many hours long. */
    blockHours: 2,
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
    /** ± hours around high/low for preferred low/high windows (§4.2 D). */
    windowHours: 2,
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

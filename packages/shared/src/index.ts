export { EnvValidationError, loadEnv } from './env.js';
export {
  ActivityPatternSchema,
  BetaSpeciesEntrySchema,
  BetaSpeciesFileSchema,
  RegionIdSchema,
  SensitiveSpeciesEntrySchema,
  SensitiveSpeciesFileSchema,
  SensitivityTierSchema,
  SpeciesGroupSchema,
  TidePrefSchema,
} from './data-schemas.js';
export type {
  ActivityPattern,
  BetaSpeciesEntry,
  BetaSpeciesFile,
  RegionId,
  SensitiveSpeciesEntry,
  SensitiveSpeciesFile,
  SensitivityTier,
  SpeciesGroup,
  TidePref,
} from './data-schemas.js';
export * from './api/index.js';
export { ApiClientError, createApiClient } from './client.js';
export type { ApiClient, CreateApiClientOptions } from './client.js';
export { validateDataDir } from './validate-data.js';
export type { DataValidationResult } from './validate-data.js';
export { matchSpeciesViaGbif, resolveBetaSpecies, resolveTaxaFile } from './resolve-taxa.js';
export type { GbifMatchResult, MatchSpeciesFn, ResolveTaxaResult } from './resolve-taxa.js';

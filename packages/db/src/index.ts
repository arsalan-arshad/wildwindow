export { createDb, createPool, type CreateDbOptions, type Database } from './client.js';
export { migrationsFolder, runMigrations, type RunMigrationsResult } from './migrate.js';
export { applyRoles, roleConnectionUrl, type RolePasswords } from './roles.js';
export {
  REGION_SEEDS,
  boundariesFolder,
  dataFolder,
  seedAll,
  seedRegions,
  seedTaxa,
  type RegionSeed,
  type SeedAllResult,
  type SeedRegionsResult,
  type SeedTaxaResult,
} from './seed.js';
export {
  GEONAMES_COUNTRY_DUMPS,
  candidateToPlaceSeed,
  downloadAndSeedPlaces,
  loadPlaceSeedsFromTsv,
  placesDumpDir,
  placesFixturePath,
  seedPlaces,
  seedPlacesFromFixture,
  type PlaceSeedRow,
  type SeedPlacesResult,
} from './seed-places.js';
export {
  seedSpeciesCards,
  seedSpeciesCardsFromDir,
  seedSpeciesCardsFromFixture,
  speciesCardsFixtureFolder,
  speciesCardsFolder,
  type SeedCardsResult,
} from './seed-cards.js';
export {
  isKeptGeonameFeature,
  parseGeonameLine,
  placeKindFor,
  readGeonameDump,
  type GeonameCandidate,
} from './geonames.js';
export {
  areaLabelFor,
  cellToWktPolygon,
  formatAreaLabel,
  type AreaLabelLookup,
  type AreaLabelParts,
} from './area-label.js';
export { defaultZonesFolder, seedZones, zonesFolder, type SeedZonesResult } from './seed-zones.js';
export {
  appSchema,
  auditLog,
  challengeEntries,
  challenges,
  datasets,
  effortCellWeek,
  entitlements,
  forecastCache,
  geometryMultipolygon4326,
  geometryPoint4326,
  ingestRuns,
  logbookEntries,
  occurrences,
  places,
  pubSchema,
  rawSchema,
  refSchema,
  regions,
  speciesCards,
  taxa,
  taxonCellWeek,
  taxonHourProfile,
  taxonRegion,
  taxonRegionWeek,
  taxonScoreRef,
  users,
  waitlist,
  watchlist,
  weatherCache,
  zones,
} from './schema/index.js';

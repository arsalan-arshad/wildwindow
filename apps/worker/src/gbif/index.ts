export {
  GBIF_API_BASE_URL,
  GbifClient,
  createGbifClient,
  type GbifClientOptions,
  type GbifCredentials,
  type RequestDownloadInput,
} from './client.js';
export { GbifHttpError, GbifResponseError, GbifRetryExhaustedError } from './errors.js';
export {
  GBIF_BASIS_OF_RECORD,
  GBIF_LICENSE_ALLOWLIST,
  GBIF_MIN_YEAR,
  assertLicenseAllowlist,
  buildPredicate,
  findLicenseInPredicate,
  licenseAllowlistValues,
  type AndPredicate,
  type BuildPredicateInput,
  type EqualsPredicate,
  type GbifPredicateNode,
  type GreaterThanOrEqualsPredicate,
  type IngestKind,
  type IngestRegion,
  type InPredicate,
} from './predicate.js';
export {
  GbifDownloadFormatSchema,
  GbifDownloadRequestSchema,
  GbifDownloadSchema,
  GbifDownloadStatusSchema,
  GbifPredicateSchema,
  type GbifDownload,
  type GbifDownloadFormat,
  type GbifDownloadRequest,
  type GbifDownloadStatus,
  type GbifPredicate,
} from './schemas.js';

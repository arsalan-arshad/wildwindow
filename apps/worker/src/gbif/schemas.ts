import { z } from 'zod';

/** Predicate shape is opaque here; T3.2 builds the concrete tree. */
export const GbifPredicateSchema = z.record(z.unknown());
export type GbifPredicate = z.infer<typeof GbifPredicateSchema>;

export const GbifDownloadFormatSchema = z.enum([
  'SIMPLE_CSV',
  'DWCA',
  'SPECIES_LIST',
  'FASTA_ARCHIVE',
]);
export type GbifDownloadFormat = z.infer<typeof GbifDownloadFormatSchema>;

export const GbifDownloadRequestSchema = z.object({
  creator: z.string().min(1),
  notificationAddresses: z.array(z.string().email()).min(1),
  sendNotification: z.boolean().default(true),
  format: GbifDownloadFormatSchema.default('SIMPLE_CSV'),
  predicate: GbifPredicateSchema,
});
export type GbifDownloadRequest = z.infer<typeof GbifDownloadRequestSchema>;

export const GbifDownloadStatusSchema = z.enum([
  'PREPARING',
  'RUNNING',
  'SUCCEEDED',
  'CANCELLED',
  'KILLED',
  'FAILED',
  'SUSPENDED',
  'FILE_ERASED',
]);
export type GbifDownloadStatus = z.infer<typeof GbifDownloadStatusSchema>;

/**
 * Status payload from GET /v1/occurrence/download/{key}.
 * Extra fields are stripped; only what the worker needs is kept.
 */
export const GbifDownloadSchema = z.object({
  key: z.string().min(1),
  status: GbifDownloadStatusSchema,
  doi: z.string().optional(),
  downloadLink: z.string().url().optional(),
  size: z.number().int().nonnegative().optional(),
  totalRecords: z.number().int().nonnegative().optional(),
  license: z.string().optional(),
});
export type GbifDownload = z.infer<typeof GbifDownloadSchema>;

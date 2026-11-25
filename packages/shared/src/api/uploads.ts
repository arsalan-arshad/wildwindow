import { z } from 'zod';

export const UploadMimeTypeSchema = z.enum(['image/jpeg', 'image/heic', 'image/webp']);
export type UploadMimeType = z.infer<typeof UploadMimeTypeSchema>;

/** Max upload size (ARCHITECTURE §7 / T5.10). */
export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

/** POST /v1/uploads/presign */
export const PresignUploadRequestSchema = z.object({
  mimeType: UploadMimeTypeSchema,
  byteSize: z.number().int().positive().max(UPLOAD_MAX_BYTES),
});
export type PresignUploadRequest = z.infer<typeof PresignUploadRequestSchema>;

export const PresignUploadResponseSchema = z.object({
  uploadUrl: z.string().url(),
  photoKey: z.string().min(1),
  headers: z.record(z.string()),
  expiresAt: z.string().datetime(),
});
export type PresignUploadResponse = z.infer<typeof PresignUploadResponseSchema>;

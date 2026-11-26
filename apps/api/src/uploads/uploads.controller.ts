import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PresignUploadRequestSchema,
  PresignUploadResponseSchema,
  type PresignUploadResponse,
} from '@wildwindow/shared';
import { createZodDto } from 'nestjs-zod';

import { FirebaseAuthGuard } from '../auth/firebase-auth.guard.js';
import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { type RequestWithOptionalUser } from '../geoprivacy/owner-location.js';
import { notFoundError, unauthorizedError, validationError } from '../http/api-error.js';
import { verifyLocalGetToken } from '../storage/local-get-token.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.types.js';

import { UploadsService } from './uploads.service.js';

import type { Request, Response } from 'express';

class PresignUploadRequestDto extends createZodDto(PresignUploadRequestSchema) {}
class PresignUploadResponseDto extends createZodDto(PresignUploadResponseSchema) {}

@ApiTags('uploads')
@Controller('v1/uploads')
export class UploadsController {
  constructor(
    private readonly uploads: UploadsService,
    @Inject(API_ENV) private readonly env: ApiEnv,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  @Post('presign')
  @UseGuards(FirebaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Presigned PUT for a photo (JPEG/HEIC/WebP, max 15 MB)' })
  @ApiBody({ type: PresignUploadRequestDto })
  @ApiOkResponse({ type: PresignUploadResponseDto })
  async presign(
    @Req() req: RequestWithOptionalUser,
    @Body() body: unknown,
  ): Promise<PresignUploadResponse> {
    const userId = requireUserId(req);
    return this.uploads.presign(userId, body);
  }

  /**
   * Local storage driver target for presigned PUTs. Token carries key/MIME/size/expiry.
   * Rejects bodies that still contain GPS EXIF (T5.10).
   */
  @Put('put/:token')
  @HttpCode(200)
  @ApiOperation({ summary: 'Local-driver photo PUT (dev/test); not used with S3' })
  async putLocal(
    @Param('token') token: string,
    @Req() req: Request & { body?: unknown },
  ): Promise<{ ok: true; photoKey: string }> {
    if (this.storage.driver !== 'local') {
      throw validationError('Local PUT is only available when STORAGE_DRIVER=local');
    }
    const signingSecret = resolveLocalSigningSecret(this.env);
    if (signingSecret === null) {
      throw validationError('Local uploads are not configured');
    }

    const body = coerceBodyBuffer(req.body);
    const contentType = headerString(req.headers['content-type']);
    return this.uploads.putLocal(decodeURIComponent(token), body, contentType, signingSecret);
  }

  /**
   * Local storage driver target for presigned GETs (challenge gallery photoUrl).
   */
  @Get('object/:token')
  @ApiOperation({ summary: 'Local-driver photo GET (dev/test); not used with S3' })
  async getLocal(@Param('token') token: string, @Res() res: Response): Promise<void> {
    if (this.storage.driver !== 'local') {
      throw validationError('Local GET is only available when STORAGE_DRIVER=local');
    }
    const signingSecret = resolveLocalSigningSecret(this.env);
    if (signingSecret === null) {
      throw validationError('Local uploads are not configured');
    }

    const payload = verifyLocalGetToken(decodeURIComponent(token), signingSecret);
    if (payload === null) {
      throw notFoundError('Object not found');
    }
    const body = await this.storage.getObject(payload.key);
    if (body === null) {
      throw notFoundError('Object not found');
    }
    res.setHeader('Content-Type', contentTypeForKey(payload.key));
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.status(200).send(body);
  }
}

function contentTypeForKey(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
    return 'image/heic';
  }
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  return 'image/jpeg';
}

/** Must match `resolveSigningSecret` in `storage/factory.ts`. */
function resolveLocalSigningSecret(env: ApiEnv): string | null {
  const secret = env.STORAGE_SIGNING_SECRET?.trim();
  if (secret !== undefined && secret.length > 0) {
    return secret;
  }
  if (env.NODE_ENV === 'production') {
    return null;
  }
  return 'ww-local-storage-dev-signing-secret';
}

function requireUserId(req: RequestWithOptionalUser): string {
  const id = req.user?.id;
  if (typeof id !== 'string' || id.length === 0) {
    throw unauthorizedError();
  }
  return id;
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function coerceBodyBuffer(body: unknown): Buffer {
  if (Buffer.isBuffer(body)) {
    return body;
  }
  if (body instanceof Uint8Array) {
    return Buffer.from(body);
  }
  if (typeof body === 'string') {
    return Buffer.from(body, 'binary');
  }
  throw validationError('Expected raw image body');
}

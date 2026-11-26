import { HttpStatus } from '@nestjs/common';

import { ApiHttpException } from '../http/api-error.js';

export function gpsExifForbiddenError(
  message = 'Upload still contains GPS EXIF; strip location metadata before upload',
): ApiHttpException {
  return new ApiHttpException(HttpStatus.BAD_REQUEST, {
    code: 'GPS_EXIF_FORBIDDEN',
    message,
  });
}

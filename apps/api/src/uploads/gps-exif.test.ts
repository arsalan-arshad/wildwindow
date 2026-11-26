import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assertNoGpsExif, GpsExifPresentError, hasGpsExif } from './gps-exif.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const jpegWithGps = readFileSync(join(fixturesDir, 'jpeg-with-gps.jpg'));
const jpegNoGps = readFileSync(join(fixturesDir, 'jpeg-no-gps.jpg'));

describe('GPS EXIF check (T5.10)', () => {
  it('rejects a fixture JPEG that still has GPS tags', async () => {
    await expect(hasGpsExif(jpegWithGps)).resolves.toBe(true);
    await expect(assertNoGpsExif(jpegWithGps)).rejects.toBeInstanceOf(GpsExifPresentError);
  });

  it('accepts a fixture JPEG without GPS tags', async () => {
    await expect(hasGpsExif(jpegNoGps)).resolves.toBe(false);
    await expect(assertNoGpsExif(jpegNoGps)).resolves.toBeUndefined();
  });
});

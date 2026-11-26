import {
  assertNoGpsInExif,
  containsGpsKey,
  extractCameraExif,
  extractGpsFromExif,
  takenAtFromExif,
} from '@/lib/logbook/exif';
import { prepareLogbookPhoto } from '@/lib/logbook/prepare-photo';
import { buildLogbookCreateBody, putPreparedLogbookPhoto } from '@/lib/logbook/upload';
import { SaveFormat } from 'expo-image-manipulator';

const RAW_EXIF_WITH_GPS: Record<string, unknown> = {
  Make: 'Canon',
  Model: 'EOS R5',
  LensModel: 'RF100-500mm',
  FocalLength: 400,
  ExposureTime: 0.001,
  FNumber: 5.6,
  ISOSpeedRatings: 800,
  DateTimeOriginal: '2026:06:15 07:30:00',
  GPSLatitude: [55, 51, 36],
  GPSLatitudeRef: 'N',
  GPSLongitude: [4, 15, 0],
  GPSLongitudeRef: 'W',
  GPSAltitude: 12,
  latitude: 55.86,
  longitude: -4.25,
};

describe('logbook EXIF sanitisation (T6.9)', () => {
  it('extracts camera settings and drops GPS keys', () => {
    const camera = extractCameraExif(RAW_EXIF_WITH_GPS);
    expect(camera.camera).toBe('Canon EOS R5');
    expect(camera.lens).toBe('RF100-500mm');
    expect(camera.focalLength).toBe('400mm');
    expect(camera.shutter).toBe('1/1000');
    expect(camera.aperture).toBe('f/5.6');
    expect(camera.iso).toBe('800');
    expect(containsGpsKey(camera)).toBe(false);
    expect(() => {
      assertNoGpsInExif(camera);
    }).not.toThrow();
  });

  it('reads GPS separately for the optional owner exact point', () => {
    const gps = extractGpsFromExif(RAW_EXIF_WITH_GPS);
    expect(gps).not.toBeNull();
    expect(gps?.lat).toBeCloseTo(55.86, 2);
    expect(gps?.lng).toBeCloseTo(-4.25, 2);
  });

  it('parses DateTimeOriginal into ISO', () => {
    const camera = extractCameraExif(RAW_EXIF_WITH_GPS);
    expect(takenAtFromExif(camera, '2026-11-26T00:00:00.000Z')).toBe('2026-06-15T07:30:00.000Z');
  });
});

describe('logbook upload payload has no GPS (T6.9 acceptance)', () => {
  it('prepare + create body never put GPS in the upload exif or PUT metadata', async () => {
    const putBodies: unknown[] = [];
    const putHeaders: Array<Record<string, string>> = [];

    const prepared = await prepareLogbookPhoto({
      asset: {
        uri: 'file:///tmp/with-gps.jpg',
        exif: RAW_EXIF_WITH_GPS,
      },
      now: new Date('2026-11-26T12:00:00.000Z'),
      manipulator: {
        manipulateAsync: async (uri) => ({
          uri: `${uri}#stripped-jpeg`,
          width: 10,
          height: 10,
        }),
      },
      readBlob: async () => ({
        blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
        byteSize: 4,
      }),
    });

    expect(prepared.mimeType).toBe('image/jpeg');
    expect(containsGpsKey(prepared.exifRecord)).toBe(false);
    expect(containsGpsKey(prepared.exif)).toBe(false);
    expect(JSON.stringify(prepared.exifRecord)).not.toMatch(/GPS|latitude|longitude|lat|lng/i);
    // Photo GPS is available separately for the owner-only opt-in — not in exif.
    expect(prepared.photoGps).not.toBeNull();

    const api = {
      uploads: {
        presign: async () => ({
          uploadUrl: 'https://example.test/put',
          photoKey: 'uploads/user-1/photo.jpg',
          headers: { 'x-test': '1' },
          expiresAt: '2026-11-26T13:00:00.000Z',
        }),
      },
    };

    await putPreparedLogbookPhoto({
      api,
      prepared,
      fetchImpl: (async (_url, init) => {
        putBodies.push(init?.body);
        putHeaders.push((init?.headers ?? {}) as Record<string, string>);
        return new Response(null, { status: 200 });
      }) as typeof fetch,
    });

    // PUT body is the stripped blob only — no EXIF object alongside.
    expect(putBodies).toHaveLength(1);
    expect(putBodies[0]).toBe(prepared.blob);
    expect(JSON.stringify(putHeaders[0])).not.toMatch(/GPS|latitude|longitude/i);

    const createWithoutExact = buildLogbookCreateBody({
      prepared,
      photoKey: 'uploads/user-1/photo.jpg',
      taxonId: '2495840',
      notes: 'Dawn kingfisher',
      keepExactPoint: false,
    });
    expect(containsGpsKey(createWithoutExact.exif ?? {})).toBe(false);
    expect(createWithoutExact).not.toHaveProperty('exactLocation');
    expect(JSON.stringify(createWithoutExact.exif)).not.toMatch(
      /GPS|latitude|longitude|"lat"|"lng"/i,
    );

    const createWithExact = buildLogbookCreateBody({
      prepared,
      photoKey: 'uploads/user-1/photo.jpg',
      keepExactPoint: true,
    });
    // Owner-only exactLocation is a sibling field — still must not appear inside exif.
    expect(createWithExact.exactLocation).toEqual(prepared.photoGps);
    expect(containsGpsKey(createWithExact.exif ?? {})).toBe(false);
    expect(JSON.stringify(createWithExact.exif)).not.toMatch(/GPS|latitude|longitude|"lat"|"lng"/i);
  });

  it('re-encodes via the manipulator with JPEG format (metadata drop)', async () => {
    const manipulateAsync = jest.fn(async (uri: string) => ({
      uri: `${uri}#out`,
      width: 1,
      height: 1,
    }));

    await prepareLogbookPhoto({
      asset: { uri: 'file:///in.jpg', exif: { Model: 'X' } },
      manipulator: { manipulateAsync },
      readBlob: async () => ({
        blob: new Blob([new Uint8Array([1, 2, 3])]),
        byteSize: 3,
      }),
    });

    expect(manipulateAsync).toHaveBeenCalledWith(
      'file:///in.jpg',
      [],
      expect.objectContaining({ format: SaveFormat.JPEG }),
    );
  });
});

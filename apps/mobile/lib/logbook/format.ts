import type { LogbookCameraExif } from '@/lib/logbook/exif';

/** Short one-line camera summary for list rows. */
export function formatCameraSummary(exif: Record<string, unknown> | LogbookCameraExif): string {
  const camera = typeof exif['camera'] === 'string' ? exif['camera'] : undefined;
  const shutter = typeof exif['shutter'] === 'string' ? exif['shutter'] : undefined;
  const aperture = typeof exif['aperture'] === 'string' ? exif['aperture'] : undefined;
  const iso = typeof exif['iso'] === 'string' ? exif['iso'] : undefined;

  const parts: string[] = [];
  if (camera !== undefined) {
    parts.push(camera);
  }
  const exposure: string[] = [];
  if (shutter !== undefined) {
    exposure.push(shutter);
  }
  if (aperture !== undefined) {
    exposure.push(aperture);
  }
  if (iso !== undefined) {
    exposure.push(`ISO ${iso}`);
  }
  if (exposure.length > 0) {
    parts.push(exposure.join(' · '));
  }
  return parts.length > 0 ? parts.join(' — ') : '';
}

export function formatTakenAt(iso: string, timeZone: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

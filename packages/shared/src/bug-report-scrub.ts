import { FORBIDDEN_PUBLIC_KEYS } from '@wildwindow/geoprivacy';

/**
 * Pure text scrubber for in-app bug reports (T9.11).
 * Redacts geoprivacy forbidden keys in key-like contexts, GPS EXIF tag names,
 * and coordinate-looking fragments before a GitHub issue is opened or a
 * fallback URL is built. Never throws.
 */

export const BUG_REPORT_REDACT = '[redacted]';

/** Decimal-degree-ish fragments (e.g. 55.865, -4.257). */
const COORD_DECIMAL_PATTERN = /[-+]?\d{1,3}\.\d{3,}/g;

/** Lat/lng pairs separated by comma, slash, or semicolon. */
const COORD_PAIR_PATTERN = /[-+]?\d{1,3}\.\d{2,}\s*[,;/]\s*[-+]?\d{1,3}\.\d{2,}/g;

/** Degrees / minutes / seconds with optional hemisphere. */
const COORD_DMS_PATTERN =
  /\d{1,3}\s*°\s*\d{1,2}\s*['′]\s*(?:\d{1,2}(?:\.\d+)?\s*[″"]?)?\s*[NnSsEeWw]?/g;

/** GPS EXIF tag names (GPSLatitude, GPSLongitudeRef, …). */
const GPS_EXIF_TAG_PATTERN = /\bGPS[A-Za-z0-9_]+\b/g;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a pattern that matches a forbidden key used as a field name:
 * `lat: …`, `lat=…`, `"latitude": …`, `'lng' = …`.
 * Word boundaries avoid matching inside ordinary words (`flat:`, `belong=`).
 */
function forbiddenKeyAssignmentPattern(key: string): RegExp {
  const escaped = escapeRegExp(key);
  return new RegExp(`(?<![A-Za-z0-9_])(['"]?)${escaped}\\1\\s*[:=]\\s*[^\\s,;}\\]\\n]+`, 'gi');
}

/** Longer keys first so `longitude` wins over `long` / `lon`. */
const FORBIDDEN_KEY_PATTERNS: readonly RegExp[] = [...FORBIDDEN_PUBLIC_KEYS]
  .sort((a, b) => b.length - a.length)
  .map((key) => forbiddenKeyAssignmentPattern(key));

/**
 * Scrub free-text bug-report fields. Idempotent for already-redacted input.
 */
export function scrubBugReportText(input: string): string {
  let out = input;

  out = out.replace(GPS_EXIF_TAG_PATTERN, BUG_REPORT_REDACT);

  for (const pattern of FORBIDDEN_KEY_PATTERNS) {
    // Reset lastIndex for global patterns reused across calls.
    pattern.lastIndex = 0;
    out = out.replace(pattern, BUG_REPORT_REDACT);
  }

  out = out.replace(COORD_PAIR_PATTERN, BUG_REPORT_REDACT);
  out = out.replace(COORD_DMS_PATTERN, BUG_REPORT_REDACT);
  out = out.replace(COORD_DECIMAL_PATTERN, BUG_REPORT_REDACT);

  return out;
}

export type BugReportTextFields = {
  readonly steps: string;
  readonly expected: string;
  readonly actual: string;
  readonly version: string;
  readonly device: string;
};

/** Scrub every free-text field on a bug-report draft. */
export function scrubBugReportFields<T extends BugReportTextFields>(fields: T): T {
  return {
    ...fields,
    steps: scrubBugReportText(fields.steps),
    expected: scrubBugReportText(fields.expected),
    actual: scrubBugReportText(fields.actual),
    version: scrubBugReportText(fields.version),
    device: scrubBugReportText(fields.device),
  };
}

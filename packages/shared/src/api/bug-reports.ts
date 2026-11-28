import { z } from 'zod';

import { ApiErrorBodySchema } from './common.js';

export { ApiErrorBodySchema };
export type { ApiErrorBody } from './common.js';

/** Matches `.github/ISSUE_TEMPLATE/bug_report.yml` platform dropdown. */
export const BugReportPlatformSchema = z.enum(['iOS', 'Android', 'web', 'api']);
export type BugReportPlatform = z.infer<typeof BugReportPlatformSchema>;

/** Matches the severity dropdown on the GitHub bug form. */
export const BugReportSeveritySchema = z.enum(['P0', 'P1', 'P2']);
export type BugReportSeverity = z.infer<typeof BugReportSeveritySchema>;

/**
 * Public bug-report body (POST /v1/bug-reports) — T9.11.
 * Free-text fields are scrubbed server-side before GitHub or the fallback URL.
 */
export const BugReportRequestSchema = z.object({
  steps: z.string().trim().min(1).max(4000),
  expected: z.string().trim().min(1).max(2000),
  actual: z.string().trim().min(1).max(2000),
  platform: BugReportPlatformSchema,
  version: z.string().trim().min(1).max(120),
  device: z.string().trim().min(1).max(200),
  /** Defaults to P2 when omitted (form still requires a value). */
  severity: BugReportSeveritySchema.optional().default('P2'),
});
export type BugReportRequest = z.infer<typeof BugReportRequestSchema>;
/** Input type before Zod applies the severity default. */
export type BugReportRequestInput = z.input<typeof BugReportRequestSchema>;

export const BugReportFiledSchema = z.object({
  status: z.literal('filed'),
  issueNumber: z.number().int().positive(),
});
export type BugReportFiled = z.infer<typeof BugReportFiledSchema>;

export const BugReportFallbackSchema = z.object({
  status: z.literal('fallback'),
  /** Prefilled GitHub new-issue URL (template=bug_report.yml + form field ids). */
  url: z.string().url(),
});
export type BugReportFallback = z.infer<typeof BugReportFallbackSchema>;

export const BugReportResponseSchema = z.discriminatedUnion('status', [
  BugReportFiledSchema,
  BugReportFallbackSchema,
]);
export type BugReportResponse = z.infer<typeof BugReportResponseSchema>;

export const BugReportErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'RATE_LIMIT',
  'SERVICE_UNAVAILABLE',
]);
export type BugReportErrorCode = z.infer<typeof BugReportErrorCodeSchema>;

/** Canonical repo + template for the fallback URL (T9.11). */
export const BUG_REPORT_GITHUB_OWNER = 'arsalan-arshad';
export const BUG_REPORT_GITHUB_REPO = 'wildwindow';
export const BUG_REPORT_TEMPLATE = 'bug_report.yml';

export const BUG_REPORT_NEW_ISSUE_BASE =
  `https://github.com/${BUG_REPORT_GITHUB_OWNER}/${BUG_REPORT_GITHUB_REPO}/issues/new` as const;

/**
 * Build the prefilled GitHub new-issue URL. Query keys match form field ids
 * in `.github/ISSUE_TEMPLATE/bug_report.yml`.
 */
export function buildBugReportFallbackUrl(fields: {
  readonly steps: string;
  readonly expected: string;
  readonly actual: string;
  readonly platform: BugReportPlatform;
  readonly version: string;
  readonly device: string;
  readonly severity: BugReportSeverity;
}): string {
  const params = new URLSearchParams({
    template: BUG_REPORT_TEMPLATE,
    steps: fields.steps,
    expected: fields.expected,
    actual: fields.actual,
    platform: fields.platform,
    version: fields.version,
    device: fields.device,
    severity: fields.severity,
  });
  return `${BUG_REPORT_NEW_ISSUE_BASE}?${params.toString()}`;
}

/** Format a GitHub Issues API body that mirrors the bug_report.yml form. */
export function formatBugReportIssueBody(fields: {
  readonly steps: string;
  readonly expected: string;
  readonly actual: string;
  readonly platform: BugReportPlatform;
  readonly version: string;
  readonly device: string;
  readonly severity: BugReportSeverity;
}): string {
  return [
    '### Steps to reproduce',
    '',
    fields.steps,
    '',
    '### Expected behaviour',
    '',
    fields.expected,
    '',
    '### Actual behaviour',
    '',
    fields.actual,
    '',
    '### Platform',
    '',
    fields.platform,
    '',
    '### App version',
    '',
    fields.version,
    '',
    '### Device and OS',
    '',
    fields.device,
    '',
    '### Severity',
    '',
    fields.severity,
    '',
    '### No-Pin check',
    '',
    '- [x] I have not included exact coordinates, a map pin, GPS EXIF, or a precise sighting location.',
    '',
    '_Filed via in-app Report a bug (T9.11). Text was scrubbed for coordinates and forbidden geo keys before filing._',
  ].join('\n');
}

/** Short issue title from the (already scrubbed) actual behaviour. */
export function bugReportIssueTitle(actual: string): string {
  const compact = actual.replace(/\s+/g, ' ').trim();
  const snippet = compact.length > 72 ? `${compact.slice(0, 69)}…` : compact;
  return `bug: ${snippet.length > 0 ? snippet : 'in-app report'}`;
}

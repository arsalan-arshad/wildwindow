import { describe, expect, it } from 'vitest';

import {
  BUG_REPORT_NEW_ISSUE_BASE,
  BUG_REPORT_TEMPLATE,
  BugReportRequestSchema,
  BugReportResponseSchema,
  bugReportIssueTitle,
  buildBugReportFallbackUrl,
  formatBugReportIssueBody,
} from './bug-reports.js';

const validBase = {
  steps: '1. Open Explore\n2. Tap forecast',
  expected: 'Forecast loads',
  actual: 'Blank screen',
  platform: 'iOS' as const,
  version: '1.0.0 (1)',
  device: 'iPhone 15, iOS 18',
};

describe('BugReportRequestSchema', () => {
  it('parses a full draft and defaults severity to P2', () => {
    const parsed = BugReportRequestSchema.parse(validBase);
    expect(parsed.severity).toBe('P2');
    expect(parsed.platform).toBe('iOS');
  });

  it('accepts an explicit severity', () => {
    const parsed = BugReportRequestSchema.parse({ ...validBase, severity: 'P0' });
    expect(parsed.severity).toBe('P0');
  });

  it('rejects an empty steps field', () => {
    const result = BugReportRequestSchema.safeParse({ ...validBase, steps: '  ' });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown platform', () => {
    const result = BugReportRequestSchema.safeParse({ ...validBase, platform: 'desktop' });
    expect(result.success).toBe(false);
  });
});

describe('BugReportResponseSchema', () => {
  it('accepts filed and fallback shapes', () => {
    expect(BugReportResponseSchema.parse({ status: 'filed', issueNumber: 42 })).toEqual({
      status: 'filed',
      issueNumber: 42,
    });
    const url = `${BUG_REPORT_NEW_ISSUE_BASE}?template=${BUG_REPORT_TEMPLATE}`;
    expect(BugReportResponseSchema.parse({ status: 'fallback', url })).toEqual({
      status: 'fallback',
      url,
    });
  });
});

describe('buildBugReportFallbackUrl', () => {
  it('uses template=bug_report.yml and form field ids as query keys', () => {
    const url = buildBugReportFallbackUrl({ ...validBase, severity: 'P2' });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(BUG_REPORT_NEW_ISSUE_BASE);
    expect(parsed.searchParams.get('template')).toBe(BUG_REPORT_TEMPLATE);
    expect(parsed.searchParams.get('steps')).toBe(validBase.steps);
    expect(parsed.searchParams.get('expected')).toBe(validBase.expected);
    expect(parsed.searchParams.get('actual')).toBe(validBase.actual);
    expect(parsed.searchParams.get('platform')).toBe('iOS');
    expect(parsed.searchParams.get('version')).toBe(validBase.version);
    expect(parsed.searchParams.get('device')).toBe(validBase.device);
    expect(parsed.searchParams.get('severity')).toBe('P2');
  });
});

describe('formatBugReportIssueBody / bugReportIssueTitle', () => {
  it('includes every form section and a checked No-Pin line', () => {
    const body = formatBugReportIssueBody({ ...validBase, severity: 'P1' });
    expect(body).toContain('### Steps to reproduce');
    expect(body).toContain(validBase.steps);
    expect(body).toContain('### Platform');
    expect(body).toContain('iOS');
    expect(body).toContain('P1');
    expect(body).toMatch(/\[x\].*exact coordinates/i);
  });

  it('prefixes the title with bug:', () => {
    expect(bugReportIssueTitle('Blank screen on forecast')).toBe('bug: Blank screen on forecast');
  });
});

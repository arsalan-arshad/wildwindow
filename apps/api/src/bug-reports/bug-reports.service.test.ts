import { describe, expect, it, vi } from 'vitest';

import { type ApiEnv } from '../config/api-env.js';

import { BugReportsService } from './bug-reports.service.js';

import type { CreateGithubIssueInput, GithubIssuesClient } from './github-issues.js';

function silentLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    setContext: vi.fn(),
    assign: vi.fn(),
  };
}

function makeService(options: {
  readonly token?: string;
  readonly github?: GithubIssuesClient | null;
}): BugReportsService {
  const env = {
    NODE_ENV: 'test',
    PORT: 3001,
    WAITLIST_EMAIL_ENABLED: false,
    WATCHLIST_LIMIT_FREE: 3,
    TIDE_PROVIDER: 'none',
    ...(options.token !== undefined ? { GITHUB_BUG_REPORT_TOKEN: options.token } : {}),
  } as ApiEnv;

  const logger = silentLogger();
  return new BugReportsService(
    logger as never,
    env,
    options.github !== undefined ? options.github : undefined,
  );
}

const dirtyDraft = {
  steps: 'Stood at 55.865, -4.257 and opened Explore',
  expected: 'Forecast loads',
  actual: 'Crash; latitude: 55.1 still on screen',
  platform: 'iOS' as const,
  version: '1.0.0 (1)',
  device: 'iPhone 15, iOS 18',
  severity: 'P2' as const,
};

describe('BugReportsService (T9.11)', () => {
  it('returns a prefilled fallback URL when the token is unset', async () => {
    const service = makeService({});
    const result = await service.submit(dirtyDraft);
    expect(result.status).toBe('fallback');
    if (result.status !== 'fallback') return;
    expect(result.url).toContain('template=bug_report.yml');
    expect(result.url).not.toMatch(/55\.865/);
    expect(result.url).not.toMatch(/latitude/i);
    expect(JSON.stringify(result)).not.toMatch(/ghp_|github_pat_/i);
  });

  it('creates a GitHub issue with scrubbed text and never returns the token', async () => {
    const token = 'ghp_test_secret_token_do_not_leak';
    const captured: { current: CreateGithubIssueInput | null } = { current: null };
    const github: GithubIssuesClient = {
      createIssue: (input) => {
        captured.current = input;
        return Promise.resolve({
          number: 321,
          htmlUrl: 'https://github.com/arsalan-arshad/wildwindow/issues/321',
        });
      },
    };

    const service = makeService({ token, github });
    const result = await service.submit(dirtyDraft);

    expect(result).toEqual({ status: 'filed', issueNumber: 321 });
    const issue = captured.current;
    expect(issue).not.toBeNull();
    if (issue === null) {
      return;
    }
    expect(issue.title.startsWith('bug:')).toBe(true);
    expect(issue.labels).toEqual(['bug', 'needs-triage']);
    expect(issue.body).not.toMatch(/55\.865/);
    expect(issue.body).not.toMatch(/-4\.257/);
    expect(issue.body).not.toMatch(/latitude/i);
    expect(issue.body).not.toMatch(/55\.1/);
    expect(JSON.stringify(result)).not.toContain(token);
  });

  it('falls back to the prefilled URL when GitHub create fails', async () => {
    const github: GithubIssuesClient = {
      createIssue: () => Promise.reject(new Error('GitHub Issues API returned 502')),
    };
    const service = makeService({ token: 'ghp_x', github });
    const result = await service.submit(dirtyDraft);
    expect(result.status).toBe('fallback');
    if (result.status !== 'fallback') return;
    expect(result.url).toContain('template=bug_report.yml');
    expect(result.url).not.toMatch(/55\.865/);
  });
});

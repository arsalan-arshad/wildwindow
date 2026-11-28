import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  BUG_REPORT_GITHUB_OWNER,
  BUG_REPORT_GITHUB_REPO,
  bugReportIssueTitle,
  buildBugReportFallbackUrl,
  formatBugReportIssueBody,
  scrubBugReportFields,
  type BugReportRequest,
  type BugReportResponse,
} from '@wildwindow/shared';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { API_ENV, type ApiEnv } from '../config/api-env.js';

import { createGithubIssuesClient, type GithubIssuesClient } from './github-issues.js';

const BUG_REPORT_LABELS = ['bug', 'needs-triage'] as const;

/** Optional Nest override so tests can inject a mock GitHub client. */
export const GITHUB_ISSUES_CLIENT = Symbol('WW_GITHUB_ISSUES_CLIENT');

@Injectable()
export class BugReportsService {
  private readonly githubClient: GithubIssuesClient | null;

  constructor(
    @InjectPinoLogger(BugReportsService.name)
    private readonly logger: PinoLogger,
    @Inject(API_ENV) env: ApiEnv,
    @Optional() @Inject(GITHUB_ISSUES_CLIENT) githubOverride?: GithubIssuesClient | null,
  ) {
    if (githubOverride !== undefined) {
      this.githubClient = githubOverride;
      return;
    }

    const token = env.GITHUB_BUG_REPORT_TOKEN?.trim() ?? '';
    if (token.length === 0) {
      this.githubClient = null;
      return;
    }

    this.githubClient = createGithubIssuesClient({
      owner: BUG_REPORT_GITHUB_OWNER,
      repo: BUG_REPORT_GITHUB_REPO,
      token,
    });
  }

  async submit(body: BugReportRequest): Promise<BugReportResponse> {
    const scrubbed = scrubBugReportFields({
      steps: body.steps,
      expected: body.expected,
      actual: body.actual,
      version: body.version,
      device: body.device,
    });
    const fields = {
      ...scrubbed,
      platform: body.platform,
      severity: body.severity,
    };

    if (this.githubClient === null) {
      return {
        status: 'fallback',
        url: buildBugReportFallbackUrl(fields),
      };
    }

    try {
      const issue = await this.githubClient.createIssue({
        title: bugReportIssueTitle(fields.actual),
        body: formatBugReportIssueBody(fields),
        labels: BUG_REPORT_LABELS,
      });
      // Log the issue number only — never the body or token.
      this.logger.info({ issueNumber: issue.number }, 'bug report filed');
      return { status: 'filed', issueNumber: issue.number };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'GitHub issue create failed';
      this.logger.warn({ err: message }, 'bug report GitHub create failed; returning fallback');
      return {
        status: 'fallback',
        url: buildBugReportFallbackUrl(fields),
      };
    }
  }
}

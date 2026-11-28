import { Module, type INestApplication } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { Logger } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { apiNestOptions } from '../bootstrap.js';
import { API_ENV, type ApiEnv } from '../config/api-env.js';
import { ThrottlerExceptionFilter } from '../http/throttler-exception.filter.js';
import { ApiLoggerModule } from '../logging/logger.module.js';

import { BugReportsController } from './bug-reports.controller.js';
import { BugReportsService, GITHUB_ISSUES_CLIENT } from './bug-reports.service.js';

import type { CreateGithubIssueInput, GithubIssuesClient } from './github-issues.js';

const TOKEN = 'ghp_e2e_bug_report_token_secret';

const dirtyBody = {
  steps: 'Opened Explore at 55.865, -4.257',
  expected: 'Species list shows',
  actual: 'Blank; latitude: 55.1 flashed',
  platform: 'Android',
  version: '1.0.0 (42)',
  device: 'Pixel 8, Android 15',
  severity: 'P1',
};

function testEnv(overrides: Partial<ApiEnv> = {}): ApiEnv {
  return {
    NODE_ENV: 'test',
    PORT: 3001,
    WAITLIST_EMAIL_ENABLED: false,
    WATCHLIST_LIMIT_FREE: 3,
    TIDE_PROVIDER: 'none',
    ...overrides,
  };
}

async function bootApp(options: {
  readonly env: ApiEnv;
  readonly github: GithubIssuesClient | null;
}): Promise<INestApplication> {
  @Module({
    imports: [
      ApiLoggerModule.forRoot({ level: 'silent' }),
      ThrottlerModule.forRoot([
        {
          name: 'default',
          ttl: 60_000,
          limit: 1000,
        },
      ]),
    ],
    controllers: [BugReportsController],
    providers: [
      { provide: API_ENV, useValue: options.env },
      { provide: GITHUB_ISSUES_CLIENT, useValue: options.github },
      BugReportsService,
      { provide: APP_GUARD, useClass: ThrottlerGuard },
      { provide: APP_FILTER, useClass: ThrottlerExceptionFilter },
    ],
  })
  class BugReportsTestModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [BugReportsTestModule],
  }).compile();

  const app = moduleRef.createNestApplication(apiNestOptions());
  app.useLogger(app.get(Logger));
  await app.init();
  return app;
}

describe('POST /v1/bug-reports (T9.11)', () => {
  describe('without GitHub client (token unset path)', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await bootApp({
        env: testEnv(),
        github: null,
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('returns a scrubbed prefilled GitHub URL and never a token', async () => {
      const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
      const response = await request(httpServer)
        .post('/v1/bug-reports')
        .send(dirtyBody)
        .expect(200);

      expect(response.body).toMatchObject({ status: 'fallback' });
      const url = (response.body as { url: string }).url;
      expect(url).toContain('https://github.com/arsalan-arshad/wildwindow/issues/new');
      expect(url).toContain('template=bug_report.yml');
      expect(url).not.toMatch(/55\.865/);
      expect(url).not.toMatch(/-4\.257/);
      expect(url).not.toMatch(/latitude/i);
      expect(JSON.stringify(response.body)).not.toContain(TOKEN);
      expect(JSON.stringify(response.body)).not.toMatch(/ghp_/);
    });
  });

  describe('with mocked GitHub Issues client', () => {
    let app: INestApplication;
    const captured: { current: CreateGithubIssueInput | null } = { current: null };

    beforeAll(async () => {
      captured.current = null;
      const github: GithubIssuesClient = {
        createIssue: (input) => {
          captured.current = input;
          return Promise.resolve({
            number: 777,
            htmlUrl: 'https://github.com/arsalan-arshad/wildwindow/issues/777',
          });
        },
      };

      app = await bootApp({
        env: testEnv({ GITHUB_BUG_REPORT_TOKEN: TOKEN }),
        github,
      });
    });

    afterAll(async () => {
      await app.close();
    });

    it('opens a GitHub issue with scrubbed payload and no token in the HTTP response', async () => {
      const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
      const response = await request(httpServer)
        .post('/v1/bug-reports')
        .send(dirtyBody)
        .expect(200);

      expect(response.body).toEqual({ status: 'filed', issueNumber: 777 });
      expect(JSON.stringify(response.body)).not.toContain(TOKEN);

      const issue = captured.current;
      expect(issue).not.toBeNull();
      if (issue === null) {
        return;
      }
      expect(issue.labels).toEqual(['bug', 'needs-triage']);
      expect(issue.title.startsWith('bug:')).toBe(true);
      expect(issue.body).not.toMatch(/55\.865/);
      expect(issue.body).not.toMatch(/-4\.257/);
      expect(issue.body).not.toMatch(/latitude/i);
      expect(issue.body).not.toMatch(/55\.1/);
      expect(issue.body).toContain('### Steps to reproduce');
      expect(issue.body).toMatch(/\[x\].*exact coordinates/i);
    });
  });

  describe('validation', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await bootApp({ env: testEnv(), github: null });
    });

    afterAll(async () => {
      await app.close();
    });

    it('rejects an empty draft with VALIDATION_ERROR', async () => {
      const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
      const response = await request(httpServer)
        .post('/v1/bug-reports')
        .send({ steps: '', expected: 'x', actual: 'y', platform: 'web', version: '1', device: 'x' })
        .expect(400);
      expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });
});

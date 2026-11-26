import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_PENDING_ENTRY,
  FIXTURE_REJECTED_ENTRY,
} from '@/__fixtures__/admin-moderation';
import { createMockAuthClient, MOCK_ADMIN_USER } from '@/__fixtures__/admin-auth';
import { ModerationQueue } from '@/components/admin/moderation-queue';
import { AuthProvider } from '@/lib/auth/auth-context';
import { createApiClient } from '@wildwindow/shared/client';

const server = setupServer();

describe('ModerationQueue (T7.7 acceptance)', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('lists pending entries and approves via the API', async () => {
    const user = userEvent.setup();
    let patchBody: unknown;
    let listCalls = 0;

    server.use(
      http.get('http://api.test/v1/admin/session', () =>
        HttpResponse.json({
          ok: true,
          role: 'admin',
          userId: '11111111-1111-4111-8111-111111111111',
        }),
      ),
      http.get('http://api.test/v1/admin/challenge-entries', ({ request }) => {
        listCalls += 1;
        const url = new URL(request.url);
        expect(url.searchParams.get('status')).toBe('pending');
        expect(request.headers.get('authorization')).toBe('Bearer mock-id-token');
        return HttpResponse.json({ entries: [FIXTURE_PENDING_ENTRY] });
      }),
      http.patch('http://api.test/v1/admin/challenge-entries/101', async ({ request }) => {
        patchBody = await request.json();
        expect(request.headers.get('authorization')).toBe('Bearer mock-id-token');
        return HttpResponse.json({
          ...FIXTURE_PENDING_ENTRY,
          status: 'approved',
          rejectReason: null,
        });
      }),
    );

    const apiClient = createApiClient({
      baseUrl: 'http://api.test',
      getToken: () => 'mock-id-token',
      fetch,
    });

    render(
      <AuthProvider
        authClient={createMockAuthClient({ initialUser: MOCK_ADMIN_USER })}
        apiBaseUrl="http://api.test"
      >
        <ModerationQueue apiClient={apiClient} />
      </AuthProvider>,
    );

    const row = await screen.findByTestId('moderation-entry-101');
    expect(row).toHaveTextContent('kingfisher-month');
    expect(row).toHaveTextContent('GB · Scotland');
    expect(row).toHaveTextContent('challenges/kingfisher-month/entry-101.jpg');
    expect(row).not.toHaveTextContent(/lat|lng|coordinate/i);

    await user.click(within(row).getByRole('button', { name: /^approve$/i }));

    await waitFor(() => {
      expect(patchBody).toMatchObject({ status: 'approved' });
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/approved entry 101/i);
    expect(listCalls).toBeGreaterThanOrEqual(1);
  });

  it('rejects with a required reason', async () => {
    const user = userEvent.setup();
    let patchBody: unknown;

    server.use(
      http.get('http://api.test/v1/admin/session', () =>
        HttpResponse.json({
          ok: true,
          role: 'admin',
          userId: '11111111-1111-4111-8111-111111111111',
        }),
      ),
      http.get('http://api.test/v1/admin/challenge-entries', () =>
        HttpResponse.json({ entries: [FIXTURE_PENDING_ENTRY] }),
      ),
      http.patch('http://api.test/v1/admin/challenge-entries/101', async ({ request }) => {
        patchBody = await request.json();
        return HttpResponse.json({
          ...FIXTURE_PENDING_ENTRY,
          status: 'rejected',
          rejectReason: 'Blurry and off-species.',
        });
      }),
    );

    const apiClient = createApiClient({
      baseUrl: 'http://api.test',
      getToken: () => 'mock-id-token',
      fetch,
    });

    render(
      <AuthProvider
        authClient={createMockAuthClient({ initialUser: MOCK_ADMIN_USER })}
        apiBaseUrl="http://api.test"
      >
        <ModerationQueue apiClient={apiClient} />
      </AuthProvider>,
    );

    const row = await screen.findByTestId('moderation-entry-101');
    await user.click(within(row).getByRole('button', { name: /^reject$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/reject reason is required/i);
    expect(patchBody).toBeUndefined();

    await user.type(
      within(row).getByLabelText(/reject reason for entry 101/i),
      'Blurry and off-species.',
    );
    await user.click(within(row).getByRole('button', { name: /^reject$/i }));

    await waitFor(() => {
      expect(patchBody).toEqual({
        status: 'rejected',
        rejectReason: 'Blurry and off-species.',
      });
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/rejected entry 101/i);
  });

  it('filters by status using the query string', async () => {
    const user = userEvent.setup();
    const statuses: string[] = [];

    server.use(
      http.get('http://api.test/v1/admin/session', () =>
        HttpResponse.json({
          ok: true,
          role: 'admin',
          userId: '11111111-1111-4111-8111-111111111111',
        }),
      ),
      http.get('http://api.test/v1/admin/challenge-entries', ({ request }) => {
        const url = new URL(request.url);
        const status = url.searchParams.get('status');
        statuses.push(status ?? 'all');
        if (status === 'approved') {
          return HttpResponse.json({ entries: [FIXTURE_APPROVED_ENTRY] });
        }
        if (status === 'rejected') {
          return HttpResponse.json({ entries: [FIXTURE_REJECTED_ENTRY] });
        }
        if (status === null) {
          return HttpResponse.json({
            entries: [FIXTURE_PENDING_ENTRY, FIXTURE_APPROVED_ENTRY, FIXTURE_REJECTED_ENTRY],
          });
        }
        return HttpResponse.json({ entries: [FIXTURE_PENDING_ENTRY] });
      }),
    );

    const apiClient = createApiClient({
      baseUrl: 'http://api.test',
      getToken: () => 'mock-id-token',
      fetch,
    });

    render(
      <AuthProvider
        authClient={createMockAuthClient({ initialUser: MOCK_ADMIN_USER })}
        apiBaseUrl="http://api.test"
      >
        <ModerationQueue apiClient={apiClient} />
      </AuthProvider>,
    );

    await screen.findByTestId('moderation-entry-101');

    await user.selectOptions(screen.getByLabelText(/filter by moderation status/i), 'approved');
    expect(await screen.findByTestId('moderation-entry-102')).toHaveTextContent('approved');

    await user.selectOptions(screen.getByLabelText(/filter by moderation status/i), 'all');
    await waitFor(() => {
      expect(screen.getByTestId('moderation-list').querySelectorAll('li')).toHaveLength(3);
    });

    expect(statuses).toContain('pending');
    expect(statuses).toContain('approved');
    expect(statuses).toContain('all');
  });
});

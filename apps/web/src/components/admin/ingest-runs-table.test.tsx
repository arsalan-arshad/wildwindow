import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FIXTURE_INGEST_RUNS } from '@/__fixtures__/admin-moderation';
import { createMockAuthClient, MOCK_ADMIN_USER } from '@/__fixtures__/admin-auth';
import { IngestRunsTable } from '@/components/admin/ingest-runs-table';
import { AuthProvider } from '@/lib/auth/auth-context';
import { createApiClient } from '@wildwindow/shared/client';

const server = setupServer();

describe('IngestRunsTable (T7.7 acceptance)', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('loads ingestion runs into a table from fixtures', async () => {
    const user = userEvent.setup();
    let listCalls = 0;

    server.use(
      http.get('http://api.test/v1/admin/session', () =>
        HttpResponse.json({
          ok: true,
          role: 'admin',
          userId: '11111111-1111-4111-8111-111111111111',
        }),
      ),
      http.get('http://api.test/v1/admin/ingest-runs', ({ request }) => {
        listCalls += 1;
        expect(request.headers.get('authorization')).toBe('Bearer mock-id-token');
        return HttpResponse.json({ runs: FIXTURE_INGEST_RUNS });
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
        <IngestRunsTable apiClient={apiClient} />
      </AuthProvider>,
    );

    const table = await screen.findByTestId('ingest-runs-table');
    expect(table).toHaveTextContent('scotland');
    expect(table).toHaveTextContent('sindh');
    expect(table).toHaveTextContent('succeeded');
    expect(table).toHaveTextContent('requested');
    expect(table).toHaveTextContent('failed');
    expect(table).toHaveTextContent('10.15468/dl.example1');
    expect(table).toHaveTextContent('1100');
    expect(table).not.toHaveTextContent(/lat|lng|POINT|coordinate/i);

    const run7 = screen.getByTestId('ingest-run-7');
    expect(run7).toHaveTextContent('target');
    expect(run7).toHaveTextContent('0001234-abcdef');

    await user.click(screen.getByRole('button', { name: /^refresh$/i }));
    await waitFor(() => {
      expect(listCalls).toBe(2);
    });
    expect(await screen.findByRole('status')).toHaveTextContent(/loaded 3 runs/i);
  });

  it('shows an empty state when there are no runs', async () => {
    server.use(
      http.get('http://api.test/v1/admin/session', () =>
        HttpResponse.json({
          ok: true,
          role: 'admin',
          userId: '11111111-1111-4111-8111-111111111111',
        }),
      ),
      http.get('http://api.test/v1/admin/ingest-runs', () => HttpResponse.json({ runs: [] })),
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
        <IngestRunsTable apiClient={apiClient} />
      </AuthProvider>,
    );

    expect(await screen.findByTestId('ingest-runs-empty')).toHaveTextContent(/no runs/i);
  });
});

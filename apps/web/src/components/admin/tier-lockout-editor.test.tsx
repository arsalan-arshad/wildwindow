import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { TierLockoutEditor } from '@/components/admin/tier-lockout-editor';
import { createMockAuthClient, MOCK_ADMIN_USER } from '@/__fixtures__/admin-auth';
import { AuthProvider } from '@/lib/auth/auth-context';
import { createApiClient } from '@wildwindow/shared/client';

const server = setupServer();

const BEFORE = {
  taxonId: '2433409',
  regionSlug: 'scotland' as const,
  tier: 'protected' as const,
  lockoutMonths: [3, 4],
  reviewer: 'Reviewer',
  reviewedAt: '2026-01-01T00:00:00.000Z',
};

const AFTER = {
  ...BEFORE,
  tier: 'highly_protected' as const,
  lockoutMonths: [3, 4, 5],
  reviewer: 'admin@example.com',
  reviewedAt: '2026-11-26T12:00:00.000Z',
};

describe('TierLockoutEditor (T7.6 acceptance)', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('editing a tier calls the API and shows the audit entry', async () => {
    const user = userEvent.setup();
    let patchBody: unknown;
    let patchCalled = false;

    server.use(
      http.get('http://api.test/v1/admin/session', () =>
        HttpResponse.json({
          ok: true,
          role: 'admin',
          userId: '11111111-1111-4111-8111-111111111111',
        }),
      ),
      http.get('http://api.test/v1/admin/taxon-region/2433409/scotland', () =>
        HttpResponse.json(BEFORE),
      ),
      http.patch('http://api.test/v1/admin/taxon-region/2433409/scotland', async ({ request }) => {
        patchCalled = true;
        patchBody = await request.json();
        expect(request.headers.get('authorization')).toBe('Bearer mock-id-token');
        return HttpResponse.json(AFTER);
      }),
    );

    const apiClient = createApiClient({
      baseUrl: 'http://api.test',
      getToken: () => 'mock-id-token',
      fetch,
    });

    const confirmFn = vi.fn(() => true);

    render(
      <AuthProvider
        authClient={createMockAuthClient({ initialUser: MOCK_ADMIN_USER })}
        apiBaseUrl="http://api.test"
      >
        <TierLockoutEditor apiClient={apiClient} confirmFn={confirmFn} />
      </AuthProvider>,
    );

    await user.type(screen.getByPlaceholderText(/e\.g\. 2433409/i), '2433409');
    await user.click(screen.getByRole('button', { name: /^load$/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/loaded tier protected/i);

    await user.selectOptions(screen.getByDisplayValue('protected'), 'highly_protected');
    await user.click(screen.getByRole('checkbox', { name: /may/i }));
    await user.click(screen.getByRole('button', { name: /save tier/i }));

    await waitFor(() => {
      expect(patchCalled).toBe(true);
    });
    expect(confirmFn).toHaveBeenCalled();
    expect(patchBody).toMatchObject({
      tier: 'highly_protected',
      lockoutMonths: [3, 4, 5],
    });

    const audit = await screen.findByTestId('tier-audit-entry');
    expect(audit).toHaveTextContent('taxon_region.update');
    expect(audit).toHaveTextContent('2433409:scotland');
    expect(audit).toHaveTextContent(/before:.*tier=protected/i);
    expect(audit).toHaveTextContent(/after:.*tier=highly_protected/i);
    expect(audit).toHaveTextContent(/lockout=\[3, 4, 5\]/);
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminGate } from '@/components/admin/admin-gate';
import { createMockAuthClient, MOCK_USER } from '@/__fixtures__/admin-auth';
import { AuthProvider } from '@/lib/auth/auth-context';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace,
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

const server = setupServer();

describe('AdminGate (T7.6 acceptance)', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    replace.mockClear();
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  it('redirects a signed-in non-admin away from admin tools', async () => {
    server.use(
      http.get('http://api.test/v1/admin/session', () =>
        HttpResponse.json({ code: 'FORBIDDEN', message: 'Admin role required' }, { status: 403 }),
      ),
    );

    render(
      <AuthProvider
        authClient={createMockAuthClient({ initialUser: MOCK_USER })}
        apiBaseUrl="http://api.test"
      >
        <AdminGate forbiddenRedirectTo="/">
          <p>Secret admin tools</p>
        </AdminGate>
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/');
    });
    expect(screen.queryByText('Secret admin tools')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/admin role required/i);
  });

  it('shows sign-in when signed out', async () => {
    render(
      <AuthProvider
        authClient={createMockAuthClient({ initialUser: null })}
        apiBaseUrl="http://api.test"
      >
        <AdminGate>
          <p>Secret admin tools</p>
        </AdminGate>
      </AuthProvider>,
    );

    expect(await screen.findByRole('heading', { name: /admin sign-in/i })).toBeInTheDocument();
    expect(screen.queryByText('Secret admin tools')).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

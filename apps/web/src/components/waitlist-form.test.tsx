import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { WaitlistForm } from './waitlist-form';

const server = setupServer();

describe('WaitlistForm', () => {
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
  });

  afterEach(() => {
    server.resetHandlers();
    vi.unstubAllEnvs();
  });

  afterAll(() => {
    server.close();
  });

  it('links the privacy checkbox to /privacy', () => {
    render(<WaitlistForm />);
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute(
      'href',
      '/privacy',
    );
  });

  it('shows validation when consent is missing', async () => {
    const user = userEvent.setup();
    render(<WaitlistForm />);

    await user.type(screen.getByRole('textbox', { name: /^email$/i }), 'ok@example.com');
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('submits successfully against a mocked API', async () => {
    const user = userEvent.setup();
    let sawBody: unknown;
    server.use(
      http.post('http://api.test/v1/waitlist', async ({ request }) => {
        sawBody = await request.json();
        return HttpResponse.json({ ok: true });
      }),
    );

    render(<WaitlistForm source="landing" />);

    await user.type(screen.getByRole('textbox', { name: /^email$/i }), 'photographer@example.com');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /join the waitlist/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/you’re on the list/i);
    await waitFor(() => {
      expect(sawBody).toMatchObject({
        email: 'photographer@example.com',
        consent: true,
        source: 'landing',
      });
    });
  });
});

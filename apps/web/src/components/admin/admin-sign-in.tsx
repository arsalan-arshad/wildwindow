'use client';

import { useState, type FormEvent } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { AuthClientError } from '@/lib/auth/types';
import { authErrorMessage } from '@/lib/auth/map-firebase-error';

export function AdminSignIn() {
  const { authConfigured, signInWithEmailPassword } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email') ?? '');
    const password = String(data.get('password') ?? '');

    setBusy(true);
    try {
      await signInWithEmailPassword(email, password);
    } catch (err: unknown) {
      const code = err instanceof AuthClientError ? err.code : 'unknown';
      setError(authErrorMessage(code));
    } finally {
      setBusy(false);
    }
  }

  if (!authConfigured) {
    return (
      <div className="rounded-lg border border-gold-soft bg-gold-soft/40 p-6 text-ink">
        <h2 className="font-display text-xl">Firebase not configured</h2>
        <p className="mt-2 text-ink-muted">
          Set <code className="text-sm">NEXT_PUBLIC_FIREBASE_CONFIG</code> (JSON: apiKey,
          authDomain, projectId, appId) as a build-time variable on the web service, then rebuild.
          Admin role still comes from the API database (
          <code className="text-sm">pnpm worker make-admin &lt;email&gt;</code>).
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        void onSubmit(e);
      }}
      className="mx-auto max-w-md space-y-4 rounded-lg border border-forest-800/15 bg-mist/40 p-6"
      noValidate
    >
      <h2 className="font-display text-2xl text-ink">Admin sign-in</h2>
      <p className="text-sm text-ink-muted">
        Firebase identity only. The admin role is checked through the API.
      </p>
      <label className="block text-sm">
        <span className="text-ink-muted">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded border border-forest-800/20 bg-paper px-3 py-2 text-ink"
        />
      </label>
      <label className="block text-sm">
        <span className="text-ink-muted">Password</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded border border-forest-800/20 bg-paper px-3 py-2 text-ink"
        />
      </label>
      {error !== null ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-forest-800 px-4 py-2 font-medium text-mist disabled:opacity-60"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

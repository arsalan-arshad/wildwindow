'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { AdminSignIn } from '@/components/admin/admin-sign-in';
import { useAuth } from '@/lib/auth/auth-context';

export type AdminGateProps = {
  readonly children: ReactNode;
  /** Where to send signed-in non-admins (acceptance: redirected). */
  readonly forbiddenRedirectTo?: string;
};

/**
 * Requires Firebase sign-in + API admin role.
 * Non-admins are redirected away from admin tools.
 */
export function AdminGate({ children, forbiddenRedirectTo = '/' }: AdminGateProps) {
  const { adminAccess, signOut, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (adminAccess === 'forbidden') {
      router.replace(forbiddenRedirectTo);
    }
  }, [adminAccess, forbiddenRedirectTo, router]);

  if (adminAccess === 'loading') {
    return (
      <p className="text-ink-muted" role="status">
        Checking admin access…
      </p>
    );
  }

  if (adminAccess === 'unavailable') {
    return <AdminSignIn />;
  }

  if (adminAccess === 'signed_out') {
    return <AdminSignIn />;
  }

  if (adminAccess === 'forbidden') {
    return (
      <p className="text-ink-muted" role="status">
        Redirecting — admin role required…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-forest-800/10 pb-4">
        <p className="text-sm text-ink-muted">
          Signed in as {user?.email ?? user?.displayName ?? 'admin'}
        </p>
        <button
          type="button"
          onClick={() => {
            void signOut();
          }}
          className="text-sm text-forest-600 underline-offset-2 hover:underline"
        >
          Sign out
        </button>
      </div>
      {children}
    </div>
  );
}

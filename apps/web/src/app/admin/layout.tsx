import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/lib/auth/auth-context';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { readonly children: ReactNode }) {
  return (
    <AuthProvider>
      <main className="mx-auto min-h-[70vh] max-w-5xl px-4 py-10 sm:px-6">{children}</main>
    </AuthProvider>
  );
}

'use client';

import Link from 'next/link';

import { AdminGate } from '@/components/admin/admin-gate';
import { SpeciesCardEditor } from '@/components/admin/species-card-editor';
import { TierLockoutEditor } from '@/components/admin/tier-lockout-editor';

export type AdminHubProps = {
  readonly forbiddenRedirectTo?: string;
};

export function AdminHub({ forbiddenRedirectTo = '/' }: AdminHubProps) {
  return (
    <AdminGate forbiddenRedirectTo={forbiddenRedirectTo}>
      <nav aria-label="Admin sections" className="flex flex-wrap gap-4 text-sm">
        <a
          href="#card-editor-heading"
          className="text-forest-600 underline-offset-2 hover:underline"
        >
          Species cards
        </a>
        <a
          href="#tier-editor-heading"
          className="text-forest-600 underline-offset-2 hover:underline"
        >
          Tiers and lockouts
        </a>
        <Link href="/" className="text-ink-muted underline-offset-2 hover:underline">
          Back to site
        </Link>
      </nav>
      <SpeciesCardEditor />
      <TierLockoutEditor />
      <p className="text-xs text-ink-muted">Moderation queue and ingestion runs land in T7.7.</p>
    </AdminGate>
  );
}

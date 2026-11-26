'use client';

import Link from 'next/link';

import { AdminGate } from '@/components/admin/admin-gate';
import { IngestRunsTable } from '@/components/admin/ingest-runs-table';
import { ModerationQueue } from '@/components/admin/moderation-queue';
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
        <a
          href="#moderation-queue-heading"
          className="text-forest-600 underline-offset-2 hover:underline"
        >
          Moderation
        </a>
        <a
          href="#ingest-runs-heading"
          className="text-forest-600 underline-offset-2 hover:underline"
        >
          Ingestion runs
        </a>
        <Link href="/" className="text-ink-muted underline-offset-2 hover:underline">
          Back to site
        </Link>
      </nav>
      <SpeciesCardEditor />
      <TierLockoutEditor />
      <ModerationQueue />
      <IngestRunsTable />
    </AdminGate>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

import { AttributionsLoader } from '@/components/attributions-loader';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Attributions',
  description:
    'Dataset DOIs, licences, and provider credits for WildWindow wildlife photo forecasts.',
};

export default function AttributionsPage() {
  return (
    <main className="bg-paper">
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-14 sm:px-8">
        <h1 className="font-[family-name:var(--font-fraunces)] text-4xl text-forest-800 sm:text-5xl">
          Attributions
        </h1>
        <p className="mt-4 text-ink-muted">
          Credits for the data and libraries behind Window scores. Licence rules are in the{' '}
          <Link
            href="/terms"
            className="font-medium text-forest-600 underline-offset-2 hover:underline"
          >
            terms of use
          </Link>{' '}
          draft.
        </p>
        <div className="mt-10">
          <AttributionsLoader />
        </div>
      </div>
    </main>
  );
}

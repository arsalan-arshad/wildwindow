import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDraftBanner } from '@/components/legal-draft-banner';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'WildWindow terms of use (draft — needs legal review).',
};

export default function TermsPage() {
  return (
    <main className="bg-paper">
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-14 sm:px-8">
        <LegalDraftBanner />

        <h1 className="mt-8 font-[family-name:var(--font-fraunces)] text-4xl text-forest-800 sm:text-5xl">
          Terms of use
        </h1>
        <p className="mt-4 text-ink-muted">
          Last updated: 26 November 2026 (Asia/Karachi). This draft covers the WildWindow marketing
          site, waitlist, and planned beta product. It is not legal advice.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Acceptance</h2>
          <p className="text-ink-muted">
            By using this site or joining the waitlist you agree to these draft terms. If you do not
            agree, do not use the service. A reviewed version will replace this draft before a
            public store release.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            What WildWindow is
          </h2>
          <p className="text-ink-muted">
            WildWindow provides wildlife photo planning tools: a weekly Window score (a relative
            index from 0–100, never a “% chance”), field cards, and related features for beta
            regions (Scotland and Sindh). The score is informational only — it is not a guarantee of
            sightings and is not professional wildlife or legal advice.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            No-Pin Promise and field ethics
          </h2>
          <p className="text-ink-muted">
            You must not use WildWindow to locate, harass, or disturb wildlife beyond lawful and
            ethical practice. The product never exposes exact pins for wild animals; see the{' '}
            <Link
              href="/no-pin"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              No-Pin Promise
            </Link>
            . Follow regional law (for example NatureScot licences for Schedule 1 nest photography
            in Scotland) and leave nests alone.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Age</h2>
          <p className="text-ink-muted">
            You must be 13 or older to join the waitlist or use the product. Nothing in the MVP is
            aimed at children.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Accounts</h2>
          <p className="text-ink-muted">
            When accounts are available, you are responsible for credentials and for content you
            submit (for example logbook photos). Do not upload unlawful content. Photo GPS EXIF is
            stripped before upload; you still must not share exact sensitive locations through text
            or images.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            Data licences
          </h2>
          <p className="text-ink-muted">
            Occurrence data, weather, tides, and place names come from third parties under their
            licences. Credits live on the{' '}
            <Link
              href="/attributions"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              attributions
            </Link>{' '}
            page. You must not scrape or re-use those datasets through WildWindow in ways their
            licences forbid.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            Availability and disclaimer
          </h2>
          <p className="text-ink-muted">
            The beta may change, pause, or stop without notice. The service is provided “as is”
            without warranties of accuracy, fitness, or uninterrupted access, to the fullest extent
            permitted by law. Nothing here limits rights that cannot be waived under applicable
            consumer law.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Privacy</h2>
          <p className="text-ink-muted">
            How we handle personal data is described in the draft{' '}
            <Link
              href="/privacy"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              privacy policy
            </Link>
            .
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Contact</h2>
          <p className="text-ink-muted">
            Questions:{' '}
            <a
              href="mailto:contact@arsalandev.studio"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              contact@arsalandev.studio
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

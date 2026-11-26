import type { Metadata } from 'next';
import Link from 'next/link';

import { LegalDraftBanner } from '@/components/legal-draft-banner';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'WildWindow privacy policy (draft — needs legal review).',
};

export default function PrivacyPage() {
  return (
    <main className="bg-paper">
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-14 sm:px-8">
        <LegalDraftBanner />

        <h1 className="mt-8 font-[family-name:var(--font-fraunces)] text-4xl text-forest-800 sm:text-5xl">
          Privacy policy
        </h1>
        <p className="mt-4 text-ink-muted">
          Last updated: 26 November 2026 (Asia/Karachi). This draft describes how WildWindow handles
          personal data on the marketing site, waitlist, and planned beta product. It is not legal
          advice.
        </p>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Who we are</h2>
          <p className="text-ink-muted">
            WildWindow is a wildlife photo forecast product (working name) built by Arsalan Arshad.
            Contact the controller at{' '}
            <a
              href="mailto:contact@arsalandev.studio"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              contact@arsalandev.studio
            </a>
            .
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            Waitlist data we collect
          </h2>
          <p className="text-ink-muted">When you join the waitlist we may store:</p>
          <ul className="list-disc space-y-1 pl-5 text-ink-muted">
            <li>Email address (required)</li>
            <li>Name (optional)</li>
            <li>Region preference (Scotland, Sindh, both, or other)</li>
            <li>Role and platform interest</li>
            <li>Favourite species free text (optional)</li>
            <li>Consent timestamp and signup source</li>
            <li>Created-at timestamp</li>
          </ul>
          <p className="text-ink-muted">
            We do not ask for precise location on this marketing surface. The product never needs an
            exact pin — see the{' '}
            <Link
              href="/no-pin"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              No-Pin Promise
            </Link>
            .
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            Product data (beta)
          </h2>
          <p className="text-ink-muted">When you use the signed-in app we may process:</p>
          <ul className="list-disc space-y-1 pl-5 text-ink-muted">
            <li>Account identifiers from the sign-in provider (for example Firebase Auth)</li>
            <li>Profile settings (region, units, language)</li>
            <li>Watchlist species and area pairs (areas as coarse cells, not exact pins)</li>
            <li>Logbook entries you create (photos with GPS EXIF stripped; locations private)</li>
            <li>
              Challenge entries derived from your logbook (country and region only in public views)
            </li>
          </ul>
          <p className="text-ink-muted">
            Your device location, if you use “my location”, is snapped to a coarse area cell on the
            device. Raw coordinates are not sent to analytics or third parties. Weather and tide
            calls use cell centres, not your exact position.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Purpose</h2>
          <p className="text-ink-muted">
            We use waitlist data to invite you to the Scotland and Sindh beta and to send product
            updates about WildWindow. Account and logbook data power the product features you ask
            for. We do not sell personal data. This marketing surface does not load advertising
            SDKs. Product analytics, when enabled, are first-party or privacy-focused and must not
            include location properties.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Retention</h2>
          <p className="text-ink-muted">
            We keep waitlist rows while the beta programme is active and for a short period after so
            we can manage invites. Account data is kept while your account exists. Exact retention
            windows will be confirmed after legal review — ask us anytime to delete your email or
            account sooner.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            Deletion and export
          </h2>
          <p className="text-ink-muted">
            Email{' '}
            <a
              href="mailto:contact@arsalandev.studio"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              contact@arsalandev.studio
            </a>{' '}
            from the address you used to join and ask us to remove your waitlist entry. In the app,
            account deletion and data export are planned product features (App Store and UK GDPR).
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Age</h2>
          <p className="text-ink-muted">
            The waitlist and product are intended for people aged 13 and over. If you believe a
            younger person signed up, contact us and we will delete the record.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            UK GDPR and related notes
          </h2>
          <p className="text-ink-muted">
            Depending on where you live, you may have rights to access, correct, or erase personal
            data, and to object to certain processing. This draft will be expanded with lawful bases
            and transfer details after legal review. Beta infrastructure currently runs on Railway
            (US) with a public site for Scotland and Sindh audiences.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            Location protection
          </h2>
          <p className="text-ink-muted">
            WildWindow’s product design snaps user locations to coarse area cells on device and
            never exposes exact coordinates for wildlife in public outputs. Location-protection code
            lives in open source at{' '}
            <a
              href="https://github.com/arsalan-arshad/wildwindow/tree/main/packages/geoprivacy"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
              rel="noopener noreferrer"
            >
              packages/geoprivacy
            </a>
            . Read the public{' '}
            <Link
              href="/no-pin"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              No-Pin Promise
            </Link>{' '}
            page for tiers, delays, and lockouts in plain words.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            Related pages
          </h2>
          <p className="text-ink-muted">
            <Link
              href="/terms"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              Terms of use
            </Link>
            {' · '}
            <Link
              href="/attributions"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              Attributions
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}

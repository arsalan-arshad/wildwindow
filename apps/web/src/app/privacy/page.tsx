import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'WildWindow privacy policy (draft — needs legal review).',
};

export default function PrivacyPage() {
  return (
    <main className="bg-paper">
      <div className="mx-auto max-w-3xl px-5 pb-20 pt-14 sm:px-8">
        <p
          role="status"
          className="rounded-md border border-gold/40 bg-gold-soft px-3 py-2 text-sm font-semibold text-forest-950"
        >
          DRAFT – needs legal review
        </p>

        <h1 className="mt-8 font-[family-name:var(--font-fraunces)] text-4xl text-forest-800 sm:text-5xl">
          Privacy policy
        </h1>
        <p className="mt-4 text-ink-muted">
          Last updated: 25 November 2026 (Asia/Karachi). This draft describes how the WildWindow
          marketing site and waitlist handle personal data. It is not legal advice.
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
              href="/#no-pin"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              No-Pin Promise
            </Link>
            .
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Purpose</h2>
          <p className="text-ink-muted">
            We use waitlist data to invite you to the Scotland and Sindh beta and to send product
            updates about WildWindow. We do not sell waitlist data. This marketing surface does not
            load advertising SDKs.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Retention</h2>
          <p className="text-ink-muted">
            We keep waitlist rows while the beta programme is active and for a short period after so
            we can manage invites. Exact retention windows will be confirmed after legal review —
            ask us anytime to delete your email sooner.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">
            Deletion requests
          </h2>
          <p className="text-ink-muted">
            Email{' '}
            <a
              href="mailto:contact@arsalandev.studio"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              contact@arsalandev.studio
            </a>{' '}
            from the address you used to join and ask us to remove your waitlist entry.
          </p>
        </section>

        <section className="mt-10 space-y-4">
          <h2 className="font-[family-name:var(--font-fraunces)] text-2xl text-ink">Age</h2>
          <p className="text-ink-muted">
            The waitlist is intended for people aged 13 and over. If you believe a younger person
            signed up, contact us and we will delete the record.
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
            .
          </p>
        </section>
      </div>
    </main>
  );
}

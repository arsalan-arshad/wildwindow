import Link from 'next/link';

import type {
  ChallengeEntriesQuery,
  ChallengeEntriesResponse,
  ChallengeResponse,
} from '@wildwindow/shared/api';

import { ChallengeGallery } from '@/components/challenge-gallery';
import { MarkdownBody } from '@/components/markdown-body';
import {
  challengeStatusLabel,
  countryDisplayName,
  formatChallengeDateRange,
  totalCountryCount,
} from '@/lib/challenge';

export type ChallengePageViewProps = {
  readonly challenge: ChallengeResponse;
  /** Injected for component tests; omitted in production (browser client). */
  readonly loadEntries?: (
    slug: string,
    query: ChallengeEntriesQuery,
  ) => Promise<ChallengeEntriesResponse>;
};

/**
 * Public challenge page shell (W-04): title, dates, rules, per-country counts, gallery.
 * Public place fields are country + region only (No-Pin).
 */
export function ChallengePageView({ challenge, loadEntries }: ChallengePageViewProps) {
  const dateRange = formatChallengeDateRange(challenge.startsOn, challenge.endsOn);
  const total = totalCountryCount(challenge.countryCounts);

  return (
    <main className="bg-paper" data-testid="challenge-page">
      <div className="border-b border-forest-800/10 bg-[linear-gradient(180deg,var(--color-mist),var(--color-paper))]">
        <div className="mx-auto max-w-3xl px-5 pb-12 pt-14 sm:px-8">
          <p className="text-sm font-medium uppercase tracking-wide text-forest-600">
            Same species, different countries
          </p>
          <h1
            className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-forest-800 sm:text-5xl"
            data-testid="challenge-page-title"
          >
            {challenge.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
            <span
              className="rounded-md bg-gold-soft px-2.5 py-1 font-semibold text-forest-800"
              data-testid="challenge-page-status"
            >
              {challengeStatusLabel(challenge.status)}
            </span>
            <span data-testid="challenge-page-dates">{dateRange}</span>
            <span data-testid="challenge-page-total">
              {String(total)} {total === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-muted">
            Entries show country and region only. WildWindow never publishes a pin — see the{' '}
            <Link
              href="/no-pin"
              className="font-medium text-forest-600 underline-offset-2 hover:underline"
            >
              No-Pin Promise
            </Link>
            .
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col gap-14 px-5 py-14 sm:px-8">
        <section aria-labelledby="challenge-counts-heading" data-testid="challenge-country-counts">
          <h2
            id="challenge-counts-heading"
            className="font-[family-name:var(--font-fraunces)] text-2xl text-forest-800"
          >
            Entries by country
          </h2>
          {challenge.countryCounts.length === 0 ? (
            <p className="mt-3 text-ink-muted">No published entries yet.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {challenge.countryCounts.map((row) => (
                <li
                  key={row.countryCode}
                  data-testid={`challenge-count-${row.countryCode}`}
                  className="flex items-baseline justify-between border-b border-forest-800/10 pb-2"
                >
                  <span className="font-medium text-ink">
                    {countryDisplayName(row.countryCode)}
                  </span>
                  <span className="text-ink-muted">{String(row.count)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="challenge-rules-heading">
          <h2
            id="challenge-rules-heading"
            className="mb-4 font-[family-name:var(--font-fraunces)] text-2xl text-forest-800"
          >
            Rules
          </h2>
          <MarkdownBody source={challenge.rulesMd} testId="challenge-rules" />
        </section>

        <ChallengeGallery
          slug={challenge.slug}
          countryCounts={challenge.countryCounts}
          {...(loadEntries !== undefined ? { loadEntries } : {})}
        />
      </div>
    </main>
  );
}

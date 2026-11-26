import Link from 'next/link';

import {
  GEOPRIVACY_GITHUB_URL,
  NO_PIN_PLEDGE_BODY,
  NO_PIN_PLEDGE_LEAD,
  NO_PIN_TIERS,
} from '@/lib/no-pin-tiers';

/** W-02 No-Pin Promise public pledge page body (PRD §9.1 + plain-words tiers). */
export function NoPinPromise() {
  return (
    <div className="mx-auto max-w-3xl px-5 pb-20 pt-14 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-forest-600">
        WildWindow
      </p>
      <h1 className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-forest-800 sm:text-5xl">
        The No-Pin Promise
      </h1>

      <blockquote
        data-testid="no-pin-pledge"
        className="mt-8 border-l-2 border-forest-600 bg-mist/60 py-5 pl-5 pr-4"
      >
        <p className="font-[family-name:var(--font-fraunces)] text-xl font-semibold leading-snug text-ink sm:text-2xl">
          {NO_PIN_PLEDGE_LEAD}
        </p>
        <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg">
          {NO_PIN_PLEDGE_BODY}
        </p>
      </blockquote>

      <section className="mt-12" aria-labelledby="tiers-heading">
        <h2
          id="tiers-heading"
          className="font-[family-name:var(--font-fraunces)] text-2xl text-ink sm:text-3xl"
        >
          How protection levels work
        </h2>
        <p className="mt-3 text-ink-muted">
          Each species has a protection level per region. Higher levels mean coarser areas, older
          records, and sometimes no forecast at all.
        </p>

        <ul className="mt-8 space-y-4">
          {NO_PIN_TIERS.map((tier) => (
            <li
              key={tier.id}
              data-testid={`tier-row-${tier.id}`}
              className="border border-forest-800/15 bg-paper px-4 py-4 sm:px-5"
            >
              <h3 className="font-[family-name:var(--font-fraunces)] text-xl text-forest-800">
                {tier.name}
              </h3>
              <ul className="mt-3 space-y-1 text-sm text-ink-muted sm:text-base">
                <li>{tier.resolution}</li>
                <li>{tier.delay}</li>
                <li>{tier.minimum}</li>
                <li>{tier.lockout}</li>
              </ul>
              <p className="mt-3 text-sm italic text-ink-muted">{tier.example}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 text-ink-muted">
        Location protection lives in the open-source{' '}
        <a
          href={GEOPRIVACY_GITHUB_URL}
          className="font-medium text-forest-600 underline-offset-2 hover:underline"
          rel="noopener noreferrer"
        >
          @wildwindow/geoprivacy
        </a>{' '}
        package. Anyone can inspect the rules. See also the draft{' '}
        <Link
          href="/privacy"
          className="font-medium text-forest-600 underline-offset-2 hover:underline"
        >
          privacy policy
        </Link>{' '}
        and{' '}
        <Link
          href="/attributions"
          className="font-medium text-forest-600 underline-offset-2 hover:underline"
        >
          data attributions
        </Link>
        .
      </p>
    </div>
  );
}

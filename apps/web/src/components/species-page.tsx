import type { SeasonalityResponse, SpeciesDetail } from '@wildwindow/shared/api';
import Link from 'next/link';

import { SeasonalityChart } from '@/components/seasonality-chart';
import { SpeciesFieldCard } from '@/components/species-field-card';
import { TierBadge } from '@/components/tier-badge';
import { isReviewedCard } from '@/lib/field-card';
import { regionDisplayName, regionTimeZone } from '@/lib/species-catalog';

export type SpeciesPageViewProps = {
  readonly detail: SpeciesDetail;
  readonly seasonality: SeasonalityResponse;
  /** Optional JSON-LD script content (stringified). */
  readonly jsonLd?: string;
};

/**
 * Public species page (W-03): seasonality + reviewed field card.
 * Intentionally has no map component and never renders cells or coordinates.
 */
export function SpeciesPageView({ detail, seasonality, jsonLd }: SpeciesPageViewProps) {
  const regionName = regionDisplayName(detail.regionSlug);
  const common = detail.commonNames.en;
  const card = detail.card;

  if (!isReviewedCard(card)) {
    return null;
  }

  return (
    <main className="bg-paper" data-testid="species-page">
      {jsonLd !== undefined ? (
        <script
          type="application/ld+json"
          // JSON-LD built from Zod-validated API payloads (no user HTML).
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      ) : null}

      <div className="border-b border-forest-800/10 bg-[linear-gradient(180deg,var(--color-mist),var(--color-paper))]">
        <div className="mx-auto max-w-3xl px-5 pb-12 pt-14 sm:px-8">
          <p className="text-sm font-medium uppercase tracking-wide text-forest-600">
            {regionName}
          </p>
          <h1
            className="mt-3 font-[family-name:var(--font-fraunces)] text-4xl text-forest-800 sm:text-5xl"
            data-testid="species-page-name"
          >
            {common}
          </h1>
          <p className="mt-2 text-lg italic text-ink-muted" data-testid="species-page-scientific">
            {detail.scientificName}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <TierBadge tier={detail.tier} />
            <span className="text-sm capitalize text-ink-muted">{detail.group}</span>
          </div>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink-muted">
            Region-level seasonality and a reviewed field card. WildWindow never shows a map or
            exact location on public species pages — see the{' '}
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

      <div className="mx-auto flex max-w-3xl flex-col gap-16 px-5 py-14 sm:px-8">
        <SeasonalityChart weeks={seasonality.weeks} />
        <SpeciesFieldCard card={card} timeZone={regionTimeZone(detail.regionSlug)} />
      </div>
    </main>
  );
}

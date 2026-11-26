import type { SpeciesDetail } from '@wildwindow/shared/api';

type SensitivityTier = SpeciesDetail['tier'];

const TIER_LABELS: Readonly<Record<SensitivityTier, string>> = {
  open: 'Open',
  protected: 'Protected',
  highly_protected: 'Highly protected',
  no_forecast: 'No forecast',
};

export type TierBadgeProps = {
  readonly tier: SensitivityTier;
};

export function TierBadge({ tier }: TierBadgeProps) {
  return (
    <span
      className="inline-flex items-center rounded-md border border-forest-800/15 bg-mist px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-forest-800"
      data-testid="tier-badge"
    >
      {TIER_LABELS[tier]}
    </span>
  );
}

import { SensitivityTierSchema } from '@wildwindow/shared/api';
import type { z } from 'zod';

type SensitivityTier = z.infer<typeof SensitivityTierSchema>;

/** Higher number = stricter privacy (never weaken without confirmation). */
const TIER_RANK: Record<SensitivityTier, number> = {
  open: 0,
  protected: 1,
  highly_protected: 2,
  no_forecast: 3,
};

export function isTierLowering(from: SensitivityTier, to: SensitivityTier): boolean {
  return TIER_RANK[to] < TIER_RANK[from];
}

export const TIER_OPTIONS: readonly SensitivityTier[] = [
  'open',
  'protected',
  'highly_protected',
  'no_forecast',
] as const;

export const MONTH_LABELS: Readonly<Record<number, string>> = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mar',
  4: 'Apr',
  5: 'May',
  6: 'Jun',
  7: 'Jul',
  8: 'Aug',
  9: 'Sep',
  10: 'Oct',
  11: 'Nov',
  12: 'Dec',
};

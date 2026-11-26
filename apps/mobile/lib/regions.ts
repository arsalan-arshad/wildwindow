/**
 * Beta regions for onboarding / home preference (PRD Scotland + Sindh).
 * Kept local so the mobile app does not need the shared package build at test time.
 */
export const BETA_REGION_IDS = ['scotland', 'sindh'] as const;

export type RegionId = (typeof BETA_REGION_IDS)[number];

export function isRegionId(value: string): value is RegionId {
  return (BETA_REGION_IDS as readonly string[]).includes(value);
}

export const BETA_REGIONS = [
  {
    id: 'scotland' as const,
    nameKey: 'regions.scotland.name',
    blurbKey: 'regions.scotland.blurb',
  },
  {
    id: 'sindh' as const,
    nameKey: 'regions.sindh.name',
    blurbKey: 'regions.sindh.blurb',
  },
] as const;

/** IANA zones for beta regions (ARCHITECTURE §4 — store UTC, show regional). */
export const REGION_TIME_ZONES: Record<RegionId, string> = {
  scotland: 'Europe/London',
  sindh: 'Asia/Karachi',
};

export function regionTimeZone(region: RegionId | null | undefined): string {
  if (region === null || region === undefined) {
    return REGION_TIME_ZONES.scotland;
  }
  return REGION_TIME_ZONES[region];
}

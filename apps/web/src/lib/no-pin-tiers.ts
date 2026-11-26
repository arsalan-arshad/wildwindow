/**
 * Plain-words sensitivity tiers for W-02 (PRD §9.1 / §9.2).
 * Numbers match ARCHITECTURE §5.1 and packages/geoprivacy TIER_POLICY.
 */
export const NO_PIN_PLEDGE_LEAD = 'WildWindow will never put a pin on a wild animal.';

export const NO_PIN_PLEDGE_BODY =
  'We show where species are likely at the level of an area, never an exact spot. For sensitive species we use much larger areas, delay recent records, and switch off forecasts completely in breeding season. We never publish the location of your photos. Our location-protection code is open source, so anyone can check it.';

export const GEOPRIVACY_GITHUB_URL =
  'https://github.com/arsalan-arshad/wildwindow/tree/main/packages/geoprivacy';

export type NoPinTierId = 'open' | 'protected' | 'highly_protected' | 'no_forecast';

export type NoPinTierRow = {
  readonly id: NoPinTierId;
  readonly name: string;
  readonly resolution: string;
  readonly delay: string;
  readonly minimum: string;
  readonly lockout: string;
  readonly example: string;
};

export const NO_PIN_TIERS: readonly NoPinTierRow[] = [
  {
    id: 'open',
    name: 'Open',
    resolution: 'Shown in small areas (about 5 km²).',
    delay: 'No delay on records.',
    minimum: 'A cell needs at least 5 records from 3 observers.',
    lockout: 'Forecasts stay on in breeding season.',
    example: 'Examples: common kingfisher, red squirrel, grey seal.',
  },
  {
    id: 'protected',
    name: 'Protected',
    resolution: 'Shown in larger areas (about 250 km²).',
    delay: 'Records are at least 30 days old before they count.',
    minimum: 'A cell needs at least 10 records from 5 observers.',
    lockout: 'Breeding pause is optional and set per species.',
    example: 'Examples: Eurasian otter, mountain hare, Indus river dolphin.',
  },
  {
    id: 'highly_protected',
    name: 'Highly protected',
    resolution: 'Named large areas only (about 1,770 km²). No map cells.',
    delay: 'Records are at least a year old before they count.',
    minimum: 'A cell needs at least 20 records from 8 observers.',
    lockout: 'Forecasts switch off in breeding season.',
    example: 'Examples: osprey, white-tailed eagle, nesting green turtle.',
  },
  {
    id: 'no_forecast',
    name: 'No forecast',
    resolution: 'Never shown on a map and never forecast.',
    delay: 'Not applicable.',
    minimum: 'Not applicable.',
    lockout: 'Always locked out.',
    example: 'Example: Capercaillie in Scotland.',
  },
] as const;

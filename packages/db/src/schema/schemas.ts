import { pgSchema } from 'drizzle-orm/pg-core';

/** Precise occurrence points — worker only (ARCHITECTURE §6.1). */
export const rawSchema = pgSchema('raw');

/** Taxa, regions, zones, places, datasets, cards, tiers. */
export const refSchema = pgSchema('ref');

/** Aggregated, policy-applied tables safe to serve, plus caches. */
export const pubSchema = pgSchema('pub');

/** Users, watchlist, logbook, challenges, entitlements, audit. */
export const appSchema = pgSchema('app');

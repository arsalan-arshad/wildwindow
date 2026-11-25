import { sql } from 'drizzle-orm';
import {
  customType,
  date,
  integer,
  jsonb,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { regions, taxa } from './ref.js';
import { appSchema } from './schemas.js';

/** AES-GCM ciphertext for owner-only exact points (never public). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const users = appSchema.table(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firebaseUid: text('firebase_uid').notNull(),
    displayName: text('display_name'),
    homeRegionId: integer('home_region_id').references(() => regions.id),
    locale: text('locale').notNull().default('en'),
    role: text('role').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [uniqueIndex('users_firebase_uid_uidx').on(table.firebaseUid)],
);

export const watchlist = appSchema.table(
  'watchlist',
  {
    id: serial('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    taxonId: integer('taxon_id')
      .notNull()
      .references(() => taxa.id),
    cellR7: text('cell_r7').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('watchlist_user_taxon_cell_uidx').on(table.userId, table.taxonId, table.cellR7),
  ],
);

export const logbookEntries = appSchema.table('logbook_entries', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  taxonId: integer('taxon_id').references(() => taxa.id),
  takenAt: timestamp('taken_at', { withTimezone: true }).notNull(),
  cellR7: text('cell_r7'),
  exactPointEnc: bytea('exact_point_enc'),
  photoKey: text('photo_key').notNull(),
  thumbKey: text('thumb_key'),
  exif: jsonb('exif').$type<Record<string, unknown>>().notNull().default({}),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const challenges = appSchema.table(
  'challenges',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    taxonId: integer('taxon_id')
      .notNull()
      .references(() => taxa.id),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on').notNull(),
    rulesMd: text('rules_md').notNull(),
    status: text('status').notNull().default('draft'),
  },
  (table) => [uniqueIndex('challenges_slug_uidx').on(table.slug)],
);

export const challengeEntries = appSchema.table(
  'challenge_entries',
  {
    id: serial('id').primaryKey(),
    challengeId: integer('challenge_id')
      .notNull()
      .references(() => challenges.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    logbookEntryId: integer('logbook_entry_id')
      .notNull()
      .references(() => logbookEntries.id),
    countryCode: text('country_code').notNull(),
    regionLabel: text('region_label').notNull(),
    photoKey: text('photo_key').notNull(),
    pledgeAcceptedAt: timestamp('pledge_accepted_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('pending'),
    rejectReason: text('reject_reason'),
    publishAfter: timestamp('publish_after', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // ER: LOGBOOK_ENTRIES ||--o| CHALLENGE_ENTRIES (one logbook photo → at most one challenge row)
    uniqueIndex('challenge_entries_logbook_entry_uidx').on(table.logbookEntryId),
  ],
);

export const entitlements = appSchema.table(
  'entitlements',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    entitlement: text('entitlement').notNull(),
    source: text('source').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.entitlement] })],
);

export const waitlist = appSchema.table(
  'waitlist',
  {
    id: serial('id').primaryKey(),
    /** Stored normalized as lower(trim(email)). */
    email: text('email').notNull(),
    name: text('name'),
    regionSlug: text('region_slug'),
    role: text('role'),
    platform: text('platform'),
    favouriteSpecies: text('favourite_species'),
    consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
    source: text('source'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('waitlist_email_lower_uidx').using('btree', sql`lower(${table.email})`)],
);

export const auditLog = appSchema.table('audit_log', {
  id: serial('id').primaryKey(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  before: jsonb('before').$type<Record<string, unknown> | null>(),
  after: jsonb('after').$type<Record<string, unknown> | null>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ingestRuns = appSchema.table('ingest_runs', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  regionId: integer('region_id')
    .notNull()
    .references(() => regions.id),
  kind: text('kind').notNull(),
  gbifDownloadKey: text('gbif_download_key'),
  doi: text('doi'),
  status: text('status').notNull(),
  total: integer('total'),
  loaded: integer('loaded'),
  rejectedLicence: integer('rejected_licence'),
  rejectedCoords: integer('rejected_coords'),
  rejectedOther: integer('rejected_other'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
});

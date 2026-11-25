import { Inject, Injectable } from '@nestjs/common';
import { waitlist, type Database } from '@wildwindow/db';
import { type WaitlistSignupOk, type WaitlistSignupRequest } from '@wildwindow/shared';
import { asc } from 'drizzle-orm';

import { loadApiEnv } from '../config/api-env.js';
import { DB } from '../db/db.module.js';
import { serviceUnavailable } from '../http/api-error.js';

import { createWaitlistEmailSender, type WaitlistEmailSender } from './waitlist-email.js';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return false;
    }
    const record = current as Record<string, unknown>;
    if (record['code'] === '23505') {
      return true;
    }
    if (!('cause' in record)) {
      return false;
    }
    current = record['cause'];
  }
  return false;
}

export type WaitlistCsvRow = {
  readonly id: number;
  readonly email: string;
  readonly name: string | null;
  readonly regionSlug: string | null;
  readonly role: string | null;
  readonly platform: string | null;
  readonly favouriteSpecies: string | null;
  readonly consentAt: Date;
  readonly source: string | null;
  readonly createdAt: Date;
};

@Injectable()
export class WaitlistService {
  private readonly emailSender: WaitlistEmailSender;

  constructor(@Inject(DB) private readonly db: Database | null) {
    const env = loadApiEnv();
    this.emailSender = createWaitlistEmailSender(env.WAITLIST_EMAIL_ENABLED);
  }

  /** Exposed for tests to spy on email behaviour. */
  getEmailSender(): WaitlistEmailSender {
    return this.emailSender;
  }

  async join(body: WaitlistSignupRequest): Promise<WaitlistSignupOk> {
    const company = body.company?.trim() ?? '';
    if (company.length > 0) {
      // Honeypot filled — silent discard (looks like success to bots).
      return { ok: true };
    }

    if (this.db === null) {
      throw serviceUnavailable('Waitlist is temporarily unavailable');
    }

    const email = normalizeEmail(body.email);
    const consentAt = new Date();

    try {
      await this.db.insert(waitlist).values({
        email,
        name: body.name?.trim() || null,
        regionSlug: body.regionSlug ?? null,
        role: body.role ?? null,
        platform: body.platform ?? null,
        favouriteSpecies: body.favouriteSpecies?.trim() || null,
        consentAt,
        source: body.source ?? null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        // TASKS T5.15: duplicate email returns 200 without a second row.
        return { ok: true };
      }
      throw error;
    }

    await this.emailSender.sendSignupAck({
      email,
      name: body.name,
    });

    return { ok: true };
  }

  async listForExport(): Promise<readonly WaitlistCsvRow[]> {
    if (this.db === null) {
      throw serviceUnavailable('Waitlist export is temporarily unavailable');
    }

    const rows = await this.db
      .select({
        id: waitlist.id,
        email: waitlist.email,
        name: waitlist.name,
        regionSlug: waitlist.regionSlug,
        role: waitlist.role,
        platform: waitlist.platform,
        favouriteSpecies: waitlist.favouriteSpecies,
        consentAt: waitlist.consentAt,
        source: waitlist.source,
        createdAt: waitlist.createdAt,
      })
      .from(waitlist)
      .orderBy(asc(waitlist.id));

    return rows;
  }
}

export function waitlistRowsToCsv(rows: readonly WaitlistCsvRow[]): string {
  const header = [
    'id',
    'email',
    'name',
    'region_slug',
    'role',
    'platform',
    'favourite_species',
    'consent_at',
    'source',
    'created_at',
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        String(row.id),
        csvEscape(row.email),
        csvEscape(row.name),
        csvEscape(row.regionSlug),
        csvEscape(row.role),
        csvEscape(row.platform),
        csvEscape(row.favouriteSpecies),
        csvEscape(row.consentAt.toISOString()),
        csvEscape(row.source),
        csvEscape(row.createdAt.toISOString()),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function csvEscape(value: string | null): string {
  if (value === null) {
    return '';
  }
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

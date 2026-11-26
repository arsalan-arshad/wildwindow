/**
 * Challenge home / submit helpers (S-13, S-14).
 * Local wire shapes so jest does not need the shared package build.
 */

import type { RegionId } from '@/lib/regions';

export const CHALLENGE_STATUSES = ['draft', 'active', 'closed'] as const;
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number];

export type ChallengeCountryCount = {
  readonly countryCode: string;
  readonly count: number;
};

export type ChallengeSummary = {
  readonly slug: string;
  readonly title: string;
  readonly taxonId: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly rulesMd: string;
  readonly status: ChallengeStatus;
  readonly countryCounts: readonly ChallengeCountryCount[];
};

export type ChallengeEntryPublic = {
  readonly id: string;
  readonly countryCode: string;
  readonly regionLabel: string;
  readonly photoUrl: string;
  readonly publishedAt: string;
};

export type ChallengeEntriesPage = {
  readonly entries: readonly ChallengeEntryPublic[];
  readonly nextCursor: string | null;
};

/** Minimal logbook row needed to pick a challenge entry. */
export type ChallengeLogbookCandidate = {
  readonly id: string;
  readonly taxonId: string | null;
  readonly takenAt: string;
  readonly notes: string | null;
};

/** ISO-3166 alpha-2 + public region label for beta homes (No-Pin: country + region only). */
export type ChallengeSubmissionLocation = {
  readonly countryCode: string;
  readonly regionLabel: string;
};

const REGION_SUBMISSION_LOCATION: Record<RegionId, ChallengeSubmissionLocation> = {
  scotland: { countryCode: 'GB', regionLabel: 'Scotland' },
  sindh: { countryCode: 'PK', regionLabel: 'Sindh' },
};

export function defaultSubmissionLocation(
  region: RegionId | null | undefined,
): ChallengeSubmissionLocation {
  if (region === null || region === undefined) {
    return REGION_SUBMISSION_LOCATION.scotland;
  }
  return REGION_SUBMISSION_LOCATION[region];
}

/** Only same-species logbook rows are selectable (PRD US-13 AC2 / T6.10 acceptance). */
export function filterEligibleLogbookEntries<T extends ChallengeLogbookCandidate>(
  entries: readonly T[],
  challengeTaxonId: string,
): T[] {
  return entries.filter((entry) => entry.taxonId === challengeTaxonId);
}

export function canSubmitChallenge(input: {
  readonly pledgeAccepted: boolean;
  readonly logbookEntryId: string | null;
}): boolean {
  return input.pledgeAccepted && input.logbookEntryId !== null && input.logbookEntryId.length > 0;
}

export function isChallengeOpenForSubmit(
  challenge: Pick<ChallengeSummary, 'status' | 'startsOn' | 'endsOn'>,
  now: Date = new Date(),
): boolean {
  if (challenge.status !== 'active') {
    return false;
  }
  const today = utcDateString(now);
  return challenge.startsOn <= today && challenge.endsOn >= today;
}

export function utcDateString(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${String(y)}-${m}-${d}`;
}

export function formatChallengeDateRange(startsOn: string, endsOn: string, locale: string): string {
  const start = formatIsoDate(startsOn, locale);
  const end = formatIsoDate(endsOn, locale);
  return `${start} – ${end}`;
}

function formatIsoDate(isoDate: string, locale: string): string {
  // Challenge dates are calendar days (YYYY-MM-DD), not instants.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (match === null) {
    return isoDate;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return isoDate;
  }
}

export function totalCountryCount(counts: readonly ChallengeCountryCount[]): number {
  return counts.reduce((sum, row) => sum + row.count, 0);
}

export function formatTakenAtShort(iso: string, timeZone: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

import type { ChallengeCountryCount } from '@wildwindow/shared/api';

/** Friendly names for beta challenge country codes (ISO-3166 alpha-2). */
const COUNTRY_DISPLAY: Readonly<Record<string, string>> = {
  GB: 'United Kingdom',
  PK: 'Pakistan',
};

export function countryDisplayName(countryCode: string): string {
  const code = countryCode.trim().toUpperCase();
  return COUNTRY_DISPLAY[code] ?? code;
}

/** Public place line — region + country only (PRD US-13 AC3). Never a pin. */
export function formatEntryPlace(regionLabel: string, countryCode: string): string {
  return `${regionLabel}, ${countryDisplayName(countryCode)}`;
}

export function totalCountryCount(counts: readonly ChallengeCountryCount[]): number {
  return counts.reduce((sum, row) => sum + row.count, 0);
}

/** Challenge dates are calendar days (YYYY-MM-DD), shown in UTC. */
export function formatChallengeDateRange(
  startsOn: string,
  endsOn: string,
  locale = 'en-GB',
): string {
  return `${formatIsoDate(startsOn, locale)} – ${formatIsoDate(endsOn, locale)}`;
}

function formatIsoDate(isoDate: string, locale: string): string {
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

export function challengeStatusLabel(status: string): string {
  switch (status) {
    case 'active':
      return 'Live';
    case 'closed':
      return 'Closed';
    case 'draft':
      return 'Draft';
    default:
      return status;
  }
}

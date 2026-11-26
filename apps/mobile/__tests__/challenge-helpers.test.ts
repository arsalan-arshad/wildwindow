import {
  canSubmitChallenge,
  defaultSubmissionLocation,
  filterEligibleLogbookEntries,
  formatChallengeDateRange,
  isChallengeOpenForSubmit,
  totalCountryCount,
  utcDateString,
} from '@/lib/challenge';

describe('challenge helpers (T6.10)', () => {
  it('filters logbook entries to the challenge taxon only', () => {
    const eligible = filterEligibleLogbookEntries(
      [
        { id: '1', taxonId: '2481', takenAt: '2026-11-01T10:00:00.000Z', notes: null },
        { id: '2', taxonId: '5219', takenAt: '2026-11-02T10:00:00.000Z', notes: null },
        { id: '3', taxonId: null, takenAt: '2026-11-03T10:00:00.000Z', notes: null },
        { id: '4', taxonId: '2481', takenAt: '2026-11-04T10:00:00.000Z', notes: 'ok' },
      ],
      '2481',
    );
    expect(eligible.map((row) => row.id)).toEqual(['1', '4']);
  });

  it('requires pledge and a selected logbook entry before submit', () => {
    expect(canSubmitChallenge({ pledgeAccepted: false, logbookEntryId: '1' })).toBe(false);
    expect(canSubmitChallenge({ pledgeAccepted: true, logbookEntryId: null })).toBe(false);
    expect(canSubmitChallenge({ pledgeAccepted: true, logbookEntryId: '' })).toBe(false);
    expect(canSubmitChallenge({ pledgeAccepted: true, logbookEntryId: '1' })).toBe(true);
  });

  it('maps beta regions to country + region labels only', () => {
    expect(defaultSubmissionLocation('scotland')).toEqual({
      countryCode: 'GB',
      regionLabel: 'Scotland',
    });
    expect(defaultSubmissionLocation('sindh')).toEqual({
      countryCode: 'PK',
      regionLabel: 'Sindh',
    });
  });

  it('detects an open challenge window in UTC calendar days', () => {
    const challenge = {
      status: 'active' as const,
      startsOn: '2026-11-01',
      endsOn: '2026-11-30',
    };
    expect(isChallengeOpenForSubmit(challenge, new Date('2026-11-15T12:00:00.000Z'))).toBe(true);
    expect(isChallengeOpenForSubmit(challenge, new Date('2026-10-31T23:00:00.000Z'))).toBe(false);
    expect(
      isChallengeOpenForSubmit(
        { ...challenge, status: 'closed' },
        new Date('2026-11-15T12:00:00.000Z'),
      ),
    ).toBe(false);
  });

  it('formats date ranges and totals country counts', () => {
    expect(utcDateString(new Date('2026-11-26T05:00:00.000Z'))).toBe('2026-11-26');
    expect(formatChallengeDateRange('2026-11-01', '2026-11-30', 'en')).toMatch(/2026/);
    expect(
      totalCountryCount([
        { countryCode: 'GB', count: 2 },
        { countryCode: 'PK', count: 3 },
      ]),
    ).toBe(5);
  });
});

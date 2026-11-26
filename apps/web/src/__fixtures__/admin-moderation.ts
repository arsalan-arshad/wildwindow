import type { AdminChallengeEntry, AdminIngestRun } from '@wildwindow/shared/api';

/** Pending challenge entry for moderation queue tests (no coordinates). */
export const FIXTURE_PENDING_ENTRY: AdminChallengeEntry = {
  id: '101',
  challengeSlug: 'kingfisher-month',
  userId: '22222222-2222-4222-8222-222222222222',
  countryCode: 'GB',
  regionLabel: 'Scotland',
  photoKey: 'challenges/kingfisher-month/entry-101.jpg',
  status: 'pending',
  rejectReason: null,
  publishAfter: '2026-12-03T12:00:00.000Z',
  createdAt: '2026-11-26T12:00:00.000Z',
};

export const FIXTURE_APPROVED_ENTRY: AdminChallengeEntry = {
  ...FIXTURE_PENDING_ENTRY,
  id: '102',
  photoKey: 'challenges/kingfisher-month/entry-102.jpg',
  status: 'approved',
  createdAt: '2026-11-25T10:00:00.000Z',
  publishAfter: '2026-12-02T10:00:00.000Z',
};

export const FIXTURE_REJECTED_ENTRY: AdminChallengeEntry = {
  ...FIXTURE_PENDING_ENTRY,
  id: '103',
  photoKey: 'challenges/kingfisher-month/entry-103.jpg',
  status: 'rejected',
  rejectReason: 'Photo does not show the challenge species.',
  createdAt: '2026-11-24T09:00:00.000Z',
  publishAfter: '2026-12-01T09:00:00.000Z',
};

/** Sample ingest runs for the admin table (no coordinates). */
export const FIXTURE_INGEST_RUNS: AdminIngestRun[] = [
  {
    id: '7',
    source: 'gbif',
    regionSlug: 'scotland',
    kind: 'target',
    gbifDownloadKey: '0001234-abcdef',
    doi: '10.15468/dl.example1',
    status: 'succeeded',
    total: 1200,
    loaded: 1100,
    rejectedLicence: 50,
    rejectedCoords: 40,
    rejectedOther: 10,
    startedAt: '2026-11-20T08:00:00.000Z',
    finishedAt: '2026-11-20T09:30:00.000Z',
  },
  {
    id: '8',
    source: 'gbif',
    regionSlug: 'sindh',
    kind: 'effort',
    gbifDownloadKey: '0005678-ghijkl',
    doi: null,
    status: 'requested',
    total: null,
    loaded: null,
    rejectedLicence: null,
    rejectedCoords: null,
    rejectedOther: null,
    startedAt: '2026-11-26T06:00:00.000Z',
    finishedAt: null,
  },
  {
    id: '9',
    source: 'gbif',
    regionSlug: 'scotland',
    kind: 'effort',
    gbifDownloadKey: null,
    doi: null,
    status: 'failed',
    total: null,
    loaded: null,
    rejectedLicence: null,
    rejectedCoords: null,
    rejectedOther: null,
    startedAt: '2026-11-25T14:00:00.000Z',
    finishedAt: '2026-11-25T14:05:00.000Z',
  },
];

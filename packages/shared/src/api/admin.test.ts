import { describe, expect, it } from 'vitest';

import {
  AdminChallengeEntryPatchSchema,
  AdminSessionSchema,
  AdminSpeciesCardPatchSchema,
  IngestRunStatusSchema,
} from './admin.js';

describe('admin API schemas (T5.13)', () => {
  it('parses admin session (T7.6)', () => {
    const ok = AdminSessionSchema.safeParse({
      ok: true,
      role: 'admin',
      userId: '11111111-1111-4111-8111-111111111111',
    });
    expect(ok.success).toBe(true);

    expect(AdminSessionSchema.safeParse({ ok: true, role: 'user', userId: 'x' }).success).toBe(
      false,
    );
  });

  it('requires rejectReason when rejecting a challenge entry', () => {
    const bad = AdminChallengeEntryPatchSchema.safeParse({ status: 'rejected' });
    expect(bad.success).toBe(false);

    const ok = AdminChallengeEntryPatchSchema.safeParse({
      status: 'rejected',
      rejectReason: 'Not the challenge species',
    });
    expect(ok.success).toBe(true);
  });

  it('allows approve without rejectReason', () => {
    const ok = AdminChallengeEntryPatchSchema.safeParse({ status: 'approved' });
    expect(ok.success).toBe(true);
  });

  it('requires region on species card patch', () => {
    const bad = AdminSpeciesCardPatchSchema.safeParse({ bodyMd: 'hi' });
    expect(bad.success).toBe(false);

    const ok = AdminSpeciesCardPatchSchema.safeParse({
      region: 'scotland',
      bodyMd: 'Field notes',
    });
    expect(ok.success).toBe(true);
  });

  it('matches worker ingest_runs status values', () => {
    expect(IngestRunStatusSchema.parse('requested')).toBe('requested');
    expect(IngestRunStatusSchema.parse('succeeded')).toBe('succeeded');
    expect(IngestRunStatusSchema.parse('failed')).toBe('failed');
    expect(IngestRunStatusSchema.safeParse('queued').success).toBe(false);
  });
});

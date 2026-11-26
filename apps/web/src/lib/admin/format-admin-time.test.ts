import { describe, expect, it } from 'vitest';

import { formatAdminTime } from '@/lib/admin/format-admin-time';

describe('formatAdminTime', () => {
  it('returns an em dash for null', () => {
    expect(formatAdminTime(null)).toBe('—');
  });

  it('formats a valid ISO string in UTC', () => {
    expect(formatAdminTime('2026-11-26T12:00:00.000Z')).toMatch(/26 Nov 2026/);
  });

  it('returns the raw string when invalid', () => {
    expect(formatAdminTime('not-a-date')).toBe('not-a-date');
  });
});

import { describe, expect, it } from 'vitest';

import { isInLockout, isOlderThanDelay } from './time.js';

describe('isOlderThanDelay', () => {
  it('allows all events for open (delay 0) at or before now', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(isOlderThanDelay(new Date('2026-06-15T12:00:00Z'), now, 'open')).toBe(true);
    expect(isOlderThanDelay(new Date('2026-06-16T12:00:00Z'), now, 'open')).toBe(false);
  });

  it('enforces 30 days for protected', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(isOlderThanDelay(new Date('2026-05-16T12:00:00Z'), now, 'protected')).toBe(true);
    expect(isOlderThanDelay(new Date('2026-05-17T12:00:00Z'), now, 'protected')).toBe(false);
  });

  it('enforces 365 days for highly_protected', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(isOlderThanDelay(new Date('2025-06-15T12:00:00Z'), now, 'highly_protected')).toBe(true);
    expect(isOlderThanDelay(new Date('2025-06-16T12:00:00Z'), now, 'highly_protected')).toBe(false);
  });
});

describe('isInLockout', () => {
  it('detects April lockout in Europe/London around DST start 2026', () => {
    // UK clocks forward 2026-03-29. Early April is BST (UTC+1).
    const inApril = new Date('2026-04-01T00:30:00Z'); // 01:30 BST → April
    const inMarch = new Date('2026-03-28T12:00:00Z'); // still March GMT
    expect(isInLockout(inApril, [4, 5, 6], 'Europe/London')).toBe(true);
    expect(isInLockout(inMarch, [4, 5, 6], 'Europe/London')).toBe(false);
  });

  it('detects October lockout in Europe/London around DST end 2026', () => {
    // UK clocks back 2026-10-25. Late October after the change is GMT.
    const inOctober = new Date('2026-10-26T01:30:00Z'); // still October in London
    const inNovember = new Date('2026-11-01T00:30:00Z');
    expect(isInLockout(inOctober, [10], 'Europe/London')).toBe(true);
    expect(isInLockout(inNovember, [10], 'Europe/London')).toBe(false);
  });

  it('uses Asia/Karachi month boundaries (no DST)', () => {
    // Karachi is UTC+5 year-round.
    // 2026-05-31 18:59Z = 2026-05-31 23:59 PKT (May)
    const endOfMay = new Date('2026-05-31T18:59:00Z');
    // 2026-05-31 19:00Z = 2026-06-01 00:00 PKT (June)
    const startOfJune = new Date('2026-05-31T19:00:00Z');
    expect(isInLockout(endOfMay, [6], 'Asia/Karachi')).toBe(false);
    expect(isInLockout(startOfJune, [6], 'Asia/Karachi')).toBe(true);
    expect(isInLockout(startOfJune, [3, 4, 5], 'Asia/Karachi')).toBe(false);
  });

  it('returns false for an empty month list', () => {
    expect(isInLockout(new Date('2026-04-01T12:00:00Z'), [], 'Europe/London')).toBe(false);
  });
});

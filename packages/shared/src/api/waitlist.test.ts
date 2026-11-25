import { describe, expect, it } from 'vitest';

import { WaitlistSignupRequestSchema } from './waitlist.js';

const validBase = {
  email: 'photographer@example.com',
  consent: true as const,
};

describe('WaitlistSignupRequestSchema', () => {
  it('accepts a minimal valid signup', () => {
    const parsed = WaitlistSignupRequestSchema.parse(validBase);
    expect(parsed.email).toBe('photographer@example.com');
    expect(parsed.consent).toBe(true);
  });

  it('accepts all optional fields', () => {
    const parsed = WaitlistSignupRequestSchema.parse({
      ...validBase,
      name: 'Alex',
      regionSlug: 'scotland',
      role: 'hobby_photographer',
      platform: 'ios',
      favouriteSpecies: 'Common kingfisher',
      source: 'landing',
      company: '',
    });
    expect(parsed.name).toBe('Alex');
    expect(parsed.regionSlug).toBe('scotland');
  });

  it('rejects a missing email', () => {
    const result = WaitlistSignupRequestSchema.safeParse({ consent: true });
    expect(result.success).toBe(false);
  });

  it('rejects a bad email', () => {
    const result = WaitlistSignupRequestSchema.safeParse({
      email: 'not-an-email',
      consent: true,
    });
    expect(result.success).toBe(false);
  });

  it('rejects consent false', () => {
    const result = WaitlistSignupRequestSchema.safeParse({
      email: 'ok@example.com',
      consent: false,
    });
    expect(result.success).toBe(false);
  });

  it('rejects consent omitted', () => {
    const result = WaitlistSignupRequestSchema.safeParse({
      email: 'ok@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('still parses when honeypot company is filled (API discards silently)', () => {
    const parsed = WaitlistSignupRequestSchema.parse({
      ...validBase,
      company: 'Acme Bot Corp',
    });
    expect(parsed.company).toBe('Acme Bot Corp');
  });

  it('rejects an invalid regionSlug', () => {
    const result = WaitlistSignupRequestSchema.safeParse({
      ...validBase,
      regionSlug: 'glasgow',
    });
    expect(result.success).toBe(false);
  });

  it('rejects favouriteSpecies over max length', () => {
    const result = WaitlistSignupRequestSchema.safeParse({
      ...validBase,
      favouriteSpecies: 'x'.repeat(201),
    });
    expect(result.success).toBe(false);
  });
});

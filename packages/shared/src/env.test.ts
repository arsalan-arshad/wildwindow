import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { EnvValidationError, loadEnv } from './env.js';

const sampleSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  API_PUBLIC_URL: z.string().url(),
  WATCHLIST_LIMIT_FREE: z.coerce.number().int().positive(),
});

describe('loadEnv', () => {
  it('returns parsed values for a valid env', () => {
    const env = loadEnv(sampleSchema, {
      NODE_ENV: 'test',
      API_PUBLIC_URL: 'http://localhost:3000',
      WATCHLIST_LIMIT_FREE: '3',
    });

    expect(env).toEqual({
      NODE_ENV: 'test',
      API_PUBLIC_URL: 'http://localhost:3000',
      WATCHLIST_LIMIT_FREE: 3,
    });
  });

  it('throws listing every missing key', () => {
    expect(() => loadEnv(sampleSchema, {})).toThrow(EnvValidationError);

    try {
      loadEnv(sampleSchema, {});
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const issues = (error as EnvValidationError).issues;
      expect(issues.some((issue) => issue.startsWith('NODE_ENV:'))).toBe(true);
      expect(issues.some((issue) => issue.startsWith('API_PUBLIC_URL:'))).toBe(true);
      expect(issues.some((issue) => issue.startsWith('WATCHLIST_LIMIT_FREE:'))).toBe(true);
      expect((error as Error).message).toContain('Invalid environment:');
    }
  });

  it('throws listing invalid values', () => {
    try {
      loadEnv(sampleSchema, {
        NODE_ENV: 'staging',
        API_PUBLIC_URL: 'not-a-url',
        WATCHLIST_LIMIT_FREE: '0',
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      const message = (error as Error).message;
      expect(message).toContain('NODE_ENV:');
      expect(message).toContain('API_PUBLIC_URL:');
      expect(message).toContain('WATCHLIST_LIMIT_FREE:');
    }
  });
});

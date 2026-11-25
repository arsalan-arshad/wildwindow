import { describe, expect, it } from 'vitest';

import { corsOptionsFromWebOrigin, normalizeOrigin } from './cors.js';

describe('normalizeOrigin', () => {
  it('trims whitespace and strips trailing slashes', () => {
    expect(normalizeOrigin(' https://web.example/ ')).toBe('https://web.example');
    expect(normalizeOrigin('https://web.example///')).toBe('https://web.example');
  });
});

describe('corsOptionsFromWebOrigin', () => {
  it('returns undefined when WEB_ORIGIN is missing or blank', () => {
    expect(corsOptionsFromWebOrigin(undefined)).toBeUndefined();
    expect(corsOptionsFromWebOrigin('')).toBeUndefined();
    expect(corsOptionsFromWebOrigin('   ')).toBeUndefined();
  });

  it('allows the configured origin even when env has a trailing slash', async () => {
    const options = corsOptionsFromWebOrigin('https://wildwindow.arsalandev.studio/');
    expect(options).toBeDefined();
    if (options === undefined) {
      return;
    }
    expect(options.credentials).toBe(true);

    const decide = (origin: string | undefined): Promise<boolean> =>
      new Promise((resolve, reject) => {
        options.origin(origin, (err, allow) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(allow === true);
        });
      });

    await expect(decide('https://wildwindow.arsalandev.studio')).resolves.toBe(true);
    await expect(decide('https://wildwindow.arsalandev.studio/')).resolves.toBe(true);
    await expect(decide('https://evil.example')).resolves.toBe(false);
    await expect(decide(undefined)).resolves.toBe(true);
    await expect(decide('')).resolves.toBe(true);
  });
});

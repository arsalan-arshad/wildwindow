import { DEFAULT_SITE_URL, getSiteUrl } from '@/lib/site-url';

describe('getSiteUrl', () => {
  const original = process.env['EXPO_PUBLIC_SITE_URL'];

  afterEach(() => {
    if (original === undefined) {
      Reflect.deleteProperty(process.env, 'EXPO_PUBLIC_SITE_URL');
    } else {
      process.env['EXPO_PUBLIC_SITE_URL'] = original;
    }
  });

  it('uses EXPO_PUBLIC_SITE_URL when set', () => {
    process.env['EXPO_PUBLIC_SITE_URL'] = 'https://example.test/';
    expect(getSiteUrl()).toBe('https://example.test');
  });

  it('falls back to the Railway web default', () => {
    Reflect.deleteProperty(process.env, 'EXPO_PUBLIC_SITE_URL');
    expect(getSiteUrl()).toBe(DEFAULT_SITE_URL);
  });
});

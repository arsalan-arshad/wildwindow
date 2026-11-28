import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.join(webRoot, '../..');

function sha256(filePath: string): string {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

describe('brand assets in public/ (WPO-105)', () => {
  it('ships favicon, apple-touch, PWA icons, OG, and mark from assets/', () => {
    const required = [
      'favicon.ico',
      'favicon-32.png',
      'apple-touch-icon.png',
      'icon-192.png',
      'icon-512.png',
      'brand/mark.svg',
      'brand/logo-horizontal.svg',
      'og/og-1200x630.png',
      'og/default-og.png',
      'marketing/hero-placeholder.png',
      'marketing/waitlist-banner.png',
    ];
    for (const rel of required) {
      expect(existsSync(path.join(webRoot, 'public', rel)), rel).toBe(true);
    }
  });

  it('keeps public copies byte-identical to canonical assets/', () => {
    const pairs: Array<[string, string]> = [
      ['assets/favicon/favicon.ico', 'apps/web/public/favicon.ico'],
      ['assets/favicon/favicon-32.png', 'apps/web/public/favicon-32.png'],
      ['assets/favicon/apple-touch-icon.png', 'apps/web/public/apple-touch-icon.png'],
      ['assets/icons/icon-192.png', 'apps/web/public/icon-192.png'],
      ['assets/icons/icon-512.png', 'apps/web/public/icon-512.png'],
      ['assets/brand/mark.svg', 'apps/web/public/brand/mark.svg'],
      ['assets/og/og-1200x630.png', 'apps/web/public/og/og-1200x630.png'],
      ['assets/marketing/hero-placeholder.png', 'apps/web/public/marketing/hero-placeholder.png'],
    ];
    for (const [canonical, copy] of pairs) {
      expect(sha256(path.join(repoRoot, copy))).toBe(sha256(path.join(repoRoot, canonical)));
    }
  });
});

describe('App Router favicon (WPO-106)', () => {
  it('serves the brand favicon via app/favicon.ico (not the Next.js default)', () => {
    const appFavicon = path.join(webRoot, 'src/app/favicon.ico');
    const brandFavicon = path.join(repoRoot, 'assets/favicon/favicon.ico');
    expect(existsSync(appFavicon)).toBe(true);
    expect(sha256(appFavicon)).toBe(sha256(brandFavicon));
    // create-next-app default is ~25KB with 4 icon sizes; brand pack is a single 32×32.
    expect(readFileSync(appFavicon).byteLength).toBeLessThan(8_000);
  });

  it('ships app/icon.png from the brand 32×32 PNG for modern browsers', () => {
    const appIcon = path.join(webRoot, 'src/app/icon.png');
    const brandPng = path.join(repoRoot, 'assets/favicon/favicon-32.png');
    expect(existsSync(appIcon)).toBe(true);
    expect(sha256(appIcon)).toBe(sha256(brandPng));
  });
});

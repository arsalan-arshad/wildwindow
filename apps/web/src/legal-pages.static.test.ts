import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webSrc = path.join(path.dirname(fileURLToPath(import.meta.url)));

const LEGAL_PAGES = [
  'app/no-pin/page.tsx',
  'app/privacy/page.tsx',
  'app/terms/page.tsx',
  'app/attributions/page.tsx',
] as const;

describe('T7.2 legal pages are statically generated', () => {
  it.each(LEGAL_PAGES)('%s exports force-static', (relativePath) => {
    const source = readFileSync(path.join(webSrc, relativePath), 'utf8');
    expect(source).toMatch(/export const dynamic = 'force-static'/);
    expect(source).not.toMatch(/force-dynamic/);
    expect(source).not.toMatch(/['"]use client['"]/);
  });

  it('privacy and terms mark DRAFT – needs legal review', () => {
    const privacy = readFileSync(path.join(webSrc, 'app/privacy/page.tsx'), 'utf8');
    const terms = readFileSync(path.join(webSrc, 'app/terms/page.tsx'), 'utf8');
    expect(privacy).toMatch(/LegalDraftBanner/);
    expect(terms).toMatch(/LegalDraftBanner/);
    const banner = readFileSync(path.join(webSrc, 'components/legal-draft-banner.tsx'), 'utf8');
    expect(banner).toMatch(/DRAFT – needs legal review/);
  });
});

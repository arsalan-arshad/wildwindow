import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(webRoot, '../..');

describe('Vercel web deploy config (T9.5)', () => {
  it('apps/web/vercel.json targets monorepo install/build and London region', () => {
    const raw = readFileSync(resolve(webRoot, 'vercel.json'), 'utf8');
    const config = JSON.parse(raw) as {
      framework?: string;
      installCommand?: string;
      buildCommand?: string;
      regions?: string[];
    };

    expect(config.framework).toBe('nextjs');
    expect(config.installCommand).toMatch(/pnpm install --frozen-lockfile --filter web\.\.\./);
    expect(config.buildCommand).toMatch(/@wildwindow\/geoprivacy build/);
    expect(config.buildCommand).toMatch(/@wildwindow\/shared build/);
    expect(config.buildCommand).toMatch(/--filter web build/);
    expect(config.regions).toEqual(['lhr1']);
  });

  it('next.config skips standalone output when VERCEL is set', () => {
    const source = readFileSync(resolve(webRoot, 'next.config.ts'), 'utf8');
    expect(source).toMatch(/process\.env\['VERCEL'\]/);
    expect(source).toMatch(/output:\s*'standalone'/);
    expect(source).toMatch(/\?\s*\{\s*\}\s*:\s*\{\s*output:\s*'standalone'/);
  });

  it('docs/VERCEL.md explains preview URL → landing and Arsalan project step', () => {
    const doc = readFileSync(resolve(repoRoot, 'docs/VERCEL.md'), 'utf8');
    expect(doc).toMatch(/preview URL/i);
    expect(doc).toMatch(/landing/i);
    expect(doc).toMatch(/apps\/web\/src\/app\/page\.tsx/);
    expect(doc).toMatch(/Root Directory/);
    expect(doc).toMatch(/Do not.*create a Vercel project/i);
    expect(doc).toMatch(/NEXT_PUBLIC_API_URL/);
  });
});

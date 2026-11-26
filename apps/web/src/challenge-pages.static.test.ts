import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webSrc = path.join(path.dirname(fileURLToPath(import.meta.url)));

const CHALLENGE_ROUTE = 'app/challenges/[slug]/page.tsx';

const CHALLENGE_UI_FILES = [
  'components/challenge-page.tsx',
  'components/challenge-gallery.tsx',
  'lib/challenge.ts',
  'app/challenges/[slug]/page.tsx',
] as const;

/** Forbid map UI / geo pin APIs (not Array.prototype `.map`). */
const FORBIDDEN_MAP =
  /\b(SpeciesMap|MapView|MapContainer|leaflet|mapbox|react-native-maps|mapCells|getSpeciesMap)\b|client\.species\.map\b|api\.species\.map\b/i;

const FORBIDDEN_GEO_FIELDS =
  /\b(latitude|longitude|cell_r7|cellR7|exact_point|exactPoint)\b|\bphotoExifGps\b/i;

function collectTsFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(full);
    }
  }
  return files;
}

describe('T7.5 challenge gallery static gates', () => {
  it('route uses ISR revalidate and is not a client component', () => {
    const source = readFileSync(path.join(webSrc, CHALLENGE_ROUTE), 'utf8');
    expect(source).toMatch(/export const revalidate = 3600/);
    expect(source).toMatch(/generateStaticParams/);
    expect(source).not.toMatch(/['"]use client['"]/);
    expect(source).not.toMatch(/force-dynamic/);
  });

  it('challenge page tree has no map component or pin fields', () => {
    for (const relative of CHALLENGE_UI_FILES) {
      const source = readFileSync(path.join(webSrc, relative), 'utf8');
      expect(source, relative).not.toMatch(FORBIDDEN_MAP);
      expect(source, relative).not.toMatch(FORBIDDEN_GEO_FIELDS);
    }
  });

  it('fixture entries expose only countryCode and regionLabel for place', () => {
    const fixture = readFileSync(path.join(webSrc, '__fixtures__/challenge-gallery.ts'), 'utf8');
    expect(fixture).toMatch(/countryCode/);
    expect(fixture).toMatch(/regionLabel/);
    expect(fixture).not.toMatch(FORBIDDEN_GEO_FIELDS);
    expect(fixture).not.toMatch(FORBIDDEN_MAP);
  });

  it('no Map* React component is defined under challenge modules', () => {
    const roots = [
      path.join(webSrc, 'components'),
      path.join(webSrc, 'lib'),
      path.join(webSrc, 'app/challenges'),
    ];
    for (const root of roots) {
      for (const file of collectTsFiles(root)) {
        if (!/challenge/i.test(path.relative(webSrc, file))) {
          continue;
        }
        const source = readFileSync(file, 'utf8');
        expect(source, file).not.toMatch(/export function Map[A-Z]/);
        expect(source, file).not.toMatch(/export const Map[A-Z]/);
      }
    }
  });
});

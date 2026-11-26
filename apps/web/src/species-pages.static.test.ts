import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const webSrc = path.join(path.dirname(fileURLToPath(import.meta.url)));

const SPECIES_ROUTE = 'app/[region]/[species]/page.tsx';

const SPECIES_UI_FILES = [
  'components/species-page.tsx',
  'components/seasonality-chart.tsx',
  'components/species-field-card.tsx',
  'components/tier-badge.tsx',
  'lib/species-catalog.ts',
] as const;

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

describe('T7.3 species pages static gates', () => {
  it('route uses ISR revalidate and is not a client component', () => {
    const source = readFileSync(path.join(webSrc, SPECIES_ROUTE), 'utf8');
    expect(source).toMatch(/export const revalidate = 3600/);
    expect(source).toMatch(/generateStaticParams/);
    expect(source).not.toMatch(/['"]use client['"]/);
    expect(source).not.toMatch(/force-dynamic/);
  });

  it('species page tree has no map component or map API usage', () => {
    // Forbid map UI / species-map API (not Array.prototype `.map`).
    const forbidden =
      /\b(SpeciesMap|MapView|MapContainer|leaflet|mapbox|react-native-maps|mapCells|getSpeciesMap)\b|client\.species\.map\b|api\.species\.map\b/i;

    for (const relative of SPECIES_UI_FILES) {
      const source = readFileSync(path.join(webSrc, relative), 'utf8');
      expect(source, relative).not.toMatch(forbidden);
    }

    const routeSource = readFileSync(path.join(webSrc, SPECIES_ROUTE), 'utf8');
    expect(routeSource).not.toMatch(forbidden);
    expect(routeSource).not.toMatch(/from ['"].*map/i);
  });

  it('no Map* React component is defined under species page modules', () => {
    const roots = [
      path.join(webSrc, 'components'),
      path.join(webSrc, 'lib'),
      path.join(webSrc, 'app/[region]'),
    ];
    for (const root of roots) {
      for (const file of collectTsFiles(root)) {
        const source = readFileSync(file, 'utf8');
        expect(source, file).not.toMatch(/export function Map[A-Z]/);
        expect(source, file).not.toMatch(/export const Map[A-Z]/);
      }
    }
  });
});

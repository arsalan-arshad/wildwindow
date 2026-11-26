import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  loadChallengeSeedFile,
  loadChallengeSeedsFromDir,
  parseChallengeSeedYaml,
} from './challenges-seed.js';

const here = dirname(fileURLToPath(import.meta.url));

const VALID = {
  version: 1 as const,
  slug: 'kingfisher-month-2026-11',
  title: 'Kingfisher Month',
  scientificName: 'Alcedo atthis',
  regions: ['scotland', 'sindh'] as const,
  startsOn: '2026-11-01',
  endsOn: '2026-11-30',
  status: 'live' as const,
  rulesMd: '## Rules\n\nNo baiting. Ethics pledge required.',
};

describe('challenge seed YAML (T8.4)', () => {
  it('accepts a valid Kingfisher Month document', () => {
    const seed = parseChallengeSeedYaml(VALID, 'test');
    expect(seed.slug).toBe('kingfisher-month-2026-11');
    expect(seed.regions).toEqual(['scotland', 'sindh']);
    expect(seed.rulesMd).toMatch(/baiting/i);
  });

  it('rejects endsOn before startsOn', () => {
    expect(() =>
      parseChallengeSeedYaml({ ...VALID, endsOn: '2026-10-01' }, 'bad-dates.yaml'),
    ).toThrow(/endsOn/);
  });

  it('rejects unknown status values', () => {
    expect(() => parseChallengeSeedYaml({ ...VALID, status: 'active' }, 'bad-status.yaml')).toThrow(
      /status/,
    );
  });

  it('loads the committed kingfisher-month.yaml from data/challenges', () => {
    const repoRoot = join(here, '..', '..', '..');
    const filePath = join(repoRoot, 'data', 'challenges', 'kingfisher-month.yaml');
    const seed = loadChallengeSeedFile(filePath);
    expect(seed.slug).toBe('kingfisher-month-2026-11');
    expect(seed.scientificName).toBe('Alcedo atthis');
    expect(seed.status).toBe('live');
    expect(seed.rulesMd.toLowerCase()).toMatch(/baiting/);
    expect(seed.rulesMd.toLowerCase()).toMatch(/playback/);
    expect(seed.rulesMd.toLowerCase()).toMatch(/nest/);
    expect(seed.rulesMd.toLowerCase()).toMatch(/scotland/);
    expect(seed.rulesMd.toLowerCase()).toMatch(/sindh/);
  });

  it('loadChallengeSeedsFromDir returns sorted unique slugs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ww-challenges-'));
    writeFileSync(
      join(dir, 'b.yaml'),
      [
        'version: 1',
        'slug: beta-challenge',
        'title: Beta',
        'scientificName: Alcedo atthis',
        'regions: [scotland]',
        "startsOn: '2026-01-01'",
        "endsOn: '2026-01-31'",
        'status: draft',
        'rulesMd: |',
        '  rules',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      join(dir, 'a.yaml'),
      [
        'version: 1',
        'slug: alpha-challenge',
        'title: Alpha',
        'scientificName: Alcedo atthis',
        'regions: [sindh]',
        "startsOn: '2026-02-01'",
        "endsOn: '2026-02-28'",
        'status: closed',
        'rulesMd: |',
        '  rules',
      ].join('\n'),
      'utf8',
    );
    const seeds = loadChallengeSeedsFromDir(dir);
    expect(seeds.map((s) => s.slug)).toEqual(['alpha-challenge', 'beta-challenge']);
  });
});

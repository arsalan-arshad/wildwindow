import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildSensitivityReview,
  formatSensitivityReviewMarkdown,
  writeSensitivityReviewReports,
} from './sensitivity-review.js';

import type { BetaSpeciesFile, SensitiveSpeciesFile } from './data-schemas.js';

const betaFixture: BetaSpeciesFile = {
  version: 1,
  species: [
    {
      scientificName: 'Alcedo atthis',
      commonNames: { en: 'Common kingfisher', ur: 'عام کنگ فشر' },
      group: 'bird',
      effortGroup: 'Aves',
      regions: ['scotland', 'sindh'],
      coastal: false,
      activityPattern: 'diurnal',
      challengeEligible: true,
      gbifTaxonKey: 2475532,
    },
    {
      scientificName: 'Pandion haliaetus',
      commonNames: { en: 'Osprey' },
      group: 'bird',
      effortGroup: 'Aves',
      regions: ['scotland'],
      coastal: false,
      activityPattern: 'diurnal',
      challengeEligible: false,
      gbifTaxonKey: 2480726,
    },
    {
      scientificName: 'Tetrao urogallus',
      commonNames: { en: 'Western capercaillie' },
      group: 'bird',
      effortGroup: 'Aves',
      regions: ['scotland'],
      coastal: false,
      activityPattern: 'diurnal',
      challengeEligible: false,
      gbifTaxonKey: 2473555,
    },
    {
      scientificName: 'Chelonia mydas',
      commonNames: { en: 'Green turtle' },
      group: 'reptile',
      effortGroup: 'Reptilia',
      regions: ['sindh'],
      coastal: true,
      activityPattern: 'nocturnal',
      challengeEligible: false,
      gbifTaxonKey: 2442203,
    },
    {
      scientificName: 'Missingus defaultus',
      commonNames: { en: 'Missing sensitive row' },
      group: 'mammal',
      effortGroup: 'Mammalia',
      regions: ['sindh'],
      coastal: false,
      activityPattern: 'diurnal',
      challengeEligible: false,
      gbifTaxonKey: 9999999,
    },
  ],
};

const sensitiveFixture: SensitiveSpeciesFile = {
  version: 1,
  species: [
    { scientificName: 'Alcedo atthis', region: 'scotland', tier: 'open' },
    { scientificName: 'Alcedo atthis', region: 'sindh', tier: 'open' },
    {
      scientificName: 'Pandion haliaetus',
      region: 'scotland',
      tier: 'highly_protected',
      lockoutMonths: [3, 4, 5, 6, 7, 8],
      notes: 'Osprey — Schedule 1 breeding lockout',
    },
    {
      scientificName: 'Tetrao urogallus',
      region: 'scotland',
      tier: 'no_forecast',
      notes: 'Capercaillie — no_forecast example',
    },
    {
      scientificName: 'Chelonia mydas',
      region: 'sindh',
      tier: 'highly_protected',
      lockoutMonths: [6, 7, 8, 9, 10, 11],
      notes: 'Green turtle nesting lockout',
      reviewer: 'Dr Example',
      reviewedAt: '2026-11-01T00:00:00.000Z',
    },
  ],
};

describe('buildSensitivityReview', () => {
  it('joins beta scotland species with proposed tiers and lockouts', () => {
    const report = buildSensitivityReview({
      region: 'scotland',
      beta: betaFixture,
      sensitive: sensitiveFixture,
      now: new Date('2026-11-26T12:00:00.000Z'),
    });

    expect(report.rows).toHaveLength(3);
    const osprey = report.rows.find((row) => row.scientificName === 'Pandion haliaetus');
    expect(osprey).toMatchObject({
      proposedTier: 'highly_protected',
      lockoutMonths: [3, 4, 5, 6, 7, 8],
      reason: 'Osprey — Schedule 1 breeding lockout',
      missingFromSensitiveYaml: false,
    });
    expect(osprey?.links.some((link) => link.url.includes('gbif.org/species/2480726'))).toBe(true);
  });

  it('defaults missing sensitive rows to protected', () => {
    const report = buildSensitivityReview({
      region: 'sindh',
      beta: betaFixture,
      sensitive: sensitiveFixture,
    });
    const missing = report.rows.find((row) => row.scientificName === 'Missingus defaultus');
    expect(missing?.proposedTier).toBe('protected');
    expect(missing?.missingFromSensitiveYaml).toBe(true);
    expect(missing?.reason).toMatch(/No row in data\/sensitive-species\.yaml/);
  });

  it('sorts higher-sensitivity tiers first', () => {
    const report = buildSensitivityReview({
      region: 'scotland',
      beta: betaFixture,
      sensitive: sensitiveFixture,
    });
    expect(report.rows.map((row) => row.proposedTier)).toEqual([
      'no_forecast',
      'highly_protected',
      'open',
    ]);
  });
});

describe('formatSensitivityReviewMarkdown', () => {
  it('includes proposed tier, lockout months, reason and links', () => {
    const report = buildSensitivityReview({
      region: 'scotland',
      beta: betaFixture,
      sensitive: sensitiveFixture,
      now: new Date('2026-11-26T12:00:00.000Z'),
    });
    const md = formatSensitivityReviewMarkdown(report);

    expect(md).toContain('# Sensitivity review — Scotland');
    expect(md).toContain('PRD E6');
    expect(md).toContain('`highly_protected`');
    expect(md).toContain('Mar, Apr, May, Jun, Jul, Aug');
    expect(md).toContain('Osprey — Schedule 1 breeding lockout');
    expect(md).toContain('https://www.gbif.org/species/2480726');
    expect(md).toContain('NatureScot');
    expect(md).toContain('_pending_');
  });

  it('shows reviewer sign-off when present', () => {
    const report = buildSensitivityReview({
      region: 'sindh',
      beta: betaFixture,
      sensitive: sensitiveFixture,
    });
    const md = formatSensitivityReviewMarkdown(report);
    expect(md).toContain('Dr Example @ 2026-11-01T00:00:00.000Z');
    expect(md).toContain('Green turtle nesting lockout');
  });
});

describe('writeSensitivityReviewReports', () => {
  it('writes reports/sensitivity-review-<region>.md for both regions', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ww-sensitivity-'));
    try {
      const reportsDir = path.join(dir, 'reports');
      const written = await writeSensitivityReviewReports({
        dataDir: path.join(dir, 'data'),
        reportsDir,
        now: new Date('2026-11-26T12:00:00.000Z'),
        loadData: () => ({
          betaSpecies: betaFixture,
          sensitiveSpecies: sensitiveFixture,
        }),
      });

      const scotlandPath = path.join(reportsDir, 'sensitivity-review-scotland.md');
      const sindhPath = path.join(reportsDir, 'sensitivity-review-sindh.md');
      expect(written).toEqual([scotlandPath, sindhPath]);

      const scotland = await readFile(scotlandPath, 'utf8');
      const sindh = await readFile(sindhPath, 'utf8');
      expect(scotland).toContain('# Sensitivity review — Scotland');
      expect(scotland).toContain('Western capercaillie');
      expect(sindh).toContain('# Sensitivity review — Sindh');
      expect(sindh).toContain('Green turtle');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

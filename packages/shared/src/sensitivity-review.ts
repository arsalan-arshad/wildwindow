/**
 * Sensitivity review pack (T8.3 / PRD E6).
 * Builds Markdown reports for conservation reviewers from beta + sensitive YAML.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { TIER_POLICY, type Tier } from '@wildwindow/geoprivacy';

import {
  type BetaSpeciesEntry,
  type BetaSpeciesFile,
  type RegionId,
  type SensitiveSpeciesEntry,
  type SensitiveSpeciesFile,
  type SensitivityTier,
} from './data-schemas.js';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const REGION_LABELS: Record<RegionId, string> = {
  scotland: 'Scotland',
  sindh: 'Sindh',
};

const TIER_LABELS: Record<SensitivityTier, string> = {
  open: 'Open',
  protected: 'Protected',
  highly_protected: 'Highly protected',
  no_forecast: 'No forecast',
};

export type SensitivityReviewRow = {
  readonly scientificName: string;
  readonly commonNameEn: string;
  readonly commonNameUr: string | undefined;
  readonly group: string;
  readonly gbifTaxonKey: number | undefined;
  readonly proposedTier: SensitivityTier;
  readonly lockoutMonths: readonly number[];
  readonly reason: string;
  readonly links: readonly { readonly label: string; readonly url: string }[];
  readonly reviewer: string | undefined;
  readonly reviewedAt: string | undefined;
  readonly missingFromSensitiveYaml: boolean;
};

export type SensitivityReviewReport = {
  readonly region: RegionId;
  readonly generatedAt: Date;
  readonly rows: readonly SensitivityReviewRow[];
};

export type BuildSensitivityReviewOptions = {
  readonly region: RegionId;
  readonly beta: BetaSpeciesFile;
  readonly sensitive: SensitiveSpeciesFile;
  /** Injected clock for tests. */
  readonly now?: Date;
};

function escapeCell(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
}

function formatLockoutMonths(months: readonly number[]): string {
  if (months.length === 0) {
    return '—';
  }
  return months
    .map((month) => {
      const label = MONTH_LABELS[month - 1];
      return label ?? String(month);
    })
    .join(', ');
}

function asTier(tier: SensitivityTier): Tier {
  return tier;
}

function tierPolicyBlurb(tier: SensitivityTier): string {
  const policy = TIER_POLICY[asTier(tier)];
  const res = policy.resolution === null ? 'no map cells' : `H3 res ${String(policy.resolution)}`;
  const delay =
    policy.delayDays === 0 ? 'no record delay' : `${String(policy.delayDays)}-day record delay`;
  const lockout =
    policy.lockout === false
      ? 'no breeding lockout'
      : policy.lockout === 'optional'
        ? 'optional breeding lockout'
        : 'breeding lockout required';
  return `${TIER_LABELS[tier]} (${res}; ${delay}; ${lockout})`;
}

function defaultReason(tier: SensitivityTier, missing: boolean): string {
  if (missing) {
    return (
      `No row in data/sensitive-species.yaml — proposed \`${tier}\` under ARCHITECTURE §3.3 ` +
      '(prefer the higher tier when unsure). Reviewer must confirm before launch.'
    );
  }
  switch (tier) {
    case 'open':
      return 'Proposed open: publicly forecast at H3 res 7 with no delay (PRD §9.2).';
    case 'protected':
      return 'Proposed protected: coarse H3 res 5 cells, 30-day delay (PRD §9.2).';
    case 'highly_protected':
      return 'Proposed highly protected: area labels only, 365-day delay, breeding lockout (PRD §9.2).';
    case 'no_forecast':
      return 'Proposed no_forecast: never shown on a map and never forecast (PRD §9.2).';
  }
}

function buildLinks(
  scientificName: string,
  gbifTaxonKey: number | undefined,
  region: RegionId,
  group: string,
): { readonly label: string; readonly url: string }[] {
  const links: { label: string; url: string }[] = [];
  if (gbifTaxonKey !== undefined) {
    links.push({
      label: 'GBIF taxon',
      url: `https://www.gbif.org/species/${String(gbifTaxonKey)}`,
    });
  }
  links.push({
    label: 'IUCN Red List search',
    url: `https://www.iucnredlist.org/search?query=${encodeURIComponent(scientificName)}`,
  });
  if (region === 'scotland' && group === 'bird') {
    links.push({
      label: 'NatureScot — licensing disturbance of wild birds',
      url: 'https://www.nature.scot/doc/guidance-licensing-disturbance-wild-birds-protected-under-wildlife-and-countryside-act-1981-and',
    });
  }
  return links;
}

function resolveSensitiveEntry(
  scientificName: string,
  region: RegionId,
  sensitive: SensitiveSpeciesFile,
): SensitiveSpeciesEntry | undefined {
  return sensitive.species.find(
    (row) => row.scientificName === scientificName && row.region === region,
  );
}

/**
 * Join beta species for a region with proposed tiers from sensitive-species.yaml.
 * Missing sensitive rows default to `protected` (safer) per ARCHITECTURE §3.3.
 */
export function buildSensitivityReview(
  options: BuildSensitivityReviewOptions,
): SensitivityReviewReport {
  const { region, beta, sensitive } = options;
  const now = options.now ?? new Date();

  const rows: SensitivityReviewRow[] = beta.species
    .filter((entry) => entry.regions.includes(region))
    .map((entry: BetaSpeciesEntry) => {
      const sensitiveRow = resolveSensitiveEntry(entry.scientificName, region, sensitive);
      const missing = sensitiveRow === undefined;
      const proposedTier: SensitivityTier = sensitiveRow?.tier ?? 'protected';
      const lockoutMonths = sensitiveRow?.lockoutMonths ?? [];
      const notes = sensitiveRow?.notes?.trim();
      const reason =
        notes !== undefined && notes.length > 0 ? notes : defaultReason(proposedTier, missing);

      return {
        scientificName: entry.scientificName,
        commonNameEn: entry.commonNames.en,
        commonNameUr: entry.commonNames.ur,
        group: entry.group,
        gbifTaxonKey: entry.gbifTaxonKey,
        proposedTier,
        lockoutMonths,
        reason,
        links: buildLinks(entry.scientificName, entry.gbifTaxonKey, region, entry.group),
        reviewer: sensitiveRow?.reviewer,
        reviewedAt: sensitiveRow?.reviewedAt,
        missingFromSensitiveYaml: missing,
      };
    })
    .sort((a, b) => {
      const tierOrder: Record<SensitivityTier, number> = {
        no_forecast: 0,
        highly_protected: 1,
        protected: 2,
        open: 3,
      };
      const tierDiff = tierOrder[a.proposedTier] - tierOrder[b.proposedTier];
      if (tierDiff !== 0) {
        return tierDiff;
      }
      return a.commonNameEn.localeCompare(b.commonNameEn);
    });

  return { region, generatedAt: now, rows };
}

function formatLinksInline(links: SensitivityReviewRow['links']): string {
  return links.map((link) => `[${link.label}](${link.url})`).join('; ');
}

function signOffCell(row: SensitivityReviewRow): string {
  if (row.reviewer !== undefined && row.reviewedAt !== undefined) {
    return `${row.reviewer} @ ${row.reviewedAt}`;
  }
  return '_pending_';
}

/**
 * Format `reports/sensitivity-review-<region>.md` body for conservation reviewers.
 */
export function formatSensitivityReviewMarkdown(report: SensitivityReviewReport): string {
  const regionLabel = REGION_LABELS[report.region];
  const pending = report.rows.filter(
    (row) => row.reviewer === undefined || row.reviewedAt === undefined,
  ).length;
  const missing = report.rows.filter((row) => row.missingFromSensitiveYaml).length;

  const tierCounts = {
    open: report.rows.filter((r) => r.proposedTier === 'open').length,
    protected: report.rows.filter((r) => r.proposedTier === 'protected').length,
    highly_protected: report.rows.filter((r) => r.proposedTier === 'highly_protected').length,
    no_forecast: report.rows.filter((r) => r.proposedTier === 'no_forecast').length,
  };

  const lines: string[] = [
    `# Sensitivity review — ${regionLabel}`,
    '',
    'Pack for conservation reviewers before public launch (**PRD E6**).',
    'Proposed tiers come from `data/sensitive-species.yaml` joined to the beta species list.',
    'Sign-off updates that YAML (`reviewer`, `reviewedAt`) — do not lower a tier without an audit trail.',
    '',
    `- Region: \`${report.region}\``,
    `- Generated (UTC): ${report.generatedAt.toISOString()}`,
    `- Species in pack: ${String(report.rows.length)}`,
    `- Awaiting sign-off: ${String(pending)}`,
    `- Missing from sensitive YAML (defaulted to \`protected\`): ${String(missing)}`,
    '',
    '## How to use this pack',
    '',
    '1. Read each species row: proposed tier, lockout months, and reason.',
    '2. Prefer the **higher** tier when unsure (PRD E1).',
    '3. Confirm or amend lockout months for breeding / nesting seasons.',
    '4. Record `reviewer` and `reviewedAt` on each signed-off row in `data/sensitive-species.yaml`.',
    '5. Only an admin may lower a tier later; the change is audit-logged (PRD US-15).',
    '',
    '## Tier policy summary (PRD §9.2 / ARCHITECTURE §5.1)',
    '',
    '| Tier | Public resolution | Record delay | Min cell | Breeding lockout |',
    '| --- | --- | ---: | --- | --- |',
    `| \`open\` | H3 res ${String(TIER_POLICY.open.resolution)} (~5 km²) | ${String(TIER_POLICY.open.delayDays)} | ≥ ${String(TIER_POLICY.open.minRecords)} records, ≥ ${String(TIER_POLICY.open.minObservers)} observers | no |`,
    `| \`protected\` | H3 res ${String(TIER_POLICY.protected.resolution)} (~250 km²) | ${String(TIER_POLICY.protected.delayDays)} | ≥ ${String(TIER_POLICY.protected.minRecords)} / ≥ ${String(TIER_POLICY.protected.minObservers)} | optional |`,
    `| \`highly_protected\` | H3 res ${String(TIER_POLICY.highly_protected.resolution)} (~1,770 km²), area label only | ${String(TIER_POLICY.highly_protected.delayDays)} | ≥ ${String(TIER_POLICY.highly_protected.minRecords)} / ≥ ${String(TIER_POLICY.highly_protected.minObservers)} | **yes** |`,
    '| `no_forecast` | not shown / never forecast | n/a | n/a | always |',
    '',
    '### Counts in this pack',
    '',
    `| Tier | Count |`,
    `| --- | ---: |`,
    `| open | ${String(tierCounts.open)} |`,
    `| protected | ${String(tierCounts.protected)} |`,
    `| highly_protected | ${String(tierCounts.highly_protected)} |`,
    `| no_forecast | ${String(tierCounts.no_forecast)} |`,
    '',
  ];

  if (report.region === 'scotland') {
    lines.push(
      '## Scotland references',
      '',
      '- [NatureScot guidance — licensing disturbance of wild birds (Schedule 1)](https://www.nature.scot/doc/guidance-licensing-disturbance-wild-birds-protected-under-wildlife-and-countryside-act-1981-and)',
      '- Wildlife and Countryside Act 1981 (as amended in Scotland): Schedule 1 birds need a NatureScot licence for photography at or near the nest (PRD E8).',
      '',
    );
  } else {
    lines.push(
      '## Sindh references',
      '',
      '- Provincial wildlife law and protected-area permit rules apply (PRD E8). Confirm exact legal wording with the named Sindh reviewer before launch.',
      '- Prefer higher tiers for turtles, otters, Indus river dolphin, and other locally sensitive taxa.',
      '',
    );
  }

  lines.push(
    '## Summary table',
    '',
    '| Common name | Scientific | Group | Proposed tier | Lockout months | Reason | Links | Sign-off |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  );

  for (const row of report.rows) {
    lines.push(
      `| ${escapeCell(row.commonNameEn)} | *${escapeCell(row.scientificName)}* | ${escapeCell(row.group)} | \`${row.proposedTier}\` | ${escapeCell(formatLockoutMonths(row.lockoutMonths))} | ${escapeCell(row.reason)} | ${formatLinksInline(row.links)} | ${signOffCell(row)} |`,
    );
  }

  lines.push('', '## Species detail', '');

  for (const row of report.rows) {
    const ur =
      row.commonNameUr !== undefined && row.commonNameUr.length > 0 ? ` / ${row.commonNameUr}` : '';
    lines.push(
      `### ${row.commonNameEn}${ur} (*${row.scientificName}*)`,
      '',
      `| Field | Value |`,
      `| --- | --- |`,
      `| Group | ${escapeCell(row.group)} |`,
      `| Proposed tier | \`${row.proposedTier}\` — ${tierPolicyBlurb(row.proposedTier)} |`,
      `| Lockout months | ${escapeCell(formatLockoutMonths(row.lockoutMonths))} |`,
      `| Reason | ${escapeCell(row.reason)} |`,
      `| Links | ${formatLinksInline(row.links)} |`,
      `| Reviewer | ${row.reviewer !== undefined ? escapeCell(row.reviewer) : '_pending_'} |`,
      `| Reviewed at | ${row.reviewedAt !== undefined ? escapeCell(row.reviewedAt) : '_pending_'} |`,
      `| In sensitive YAML | ${row.missingFromSensitiveYaml ? '**missing** (defaulted)' : 'yes'} |`,
      '',
    );
  }

  lines.push(
    '## Sign-off checklist',
    '',
    `- [ ] Every species in this region has a confirmed tier`,
    `- [ ] Lockout months checked for \`highly_protected\` (and any \`protected\` with seasonal risk)`,
    `- [ ] No tier was lowered without documented justification`,
    `- [ ] \`reviewer\` + \`reviewedAt\` written into \`data/sensitive-species.yaml\` for each row`,
    '',
    '---',
    '',
    '_Generated by `pnpm data:sensitivity-review` (T8.3)._',
    '',
  );

  return lines.join('\n');
}

export function sensitivityReviewReportPath(reportsDir: string, region: RegionId): string {
  return path.join(reportsDir, `sensitivity-review-${region}.md`);
}

export type WriteSensitivityReviewOptions = {
  readonly dataDir: string;
  readonly reportsDir: string;
  readonly regions?: readonly RegionId[];
  readonly now?: Date;
  readonly loadData: (dataDir: string) => {
    betaSpecies: BetaSpeciesFile;
    sensitiveSpecies: SensitiveSpeciesFile;
  };
};

/**
 * Build and write `reports/sensitivity-review-<region>.md` for each requested region.
 */
export async function writeSensitivityReviewReports(
  options: WriteSensitivityReviewOptions,
): Promise<readonly string[]> {
  const regions = options.regions ?? (['scotland', 'sindh'] as const);
  const { betaSpecies, sensitiveSpecies } = options.loadData(options.dataDir);
  await mkdir(options.reportsDir, { recursive: true });

  const written: string[] = [];
  for (const region of regions) {
    const report = buildSensitivityReview({
      region,
      beta: betaSpecies,
      sensitive: sensitiveSpecies,
      ...(options.now !== undefined ? { now: options.now } : {}),
    });
    const outPath = sensitivityReviewReportPath(options.reportsDir, region);
    await writeFile(outPath, formatSensitivityReviewMarkdown(report), 'utf8');
    written.push(outPath);
  }
  return written;
}

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { ChallengeSeedSchema, type ChallengeSeed } from './data-schemas.js';

export type LoadedChallengeSeed = ChallengeSeed & {
  readonly filePath: string;
};

function formatIssues(
  label: string,
  issues: readonly { path: PropertyKey[]; message: string }[],
): string {
  const lines = issues.map((issue) => {
    const pathLabel = issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)';
    return `  - ${pathLabel}: ${issue.message}`;
  });
  return `${label} is invalid:\n${lines.join('\n')}`;
}

/** Parse and validate one challenge seed YAML document. */
export function parseChallengeSeedYaml(raw: unknown, label: string): ChallengeSeed {
  const parsed = ChallengeSeedSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(formatIssues(label, parsed.error.issues));
  }
  return parsed.data;
}

/** Load a single challenge seed file (UTF-8 YAML). */
export function loadChallengeSeedFile(filePath: string): LoadedChallengeSeed {
  const raw: unknown = parseYaml(readFileSync(filePath, 'utf8'));
  const seed = parseChallengeSeedYaml(raw, filePath);
  return { ...seed, filePath };
}

/**
 * Load every `*.yaml` / `*.yml` challenge seed under `challengesDir`.
 * Sorted by slug for stable upsert order.
 */
export function loadChallengeSeedsFromDir(challengesDir: string): LoadedChallengeSeed[] {
  let names: string[];
  try {
    names = readdirSync(challengesDir);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read challenges dir ${challengesDir}: ${message}`);
  }

  const files = names
    .filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))
    .map((name) => path.join(challengesDir, name))
    .sort((a, b) => a.localeCompare(b));

  const seeds = files.map((filePath) => loadChallengeSeedFile(filePath));
  const seen = new Set<string>();
  for (const seed of seeds) {
    if (seen.has(seed.slug)) {
      throw new Error(`Duplicate challenge slug "${seed.slug}" under ${challengesDir}`);
    }
    seen.add(seed.slug);
  }
  return seeds.sort((a, b) => a.slug.localeCompare(b.slug));
}

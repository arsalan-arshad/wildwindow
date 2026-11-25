/**
 * Create and update GitHub labels from `.github/labels.yml`.
 *
 *   node .github/scripts/sync-labels.mjs [--dry-run] [--prune] [--file path]
 *
 * Requires `gh` authenticated for this repo (or GH_TOKEN / GITHUB_TOKEN).
 * Without `--prune`, labels that are not in the file are left in place.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { formatPlan, ghLabelArgs, parseLabelsDocument, planLabelSync } from './labels.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * @param {string[]} argv
 */
function main(argv) {
  const dryRun = argv.includes('--dry-run');
  const prune = argv.includes('--prune');
  const file = option(argv, '--file') ?? path.join(scriptDir, '..', 'labels.yml');
  const desired = parseLabelsDocument(fs.readFileSync(file, 'utf8'));
  const existing = listLabels();
  if (existing.length >= 200) {
    console.error('Refusing to sync: `gh label list` returned 200 labels and may be truncated.');
    process.exit(1);
  }
  const plan = planLabelSync(desired, existing, { prune });
  for (const line of formatPlan(plan)) console.log(line);
  if (dryRun) {
    console.log('dry run: no changes written');
    return;
  }
  const repo = process.env.GITHUB_REPOSITORY;
  const repoArgs = repo ? ['--repo', repo] : [];
  for (const op of plan.operations) {
    execFileSync('gh', [...repoArgs, ...ghLabelArgs(op)], { stdio: 'inherit' });
  }
}

/**
 * @returns {Array<{ name: string, color: string, description: string }>}
 */
function listLabels() {
  let stdout = '';
  try {
    const repo = process.env.GITHUB_REPOSITORY;
    const args = ['label', 'list', '--limit', '200', '--json', 'name,color,description'];
    if (repo) args.push('--repo', repo);
    stdout = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr).trim() : '';
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Could not list labels with gh. Authenticate gh, or set GH_TOKEN.\n${stderr || message}`,
    );
    process.exit(1);
  }
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed)) {
    console.error('gh label list did not return a JSON array');
    process.exit(1);
  }
  return parsed;
}

/**
 * @param {string[]} argv
 * @param {string} name
 * @returns {string | undefined}
 */
function option(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    console.error(`${name} needs a value`);
    process.exit(1);
  }
  return value;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}

/**
 * Add platform and severity labels from an issue form body.
 *
 * Reads the GitHub event at GITHUB_EVENT_PATH (set by Actions). Logs only the
 * label names it adds, never the issue body, which might contain a location.
 *
 *   node .github/scripts/apply-issue-labels.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { labelsToAdd } from './labels.mjs';

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error('GITHUB_EVENT_PATH is not set. This script runs from the issue-labels workflow.');
    process.exit(1);
  }
  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const issue = event.issue;
  if (!issue || typeof issue.number !== 'number') {
    console.error('Event has no issue to label.');
    process.exit(1);
  }
  const title = typeof issue.title === 'string' ? issue.title : '';
  const body = typeof issue.body === 'string' ? issue.body : '';
  const existingLabels = Array.isArray(issue.labels)
    ? issue.labels
        .map((label) => (label && typeof label.name === 'string' ? label.name : ''))
        .filter((name) => name !== '')
    : [];
  const add = labelsToAdd({ title, body, existingLabels });
  if (add.length === 0) {
    console.log('No extra labels to apply.');
    return;
  }
  const repo = process.env.GITHUB_REPOSITORY;
  /** @type {string[]} */
  const args = [];
  if (repo) args.push('--repo', repo);
  args.push('issue', 'edit', String(issue.number), '--add-label', add.join(','));
  execFileSync('gh', args, { stdio: 'inherit' });
  console.log(`Applied: ${add.join(', ')}`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}

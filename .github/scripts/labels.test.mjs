import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  PRIVACY_MARKER,
  formatPlan,
  ghLabelArgs,
  labelsToAdd,
  parseLabelsDocument,
  planLabelSync,
} from './labels.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const EXPECTED_LABELS = [
  'bug',
  'feature',
  'privacy',
  'P0',
  'P1',
  'P2',
  'needs-triage',
  'mobile',
  'web',
  'api',
];

/**
 * @param {string} relativePath
 */
function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function formLabels(text) {
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const inline = lines[index].match(/^labels:\s*\[(.*)\]\s*$/);
    if (inline) {
      return inline[1].split(',').map((part) => part.trim().replace(/^['"]|['"]$/g, ''));
    }
    if (lines[index].trim() === 'labels:') {
      /** @type {string[]} */
      const names = [];
      for (let next = index + 1; next < lines.length; next += 1) {
        const item = lines[next].match(/^\s+-\s+['"]?([^'"]+)['"]?\s*$/);
        if (!item) break;
        names.push(item[1]);
      }
      if (names.length === 0) throw new Error('labels list is empty');
      return names;
    }
  }
  throw new Error('labels key missing');
}

test('labels.yml is the declared set', () => {
  const labels = parseLabelsDocument(readRepo('.github/labels.yml'));
  assert.deepEqual(
    labels.map((label) => label.name),
    EXPECTED_LABELS,
  );
  for (const label of labels) {
    assert.match(label.color, /^[0-9a-f]{6}$/);
    assert.ok(label.description.length >= 1 && label.description.length <= 100);
  }
});

test('parseLabelsDocument rejects a duplicate and a bad color', () => {
  assert.throws(
    () =>
      parseLabelsDocument(
        '- name: bug\n  color: d73a4a\n  description: One\n- name: bug\n  color: d73a4a\n  description: Two\n',
      ),
    /duplicate label/,
  );
  assert.throws(
    () => parseLabelsDocument('- name: bug\n  color: red\n  description: One\n'),
    /bad color/,
  );
});

test('planLabelSync creates, updates, and leaves unknown labels unless pruned', () => {
  const desired = parseLabelsDocument(
    [
      '- name: bug',
      '  color: d73a4a',
      '  description: Broken',
      '- name: P0',
      '  color: b60205',
      '  description: Critical',
      '',
    ].join('\n'),
  );
  const existing = [
    { name: 'bug', color: 'D73A4A', description: 'Broken' },
    { name: 'P0', color: 'aaaaaa', description: 'old' },
    { name: 'wontfix', color: 'ffffff', description: 'no' },
  ];
  const plan = planLabelSync(desired, existing);
  assert.deepEqual(
    plan.operations.map((op) =>
      op.kind === 'delete' ? `delete ${op.name}` : `${op.kind} ${op.label.name}`,
    ),
    ['update P0'],
  );
  assert.deepEqual(plan.extras, ['wontfix']);
  const pruned = planLabelSync(desired, existing, { prune: true });
  assert.deepEqual(formatPlan(pruned), ['update P0', 'delete wontfix']);
  const missing = planLabelSync(desired, []);
  assert.deepEqual(formatPlan(missing), ['create bug', 'create P0']);
});

test('gh label arguments keep the description as one argv entry', () => {
  const description = '$(touch /tmp/pwned) && `whoami`';
  const args = ghLabelArgs({
    kind: 'create',
    label: { name: 'bug', color: 'd73a4a', description },
  });
  assert.equal(args.at(-1), description);
  assert.equal(args.filter((arg) => arg.includes('touch')).length, 1);
  const rename = ghLabelArgs({
    kind: 'update',
    previousName: 'Bug',
    label: { name: 'bug', color: 'd73a4a', description: 'Broken' },
  });
  assert.deepEqual(rename.slice(0, 3), ['label', 'edit', 'Bug']);
  assert.ok(rename.includes('--name'));
  assert.equal(rename.at(-1), 'bug');
});

test('issue form bodies map platform and severity, and privacy stays P0', () => {
  const bug = [
    '### Steps to reproduce',
    '',
    'The notes mention a lat key and a lng key.',
    '',
    '### Platform',
    '',
    'iOS',
    '',
    '### Severity',
    '',
    'P1',
  ].join('\n');
  const added = labelsToAdd({
    title: 'bug: pin',
    body: bug,
    existingLabels: ['bug', 'needs-triage'],
  });
  assert.deepEqual(added, ['mobile', 'P1']);
  assert.equal(JSON.stringify(added).includes('lat'), false);

  assert.deepEqual(
    labelsToAdd({
      title: 'bug: android',
      body: '### Platform\n\nAndroid\n\n### Severity\n\nP2\n',
      existingLabels: [],
    }),
    ['mobile', 'P2'],
  );
  assert.deepEqual(
    labelsToAdd({
      title: 'bug: site',
      body: '### Platform\n\nweb\n\n### Severity\n\nP0\n',
      existingLabels: [],
    }),
    ['web', 'P0'],
  );
  assert.deepEqual(
    labelsToAdd({
      title: 'bug: api',
      body: '### Platform\n\napi\n\n### Severity\n\nP1\n',
      existingLabels: ['api'],
    }),
    ['P1'],
  );
  assert.deepEqual(
    labelsToAdd({
      title: 'feature: idea',
      body: '### Platform\n\nnot sure\n',
      existingLabels: ['feature'],
    }),
    [],
  );

  const privacy = labelsToAdd({
    title: 'privacy: pin on a map',
    body: `${PRIVACY_MARKER}\n\n### Platform\n\niOS\n\n### Severity\n\nP2\n`,
    existingLabels: ['privacy', 'P0', 'needs-triage'],
  });
  assert.deepEqual(privacy, ['mobile']);
  assert.equal(privacy.includes('P2'), false);
  assert.deepEqual(
    labelsToAdd({
      title: 'privacy: pin on a map',
      body: `${PRIVACY_MARKER}\n\n### Platform\n\niOS\n`,
      existingLabels: ['privacy'],
    }),
    ['mobile', 'P0'],
  );
  assert.deepEqual(
    labelsToAdd({
      title: 'Saw a pin',
      body: `${PRIVACY_MARKER}\n\n### Platform\n\nweb\n`,
      existingLabels: [],
    }),
    ['web', 'P0'],
  );
});

test('issue forms auto-apply labels and the privacy form refuses public coordinates', () => {
  const bug = readRepo('.github/ISSUE_TEMPLATE/bug_report.yml');
  const feature = readRepo('.github/ISSUE_TEMPLATE/feature_request.yml');
  const privacy = readRepo('.github/ISSUE_TEMPLATE/privacy_report.yml');
  const config = readRepo('.github/ISSUE_TEMPLATE/config.yml');
  const declared = new Set(
    parseLabelsDocument(readRepo('.github/labels.yml')).map((label) => label.name),
  );

  assert.deepEqual(formLabels(bug), ['bug', 'needs-triage']);
  assert.deepEqual(formLabels(feature), ['feature', 'needs-triage']);
  assert.deepEqual(formLabels(privacy), ['privacy', 'P0', 'needs-triage']);
  for (const name of [...formLabels(bug), ...formLabels(feature), ...formLabels(privacy)]) {
    assert.ok(declared.has(name), name);
  }

  for (const option of ['iOS', 'Android', 'web', 'api']) {
    assert.match(bug, new RegExp(`^\\s+- ${option}$`, 'm'));
    assert.match(privacy, new RegExp(`^\\s+- ${option}$`, 'm'));
  }
  assert.match(feature, /^\s+- not sure$/m);
  for (const severity of ['P0', 'P1', 'P2']) {
    assert.match(bug, new RegExp(`^\\s+- ${severity}$`, 'm'));
  }
  assert.equal(privacy.includes('label: Severity'), false);
  assert.ok(privacy.includes(PRIVACY_MARKER));
  assert.match(privacy, /Do not post exact coordinates/);
  assert.equal(bug.includes(PRIVACY_MARKER), false);
  assert.match(bug, /label: Steps to reproduce/);
  assert.match(bug, /label: Expected behaviour/);
  assert.match(bug, /label: Actual behaviour/);
  assert.match(bug, /label: App version/);
  assert.match(bug, /label: Device and OS/);
  assert.match(bug, /label: Screenshots/);
  assert.match(config, /blank_issues_enabled:\s*false/);
  assert.match(config, /contact_links:/);

  assert.match(
    readRepo('.github/workflows/sync-labels.yml'),
    /node \.github\/scripts\/sync-labels\.mjs/,
  );
  assert.match(
    readRepo('.github/workflows/issue-labels.yml'),
    /node \.github\/scripts\/apply-issue-labels\.mjs/,
  );
});

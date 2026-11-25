/**
 * Pure helpers for `.github/labels.yml` and for labels read off issue forms.
 * No network. The CLIs in this folder apply the results with `gh`.
 */

/** @typedef {{ name: string, color: string, description: string }} Label */

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/;
const COLOR_RE = /^[0-9a-f]{6}$/;

/** Sentence the privacy form puts in the issue body. The labeler treats it as P0. */
export const PRIVACY_MARKER = 'This report is a P0 privacy issue.';

const PLATFORM_LABELS = new Map([
  ['ios', 'mobile'],
  ['android', 'mobile'],
  ['web', 'web'],
  ['api', 'api'],
]);

/**
 * @param {string} text
 * @returns {Label[]}
 */
export function parseLabelsDocument(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('labels document is empty');
  }
  /** @type {Label[]} */
  const labels = [];
  /** @type {{ name: string, color: string, description: string } | null} */
  let current = null;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const lineNo = index + 1;
    const trimmed = lines[index].trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    if (trimmed.startsWith('- name:')) {
      if (current) labels.push(finishLabel(current));
      current = {
        name: unquote(trimmed.slice('- name:'.length).trim()),
        color: '',
        description: '',
      };
      continue;
    }
    if (!current) {
      throw new Error(`labels.yml:${lineNo}: expected "- name:"`);
    }
    const color = keyed(trimmed, 'color:');
    if (color !== null) {
      current.color = unquote(color);
      continue;
    }
    const description = keyed(trimmed, 'description:');
    if (description !== null) {
      current.description = unquote(description);
      continue;
    }
    throw new Error(`labels.yml:${lineNo}: unsupported line`);
  }
  if (current) labels.push(finishLabel(current));
  const seen = new Set();
  for (const label of labels) {
    const key = label.name.toLowerCase();
    if (seen.has(key)) throw new Error(`duplicate label: ${label.name}`);
    seen.add(key);
  }
  return labels;
}

/**
 * @param {{ name: string, color: string, description: string }} label
 * @returns {Label}
 */
function finishLabel(label) {
  const color = normalizeColor(label.color);
  if (!NAME_RE.test(label.name)) {
    throw new Error(`bad label name: ${label.name}`);
  }
  if (!COLOR_RE.test(color)) {
    throw new Error(`bad color for ${label.name}`);
  }
  if (label.description.length < 1 || label.description.length > 100) {
    throw new Error(`description for ${label.name} must be 1–100 characters`);
  }
  return { name: label.name, color, description: label.description };
}

/**
 * @param {string} color
 * @returns {string}
 */
export function normalizeColor(color) {
  return color.trim().replace(/^#/, '').toLowerCase();
}

/**
 * @param {string} trimmed
 * @param {string} prefix
 * @returns {string | null}
 */
function keyed(trimmed, prefix) {
  if (!trimmed.startsWith(prefix)) return null;
  return trimmed.slice(prefix.length).trim();
}

/**
 * @param {string} value
 * @returns {string}
 */
function unquote(value) {
  if (value.length >= 2) {
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * @param {Label[]} desired
 * @param {Array<{ name: string, color?: string, description?: string }>} existing
 * @param {{ prune?: boolean }} [opts]
 * @returns {{
 *   operations: Array<
 *     | { kind: 'create', label: Label }
 *     | { kind: 'update', previousName: string, label: Label }
 *     | { kind: 'delete', name: string }
 *   >,
 *   extras: string[]
 * }}
 */
export function planLabelSync(desired, existing, opts = {}) {
  const prune = opts.prune === true;
  const existingByName = new Map(existing.map((label) => [label.name.toLowerCase(), label]));
  const desiredNames = new Set(desired.map((label) => label.name.toLowerCase()));
  /** @type {Array<{ kind: 'create', label: Label } | { kind: 'update', previousName: string, label: Label } | { kind: 'delete', name: string }>} */
  const operations = [];
  /** @type {string[]} */
  const extras = [];

  for (const label of desired) {
    const found = existingByName.get(label.name.toLowerCase());
    if (!found) {
      operations.push({ kind: 'create', label });
      continue;
    }
    const color = normalizeColor(found.color ?? '');
    const description = found.description ?? '';
    if (color !== label.color || description !== label.description || found.name !== label.name) {
      operations.push({ kind: 'update', previousName: found.name, label });
    }
  }

  for (const label of existing) {
    if (desiredNames.has(label.name.toLowerCase())) continue;
    if (prune) operations.push({ kind: 'delete', name: label.name });
    else extras.push(label.name);
  }

  return { operations, extras };
}

/**
 * Arguments for `gh`, excluding the optional `--repo` flag.
 * Description is its own argv entry so the shell never evaluates it.
 * @param {{ kind: 'create', label: Label } | { kind: 'update', previousName: string, label: Label } | { kind: 'delete', name: string }} op
 * @returns {string[]}
 */
export function ghLabelArgs(op) {
  if (op.kind === 'create') {
    return [
      'label',
      'create',
      op.label.name,
      '--color',
      op.label.color,
      '--description',
      op.label.description,
    ];
  }
  if (op.kind === 'update') {
    const args = [
      'label',
      'edit',
      op.previousName,
      '--color',
      op.label.color,
      '--description',
      op.label.description,
    ];
    if (op.previousName !== op.label.name) args.push('--name', op.label.name);
    return args;
  }
  if (op.kind === 'delete') {
    return ['label', 'delete', op.name, '--yes'];
  }
  throw new Error('unknown label operation');
}

/**
 * @param {{ operations: Array<{ kind: string, label?: Label, name?: string, previousName?: string }>, extras: string[] }} plan
 * @returns {string[]}
 */
export function formatPlan(plan) {
  /** @type {string[]} */
  const lines = [];
  for (const op of plan.operations) {
    if (op.kind === 'create' && op.label) lines.push(`create ${op.label.name}`);
    else if (op.kind === 'update' && op.label) lines.push(`update ${op.label.name}`);
    else if (op.kind === 'delete' && op.name) lines.push(`delete ${op.name}`);
  }
  if (plan.operations.length === 0) lines.push('labels are in sync');
  for (const name of plan.extras) lines.push(`leave ${name}`);
  return lines;
}

/**
 * Labels to add from an issue form body. Never removes a label.
 * iOS and Android both map to `mobile`. A privacy report is always `P0`.
 * @param {{ title?: string, body?: string, existingLabels?: string[] }} input
 * @returns {string[]}
 */
export function labelsToAdd(input) {
  const title = input.title ?? '';
  const body = input.body ?? '';
  const existingLabels = input.existingLabels ?? [];
  const existing = new Set(existingLabels);
  /** @type {string[]} */
  const add = [];
  const platform = platformLabel(body);
  if (platform && !existing.has(platform)) add.push(platform);
  const severity = isPrivacy({ title, body, existingLabels }) ? 'P0' : severityLabel(body);
  if (severity && !existing.has(severity)) add.push(severity);
  return add;
}

/**
 * @param {string} body
 * @returns {string | null}
 */
function platformLabel(body) {
  const text = sectionBody(body, 'Platform');
  if (!text) return null;
  const line = firstContentLine(text);
  if (!line) return null;
  return PLATFORM_LABELS.get(line.toLowerCase()) ?? null;
}

/**
 * @param {string} body
 * @returns {string | null}
 */
function severityLabel(body) {
  const text = sectionBody(body, 'Severity');
  if (!text) return null;
  const line = firstContentLine(text);
  if (!line) return null;
  const match = /^P[012]\b/.exec(line);
  return match ? match[0] : null;
}

/**
 * @param {{ title: string, body: string, existingLabels: string[] }} input
 * @returns {boolean}
 */
function isPrivacy(input) {
  if (input.existingLabels.includes('privacy')) return true;
  if (input.title.trim().toLowerCase().startsWith('privacy:')) return true;
  return input.body.includes(PRIVACY_MARKER);
}

/**
 * @param {string} body
 * @param {string} heading
 * @returns {string | null}
 */
function sectionBody(body, heading) {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  const target = `### ${heading}`;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() !== target) continue;
    /** @type {string[]} */
    const collected = [];
    for (let next = index + 1; next < lines.length; next += 1) {
      if (lines[next].startsWith('### ')) break;
      collected.push(lines[next]);
    }
    const text = collected.join('\n').trim();
    if (text === '' || text === '_No response_') return null;
    return text;
  }
  return null;
}

/**
 * @param {string} text
 * @returns {string | null}
 */
function firstContentLine(text) {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed !== '') return trimmed;
  }
  return null;
}

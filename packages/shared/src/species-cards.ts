import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { type ZodError } from 'zod';

import {
  RegionIdSchema,
  SpeciesCardFrontMatterSchema,
  type RegionId,
  type SpeciesCardFrontMatter,
  type SpeciesCardStatus,
} from './data-schemas.js';

export type ParsedSpeciesCard = {
  readonly region: RegionId;
  readonly slug: string;
  readonly filePath: string;
  readonly scientificName: string;
  readonly bodyMd: string;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly ethicsMd: string | null;
  readonly legalMd: string | null;
  readonly status: SpeciesCardStatus;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
};

function formatZodError(label: string, error: ZodError): string {
  const lines = error.issues.map((issue) => {
    const pathLabel = issue.path.length > 0 ? issue.path.map(String).join('.') : '(root)';
    return `  - ${pathLabel}: ${issue.message}`;
  });
  return `${label} is invalid:\n${lines.join('\n')}`;
}

function emptyToNull(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Derive load status from review stamps (T8.1 acceptance).
 * Missing `reviewedBy` (or `reviewedAt`) → `draft`.
 */
export function resolveSpeciesCardStatus(
  frontMatter: Pick<SpeciesCardFrontMatter, 'reviewedBy' | 'reviewedAt'>,
): SpeciesCardStatus {
  const reviewedBy = frontMatter.reviewedBy?.trim();
  if (reviewedBy === undefined || reviewedBy.length === 0) {
    return 'draft';
  }
  if (frontMatter.reviewedAt === undefined) {
    return 'draft';
  }
  return 'reviewed';
}

/**
 * Split `---` YAML front-matter from the Markdown body.
 * Throws with a clear message when the fence is missing or empty.
 */
export function splitMarkdownFrontMatter(raw: string): { frontMatterRaw: string; body: string } {
  const normalised = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalised.startsWith('---\n') && normalised !== '---') {
    throw new Error('species card must start with YAML front-matter (`---`)');
  }
  const end = normalised.indexOf('\n---', 3);
  if (end === -1) {
    throw new Error('species card front-matter is missing the closing `---`');
  }
  const frontMatterRaw = normalised.slice(4, end);
  let body = normalised.slice(end + 4);
  if (body.startsWith('\n')) {
    body = body.slice(1);
  }
  return { frontMatterRaw, body };
}

export type SpeciesCardParseMeta = {
  readonly region: RegionId;
  readonly slug: string;
  readonly filePath: string;
};

/** Parse and Zod-validate one species card Markdown file. */
export function parseSpeciesCardMarkdown(
  raw: string,
  meta: SpeciesCardParseMeta,
): ParsedSpeciesCard {
  const { frontMatterRaw, body } = splitMarkdownFrontMatter(raw);
  let yamlValue: unknown;
  try {
    yamlValue = parseYaml(frontMatterRaw.length > 0 ? frontMatterRaw : '{}');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${meta.filePath}: front-matter YAML parse failed: ${message}`);
  }

  const parsed = SpeciesCardFrontMatterSchema.safeParse(yamlValue ?? {});
  if (!parsed.success) {
    throw new Error(formatZodError(meta.filePath, parsed.error));
  }

  const bodyMd = body.trim();
  if (bodyMd.length === 0) {
    throw new Error(`${meta.filePath}: Markdown body is empty`);
  }

  const status = resolveSpeciesCardStatus(parsed.data);
  const reviewedBy = status === 'reviewed' ? (parsed.data.reviewedBy?.trim() ?? null) : null;
  const reviewedAt = status === 'reviewed' ? (parsed.data.reviewedAt ?? null) : null;

  return {
    region: meta.region,
    slug: meta.slug,
    filePath: meta.filePath,
    scientificName: parsed.data.scientificName,
    bodyMd,
    settings: parsed.data.settings,
    ethicsMd: emptyToNull(parsed.data.ethicsMd),
    legalMd: emptyToNull(parsed.data.legalMd),
    status,
    reviewedBy,
    reviewedAt,
  };
}

/** Region + slug from `…/<region>/<slug>.md`. */
export function metaFromSpeciesCardPath(filePath: string): SpeciesCardParseMeta {
  const slug = path.basename(filePath, '.md');
  if (slug.length === 0 || slug === '.md') {
    throw new Error(`${filePath}: invalid species card file name`);
  }
  const regionRaw = path.basename(path.dirname(filePath));
  const region = RegionIdSchema.safeParse(regionRaw);
  if (!region.success) {
    throw new Error(
      `${filePath}: parent directory must be a beta region (scotland|sindh), got "${regionRaw}"`,
    );
  }
  return { region: region.data, slug, filePath };
}

/**
 * List `*.md` under `data/species-cards/{scotland,sindh}/` (non-recursive per region).
 * Missing region folders are ignored; other top-level entries are skipped.
 */
export async function listSpeciesCardFiles(cardsRoot: string): Promise<string[]> {
  const files: string[] = [];
  let regionDirs: string[];
  try {
    regionDirs = await readdir(cardsRoot);
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  for (const regionName of regionDirs.sort()) {
    const region = RegionIdSchema.safeParse(regionName);
    if (!region.success) {
      continue;
    }
    const regionDir = path.join(cardsRoot, region.data);
    const entries = await readdir(regionDir);
    for (const entry of entries.sort()) {
      if (!entry.endsWith('.md')) {
        continue;
      }
      files.push(path.join(regionDir, entry));
    }
  }
  return files;
}

/** Read, parse and validate every species card under `cardsRoot`. */
export async function loadSpeciesCardsFromDir(cardsRoot: string): Promise<ParsedSpeciesCard[]> {
  const paths = await listSpeciesCardFiles(cardsRoot);
  const cards: ParsedSpeciesCard[] = [];
  for (const filePath of paths) {
    const raw = await readFile(filePath, 'utf8');
    cards.push(parseSpeciesCardMarkdown(raw, metaFromSpeciesCardPath(filePath)));
  }
  return cards;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

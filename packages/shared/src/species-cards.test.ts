import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SpeciesCardFrontMatterSchema } from './data-schemas.js';
import {
  loadSpeciesCardsFromDir,
  parseSpeciesCardMarkdown,
  resolveSpeciesCardStatus,
  splitMarkdownFrontMatter,
} from './species-cards.js';

const meta = {
  region: 'scotland' as const,
  slug: 'common-kingfisher',
  filePath: 'data/species-cards/scotland/common-kingfisher.md',
};

describe('SpeciesCardFrontMatterSchema', () => {
  it('accepts minimal front-matter without review stamps', () => {
    const parsed = SpeciesCardFrontMatterSchema.parse({
      scientificName: 'Alcedo atthis',
    });
    expect(parsed.scientificName).toBe('Alcedo atthis');
    expect(parsed.settings).toEqual({});
    expect(parsed.reviewedBy).toBeUndefined();
  });

  it('rejects empty scientificName', () => {
    const result = SpeciesCardFrontMatterSchema.safeParse({ scientificName: '' });
    expect(result.success).toBe(false);
  });
});

describe('resolveSpeciesCardStatus', () => {
  it('loads as draft when reviewedBy is missing (T8.1 acceptance)', () => {
    expect(resolveSpeciesCardStatus({})).toBe('draft');
    expect(resolveSpeciesCardStatus({ reviewedAt: '2026-11-01T12:00:00.000Z' })).toBe('draft');
  });

  it('loads as draft when reviewedAt is missing', () => {
    expect(resolveSpeciesCardStatus({ reviewedBy: 'Arsalan' })).toBe('draft');
  });

  it('loads as reviewed when both stamps are present', () => {
    expect(
      resolveSpeciesCardStatus({
        reviewedBy: 'Arsalan',
        reviewedAt: '2026-11-01T12:00:00.000Z',
      }),
    ).toBe('reviewed');
  });
});

describe('parseSpeciesCardMarkdown', () => {
  it('parses body, settings and draft status when reviewedBy is missing', () => {
    const raw = `---
scientificName: Alcedo atthis
settings:
  perched:
    shutter: "1/1000"
    iso: 400
ethicsMd: |
  No baiting.
legalMd: Follow local wildlife law.
---

## Fieldcraft

Look along quiet rivers at dawn.
`;
    const card = parseSpeciesCardMarkdown(raw, meta);
    expect(card.status).toBe('draft');
    expect(card.reviewedBy).toBeNull();
    expect(card.reviewedAt).toBeNull();
    expect(card.scientificName).toBe('Alcedo atthis');
    expect(card.settings).toEqual({ perched: { shutter: '1/1000', iso: 400 } });
    expect(card.ethicsMd).toBe('No baiting.');
    expect(card.legalMd).toBe('Follow local wildlife law.');
    expect(card.bodyMd).toContain('Look along quiet rivers at dawn.');
  });

  it('keeps reviewed stamps only when status is reviewed', () => {
    const raw = `---
scientificName: Alcedo atthis
reviewedBy: Arsalan
reviewedAt: 2026-11-01T12:00:00.000Z
---

Reviewed fieldcraft notes.
`;
    const card = parseSpeciesCardMarkdown(raw, meta);
    expect(card.status).toBe('reviewed');
    expect(card.reviewedBy).toBe('Arsalan');
    expect(card.reviewedAt).toBe('2026-11-01T12:00:00.000Z');
  });

  it('rejects cards without front-matter or with an empty body', () => {
    expect(() => parseSpeciesCardMarkdown('# No fence\n', meta)).toThrow(/front-matter/);
    expect(() =>
      parseSpeciesCardMarkdown(
        `---
scientificName: Alcedo atthis
---

`,
        meta,
      ),
    ).toThrow(/empty/);
  });

  it('rejects invalid front-matter with a clear Zod path', () => {
    expect(() =>
      parseSpeciesCardMarkdown(
        `---
scientificName: Alcedo atthis
reviewedAt: not-a-date
---

Body.
`,
        meta,
      ),
    ).toThrow(/reviewedAt/);
  });
});

describe('splitMarkdownFrontMatter', () => {
  it('strips BOM and normalises CRLF', () => {
    const { frontMatterRaw, body } = splitMarkdownFrontMatter(
      '\uFEFF---\r\nscientificName: Alcedo atthis\r\n---\r\n\r\nBody line.\r\n',
    );
    expect(frontMatterRaw).toContain('scientificName: Alcedo atthis');
    expect(body.trim()).toBe('Body line.');
  });
});

describe('loadSpeciesCardsFromDir', () => {
  it('loads region folders and skips non-md / unknown dirs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'ww-cards-'));
    await mkdir(path.join(root, 'scotland'), { recursive: true });
    await mkdir(path.join(root, 'other'), { recursive: true });
    await writeFile(
      path.join(root, 'scotland', 'common-kingfisher.md'),
      `---
scientificName: Alcedo atthis
---

Scotland draft card.
`,
      'utf8',
    );
    await writeFile(path.join(root, 'scotland', '.gitkeep'), '', 'utf8');
    await writeFile(
      path.join(root, 'other', 'ignore-me.md'),
      `---
scientificName: X
---

Nope.
`,
      'utf8',
    );

    const cards = await loadSpeciesCardsFromDir(root);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.region).toBe('scotland');
    expect(cards[0]?.slug).toBe('common-kingfisher');
    expect(cards[0]?.status).toBe('draft');
  });
});

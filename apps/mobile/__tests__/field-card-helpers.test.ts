import { isReviewedCard, parseCardSettings } from '@/lib/field-card';
import { parseInlines, parseMarkdown } from '@/lib/markdown';
import type { SpeciesCardSummary } from '@/lib/species';

const REVIEWED: SpeciesCardSummary = {
  bodyMd: '## Fieldcraft\n\nStay low.',
  settings: { perched: { shutter: '1/1000', iso: 400 } },
  ethicsMd: 'No playback.',
  legalMd: 'Schedule 1 licence needed at nests.',
  reviewedBy: 'Alex Reviewer',
  reviewedAt: '2026-01-10T00:00:00.000Z',
};

describe('field card helpers (T6.6)', () => {
  it('accepts only reviewed cards with a valid review date', () => {
    expect(isReviewedCard(REVIEWED)).toBe(true);
    expect(isReviewedCard(null)).toBe(false);
    expect(
      isReviewedCard({
        ...REVIEWED,
        reviewedBy: '   ',
      }),
    ).toBe(false);
    expect(
      isReviewedCard({
        ...REVIEWED,
        reviewedAt: 'not-a-date',
      }),
    ).toBe(false);
    expect(
      isReviewedCard({
        ...REVIEWED,
        bodyMd: '  ',
      }),
    ).toBe(false);
  });

  it('parses nested scene settings and flat rows', () => {
    const parsed = parseCardSettings({
      shutter: '1/500',
      perched: { shutter: '1/1000', aperture: 'f/5.6', iso: 400 },
      in_flight: { shutter_speed: '1/2000', focus_mode: 'AF-C', drive_mode: 'continuous' },
      lowLight: { iso: 1600 },
    });

    expect(parsed.rows).toEqual([{ key: 'shutter', value: '1/500' }]);
    expect(parsed.scenes.map((scene) => scene.id)).toEqual(['perched', 'flight', 'lowLight']);
    expect(parsed.scenes[0]?.rows).toEqual(
      expect.arrayContaining([
        { key: 'shutter', value: '1/1000' },
        { key: 'aperture', value: 'f/5.6' },
        { key: 'iso', value: '400' },
      ]),
    );
    expect(parsed.scenes[1]?.rows).toEqual(
      expect.arrayContaining([
        { key: 'shutter', value: '1/2000' },
        { key: 'focusMode', value: 'AF-C' },
        { key: 'driveMode', value: 'continuous' },
      ]),
    );
  });
});

describe('markdown parser (T6.6)', () => {
  it('parses headings, lists and inline styles', () => {
    const blocks = parseMarkdown(
      '## Fieldcraft\n\nStay **quiet** near water.\n\n- No baiting\n- No *playback*\n\n1. Keep distance\n2. Leave nests alone\n',
    );

    expect(blocks[0]).toMatchObject({ type: 'heading', level: 2 });
    expect(blocks[1]).toMatchObject({ type: 'paragraph' });
    expect(blocks[2]).toMatchObject({ type: 'ul' });
    expect(blocks[3]).toMatchObject({ type: 'ol' });

    const inlines = parseInlines('Use `1/1000` and **stay low**.');
    expect(inlines).toEqual([
      { type: 'text', text: 'Use ' },
      { type: 'code', text: '1/1000' },
      { type: 'text', text: ' and ' },
      { type: 'bold', text: 'stay low' },
      { type: 'text', text: '.' },
    ]);
  });
});

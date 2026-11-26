/**
 * Minimal Markdown → block AST for curated field-card copy.
 * Supports ATX headings (1–3), paragraphs, unordered/ordered lists, and
 * inline **bold**, *italic*, and `code`. No HTML, no images, no links.
 */

export type MdInline =
  | { readonly type: 'text'; readonly text: string }
  | { readonly type: 'bold'; readonly text: string }
  | { readonly type: 'italic'; readonly text: string }
  | { readonly type: 'code'; readonly text: string };

export type MdBlock =
  | { readonly type: 'heading'; readonly level: 1 | 2 | 3; readonly inlines: readonly MdInline[] }
  | { readonly type: 'paragraph'; readonly inlines: readonly MdInline[] }
  | { readonly type: 'ul'; readonly items: readonly (readonly MdInline[])[] }
  | { readonly type: 'ol'; readonly items: readonly (readonly MdInline[])[] };

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;

/** Parse a single line of inline Markdown into styled runs. */
export function parseInlines(source: string): MdInline[] {
  const parts: MdInline[] = [];
  let last = 0;
  for (const match of source.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > last) {
      parts.push({ type: 'text', text: source.slice(last, index) });
    }
    const token = match[0] ?? '';
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      parts.push({ type: 'bold', text: token.slice(2, -2) });
    } else if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      parts.push({ type: 'italic', text: token.slice(1, -1) });
    } else if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      parts.push({ type: 'code', text: token.slice(1, -1) });
    } else {
      parts.push({ type: 'text', text: token });
    }
    last = index + token.length;
  }
  if (last < source.length) {
    parts.push({ type: 'text', text: source.slice(last) });
  }
  return parts.length > 0 ? parts : [{ type: 'text', text: '' }];
}

function headingLevel(line: string): 1 | 2 | 3 | null {
  const match = /^(#{1,3})\s+(.+)$/.exec(line);
  if (match === null) {
    return null;
  }
  const hashes = match[1];
  if (hashes === undefined) {
    return null;
  }
  const level = hashes.length;
  if (level === 1 || level === 2 || level === 3) {
    return level;
  }
  return null;
}

function unorderedItem(line: string): string | null {
  const match = /^[-*+]\s+(.+)$/.exec(line);
  return match?.[1] ?? null;
}

function orderedItem(line: string): string | null {
  const match = /^\d+[.)]\s+(.+)$/.exec(line);
  return match?.[1] ?? null;
}

/** Parse curated Markdown into a short block list for React Native rendering. */
export function parseMarkdown(source: string): MdBlock[] {
  const normalised = source.replace(/\r\n/g, '\n').trim();
  if (normalised.length === 0) {
    return [];
  }

  const lines = normalised.split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i] ?? '';
    const line = raw.trimEnd();
    if (line.trim().length === 0) {
      i += 1;
      continue;
    }

    const level = headingLevel(line.trim());
    if (level !== null) {
      const text = line.trim().replace(/^#{1,3}\s+/, '');
      blocks.push({ type: 'heading', level, inlines: parseInlines(text) });
      i += 1;
      continue;
    }

    const ulFirst = unorderedItem(line.trim());
    if (ulFirst !== null) {
      const items: (readonly MdInline[])[] = [parseInlines(ulFirst)];
      i += 1;
      while (i < lines.length) {
        const next = (lines[i] ?? '').trim();
        if (next.length === 0) {
          break;
        }
        const item = unorderedItem(next);
        if (item === null) {
          break;
        }
        items.push(parseInlines(item));
        i += 1;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    const olFirst = orderedItem(line.trim());
    if (olFirst !== null) {
      const items: (readonly MdInline[])[] = [parseInlines(olFirst)];
      i += 1;
      while (i < lines.length) {
        const next = (lines[i] ?? '').trim();
        if (next.length === 0) {
          break;
        }
        const item = orderedItem(next);
        if (item === null) {
          break;
        }
        items.push(parseInlines(item));
        i += 1;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    const paragraphLines: string[] = [line.trim()];
    i += 1;
    while (i < lines.length) {
      const nextRaw = lines[i] ?? '';
      const next = nextRaw.trim();
      if (next.length === 0) {
        break;
      }
      if (
        headingLevel(next) !== null ||
        unorderedItem(next) !== null ||
        orderedItem(next) !== null
      ) {
        break;
      }
      paragraphLines.push(next);
      i += 1;
    }
    blocks.push({ type: 'paragraph', inlines: parseInlines(paragraphLines.join(' ')) });
  }

  return blocks;
}

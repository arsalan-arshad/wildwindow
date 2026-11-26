import { parseMarkdown, type MdInline } from '@/lib/markdown';

export type MarkdownBodyProps = {
  readonly source: string;
  readonly testId?: string;
};

function InlineRuns({ inlines }: { readonly inlines: readonly MdInline[] }) {
  return (
    <>
      {inlines.map((part, index) => {
        const key = `${part.type}-${String(index)}`;
        if (part.type === 'bold') {
          return (
            <strong key={key} className="font-semibold text-ink">
              {part.text}
            </strong>
          );
        }
        if (part.type === 'italic') {
          return (
            <em key={key} className="italic">
              {part.text}
            </em>
          );
        }
        if (part.type === 'code') {
          return (
            <code
              key={key}
              className="rounded bg-mist px-1 py-0.5 font-mono text-[0.9em] text-ink-muted"
            >
              {part.text}
            </code>
          );
        }
        return <span key={key}>{part.text}</span>;
      })}
    </>
  );
}

/** Renders curated Markdown for reviewed field cards (no HTML / images / links). */
export function MarkdownBody({ source, testId }: MarkdownBodyProps) {
  const blocks = parseMarkdown(source);
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 text-base leading-relaxed text-ink" data-testid={testId}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${String(index)}`;
        if (block.type === 'heading') {
          const className =
            block.level === 1
              ? 'font-[family-name:var(--font-fraunces)] text-2xl text-forest-800'
              : block.level === 2
                ? 'font-[family-name:var(--font-fraunces)] text-xl text-forest-800'
                : 'font-[family-name:var(--font-fraunces)] text-lg text-forest-800';
          const Tag = block.level === 1 ? 'h3' : block.level === 2 ? 'h4' : 'h5';
          return (
            <Tag key={key} className={className}>
              <InlineRuns inlines={block.inlines} />
            </Tag>
          );
        }
        if (block.type === 'ul' || block.type === 'ol') {
          const ListTag = block.type === 'ul' ? 'ul' : 'ol';
          return (
            <ListTag
              key={key}
              className={
                block.type === 'ul' ? 'list-disc space-y-1 pl-5' : 'list-decimal space-y-1 pl-5'
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-${String(itemIndex)}`}>
                  <InlineRuns inlines={item} />
                </li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={key}>
            <InlineRuns inlines={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}

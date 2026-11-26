import { StyleSheet, type TextStyle } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';
import { parseMarkdown, type MdInline } from '@/lib/markdown';

export type MarkdownBodyProps = {
  readonly source: string;
  readonly testID?: string;
};

function InlineRuns({
  inlines,
  color,
  muted,
  style,
}: {
  readonly inlines: readonly MdInline[];
  readonly color: string;
  readonly muted: string;
  readonly style?: TextStyle;
}) {
  return (
    <Text style={[styles.base, style, { color }]}>
      {inlines.map((part, index) => {
        const key = `${part.type}-${String(index)}`;
        if (part.type === 'bold') {
          return (
            <Text key={key} style={[styles.base, style, styles.bold, { color }]}>
              {part.text}
            </Text>
          );
        }
        if (part.type === 'italic') {
          return (
            <Text key={key} style={[styles.base, style, styles.italic, { color }]}>
              {part.text}
            </Text>
          );
        }
        if (part.type === 'code') {
          return (
            <Text key={key} style={[styles.base, styles.code, { color: muted }]}>
              {part.text}
            </Text>
          );
        }
        return (
          <Text key={key} style={[styles.base, style, { color }]}>
            {part.text}
          </Text>
        );
      })}
    </Text>
  );
}

/** Renders curated Markdown (headings, lists, paragraphs, basic inline) for field cards. */
export function MarkdownBody({ source, testID }: MarkdownBodyProps) {
  const color = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const blocks = parseMarkdown(source);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <View style={styles.root} testID={testID}>
      {blocks.map((block, index) => {
        const key = `${block.type}-${String(index)}`;
        if (block.type === 'heading') {
          const headingStyle =
            block.level === 1 ? styles.h1 : block.level === 2 ? styles.h2 : styles.h3;
          return (
            <InlineRuns
              key={key}
              inlines={block.inlines}
              color={color}
              muted={muted}
              style={headingStyle}
            />
          );
        }
        if (block.type === 'ul' || block.type === 'ol') {
          return (
            <View key={key} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={`${key}-item-${String(itemIndex)}`} style={styles.listItem}>
                  <Text style={[styles.bullet, { color: muted }]}>
                    {block.type === 'ol' ? `${String(itemIndex + 1)}.` : '•'}
                  </Text>
                  <View style={styles.listBody}>
                    <InlineRuns inlines={item} color={color} muted={muted} />
                  </View>
                </View>
              ))}
            </View>
          );
        }
        return (
          <View key={key} style={styles.paragraph}>
            <InlineRuns inlines={block.inlines} color={color} muted={muted} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
    backgroundColor: 'transparent',
  },
  base: {
    fontSize: 15,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '700',
  },
  italic: {
    fontStyle: 'italic',
  },
  code: {
    fontFamily: 'SpaceMono',
    fontSize: 13,
  },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  h2: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  h3: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  paragraph: {
    backgroundColor: 'transparent',
  },
  list: {
    gap: 6,
    backgroundColor: 'transparent',
  },
  listItem: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: 'transparent',
  },
  bullet: {
    fontSize: 15,
    lineHeight: 22,
    minWidth: 18,
  },
  listBody: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

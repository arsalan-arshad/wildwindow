import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ShareCardPreview } from '@/components/share/ShareCardPreview';
import { Text, View } from '@/components/Themed';
import type { ShareCardTarget } from '@/lib/share-cards';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

function parseTarget(params: {
  readonly kind?: string | string[];
  readonly taxonId?: string | string[];
  readonly cell?: string | string[];
  readonly start?: string | string[];
  readonly entryId?: string | string[];
  readonly slug?: string | string[];
}): ShareCardTarget | null {
  const kind = firstParam(params.kind);
  if (kind === 'forecast') {
    const taxonId = firstParam(params.taxonId);
    const cell = firstParam(params.cell);
    const start = firstParam(params.start);
    if (
      taxonId === undefined ||
      taxonId.length === 0 ||
      cell === undefined ||
      cell.length === 0 ||
      start === undefined ||
      start.length === 0
    ) {
      return null;
    }
    return { kind: 'forecast', taxonId, cell, start };
  }
  if (kind === 'challenge') {
    const entryId = firstParam(params.entryId);
    if (entryId === undefined || entryId.length === 0) {
      return null;
    }
    const slug = firstParam(params.slug);
    return slug !== undefined && slug.length > 0
      ? { kind: 'challenge', entryId, slug }
      : { kind: 'challenge', entryId };
  }
  return null;
}

export default function ShareCardScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    kind?: string | string[];
    taxonId?: string | string[];
    cell?: string | string[];
    start?: string | string[];
    entryId?: string | string[];
    slug?: string | string[];
  }>();
  const target = parseTarget(params);

  if (target === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ title: t('share.title') }} />
        <Text>{t('share.missing')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('share.title') }} />
      <ShareCardPreview target={target} />
    </>
  );
}

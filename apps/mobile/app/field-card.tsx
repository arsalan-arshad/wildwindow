import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { FieldCardView } from '@/components/species/FieldCardView';
import { Text, View } from '@/components/Themed';
import { usePreferences } from '@/lib/preferences-context';
import type { RegionId } from '@/lib/regions';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

export default function FieldCardScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ taxonId?: string | string[] }>();
  const { region } = usePreferences();
  const taxonId = firstParam(params.taxonId);
  const regionSlug: RegionId = region ?? 'scotland';

  if (taxonId === undefined || taxonId.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ title: t('species.fieldCard.title') }} />
        <Text>{t('species.fieldCard.missing')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('species.fieldCard.title') }} />
      <FieldCardView taxonId={taxonId} region={regionSlug} />
    </>
  );
}

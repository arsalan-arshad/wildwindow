import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { SpeciesDetailView } from '@/components/species/SpeciesDetailView';
import { Text, View } from '@/components/Themed';
import { usePreferences } from '@/lib/preferences-context';
import type { RegionId } from '@/lib/regions';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

export default function SpeciesDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ taxonId?: string | string[] }>();
  const { region } = usePreferences();
  const taxonId = firstParam(params.taxonId);
  const regionSlug: RegionId = region ?? 'scotland';

  if (taxonId === undefined || taxonId.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ title: t('species.detail.title') }} />
        <Text>{t('species.detail.missing')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('species.detail.title') }} />
      <SpeciesDetailView
        taxonId={taxonId}
        region={regionSlug}
        onGetForecast={(id) => {
          // Area picker (T6.4) owns the next step; pass taxon through for now.
          router.push(`/area?taxonId=${encodeURIComponent(id)}` as never);
        }}
        onOpenFieldCard={(id) => {
          router.push(`/field-card?taxonId=${encodeURIComponent(id)}` as never);
        }}
      />
    </>
  );
}

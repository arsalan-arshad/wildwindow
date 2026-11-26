import { Stack, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ForecastDetailView } from '@/components/forecast/ForecastDetailView';
import { Text, View } from '@/components/Themed';
import { usePreferences } from '@/lib/preferences-context';
import type { RegionId } from '@/lib/regions';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

export default function ForecastScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{
    taxonId?: string | string[];
    cell?: string | string[];
  }>();
  const { region } = usePreferences();
  const taxonId = firstParam(params.taxonId);
  const cell = firstParam(params.cell);
  const regionSlug: RegionId = region ?? 'scotland';

  if (taxonId === undefined || taxonId.length === 0 || cell === undefined || cell.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ title: t('forecast.title') }} />
        <Text>{t('forecast.missing')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('forecast.title') }} />
      <ForecastDetailView taxonId={taxonId} cell={cell} region={regionSlug} />
    </>
  );
}

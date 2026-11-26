import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AreaPicker } from '@/components/area/AreaPicker';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

export default function AreaScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ taxonId?: string | string[] }>();
  const taxonId = firstParam(params.taxonId);

  return (
    <>
      <Stack.Screen options={{ title: t('area.picker.title') }} />
      <AreaPicker
        {...(taxonId !== undefined && taxonId.length > 0 ? { taxonId } : {})}
        onContinue={({ taxonId: id, cellR7 }) => {
          // Forecast detail (T6.5) owns the next screen.
          router.push(
            `/forecast?taxonId=${encodeURIComponent(id)}&cell=${encodeURIComponent(cellR7)}` as never,
          );
        }}
      />
    </>
  );
}

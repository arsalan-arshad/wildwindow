import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LogbookEntryDetail } from '@/components/logbook/LogbookEntryDetail';
import { Text, View, useThemeColor } from '@/components/Themed';

export default function LogbookEntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const muted = useThemeColor({}, 'textMuted');
  const raw = params.id;
  const entryId = Array.isArray(raw) ? raw[0] : raw;

  if (entryId === undefined || entryId.length === 0) {
    return (
      <View style={{ flex: 1, padding: 24 }}>
        <Stack.Screen options={{ title: t('logbook.detail.title') }} />
        <Text style={{ color: muted }}>{t('logbook.detail.missing')}</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('logbook.detail.title') }} />
      <LogbookEntryDetail
        entryId={entryId}
        onDeleted={() => {
          router.replace('/(tabs)/logbook');
        }}
      />
    </View>
  );
}

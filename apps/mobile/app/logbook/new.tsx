import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LogbookEntryForm } from '@/components/logbook/LogbookEntryForm';
import { View } from '@/components/Themed';

export default function NewLogbookEntryScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('logbook.form.title') }} />
      <LogbookEntryForm
        onCreated={(id) => {
          router.replace(`/logbook/${encodeURIComponent(id)}`);
        }}
      />
    </View>
  );
}

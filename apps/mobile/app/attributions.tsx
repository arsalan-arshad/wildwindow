import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AttributionsView } from '@/components/profile/AttributionsView';
import { View } from '@/components/Themed';

export default function AttributionsScreen() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{ title: t('attributions.title'), headerBackTitle: t('onboarding.back') }}
      />
      <AttributionsView />
    </View>
  );
}

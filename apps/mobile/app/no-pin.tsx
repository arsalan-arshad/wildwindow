import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { NoPinPromise } from '@/components/no-pin/NoPinPromise';
import { View } from '@/components/Themed';

export default function NoPinScreen() {
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('noPin.title'), headerBackTitle: t('onboarding.back') }} />
      <NoPinPromise />
    </View>
  );
}

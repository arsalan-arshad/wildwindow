import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ChallengeSubmitForm } from '@/components/challenge/ChallengeSubmitForm';
import { Text, View } from '@/components/Themed';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

export default function ChallengeSubmitScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ slug?: string | string[] }>();
  const slug = firstParam(params.slug);

  if (slug === undefined || slug.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ title: t('challenge.submit.title') }} />
        <Text>{t('challenge.submit.missing')}</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t('challenge.submit.title') }} />
      <ChallengeSubmitForm
        slug={slug}
        onSignIn={() => {
          router.push('/sign-in');
        }}
        onSubmitted={() => {
          router.replace('/(tabs)/challenge' as never);
        }}
      />
    </>
  );
}

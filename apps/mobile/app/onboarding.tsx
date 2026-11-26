import { Redirect, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { View, useThemeColor } from '@/components/Themed';
import { usePreferences } from '@/lib/preferences-context';
import type { RegionId } from '@/lib/regions';

export default function OnboardingScreen() {
  const router = useRouter();
  const { ready, onboardingComplete, finishOnboarding } = usePreferences();
  const tint = useThemeColor({}, 'tint');

  if (!ready) {
    return (
      <View style={styles.loading} testID="onboarding-loading">
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (onboardingComplete) {
    return <Redirect href="/(tabs)" />;
  }

  async function handleComplete(region: RegionId) {
    await finishOnboarding(region);
    router.replace('/(tabs)');
  }

  return (
    <OnboardingFlow
      onComplete={handleComplete}
      onOpenNoPin={() => {
        router.push('/no-pin');
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

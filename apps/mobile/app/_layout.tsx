import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useColorScheme } from '@/components/useColorScheme';
import { View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { initSentry } from '@/lib/sentry';
import { usePreferences } from '@/lib/preferences-context';
import { AppProviders } from '@/providers/app-providers';

export { ErrorBoundary };

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();
initSentry();

const LightNavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.tint,
    background: Colors.light.background,
    card: Colors.light.surface,
    text: Colors.light.text,
    border: Colors.light.border,
  },
};

const DarkNavTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.tint,
    background: Colors.dark.background,
    card: Colors.dark.surface,
    text: Colors.dark.text,
    border: Colors.dark.border,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AppProviders>
      <RootLayoutNav />
    </AppProviders>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { ready, onboardingComplete } = usePreferences();
  const segments = useSegments();
  const router = useRouter();
  const tint = Colors[colorScheme].tint;

  useEffect(() => {
    if (!ready) return;

    const root = segments[0];
    const inOnboarding = root === 'onboarding';
    const inNoPin = root === 'no-pin';

    if (!onboardingComplete && !inOnboarding && !inNoPin) {
      router.replace('/onboarding');
      return;
    }

    if (onboardingComplete && inOnboarding) {
      router.replace('/(tabs)');
    }
  }, [ready, onboardingComplete, segments, router]);

  if (!ready) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkNavTheme : LightNavTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="no-pin" options={{ presentation: 'card' }} />
        <Stack.Screen name="species/[taxonId]" options={{ presentation: 'card' }} />
        <Stack.Screen name="area" options={{ presentation: 'card' }} />
        <Stack.Screen name="forecast" options={{ presentation: 'card' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

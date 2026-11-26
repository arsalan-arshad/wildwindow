import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'WildWindow',
  slug: 'wildwindow',
  version: '0.0.0',
  orientation: 'portrait',
  scheme: 'wildwindow',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'studio.arsalandev.wildwindow',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'WildWindow uses your location only to snap to a coarse area cell on this device. Exact coordinates are never stored or sent.',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundColor: '#1a4030',
    },
    package: 'studio.arsalandev.wildwindow',
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-localization',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'WildWindow uses your location only to snap to a coarse area cell on this device. Exact coordinates are never stored or sent.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        backgroundColor: '#1a4030',
        resizeMode: 'contain',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiUrl: process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001',
  },
});

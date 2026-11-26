import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Expo / EAS project linkage (expo.dev). Safe to commit — not a secret.
 * Matches local `eas init`: owner + slug + extra.eas.projectId (see docs/EAS.md).
 */
const EAS_PROJECT_ID = '36e6ca10-4761-4338-b057-bee2208b142b';
const EAS_OWNER = 'arsalandev';

/**
 * Native Firebase config paths (T6.7 / T9.6).
 * Local: drop real files at these paths under apps/mobile/ (gitignored).
 * EAS cloud: upload as file env vars; Expo injects absolute paths into these names.
 * See docs/EAS.md and apps/mobile/README.md.
 */
const androidGoogleServicesFile = process.env['GOOGLE_SERVICES_JSON'] ?? './google-services.json';
const iosGoogleServicesFile = process.env['GOOGLE_SERVICES_PLIST'] ?? './GoogleService-Info.plist';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'WildWindow',
  slug: 'wildwindow',
  owner: EAS_OWNER,
  version: '0.0.0',
  orientation: 'portrait',
  scheme: 'wildwindow',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  runtimeVersion: {
    policy: 'appVersion',
  },
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'studio.arsalandev.wildwindow',
    googleServicesFile: iosGoogleServicesFile,
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
    googleServicesFile: androidGoogleServicesFile,
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
    '@sentry/react-native/expo',
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
      'expo-image-picker',
      {
        photosPermission:
          'WildWindow reads your wildlife photo so you can log camera settings. GPS is stripped on this device before upload.',
      },
    ],
    // expo-image-manipulator is a runtime dependency (logbook EXIF strip), not a
    // config plugin — listing it here makes `expo config` / `eas init` fail.
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
    // Public web origin for `/api/og/...` share cards (T6.11).
    siteUrl: process.env['EXPO_PUBLIC_SITE_URL'] ?? 'https://wildwindow.arsalandev.studio',
    // Public web-app JSON (EXPO_PUBLIC_FIREBASE_CONFIG). Empty when unset.
    firebaseConfig: process.env['EXPO_PUBLIC_FIREBASE_CONFIG'] ?? '',
    eas: {
      projectId: EAS_PROJECT_ID,
    },
  },
});

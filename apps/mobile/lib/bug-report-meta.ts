/**
 * Device / app metadata for in-app bug reports (T9.11).
 * Expo Go compatible — uses expo-constants + React Native Platform only.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { BugReportPlatform } from '@wildwindow/shared';

/** Map RN / Expo platform to the GitHub bug_report.yml dropdown values. */
export function bugReportPlatform(): BugReportPlatform {
  if (Platform.OS === 'ios') return 'iOS';
  if (Platform.OS === 'android') return 'Android';
  if (Platform.OS === 'web') return 'web';
  return 'api';
}

/** App version string from Expo config (falls back to "unknown"). */
export function bugReportAppVersion(): string {
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion;
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    (Constants.expoConfig?.android?.versionCode !== undefined
      ? String(Constants.expoConfig.android.versionCode)
      : undefined) ??
    Constants.nativeBuildVersion;

  if (typeof version === 'string' && version.trim().length > 0) {
    if (typeof build === 'string' && build.trim().length > 0) {
      return `${version.trim()} (${build.trim()})`;
    }
    return version.trim();
  }
  return 'unknown';
}

/** Short device + OS label for the GitHub "device" field. */
export function bugReportDeviceLabel(): string {
  const os = Platform.OS;
  const osVersion = Platform.Version;
  const model =
    typeof Constants.deviceName === 'string' && Constants.deviceName.trim().length > 0
      ? Constants.deviceName.trim()
      : os === 'ios'
        ? 'iOS device'
        : os === 'android'
          ? 'Android device'
          : 'device';

  if (os === 'ios' || os === 'android') {
    return `${model}, ${os} ${String(osVersion)}`;
  }
  return `${model}, ${os}`;
}

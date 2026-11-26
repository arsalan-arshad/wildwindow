export const PermissionStatus = {
  GRANTED: 'granted',
  DENIED: 'denied',
  UNDETERMINED: 'undetermined',
} as const;

export async function requestForegroundPermissionsAsync(): Promise<{ status: string }> {
  return { status: PermissionStatus.DENIED };
}

export async function getCurrentPositionAsync(): Promise<{
  coords: { latitude: number; longitude: number };
}> {
  throw new Error('expo-location mock: getCurrentPositionAsync not configured');
}

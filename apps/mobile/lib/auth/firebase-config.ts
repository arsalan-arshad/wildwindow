import Constants from 'expo-constants';
import { z } from 'zod';

/**
 * Public Firebase web-app config (ARCHITECTURE §8 / RAILWAY).
 * Loaded from `EXPO_PUBLIC_FIREBASE_CONFIG` (JSON string). Never put secrets here —
 * the web API key is expected to be restricted in the Firebase console.
 */
export const FirebaseWebConfigSchema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  appId: z.string().min(1),
  storageBucket: z.string().min(1).optional(),
  messagingSenderId: z.string().min(1).optional(),
  measurementId: z.string().min(1).optional(),
});

export type FirebaseWebConfig = z.infer<typeof FirebaseWebConfigSchema>;

function readRawConfigString(): string | undefined {
  const fromEnv = process.env['EXPO_PUBLIC_FIREBASE_CONFIG'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }

  const extra = Constants.expoConfig?.extra;
  if (
    extra !== undefined &&
    typeof extra === 'object' &&
    extra !== null &&
    'firebaseConfig' in extra
  ) {
    const value = extra['firebaseConfig'];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }
  }

  return undefined;
}

/**
 * Parse and validate the public Firebase config, or return null when unset / invalid.
 * Invalid JSON or missing fields are treated as "not configured" so the app still boots.
 */
export function readFirebaseWebConfig(): FirebaseWebConfig | null {
  const raw = readRawConfigString();
  if (raw === undefined) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  const result = FirebaseWebConfigSchema.safeParse(parsed);
  return result.success ? result.data : null;
}

export function isFirebaseConfigured(): boolean {
  return readFirebaseWebConfig() !== null;
}

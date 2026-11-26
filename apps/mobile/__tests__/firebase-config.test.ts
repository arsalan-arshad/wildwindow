import {
  FirebaseWebConfigSchema,
  isFirebaseConfigured,
  readFirebaseWebConfig,
} from '@/lib/auth/firebase-config';

describe('Firebase web config (T6.7)', () => {
  const original = process.env['EXPO_PUBLIC_FIREBASE_CONFIG'];

  afterEach(() => {
    if (original === undefined) {
      Reflect.deleteProperty(process.env, 'EXPO_PUBLIC_FIREBASE_CONFIG');
    } else {
      process.env['EXPO_PUBLIC_FIREBASE_CONFIG'] = original;
    }
  });

  it('parses a valid EXPO_PUBLIC_FIREBASE_CONFIG JSON string', () => {
    process.env['EXPO_PUBLIC_FIREBASE_CONFIG'] = JSON.stringify({
      apiKey: 'AIzaSyTest',
      authDomain: 'wildwindow.firebaseapp.com',
      projectId: 'wildwindow',
      appId: '1:123:web:abc',
      storageBucket: 'wildwindow.appspot.com',
    });

    const config = readFirebaseWebConfig();
    expect(config).toEqual({
      apiKey: 'AIzaSyTest',
      authDomain: 'wildwindow.firebaseapp.com',
      projectId: 'wildwindow',
      appId: '1:123:web:abc',
      storageBucket: 'wildwindow.appspot.com',
    });
    expect(isFirebaseConfigured()).toBe(true);
  });

  it('returns null when unset', () => {
    Reflect.deleteProperty(process.env, 'EXPO_PUBLIC_FIREBASE_CONFIG');
    expect(readFirebaseWebConfig()).toBeNull();
    expect(isFirebaseConfigured()).toBe(false);
  });

  it('returns null for invalid JSON or missing fields', () => {
    process.env['EXPO_PUBLIC_FIREBASE_CONFIG'] = '{not-json';
    expect(readFirebaseWebConfig()).toBeNull();

    process.env['EXPO_PUBLIC_FIREBASE_CONFIG'] = JSON.stringify({ apiKey: 'only' });
    expect(readFirebaseWebConfig()).toBeNull();
  });

  it('rejects empty required fields via Zod', () => {
    const result = FirebaseWebConfigSchema.safeParse({
      apiKey: '',
      authDomain: 'x.firebaseapp.com',
      projectId: 'x',
      appId: '1:1:web:x',
    });
    expect(result.success).toBe(false);
  });
});

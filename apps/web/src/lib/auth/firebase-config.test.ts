import { describe, expect, it } from 'vitest';

import { readFirebaseWebConfig } from '@/lib/auth/firebase-config';

describe('readFirebaseWebConfig', () => {
  it('returns null when unset or invalid', () => {
    expect(readFirebaseWebConfig(undefined)).toBeNull();
    expect(readFirebaseWebConfig('')).toBeNull();
    expect(readFirebaseWebConfig('{')).toBeNull();
    expect(readFirebaseWebConfig('{"apiKey":"x"}')).toBeNull();
  });

  it('parses a valid public web config', () => {
    const raw = JSON.stringify({
      apiKey: 'AIzaSyTest',
      authDomain: 'example.firebaseapp.com',
      projectId: 'example',
      appId: '1:123:web:abc',
    });
    expect(readFirebaseWebConfig(raw)).toEqual({
      apiKey: 'AIzaSyTest',
      authDomain: 'example.firebaseapp.com',
      projectId: 'example',
      appId: '1:123:web:abc',
    });
  });
});

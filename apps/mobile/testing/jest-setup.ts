import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
    })),
  },
}));

jest.mock('expo-router');
jest.mock('expo-location');
jest.mock('expo-image-picker');
jest.mock('expo-image-manipulator');
jest.mock('expo-sharing');
jest.mock('expo-file-system/legacy');
jest.mock('react-native-maps');

// Keep Jest off the real Firebase network; screens inject AuthClient mocks.
jest.mock('firebase/app', () => ({
  getApps: () => [],
  getApp: () => {
    throw new Error('firebase/app mock: getApp not expected in unit tests');
  },
  initializeApp: () => ({ name: '[DEFAULT]' }),
  FirebaseError: class FirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = 'FirebaseError';
      this.code = code;
    }
  },
}));

jest.mock('firebase/auth', () => ({
  getAuth: () => ({ currentUser: null }),
  initializeAuth: () => ({ currentUser: null }),
  onAuthStateChanged: (_auth: unknown, cb: (user: null) => void) => {
    cb(null);
    return () => undefined;
  },
  signInWithEmailAndPassword: async () => {
    throw new Error('firebase/auth mock: use AuthClient in tests');
  },
  createUserWithEmailAndPassword: async () => {
    throw new Error('firebase/auth mock: use AuthClient in tests');
  },
  signOut: async () => undefined,
}));

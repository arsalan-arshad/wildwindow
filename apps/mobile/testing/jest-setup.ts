import mockAsyncStorage from '@react-native-async-storage/async-storage/jest';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

jest.mock('expo-router');
jest.mock('expo-location');
jest.mock('react-native-maps');

export const requestMediaLibraryPermissionsAsync = jest.fn(async () => ({
  granted: true,
  status: 'granted',
}));

export const launchImageLibraryAsync = jest.fn(async () => ({
  canceled: true,
  assets: [],
}));

export default {
  requestMediaLibraryPermissionsAsync,
  launchImageLibraryAsync,
};

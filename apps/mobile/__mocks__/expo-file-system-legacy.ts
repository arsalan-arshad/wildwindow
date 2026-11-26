export const cacheDirectory = '/cache/';

export const downloadAsync = jest.fn(async (_uri: string, fileUri: string) => ({
  uri: fileUri,
  status: 200,
  headers: {},
  mimeType: 'image/png',
}));

export default {
  cacheDirectory,
  downloadAsync,
};

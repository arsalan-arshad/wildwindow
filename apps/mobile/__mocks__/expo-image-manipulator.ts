export const SaveFormat = {
  JPEG: 'jpeg',
  PNG: 'png',
  WEBP: 'webp',
} as const;

export const manipulateAsync = jest.fn(async (uri: string) => ({
  uri: `${uri}#stripped`,
  width: 100,
  height: 100,
}));

export default {
  SaveFormat,
  manipulateAsync,
};

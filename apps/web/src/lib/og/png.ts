/**
 * Read width/height from a PNG buffer (IHDR chunk).
 * Used by route acceptance tests — no extra dependency.
 */
export function readPngSize(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.byteLength < 24) {
    throw new Error('PNG too short to contain IHDR');
  }
  if (
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    throw new Error('Not a PNG');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkType = String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!) ?? '';
  if (chunkType !== 'IHDR') {
    throw new Error(`Expected IHDR, got ${chunkType}`);
  }
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

export function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  );
}

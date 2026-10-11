import { PNG } from 'pngjs';
import type { Raster } from '../src/engine';
/** Check PNG dimensions before the decoder allocates a pixel buffer. */
export function decodePng(bytes: Buffer): Raster {
  if (bytes.length > 10 * 1024 * 1024) throw new Error('The PNG must be smaller than 10 MB.');
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('The image is not a valid PNG.');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > 2048 || height > 2048) throw new Error('The PNG must be at most 2048 pixels on each side.');
  const decoded = PNG.sync.read(bytes);
  return { width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) };
}

import { MAX_IMAGE_DATA, type Raster, type SourceImage } from '../engine';

function load(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('The source image could not be read.')); image.src = url; });
}
function pixels(image: HTMLImageElement): Raster {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  return { width: canvas.width, height: canvas.height, data: new Uint8Array(context.getImageData(0, 0, canvas.width, canvas.height).data) };
}
export async function decodeImage(source: SourceImage): Promise<Raster> {
  const image = await load(source.dataUrl);
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 2048 || image.naturalHeight > 2048) throw new Error('Saved images must be at most 2048 pixels on each side.');
  return pixels(image);
}
export async function importImage(file: File): Promise<{ source: SourceImage; decoded: Raster }> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a PNG, JPG, GIF, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = await load(url);
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > MAX_IMAGE_DATA) throw new Error('The image is too large to save. Choose a smaller image.');
    const source = Object.freeze({ name: file.name.slice(0, 256), dataUrl });
    return { source, decoded: await decodeImage(source) };
  } finally { URL.revokeObjectURL(url); }
}

import type { BlockMode, Pixels } from './types';

/** Reduce styled artwork to the requested terminal width, preserving its aspect ratio. */
export function fitPixels(image: Pixels, mode: BlockMode, columns: number): Pixels {
  if (!columns) return image;
  const maxWidth = mode === 'quad' ? columns * 2 : mode === 'full' ? Math.floor(columns / 2) : columns;
  if (image.W <= maxWidth) return image;
  const W = Math.max(1, maxWidth);
  const H = Math.max(1, Math.round(image.H * W / image.W));
  const px: (string | null)[] = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const xx = Math.min(image.W - 1, Math.floor((x + 0.5) * image.W / W));
    const yy = Math.min(image.H - 1, Math.floor((y + 0.5) * image.H / H));
    px[y * W + x] = image.px[yy * image.W + xx];
  }
  return { W, H, px };
}

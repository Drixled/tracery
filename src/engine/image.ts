import { checkMaskSize, pxAspect } from './mask';
import { rgb2hex } from './color';
import type { Raster } from './raster';
import type { Mask, Settings } from './types';

/** Shared sampling makes browser and CLI image projects produce the same masks. */
export function maskFromRgba(image: Raster, S: Settings): Mask {
  const W = S.imgW;
  const H = Math.max(1, Math.round(image.height / image.width * W * pxAspect(S.mode, S.ratio)));
  checkMaskSize(W, H);
  const F = new Uint8Array(W * H);
  const C: string[] = new Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = (x + 0.5) * image.width / W - 0.5;
    const fy = (y + 0.5) * image.height / H - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    let alpha = 0, red = 0, green = 0, blue = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const xx = Math.max(0, Math.min(image.width - 1, x0 + dx));
      const yy = Math.max(0, Math.min(image.height - 1, y0 + dy));
      const i = (yy * image.width + xx) * 4;
      const weight = (dx ? fx - x0 : 1 - (fx - x0)) * (dy ? fy - y0 : 1 - (fy - y0));
      const a = image.data[i + 3] / 255 * weight;
      alpha += a; red += image.data[i] * a; green += image.data[i + 1] * a; blue += image.data[i + 2] * a;
    }
    const r = alpha ? red / alpha : 0, g = alpha ? green / alpha : 0, b = alpha ? blue / alpha : 0;
    const light = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
    const value = S.imgUse === 'alpha' ? alpha : S.imgUse === 'dark' ? alpha * (1 - light) : alpha * light;
    const i = y * W + x;
    F[i] = value * 100 >= S.thresh ? 1 : 0;
    C[i] = rgb2hex(r, g, b);
  }
  return { W, H, F, C };
}

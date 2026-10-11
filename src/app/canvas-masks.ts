import { checkMaskSize, pxAspect, rgb2hex, type Mask, type Settings } from '../engine';

/** Rasterize text with a web font into a silhouette, pre-stretched so pixels come out square in the terminal. */
export function maskFromText(S: Settings): Mask | null {
  if (!S.text.trim()) return null;
  const lines = S.text.split('\n');
  const size = S.size;
  const sx = 1 / pxAspect(S.mode, S.ratio);
  const cv = document.createElement('canvas');
  const x = cv.getContext('2d', { willReadFrequently: true })!;
  const font = `${size}px "${S.font}"`;
  x.font = font;
  const measure = (l: string) => Array.from(l).reduce((w, c) => w + x.measureText(c).width + S.tracking, 0);
  const widths = lines.map(measure);
  const lineH = Math.ceil(size * 1.35) + S.leading;
  const W = Math.ceil((Math.max(...widths) + size) * sx) + 4;
  const H = lines.length * lineH + size;
  checkMaskSize(W, H);
  cv.width = W;
  cv.height = H;
  x.font = font;
  x.textBaseline = 'top';
  x.fillStyle = '#fff';
  x.setTransform(sx, 0, 0, 1, 2, 2);
  lines.forEach((l, i) => {
    let px = 0;
    for (const c of Array.from(l)) {
      x.fillText(c, px, i * lineH + 2);
      px += x.measureText(c).width + S.tracking;
    }
  });
  const d = x.getImageData(0, 0, W, H).data;
  const F = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) F[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
  return { W, H, F };
}

/** Downsample an image into a silhouette plus its own colors. */
export function maskFromImage(img: HTMLImageElement | null, S: Settings): Mask | null {
  if (!img) return null;
  const W = S.imgW;
  const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W * pxAspect(S.mode, S.ratio)));
  const cv = document.createElement('canvas');
  checkMaskSize(W, H);
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d', { willReadFrequently: true })!;
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;
  const F = new Uint8Array(W * H);
  const C: string[] = new Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const a = d[i * 4 + 3] / 255;
    const l = (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255;
    const v = S.imgUse === 'alpha' ? a : S.imgUse === 'dark' ? a * (1 - l) : a * l;
    F[i] = v * 100 >= S.thresh ? 1 : 0;
    C[i] = rgb2hex(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  }
  return { W, H, F, C };
}

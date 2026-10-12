import type { Quantizer } from './color';
import type { Dither, Mask, Pixels, Settings } from './types';

const B2 = [[0, 2], [3, 1]];
const B4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const B8 = (() => {
  const m: number[][] = [];
  for (let y = 0; y < 8; y++) {
    m[y] = [];
    for (let x = 0; x < 8; x++) m[y][x] = 4 * B4[y & 3][x & 3] + B2[y >> 2][x >> 2];
  }
  return m;
})();

/** Ordered-dither threshold in [0, 1) for pixel (x, y). */
export function threshold(d: Dither, x: number, y: number): number {
  switch (d) {
    case 'bayer2': return (B2[y & 1][x & 1] + 0.5) / 4;
    case 'bayer8': return (B8[y & 7][x & 7] + 0.5) / 64;
    case 'checker': return (x + y) & 1 ? 0.7 : 0.3;
    case 'lines': return y & 1 ? 0.7 : 0.3;
    case 'noise': {
      let h = (x * 374761393 + y * 668265263) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    case 'none': return 0.5;
    default: return (B4[y & 3][x & 3] + 0.5) / 16;
  }
}

/** Square dilation by radius r (separable: horizontal then vertical). */
export function dilate(M: Uint8Array, W: number, H: number, r: number): Uint8Array {
  if (!r) return M.slice();
  const T = new Uint8Array(W * H);
  const O = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const xx = x + k;
        if (xx >= 0 && xx < W && M[y * W + xx]) v = 1;
      }
      T[y * W + x] = v;
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let k = -r; k <= r && !v; k++) {
        const yy = y + k;
        if (yy >= 0 && yy < H && T[yy * W + x]) v = 1;
      }
      O[y * W + x] = v;
    }
  return O;
}

/** Paint a silhouette: gradient fill, gap, outline, lip, shine, bevel, shadow. Output is cropped and quantized. */
export function stylize(m: Mask, S: Settings, q: Quantizer): Pixels | null {
  const g = S.gap;
  const o = S.outline;
  const sh = S.shadowOn ? Math.max(Math.abs(S.sdx), Math.abs(S.sdy)) : 0;
  const p = g + o + sh + 1;
  const W = m.W + 2 * p;
  const H = m.H + 2 * p;
  const F = new Uint8Array(W * H);
  const C: string[] | null = m.C ? new Array(W * H) : null;
  for (let y = 0; y < m.H; y++)
    for (let x = 0; x < m.W; x++) {
      F[(y + p) * W + x + p] = m.F[y * m.W + x];
      if (C && m.C) C[(y + p) * W + x + p] = m.C[y * m.W + x];
    }
  let top = H, bot = -1, l = W, r = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (F[y * W + x]) {
        if (y < top) top = y;
        if (y > bot) bot = y;
        if (x < l) l = x;
        if (x > r) r = x;
      }
  if (bot < 0) return null;

  const G = dilate(F, W, H, g); // body + gap
  const D = dilate(G, W, H, o); // body + gap + outline
  const at = (M: Uint8Array, x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && M[y * W + x] === 1;
  const stops = S.stops.length ? S.stops : ['#ffffff'];
  const n = stops.length;
  const spread = S.spread / 100;
  const cx = (l + r) / 2;
  const cy = (top + bot) / 2;
  // Center-to-corner distance in the same units as t below, so radial t reaches 1 at the corners.
  const rmax = Math.hypot(Math.max(1, r - l) / 4, Math.max(1, bot - top) / 2) || 1;
  const useImageColors = !!C && (S.src === 'font' ? S.tint !== 'ramp' : S.imgColors && S.src === 'image');

  const px: (string | null)[] = new Array(W * H).fill(null);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (F[i]) {
        let col: string;
        if (useImageColors && C) col = C[i];
        else {
          const ty = (y - top) / Math.max(1, bot - top);
          const tx = (x - l) / Math.max(1, r - l);
          let t =
            S.dir === 'h' ? tx
            : S.dir === 'd' ? (tx + ty) / 2
            : S.dir === 'r' ? Math.hypot((x - cx) / 2, y - cy) / rmax
            : ty;
          t = Math.max(0, Math.min(1, 0.5 + (t - 0.5) / spread));
          if (S.reverse) t = 1 - t;
          if (n === 1) col = stops[0];
          else {
            const pos = t * (n - 1);
            const k = Math.min(n - 2, Math.floor(pos));
            col = pos - k > threshold(S.dither, x, y) ? stops[k + 1] : stops[k];
          }
        }
        if (S.bevel) {
          if (!at(F, x, y - 1)) col = S.shineColor;
          else if (!at(F, x, y + 1)) col = S.lipColor;
        }
        if (
          S.shineOn && !at(F, x - 1, y) && at(F, x + 1, y) && at(F, x + 2, y) &&
          at(F, x, y - 1) && at(F, x, y + 1) && ((x + y) & 1) === 0
        ) col = S.shineColor;
        px[i] = col;
      } else if (G[i]) {
        px[i] = S.gapFillOn ? S.gapFill : null;
      } else if (D[i]) {
        let lip = false;
        if (S.lipOn) for (let k = 1; k <= o; k++) if (at(G, x, y - k)) { lip = true; break; }
        px[i] = lip ? S.lipColor : S.outlineColor;
      } else if (S.shadowOn && at(D, x - S.sdx, y - S.sdy)) {
        px[i] = S.shadowColor;
      }
    }

  // Crop to painted pixels, keeping a transparent gap ring if present.
  let y0 = H, y1 = -1, x0 = W, x1 = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (px[y * W + x] || (G[y * W + x] && !F[y * W + x])) {
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out: (string | null)[] = new Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out[y * w + x] = q.quant(px[(y + y0) * W + x + x0]);
  return { W: w, H: h, px: out };
}

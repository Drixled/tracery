import { hex2rgb } from './color';
import type { Cell } from './types';

export interface Raster {
  width: number;
  height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  data: Uint8Array;
}

/**
 * Paint terminal cells into an RGBA buffer exactly as a terminal with native block glyphs
 * would draw them. Cells are `cellW` px wide and `round(cellW * ratio)` px tall.
 * `bg` fills empty space; null leaves it transparent.
 */
export function rasterizeCells(rows: Cell[][], cols: number, cellW: number, ratio: number, bg: string | null): Raster {
  const cw = Math.max(1, Math.round(cellW));
  const chh = Math.max(2, Math.round(cellW * ratio));
  const width = Math.max(1, cols * cw);
  const height = Math.max(1, rows.length * chh);
  if (!Number.isFinite(width * height) || width > 16384 || height > 16384 || width * height > 16777216)
    throw new Error('The PNG is too large. Reduce Cell px or the source size.');
  const data = new Uint8Array(width * height * 4);
  const cache = new Map<string, [number, number, number]>();
  const rgb = (h: string) => {
    let v = cache.get(h);
    if (!v) cache.set(h, (v = hex2rgb(h)));
    return v;
  };
  const fill = (x0: number, y0: number, w: number, h: number, color: string) => {
    const [r, g, b] = rgb(color);
    for (let y = y0; y < y0 + h; y++) {
      let i = (y * width + x0) * 4;
      for (let x = 0; x < w; x++, i += 4) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
  };
  if (bg) fill(0, 0, width, height, bg);
  const hx = Math.round(cw / 2);
  const hy = Math.round(chh / 2);
  const quads = [
    [0, 0, hx, hy],
    [hx, 0, cw - hx, hy],
    [0, hy, hx, chh - hy],
    [hx, hy, cw - hx, chh - hy],
  ];
  rows.forEach((row, ry) =>
    row.forEach((c, rx) => {
      const ox = rx * cw;
      const oy = ry * chh;
      if (c.bg && c.m !== 15) fill(ox, oy, cw, chh, c.bg);
      if (!c.m || !c.fg) return;
      if (c.m === 15) return fill(ox, oy, cw, chh, c.fg);
      for (let b = 0; b < 4; b++)
        if (c.m & (1 << b)) {
          const q = quads[b];
          fill(ox + q[0], oy + q[1], q[2], q[3], c.fg);
        }
    }),
  );
  return { width, height, data };
}

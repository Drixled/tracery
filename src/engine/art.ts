import { createQuantizer, hex2rgb, mix } from './color';
import { QUAD } from './encode';
import { checkMaskSize, maskFromAscii } from './mask';
import { finish, render, type RenderResult } from './render';
import { pickStop, ramp } from './stylize';
import type { Art, ArtCell, Cell, Mask, Settings } from './types';

const luma = (h: string) => { const [r, g, b] = hex2rgb(h); return (r * 0.3 + g * 0.59 + b * 0.11) / 255; };
const SHADES: Record<string, number> = { '░': 0.25, '▒': 0.5, '▓': 0.75 };

/** Color every cell: the font's own colors, the palette ramp across the art, or the ramp picked by each color's brightness. */
export function colorArt(art: Art, S: Settings): (ArtCell | null)[] {
  const { W, H, cells } = art;
  let top = H, bot = -1, l = W, r = -1;
  cells.forEach((c, i) => {
    if (!c) return;
    const x = i % W, y = (i - x) / W;
    top = Math.min(top, y); bot = Math.max(bot, y); l = Math.min(l, x); r = Math.max(r, x);
  });
  // The shade map runs from the palette's darkest color to its lightest, whatever order the ramp is in.
  const byLight = S.stops.slice().sort((a, b) => luma(a) - luma(b));
  const tAt = ramp(S, l, top, r, bot);
  // Stretch the font's own brightness range over the whole palette. A loop, since spreading every cell into Math.min overflows the stack on long banners.
  let lo = 1, hi = 0;
  for (const c of cells) for (const h of c ? [c.fg, c.bg] : []) if (h) { const v = luma(h); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const span = hi - lo || 1;
  const shade = (h: string, x: number, y: number) => pickStop(S, (luma(h) - lo) / span, x, y, byLight);
  return cells.map((c, i) => {
    if (!c) return null;
    const x = i % W, y = (i - x) / W;
    if (S.tint === 'font' && c.fg) return c;
    if (S.tint === 'shade' && c.fg) return { ch: c.ch, fg: shade(c.fg, x, y), bg: c.bg && shade(c.bg, x, y) };
    const fg = pickStop(S, tAt(x, y), x, y);
    return { ch: c.ch, fg, bg: c.bg && mix(fg, '#000000', 0.5) };
  });
}

/** Characters mode: the font's glyphs as they are, colored, with an optional drop shadow. */
export function renderArtChars(art: Art | null, S: Settings): RenderResult {
  const q = createQuantizer(S.color);
  if (!art || !art.cells.some(Boolean)) return finish([], q);
  const colored = colorArt(art, S);
  const dx = S.shadowOn ? S.sdx : 0, dy = S.shadowOn ? S.sdy : 0;
  const ox = Math.max(0, -dx), oy = Math.max(0, -dy);
  const W = art.W + Math.abs(dx), H = art.H + Math.abs(dy);
  const grid: (ArtCell | null)[] = new Array(W * H).fill(null);
  if (dx || dy) colored.forEach((c, i) => { if (c) grid[(Math.floor(i / art.W) + oy + dy) * W + (i % art.W) + ox + dx] = { ch: c.ch, fg: S.shadowColor, bg: null }; });
  colored.forEach((c, i) => { if (c) grid[(Math.floor(i / art.W) + oy) * W + (i % art.W) + ox] = c; });
  const rows: Cell[][] = [];
  for (let y = 0; y < H; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < W; x++) {
      const c = grid[y * W + x];
      if (!c) { row.push({ m: 0 }); continue; }
      const fg = q.quant(c.fg ?? S.stops[0]), bg = q.quant(c.bg);
      const m = QUAD.indexOf(c.ch);
      row.push(m > 0 ? (m === 15 ? { m, fg } : { m, fg, bg }) : { m: 0, ch: c.ch, fg, bg });
    }
    while (row.length && !row[row.length - 1].m && !row[row.length - 1].ch) row.pop();
    rows.push(row);
  }
  while (rows.length && !rows[0].length) rows.shift();
  while (rows.length && !rows[rows.length - 1].length) rows.pop();
  return finish(rows, q);
}

/** Blocks mode: fill the art's shape with pixels. Colored fonts keep their colors per quadrant; plain ones go through the ASCII path. */
export function maskFromArt(art: Art | null, S: Settings): Mask | null {
  if (!art) return null;
  const colored = art.cells.some(c => c?.fg);
  if (!colored && !art.cells.some(c => c && (QUAD.includes(c.ch) || SHADES[c.ch]))) {
    const text = Array.from({ length: art.H }, (_, y) => art.cells.slice(y * art.W, (y + 1) * art.W).map(c => c?.ch ?? ' ').join('')).join('\n');
    return maskFromAscii(text, S);
  }
  const cells = S.tint === 'ramp' ? art.cells : colorArt(art, S);
  const { cw, ch } = S;
  const W = art.W * cw, H = art.H * ch;
  checkMaskSize(W, H);
  const F = new Uint8Array(W * H);
  const C: string[] = new Array(W * H);
  cells.forEach((c, i) => {
    if (!c) return;
    const cx = i % art.W, cy = (i - cx) / art.W;
    const m = QUAD.indexOf(c.ch);
    const shade = SHADES[c.ch];
    const fg = shade ? mix(c.bg ?? '#000000', c.fg ?? '#ffffff', shade) : c.fg ?? '#ffffff';
    for (let sy = 0; sy < ch; sy++) for (let sx = 0; sx < cw; sx++) {
      const bit = 1 << ((sy * 2 >= ch ? 2 : 0) + (sx * 2 >= cw ? 1 : 0));
      const color = m < 0 || m & bit ? fg : c.bg;
      if (!color) continue;
      const p = (cy * ch + sy) * W + cx * cw + sx;
      F[p] = 1; C[p] = color;
    }
  });
  return colored ? { W, H, F, C } : { W, H, F };
}

/** Pasted ASCII art as font art, so Characters mode can print it as typed. Spaces stay empty. */
export function artFromAscii(text: string): Art {
  const lines = text.replace(/\r/g, '').split('\n').map(line => Array.from(line));
  const W = Math.max(0, ...lines.map(line => line.length));
  const cells: (ArtCell | null)[] = lines.flatMap(line => Array.from({ length: W }, (_, x) => (line[x] && line[x] !== ' ' ? { ch: line[x], fg: null, bg: null } : null)));
  return { W, H: lines.length, cells, missing: [] };
}

/** Characters mode applies to font banners and pasted ASCII art. */
export const drawsChars = (S: Settings) => (S.src === 'font' || S.src === 'ascii') && S.draw === 'chars';

/** Font source in, finished banner out. */
export const renderArt = (art: Art | null, S: Settings): RenderResult => (S.draw === 'chars' ? renderArtChars(art, S) : render(maskFromArt(art, S), S));

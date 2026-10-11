import type { BlockMode, Mask } from './types';

/**
 * Width of one logical pixel divided by its height, in on-screen terms,
 * for a given block mode and terminal cell ratio (cell height / cell width).
 */
export function pxAspect(mode: BlockMode, ratio: number): number {
  if (mode === 'half') return 1 / (ratio / 2);
  if (mode === 'quad') return 0.5 / (ratio / 2);
  return 2 / ratio;
}

/** Which sub-rows of a character cell a glyph fills, so dots sit low and quotes sit high. */
export function rowsFor(c: string, ch: number, glyph: boolean): number[] {
  const range = (a: number, b: number) => {
    const r: number[] = [];
    for (let i = a; i <= b; i++) r.push(i);
    return r;
  };
  const all = range(0, ch - 1);
  if (!glyph) return all;
  let r: number[];
  if (',._'.includes(c)) r = [ch - 1];
  else if ('`\'"^'.includes(c)) r = range(0, Math.max(1, Math.floor(ch / 2)) - 1);
  else if ('~-+='.includes(c)) {
    const a = Math.floor(ch / 4);
    r = range(a, Math.max(a, Math.floor((ch * 3) / 4) - 1));
  } else if (c === '*') r = range(0, Math.max(1, ch - 1) - 1);
  else if (c >= 'a' && c <= 'z') r = range(ch === 2 ? 1 : Math.floor(ch / 4), ch - 1);
  else r = all;
  r = r.filter((i) => i >= 0 && i < ch);
  return r.length ? r : [ch - 1];
}

export function checkMaskSize(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 4096 || height > 4096 || width * height > 1048576)
    throw new Error('The source is too large. Reduce its width, height, or text size.');
}

export interface AsciiOptions {
  cw: number;
  ch: number;
  glyph: boolean;
}

/** Turn ASCII art into a silhouette. Each non-space character becomes a cw×ch block. */
export function maskFromAscii(art: string, { cw, ch, glyph }: AsciiOptions): Mask | null {
  let lines = art.replace(/\r/g, '').replace(/\t/g, '    ').split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  if (!lines.length) return null;
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.length - l.replace(/^\s+/, '').length));
  const rows = lines.map((l) => Array.from(l.slice(ind)));
  const W = Math.max(...rows.map((l) => l.length)) * cw;
  const H = rows.length * ch;
  checkMaskSize(W, H);
  const F = new Uint8Array(W * H);
  rows.forEach((line, r) =>
    line.forEach((k, c) => {
      if (k === ' ') return;
      for (const sr of rowsFor(k, ch, glyph))
        for (let sc = 0; sc < cw; sc++) F[(r * ch + sr) * W + c * cw + sc] = 1;
    }),
  );
  return { W, H, F };
}

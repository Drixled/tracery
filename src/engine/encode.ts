import { dist, type Quantizer } from './color';
import type { BlockMode, Cell, Pixels } from './types';

/** Glyph for each 4-bit quadrant mask (bit 0 TL, 1 TR, 2 BL, 3 BR). */
export const QUAD = [' ', '▘', '▝', '▀', '▖', '▌', '▞', '▛', '▗', '▚', '▐', '▜', '▄', '▙', '▟', '█'];

/** Pack logical pixels into terminal cells. */
export function encode(img: Pixels, mode: BlockMode): Cell[][] {
  const { W, H, px } = img;
  const at = (x: number, y: number) => (x < W && y < H ? px[y * W + x] : null);
  const rows: Cell[][] = [];

  if (mode === 'half') {
    for (let y = 0; y < H; y += 2) {
      const row: Cell[] = [];
      for (let x = 0; x < W; x++) {
        const t = at(x, y), b = at(x, y + 1);
        if (!t && !b) row.push({ m: 0 });
        else if (t === b) row.push({ m: 15, fg: t! });
        else if (!b) row.push({ m: 3, fg: t! });
        else if (!t) row.push({ m: 12, fg: b });
        else row.push({ m: 3, fg: t, bg: b });
      }
      rows.push(row);
    }
  } else if (mode === 'quad') {
    for (let y = 0; y < H; y += 2) {
      const row: Cell[] = [];
      for (let x = 0; x < W; x += 2) {
        const q = [at(x, y), at(x + 1, y), at(x, y + 1), at(x + 1, y + 1)];
        const cnt = new Map<string | null, number>();
        q.forEach((c) => cnt.set(c, (cnt.get(c) || 0) + 1));
        if (cnt.size === 1 && q[0] === null) { row.push({ m: 0 }); continue; }
        let keys = [...cnt.keys()];
        if (keys.length > 2) {
          // A cell can only show two colors: keep the two most common, snap the rest.
          keys.sort((a, b) => cnt.get(b)! - cnt.get(a)!);
          const [a, b] = keys;
          for (let i = 0; i < 4; i++)
            if (q[i] !== a && q[i] !== b) {
              if (q[i] === null) q[i] = cnt.get(a)! >= cnt.get(b)! ? a : b;
              else if (a === null) q[i] = b;
              else if (b === null) q[i] = a;
              else q[i] = dist(q[i]!, a) <= dist(q[i]!, b) ? a : b;
            }
          keys = [a, b];
        }
        const colors = keys.filter((k): k is string => k !== null);
        const fg = colors[0];
        const bg = colors.length > 1 ? colors[1] : null;
        let m = 0;
        q.forEach((c, i) => { if (c === fg) m |= 1 << i; });
        row.push(m === 15 ? { m: 15, fg } : { m, fg, bg });
      }
      rows.push(row);
    }
  } else {
    for (let y = 0; y < H; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < W; x++) {
        const c = at(x, y);
        const cell: Cell = c ? { m: 15, fg: c } : { m: 0 };
        row.push(cell, { ...cell });
      }
      rows.push(row);
    }
  }
  for (const r of rows) while (r.length && r[r.length - 1].m === 0 && !r[r.length - 1].bg) r.pop();
  return rows;
}

/** Serialize cells to ANSI text. Every line ends with a reset, the file ends with a newline. */
export function toAnsi(rows: Cell[][], q: Quantizer): string {
  return (
    rows
      .map((row) => {
        let s = '';
        let last: string | null = null;
        for (const c of row) {
          const parts: string[] = [];
          if (c.m !== 0 && c.fg) parts.push(q.sgr(c.fg, false));
          if (c.bg && c.m !== 15) parts.push(q.sgr(c.bg, true));
          const code = '\x1b[0' + (parts.length ? ';' + parts.join(';') : '') + 'm';
          if (code !== last) { s += code; last = code; }
          s += QUAD[c.m];
        }
        return s + '\x1b[0m';
      })
      .join('\n') + '\n'
  );
}

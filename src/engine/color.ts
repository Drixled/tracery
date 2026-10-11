import type { ColorDepth } from './types';

export const hex2rgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

export const rgb2hex = (r: number, g: number, b: number): string =>
  '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');

/** Perceptually weighted squared distance. Good enough for palette snapping. */
export function dist(a: string, b: string): number {
  const x = hex2rgb(a);
  const y = hex2rgb(b);
  return (x[0] - y[0]) ** 2 * 0.3 + (x[1] - y[1]) ** 2 * 0.59 + (x[2] - y[2]) ** 2 * 0.11;
}

/** The 16 classic VGA colors, in ANSI index order. */
export const VGA = [
  '#000000', '#aa0000', '#00aa00', '#aa5500', '#0000aa', '#aa00aa', '#00aaaa', '#aaaaaa',
  '#555555', '#ff5555', '#55ff55', '#ffff55', '#5555ff', '#ff55ff', '#55ffff', '#ffffff',
];
const CUBE = [0, 95, 135, 175, 215, 255];

export interface Quantizer {
  depth: ColorDepth;
  /** Snap a color to the target depth. Truecolor returns it unchanged. */
  quant(h: string): string;
  quant(h: string | null): string | null;
  /** SGR parameter string for a color that was produced by `quant`. */
  sgr(h: string, bg: boolean): string;
}

export function createQuantizer(depth: ColorDepth): Quantizer {
  const fromHex = new Map<string, { hex: string; idx: number }>();
  const byResult = new Map<string, number>();

  function snap(h: string): { hex: string; idx: number } {
    const hit = fromHex.get(h);
    if (hit) return hit;
    let best: { hex: string; idx: number };
    if (depth === '16') {
      let bi = 0;
      let bd = Infinity;
      VGA.forEach((c, i) => {
        const d = dist(h, c);
        if (d < bd) { bd = d; bi = i; }
      });
      best = { hex: VGA[bi], idx: bi };
    } else {
      const [r, g, b] = hex2rgb(h);
      const near = (v: number) => {
        let bi = 0;
        CUBE.forEach((c, i) => { if (Math.abs(c - v) < Math.abs(CUBE[bi] - v)) bi = i; });
        return bi;
      };
      const ri = near(r), gi = near(g), bi = near(b);
      const cubeHex = rgb2hex(CUBE[ri], CUBE[gi], CUBE[bi]);
      const g2 = Math.max(0, Math.min(23, Math.round(((r + g + b) / 3 - 8) / 10)));
      const gv = 8 + g2 * 10;
      const greyHex = rgb2hex(gv, gv, gv);
      best = dist(h, cubeHex) <= dist(h, greyHex)
        ? { hex: cubeHex, idx: 16 + 36 * ri + 6 * gi + bi }
        : { hex: greyHex, idx: 232 + g2 };
    }
    fromHex.set(h, best);
    byResult.set(best.hex, best.idx);
    return best;
  }

  function quant(h: string): string;
  function quant(h: string | null): string | null;
  function quant(h: string | null): string | null {
    if (!h || depth === 'true') return h;
    return snap(h.toLowerCase()).hex;
  }

  function sgr(h: string, bg: boolean): string {
    if (depth === 'true') {
      const [r, g, b] = hex2rgb(h);
      return `${bg ? 48 : 38};2;${r};${g};${b}`;
    }
    const idx = byResult.get(h) ?? snap(h).idx;
    if (depth === '256') return `${bg ? 48 : 38};5;${idx}`;
    return String(bg ? (idx < 8 ? 40 + idx : 100 + idx - 8) : idx < 8 ? 30 + idx : 90 + idx - 8);
  }

  return { depth, quant, sgr };
}

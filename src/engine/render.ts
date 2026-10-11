import { createQuantizer } from './color';
import { encode, toAnsi } from './encode';
import { stylize } from './stylize';
import type { Cell, Mask, Settings } from './types';

export interface RenderResult {
  rows: Cell[][];
  ansi: string;
  cols: number;
  lines: number;
  bytes: number;
}

const EMPTY: RenderResult = { rows: [], ansi: '', cols: 0, lines: 0, bytes: 0 };

/** Mask in, finished banner out. Pure, works in the browser and in Node. */
export function render(mask: Mask | null, settings: Settings): RenderResult {
  if (!mask) return EMPTY;
  const q = createQuantizer(settings.color);
  const img = stylize(mask, settings, q);
  if (!img) return EMPTY;
  const rows = encode(img, settings.mode);
  if (!rows.length) return EMPTY;
  const ansi = toAnsi(rows, q);
  return {
    rows,
    ansi,
    cols: rows.reduce((w, r) => Math.max(w, r.length), 0),
    lines: rows.length,
    bytes: new TextEncoder().encode(ansi).length,
  };
}

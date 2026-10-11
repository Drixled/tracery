import type { Cell } from '../engine';

export interface PreviewOptions {
  /** Cell width in CSS px. */
  cell: number;
  /** Cell height / width. */
  ratio: number;
}

/** Paint terminal cells onto a canvas the way a terminal with native block glyphs would. Returns the CSS cell width used. */
export function drawCells(cv: HTMLCanvasElement, rows: Cell[][], cols: number, { cell, ratio }: PreviewOptions): number {
  const ctx = cv.getContext('2d')!;
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.max(1, Math.round(cell * dpr));
  const chh = Math.max(2, Math.round(cell * ratio * dpr));
  cv.width = Math.max(1, cols * cw);
  cv.height = Math.max(1, rows.length * chh);
  cv.style.width = `${cv.width / dpr}px`;
  cv.style.height = `${cv.height / dpr}px`;
  ctx.clearRect(0, 0, cv.width, cv.height);
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
      if (c.bg && c.m !== 15) {
        ctx.fillStyle = c.bg;
        ctx.fillRect(ox, oy, cw, chh);
      }
      if (!c.m || !c.fg) return;
      ctx.fillStyle = c.fg;
      if (c.m === 15) {
        ctx.fillRect(ox, oy, cw, chh);
        return;
      }
      for (let b = 0; b < 4; b++)
        if (c.m & (1 << b)) {
          const q = quads[b];
          ctx.fillRect(ox + q[0], oy + q[1], q[2], q[3]);
        }
    }),
  );
  return cw / dpr;
}

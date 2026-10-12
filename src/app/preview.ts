import { rasterizeCells, type Cell, type RenderResult } from '../engine';

export interface PreviewOptions {
  /** Cell width in CSS px. */
  cell: number;
  /** Cell height / width. */
  ratio: number;
}

/** Paint terminal cells onto a canvas the way a terminal with native block glyphs would. Returns the CSS cell width used. */
export function drawCells(cv: HTMLCanvasElement, rows: Cell[][], cols: number, { cell, ratio }: PreviewOptions): number {
  const dpr = window.devicePixelRatio || 1;
  // Keep large imported art within browser canvas limits, even at high zoom.
  let cw = Math.max(1, Math.min(Math.round(cell * dpr), Math.floor(16384 / Math.max(1, cols)), Math.floor(16384 / Math.max(1, rows.length * ratio))));
  let chh = Math.max(2, Math.round(cw * ratio));
  while (cw > 1 && (cols * cw * rows.length * chh > 16777216 || rows.length * chh > 16384)) {
    cw--;
    chh = Math.max(2, Math.round(cw * ratio));
  }
  // The same painter as the PNG export, so the export stays a pixel-exact copy of the preview.
  paint(cv, rows, cols, cw, ratio, null);
  cv.style.width = `${cv.width / dpr}px`;
  cv.style.height = `${cv.height / dpr}px`;
  return cw / dpr;
}

/** Paint cells at `cellW` device pixels: blocks exactly, then any characters (Characters mode) in a monospace font. */
export function paint(cv: HTMLCanvasElement, rows: Cell[][], cols: number, cellW: number, ratio: number, background: string | null) {
  const raster = rasterizeCells(rows, cols, cellW, ratio, background);
  cv.width = raster.width;
  cv.height = raster.height;
  const ctx = cv.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
  if (!rows.some(row => row.some(c => c.ch))) return;
  const cw = raster.width / Math.max(1, cols), chh = raster.height / Math.max(1, rows.length);
  ctx.font = `${chh}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  ctx.textBaseline = 'alphabetic';
  // Stretch each glyph to fill its cell, so box-drawing lines meet their neighbors.
  const box = ctx.measureText('█');
  const ascent = box.fontBoundingBoxAscent, sx = cw / box.width, sy = chh / (ascent + box.fontBoundingBoxDescent);
  rows.forEach((row, y) => row.forEach((c, x) => {
    if (!c.ch || !c.fg) return;
    ctx.fillStyle = c.fg;
    ctx.setTransform(sx, 0, 0, sy, x * cw, y * chh + ascent * sy);
    ctx.fillText(c.ch, 0, 0);
  }));
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** A 320×160 PNG data URL of the banner on its terminal background, for the home page. */
export function thumbnail(result: RenderResult, background: string, ratio: number): string {
  if (!result.lines) return '';
  const source = document.createElement('canvas');
  drawCells(source, result.rows, result.cols, { cell: Math.max(1, Math.min(16, Math.floor(296 / Math.max(1, result.cols)))), ratio });
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 160;
  const context = canvas.getContext('2d')!; context.imageSmoothingEnabled = false;
  context.fillStyle = background; context.fillRect(0, 0, 320, 160);
  const scale = Math.min(296 / source.width, 136 / source.height);
  context.drawImage(source, (320 - source.width * scale) / 2, (160 - source.height * scale) / 2, source.width * scale, source.height * scale);
  return canvas.toDataURL('image/png');
}

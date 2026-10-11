import { rasterizeCells, type Cell, type RenderResult } from '../engine';

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
  // Keep large imported art within browser canvas limits, even at high zoom.
  let cw = Math.max(1, Math.min(Math.round(cell * dpr), Math.floor(16384 / Math.max(1, cols)), Math.floor(16384 / Math.max(1, rows.length * ratio))));
  let chh = Math.max(2, Math.round(cw * ratio));
  while (cw > 1 && (cols * cw * rows.length * chh > 16777216 || rows.length * chh > 16384)) {
    cw--;
    chh = Math.max(2, Math.round(cw * ratio));
  }
  // The same painter as the PNG export, so the export stays a pixel-exact copy of the preview.
  const raster = rasterizeCells(rows, cols, cw, ratio, null);
  cv.width = raster.width;
  cv.height = raster.height;
  cv.style.width = `${cv.width / dpr}px`;
  cv.style.height = `${cv.height / dpr}px`;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
  return cw / dpr;
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

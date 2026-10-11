import type { RenderResult, Settings } from '../engine';
import { element as $ } from './dom';
import { drawCells } from './preview';
export class Comparison {
  private pinned: { result: RenderResult; background: string; ratio: number } | null = null;
  constructor(private current: () => { result: RenderResult; settings: Settings }, private refresh: () => void) {
    $('pinComparison').onclick = () => { const { result, settings } = current(); if (!result.lines) return; this.pinned = { result, background: settings.termBg, ratio: settings.ratio }; this.refresh(); };
    $('clearComparison').onclick = () => { this.pinned = null; this.refresh(); };
  }
  sync() {
    const current = this.current();
    $<HTMLButtonElement>('pinComparison').disabled = !current.result.lines;
    $('comparison').hidden = !this.pinned;
    $('previewPair').classList.toggle('comparing', !!this.pinned);
    if (!this.pinned) return;
    const { result, background, ratio } = this.pinned;
    $('comparison').style.setProperty('--termbg', background);
    $('referenceSize').textContent = `Reference · ${result.cols}×${result.lines} cells`;
    const cell = Math.max(1, Math.min(16, Math.floor(($('referenceScreen').clientWidth - 36) / Math.max(1, result.cols))));
    drawCells($<HTMLCanvasElement>('referenceCanvas'), result.rows, result.cols, { cell, ratio });
  }
}

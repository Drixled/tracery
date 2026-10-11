import { buildDownload, buildExport, rasterizeCells, type ExportKind, type Project, type RenderResult } from '../engine';
import { element as $ } from './dom';
import { downloadBlob } from './downloads';
const TABS: ExportKind[] = ['install', 'agent', 'printf', 'raw', 'png', 'graphics', 'json'];
export class ExportPanel {
  private tab: ExportKind = 'install';
  private project!: Project;
  private result!: RenderResult;
  private version = 0;
  private pngKey = '';
  private exportKey = '';
  private png: { version: number; bytes: Uint8Array; url: string } | null = null;
  private pending: { version: number; task: Promise<Uint8Array | null> } | null = null;
  private error: { version: number; message: string } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor() {
    try { const saved = localStorage.getItem('tracery:tab') ?? localStorage.getItem('ansi-kiln:tab'); if (TABS.includes(saved as ExportKind)) this.tab = saved as ExportKind; } catch { /* Optional tab preference. */ }
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.onclick = () => {
      this.tab = button.dataset.tab as ExportKind;
      try { localStorage.setItem('tracery:tab', this.tab); } catch { /* Optional tab preference. */ }
      this.paint();
    });
    $('copy').onclick = () => { void this.copy(); };
    $('download').onclick = () => { void this.download().catch(e => { $('exnote').textContent = e.message; }); };
  }
  update(project: Project, result: RenderResult) {
    const S = project.settings;
    const key = JSON.stringify([S.pngCell, S.ratio, S.pngTransparent, S.termBg]);
    const changed = result !== this.result;
    if (changed || key !== this.pngKey) { this.version++; this.pngKey = key; }
    const exportKey = JSON.stringify([S.name, S.color, S.gfxProto, S.gfxCols]);
    this.project = project; this.result = result;
    if (changed || exportKey !== this.exportKey || this.needsPng() || this.tab === 'json') this.paint();
    this.exportKey = exportKey;
  }
  private needsPng() { return this.tab === 'png' || this.tab === 'graphics'; }
  private async ensurePng(): Promise<Uint8Array | null> {
    if (!this.result.lines) return null;
    if (this.png?.version === this.version) return this.png.bytes;
    if (this.pending?.version === this.version) return this.pending.task;
    const version = this.version, result = this.result, S = this.project.settings;
    const task = (async () => {
      try {
        const raster = rasterizeCells(result.rows, result.cols, S.pngCell, S.ratio, S.pngTransparent ? null : S.termBg);
        const canvas = document.createElement('canvas'); canvas.width = raster.width; canvas.height = raster.height;
        canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(raster.data), raster.width, raster.height), 0, 0);
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) throw new Error('Could not encode the PNG. Reduce Cell px or the source size.');
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (version !== this.version) return null;
        if (this.png) URL.revokeObjectURL(this.png.url);
        this.png = { version, bytes, url: URL.createObjectURL(blob) };
        return bytes;
      } catch (e) { if (version === this.version) this.error = { version, message: (e as Error).message }; return null; }
    })();
    this.pending = { version, task };
    const bytes = await task;
    if (this.pending?.task === task) this.pending = null;
    return bytes;
  }
  private paint() {
    if (!this.project) return;
    document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(button => button.setAttribute('aria-selected', String(button.dataset.tab === this.tab)));
    const fresh = this.png?.version === this.version ? this.png : null;
    if (this.needsPng() && this.result.lines && !fresh && this.error?.version !== this.version) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => { this.timer = null; void this.ensurePng().then(() => this.paint()); }, 120);
    }
    const output = buildExport(this.tab, this.project.settings, this.result, { project: this.project, png: fresh?.bytes });
    $('exnote').textContent = this.needsPng() && this.error?.version === this.version ? this.error.message : output.note;
    $('out').hidden = this.tab === 'png'; $('pngview').hidden = this.tab !== 'png';
    if (this.tab === 'png' && fresh) $<HTMLImageElement>('pngimg').src = fresh.url;
    if (this.tab !== 'png') $('out').textContent = this.tab === 'raw' ? output.text.replace(/\x1b/g, '␛') : output.text;
    const extension = this.tab === 'json' ? '.json' : this.tab === 'png' ? '.png' : this.tab === 'agent' ? '.txt' : this.tab === 'raw' ? '.ansi' : '.sh';
    $<HTMLButtonElement>('download').textContent = `Download ${extension}`;
    const disabled = this.tab !== 'json' && (!this.result.lines || (this.needsPng() && !fresh));
    $<HTMLButtonElement>('download').disabled = disabled; $<HTMLButtonElement>('copy').disabled = disabled;
    $('copy').textContent = this.tab === 'png' ? 'Copy image' : 'Copy';
  }
  private flash(message: string) { $('copy').textContent = message; setTimeout(() => this.paint(), 1600); }
  private async copy() {
    if (this.tab === 'png') {
      try { const bytes = await this.ensurePng(); if (bytes) { await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]); this.flash('Copied'); } }
      catch { this.flash('Use Download instead'); }
      return;
    }
    const text = buildExport(this.tab, this.project.settings, this.result, { project: this.project, png: this.png?.version === this.version ? this.png.bytes : undefined }).text;
    try { await navigator.clipboard.writeText(text); this.flash('Copied'); }
    catch { const range = document.createRange(); range.selectNodeContents($('out')); const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range); this.flash('Selected, press Ctrl/Cmd+C'); }
  }
  private async download() {
    const kind = this.tab, project = this.project, result = this.result;
    const png = kind === 'png' || kind === 'graphics' ? await this.ensurePng() : undefined;
    if ((kind === 'png' || kind === 'graphics') && !png) return;
    const file = buildDownload(kind, project.settings, result, { project, png: png ?? undefined });
    await downloadBlob(file.filename, file.data, file.mime);
  }
}

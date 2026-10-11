import { validateSettings, type Project, type Settings, type SourceImage } from '../engine';
import { History } from './history';

const clone = (p: Project): Project => ({ ...p, settings: { ...p.settings, stops: p.settings.stops.slice() }, image: p.image });
const equal = (a: Project, b: Project) => a.image === b.image && (Object.keys(a.settings) as (keyof Settings)[]).every(key => key === 'stops' ? a.settings.stops.length === b.settings.stops.length && a.settings.stops.every((v, i) => v === b.settings.stops[i]) : a.settings[key] === b.settings[key]);
/** 'load' is a newly opened banner: it is not an edit, so it is not saved or recorded. */
export type EditorEvent = 'change' | 'busy' | 'load';

/** Every edit cancels pending image work. History moves only after a successful restore. */
export class Editor<TImage> {
  private current: Project;
  private image: TImage | null = null;
  private revision = 0;
  private listeners = new Set<(event: EditorEvent) => void>();
  readonly history: History<Project>;
  busy = false;
  private loading = false;
  constructor(initial: Project, private decode: (source: SourceImage) => Promise<TImage>) {
    this.current = clone(initial);
    if (this.current.image) Object.freeze(this.current.image);
    this.history = new History(this.current, 50, { clone, equal });
  }
  get settings() { return this.current.settings; }
  get decodedImage() { return this.image; }
  get source() { return this.current.image; }
  snapshot() { return clone(this.current); }
  subscribe(listener: (event: EditorEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private emit(event: EditorEvent) { this.listeners.forEach(listener => listener(event)); }
  edit(patch: Partial<Settings>, group?: string) {
    const settings = validateSettings({ ...this.settings, ...patch });
    this.revision++;
    this.busy = false;
    this.current = { ...this.current, settings };
    this.history.record(this.current, group);
    this.emit('change');
  }
  endGroup() { this.history.endGroup(); }
  private begin() { this.busy = true; const revision = ++this.revision; this.emit('busy'); return revision; }
  private commit(next: Project, image: TImage | null, record: boolean) {
    this.current = clone(next);
    if (this.current.image) Object.freeze(this.current.image);
    this.image = image;
    this.busy = false;
    if (this.loading) this.history.reset(this.current);
    else if (record) this.history.record(this.current);
    this.emit(this.loading ? 'load' : 'change');
  }
  async restore(next: Project, mode: 'edit' | 'undo' | 'redo' | 'initial' = 'edit'): Promise<boolean> {
    const settings = validateSettings(next.settings);
    const revision = this.begin();
    try {
      const sameImage = next.image?.dataUrl === this.current.image?.dataUrl && next.image?.name === this.current.image?.name;
      const decoded = next.image ? sameImage && this.image ? this.image : await this.decode(next.image) : null;
      if (revision !== this.revision) return false;
      if (mode === 'undo') this.history.undo();
      if (mode === 'redo') this.history.redo();
      this.commit({ ...next, settings, image: sameImage ? this.current.image : next.image }, decoded, mode === 'edit');
      return true;
    } finally { if (revision === this.revision && this.busy) { this.busy = false; this.emit('busy'); } }
  }
  /** Open another banner with a fresh undo history. */
  async load(next: Project): Promise<boolean> {
    this.loading = true;
    try { return await this.restore(next, 'initial'); } finally { this.loading = false; }
  }
  async replaceImage(load: () => Promise<{ source: SourceImage; decoded: TImage }>): Promise<boolean> {
    const revision = this.begin();
    try {
      const loaded = await load();
      if (revision !== this.revision) return false;
      this.commit({ ...this.current, settings: { ...this.settings, src: 'image' }, image: loaded.source }, loaded.decoded, true);
      return true;
    } finally { if (revision === this.revision && this.busy) { this.busy = false; this.emit('busy'); } }
  }
  async travel(direction: 'undo' | 'redo') {
    const next = direction === 'undo' ? this.history.peekUndo() : this.history.peekRedo();
    return next ? this.restore(next, direction) : false;
  }
}

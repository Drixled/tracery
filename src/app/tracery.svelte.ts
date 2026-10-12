import { toast } from 'svelte-sonner';
import { DEFAULTS, buildDownload, createProject, parseProject, render, type Look, type Raster, type Settings, type SourceImage } from '../engine';
import { Editor } from './editor';
import { ProjectStorage, type SavedLook, type SavedProject } from './storage';
import { Renderer } from './renderer';
import { decodeImage, importImage } from './images';
import { downloadBlob } from './downloads';
import { thumbnail } from './preview';
import { Router, type Route, type Step } from './router.svelte';
export type { Step };

export type View = 'loading' | 'home' | 'editor' | 'missing';

/** Settings a saved look carries: the palette and the shape, never the source or output. */
const LOOK_KEYS: (keyof Settings)[] = ['palette', 'stops', 'dither', 'dir', 'reverse', 'spread', 'gap', 'gapFillOn', 'gapFill', 'outline', 'outlineColor', 'lipOn', 'lipColor', 'shineOn', 'shineColor', 'bevel', 'shadowOn', 'shadowColor', 'sdx', 'sdy'];
const message = (error: unknown) => (error as Error).message;
function readFavorites(): string[] {
  try { const saved = JSON.parse(localStorage.getItem('tracery:favorites') ?? '[]'); if (Array.isArray(saved)) return saved.filter(f => typeof f === 'string'); } catch { /* Optional preference. */ }
  return [];
}
function remember(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* Optional preference. */ }
}

/**
 * The whole web app's state. The editor, storage and renderer stay plain classes;
 * this mirrors what the UI needs into runes and owns navigation between banners.
 */
export class Tracery {
  readonly storage = new ProjectStorage((status, problem) => { this.saveStatus = status; if (problem) toast.error(status); });
  readonly editor = new Editor<Raster>(createProject(DEFAULTS), decodeImage);
  readonly renderer = new Renderer(() => this.fontsChanged());
  readonly router = new Router();

  view = $state<View>('loading');
  /** Set when the app could not start at all. */
  fatal = $state('');
  /** The banner in the editor. Its name lives in the library record, not in the settings. */
  open = $state.raw<{ id: string; name: string } | null>(null);
  settings = $state.raw<Settings>(this.editor.settings);
  source = $state.raw<SourceImage | null>(null);
  busy = $state(false);
  canUndo = $state(false);
  canRedo = $state(false);
  saveStatus = $state('');
  /** Why the last edit was rejected. Cleared by the next accepted edit. */
  rejected = $state('');
  /** Whether the font picker is open comes from the address, so the browser's back button closes it. */
  readonly step = $derived<Step>(this.router.route.view === 'banner' ? this.router.route.step : 'style');
  /** Font ids starred in the gallery, kept in this browser. */
  favorites = $state<string[]>(readFavorites());
  exportOpen = $state(false);
  /** Every banner in this browser, newest edit first. `null` until the first read. */
  banners = $state.raw<SavedProject[] | null>(null);
  looks = $state.raw<SavedLook[]>([]);

  private decoded = $state.raw<Raster | null>(null);
  private fonts = $state(0);
  private rendered = $derived.by(() => {
    void this.fonts;
    try { return { result: this.renderer.render(this.settings, this.decoded), error: '' }; }
    catch (e) { return { result: render(null, this.settings), error: message(e) }; }
  });
  /** Stable between edits that do not change the artwork, so dependents can compare by identity. */
  readonly result = $derived(this.rendered.result);
  readonly problem = $derived(this.rejected || this.rendered.error);
  /** The font art of the last render, for the missing-letter note by the text bar. */
  readonly art = $derived.by(() => { void this.rendered; return this.settings.src === 'font' ? this.renderer.art : null; });
  readonly fontLoading = $derived(this.settings.src === 'font' && !this.rendered.error && !this.art);
  readonly project = $derived.by(() => { void this.settings; void this.source; return this.editor.snapshot(); });

  private visit = 0;

  constructor() {
    this.editor.subscribe(event => {
      this.mirror();
      if (event === 'busy') return;
      this.rejected = '';
      if (event === 'change') this.save();
    });
  }

  async start() {
    await this.storage.migrateLegacy();
    void this.refreshLooks();
    this.router.subscribe(route => { void this.show(route); });
    void document.fonts.ready.then(() => this.fontsChanged());
    // Web fonts load on first use, often after the first render of a text banner. Draw again when one arrives.
    document.fonts.addEventListener('loadingdone', () => this.fontsChanged());
  }

  private mirror() {
    this.settings = this.editor.settings;
    this.source = this.editor.source;
    this.decoded = this.editor.decodedImage;
    this.busy = this.editor.busy;
    this.canUndo = !this.editor.busy && this.editor.history.canUndo;
    this.canRedo = !this.editor.busy && this.editor.history.canRedo;
  }

  // Navigation

  private async show(route: Route) {
    const token = ++this.visit;
    await this.flush();
    if (token !== this.visit) return;
    this.exportOpen = false;
    if (route.view !== 'banner' || route.step !== 'font') this.pickerFromEditor = false;
    if (route.view === 'home') {
      this.open = null; this.view = 'home';
      await this.refreshBanners();
      return;
    }
    if (this.open?.id === route.id) { this.view = 'editor'; return; }
    try {
      const record = await this.storage.get(route.id);
      if (token !== this.visit) return;
      if (!record) { this.open = null; this.view = 'missing'; return; }
      const project = await this.storage.project(record);
      if (token !== this.visit) return;
      this.open = { id: record.id, name: record.name };
      this.rejected = ''; this.saveStatus = '';
      const loaded = await this.editor.load(project);
      if (token !== this.visit) return;
      this.view = 'editor';
      if (!loaded) return;
      // Banners made by New or Import have no thumbnail until their first save.
      if (!record.thumbnail) requestAnimationFrame(() => this.save());
    } catch (e) { this.open = null; this.view = 'missing'; toast.error(message(e)); }
  }
  openBanner(id: string, step: Step = 'style', replace = false) { this.router.go({ view: 'banner', id, step }, replace); }
  goHome() { this.router.go({ view: 'home' }); }

  // Saving

  private save() {
    const banner = this.open;
    if (!banner) return;
    // The name and thumbnail are read when the save happens, so a rename during the pause is kept.
    this.storage.queue(banner.id, this.editor.snapshot(), () => ({
      name: this.open?.id === banner.id ? this.open.name : banner.name,
      thumbnail: thumbnail(this.result, this.settings.termBg, this.settings.ratio),
    }));
  }
  flush() {
    return this.storage.flush().catch(e => { this.saveStatus = `Could not save: ${message(e)} Download your project to keep it.`; });
  }

  // Editing the open banner

  /** Apply a change. A shared `group` merges a continuous gesture, such as a slider drag, into one undo step. */
  edit(patch: Partial<Settings>, group?: string): boolean {
    try { this.editor.edit(patch, group); return true; }
    catch (e) { this.rejected = message(e); return false; }
  }
  /** End of a gesture: the next edit starts a new undo step, and the save happens now. */
  endEdit() { this.editor.endGroup(); void this.flush(); }
  travel(direction: 'undo' | 'redo') { void this.editor.travel(direction).catch(e => { this.rejected = message(e); }); }
  /** Back to the default look. What's drawn (text, font, art, image) stays. */
  reset() {
    const S = this.settings;
    const keep: Partial<Settings> = { src: S.src, words: S.words, face: S.face, fLayout: S.fLayout, fAlign: S.fAlign, fWrap: S.fWrap, draw: S.draw, text: S.text, font: S.font, ascii: S.ascii, name: S.name };
    void this.editor.restore(createProject({ ...DEFAULTS, ...keep }, this.source)).catch(e => { this.rejected = message(e); });
  }
  loadImage(file: File | undefined) {
    if (!file || this.view !== 'editor') return;
    this.setStep('style');
    void this.editor.replaceImage(() => importImage(file)).catch(e => { this.rejected = message(e); });
  }
  fontsChanged() { this.renderer.invalidateFonts(); this.fonts++; }
  loadFont() {
    const done = () => this.fontsChanged();
    void document.fonts.load(`${this.settings.size}px "${this.settings.font}"`).then(done, done);
  }

  // The open banner's menu

  rename(name: string) {
    if (!this.open) return;
    this.open = { ...this.open, name };
    this.save(); void this.flush();
  }
  async duplicate() {
    if (!this.open) return;
    try {
      await this.flush();
      const record = await this.storage.get(this.open.id);
      if (!record) return;
      const copy = await this.storage.duplicate(record);
      this.openBanner(copy.id);
    } catch (e) { toast.error(message(e)); }
  }
  async deleteOpen() {
    if (!this.open) return;
    const { id, name } = this.open;
    try {
      await this.flush(); await this.storage.delete(id);
      this.open = null; this.goHome(); toast(`Deleted ${name}.`);
    } catch (e) { toast.error(message(e)); }
  }
  downloadProject() {
    const file = buildDownload('json', this.settings, this.result, { project: this.editor.snapshot() });
    void downloadBlob(file.filename, file.data, file.mime).catch(e => toast.error(message(e)));
  }

  // Home

  async refreshBanners() {
    try { this.banners = await this.storage.list(); }
    catch (e) { this.banners ??= []; toast.error(message(e)); }
  }
  private async create(name: string, project = createProject(DEFAULTS), step: Step = 'style') {
    const record = await this.storage.save(name, project, '');
    this.openBanner(record.id, step);
  }
  async newBanner() {
    try { await this.create('Untitled banner', createProject({ ...DEFAULTS, src: 'font', draw: 'chars' }), 'font'); } catch (e) { toast.error(message(e)); }
  }

  // Steps and fonts

  private pickerFromEditor = false;
  setStep(step: Step) {
    if (!this.open || step === this.step) return;
    // A picker opened from the editor closes by going back; a new banner's picker is replaced, so Back never reopens it.
    if (step === 'style' && this.pickerFromEditor) { this.pickerFromEditor = false; history.back(); return; }
    this.pickerFromEditor = step === 'font';
    this.openBanner(this.open.id, step, step === 'style');
  }
  /** Pick a FIGlet or TheDraw font in the picker and go back to the editor. */
  chooseFont(face: string) {
    if (this.edit({ src: 'font', face })) { this.endEdit(); this.setStep('style'); }
  }
  /** Pick a web font: the text typed in the picker comes along. */
  chooseWebFont(font: string) {
    if (!this.edit({ src: 'text', font, text: this.settings.words })) return;
    this.endEdit(); this.loadFont(); this.setStep('style');
  }
  /** Start from pasted ASCII art instead of a font. */
  useAscii() {
    if (this.edit({ src: 'ascii' })) { this.endEdit(); this.setStep('style'); }
  }
  toggleFavorite(id: string) {
    this.favorites = this.favorites.includes(id) ? this.favorites.filter(f => f !== id) : [...this.favorites, id];
    remember('tracery:favorites', JSON.stringify(this.favorites));
  }
  async importFile(file: File) {
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error('The project file is too large (maximum 4 MB).');
      const project = parseProject(JSON.parse(await file.text()));
      await this.create(file.name.replace(/(\.tracery|\.kiln)?\.json$/i, '').slice(0, 128) || 'Imported banner', project);
    } catch (e) { toast.error(`Could not import ${file.name}: ${message(e)}`); }
  }
  async renameBanner(record: SavedProject, name: string) {
    try { await this.storage.rename(record, name); await this.refreshBanners(); }
    catch (e) { toast.error(message(e)); }
  }
  async duplicateBanner(record: SavedProject) {
    try { const copy = await this.storage.duplicate(record); toast(`Made ${copy.name}.`); await this.refreshBanners(); }
    catch (e) { toast.error(message(e)); }
  }
  async deleteBanner(record: SavedProject) {
    try { await this.storage.delete(record.id); toast(`Deleted ${record.name}.`); await this.refreshBanners(); }
    catch (e) { toast.error(message(e)); }
  }

  // Saved looks: a palette and shape you can reuse on any banner

  async refreshLooks() {
    try { this.looks = await this.storage.looks(); } catch (e) { toast.error(message(e)); }
  }
  applyLook(look: Look) { if (this.edit(look.v)) toast(`Applied ${look.name}.`); }
  async saveLook(name: string): Promise<boolean> {
    const v: Partial<Settings> = {};
    for (const key of LOOK_KEYS) Object.assign(v, { [key]: key === 'stops' ? this.settings.stops.slice() : this.settings[key] });
    try {
      const saved = await this.storage.saveLook(name, v);
      await this.refreshLooks(); toast(`Saved ${saved.name}.`);
      return true;
    } catch (e) { toast.error(message(e)); return false; }
  }
  async deleteLook(look: SavedLook) {
    try { await this.storage.deleteLook(look.id); await this.refreshLooks(); toast(`Deleted ${look.name}. Current settings were kept.`); }
    catch (e) { toast.error(message(e)); }
  }
}

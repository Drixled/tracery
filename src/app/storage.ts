import { createProject, normalizeSettings, parseProject, validateSettings, type Look, type Project, type Settings, type SourceImage } from '../engine';

export interface SavedProject { id: string; name: string; settings: Settings; assetId: string | null; thumbnail: string; updatedAt: number }
export interface SavedLook extends Look { id: string }
const DRAFT = '$draft';
const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const finished = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Browser storage failed.')); });

/** Images live in an asset store, not in every settings record or history entry. */
export class ProjectStorage {
  private database: Promise<IDBDatabase>;
  private assets = new WeakMap<SourceImage, string>();
  private loadedAssets = new Map<string, SourceImage>();
  private chain: Promise<unknown> = Promise.resolve();
  private pending: { id: string; project: Project; details: () => { name: string; thumbnail: string } } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(private status: (message: string, problem?: boolean) => void) {
    this.database = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('Browser storage is unavailable. Download your project to keep it.')); return; }
      const opening = indexedDB.open('tracery', 1);
      opening.onupgradeneeded = () => {
        for (const name of ['projects', 'assets', 'looks']) if (!opening.result.objectStoreNames.contains(name)) opening.result.createObjectStore(name, { keyPath: 'id' });
      };
      opening.onsuccess = () => resolve(opening.result);
      opening.onerror = () => reject(opening.error);
      opening.onblocked = () => reject(new Error('Close other Tracery tabs to enable browser storage.'));
    });
    // The editor can still export projects when storage is disabled.
    void this.database.catch(() => {});
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.chain.then(work);
    this.chain = next.catch(() => {});
    return next;
  }
  private async read<T>(store: string, id: string): Promise<T | undefined> {
    const db = await this.database;
    return request(db.transaction(store).objectStore(store).get(id)) as Promise<T | undefined>;
  }
  private async all<T>(store: string): Promise<T[]> {
    const db = await this.database;
    return request(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
  }
  async project(record: SavedProject): Promise<Project> {
    let image: SourceImage | null = null;
    if (record.assetId) {
      image = this.loadedAssets.get(record.assetId) ?? null;
      if (!image) {
        const asset = await this.read<{ id: string; image: SourceImage }>('assets', record.assetId);
        if (!asset) throw new Error('The saved source image is missing. The project has not been changed.');
        image = Object.freeze(asset.image);
        this.loadedAssets.set(record.assetId, image);
        this.assets.set(image, record.assetId);
      }
    }
    const result = parseProject({ format: 'tracery', version: 1, settings: record.settings, image });
    if (result.image && record.assetId) { Object.freeze(result.image); this.assets.set(result.image, record.assetId); this.loadedAssets.set(record.assetId, result.image); }
    return result;
  }
  async get(id: string): Promise<SavedProject | undefined> { return id === DRAFT ? undefined : this.read<SavedProject>('projects', id); }
  /**
   * Older versions kept one shared draft. Move it into a normal banner once, unless it was never edited.
   * Returns the new banner, if one was made.
   */
  async migrateLegacy(): Promise<SavedProject | null> {
    let legacy: Project | null = null;
    try {
      const draft = await this.read<SavedProject>('projects', DRAFT);
      if (draft) { legacy = await this.project(draft); }
    } catch (e) { this.status(`Could not restore the old draft: ${(e as Error).message} Existing data was kept.`, true); return null; }
    try {
      const raw = !legacy && !localStorage.getItem('tracery:migrated') ? localStorage.getItem('tracery:v1') ?? localStorage.getItem('ansi-kiln:v1') : null;
      if (raw) {
        localStorage.setItem('tracery:migrated', '1');
        try { legacy = parseProject(JSON.parse(raw)); }
        catch (e) {
          localStorage.setItem(`tracery:recovery:${Date.now()}`, raw);
          this.status(`Could not restore the old draft: ${(e as Error).message} A recovery copy was kept.`, true);
        }
      }
    } catch { /* Do not overwrite old storage when it cannot be read. */ }
    if (!legacy) return null;
    const blank = createProject(normalizeSettings({}));
    const record = legacy.image || JSON.stringify(legacy.settings) !== JSON.stringify(blank.settings) ? await this.save('Untitled banner', legacy, '') : null;
    await this.enqueue(async () => { const db = await this.database; const tx = db.transaction('projects', 'readwrite'); const done = finished(tx); tx.objectStore('projects').delete(DRAFT); await done; });
    return record;
  }
  /** Autosave the open banner after a short pause. The name and thumbnail are read when the save happens. */
  queue(id: string, project: Project, details: () => { name: string; thumbnail: string }) {
    this.pending = { id, project, details };
    if (this.timer) clearTimeout(this.timer);
    this.status('Saving…');
    this.timer = setTimeout(() => { void this.flush().catch(e => this.status(`Could not save: ${e.message} Download your project to keep it.`, true)); }, 500);
  }
  async flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    try { const { name, thumbnail } = pending.details(); await this.saveRecord(pending.id, name, pending.project, thumbnail); this.status(this.pending ? 'Saving…' : 'Saved'); }
    catch (e) { if (!this.pending) this.pending = pending; throw e; }
  }
  private saveRecord(id: string, name: string, project: Project, thumbnail: string): Promise<SavedProject> {
    return this.enqueue(async () => {
      const db = await this.database;
      let assetId: string | null = null;
      if (project.image) {
        assetId = this.assets.get(project.image) ?? crypto.randomUUID();
        this.assets.set(project.image, assetId);
      }
      const tx = db.transaction(['projects', 'assets'], 'readwrite');
      const done = finished(tx);
      // Check the database, not memory: another tab may have deleted this image.
      if (assetId && !(await request(tx.objectStore('assets').count(assetId)))) tx.objectStore('assets').put({ id: assetId, image: project.image });
      const record: SavedProject = { id, name, settings: project.settings, assetId, thumbnail, updatedAt: Date.now() };
      tx.objectStore('projects').put(record);
      await done;
      if (assetId) this.loadedAssets.set(assetId, project.image!);
      return record;
    });
  }
  async list(): Promise<SavedProject[]> { return (await this.all<SavedProject>('projects')).filter(p => p.id !== DRAFT).sort((a, b) => b.updatedAt - a.updatedAt); }
  async save(name: string, project: Project, thumbnail: string, id: string = crypto.randomUUID()): Promise<SavedProject> {
    const clean = name.trim();
    if (!clean || clean.length > 128) throw new Error('Use a project name from 1 to 128 characters.');
    return this.saveRecord(id, clean, project, thumbnail);
  }
  async rename(record: SavedProject, name: string) { return this.save(name, await this.project(record), record.thumbnail, record.id); }
  async duplicate(record: SavedProject) { return this.save(`${record.name.slice(0, 123)} copy`, await this.project(record), record.thumbnail); }
  async delete(id: string) {
    await this.enqueue(async () => {
      const db = await this.database;
      const tx = db.transaction(['projects', 'assets'], 'readwrite');
      const done = finished(tx);
      tx.objectStore('projects').delete(id);
      const projects = await request(tx.objectStore('projects').getAll()) as SavedProject[];
      const referenced = new Set(projects.map(p => p.assetId));
      const assets = await request(tx.objectStore('assets').getAllKeys());
      for (const key of assets) if (!referenced.has(String(key))) {
        tx.objectStore('assets').delete(key);
        this.loadedAssets.delete(String(key));
      }
      await done;
    });
  }
  async looks(): Promise<SavedLook[]> {
    const values = await this.all<SavedLook>('looks');
    return values.map(look => { validateSettings(look.v); return look; });
  }
  async saveLook(name: string, v: Partial<Settings>): Promise<SavedLook> {
    const clean = name.trim();
    if (!clean || clean.length > 128) throw new Error('Use a look name from 1 to 128 characters.');
    validateSettings(v);
    const value: SavedLook = { id: crypto.randomUUID(), name: clean, v };
    await this.enqueue(async () => { const db = await this.database; const tx = db.transaction('looks', 'readwrite'); const done = finished(tx); tx.objectStore('looks').put(value); await done; });
    return value;
  }
  async deleteLook(id: string) {
    await this.enqueue(async () => { const db = await this.database; const tx = db.transaction('looks', 'readwrite'); const done = finished(tx); tx.objectStore('looks').delete(id); await done; });
  }
}

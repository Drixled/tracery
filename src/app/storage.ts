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
  private knownAssets = new Set<string>();
  private loadedAssets = new Map<string, SourceImage>();
  private chain: Promise<unknown> = Promise.resolve();
  private pending: Project | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  writes = 0;
  constructor(private status: (message: string) => void) {
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
        this.knownAssets.add(record.assetId);
      }
    }
    const result = parseProject({ format: 'tracery', version: 1, settings: record.settings, image });
    if (result.image && record.assetId) { Object.freeze(result.image); this.assets.set(result.image, record.assetId); this.loadedAssets.set(record.assetId, result.image); }
    return result;
  }
  async loadInitial(): Promise<Project> {
    try {
      const draft = await this.read<SavedProject>('projects', DRAFT);
      if (draft) return await this.project(draft);
    } catch (e) { this.status(`Could not restore browser storage: ${(e as Error).message} Existing data was kept.`); }
    try {
      const raw = localStorage.getItem('tracery:v1') ?? localStorage.getItem('ansi-kiln:v1');
      if (raw) {
        try { return parseProject(JSON.parse(raw)); }
        catch (e) {
          localStorage.setItem(`tracery:recovery:${Date.now()}`, raw);
          this.status(`Could not restore the old draft: ${(e as Error).message} A recovery copy was kept.`);
        }
      }
    } catch { /* Do not overwrite old storage when it cannot be read. */ }
    return createProject(normalizeSettings({}));
  }
  queueDraft(project: Project) {
    this.pending = project;
    if (this.timer) clearTimeout(this.timer);
    this.status('Saving…');
    this.timer = setTimeout(() => { void this.flushDraft().catch(e => this.status(`Could not save: ${e.message} Download your project to keep it.`)); }, 500);
  }
  async flushDraft() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return;
    const project = this.pending;
    this.pending = null;
    try { await this.saveRecord(DRAFT, 'Current draft', project, ''); this.status(this.pending ? 'Saving…' : 'Saved in this browser.'); }
    catch (e) { if (!this.pending) this.pending = project; throw e; }
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
      if (assetId && !this.knownAssets.has(assetId)) tx.objectStore('assets').put({ id: assetId, image: project.image });
      const record: SavedProject = { id, name, settings: project.settings, assetId, thumbnail, updatedAt: Date.now() };
      tx.objectStore('projects').put(record);
      await done;
      if (assetId) { this.knownAssets.add(assetId); this.loadedAssets.set(assetId, project.image!); }
      this.writes++;
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
        this.knownAssets.delete(String(key)); this.loadedAssets.delete(String(key));
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

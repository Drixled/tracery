import { type Raster, type Settings } from '../engine';
import type { Editor } from './editor';
import { element as $, showMessage } from './dom';
import { ProjectStorage, type SavedProject } from './storage';
const STYLE_KEYS: (keyof Settings)[] = ['palette', 'stops', 'dither', 'dir', 'reverse', 'spread', 'gap', 'gapFillOn', 'gapFill', 'outline', 'outlineColor', 'lipOn', 'lipColor', 'shineOn', 'shineColor', 'bevel', 'shadowOn', 'shadowColor', 'sdx', 'sdy'];

export function setupLibrary(editor: Editor<Raster>, storage: ProjectStorage, thumbnail: () => string) {
  let records: SavedProject[] = [], selected: string | null = null;
  const name = $<HTMLInputElement>('projectName');
  const report = (error: unknown) => { $('libraryMsg').textContent = (error as Error).message; };
  const selectedRecord = () => { const record = records.find(p => p.id === selected); if (!record) throw new Error('Open a saved project first.'); return record; };
  const syncActions = () => { for (const id of ['renameProject', 'duplicateProject', 'deleteProject']) $<HTMLButtonElement>(id).disabled = !selected; };
  const open = async (record: SavedProject) => {
    if (await editor.importProject(() => storage.project(record))) { selected = record.id; name.value = record.name; $('libraryMsg').textContent = `Opened ${record.name}.`; await refresh(); }
  };
  async function refresh() {
    records = await storage.list();
    const box = $('projectLibrary'); box.replaceChildren();
    for (const record of records) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'project-card'; button.setAttribute('aria-label', `Open ${record.name}`); button.setAttribute('aria-pressed', String(selected === record.id));
      if (record.thumbnail) { const image = document.createElement('img'); image.src = record.thumbnail; image.alt = ''; button.append(image); }
      const title = document.createElement('span'); title.textContent = record.name; button.append(title); button.onclick = () => { void open(record).catch(report); }; box.append(button);
    }
    if (!records.length) { const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = 'Save a project to keep it in this browser.'; box.append(hint); }
    syncActions();
  }
  $('saveProject').onclick = () => { void (async () => {
    const previous = selected;
    const record = await storage.save(name.value || editor.settings.name, editor.snapshot(), thumbnail(), previous ?? undefined);
    if (selected === previous) { selected = record.id; name.value = record.name; }
    $('libraryMsg').textContent = `Saved ${record.name}.`; await refresh();
  })().catch(report); };
  $('saveNewProject').onclick = () => { void (async () => {
    const previous = selected, version = editor.version;
    const record = await storage.save(name.value || editor.settings.name, editor.snapshot(), thumbnail());
    if (selected === previous && editor.version === version) { selected = record.id; name.value = record.name; } $('libraryMsg').textContent = `Saved new project ${record.name}.`; await refresh();
  })().catch(report); };
  $('renameProject').onclick = () => { void (async () => { const renamed = await storage.rename(selectedRecord(), name.value); $('libraryMsg').textContent = `Renamed to ${renamed.name}.`; await refresh(); })().catch(report); };
  $('duplicateProject').onclick = () => { void (async () => {
    const version = editor.version;
    const copied = await storage.duplicate(selectedRecord());
    await refresh();
    if (editor.version === version) await open(copied);
    $('libraryMsg').textContent = `Created ${copied.name}.`;
  })().catch(report); };
  $('deleteProject').onclick = () => { void (async () => {
    const record = selectedRecord(); await storage.flushDraft(); await storage.delete(record.id);
    if (selected === record.id) { selected = null; name.value = ''; }
    $('libraryMsg').textContent = `Deleted ${record.name}. The current draft is still open.`; await refresh();
  })().catch(report); };
  $('newProject').onclick = () => { selected = null; name.value = ''; syncActions(); $('libraryMsg').textContent = 'The next save will create a new project.'; };
  const lookSelect = $<HTMLSelectElement>('customLook');
  let looks: Awaited<ReturnType<ProjectStorage['looks']>> = [];
  const refreshLooks = async () => {
    looks = await storage.looks();
    const previous = lookSelect.value;
    lookSelect.replaceChildren(new Option('Choose a saved look', ''), ...looks.map(look => new Option(look.name, look.id)));
    if (looks.some(look => look.id === previous)) lookSelect.value = previous;
    $<HTMLButtonElement>('deleteLook').disabled = !lookSelect.value;
  };
  lookSelect.onchange = () => {
    const look = looks.find(value => value.id === lookSelect.value);
    if (look) { try { editor.edit(look.v); $('lookMsg').textContent = `Applied ${look.name}.`; } catch (e) { showMessage((e as Error).message); } }
    $<HTMLButtonElement>('deleteLook').disabled = !look;
  };
  $('saveLook').onclick = () => { void (async () => {
    const v: Partial<Settings> = {};
    for (const key of STYLE_KEYS) Object.assign(v, { [key]: key === 'stops' ? editor.settings.stops.slice() : editor.settings[key] });
    const saved = await storage.saveLook($<HTMLInputElement>('lookName').value, v);
    await refreshLooks(); lookSelect.value = saved.id; $<HTMLButtonElement>('deleteLook').disabled = false; $('lookMsg').textContent = `Saved ${saved.name}.`;
  })().catch(e => { $('lookMsg').textContent = e.message; }); };
  $('deleteLook').onclick = () => { void (async () => { const id = lookSelect.value; if (!id) return; await storage.deleteLook(id); await refreshLooks(); $('lookMsg').textContent = 'Deleted the saved look. Current settings were kept.'; })().catch(e => { $('lookMsg').textContent = e.message; }); };
  void refresh().catch(report); void refreshLooks().catch(e => { $('lookMsg').textContent = e.message; });
  return { refresh };
}

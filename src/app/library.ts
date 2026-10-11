import { DEFAULTS, createProject, parseProject, type Raster, type Settings } from '../engine';
import type { Editor } from './editor';
import { element as $, showMessage } from './dom';
import { attachMenu, editInPlace } from './menu';
import { Router } from './router';
import { ProjectStorage, type SavedLook, type SavedProject } from './storage';
const STYLE_KEYS: (keyof Settings)[] = ['palette', 'stops', 'dither', 'dir', 'reverse', 'spread', 'gap', 'gapFillOn', 'gapFill', 'outline', 'outlineColor', 'lipOn', 'lipColor', 'shineOn', 'shineColor', 'bevel', 'shadowOn', 'shadowColor', 'sdx', 'sdy'];
const ago = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
function edited(time: number) {
  const minutes = Math.round((time - Date.now()) / 60000);
  if (minutes > -1) return 'Edited just now';
  if (minutes > -60) return `Edited ${ago.format(minutes, 'minute')}`;
  if (minutes > -1440) return `Edited ${ago.format(Math.round(minutes / 60), 'hour')}`;
  if (minutes > -10080) return `Edited ${ago.format(Math.round(minutes / 1440), 'day')}`;
  return `Edited ${new Date(time).toLocaleDateString()}`;
}
function make<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); Object.assign(node, props); node.append(...children); return node;
}

/** Home: every banner in this browser, newest edit first. */
export function setupHome(storage: ProjectStorage, router: Router) {
  const say = (message: string) => { $('homeMsg').textContent = message; };
  const report = (error: unknown) => say((error as Error).message);
  const open = (record: SavedProject) => router.go({ view: 'banner', id: record.id });
  const create = async (name: string, project = createProject(DEFAULTS)) => open(await storage.save(name, project, ''));
  function card(record: SavedProject) {
    const href = Router.path({ view: 'banner', id: record.id });
    const thumb = make('a', { className: 'thumb', href });
    thumb.setAttribute('aria-label', `Open ${record.name}`);
    if (record.thumbnail) thumb.append(make('img', { src: record.thumbnail, alt: '' }));
    const title = make('a', { className: 'title', href, textContent: record.name });
    const more = make('button', { type: 'button', className: 'more', textContent: '⋯' });
    more.setAttribute('aria-label', `Options for ${record.name}`);
    attachMenu(more, () => [
      { label: 'Open', run: () => open(record) },
      { label: 'Rename', run: () => editInPlace(title, record.name, name => { void storage.rename(record, name).then(refresh).catch(report); }) },
      { label: 'Duplicate', run: () => { void storage.duplicate(record).then(copy => { say(`Made ${copy.name}.`); return refresh(); }).catch(report); } },
      { label: 'Delete', danger: true, confirm: 'Click again to delete', run: () => { void storage.delete(record.id).then(() => { say(`Deleted ${record.name}.`); return refresh(); }).catch(report); } },
    ]);
    return make('article', { className: 'card' }, thumb, make('div', { className: 'meta' }, make('div', { className: 'meta-text' }, title, make('small', { textContent: edited(record.updatedAt) })), more));
  }
  async function refresh() {
    const records = await storage.list();
    $('library').replaceChildren(...records.map(card));
    $('homeEmpty').hidden = records.length > 0;
    document.querySelector('.home-head')!.toggleAttribute('hidden', !records.length);
  }
  for (const id of ['newBanner', 'firstBanner']) $(id).onclick = () => { void create('Untitled banner').catch(report); };
  $<HTMLInputElement>('importFile').onchange = event => {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return;
    void (async () => {
      if (file.size > 4 * 1024 * 1024) throw new Error('The project file is too large (maximum 4 MB).');
      const project = parseProject(JSON.parse(await file.text()));
      await create(file.name.replace(/(\.tracery|\.kiln)?\.json$/i, '').slice(0, 128) || 'Imported banner', project);
    })().catch(e => say(`Could not import ${file.name}: ${e.message}`));
  };
  return { refresh, say };
}

/** Saved looks: a palette and shape you can reuse on any banner. */
export function setupLooks(editor: Editor<Raster>, storage: ProjectStorage) {
  let looks: SavedLook[] = [];
  const say = (message: string) => { $('lookMsg').textContent = message; };
  const refresh = async () => {
    looks = await storage.looks();
    $('savedLooks').replaceChildren(...looks.map(look => {
      const apply = make('button', { type: 'button', className: 'chip plain mine', textContent: look.name });
      apply.onclick = () => { try { editor.edit(look.v); say(`Applied ${look.name}.`); } catch (e) { showMessage((e as Error).message); } };
      const drop = make('button', { type: 'button', className: 'chip-x', textContent: '×' }); drop.setAttribute('aria-label', `Delete look ${look.name}`);
      drop.onclick = () => { void storage.deleteLook(look.id).then(refresh).then(() => say(`Deleted ${look.name}. Current settings were kept.`)).catch(e => say(e.message)); };
      return make('span', { className: 'chip-pair' }, apply, drop);
    }));
  };
  $<HTMLFormElement>('lookForm').onsubmit = event => { event.preventDefault(); void (async () => {
    const v: Partial<Settings> = {};
    for (const key of STYLE_KEYS) Object.assign(v, { [key]: key === 'stops' ? editor.settings.stops.slice() : editor.settings[key] });
    const saved = await storage.saveLook($<HTMLInputElement>('lookName').value, v);
    $<HTMLInputElement>('lookName').value = ''; await refresh(); say(`Saved ${saved.name}.`);
  })().catch(e => say(e.message)); };
  void refresh().catch(e => say(e.message));
}

import './styles.css';
import { DEFAULTS, buildDownload, createProject, render, type Raster } from '../engine';
import { element as $, showMessage } from './dom';
import { Editor } from './editor';
import { ProjectStorage } from './storage';
import { Renderer } from './renderer';
import { setupControls } from './controls';
import { setupHome, setupLooks } from './library';
import { Comparison } from './comparison';
import { ExportPanel } from './export-panel';
import { decodeImage, importImage } from './images';
import { downloadBlob } from './downloads';
import { drawCells } from './preview';
import { attachMenu, editInPlace } from './menu';
import { Router, type Route } from './router';

type Panel = 'source' | 'color' | 'shape' | 'output';
const PANELS: Panel[] = ['source', 'color', 'shape', 'output'];

async function start() {
  const storage = new ProjectStorage((message, problem) => { $('saveStatus').textContent = message; if (problem) $('homeMsg').textContent = message; });
  const editor = new Editor<Raster>(createProject(DEFAULTS), decodeImage);
  const renderer = new Renderer();
  const exports = new ExportPanel();
  let result = render(null, editor.settings);
  /** The banner in the editor. Its name lives in the library record, not in the settings. */
  let open: { id: string; name: string } | null = null;
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
  const fontsChanged = () => { renderer.invalidateFonts(); schedule(); };
  const flush = () => storage.flush().catch(e => { $('saveStatus').textContent = `Could not save: ${e.message} Download your project to keep it.`; });
  const controls = setupControls(editor, fontsChanged, () => { void flush(); });
  const comparison = new Comparison(() => ({ result, settings: editor.settings }), schedule);
  const thumbnail = () => {
    update();
    const source = $<HTMLCanvasElement>('cv');
    if (!result.lines) return '';
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 160;
    const context = canvas.getContext('2d')!; context.imageSmoothingEnabled = false;
    context.fillStyle = editor.settings.termBg; context.fillRect(0, 0, 320, 160);
    const scale = Math.min(296 / source.width, 136 / source.height);
    context.drawImage(source, (320 - source.width * scale) / 2, (160 - source.height * scale) / 2, source.width * scale, source.height * scale);
    return canvas.toDataURL('image/png');
  };
  const save = () => {
    const banner = open;
    if (banner) storage.queue(banner.id, editor.snapshot(), () => ({ name: banner.name, thumbnail: thumbnail() }));
  };
  setupLooks(editor, storage);
  await storage.migrateLegacy();
  const router = new Router();
  const home = setupHome(storage, router);

  // Control panels are part of the editor, not the address. The last one used reopens.
  const showPanel = (panel: Panel) => {
    document.querySelectorAll<HTMLElement>('[data-pane]').forEach(pane => { pane.hidden = pane.dataset.pane !== panel; });
    document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(tab => { const selected = tab.dataset.panel === panel; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
    try { localStorage.setItem('tracery:panel', panel); } catch { /* Optional preference. */ }
    schedule();
  };
  document.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(tab => { tab.onclick = () => showPanel(tab.dataset.panel as Panel); });
  $('inspector').querySelector('[role=tablist]')!.addEventListener('keydown', event => {
    const key = (event as KeyboardEvent).key;
    if (key !== 'ArrowLeft' && key !== 'ArrowRight') return;
    const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-panel]')];
    const next = tabs[(tabs.indexOf(document.activeElement as HTMLButtonElement) + (key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    next.click(); next.focus();
  });
  let remembered: string | null = null;
  try { remembered = localStorage.getItem('tracery:panel'); } catch { /* Optional preference. */ }
  showPanel(PANELS.includes(remembered as Panel) ? remembered as Panel : 'source');

  const setView = (view: 'home' | 'editor' | 'missing') => {
    $('home').hidden = view !== 'home'; $('editorView').hidden = view !== 'editor'; $('missing').hidden = view !== 'missing';
    document.body.dataset.view = view;
  };
  const setName = (name: string) => { $('bannerTitle').textContent = name; document.title = `${name} · Tracery`; };
  let visit = 0;
  async function show(route: Route) {
    const token = ++visit;
    await flush();
    if (token !== visit) return;
    if ($<HTMLDialogElement>('exportDialog').open) $<HTMLDialogElement>('exportDialog').close();
    if (route.view === 'home') {
      open = null; document.title = 'Tracery'; setView('home');
      await home.refresh().catch(e => home.say(e.message));
      return;
    }
    if (open?.id === route.id) { setView('editor'); return; }
    try {
      const record = await storage.get(route.id);
      if (token !== visit) return;
      if (!record) { open = null; document.title = 'Not found · Tracery'; setView('missing'); return; }
      const project = await storage.project(record);
      if (token !== visit) return;
      open = { id: record.id, name: record.name };
      comparison.clear(); showMessage(''); $('saveStatus').textContent = '';
      setName(record.name); setView('editor');
      if (!await editor.load(project)) return;
      // Banners made by New or Import have no thumbnail until their first save.
      if (!record.thumbnail) requestAnimationFrame(save);
    } catch (e) { open = null; setView('missing'); home.say((e as Error).message); }
  }
  router.subscribe(route => { void show(route); });

  attachMenu($<HTMLButtonElement>('bannerMenu'), () => [
    { label: 'Rename', run: () => { if (open) editInPlace($('bannerMenu'), open.name, name => { if (!open) return; open.name = name; setName(name); save(); void flush(); }); } },
    { label: 'Duplicate', run: () => { void (async () => {
      if (!open) return; await flush();
      const record = await storage.get(open.id); if (!record) return;
      const copy = await storage.duplicate(record); router.go({ view: 'banner', id: copy.id });
    })().catch(e => showMessage(e.message)); } },
    { label: 'Download project file', run: () => { const file = buildDownload('json', editor.settings, result, { project: editor.snapshot() }); void downloadBlob(file.filename, file.data, file.mime).catch(e => showMessage(e.message)); } },
    { label: 'Delete', danger: true, confirm: 'Click again to delete', run: () => { void (async () => {
      if (!open) return; const { id, name } = open; await flush(); await storage.delete(id);
      open = null; router.go({ view: 'home' }); home.say(`Deleted ${name}.`);
    })().catch(e => showMessage(e.message)); } },
  ]);

  const dialog = $<HTMLDialogElement>('exportDialog');
  $('openExport').onclick = () => { update(); dialog.showModal(); dialog.querySelector<HTMLElement>('[aria-current=true]')?.focus(); };
  $('closeExport').onclick = () => dialog.close();
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  function syncHistory() {
    $<HTMLButtonElement>('undo').disabled = editor.busy || !editor.history.canUndo;
    $<HTMLButtonElement>('redo').disabled = editor.busy || !editor.history.canRedo;
  }
  function update() {
    const S = editor.settings;
    try { result = renderer.render(S, editor.decodedImage); }
    catch (e) { result = render(null, S); showMessage((e as Error).message); }
    comparison.sync();
    const canvas = $<HTMLCanvasElement>('cv'); canvas.hidden = !result.lines; $('empty').hidden = !!result.lines;
    $('term').style.setProperty('--termbg', S.termBg);
    if (result.lines) {
      const screen = $('screen');
      const cell = S.fit ? Math.max(1, Math.min(16, Math.floor((screen.clientWidth - 36) / Math.max(1, result.cols)))) : S.zoom;
      const cssCell = drawCells(canvas, result.rows, result.cols, { cell, ratio: S.ratio });
      $('ruler').replaceChildren(...[80, 103, 120].filter(width => width * cssCell < screen.clientWidth + 400).map(width => { const mark = document.createElement('span'); mark.style.left = `${width * cssCell}px`; mark.textContent = `${width} col`; return mark; }));
    } else $('ruler').replaceChildren();
    const stats = $('stats');
    const segment = (text: string, className = '') => { const item = document.createElement('span'); item.className = className; item.textContent = text; return item; };
    if (result.lines) {
      const fit = S.targetCols ? `fits ${S.targetCols} col` : result.cols <= 80 ? 'fits 80 col' : `needs ${result.cols} col`;
      stats.replaceChildren(segment({ half: 'HALF', quad: 'QUAD', full: 'FULL' }[S.mode], 'mode'), segment(`${result.cols}×${result.lines}`), segment(`${(result.bytes / 1024).toFixed(1)} KB`), segment(S.color === 'true' ? 'truecolor' : `${S.color} colors`), segment(fit, `fit ${result.cols <= 80 || S.targetCols ? 'ok' : result.cols <= 120 ? 'warn' : 'bad'}`));
    } else stats.replaceChildren(segment('IDLE', 'mode'), segment('no output yet'));
    $('termtitle').textContent = `ssh ${S.name || 'banner'}`;
    controls.sync(); syncHistory(); exports.update(editor.snapshot(), result);
  }
  editor.subscribe(event => {
    syncHistory();
    if (event === 'busy') return;
    showMessage(''); controls.sync(); schedule();
    if (event === 'change') save();
  });
  const editing = () => !!open && !$('editorView').hidden && !dialog.open;
  const travel = (direction: 'undo' | 'redo') => { void editor.travel(direction).catch(e => showMessage(e.message)); };
  $('undo').onclick = () => travel('undo'); $('redo').onclick = () => travel('redo');
  window.addEventListener('keydown', event => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || editor.busy || !editing()) return;
    const target = event.target as HTMLElement;
    if (target.closest('textarea, input:not([type=range]):not([type=color]):not([type=checkbox]), [contenteditable=true]')) return;
    if (event.key.toLowerCase() === 'z' || (event.ctrlKey && event.key.toLowerCase() === 'y')) { event.preventDefault(); travel(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo'); }
  });
  const loadImage = (file?: File) => { if (file && editing()) void editor.replaceImage(() => importImage(file)).catch(e => showMessage(e.message)); };
  $<HTMLInputElement>('imgfile').onchange = event => { const input = event.target as HTMLInputElement; loadImage(input.files?.[0]); input.value = ''; };
  const drop = $('drop');
  for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) drop.addEventListener(type, event => { event.preventDefault(); drop.classList.toggle('drag', type === 'dragenter' || type === 'dragover'); });
  drop.addEventListener('drop', event => loadImage((event as DragEvent).dataTransfer?.files[0]));
  window.addEventListener('paste', event => loadImage([...event.clipboardData?.files ?? []].find(file => file.type.startsWith('image/'))));
  window.addEventListener('resize', schedule);
  window.addEventListener('pagehide', () => { void flush(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flush(); });
  void document.fonts.ready.then(fontsChanged);
  Object.assign(window, { tracery: { get settings() { return editor.settings; }, get project() { return editor.snapshot(); }, get open() { return open; }, editor, renderer, storage, router } });
}
void start().catch(e => { document.body.textContent = `Could not start Tracery: ${e.message}`; });

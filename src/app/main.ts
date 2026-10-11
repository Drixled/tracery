import './styles.css';
import { parseProject, render, type Raster } from '../engine';
import { element as $, showMessage } from './dom';
import { Editor } from './editor';
import { ProjectStorage } from './storage';
import { Renderer } from './renderer';
import { setupControls } from './controls';
import { setupLibrary } from './library';
import { Comparison } from './comparison';
import { ExportPanel } from './export-panel';
import { decodeImage, importImage } from './images';
import { drawCells } from './preview';
import { Views } from './views';

async function start() {
  const storage = new ProjectStorage(message => { $('saveStatus').textContent = message; });
  const initial = await storage.loadInitial();
  const editor = new Editor<Raster>(initial, decodeImage);
  try { await editor.restore(initial, 'initial'); } catch (e) { showMessage((e as Error).message); }
  const renderer = new Renderer();
  const exports = new ExportPanel();
  let result = render(null, editor.settings);
  let queued = false;
  const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
  const fontsChanged = () => { renderer.invalidateFonts(); schedule(); };
  const flush = () => { void storage.flushDraft().catch(e => { $('saveStatus').textContent = `Could not save: ${e.message} Download your project to keep it.`; }); };
  const controls = setupControls(editor, fontsChanged, flush);
  const comparison = new Comparison(() => ({ result, settings: editor.settings }), schedule);
  const thumbnail = () => {
    result = renderer.render(editor.settings, editor.decodedImage);
    const source = document.createElement('canvas');
    drawCells(source, result.rows, result.cols, { cell: 2, ratio: editor.settings.ratio });
    if (!result.lines) return '';
    const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 80;
    const context = canvas.getContext('2d')!; context.imageSmoothingEnabled = false;
    context.fillStyle = editor.settings.termBg; context.fillRect(0, 0, 160, 80);
    const scale = Math.min(152 / source.width, 72 / source.height);
    context.drawImage(source, (160 - source.width * scale) / 2, (80 - source.height * scale) / 2, source.width * scale, source.height * scale);
    return canvas.toDataURL('image/png');
  };
  const views = new Views(schedule);
  const library = setupLibrary(editor, storage, thumbnail, () => views.open('editor'));
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
      const cell = S.fit ? Math.max(1, Math.min(16, Math.floor(((screen.clientWidth || 800) - 64) / Math.max(1, result.cols)), Math.floor(((screen.clientHeight || 400) - 52) / Math.max(1, result.lines * S.ratio)))) : S.zoom;
      const cssCell = drawCells(canvas, result.rows, result.cols, { cell, ratio: S.ratio });
      const rulerOffset = Math.max(0, (screen.clientWidth - 64 - result.cols * cssCell) / 2);
      $('ruler').replaceChildren(...[80, 103, 120].filter(width => width * cssCell < screen.clientWidth + 400).map(width => { const mark = document.createElement('span'); mark.style.left = `${rulerOffset + width * cssCell}px`; mark.textContent = `${width} col`; return mark; }));
    } else $('ruler').replaceChildren();
    const stats = $('stats'); stats.replaceChildren();
    if (result.lines) {
      for (const label of [`${result.cols} × ${result.lines} cells`, `${(result.bytes / 1024).toFixed(1)} KB`, S.color === 'true' ? 'Truecolor' : `${S.color} colors`]) { const item = document.createElement('span'); item.textContent = label; stats.append(item); }
      const fit = document.createElement('span'); fit.className = `fitpill ${result.cols <= 80 ? 'ok' : result.cols <= 120 ? 'warn' : 'bad'}`; fit.textContent = S.targetCols ? `Fits ${S.targetCols} col` : result.cols <= 80 ? 'Fits 80 col' : `Needs ${result.cols} col`; stats.append(fit);
    } else stats.textContent = 'No output yet';
    $('termtitle').textContent = `Current · ${result.cols}×${result.lines} cells`;
    controls.sync(); syncHistory(); exports.update(editor.snapshot(), result);
  }
  editor.subscribe(event => {
    syncHistory();
    if (event === 'change') { showMessage(''); controls.sync(); storage.queueDraft(editor.snapshot()); schedule(); }
  });
  const travel = (direction: 'undo' | 'redo') => { void editor.travel(direction).catch(e => showMessage(e.message)); };
  $('undo').onclick = () => travel('undo'); $('redo').onclick = () => travel('redo');
  window.addEventListener('keydown', event => {
    if (!(event.metaKey || event.ctrlKey) || event.altKey || editor.busy) return;
    const target = event.target as HTMLElement;
    if (target.closest('textarea, input:not([type=range]):not([type=color]):not([type=checkbox]), [contenteditable=true]')) return;
    if (event.key.toLowerCase() === 'z' || (event.ctrlKey && event.key.toLowerCase() === 'y')) { event.preventDefault(); travel(event.shiftKey || event.key.toLowerCase() === 'y' ? 'redo' : 'undo'); }
  });
  $<HTMLInputElement>('importFile').onchange = event => {
    const input = event.target as HTMLInputElement; const file = input.files?.[0]; input.value = ''; if (!file) return;
    void editor.importProject(async () => { if (file.size > 4 * 1024 * 1024) throw new Error('The project file is too large (maximum 4 MB).'); return parseProject(JSON.parse(await file.text())); })
      .then(applied => { if (applied) { $('importMsg').textContent = `Loaded ${file.name}.`; library.detach(file.name.replace(/(?:\.tracery)?\.json$/i, '')); views.open('editor'); } })
      .catch(e => { $('importMsg').textContent = `Could not load ${file.name}: ${e.message}`; });
  };
  const loadImage = (file?: File) => { if (file) void editor.replaceImage(() => importImage(file)).catch(e => showMessage(e.message)); };
  $<HTMLInputElement>('imgfile').onchange = event => { const input = event.target as HTMLInputElement; loadImage(input.files?.[0]); input.value = ''; };
  const drop = $('drop');
  for (const type of ['dragenter', 'dragover', 'dragleave', 'drop']) drop.addEventListener(type, event => { event.preventDefault(); drop.classList.toggle('drag', type === 'dragenter' || type === 'dragover'); });
  drop.addEventListener('drop', event => loadImage((event as DragEvent).dataTransfer?.files[0]));
  window.addEventListener('paste', event => loadImage([...event.clipboardData?.files ?? []].find(file => file.type.startsWith('image/'))));
  window.addEventListener('resize', schedule);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  void document.fonts.ready.then(fontsChanged);
  update();
  Object.assign(window, { tracery: { get settings() { return editor.settings; }, get project() { return editor.snapshot(); }, editor, renderer, storage, views } });
}
void start().catch(e => showMessage(`Could not start Tracery: ${e.message}`));

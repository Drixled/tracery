import './styles.css';
import {
  DEFAULTS,
  LOOKS,
  ONEIR_ART,
  PALETTES,
  PALETTE_CATEGORIES,
  buildExport,
  generatePalette,
  rasterizeCells,
  buildDownload,
  createProject,
  parseProject,
  MAX_IMAGE_DATA,
  type Project,
  type SourceImage,
  maskFromAscii,
  normalizeSettings,
  validateSettings,
  render,
  slug,
  type Dither,
  type ExportKind,
  type Palette,
  type RenderResult,
  type Settings,
} from '../engine';
import { maskFromImage, maskFromText } from './canvas-masks';
import { drawCells } from './preview';
import { History } from './history';

const STORE = 'tracery:v1';
const TAB_STORE = 'tracery:tab';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const initial = loadProject();
let S: Settings = initial.settings;
let sourceImage: SourceImage | null = initial.image;
const history = new History(initial);
const project = () => createProject(S, sourceImage);
let imageRequest = 0;
let tab: ExportKind = loadTab();
let image: HTMLImageElement | null = null;
let last: RenderResult = render(null, S);
let renderId = 0;
let png: { id: number; bytes: Uint8Array; url: string } | null = null;
let pngPending: number | null = null;
let pngError: { id: number; message: string } | null = null;

function loadProject(): Project {
  try {
    const raw = localStorage.getItem(STORE) ?? localStorage.getItem('ansi-kiln:v1');
    if (raw) return parseProject(JSON.parse(raw));
  } catch { /* storage unavailable or corrupt */ }
  return createProject(normalizeSettings({}));
}
function loadTab(): ExportKind {
  try {
    const t = localStorage.getItem(TAB_STORE) ?? localStorage.getItem('ansi-kiln:tab');
    if (t && ['install', 'agent', 'printf', 'raw', 'png', 'graphics', 'json'].includes(t)) return t as ExportKind;
  } catch { /* ignore */ }
  return 'install';
}
function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(project()));
    localStorage.setItem(TAB_STORE, tab);
  } catch { $('projectMsg').textContent = 'Browser storage is full or unavailable. Download your project to keep it.'; }
}

/* ---------- render loop ---------- */
let queued = false;
let pendingEdit = false;
let editGroup: string | undefined;
function schedule(group?: string | false) {
  if (group !== false) { pendingEdit = true; editGroup = group; }
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    update();
  });
}
function syncHistory() {
  $<HTMLButtonElement>('undo').disabled = !history.canUndo;
  $<HTMLButtonElement>('redo').disabled = !history.canRedo;
}

function currentMask() {
  if (S.src === 'text') return maskFromText(S);
  if (S.src === 'image') return maskFromImage(image, S);
  return maskFromAscii(S.ascii, S);
}

function update() {
  if (pendingEdit) { history.record(project(), editGroup); pendingEdit = false; }
  syncHistory();
  try {
    last = render(currentMask(), S);
    $('projectMsg').textContent = '';
  } catch (e) {
    last = render(null, S);
    $('projectMsg').textContent = (e as Error).message;
  }
  renderId++;
  const cv = $<HTMLCanvasElement>('cv');
  $('empty').hidden = last.lines > 0;
  cv.hidden = last.lines === 0;
  $('term').style.setProperty('--termbg', S.termBg);

  if (last.lines) {
    const screen = $('screen');
    const cell = S.fit ? Math.max(1, Math.min(16, Math.floor((screen.clientWidth - 36) / Math.max(1, last.cols)))) : S.zoom;
    const cssCell = drawCells(cv, last.rows, last.cols, { cell, ratio: S.ratio });
    const ruler = $('ruler');
    ruler.replaceChildren(
      ...[80, 103, 120]
        .filter((w) => w * cssCell < screen.clientWidth + 400)
        .map((w) => {
          const sp = document.createElement('span');
          sp.style.left = `${w * cssCell}px`;
          sp.textContent = `${w} col`;
          return sp;
        }),
    );
  } else {
    $('ruler').replaceChildren();
  }

  const stats = $('stats');
  if (last.lines) {
    const [cls, label] =
      last.cols <= 80 ? ['ok', 'Fits 80 col'] : last.cols <= 120 ? ['warn', `Needs ${last.cols} col`] : ['bad', `Wide: ${last.cols} col`];
    stats.innerHTML =
      `<span><b>${last.cols}</b> × <b>${last.lines}</b> cells</span>` +
      `<span><b>${(last.bytes / 1024).toFixed(1)}</b> KB</span>` +
      `<span>${S.color === 'true' ? 'Truecolor' : `${S.color} colors`}</span>` +
      `<span class="fitpill ${cls}">${label}</span>`;
  } else stats.innerHTML = '<span>No output yet</span>';
  $('termtitle').textContent = `ssh ${slug(S.name)}  ·  ${last.cols}×${last.lines}`;

  renderExport();
  syncUI();
  save();
}

/* ---------- PNG ---------- */
const needsPng = () => tab === 'png' || tab === 'graphics';

/** Rasterize the current banner and encode it as PNG through a canvas. Cached per render. */
async function ensurePng(): Promise<Uint8Array | null> {
  if (!last.lines) return null;
  if (png && png.id === renderId) return png.bytes;
  const id = renderId;
  let r;
  try { r = rasterizeCells(last.rows, last.cols, S.pngCell, S.ratio, S.pngTransparent ? null : S.termBg); }
  catch (e) { pngError = { id, message: (e as Error).message }; renderExport(); return null; }
  const cv = document.createElement('canvas');
  cv.width = r.width;
  cv.height = r.height;
  cv.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.data.buffer, r.data.byteOffset, r.data.length), r.width, r.height), 0, 0);
  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, 'image/png'));
  if (id !== renderId) return null;
  if (!blob) { pngError = { id, message: 'Could not encode the PNG. Reduce Cell px or the source size.' }; renderExport(); return null; }
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (id !== renderId) return null;
  if (png) URL.revokeObjectURL(png.url);
  png = { id, bytes, url: URL.createObjectURL(blob) };
  return bytes;
}

function schedulePng() {
  if (pngPending !== null) clearTimeout(pngPending);
  pngPending = window.setTimeout(async () => {
    pngPending = null;
    if (needsPng() && (await ensurePng())) renderExport();
  }, 120);
}

/* ---------- export panel ---------- */
function renderExport() {
  document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  const fresh = png && png.id === renderId ? png : null;
  if (needsPng() && !fresh && pngError?.id !== renderId) schedulePng();
  const e = buildExport(tab, S, last, { png: fresh?.bytes, project: project() });
  $('exnote').textContent = needsPng() && pngError?.id === renderId ? pngError.message : e.note;
  const isPng = tab === 'png';
  $('out').hidden = isPng;
  $('pngview').hidden = !isPng;
  if (isPng && fresh) {
    const img = $<HTMLImageElement>('pngimg');
    if (img.src !== fresh.url) img.src = fresh.url;
  }
  if (!isPng) $('out').textContent = tab === 'raw' ? e.text.replace(/\x1b/g, '␛') : e.text;
  const dl = $<HTMLButtonElement>('download');
  dl.textContent =
    tab === 'json' ? 'Download .json'
    : tab === 'png' ? 'Download .png'
    : tab === 'graphics' || tab === 'install' || tab === 'printf' ? 'Download .sh'
    : tab === 'agent' ? 'Download .txt'
    : 'Download .ansi';
  dl.disabled = tab !== 'json' && (!last.lines || (needsPng() && !fresh));
  $<HTMLButtonElement>('copy').disabled = tab !== 'json' && (!last.lines || (needsPng() && !fresh));
  $('copy').textContent = isPng ? 'Copy image' : 'Copy';
}

/** Allowed extensions when running inside a claude.ai artifact; anything else is saved as .txt. */
const HOSTED_EXT = ['png', 'json', 'txt'];
type HostedDownloads = { save(r: { filename: string; data: string | Blob }): Promise<unknown> };
const hosted: Promise<HostedDownloads | null> = (window as any).claude?.use
  ? (window as any).claude.use('downloads').catch(() => null)
  : Promise.resolve(null);

async function downloadBlob(name: string, data: string | Uint8Array, type: string) {
  const blob = new Blob([data as BlobPart], { type });
  const host = await hosted;
  if (host) {
    const ext = name.split('.').pop() ?? '';
    const filename = HOSTED_EXT.includes(ext) ? name : `${name}.txt`;
    try {
      await host.save({ filename, data: blob });
    } catch (e: any) {
      if (e?.code !== 'declined') $('exnote').textContent = `Couldn't save ${filename}. Copy the text instead.`;
    }
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- UI sync ---------- */
const MODE_HINT = {
  half: 'One cell holds two stacked pixels. Square pixels, safest everywhere.',
  quad: 'One cell holds a 2×2 grid. Finer dither, narrower output. Ghostty draws these natively.',
  full: 'Two full blocks per pixel. Chunky and very wide.',
};

function syncUI() {
  document.querySelectorAll<HTMLInputElement>('[data-k]').forEach((el) => {
    const v = S[el.dataset.k as keyof Settings];
    if (el.type === 'checkbox') el.checked = !!v;
    else if (document.activeElement !== el && el.value !== String(v)) el.value = String(v);
  });
  document.querySelectorAll<HTMLElement>('[data-out]').forEach((o) => {
    o.textContent = String(S[o.dataset.out as keyof Settings]);
  });
  document.querySelectorAll<HTMLElement>('[data-seg]').forEach((seg) =>
    seg.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.setAttribute('aria-pressed', String(S[seg.dataset.seg as keyof Settings] === b.dataset.v)),
    ),
  );
  (['ascii', 'text', 'image'] as const).forEach((s) => ($(`pane-${s}`).hidden = S.src !== s));
  document.querySelectorAll<HTMLElement>('#palettes .chip').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.name === S.palette)));
  $<HTMLInputElement>('zoom').disabled = S.fit;
  $('modehint').textContent = MODE_HINT[S.mode];
  $('gfxColsOut').textContent = S.gfxCols > 0 ? String(S.gfxCols) : `auto`;
}

function renderStops() {
  const box = $('stops');
  box.replaceChildren();
  S.stops.forEach((c, i) => {
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = c;
    inp.id = `stop${i}`;
    inp.setAttribute('aria-label', `Ramp color ${i + 1}`);
    inp.addEventListener('input', () => {
      S.stops[i] = inp.value;
      S.palette = '';
      schedule(inp.id);
    });
    inp.addEventListener('change', () => { flushEdit(); history.endGroup(); });
    box.appendChild(inp);
  });
  const mk = (label: string, title: string, disabled: boolean, fn: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mini';
    b.textContent = label;
    b.title = title;
    b.disabled = disabled;
    b.onclick = () => {
      fn();
      S.palette = '';
      renderStops();
      schedule();
    };
    return b;
  };
  box.append(
    mk('+', 'Add a color', S.stops.length >= 6, () => S.stops.push(S.stops[S.stops.length - 1] || '#ffffff')),
    mk('−', 'Remove the last color', S.stops.length <= 1, () => S.stops.pop()),
  );
}

function applyPalette(p: Palette) {
  Object.assign(S, {
    palette: p.name,
    stops: p.stops.slice(),
    outlineColor: p.outlineColor,
    lipColor: p.lipColor,
    shineColor: p.shineColor,
    shadowColor: p.shadowColor,
  });
  if (p.dither) S.dither = p.dither;
  else if (S.dither === 'none') S.dither = 'bayer4';
  renderStops();
  schedule();
}

function replaceSettings(next: Settings) {
  S = next;
  $<HTMLTextAreaElement>('ascii').value = S.ascii;
  $<HTMLTextAreaElement>('text').value = S.text;
  renderStops();
  schedule();
}

/* ---------- wiring ---------- */
const catSelect = $<HTMLSelectElement>('palCat');
for (const c of PALETTE_CATEGORIES) catSelect.add(new Option(c, c));

function paletteChip(p: Palette) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.dataset.name = p.name;
  b.setAttribute('aria-pressed', String(p.name === S.palette));
  const sw = document.createElement('span');
  sw.className = 'sw';
  sw.style.background = `linear-gradient(180deg,${p.stops.join(',')})`;
  sw.style.boxShadow = `0 0 0 2px ${p.outlineColor}`;
  b.append(sw, p.name);
  b.onclick = () => applyPalette(p);
  return b;
}

function renderPaletteList() {
  const q = $<HTMLInputElement>('palSearch').value.trim().toLowerCase();
  const cat = catSelect.value;
  const box = $('palettes');
  box.replaceChildren();
  let shown = 0;
  for (const c of PALETTE_CATEGORIES) {
    if (cat && c !== cat) continue;
    const items = PALETTES.filter((p) => p.category === c && (!q || p.name.toLowerCase().includes(q) || c.toLowerCase().includes(q)));
    if (!items.length) continue;
    const h = document.createElement('div');
    h.className = 'cat';
    h.textContent = `${c} · ${items.length}`;
    box.append(h, ...items.map(paletteChip));
    shown += items.length;
  }
  $('palCount').textContent = shown ? `${shown} of ${PALETTES.length} palettes` : 'No palettes match. Try another word, or Generate one.';
}
$('palSearch').addEventListener('input', renderPaletteList);
catSelect.addEventListener('change', renderPaletteList);
renderPaletteList();

$('generate').onclick = () => applyPalette(generatePalette());

for (const l of LOOKS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip plain';
  b.textContent = l.name;
  b.onclick = () => {
    Object.assign(S, l.v);
    schedule();
  };
  $('looks').appendChild(b);
}

document.querySelectorAll<HTMLInputElement>('[data-k]').forEach((el) => {
  const evt = el.tagName === 'SELECT' || el.type === 'checkbox' ? 'change' : 'input';
  el.addEventListener(evt, () => {
    const k = el.dataset.k as keyof Settings;
    const value = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    try { S = validateSettings({ ...S, [k]: value }); }
    catch (e) {
      if (el.type !== 'checkbox') el.value = String(S[k]);
      $('projectMsg').textContent = (e as Error).message;
      return;
    }
    if (k === 'font') document.fonts.load(`${S.size}px "${S.font}"`).then(() => schedule(false), () => schedule(false));
    schedule(evt === 'input' ? el.id : undefined);
  });
  el.addEventListener('change', () => { flushEdit(); history.endGroup(); });
});
document.querySelectorAll<HTMLElement>('[data-seg]').forEach((seg) =>
  seg.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    (S as any)[seg.dataset.seg!] = b.dataset.v;
    schedule();
  }),
);
document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    tab = b.dataset.tab as ExportKind;
    renderExport();
    save();
  }),
);

$('loadOneir').onclick = () => {
  S.ascii = ONEIR_ART;
  $<HTMLTextAreaElement>('ascii').value = ONEIR_ART;
  schedule();
};
$('reset').onclick = () => { imageRequest++; sourceImage = null; image = null; replaceSettings(normalizeSettings({})); $('dropmsg').textContent = 'Drop a PNG or click to choose. Transparent logos work best.'; };
$('shuffle').onclick = () => {
  const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
  applyPalette(p);
  const dithers: Dither[] = ['bayer4', 'bayer2', 'bayer8', 'checker', 'lines', 'noise'];
  if (!p.dither) S.dither = dithers[Math.floor(Math.random() * dithers.length)];
  S.dir = (['v', 'v', 'h', 'd', 'r'] as const)[Math.floor(Math.random() * 5)];
  S.reverse = Math.random() < 0.2;
  schedule();
};

$('copy').onclick = async () => {
  const btn = $('copy');
  const idle = btn.textContent;
  const flash = (msg: string) => {
    btn.textContent = msg;
    setTimeout(() => (btn.textContent = idle), 1600);
  };
  if (tab === 'png') {
    try {
      const bytes = await ensurePng();
      if (!bytes) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
      flash('Copied');
    } catch {
      flash('Use Download instead');
    }
    return;
  }
  const text = buildExport(tab, S, last, { png: png?.id === renderId ? png.bytes : undefined, project: project() }).text;
  const fallback = () => {
    const r = document.createRange();
    r.selectNodeContents($('out'));
    const sel = getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
    flash('Selected, press ⌘C');
  };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => flash('Copied'), fallback);
  else fallback();
};
$('download').onclick = async () => {
  const selected = tab;
  const bytes = selected === 'png' || selected === 'graphics' ? await ensurePng() : undefined;
  if ((selected === 'png' || selected === 'graphics') && !bytes) return;
  const file = buildDownload(selected, S, last, { png: bytes ?? undefined, project: project() });
  await downloadBlob(file.filename, file.data, file.mime);
};

function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      if (!im.naturalWidth || !im.naturalHeight || im.naturalWidth > 2048 || im.naturalHeight > 2048)
        reject(new Error('The saved image must be at most 2048 pixels on each side.'));
      else resolve(im);
    };
    im.onerror = () => reject(new Error('The source image could not be read.'));
    im.src = dataUrl;
  });
}

async function restoreProject(next: Project, record = true) {
  if (record) flushEdit();
  const request = ++imageRequest;
  const restored = next.image ? await decodeImage(next.image.dataUrl) : null;
  if (request !== imageRequest) return;
  image = restored;
  sourceImage = next.image;
  S = next.settings;
  $<HTMLTextAreaElement>('ascii').value = S.ascii;
  $<HTMLTextAreaElement>('text').value = S.text;
  $('dropmsg').textContent = sourceImage ? `${sourceImage.name} · Saved in this project.` : 'Drop a PNG or click to choose. Transparent logos work best.';
  renderStops();
  if (record) schedule(); else schedule(false);
}

function flushEdit() {
  if (pendingEdit) { history.record(project(), editGroup); pendingEdit = false; }
}
async function travel(direction: 'undo' | 'redo') {
  flushEdit();
  const next = history[direction]();
  syncHistory();
  if (next) await restoreProject(next, false);
}
$('undo').onclick = () => void travel('undo');
$('redo').onclick = () => void travel('redo');
window.addEventListener('keydown', e => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
  const target = e.target as HTMLElement;
  // Keep native text-field undo while the user edits text.
  if (target.closest('textarea, input:not([type=range]):not([type=color]):not([type=checkbox]), [contenteditable=true]')) return;
  if (e.key.toLowerCase() === 'z' || (e.ctrlKey && e.key.toLowerCase() === 'y')) {
    e.preventDefault();
    void travel(e.shiftKey || e.key.toLowerCase() === 'y' ? 'redo' : 'undo');
  }
});

$<HTMLInputElement>('importFile').addEventListener('change', async (e) => {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0];
  input.value = '';
  if (!f) return;
  const msg = $('importMsg');
  try {
    if (f.size > 4 * 1024 * 1024) throw new Error('The project file is too large (maximum 4 MB).');
    const parsed = parseProject(JSON.parse(await f.text()));
    await restoreProject(parsed);
    msg.textContent = `Loaded ${f.name}.`;
  } catch (e) {
    msg.textContent = `Could not load ${f.name}: ${(e as Error).message}`;
  }
});

async function loadImage(f: File | undefined) {
  if (!f || !f.type.startsWith('image/')) {
    $('dropmsg').textContent = 'That file is not an image. Try a PNG, JPG, GIF or WebP.';
    return;
  }
  const request = ++imageRequest;
  const url = URL.createObjectURL(f);
  try {
    if (f.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
    const original = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('This image could not be read.'));
      im.src = url;
    });
    const scale = Math.min(1, 2048 / Math.max(original.naturalWidth, original.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(original.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(original.naturalHeight * scale));
    canvas.getContext('2d')!.drawImage(original, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl.length > MAX_IMAGE_DATA) throw new Error('The image is too large to save. Choose a smaller image.');
    const decoded = await decodeImage(dataUrl);
    if (request !== imageRequest) return;
    image = decoded;
    sourceImage = { dataUrl, name: f.name.slice(0, 256) };
    S.src = 'image';
    $('dropmsg').textContent = `${f.name} · ${canvas.width}×${canvas.height}. Saved in this project.`;
    schedule();
  } catch (e) {
    if (request === imageRequest) $('dropmsg').textContent = (e as Error).message;
  } finally { URL.revokeObjectURL(url); }
}
$<HTMLInputElement>('imgfile').addEventListener('change', (e) => loadImage((e.target as HTMLInputElement).files?.[0]));
const drop = $('drop');
(['dragenter', 'dragover'] as const).forEach((t) =>
  drop.addEventListener(t, (e) => {
    e.preventDefault();
    drop.classList.add('drag');
  }),
);
(['dragleave', 'drop'] as const).forEach((t) =>
  drop.addEventListener(t, (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
  }),
);
drop.addEventListener('drop', (e) => loadImage((e as DragEvent).dataTransfer?.files[0]));
// Paste an image anywhere to use it as the source.
window.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
  if (f) loadImage(f);
});
window.addEventListener('resize', () => S.fit && schedule(false));

$<HTMLTextAreaElement>('ascii').value = S.ascii;
$<HTMLTextAreaElement>('text').value = S.text;
renderStops();
update();
document.fonts.ready.then(() => schedule(false));
if (initial.image) {
  const request = ++imageRequest;
  void decodeImage(initial.image.dataUrl).then(decoded => {
    if (request !== imageRequest) return;
    image = decoded;
    $('dropmsg').textContent = `${sourceImage!.name} · Saved in this project.`;
    schedule(false);
  }).catch(e => { if (request === imageRequest) $('projectMsg').textContent = e.message; });
}

// Keep DEFAULTS referenced for devtools tinkering.
(window as any).tracery = { get settings() { return S; }, defaults: DEFAULTS };

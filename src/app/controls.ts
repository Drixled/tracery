import { DEFAULTS, LOOKS, ONEIR_ART, PALETTES, PALETTE_CATEGORIES, SETTINGS_SCHEMA, createProject, generatePalette, maskFromAscii, render, type Dither, type Palette, type Raster, type Settings } from '../engine';
import type { Editor } from './editor';
import { element as $, showMessage } from './dom';
import { drawCells } from './preview';

/** Controls get their options and limits from the engine schema. */
export function setupControls(editor: Editor<Raster>, changedFont: () => void, endEdit: () => void) {
  const edit = (patch: Partial<Settings>, group?: string) => { try { editor.edit(patch, group); } catch (e) { showMessage((e as Error).message); } };
  for (const input of document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-k]')) {
    const key = input.dataset.k as keyof Settings;
    const rule = SETTINGS_SCHEMA[key];
    if (rule.kind === 'number' && input instanceof HTMLInputElement) { input.min = String(rule.min); input.max = String(rule.max); input.step = String(rule.step); }
    if (rule.kind === 'string' && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) input.maxLength = rule.maxLength;
    if (rule.kind === 'choice' && input instanceof HTMLSelectElement) input.replaceChildren(...rule.values.map((value, i) => new Option(rule.labels?.[i] ?? String(value), String(value))));
    const event = input instanceof HTMLSelectElement || (input instanceof HTMLInputElement && input.type === 'checkbox') ? 'change' : 'input';
    input.addEventListener(event, () => {
      const value = input instanceof HTMLInputElement && input.type === 'checkbox' ? input.checked : typeof DEFAULTS[key] === 'number' ? Number(input.value) : input.value;
      try { editor.edit({ [key]: value }, event === 'input' ? key : undefined); }
      catch (e) { input.value = String(editor.settings[key]); showMessage((e as Error).message); return; }
      if (key === 'font') void document.fonts.load(`${editor.settings.size}px "${editor.settings.font}"`).then(changedFont, changedFont);
    });
    input.addEventListener('change', () => { editor.endGroup(); endEdit(); });
  }
  for (const segment of document.querySelectorAll<HTMLElement>('[data-seg]')) {
    const key = segment.dataset.seg as keyof Settings;
    const rule = SETTINGS_SCHEMA[key];
    if (rule.kind !== 'choice') continue;
    segment.replaceChildren(...rule.values.map((value, i) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.v = String(value); button.textContent = rule.labels?.[i] ?? String(value);
      button.onclick = () => edit({ [key]: value });
      return button;
    }));
  }
  const applyPalette = (p: Palette, extra: Partial<Settings> = {}) => edit({ palette: p.name, stops: p.stops.slice(), outlineColor: p.outlineColor, lipColor: p.lipColor, shineColor: p.shineColor, shadowColor: p.shadowColor, dither: p.dither ?? (editor.settings.dither === 'none' ? 'bayer4' : editor.settings.dither), ...extra });
  const categories = $<HTMLSelectElement>('palCat');
  categories.append(...PALETTE_CATEGORIES.map(c => new Option(c, c)));
  const miniMask = maskFromAscii('XXXXXXX\n  XXX  \n  XXX  \n  XXX  \n  XXX  ', { ...DEFAULTS, cw: 2, ch: 2 });
  const previews = new Map<string, string>();
  const palettePreview = (palette: Palette) => {
    let url = previews.get(palette.name);
    if (!url) {
      const settings = { ...DEFAULTS, stops: palette.stops, outlineColor: palette.outlineColor, lipColor: palette.lipColor, shineColor: palette.shineColor, shadowColor: palette.shadowColor, dither: palette.dither ?? DEFAULTS.dither };
      const result = render(miniMask, settings);
      const canvas = document.createElement('canvas');
      drawCells(canvas, result.rows, result.cols, { cell: 4, ratio: 2 });
      url = canvas.toDataURL(); previews.set(palette.name, url);
    }
    return url;
  };
  const listPalettes = () => {
    const query = $<HTMLInputElement>('palSearch').value.trim().toLowerCase();
    const box = $('palettes'); box.replaceChildren(); let count = 0;
    for (const category of PALETTE_CATEGORIES) {
      if (categories.value && categories.value !== category) continue;
      const items = PALETTES.filter(p => p.category === category && (!query || p.name.toLowerCase().includes(query) || category.toLowerCase().includes(query)));
      if (!items.length) continue;
      const label = document.createElement('div'); label.className = 'cat'; label.textContent = `${category} · ${items.length}`; box.append(label);
      for (const p of items) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'chip'; button.dataset.name = p.name;
        const image = document.createElement('img'); image.className = 'palette-art'; image.alt = ''; image.src = palettePreview(p);
        const ramp = document.createElement('span'); ramp.className = 'palette-ramp';
        for (const color of p.stops) { const stop = document.createElement('i'); stop.style.background = color; ramp.append(stop); }
        const title = document.createElement('span'); title.textContent = p.name;
        button.append(image, ramp, title); button.onclick = () => applyPalette(p); box.append(button);
      }
      count += items.length;
    }
    $('palCount').textContent = count ? `${count} of ${PALETTES.length} palettes` : 'No palettes match. Try another word, or Generate one.';
    sync();
  };
  $('palSearch').addEventListener('input', listPalettes); categories.addEventListener('change', listPalettes);
  $('generate').onclick = () => applyPalette(generatePalette());
  $('shuffle').onclick = () => {
    const p = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    const dithers: Dither[] = ['bayer4', 'bayer2', 'bayer8', 'checker', 'lines', 'noise'];
    applyPalette(p, { dither: p.dither ?? dithers[Math.floor(Math.random() * dithers.length)], dir: (['v', 'v', 'h', 'd', 'r'] as const)[Math.floor(Math.random() * 5)], reverse: Math.random() < 0.2 });
  };
  for (const look of LOOKS) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'chip plain'; button.textContent = look.name; button.onclick = () => edit(look.v); $('looks').append(button);
  }
  $('loadOneir').onclick = () => edit({ ascii: ONEIR_ART });
  $('reset').onclick = () => { void editor.restore(createProject(DEFAULTS)).catch(e => showMessage(e.message)); };
  const syncStops = () => {
    const box = $('stops');
    if (box.querySelectorAll('input').length !== editor.settings.stops.length) {
      box.replaceChildren();
      editor.settings.stops.forEach((_color, i) => {
        const input = document.createElement('input'); input.type = 'color'; input.id = `stop${i}`; input.setAttribute('aria-label', `Ramp color ${i + 1}`);
        input.oninput = () => { const stops = editor.settings.stops.slice(); stops[i] = input.value; edit({ stops, palette: '' }, input.id); };
        input.onchange = () => { editor.endGroup(); endEdit(); }; box.append(input);
      });
      for (const [label, title, change] of [['+', 'Add a color', 1], ['−', 'Remove the last color', -1]] as const) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'mini'; button.textContent = label; button.title = title; button.dataset.change = String(change);
        button.onclick = () => { const stops = editor.settings.stops.slice(); if (change === 1) stops.push(stops.at(-1)!); else stops.pop(); edit({ stops, palette: '' }); }; box.append(button);
      }
    }
    box.querySelectorAll<HTMLInputElement>('input').forEach((input, i) => { if (input !== document.activeElement) input.value = editor.settings.stops[i]; });
    box.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = button.dataset.change === '1' ? editor.settings.stops.length >= 6 : editor.settings.stops.length <= 1; });
  };
  const hints = { half: 'One cell holds two stacked pixels. Square pixels, safest everywhere.', quad: 'One cell holds a 2×2 grid. Finer dither, narrower output.', full: 'Two full blocks per pixel. Chunky and very wide.' };
  function sync() {
    const S = editor.settings;
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-k]').forEach(input => {
      const value = S[input.dataset.k as keyof Settings];
      if (input instanceof HTMLInputElement && input.type === 'checkbox') input.checked = !!value;
      else if (input !== document.activeElement) input.value = String(value);
    });
    document.querySelectorAll<HTMLElement>('[data-out]').forEach(output => { output.textContent = String(S[output.dataset.out as keyof Settings]); });
    document.querySelectorAll<HTMLElement>('[data-seg]').forEach(segment => segment.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.setAttribute('aria-pressed', String(S[segment.dataset.seg as keyof Settings] === button.dataset.v))));
    for (const source of ['ascii', 'text', 'image']) $(`pane-${source}`).hidden = S.src !== source;
    document.querySelectorAll<HTMLElement>('#palettes .chip').forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.name === S.palette)));
    $<HTMLInputElement>('zoom').disabled = S.fit;
    $('modehint').textContent = hints[S.mode]; $('gfxColsOut').textContent = S.gfxCols ? String(S.gfxCols) : 'auto';
    $('dropmsg').textContent = editor.snapshot().image ? `${editor.snapshot().image!.name} · Saved in this project.` : 'Drop a PNG or click to choose. Transparent logos work best.';
    syncStops();
  }
  // Palette initialization happens after helpers are ready.
  listPalettes();
  return { sync };
}

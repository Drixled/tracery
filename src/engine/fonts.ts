import figlet from 'figlet';
import { parseTdf, type TdfFont } from './tdf';
import TDF_MANIFEST from './tdf-fonts.json';
import type { Art, ArtCell, FontLayout, Settings } from './types';

/** A loaded font that can set one line of text. */
export interface Face {
  id: string;
  /** Rows between wrapped or typed lines. */
  gap: number;
  line(text: string, layout: FontLayout): Art;
}

/** One TheDraw font family as listed on TAAG; most families are the same letters in several colors. */
export interface TdfFamily { name: string; file: string; variants: { id: string; label: string }[]; mono: boolean }
export const TDF_FAMILIES: TdfFamily[] = (TDF_MANIFEST as [string, string, [string, string][] | 0, number][]).map(([name, file, variants, mono]) => ({
  name, file, mono: !!mono,
  variants: variants ? variants.map(([font, label]) => ({ id: `tdf:${font}`, label })) : [{ id: `tdf:${name}`, label: name }],
}));
const familyOf = new Map(TDF_FAMILIES.flatMap(family => family.variants.map(v => [v.id, family] as const)));
export const tdfFamily = (id: string) => familyOf.get(id);
export const faceName = (id: string) => id.slice(id.indexOf(':') + 1);

const blank = (H: number): Art => ({ W: 0, H, cells: [], missing: [] });

const LAYOUTS = { default: 'default', full: 'full', fitted: 'fitted', smush: 'universal smushing' } as const;
/** Register a FIGlet font from its .flf text. */
export function figletFace(name: string, flf: string): Face {
  const id = `figlet:${name}`;
  const height = figlet.parseFont(id, flf).height ?? 1;
  const glyphs = figlet.figFonts[id];
  return {
    id, gap: 0,
    line(text, layout) {
      const missing = [...new Set(Array.from(text))].filter(c => c !== ' ' && !glyphs[c.codePointAt(0)!]);
      if (!text.trim()) return { ...blank(height), missing };
      const rows = figlet.textSync(text, { font: id, horizontalLayout: LAYOUTS[layout] }).split('\n').map(row => Array.from(row));
      const W = Math.max(0, ...rows.map(row => row.length));
      const cells: (ArtCell | null)[] = new Array(W * rows.length).fill(null);
      rows.forEach((row, y) => row.forEach((ch, x) => { if (ch !== ' ') cells[y * W + x] = { ch, fg: null, bg: null }; }));
      return { W, H: rows.length, cells, missing };
    },
  };
}

function tdfFace(font: TdfFont): Face {
  const glyphs = [...font.glyphs.values()];
  const height = Math.max(1, ...glyphs.map(g => g.H));
  const space = Math.max(1, Math.round(glyphs.reduce((w, g) => w + g.W, 0) / Math.max(1, glyphs.length) / 2));
  return {
    id: `tdf:${font.name}`, gap: 1,
    line(text) {
      const missing = new Set<string>();
      // Many TheDraw fonts only draw capitals, so lowercase falls back to them (and the other way round).
      const parts = Array.from(text).map(c => {
        if (c === ' ') return null;
        const g = font.glyphs.get(c) ?? font.glyphs.get(c.toUpperCase()) ?? font.glyphs.get(c.toLowerCase());
        if (!g) missing.add(c);
        return g;
      }).filter(g => g !== undefined);
      if (!parts.some(Boolean)) return { ...blank(height), missing: [...missing] };
      const W = parts.reduce((w, g, i) => w + (g ? g.W : space) + (i < parts.length - 1 ? font.spacing : 0), 0);
      const cells: (ArtCell | null)[] = new Array(W * height).fill(null);
      let x0 = 0;
      for (const g of parts) {
        if (g) for (let y = 0; y < g.H; y++) for (let x = 0; x < g.W; x++) cells[y * W + x0 + x] = g.cells[y * g.W + x];
        x0 += (g ? g.W : space) + font.spacing;
      }
      return { W, H: height, cells, missing: [...missing] };
    },
  };
}
/** Every font in a .tdf file. */
export const tdfFaces = (bytes: Uint8Array) => parseTdf(bytes).map(tdfFace);

/** Where font files come from: bundled chunks in the browser, the file system in the CLI. */
export interface FontReader { flf(name: string): Promise<string>; tdf(file: string): Promise<Uint8Array> }
const faces = new Map<string, Face>();
const loading = new Map<string, Promise<void>>();
/** A face that has finished loading, if any. */
export const loadedFace = (id: string) => faces.get(id);
/** Load a face once; a TheDraw file loads all of its color variants together. */
export async function loadFace(id: string, read: FontReader): Promise<Face> {
  const kind = id.slice(0, id.indexOf(':'));
  const family = kind === 'tdf' ? tdfFamily(id) : undefined;
  if (kind !== 'figlet' && !family) throw new Error(`Unknown font: ${faceName(id) || id}.`);
  const key = family ? `tdf:${family.file}` : id;
  let job = loading.get(key);
  if (!job) {
    job = family
      ? read.tdf(family.file).then(bytes => { for (const face of tdfFaces(bytes)) faces.set(face.id, face); })
      : read.flf(faceName(id)).then(text => { faces.set(id, figletFace(faceName(id), text)); });
    loading.set(key, job);
    job.catch(() => loading.delete(key));
  }
  await job;
  const face = faces.get(id);
  if (!face) throw new Error(`The font file has no font named ${faceName(id)}.`);
  return face;
}

/** Set the text in a face: wrap words at `fWrap` columns, then stack and align the lines. */
export function setText(face: Face, S: Pick<Settings, 'words' | 'fLayout' | 'fAlign' | 'fWrap'>): Art {
  const line = (text: string) => face.line(text, S.fLayout);
  const lines: Art[] = [];
  for (const paragraph of S.words.replace(/\r/g, '').split('\n')) {
    if (!S.fWrap) { lines.push(line(paragraph)); continue; }
    let current = '';
    for (const word of paragraph.split(/ +/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && line(next).W > S.fWrap) { lines.push(line(current)); current = word; }
      else current = next;
    }
    lines.push(line(current));
  }
  const W = Math.max(0, ...lines.map(l => l.W));
  const H = lines.reduce((h, l, i) => h + l.H + (i ? face.gap : 0), 0);
  const cells: (ArtCell | null)[] = new Array(W * H).fill(null);
  let y0 = 0;
  for (const l of lines) {
    const x0 = S.fAlign === 'center' ? Math.floor((W - l.W) / 2) : S.fAlign === 'right' ? W - l.W : 0;
    for (let y = 0; y < l.H; y++) for (let x = 0; x < l.W; x++) cells[(y0 + y) * W + x0 + x] = l.cells[y * l.W + x];
    y0 += l.H + face.gap;
  }
  return { W, H, cells, missing: [...new Set(lines.flatMap(l => l.missing))] };
}

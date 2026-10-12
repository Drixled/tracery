import { SETTINGS_SCHEMA, TDF_FAMILIES, loadFace, type FontReader, type Settings } from '../engine';
import META from './font-meta.json';

// Each FIGlet font is its own chunk, fetched the first time it's shown.
const FLF = import.meta.glob<string>('/node_modules/figlet/fonts/*.flf', { query: '?raw', import: 'default' });
const flfPath = (name: string) => `/node_modules/figlet/fonts/${name}.flf`;

const READER: FontReader = {
  flf: name => FLF[flfPath(name)]?.() ?? Promise.reject(new Error(`Unknown font: ${name}.`)),
  async tdf(file) {
    const response = await fetch(`/fonts/tdf/${encodeURIComponent(file)}.tdf`);
    if (!response.ok) throw new Error(`Could not load the font file ${file} (${response.status}).`);
    return new Uint8Array(await response.arrayBuffer());
  },
};
export const browserFace = (id: string) => loadFace(id, READER);

/** One card in the font picker. A TheDraw family is one card; its color variants are picked in the editor's toolbar. */
export interface FontEntry {
  id: string; name: string; kind: 'figlet' | 'tdf' | 'web'; colored: boolean; variants: { id: string; label: string }[];
  /** Letter height in rows, and whether the letters are drawn with block characters (from scripts/font-meta.mjs). */
  height: number; solid: boolean;
}
const meta = (id: string) => { const [height, solid] = (META as Record<string, number[]>)[id] ?? [6, 0]; return { height, solid: !!solid }; };
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
export const FIGLET_FONTS: FontEntry[] = Object.keys(FLF)
  .map(path => path.slice(path.lastIndexOf('/') + 1, -4))
  .map(name => ({ id: `figlet:${name}`, name, kind: 'figlet' as const, colored: false, variants: [], ...meta(`figlet:${name}`) }))
  .sort(byName);
export const TDF_FONTS: FontEntry[] = TDF_FAMILIES
  .map(family => ({ id: family.variants[0].id, name: family.name, kind: 'tdf' as const, colored: !family.mono, variants: family.variants.length > 1 ? family.variants : [], ...meta(family.variants[0].id) }))
  .sort(byName);
/** The web fonts of the Text source, drawn by the browser and turned into block pixels. */
export const WEB_FONTS: FontEntry[] = (SETTINGS_SCHEMA.font.kind === 'choice' ? SETTINGS_SCHEMA.font.values.map(String) : [])
  .map(name => ({ id: `web:${name}`, name, kind: 'web' as const, colored: false, variants: [], height: 8, solid: true }));
/** The picker card a FIGlet or TheDraw face belongs to. */
export const entryOf = (id: string) => [...FIGLET_FONTS, ...TDF_FONTS].find(entry => entry.id === id || entry.variants.some(v => v.id === id));

/** A font as it was drawn, before any styling: its own colors, or plain light text. */
export const asDrawn = (S: Settings): Settings => ({ ...S, draw: 'chars', tint: 'font', stops: ['#efe6d8'], shadowOn: false, color: 'true' });

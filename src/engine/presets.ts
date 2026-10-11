import { settingError } from './settings-schema';
import { PALETTES } from './palettes';
import type { Look, Settings } from './types';

/** Iván's "Oneir" letterforms, the default source. */
export const ONEIR_ART = String.raw`            ....                                     .
        .x~X88888Hx.                                @88>
       H8X 888888888h.      u.    u.                %8P      .u    .
      8888:\`*888888888:   x@88k u@88c.      .u       .     .d88B :@8c
      88888:        \`%8  ^"8888""8888"   ud8888.   .@88u  ="8888f8888r
    . \`88888          ?>   8888  888R  :888'8888. ''888E\`   4888>'88"
    \`. ?888%           X   8888  888R  d888 '88%"   888E    4888> '
      ~*??.            >   8888  888R  8888.+"      888E    4888>
     .x88888h.        <    8888  888R  8888L        888E   .d888L .+
    :"""8888888x..  .x    "*88*" 8888" '8888c. .+   888&   ^"8888*"
    \`    \`*888888888"       ""   'Y"    "88888%     R888"     "Y"
            ""***""                       "YP'       ""`.replace(/\\`/g, '`');

export const LOOKS: Look[] = [
  { name: 'Bubble', v: { gap: 1, outline: 1, lipOn: true, shineOn: true, bevel: false, shadowOn: false, gapFillOn: false } },
  { name: 'Clean', v: { gap: 0, outline: 1, lipOn: true, shineOn: false, bevel: false, shadowOn: false } },
  { name: 'Bare fill', v: { gap: 0, outline: 0, shineOn: false, bevel: false, shadowOn: false } },
  { name: 'Double ring', v: { gap: 1, outline: 2, lipOn: true, shineOn: true, bevel: false, shadowOn: false, gapFillOn: false } },
  { name: 'Bevel', v: { gap: 0, outline: 1, lipOn: true, shineOn: false, bevel: true, shadowOn: false } },
  { name: 'Drop shadow', v: { gap: 0, outline: 1, lipOn: false, shineOn: true, bevel: false, shadowOn: true, sdx: 2, sdy: 2 } },
  { name: 'Extrude', v: { gap: 0, outline: 0, shineOn: false, bevel: true, shadowOn: true, sdx: 1, sdy: 2 } },
];

const K = PALETTES[0];

export const DEFAULTS: Settings = {
  src: 'ascii', ascii: ONEIR_ART, cw: 3, ch: 4, glyph: true,
  text: 'Oneir', font: 'Shrikhand', size: 22, tracking: 1, leading: 2,
  imgW: 96, thresh: 50, imgUse: 'alpha', imgColors: false,
  palette: K.name, stops: K.stops.slice(), dither: 'bayer4', dir: 'v', reverse: false, spread: 100,
  gap: 1, gapFillOn: false, gapFill: '#000000', outline: 1, outlineColor: K.outlineColor,
  lipOn: true, lipColor: K.lipColor, shineOn: true, shineColor: K.shineColor, bevel: false,
  shadowOn: false, shadowColor: K.shadowColor, sdx: 2, sdy: 1,
  mode: 'quad', color: 'true', name: 'oneir', targetCols: 0,
  pngCell: 8, pngTransparent: true, gfxProto: 'kitty', gfxCols: 0,
  fit: true, zoom: 6, ratio: 2, termBg: '#0c0c0c',
};

/** Normalize stored settings. Invalid values use defaults; unknown keys are ignored. */
export function normalizeSettings(input: unknown): Settings {
  const out: Settings = { ...DEFAULTS, stops: DEFAULTS.stops.slice() };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const src = input as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const value = src[key];
    if (value !== undefined && settingError(key, value) === null) {
      (out as unknown as Record<string, unknown>)[key] = Array.isArray(value) ? value.slice() : value;
    }
  }
  return out;
}

/** Reject invalid supplied values before an import changes the current project. */
export function validateSettings(input: unknown): Settings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Settings must be a JSON object.');
  const src = input as Record<string, unknown>;
  const keys = Object.keys(DEFAULTS) as (keyof Settings)[];
  if (Object.keys(src).length && !keys.some(key => Object.hasOwn(src, key))) throw new Error('No Tracery settings were found.');
  for (const key of keys) {
    if (Object.hasOwn(src, key)) { const error = settingError(key, src[key]); if (error) throw new Error(error); }
  }
  return normalizeSettings(src);
}

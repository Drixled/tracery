import type { Settings } from './types';

export type SettingRule =
  | { kind: 'number'; min: number; max: number; step: number; integer?: boolean }
  | { kind: 'choice'; values: readonly (string | number)[]; labels?: readonly string[] }
  | { kind: 'boolean' } | { kind: 'color' } | { kind: 'stops' }
  | { kind: 'string'; maxLength: number; maxLines?: number; maxColumns?: number };
const number = (min: number, max: number, step = 1, integer = true): SettingRule => ({ kind: 'number', min, max, step, integer });
const choice = (values: readonly (string | number)[], labels?: readonly string[]): SettingRule => ({ kind: 'choice', values, labels });
const bool: SettingRule = { kind: 'boolean' };
const color: SettingRule = { kind: 'color' };
const text = (maxLength = 128, maxLines?: number, maxColumns?: number): SettingRule => ({ kind: 'string', maxLength, maxLines, maxColumns });

/** Validation and browser controls use these same limits, options, and steps. */
export const SETTINGS_SCHEMA: Record<keyof Settings, SettingRule> = {
  src: choice(['ascii', 'text', 'image'], ['ASCII art', 'Text', 'Image']),
  ascii: text(32768, 256, 512), cw: number(1, 6), ch: number(1, 8), glyph: bool,
  text: text(2048, 32, 128), font: choice(['Shrikhand', 'Bowlby One SC', 'Bungee', 'Rubik Mono One', 'Righteous', 'Silkscreen', 'Press Start 2P', 'Pixelify Sans', 'VT323']),
  size: number(6, 64), tracking: number(-3, 8), leading: number(0, 16), imgW: number(16, 240), thresh: number(1, 99),
  imgUse: choice(['alpha', 'dark', 'light'], ['Opaque', 'Dark', 'Light']), imgColors: bool,
  palette: text(), stops: { kind: 'stops' },
  dither: choice(['bayer4', 'bayer2', 'bayer8', 'checker', 'lines', 'noise', 'none'], ['Bayer 4×4', 'Bayer 2×2', 'Bayer 8×8', 'Checker seam', 'Scanlines', 'Noise', 'Hard bands']),
  dir: choice(['v', 'h', 'd', 'r'], ['Vertical', 'Horizontal', 'Diagonal', 'Radial']), reverse: bool, spread: number(40, 200, 5, false),
  gap: number(0, 3), gapFillOn: bool, gapFill: color, outline: number(0, 3), outlineColor: color,
  lipOn: bool, lipColor: color, shineOn: bool, shineColor: color, bevel: bool, shadowOn: bool, shadowColor: color, sdx: number(-4, 4), sdy: number(-4, 4),
  mode: choice(['half', 'quad', 'full'], ['Half ▀▄', 'Quadrant ▚', 'Full ██']), color: choice(['true', '256', '16'], ['Truecolor', '256', '16 VGA']), name: text(),
  targetCols: choice([0, 80, 103, 120], ['Original width', 'Fit 80 columns', 'Fit 103 columns', 'Fit 120 columns']),
  pngCell: number(1, 32), pngTransparent: bool, gfxProto: choice(['kitty', 'iterm'], ['Kitty / Ghostty', 'iTerm2']), gfxCols: number(0, 200),
  fit: bool, zoom: number(1, 16), ratio: number(1.6, 2.4, 0.05, false), termBg: color,
};
const HEX = /^#[0-9a-f]{6}$/i;
export function settingError(key: keyof Settings, value: unknown): string | null {
  const rule = SETTINGS_SCHEMA[key];
  const prefix = `Invalid setting: ${key}. `;
  if (rule.kind === 'choice') return rule.values.includes(value as string | number) ? null : prefix + `Choose ${rule.values.join(', ')}.`;
  if (rule.kind === 'number') return typeof value === 'number' && Number.isFinite(value) && value >= rule.min && value <= rule.max && (!rule.integer || Number.isInteger(value)) ? null : prefix + `Use ${rule.integer ? 'a whole number' : 'a number'} from ${rule.min} to ${rule.max}.`;
  if (rule.kind === 'boolean') return typeof value === 'boolean' ? null : prefix + 'Use true or false.';
  if (rule.kind === 'color') return typeof value === 'string' && HEX.test(value) ? null : prefix + 'Use a color such as #ffcc00.';
  if (rule.kind === 'stops') return Array.isArray(value) && value.length >= 1 && value.length <= 6 && value.every(v => typeof v === 'string' && HEX.test(v)) ? null : prefix + 'Use 1 to 6 hex colors.';
  if (typeof value !== 'string' || value.length > rule.maxLength) return prefix + `Use at most ${rule.maxLength} characters.`;
  const lines = value.replace(/\t/g, '    ').split('\n');
  if (rule.maxLines && lines.length > rule.maxLines) return prefix + `Use at most ${rule.maxLines} lines.`;
  if (rule.maxColumns && lines.some(line => Array.from(line).length > rule.maxColumns!)) return prefix + `Use at most ${rule.maxColumns} characters per line.`;
  return null;
}

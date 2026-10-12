import { VGA } from './color';
import type { ArtCell } from './types';

/** CP437, the DOS code page TheDraw fonts are drawn in, with its symbols for the control codes. */
const CP437 =
  ' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼' +
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂' +
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';
/** TheDraw stores colors in CGA order (blue before red); VGA is in ANSI order. */
const CGA_TO_ANSI = [0, 4, 2, 6, 1, 5, 3, 7];
const cga = (i: number) => VGA[CGA_TO_ANSI[i & 7] + (i & 8)];
// shortcut: outline fonts always use TheDraw's first (single line) border style; 2 of 3,339 fonts are outlines.
const OUTLINE = '──││┌┐┌┐└┘└┘┤├   ';
const MAGIC = 0x55aa00ff;

export type TdfType = 'outline' | 'block' | 'color';
export interface TdfGlyph { W: number; H: number; cells: (ArtCell | null)[] }
export interface TdfFont { name: string; type: TdfType; spacing: number; glyphs: Map<string, TdfGlyph> }

function glyph(data: Uint8Array, at: number, type: TdfType): TdfGlyph {
  const W = data[at], H = data[at + 1];
  const cells: (ArtCell | null)[] = new Array(W * H).fill(null);
  let p = at + 2, x = 0, y = 0;
  while (p < data.length && data[p]) {
    const byte = data[p++];
    if (byte === 13) { x = 0; y++; continue; }
    const attr = type === 'color' ? data[p++] : 7;
    if (x >= W || y >= H) continue;
    const ch = type === 'outline' ? (byte === 64 ? ' ' : byte > 64 && byte <= 81 ? OUTLINE[byte - 65] : '') : CP437[byte];
    const bg = type === 'color' && attr >> 4 & 7 ? cga(attr >> 4) : null;
    // Outline fonts mark row ends with '&'. A space on a colored background is a solid block.
    if (ch !== '') cells[y * W + x] = ch === ' ' ? (bg ? { ch: '█', fg: bg, bg: null } : null) : { ch, fg: type === 'color' ? cga(attr & 15) : null, bg: ch === '█' ? null : bg };
    x++;
  }
  return { W, H, cells };
}

/** Read every font in a .tdf file. Throws on files that are not TheDraw fonts. */
export function parseTdf(bytes: Uint8Array): TdfFont[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 20 || String.fromCharCode(...bytes.subarray(1, 19)) !== 'TheDraw FONTS file') throw new Error('This is not a TheDraw font file.');
  const fonts: TdfFont[] = [];
  for (let p = 20; p + 233 <= bytes.length && view.getUint32(p) === MAGIC;) {
    const name = String.fromCharCode(...bytes.subarray(p + 5, p + 5 + Math.min(12, bytes[p + 4]))).replace(/[\0\s]+$/, '');
    const type = (['outline', 'block', 'color'] as const)[bytes[p + 21]] ?? 'color';
    const size = view.getUint16(p + 23, true);
    const data = bytes.subarray(p + 213, p + 213 + size);
    const glyphs = new Map<string, TdfGlyph>();
    for (let i = 0; i < 94; i++) {
      const offset = view.getUint16(p + 25 + i * 2, true);
      if (offset !== 0xffff && offset + 2 < data.length) glyphs.set(String.fromCharCode(33 + i), glyph(data, offset, type));
    }
    fonts.push({ name, type, spacing: bytes[p + 22], glyphs });
    p += 213 + size;
  }
  if (!fonts.length) throw new Error('The TheDraw font file has no fonts.');
  return fonts;
}

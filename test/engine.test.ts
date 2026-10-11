import { describe, expect, it } from 'vitest';
import {
  DEFAULTS,
  ONEIR_ART,
  buildExport,
  createQuantizer,
  encode,
  maskFromAscii,
  normalizeSettings,
  render,
  rowsFor,
  toBase64,
  type Settings,
} from '../src/engine';

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
const settings = (over: Partial<Settings> = {}): Settings => normalizeSettings({ ...DEFAULTS, ...over });

describe('Oneir art', () => {
  it('keeps its backticks', () => {
    expect(ONEIR_ART).toContain('8888:`*888888888:');
    expect(ONEIR_ART).not.toContain('\\`');
    expect(ONEIR_ART.split('\n')).toHaveLength(12);
  });
});

describe('maskFromAscii', () => {
  it('scales each character to a cw×ch block and trims shared indent', () => {
    const m = maskFromAscii('  ##\n  #', { cw: 2, ch: 3, glyph: false })!;
    expect(m.W).toBe(4);
    expect(m.H).toBe(6);
    expect([...m.F.slice(0, 4)]).toEqual([1, 1, 1, 1]);
    expect([...m.F.slice(3 * 4, 3 * 4 + 4)]).toEqual([1, 1, 0, 0]);
  });
  it('returns null for blank input', () => {
    expect(maskFromAscii('  \n\n ', { cw: 2, ch: 2, glyph: true })).toBeNull();
  });
  it('places punctuation on the right sub-rows', () => {
    expect(rowsFor('.', 4, true)).toEqual([3]);
    expect(rowsFor('"', 4, true)).toEqual([0, 1]);
    expect(rowsFor('8', 4, true)).toEqual([0, 1, 2, 3]);
    expect(rowsFor('.', 4, false)).toEqual([0, 1, 2, 3]);
  });
});

describe('render', () => {
  it('renders the default Oneir banner', () => {
    const S = settings();
    const r = render(maskFromAscii(S.ascii, S), S);
    expect(r.lines).toBeGreaterThan(10);
    expect(r.cols).toBeGreaterThan(80);
    expect(r.ansi.endsWith('\x1b[0m\n')).toBe(true);
    const lines = r.ansi.trimEnd().split('\n');
    expect(lines).toHaveLength(r.lines);
    for (const l of lines) expect([...strip(l)].length).toBeLessThanOrEqual(r.cols);
    expect(r.ansi).toMatch(/38;2;255;255;85/); // Kiln yellow
  });

  it('quad output is half as wide as half-block output', () => {
    const half = settings({ mode: 'half' });
    const quad = settings({ mode: 'quad' });
    const a = render(maskFromAscii(half.ascii, half), half);
    const b = render(maskFromAscii(quad.ascii, quad), quad);
    expect(Math.abs(b.cols * 2 - a.cols)).toBeLessThanOrEqual(1);
  });

  it('uses only block glyphs and spaces', () => {
    for (const mode of ['half', 'quad', 'full'] as const) {
      const S = settings({ mode });
      const r = render(maskFromAscii(S.ascii, S), S);
      expect(strip(r.ansi)).toMatch(/^[ \n▘▝▀▖▌▞▛▗▚▐▜▄▙▟█]+$/);
    }
  });

  it('emits 256-color and 16-color codes when asked', () => {
    const s256 = settings({ color: '256' });
    const s16 = settings({ color: '16' });
    const a = render(maskFromAscii(s256.ascii, s256), s256).ansi;
    const b = render(maskFromAscii(s16.ascii, s16), s16).ansi;
    expect(a).toMatch(/38;5;\d+/);
    expect(a).not.toMatch(/38;2;/);
    expect(b).not.toMatch(/38;[25];/);
    expect(b).toMatch(/\x1b\[0;9[0-7]m/);
  });

  it('is deterministic', () => {
    const S = settings({ dither: 'noise', shadowOn: true, bevel: true });
    const m = maskFromAscii(S.ascii, S);
    expect(render(m, S).ansi).toBe(render(m, S).ansi);
  });
});

describe('encode', () => {
  it('packs a 2×2 checker into one quadrant cell', () => {
    const q = createQuantizer('true');
    const A = '#ff0000', B = '#0000ff';
    const rows = encode({ W: 2, H: 2, px: [A, B, B, A] }, 'quad');
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toMatchObject({ m: 0b1001, fg: A, bg: B });
    expect(q.sgr(A, false)).toBe('38;2;255;0;0');
  });
});

describe('normalizeSettings', () => {
  it('drops unknown keys and wrong types', () => {
    const s = normalizeSettings({ gap: 'lots', outline: 2, evil: true, stops: ['nope'] });
    expect(s.gap).toBe(DEFAULTS.gap);
    expect(s.outline).toBe(2);
    expect((s as any).evil).toBeUndefined();
    expect(s.stops).toEqual(DEFAULTS.stops);
  });
});

describe('exports', () => {
  it('install command round-trips the banner through base64', () => {
    const S = settings({ name: 'Oneir!' });
    const r = render(maskFromAscii(S.ascii, S), S);
    const e = buildExport('install', S, r);
    expect(e.text).toContain('/etc/oneir/banner.ansi');
    expect(e.text).toContain('/etc/update-motd.d/00-oneir');
    const b64 = e.text.match(/printf '%s' '([^']+)'/)![1];
    expect(b64).toBe(toBase64(r.ansi));
    expect(Buffer.from(b64, 'base64').toString('utf8')).toBe(r.ansi);
  });
});

import { inflateSync, deflateSync } from 'node:zlib';
import { PALETTES, PALETTE_CATEGORIES, generatePalette, rasterizeCells, encodePng, kittySequence, crc32 } from '../src/engine';

describe('palettes', () => {
  it('has well over a hundred uniquely named palettes in every category', () => {
    expect(PALETTES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(PALETTES.map((p) => p.name)).size).toBe(PALETTES.length);
    for (const c of PALETTE_CATEGORIES) expect(PALETTES.some((p) => p.category === c)).toBe(true);
    for (const p of PALETTES) for (const h of [...p.stops, p.outlineColor, p.lipColor, p.shineColor, p.shadowColor]) expect(h).toMatch(/^#[0-9a-f]{6}$/);
  });
  it('generates valid palettes deterministically from a seed', () => {
    const a = generatePalette(0.42), b = generatePalette(0.42);
    expect(a).toEqual(b);
    expect(a.stops.length).toBeGreaterThanOrEqual(2);
    for (const h of a.stops) expect(h).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('png', () => {
  it('rasterizes cells at cellW × cellW·ratio and encodes a valid PNG', async () => {
    const S = settings();
    const r = render(maskFromAscii(S.ascii, S), S);
    const ras = rasterizeCells(r.rows, r.cols, 6, 2, null);
    expect(ras.width).toBe(r.cols * 6);
    expect(ras.height).toBe(r.lines * 12);
    const png = await encodePng(ras, (d) => new Uint8Array(deflateSync(d)));
    expect([...png.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const dv = new DataView(png.buffer, png.byteOffset);
    expect(dv.getUint32(16)).toBe(ras.width);
    expect(dv.getUint32(20)).toBe(ras.height);
    // IHDR CRC is correct
    expect(dv.getUint32(29)).toBe((crc32(png.subarray(12, 29)) ^ 0xffffffff) >>> 0);
    // IDAT inflates to height × (1 + width × 4) bytes
    const idatLen = dv.getUint32(33);
    const raw = inflateSync(png.subarray(41, 41 + idatLen));
    expect(raw.length).toBe(ras.height * (1 + ras.width * 4));
  });
});

describe('kitty graphics', () => {
  it('chunks base64 into ≤4096-byte pieces with m flags', () => {
    const b64 = 'A'.repeat(10000);
    const seq = kittySequence(b64, 80);
    const parts = seq.trimEnd().split('\x1b\\').filter(Boolean);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^\x1b_Ga=T,f=100,q=2,c=80,m=1;A{4096}$/);
    expect(parts[1]).toMatch(/^\x1b_Gq=2,m=1;A{4096}$/);
    expect(parts[2]).toMatch(/^\x1b_Gq=2,m=0;A{1808}$/);
  });
  it('sends a single chunk with m=0', () => {
    expect(kittySequence('QUJD', 10)).toBe('\x1b_Ga=T,f=100,q=2,c=10,m=0;QUJD\x1b\\\n');
  });
});

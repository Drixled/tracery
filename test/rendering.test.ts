import { describe, expect, it } from 'vitest';
import { DEFAULTS, maskFromAscii, maskFromRgba, normalizeSettings, render, SETTINGS_SCHEMA, validateSettings } from '../src/engine';
import { Renderer } from '../src/app/renderer';
import { PNG } from 'pngjs';
import { decodePng } from '../cli/image';
import { parseCli, numericOption } from '../cli/args';

describe('actual terminal width', () => {
  it.each(['half', 'quad', 'full'] as const)('fits the exported %s art within each selected width', mode => {
    for (const targetCols of [80, 103, 120]) {
      const S = normalizeSettings({ mode, targetCols });
      const result = render(maskFromAscii(S.ascii, S), S);
      expect(result.cols).toBeLessThanOrEqual(targetCols);
      expect(result.cols).toBeGreaterThan(0);
      for (const line of result.ansi.trimEnd().split('\n')) expect([...line.replace(/\x1b\[[0-9;]*m/g, '')].length).toBeLessThanOrEqual(targetCols);
    }
  });
  it('does not enlarge art which already fits', () => {
    const S = normalizeSettings({ ascii: '#', targetCols: 80 });
    expect(render(maskFromAscii(S.ascii, S), S)).toEqual(render(maskFromAscii(S.ascii, S), { ...S, targetCols: 0 }));
  });
});
describe('source and render caching', () => {
  it('reuses source masks for palette changes and results for preview changes', () => {
    const renderer = new Renderer();
    const first = renderer.render(DEFAULTS, null);
    expect(renderer.maskBuilds).toBe(1);
    expect(renderer.render({ ...DEFAULTS, zoom: 12, name: 'different', pngCell: 20 }, null)).toBe(first);
    expect(renderer.renderBuilds).toBe(1);
    renderer.render({ ...DEFAULTS, stops: ['#ff0000'] }, null);
    expect(renderer.maskBuilds).toBe(1);
    expect(renderer.renderBuilds).toBe(2);
    renderer.render({ ...DEFAULTS, ascii: '#' }, null);
    expect(renderer.maskBuilds).toBe(2);
  });
});
describe('PNG input', () => {
  it('decodes RGBA images and preserves alpha and source colors', () => {
    const image = new PNG({ width: 2, height: 2 });
    image.data.set([255,0,0,255, 0,255,0,255, 0,0,255,0, 255,255,255,255]);
    const raster = decodePng(PNG.sync.write(image));
    expect([...raster.data]).toEqual([...image.data]);
    const S = normalizeSettings({ src: 'image', imgW: 16, mode: 'half', imgColors: true });
    const mask = maskFromRgba(raster, S);
    expect(mask.F[0]).toBe(1);
    expect(mask.F[15 * 16]).toBe(0);
    expect(mask.C![0]).toBe('#ff0000');
    expect(render(mask, S).ansi).toContain('38;2;255;0;0');
  });
  it('rejects invalid input and huge dimensions before decoding', () => {
    expect(() => decodePng(Buffer.from('bad PNG'))).toThrow('valid PNG');
    const data = PNG.sync.write(new PNG({ width: 1, height: 1 }));
    data.writeUInt32BE(100000, 16);
    expect(() => decodePng(data)).toThrow('2048');
  });
});
describe('shared rules and CLI flags', () => {
  it('defines a rule for every default and validates its own defaults', () => {
    expect(Object.keys(SETTINGS_SCHEMA).sort()).toEqual(Object.keys(DEFAULTS).sort());
    expect(validateSettings(DEFAULTS)).toEqual(DEFAULTS);
  });
  it.each(['abc', '', 'NaN', 'Infinity', '-1', '1.5', '1000'])('rejects bad numeric options: %s', value => expect(() => numericOption('cell', 'pngCell', value)).toThrow());
  it('accepts auto image columns and supported fitting widths', () => {
    expect(numericOption('cols', 'gfxCols', '0')).toBe(0);
    expect(numericOption('width', 'targetCols', '103')).toBe(103);
    expect(() => numericOption('width', 'targetCols', '999')).toThrow();
  });
  it.each([['--kitty', '--iterm'], ['--install', '--agent'], ['--art', 'a', '--image', 'b'], ['one.json', 'two.json']].map(args => [args] as const))('rejects conflicting arguments %j', args => expect(() => parseCli(args)).toThrow());
});

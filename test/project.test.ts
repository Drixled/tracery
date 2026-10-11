import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { DEFAULTS, normalizeSettings, validateSettings, createProject, parseProject, buildDownload, buildExport, maskFromAscii, render, rasterizeCells } from '../src/engine';
import { History } from '../src/app/history';

const pngUrl = 'data:image/png;base64,iVBORw0KGgo=';

describe('settings validation', () => {
  it.each([
    ['mode', 'oops'], ['src', 'url'], ['color', '24'], ['dither', 'random'], ['font', 'unknown'],
    ['ratio', 0], ['gap', -1], ['size', Infinity], ['imgW', NaN], ['cw', 1.5], ['pngCell', 1000],
    ['outlineColor', 'red'], ['termBg', '#fff'], ['stops', []], ['stops', ['#ffffff', 'bad']],
    ['stops', Array(7).fill('#ffffff')], ['ascii', 'a'.repeat(513)], ['text', 'a'.repeat(129)],
  ])('rejects invalid %s values on import and uses defaults for stored settings', (key, value) => {
    expect(() => validateSettings({ [key]: value })).toThrow();
    expect(normalizeSettings({ [key]: value })).toEqual(DEFAULTS);
  });
  it('accepts valid partial and legacy settings without copying unknown keys', () => {
    expect(validateSettings({ mode: 'half', gap: 0, extra: true })).toMatchObject({ mode: 'half', gap: 0 });
    expect(validateSettings({ outlineColor: '#ABCDEF', ratio: 2.1 }).outlineColor).toBe('#ABCDEF');
    expect(() => validateSettings({ unrelated: true })).toThrow();
    expect(() => validateSettings([])).toThrow();
  });
  it('stops large raster allocations before rendering', () => {
    expect(() => maskFromAscii('x'.repeat(4097), { cw: 1, ch: 1, glyph: false })).toThrow('too large');
    expect(() => rasterizeCells(Array.from({ length: 1024 }, () => []), 1024, 32, 2, null)).toThrow('too large');
  });
});

describe('complete projects', () => {
  it('round-trips all settings, inactive sources, and the source image', () => {
    const source = { name: 'logo.png', dataUrl: pngUrl };
    const saved = createProject({ ...DEFAULTS, src: 'image', ascii: '##', text: 'Tracery' }, source);
    const restored = parseProject(JSON.parse(JSON.stringify(saved)));
    expect(restored).toEqual(saved);
    source.name = 'changed';
    expect(saved.image!.name).toBe('logo.png');
    restored.settings.stops[0] = '#000000';
    expect(saved.settings.stops[0]).not.toBe('#000000');
  });
  it('reads old flat settings files', () => {
    expect(parseProject({ src: 'ascii', ascii: '#', mode: 'half' })).toMatchObject({ version: 1, image: null, settings: { ascii: '#', mode: 'half' } });
  });
  it.each([
    { format: 'tracery', version: 2, settings: DEFAULTS },
    { format: 'other', version: 1, settings: DEFAULTS },
    { format: 'tracery', version: 1, settings: DEFAULTS, image: { name: 'bad', dataUrl: 'https://example.com/a.png' } },
    { format: 'tracery', version: 1, settings: { mode: 'bad' } },
  ])('rejects malformed projects', value => expect(() => parseProject(value)).toThrow());
});

describe('downloads', () => {
  const S = normalizeSettings({ ascii: '##' });
  const r = render(maskFromAscii(S.ascii, S), S);
  const extras = { png: new Uint8Array([1, 2, 3]), project: createProject(S, { name: 'logo.png', dataUrl: pngUrl }) };
  it.each(['install', 'agent', 'printf', 'raw', 'graphics', 'json'] as const)('downloads the displayed %s export', kind => {
    expect(buildDownload(kind, S, r, extras).data).toBe(buildExport(kind, S, r, extras).text + (kind === 'raw' ? '' : '\n'));
  });
  it('writes a valid MOTD shell script with real line breaks', () => {
    const line = buildExport('install', S, r).text.split('\n').find(line => line.includes("'#!/bin/sh'"))!;
    const write = line.split(' | sudo tee')[0];
    expect(execFileSync('/bin/sh', ['-c', write], { encoding: 'utf8' })).toBe('#!/bin/sh\ncat /etc/oneir/banner.ansi\n');
  });
  it('uses correct filenames and PNG bytes', () => {
    expect(buildDownload('install', S, r).filename).toBe('oneir.install.sh');
    expect(buildDownload('agent', S, r).filename).toBe('oneir.agent.txt');
    expect(buildDownload('graphics', S, r, extras).filename).toBe('oneir.graphics.sh');
    expect(buildDownload('raw', S, r).data).toBe(r.ansi);
    expect(buildDownload('png', S, r, extras)).toEqual({ filename: 'oneir.png', data: extras.png, mime: 'image/png' });
    expect(parseProject(JSON.parse(buildDownload('json', S, r, extras).data as string))).toEqual(extras.project);
    expect(() => buildDownload('graphics', S, r)).toThrow('not ready');
  });
});

describe('undo and redo', () => {
  it('groups continuous edits and keeps the value before the gesture', () => {
    const history = new History({ gap: 0 });
    history.record({ gap: 1 }, 'gap');
    history.record({ gap: 2 }, 'gap');
    history.record({ gap: 3 }, 'gap');
    expect(history.undo()).toEqual({ gap: 0 });
    expect(history.redo()).toEqual({ gap: 3 });
    history.endGroup();
    history.record({ gap: 2 }, 'gap');
    expect(history.undo()).toEqual({ gap: 3 });
  });
  it('restores image replacements, reset, and imports', () => {
    const first = createProject(DEFAULTS, { name: 'first.png', dataUrl: pngUrl });
    const second = createProject({ ...DEFAULTS, gap: 2 }, { name: 'second.png', dataUrl: pngUrl });
    const history = new History(first);
    history.record(second);
    history.record(createProject(DEFAULTS));
    expect(history.undo()).toEqual(second);
    expect(history.undo()).toEqual(first);
    expect(history.redo()).toEqual(second);
  });
  it('discards the redo branch after a new edit, limits memory, and ignores no-op edits', () => {
    const history = new History(0, 3);
    history.record(0);
    expect(history.canUndo).toBe(false);
    history.record(1); history.record(2); history.record(3);
    expect(history.undo()).toBe(2);
    expect(history.undo()).toBe(1);
    expect(history.undo()).toBe(null);
    history.record(4);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBe(1);
  });
});

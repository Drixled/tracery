import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';

const CLI = new URL('../dist/cli/tracery.js', import.meta.url).pathname;
const dir = mkdtempSync(join(tmpdir(), 'tracery-test-'));
const file = (name, text) => { const path = join(dir, name); writeFileSync(path, text); return path; };
const run = (...args) => execFileSync('node', [CLI, ...args], { encoding: 'utf8' });
const box = file('box.txt', '##########\n'.repeat(6));

test('install scripts only touch files Tracery owns', () => {
  const project = file('ssh.json', JSON.stringify({ name: 'ssh' }));
  for (const flag of ['--install', '--install-graphics']) {
    const script = run(project, flag);
    assert.doesNotMatch(script, /rm -r/);
    assert.doesNotMatch(script, /\/etc\/ssh\b/);
    assert.match(script, /# Undo: sudo rm \/etc\/tracery\/ssh\.ansi /);
  }
});

test('radial gradients reach the last stop', () => {
  const project = file('radial.json', JSON.stringify({ dir: 'r', stops: ['#ff0000', '#00ff00', '#0000ff'], outline: 0, gap: 0, shineOn: false, lipOn: false, dither: 'none' }));
  assert.match(run(project, '--art', box, '--mode', 'full'), /38;2;0;0;255/);
});

test('invalid project files are rejected', () => {
  const project = file('bad.json', JSON.stringify({ outlineColor: 'red' }));
  const result = spawnSync('node', [CLI, project, '--art', box], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Invalid setting: outlineColor/);
});

test('--png writes a PNG of the banner', () => {
  const out = join(dir, 'out.png');
  run('--art', box, '--png', out, '--cell', '2');
  const image = PNG.sync.read(readFileSync(out));
  assert.ok(image.width > 0 && image.height > 0);
  assert.ok(image.data.some((v, i) => i % 4 === 3 && v === 255), 'has painted pixels');
});

const plain = text => text.replace(/\x1b\[[0-9;]*m/g, '');

test('FIGlet font projects render, wrap and align', () => {
  const project = file('figlet.json', JSON.stringify({ src: 'font', face: 'figlet:Standard', words: 'Hello world', fWrap: 40, fAlign: 'center' }));
  const lines = plain(run(project)).split('\n');
  assert.ok(lines.length > 10, 'wrapped onto two lines of letters');
  assert.ok(lines.every(line => line.length <= 40));
});

test('TheDraw fonts keep their colors, or take the palette', () => {
  const own = run(file('tdf.json', JSON.stringify({ src: 'font', face: 'tdf:Cyberrr Cyan', words: 'Jomi' })));
  assert.match(own, /38;2;85;255;255/, 'bright cyan from the font');
  const shaded = run(file('tdf-shade.json', JSON.stringify({ src: 'font', face: 'tdf:Cyberrr Cyan', words: 'Jomi', tint: 'shade', stops: ['#000000', '#ff0000'], dither: 'none' })));
  assert.doesNotMatch(shaded, /38;2;85;255;255/);
  assert.match(shaded, /38;2;255;0;0/, 'the brightest font color becomes the lightest stop');
  assert.ok(plain(own).includes('▄'), 'Characters mode prints the font glyphs');
});

test('lowercase falls back to capitals, and blocks mode works on colored fonts', () => {
  const project = file('tdf-blocks.json', JSON.stringify({ src: 'font', face: 'tdf:Cyberrr Cyan', words: 'jomi', draw: 'blocks', outline: 1 }));
  assert.ok(plain(run(project)).trim().length > 0);
});

test('unknown fonts and Characters-mode PNGs explain themselves', () => {
  const unknown = spawnSync('node', [CLI, file('nofont.json', JSON.stringify({ src: 'font', face: 'tdf:Not A Font' }))], { encoding: 'utf8' });
  assert.match(unknown.stderr, /Unknown font: Not A Font/);
  const png = spawnSync('node', [CLI, file('chars.json', JSON.stringify({ src: 'font', words: 'hi' })), '--png', join(dir, 'chars.png')], { encoding: 'utf8' });
  assert.match(png.stderr, /Characters mode need the web app/);
});

test('ASCII art starts as blocks and prints as typed in Characters mode', () => {
  const art = ' /\\_/\\\n( o.o )';
  assert.ok(!plain(run(file('ascii.json', JSON.stringify({ src: 'ascii', ascii: art })))).includes('o.o'), 'blocks by default');
  assert.equal(plain(run(file('ascii-chars.json', JSON.stringify({ src: 'ascii', ascii: art, draw: 'chars' })))).replace(/\s+$/gm, '').trim(), art.trim());
});

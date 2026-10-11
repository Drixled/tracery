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

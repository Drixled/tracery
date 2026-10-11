import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PNG } from 'pngjs';
const run = args => spawnSync(process.execPath, ['dist/cli/tracery.js', ...args], { encoding: 'utf8' });

test('CLI errors have clear messages and no stack traces', () => {
  for (const [args, pattern] of [
    [['--cell','oops'], /--cell/], [['--cols','-1'], /--cols/], [['--width','999'], /--width/],
    [['--kitty','--iterm'], /one output/], [['--install','--agent'], /one output/],
    [['--art','/does-not-exist-tracery'], /Could not read/], [['--unknown-flag'], /Unknown option/],
    [['a.json','b.json'], /at most one/],
  ]) {
    const result = run(args); assert.equal(result.status, 1); assert.match(result.stderr, pattern); assert.doesNotMatch(result.stderr, /at (?:main|parseCli|Module)/);
  }
});
test('saved image projects and direct PNG inputs produce the same ANSI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracery-cli-'));
  try {
    const image = new PNG({ width: 4, height: 4 });
    for (let i = 0; i < image.data.length; i += 4) image.data.set([255, 0, 100, 255], i);
    const bytes = PNG.sync.write(image);
    const imagePath = join(dir, 'source.png'); writeFileSync(imagePath, bytes);
    const projectPath = join(dir, 'project.json');
    writeFileSync(projectPath, JSON.stringify({ format:'tracery', version:1, settings:{src:'image', imgColors:true}, image:{name:'source.png',dataUrl:`data:image/png;base64,${bytes.toString('base64')}`} }));
    const saved = run([projectPath]); const direct = run(['--image', imagePath, '--image-colors']);
    assert.equal(saved.status, 0, saved.stderr); assert.equal(direct.status, 0, direct.stderr); assert.equal(saved.stdout, direct.stdout); assert.match(saved.stdout, /38;2;255;0;100/);
    const out = join(dir, 'out.png'); const png = run([projectPath, '--png', out, '--width', '80']);
    assert.equal(png.status, 0, png.stderr); assert.equal(png.stdout, ''); assert.deepEqual([...readFileSync(out).subarray(0,8)], [137,80,78,71,13,10,26,10]);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});
test('legacy ASCII files still render and fit terminal columns', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracery-cli-'));
  try {
    const path = join(dir, 'legacy.kiln.json'); writeFileSync(path, JSON.stringify({ascii:'#'.repeat(100),mode:'full'}));
    const output = run([path,'--width','80']); assert.equal(output.status,0,output.stderr);
    for(const line of output.stdout.trimEnd().split('\n')) assert.ok([...line.replace(/\x1b\[[0-9;]*m/g,'')].length<=80);
  } finally { rmSync(dir, {recursive:true, force:true}); }
});

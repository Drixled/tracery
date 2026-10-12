// Writes src/app/font-meta.json: [height in rows, 1 if drawn with block characters] for every font,
// so the gallery can filter by size and look before any font loads. Run after changing the font set.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const BLOCKS = /[█▀▄▌▐░▒▓■]/g;
const solid = text => {
  const ink = text.replace(/[\s$@#]/g, '').length || 1;
  return (text.match(BLOCKS)?.length ?? 0) / ink > 0.3 ? 1 : 0;
};
const meta = {};

const fonts = join(dirname(createRequire(import.meta.url).resolve('figlet')), '..', 'fonts');
for (const file of readdirSync(fonts).filter(f => f.endsWith('.flf'))) {
  const text = readFileSync(join(fonts, file), 'utf8');
  const [header, ...rest] = text.split('\n');
  const [, height, , , , comments] = header.split(' ').map(Number);
  meta[`figlet:${file.slice(0, -4)}`] = [height, solid(rest.slice(comments).join('\n'))];
}

// TheDraw: the tallest glyph of the first font in each family. Block and color fonts are solid; outline fonts are lines.
const manifest = JSON.parse(readFileSync(join(root, 'src/engine/tdf-fonts.json'), 'utf8'));
for (const [name, file, variants] of manifest) {
  const b = readFileSync(join(root, 'public/fonts/tdf', `${file}.tdf`));
  const p = 20, size = b.readUInt16LE(p + 23), data = p + 213;
  let height = 1;
  for (let i = 0; i < 94; i++) {
    const offset = b.readUInt16LE(p + 25 + i * 2);
    if (offset !== 0xffff && offset + 2 < size) height = Math.max(height, b[data + offset + 1]);
  }
  meta[`tdf:${variants ? variants[0][0] : name}`] = [height, b[p + 21] === 0 ? 0 : 1];
}
writeFileSync(join(root, 'src/app/font-meta.json'), JSON.stringify(meta));
const all = Object.values(meta);
console.log(`${all.length} fonts, ${all.filter(m => m[1]).length} solid, heights`, [Math.min(...all.map(m => m[0])), Math.max(...all.map(m => m[0]))]);

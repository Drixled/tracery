#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { PALETTES, buildExport, graphicsSequence, gfxColumns, rasterizeCells, maskFromAscii, maskFromRgba, render, parseProject, validateSettings, type Settings, type Mask } from '../src/engine';
import { parseCli, numericOption } from './args';
import { decodePng } from './image';

const HELP = `tracery: render ASCII art or PNG images into colored terminal banners

Usage
  tracery [project.json] [options]

Options
  -a, --art <file>        ASCII art file ("-" reads stdin)
      --image <file>      PNG source; overrides the source in the project
      --image-colors      Use source image colors instead of the palette
  -p, --palette <name>    Palette preset (see --list-palettes)
  -m, --mode <mode>       half | quad | full
  -c, --color <depth>     true | 256 | 16
  -n, --name <name>       Banner name used in install paths
  -o, --out <file>        Write output to a file
      --width <cols>      Maximum exported width: 0 (original), 80, 103, or 120
      --install           Print an update-motd install script
      --agent             Print an agent prompt
      --png <file>        Also write a PNG (alone, suppresses ANSI on stdout)
      --cell <px>         PNG cell width: integer from 1 to 32
      --kitty             Print a Kitty / Ghostty graphics sequence
      --iterm             Print an iTerm2 graphics sequence
      --cols <n>          Terminal image display width: 0 (auto) to 200
      --install-graphics  Print a terminal image install script
      --info              Print output dimensions to stderr
      --list-palettes     List palette names
  -h, --help              Show help

Project files come from the browser app. ASCII and saved image projects work
with this CLI. Text sources need the browser's font renderer.
Choose one output mode; --png can add an image to any mode.

Examples
  tracery logo.tracery.json --width 80 > banner.ansi
  tracery --image logo.png --image-colors --mode half
  tracery --art logo.txt --palette "Hot Magenta" --png logo.png
  figlet -f slant hello | tracery --art - --color 256
`;
function read(path: string): Buffer {
  try { return readFileSync(path === '-' ? 0 : path); }
  catch (e) { throw new Error(`Could not read ${path}: ${(e as Error).message}`); }
}
function write(path: string, value: string | Uint8Array) {
  try { writeFileSync(path, value); }
  catch (e) { throw new Error(`Could not write ${path}: ${(e as Error).message}`); }
}
async function main() {
  const { values, positionals } = parseCli();
  if (values.help) { process.stdout.write(HELP); return; }
  if (values['list-palettes']) { process.stdout.write(PALETTES.map(p => p.name).join('\n') + '\n'); return; }
  let raw: unknown = {};
  if (positionals[0]) {
    try { raw = JSON.parse(read(positionals[0]).toString('utf8')); }
    catch (e) { throw new Error(`Could not load project ${positionals[0]}: ${(e as Error).message}`); }
  }
  const project = parseProject(raw);
  let S: Settings = project.settings;
  if (values.art) Object.assign(S, { src: 'ascii', ascii: read(values.art).toString('utf8') });
  if (values.image) S.src = 'image';
  if (values.palette) {
    const palette = PALETTES.find(p => p.name.toLowerCase() === values.palette!.toLowerCase());
    if (!palette) throw new Error(`Unknown palette "${values.palette}". Run --list-palettes.`);
    Object.assign(S, { palette: palette.name, stops: palette.stops.slice(), outlineColor: palette.outlineColor, lipColor: palette.lipColor, shineColor: palette.shineColor, shadowColor: palette.shadowColor });
    if (palette.dither) S.dither = palette.dither;
  }
  const overrides: Record<string, unknown> = {};
  for (const key of ['mode', 'color', 'name'] as const) if (values[key] !== undefined) overrides[key] = values[key];
  if (values.cell !== undefined) overrides.pngCell = numericOption('cell', 'pngCell', values.cell);
  if (values.cols !== undefined) overrides.gfxCols = numericOption('cols', 'gfxCols', values.cols);
  if (values.width !== undefined) overrides.targetCols = numericOption('width', 'targetCols', values.width);
  if (values.iterm) overrides.gfxProto = 'iterm';
  if (values.kitty) overrides.gfxProto = 'kitty';
  if (values['image-colors']) overrides.imgColors = true;
  S = validateSettings({ ...S, ...overrides });
  let mask: Mask | null;
  if (S.src === 'ascii') mask = maskFromAscii(S.ascii, S);
  else if (S.src === 'image') {
    const bytes = values.image ? read(values.image) : project.image ? Buffer.from(project.image.dataUrl.split(',')[1], 'base64') : null;
    if (!bytes) throw new Error('This image project has no source image. Pass --image logo.png.');
    mask = maskFromRgba(decodePng(bytes), S);
  } else throw new Error('Text projects need the web app. Pass --art or --image to replace the source.');
  const result = render(mask, S);
  if (!result.lines) throw new Error('Nothing to draw. The source is empty.');
  const wantsPng = !!(values.png || values.kitty || values.iterm || values['install-graphics']);
  let png: Uint8Array | undefined;
  if (wantsPng) {
    const raster = rasterizeCells(result.rows, result.cols, S.pngCell, S.ratio, S.pngTransparent ? null : S.termBg);
    const image = new PNG({ width: raster.width, height: raster.height });
    image.data = Buffer.from(raster.data.buffer);
    png = new Uint8Array(PNG.sync.write(image, { deflateLevel: 9 }));
  }
  if (values.png && png) write(values.png, png);
  const output = values['install-graphics'] ? buildExport('graphics', S, result, { png }).text + '\n' : values.kitty || values.iterm ? graphicsSequence(S.gfxProto, png!, gfxColumns(S, result)) : values.install ? buildExport('install', S, result).text + '\n' : values.agent ? buildExport('agent', S, result).text + '\n' : result.ansi;
  if (values.out) write(values.out, output);
  else if (!(values.png && !values.kitty && !values.iterm && !values.install && !values.agent && !values['install-graphics'])) process.stdout.write(output);
  if (values.info) process.stderr.write(`${result.cols}×${result.lines} cells, ${result.bytes} bytes, ${S.mode} blocks, ${S.color} color${png ? `, PNG ${png.length} bytes` : ''}\n`);
}
process.stdout.on('error', error => { if ((error as NodeJS.ErrnoException).code === 'EPIPE') process.exit(0); process.stderr.write(`tracery: ${error.message}\n`); process.exit(1); });
void main().catch(error => { process.stderr.write(`tracery: ${(error as Error).message}\n`); process.exitCode = 1; });

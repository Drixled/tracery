#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { deflateSync } from 'node:zlib';
import {
  PALETTES,
  buildExport,
  encodePng,
  graphicsSequence,
  gfxColumns,
  rasterizeCells,
  maskFromAscii,
  parseProject,
  validateSettings,
  render,
  type BlockMode,
  type ColorDepth,
  type Settings,
} from '../src/engine';

const HELP = `tracery: render ASCII art into a colored terminal block banner

Usage
  tracery [settings.json] [options]

Options
  -a, --art <file>       ASCII art to render ("-" reads stdin). Overrides the art in settings.
  -p, --palette <name>   Palette preset, e.g. "Kiln Ramp" (see --list-palettes)
  -m, --mode <mode>      half | quad | full
  -c, --color <depth>    true | 256 | 16
  -n, --name <name>      Banner name used in install paths (default: from settings)
  -o, --out <file>       Write the result to a file instead of stdout
      --install          Print a shell install script for update-motd instead of the banner
      --agent            Print an agent prompt instead of the banner
      --png <file>       Also write a PNG of the banner
      --cell <px>        PNG cell width in pixels (default: settings pngCell, 8)
      --kitty            Print a Kitty graphics escape sequence (Kitty, Ghostty) instead of blocks
      --iterm            Print an iTerm2 inline-image sequence instead of blocks
      --cols <n>         Display width in columns for --kitty / --iterm (default: banner width)
      --install-graphics Print an install script that shows the image on capable terminals
      --info             Print size information to stderr
      --list-palettes    List palette names and exit
  -h, --help             Show this help

Project files come from the Project tab in the web app. Text and image
sources need a browser, so the CLI renders the "ascii" field only.

Examples
  tracery oneir.tracery.json > /etc/motd
  tracery --art logo.txt --palette "Hot Magenta" --mode half
  tracery oneir.tracery.json --png oneir.png --cell 12
  tracery oneir.tracery.json --kitty > oneir.kitty && cat oneir.kitty
  figlet -f slant hello | tracery --art - --color 256`;

function fail(msg: string): never {
  process.stderr.write(`tracery: ${msg}\n`);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    art: { type: 'string', short: 'a' },
    palette: { type: 'string', short: 'p' },
    mode: { type: 'string', short: 'm' },
    color: { type: 'string', short: 'c' },
    name: { type: 'string', short: 'n' },
    out: { type: 'string', short: 'o' },
    install: { type: 'boolean' },
    agent: { type: 'boolean' },
    png: { type: 'string' },
    cell: { type: 'string' },
    kitty: { type: 'boolean' },
    iterm: { type: 'boolean' },
    cols: { type: 'string' },
    'install-graphics': { type: 'boolean' },
    info: { type: 'boolean' },
    'list-palettes': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  process.stdout.write(HELP + '\n');
  process.exit(0);
}
if (values['list-palettes']) {
  process.stdout.write(PALETTES.map((p) => p.name).join('\n') + '\n');
  process.exit(0);
}

let raw: unknown = {};
if (positionals[0]) {
  try {
    raw = JSON.parse(readFileSync(positionals[0], 'utf8'));
  } catch (e) {
    fail(`couldn't read settings from ${positionals[0]}: ${(e as Error).message}`);
  }
}
let S: Settings;
try { S = parseProject(raw).settings; } catch (e) { fail((e as Error).message); }

if (values.art) {
  S.ascii = readFileSync(values.art === '-' ? 0 : values.art, 'utf8');
  S.src = 'ascii';
}
if (S.src !== 'ascii') fail(`settings use the "${S.src}" source, which needs the web app. Switch to ASCII art or pass --art.`);

if (values.palette) {
  const p = PALETTES.find((x) => x.name.toLowerCase() === values.palette!.toLowerCase());
  if (!p) fail(`unknown palette "${values.palette}". Run --list-palettes to see the names.`);
  Object.assign(S, { palette: p.name, stops: p.stops.slice(), outlineColor: p.outlineColor, lipColor: p.lipColor, shineColor: p.shineColor, shadowColor: p.shadowColor });
  if (p.dither) S.dither = p.dither;
}
if (values.mode) {
  if (!['half', 'quad', 'full'].includes(values.mode)) fail('--mode must be half, quad or full');
  S.mode = values.mode as BlockMode;
}
if (values.color) {
  if (!['true', '256', '16'].includes(values.color)) fail('--color must be true, 256 or 16');
  S.color = values.color as ColorDepth;
}
if (values.name) S.name = values.name;

if (values.cell) S.pngCell = Math.max(1, Number(values.cell) || S.pngCell);
if (values.cols) S.gfxCols = Math.max(1, Number(values.cols) || 0);
if (values.iterm) S.gfxProto = 'iterm';
if (values.kitty) S.gfxProto = 'kitty';

try { validateSettings(S); } catch (e) { fail((e as Error).message); }
let result;
try { result = render(maskFromAscii(S.ascii, S), S); } catch (e) { fail((e as Error).message); }
if (!result.lines) fail('nothing to draw. The art is empty.');

const wantsPng = !!(values.png || values.kitty || values.iterm || values['install-graphics']);
let png: Uint8Array | undefined;
try {
  if (wantsPng) png = await encodePng(rasterizeCells(result.rows, result.cols, S.pngCell, S.ratio, S.pngTransparent ? null : S.termBg), (d) => new Uint8Array(deflateSync(d, { level: 9 })));
} catch (e) { fail((e as Error).message); }
if (values.png && png) writeFileSync(values.png, png);

const output = values['install-graphics']
  ? buildExport('graphics', S, result, { png }).text + '\n'
  : values.kitty || values.iterm
    ? graphicsSequence(S.gfxProto, png!, gfxColumns(S, result))
    : values.install
      ? buildExport('install', S, result).text + '\n'
      : values.agent
        ? buildExport('agent', S, result).text + '\n'
        : result.ansi;

if (values.out) writeFileSync(values.out, output);
else {
  // `--png file` on its own just writes the image; any other mode prints its output.
  const pngOnly = values.png && !values.kitty && !values.iterm && !values.install && !values.agent && !values['install-graphics'];
  if (!pngOnly) process.stdout.write(output);
}

if (values.info) process.stderr.write(`${result.cols}×${result.lines} cells, ${result.bytes} bytes, ${S.mode} blocks, ${S.color} color${png ? `, PNG ${png.length} bytes` : ''}\n`);

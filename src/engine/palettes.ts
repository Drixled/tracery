import { mix, rgb2hex } from './color';
import type { Dither, Palette } from './types';

export const PALETTE_CATEGORIES = [
  'Classic',
  'Fire & Metal',
  'Neon & Synth',
  'Nature',
  'Ocean & Ice',
  'Candy & Pastel',
  'Retro Hardware',
  'Mono & Ink',
  'Cosmic',
  'Earth & Clay',
] as const;
export type PaletteCategory = (typeof PALETTE_CATEGORIES)[number];

export interface CatalogPalette extends Palette {
  category: PaletteCategory;
}

type Row = [name: string, stops: string[], outline: string, lip: string, opts?: { shine?: string; dither?: Dither; shadow?: string }];

function group(category: PaletteCategory, rows: Row[]): CatalogPalette[] {
  return rows.map(([name, stops, outlineColor, lipColor, o = {}]) => ({
    name,
    category,
    stops,
    outlineColor,
    lipColor,
    shineColor: o.shine ?? '#ffffff',
    shadowColor: o.shadow ?? mix(lipColor, '#000000', 0.55),
    ...(o.dither ? { dither: o.dither } : {}),
  }));
}

export const PALETTES: CatalogPalette[] = [
  ...group('Classic', [
    ['Kiln Ramp', ['#ffff55', '#ffaa00', '#aa0000'], '#aa5500', '#550000', { shadow: '#2a0800' }],
    ['Hot Magenta', ['#ff55ff', '#aa00aa'], '#aa0000', '#550000'],
    ['Critical Teal', ['#55ffff', '#00aaaa'], '#0000aa', '#000055'],
    ['Phosphor', ['#ccffaa', '#55ff55', '#00aa00'], '#005500', '#002200'],
    ['Vapor', ['#ff77ff', '#aa88ff', '#55ffff'], '#5555ff', '#220066'],
    ['Ice', ['#ffffff', '#55ffff', '#0055aa'], '#0000aa', '#000044'],
    ['Toxic', ['#ffff55', '#55ff55', '#00aa00'], '#555500', '#222200'],
    ['Blood Orange', ['#ffaa55', '#ff5555', '#aa0000'], '#550000', '#220000', { shine: '#ffffaa' }],
    ['Gold Leaf', ['#ffffaa', '#ffaa00', '#aa5500'], '#553300', '#221100'],
    ['Royal', ['#aaaaff', '#5555ff', '#0000aa'], '#000055', '#000022'],
    ['Bone', ['#ffffff', '#aaaaaa', '#555555'], '#333333', '#111111'],
    ['Grape Soda', ['#ff55ff', '#aa00aa', '#5500aa'], '#220055', '#110022'],
    ['Dreamsicle', ['#ffffff', '#ffcc88', '#ff8833'], '#aa4400', '#552200'],
    ['Infrared', ['#ff5555', '#aa0000', '#550000'], '#ffaa00', '#aa5500', { shine: '#ffff55' }],
    ['Mint', ['#ddffee', '#55ffaa', '#00aa88'], '#005544', '#002a22'],
    ['Sunset Bands', ['#ffff55', '#ffaa00', '#ff5555', '#aa00aa'], '#330044', '#110018', { dither: 'none' }],
    ['BBS Cyan Bar', ['#ffffff', '#55ffff', '#00aaaa', '#0000aa'], '#000055', '#000022'],
    ['Sysop Red', ['#ffffff', '#ff5555', '#aa0000'], '#555555', '#222222'],
    ['Warez Purple', ['#ffffff', '#ff55ff', '#5555ff', '#0000aa'], '#000055', '#000022'],
    ['ACiD Brown', ['#ffff55', '#aa5500', '#552200'], '#aa0000', '#550000'],
  ]),
  ...group('Fire & Metal', [
    ['Forge', ['#fff6c8', '#ffb000', '#ff4a00', '#7a0b00'], '#2a0500', '#120200'],
    ['Ember', ['#ff9a3c', '#d43b00', '#6b0f00'], '#2b0700', '#140300', { shine: '#ffd38a' }],
    ['Blue Flame', ['#ffffff', '#8ad4ff', '#2f6bff', '#1a1aa6'], '#0b0b4a', '#050522'],
    ['Lava Lamp', ['#ffd23f', '#ff6b35', '#c81d25', '#5c0a3d'], '#2a0420', '#130210'],
    ['Copper Bars', ['#ffd9b0', '#e08a4a', '#9c4a1a', '#5a2408'], '#2c1204', '#140802', { dither: 'lines' }],
    ['Brass', ['#fff2b0', '#d6b04a', '#8a6a1a'], '#463408', '#201804'],
    ['Chrome', ['#ffffff', '#c8d0d8', '#5a6470', '#d8e0e8', '#3a4048'], '#1a1e22', '#0a0c0e'],
    ['Gunmetal', ['#c4ccd4', '#7a8490', '#3a424c'], '#1c2026', '#0c0e12'],
    ['Rose Gold', ['#fff0ea', '#f2b8a2', '#c97b63'], '#6e3a2c', '#361c14'],
    ['Silver Screen', ['#ffffff', '#d0d0d0', '#8a8a8a', '#e8e8e8'], '#3a3a3a', '#181818'],
    ['Molten Gold', ['#fffbe0', '#ffd700', '#ff9f00', '#b35c00'], '#5a2a00', '#2a1400'],
    ['Rust', ['#e8a070', '#b5531f', '#6e2a0c'], '#361406', '#1a0a03'],
    ['Thermite', ['#ffffff', '#fff27a', '#ff8c1a', '#e02020'], '#3a0606', '#1a0303'],
    ['Oxidized', ['#a8e6cf', '#4fa38a', '#2c6e5c'], '#7a4a1e', '#3a220e'],
  ]),
  ...group('Neon & Synth', [
    ['Outrun', ['#ffe66d', '#ff6ec7', '#7b2ff7', '#2d00f7'], '#120046', '#08001f'],
    ['Miami Night', ['#ffffff', '#ff71ce', '#01cdfe'], '#05ffa1', '#008a56'],
    ['Cyberpunk', ['#fcee0a', '#ff003c', '#2b0f54'], '#00f0ff', '#007a85', { shine: '#ffffff' }],
    ['Laser Grid', ['#ff00ff', '#8000ff', '#0040ff'], '#00ffff', '#006a6a'],
    ['Arcade Marquee', ['#ffff00', '#ff8000', '#ff0080'], '#00c0ff', '#004a80'],
    ['Acid Wash', ['#e4ff1a', '#7dff2b', '#00c2a8'], '#ff2bd6', '#7a0a66'],
    ['Hologram', ['#e0fffd', '#9ef7ff', '#c69cff', '#ff9ef5'], '#5b3ea6', '#2c1e52', { dither: 'bayer8' }],
    ['Night Drive', ['#fef9a7', '#fac213', '#f77e21', '#d61c4e'], '#2a0f3a', '#14061c'],
    ['Plasma', ['#ffffff', '#ff5ef0', '#9d4edd', '#3c096c'], '#10002b', '#06000f'],
    ['Electric Lime', ['#f7ff00', '#a8ff00', '#3cff00'], '#1a0066', '#0a0033'],
    ['Pink Static', ['#ffe3f5', '#ff4fb8', '#a6005f'], '#2e0020', '#140010', { dither: 'noise' }],
    ['Tokyo Rain', ['#c0f0ff', '#5ac8fa', '#bf5af2', '#5e2a84'], '#1a0b2e', '#0c0516'],
    ['Glitch', ['#00ffea', '#ff00aa', '#fff200'], '#1b1b1b', '#000000', { dither: 'checker' }],
    ['Blacklight', ['#f0d0ff', '#b44dff', '#5a00b4'], '#d4ff00', '#6a8000'],
  ]),
  ...group('Nature', [
    ['Moss', ['#d7f5a8', '#7fb53a', '#3c6e1a'], '#1e380c', '#0e1c06'],
    ['Autumn', ['#ffd56b', '#f28c28', '#c0392b', '#6e1f12'], '#3a1008', '#1c0804'],
    ['Cherry Blossom', ['#ffffff', '#ffd1e3', '#ff8fb8'], '#7a2a4a', '#3c1424'],
    ['Pine', ['#b8e0c0', '#3d8a5a', '#1c4a2e'], '#4a2e1a', '#24160c'],
    ['Wildflower', ['#fff3b0', '#ffb3c6', '#cdb4db', '#a2d2ff'], '#3a3a6a', '#1c1c34'],
    ['Desert Bloom', ['#ffe0a3', '#ff9e6b', '#e0567a'], '#6b2e4a', '#341624'],
    ['Lichen', ['#e8f0c8', '#b4c87a', '#6e8a3a'], '#38461c', '#1c230e'],
    ['Sunflower', ['#fff6a0', '#ffd000', '#d08a00'], '#5a3a00', '#2a1c00', { shine: '#ffffe0' }],
    ['Jungle', ['#c8ff7a', '#38b000', '#007200', '#004b23'], '#002611', '#001208'],
    ['Lavender Field', ['#f3e8ff', '#c8a2ff', '#8a5cd6'], '#3e7a3a', '#1e3c1c'],
    ['Peach', ['#fff1e0', '#ffc8a2', '#ff9a76'], '#a6493a', '#52241c'],
    ['Firefly', ['#fbffb0', '#d4ff38', '#7ab800'], '#0a1a2a', '#050d15'],
  ]),
  ...group('Ocean & Ice', [
    ['Deep Sea', ['#90e0ef', '#0077b6', '#03045e'], '#020230', '#010118'],
    ['Lagoon', ['#d0fff4', '#4ee6c8', '#00a3a3'], '#005a6a', '#002c34'],
    ['Glacier', ['#ffffff', '#d6f4ff', '#8ecae6', '#3a86c8'], '#1a3a5c', '#0c1c2e'],
    ['Bioluminescent', ['#c8fff0', '#00ffcc', '#0077ff'], '#00134a', '#000822', { dither: 'bayer8' }],
    ['Frostbite', ['#ffffff', '#bde0fe', '#a2d2ff', '#cdb4db'], '#4a4e8a', '#242644'],
    ['Riptide', ['#e0fbfc', '#98c1d9', '#3d5a80'], '#293241', '#14192a'],
    ['Coral Reef', ['#ffd6a5', '#ff8c69', '#ff4d6d'], '#0081a7', '#00405a'],
    ['Abyss', ['#4cc9f0', '#4361ee', '#3a0ca3', '#240046'], '#10002b', '#06000f'],
    ['Seafoam', ['#f1fffa', '#b2f7ef', '#7bdff2'], '#3a7ca5', '#1c3e52'],
    ['Polar Night', ['#e5f6ff', '#88c0d0', '#5e81ac', '#3b4252'], '#2e3440', '#171a20'],
  ]),
  ...group('Candy & Pastel', [
    ['Bubblegum', ['#ffe5f1', '#ff9ccf', '#ff4fa3'], '#8a1a5a', '#450d2d'],
    ['Cotton Candy', ['#ffd6f6', '#c8b6ff', '#a0e7ff'], '#6a5acd', '#352d66'],
    ['Sherbet', ['#fff3a3', '#ffb37a', '#ff7aa2'], '#9a3a5a', '#4d1d2d'],
    ['Taffy', ['#ffffff', '#ffc6ff', '#bdb2ff', '#a0c4ff'], '#5a4a9a', '#2d254d'],
    ['Mint Chip', ['#f0fff4', '#b8f2d0', '#6fd6a0'], '#4a2c1a', '#24160c'],
    ['Lemonade', ['#fffde0', '#fff176', '#ffd54f'], '#ff7aa2', '#a63a5a'],
    ['Macaron', ['#ffd1dc', '#fdfd96', '#b0e0a8', '#aec6cf'], '#6a5a7a', '#352d3d', { dither: 'none' }],
    ['Gummy Bear', ['#ffdd00', '#ff7b00', '#ff2a68', '#8c2cff'], '#2a0a4a', '#150525'],
    ['Strawberry Milk', ['#fff5f8', '#ffc9d9', '#ff8fab'], '#b84a6a', '#5c2535'],
    ['Sorbet', ['#c1fba4', '#7bf1a8', '#90f1ef'], '#ff70a6', '#9a2a5a'],
    ['Unicorn', ['#ffffff', '#ffb3de', '#c3a6ff', '#8ee3ff', '#b9fbc0'], '#5a4a8a', '#2d2545'],
    ['Pastel Goth', ['#f6dfff', '#d6b3ff', '#9a7ad6'], '#1a1a1a', '#000000'],
  ]),
  ...group('Retro Hardware', [
    ['DMG Green', ['#9bbc0f', '#8bac0f', '#306230'], '#0f380f', '#071c07', { shine: '#c4de5a', dither: 'bayer2' }],
    ['Pocket Grey', ['#e0e0d0', '#a8a898', '#585848'], '#202018', '#10100c', { dither: 'bayer2' }],
    ['CGA Magenta', ['#ffffff', '#ff55ff', '#55ffff'], '#000000', '#000000', { dither: 'checker' }],
    ['CGA Red', ['#ffff55', '#ff5555', '#55ff55'], '#000000', '#000000', { dither: 'checker' }],
    ['C64 Sky', ['#a0a0ff', '#6c5eb5', '#352879'], '#000000', '#000000', { shine: '#ffffff' }],
    ['Spectrum', ['#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000'], '#000000', '#000000', { dither: 'none' }],
    ['Amber Monitor', ['#ffe0a0', '#ffb000', '#a06800'], '#4a3000', '#201400', { shine: '#fff2d0', dither: 'lines' }],
    ['Green Monitor', ['#c8ffc8', '#33ff33', '#00a000'], '#004a00', '#002000', { shine: '#e8ffe8', dither: 'lines' }],
    ['Teletext', ['#ffff00', '#00ffff', '#ff00ff'], '#0000ff', '#000080', { dither: 'none' }],
    ['NES Mario', ['#fcbcb0', '#f83800', '#a81000'], '#503000', '#281800'],
    ['Win95 Teal', ['#ffffff', '#c0c0c0', '#008080'], '#000080', '#000040'],
    ['Apple II', ['#ffffff', '#14f53c', '#ff44fd', '#14cffd'], '#000000', '#000000', { dither: 'none' }],
    ['Virtual Red', ['#ff6060', '#e00000', '#700000'], '#300000', '#000000', { dither: 'lines' }],
    ['Sepia Print', ['#f4e8d0', '#c8a878', '#7a5a38'], '#3a2a1a', '#1c140c', { dither: 'noise' }],
  ]),
  ...group('Mono & Ink', [
    ['Newsprint', ['#ffffff', '#1a1a1a'], '#000000', '#000000', { dither: 'bayer8' }],
    ['Graphite', ['#e6e6e6', '#9a9a9a', '#4a4a4a'], '#1a1a1a', '#0a0a0a'],
    ['Ink Wash', ['#f0f0f0', '#5a5a6a', '#1a1a2a'], '#0a0a14', '#000000', { dither: 'noise' }],
    ['Blueprint', ['#ffffff', '#c8dcff'], '#1e4a9a', '#0f254d'],
    ['Risograph Pink', ['#ffffff', '#ff48b0'], '#0078bf', '#003c60', { dither: 'bayer4' }],
    ['Risograph Teal', ['#ffffff', '#00838a'], '#ff6c2f', '#803618', { dither: 'bayer4' }],
    ['Paper Cut', ['#ffffff', '#f4f1ea'], '#222222', '#000000'],
    ['Stamp Red', ['#ffcccc', '#d10000'], '#5a0000', '#2a0000', { dither: 'noise' }],
    ['Cobalt Ink', ['#d8e4ff', '#2a4dff', '#0a1a8a'], '#05104a', '#020822'],
    ['Charcoal', ['#c8c8c8', '#5a5a5a', '#2a2a2a'], '#ffffff', '#8a8a8a', { shine: '#ffffff' }],
  ]),
  ...group('Cosmic', [
    ['Nebula', ['#ffd6ff', '#e7c6ff', '#9b5de5', '#3a0ca3'], '#14004a', '#080022'],
    ['Supernova', ['#ffffff', '#fff3b0', '#ff9e00', '#ff006e', '#3a0ca3'], '#14004a', '#080022'],
    ['Aurora', ['#c8ffe0', '#3bffa0', '#00c8ff', '#9a4dff'], '#0a0a3a', '#05051c'],
    ['Event Horizon', ['#ffb000', '#ff4000', '#400000', '#000000'], '#ff8000', '#802000', { dither: 'bayer8' }],
    ['Stardust', ['#ffffff', '#c0c8ff', '#6a70d0'], '#1a1a4a', '#0c0c24', { dither: 'noise' }],
    ['Mars', ['#ffd0a0', '#e2725b', '#9a3a20'], '#4a1a0c', '#240c06'],
    ['Pulsar', ['#ffffff', '#7af0ff', '#2a7aff'], '#ff2a8a', '#8a1048'],
    ['Eclipse', ['#fff8d0', '#ffcf3a', '#2a2a2a'], '#ff6a00', '#803400'],
    ['Cosmic Latte', ['#fff8e7', '#f5e6c8', '#d8c3a5'], '#5a4a6a', '#2d2535'],
    ['Quasar', ['#e0ffff', '#00e5ff', '#d500f9', '#311b92'], '#12052e', '#080216'],
  ]),
  ...group('Earth & Clay', [
    ['Terracotta', ['#f4c9a8', '#d9734e', '#9a3e24'], '#4a1c10', '#240e08'],
    ['Adobe', ['#f2d8b8', '#c99568', '#8a5a34'], '#45281a', '#22140d'],
    ['Sandstone', ['#fbe7c6', '#e2b97a', '#b07a3a'], '#583c1c', '#2c1e0e'],
    ['Olive Grove', ['#e2e6b4', '#9aa35a', '#5a632a'], '#2d3215', '#16190a'],
    ['Clay Pot', ['#e8b49a', '#b86a4a', '#7a3a22'], '#3c1c10', '#1e0e08', { dither: 'noise' }],
    ['Saffron', ['#ffe39a', '#f4a300', '#c06000'], '#601e00', '#300f00'],
    ['Coffee', ['#f0dcc0', '#a8774e', '#5a3a22'], '#2a1a0e', '#140c06'],
    ['Slate', ['#c8d0d8', '#6a7a8a', '#3a4654'], '#1c232a', '#0e1115'],
    ['Paprika', ['#ffb38a', '#e8452c', '#8a1a0c'], '#3a2a1a', '#1c140c'],
    ['Basalt', ['#9aa0a6', '#4a5058', '#22262c'], '#e2482c', '#7a2010', { shine: '#ffd0a0' }],
  ]),
];

/** A fresh palette from a seed: hue harmony + lightness ramp, optionally snapped later by the quantizer. */
export function generatePalette(seed = Math.random()): Palette {
  let s = Math.floor(seed * 2 ** 31) || 1;
  const rnd = () => ((s = (Math.imul(s, 48271) % 2147483647 + 2147483647) % 2147483647) / 2147483647);
  const hsl = (h: number, sat: number, l: number) => {
    h = ((h % 360) + 360) % 360;
    const c = (1 - Math.abs(2 * l - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  };
  const base = rnd() * 360;
  const schemes = [
    { name: 'Analogous', step: 25 },
    { name: 'Warm shift', step: -35 },
    { name: 'Split', step: 150 },
    { name: 'Triad', step: 120 },
    { name: 'Mono', step: 0 },
  ];
  const sc = schemes[Math.floor(rnd() * schemes.length)];
  const n = 2 + Math.floor(rnd() * 3);
  const sat = 0.65 + rnd() * 0.35;
  const stops: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    stops.push(hsl(base + sc.step * t, sat, 0.82 - t * 0.5));
  }
  const ringHue = rnd() < 0.5 ? base + 180 : base + sc.step;
  const outlineColor = hsl(ringHue, sat * 0.8, 0.28);
  return {
    name: `Generated · ${sc.name} ${Math.round(base)}°`,
    stops,
    outlineColor,
    lipColor: mix(outlineColor, '#000000', 0.5),
    shineColor: '#ffffff',
    shadowColor: mix(outlineColor, '#000000', 0.75),
  };
}

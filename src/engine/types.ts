export type Source = 'ascii' | 'text' | 'image';
export type Dither = 'bayer4' | 'bayer2' | 'bayer8' | 'checker' | 'lines' | 'noise' | 'none';
export type Direction = 'v' | 'h' | 'd' | 'r';
export type BlockMode = 'half' | 'quad' | 'full';
export type ColorDepth = 'true' | '256' | '16';
export type ImageKeep = 'alpha' | 'dark' | 'light';
export type GraphicsProtocol = 'kitty' | 'iterm';

/** Every knob Tracery exposes. Serializable to JSON and shared by the web app and the CLI. */
export interface Settings {
  src: Source;
  // ASCII source
  ascii: string;
  cw: number;
  ch: number;
  glyph: boolean;
  // Text source (browser only)
  text: string;
  font: string;
  size: number;
  tracking: number;
  leading: number;
  // Image source (browser only)
  imgW: number;
  thresh: number;
  imgUse: ImageKeep;
  imgColors: boolean;
  // Palette
  palette: string;
  stops: string[];
  dither: Dither;
  dir: Direction;
  reverse: boolean;
  spread: number;
  // Shape
  gap: number;
  gapFillOn: boolean;
  gapFill: string;
  outline: number;
  outlineColor: string;
  lipOn: boolean;
  lipColor: string;
  shineOn: boolean;
  shineColor: string;
  bevel: boolean;
  shadowOn: boolean;
  shadowColor: string;
  sdx: number;
  sdy: number;
  // Output
  mode: BlockMode;
  color: ColorDepth;
  name: string;
  // Image output (PNG, Kitty / iTerm2 inline graphics)
  /** Width of one terminal cell in PNG pixels. */
  pngCell: number;
  pngTransparent: boolean;
  gfxProto: GraphicsProtocol;
  /** Display width in terminal columns; 0 means match the block banner. */
  gfxCols: number;
  // Preview only
  fit: boolean;
  zoom: number;
  ratio: number;
  termBg: string;
}

/** A boolean silhouette, optionally with per-pixel source colors (image source). */
export interface Mask {
  W: number;
  H: number;
  F: Uint8Array;
  C?: string[];
}

/** Colored logical pixels. `null` means transparent. */
export interface Pixels {
  W: number;
  H: number;
  px: (string | null)[];
}

/**
 * One terminal cell. `m` is a 4-bit quadrant mask (bit 0 top-left, 1 top-right,
 * 2 bottom-left, 3 bottom-right) painted in `fg`; the rest is `bg` or transparent.
 */
export interface Cell {
  m: number;
  fg?: string;
  bg?: string | null;
}

export interface Palette {
  name: string;
  stops: string[];
  outlineColor: string;
  lipColor: string;
  shineColor: string;
  shadowColor: string;
  dither?: Dither;
}

export interface Look {
  name: string;
  v: Partial<Settings>;
}

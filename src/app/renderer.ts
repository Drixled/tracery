import { DEFAULTS, artFromAscii, drawsChars, loadedFace, maskFromAscii, maskFromRgba, render, renderArt, setText, type Art, type Mask, type Raster, type RenderResult, type Settings } from '../engine';
import { maskFromText } from './canvas-masks';
import { browserFace } from './fonts';

const STYLE_KEYS: (keyof Settings)[] = ['src', 'stops', 'dither', 'dir', 'reverse', 'spread', 'gap', 'gapFillOn', 'gapFill', 'outline', 'outlineColor', 'lipOn', 'lipColor', 'shineOn', 'shineColor', 'bevel', 'shadowOn', 'shadowColor', 'sdx', 'sdy', 'mode', 'color', 'imgColors', 'targetCols', 'draw', 'tint'];
export class Renderer {
  private maskKey = '';
  private styleKey = '';
  private mask: Mask | null = null;
  private image: Raster | null = null;
  private result: RenderResult = render(null, DEFAULTS);
  private fontVersion = 0;
  // shortcut: a font that failed to load stays failed until the page reloads; retry on demand if fonts move to a flaky CDN.
  private fontErrors = new Map<string, string>();
  /** The font art behind the last render, for the Write step's width and missing-letter notes. */
  art: Art | null = null;
  /** Called when a font finishes loading, so the app can draw again. */
  constructor(private fontLoaded: () => void = () => {}) {}
  invalidateFonts() { this.fontVersion++; }
  render(S: Settings, image: Raster | null): RenderResult {
    const source = S.src === 'ascii' ? [S.ascii, S.cw, S.ch, S.glyph]
      : S.src === 'text' ? [S.text, S.font, S.size, S.tracking, S.leading, S.mode, S.ratio, this.fontVersion]
      : S.src === 'font' ? [S.words, S.face, S.fLayout, S.fAlign, S.fWrap, S.cw, S.ch, S.glyph, this.fontVersion]
      : [S.imgW, S.thresh, S.imgUse, S.mode, S.ratio];
    const maskKey = JSON.stringify([S.src, ...source]);
    const styleKey = JSON.stringify(STYLE_KEYS.map(key => S[key]));
    const changed = maskKey !== this.maskKey || (S.src === 'image' && image !== this.image);
    if (changed) {
      this.art = S.src === 'font' ? this.fontArt(S) : S.src === 'ascii' ? artFromAscii(S.ascii) : null;
      const mask = S.src === 'ascii' ? maskFromAscii(S.ascii, S) : S.src === 'text' ? maskFromText(S) : S.src === 'image' && image ? maskFromRgba(image, S) : null;
      this.mask = mask; this.maskKey = maskKey; this.image = image;
    }
    if (changed || styleKey !== this.styleKey) {
      this.result = S.src === 'font' || drawsChars(S) ? renderArt(this.art, S) : render(this.mask, S); this.styleKey = styleKey;
    }
    return this.result;
  }
  private fontArt(S: Settings): Art | null {
    const error = this.fontErrors.get(S.face);
    if (error) throw new Error(error);
    const face = loadedFace(S.face);
    if (face) return setText(face, S);
    browserFace(S.face).then(
      () => this.fontLoaded(),
      e => { this.fontErrors.set(S.face, (e as Error).message); this.fontLoaded(); },
    );
    return null;
  }
}

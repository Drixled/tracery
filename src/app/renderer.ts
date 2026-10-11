import { DEFAULTS, maskFromAscii, maskFromRgba, render, type Mask, type Raster, type RenderResult, type Settings } from '../engine';
import { maskFromText } from './canvas-masks';

const STYLE_KEYS: (keyof Settings)[] = ['src', 'stops', 'dither', 'dir', 'reverse', 'spread', 'gap', 'gapFillOn', 'gapFill', 'outline', 'outlineColor', 'lipOn', 'lipColor', 'shineOn', 'shineColor', 'bevel', 'shadowOn', 'shadowColor', 'sdx', 'sdy', 'mode', 'color', 'imgColors', 'targetCols'];
export class Renderer {
  private maskKey = '';
  private styleKey = '';
  private mask: Mask | null = null;
  private image: Raster | null = null;
  private result: RenderResult = render(null, DEFAULTS);
  private fontVersion = 0;
  invalidateFonts() { this.fontVersion++; }
  render(S: Settings, image: Raster | null): RenderResult {
    const source = S.src === 'ascii' ? [S.ascii, S.cw, S.ch, S.glyph] : S.src === 'text' ? [S.text, S.font, S.size, S.tracking, S.leading, S.mode, S.ratio, this.fontVersion] : [S.imgW, S.thresh, S.imgUse, S.mode, S.ratio];
    const maskKey = JSON.stringify([S.src, ...source]);
    const styleKey = JSON.stringify(STYLE_KEYS.map(key => S[key]));
    const changed = maskKey !== this.maskKey || (S.src === 'image' && image !== this.image);
    if (changed) {
      const mask = S.src === 'ascii' ? maskFromAscii(S.ascii, S) : S.src === 'text' ? maskFromText(S) : image ? maskFromRgba(image, S) : null;
      this.mask = mask; this.maskKey = maskKey; this.image = image;
    }
    if (changed || styleKey !== this.styleKey) {
      this.result = render(this.mask, S); this.styleKey = styleKey;
    }
    return this.result;
  }
}

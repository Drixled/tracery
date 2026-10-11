import type { GraphicsProtocol } from './types';

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/**
 * Kitty graphics protocol: transmit-and-display a PNG (a=T, f=100), base64 split into
 * chunks of at most 4096 bytes with m=1 on all but the last. c= sets the display width in
 * terminal columns (height follows the aspect ratio). q=2 silences the terminal's replies,
 * which would otherwise land in the shell's input during login.
 * Kitty and Ghostty document support; other terminals vary.
 */
export function kittySequence(pngBase64: string, cols: number): string {
  const CHUNK = 4096;
  let out = '';
  for (let i = 0; i < pngBase64.length; i += CHUNK) {
    const part = pngBase64.slice(i, i + CHUNK);
    const more = i + CHUNK < pngBase64.length ? 1 : 0;
    const keys = i === 0 ? `a=T,f=100,q=2,c=${cols},m=${more}` : `q=2,m=${more}`;
    out += `\x1b_G${keys};${part}\x1b\\`;
  }
  return out + '\n';
}

/** iTerm2 inline image (OSC 1337). Also read by WezTerm and some others. */
export function itermSequence(pngBase64: string, byteLength: number, cols: number): string {
  return `\x1b]1337;File=inline=1;size=${byteLength};width=${cols};preserveAspectRatio=1:${pngBase64}\x07\n`;
}

export function graphicsSequence(proto: GraphicsProtocol, png: Uint8Array, cols: number): string {
  const b64 = bytesToBase64(png);
  return proto === 'iterm' ? itermSequence(b64, png.length, cols) : kittySequence(b64, cols);
}

/** Shell test that is true when the connecting terminal understands the chosen protocol. */
export function graphicsTermTest(proto: GraphicsProtocol): string {
  return proto === 'iterm'
    ? '[ "$LC_TERMINAL" = "iTerm2" ] || [ "$TERM_PROGRAM" = "WezTerm" ]'
    : 'case "$TERM" in xterm-kitty|xterm-ghostty|wezterm) true ;; *) false ;; esac';
}

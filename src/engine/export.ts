import { bytesToBase64, graphicsSequence, graphicsTermTest } from './graphics';
import type { RenderResult } from './render';
import { QUAD } from './encode';
import type { Settings } from './types';
import type { Project } from './project';

export type ExportKind = 'install' | 'agent' | 'printf' | 'raw' | 'text' | 'png' | 'graphics' | 'json';

export interface ExportExtras {
  /** Encoded PNG of the banner, needed for the png and graphics exports. */
  png?: Uint8Array;
  project?: Project;
}

export const gfxColumns = (S: Settings, r: RenderResult) => (S.gfxCols > 0 ? S.gfxCols : r.cols);

export interface ExportText {
  note: string;
  text: string;
}

export const toBase64 = (s: string) => bytesToBase64(new TextEncoder().encode(s));

export const slug = (name: string) => (name || 'banner').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'banner';

export function buildExport(kind: ExportKind, S: Settings, r: RenderResult, extras: ExportExtras = {}): ExportText {
  if (kind === 'json') return { note: 'Your complete project, including the source image. Import it here to continue. ASCII and image projects also work with the CLI.', text: JSON.stringify(extras.project, null, 2) };
  const n = slug(S.name);
  // Files live in a folder Tracery owns, so the undo line never removes a system folder such as /etc/ssh.
  const dir = '/etc/tracery';
  const file = `${dir}/${n}.ansi`;
  const data = toBase64(r.ansi);
  const depth = S.color === 'true' ? '24-bit truecolor' : `${S.color}-color`;

  switch (kind) {
    case 'install':
      return {
        note: `Two commands for a Linux server. ${r.cols} columns wide, so the window needs at least that much room.`,
        text: [
          '# 1. Write the banner and preview it',
          `sudo mkdir -p ${dir} && printf '%s' '${data}' | base64 -d | sudo tee ${file} >/dev/null && cat ${file}`,
          '',
          '# 2. Show it at every SSH login (Ubuntu/Debian update-motd)',
          `printf '%s\\n' '#!/bin/sh' 'cat ${file}' | sudo tee /etc/update-motd.d/00-${n} >/dev/null && sudo chmod +x /etc/update-motd.d/00-${n}`,
          '',
          `# Undo: sudo rm ${file} /etc/update-motd.d/00-${n}`,
        ].join('\n'),
      };
    case 'agent':
      return {
        note: 'Paste this into your agent on the server. Everything it needs is inside.',
        text: `Install a custom ANSI login banner (MOTD) on this server.

1. Decode this base64 into ${file} (create ${dir} first). It is UTF-8 text with ${depth} ANSI escape codes, ${r.cols} columns by ${r.lines} rows:
${data}

2. Test it with: cat ${file}  (should print a colored block-art logo).
3. Show it at every login:
   - If /etc/update-motd.d exists (Ubuntu/Debian), create /etc/update-motd.d/00-${n} containing exactly:
       #!/bin/sh
       cat ${file}
     and chmod +x it.
   - Otherwise back up /etc/motd to /etc/motd.bak (only if no backup exists yet), then copy ${file} to /etc/motd.
4. Tell me what you changed and how to undo it.`,
      };
    case 'printf':
      return {
        note: 'Escaped for printf. Handy for a shell profile or a quick test in any terminal.',
        text: "printf '" + r.ansi.replace(/\\/g, '\\\\').replace(/%/g, '%%').replace(/'/g, "'\\''").replace(/\x1b/g, '\\033').replace(/\n/g, '\\n') + "'",
      };
    case 'text':
      return {
        note: 'Just the characters, no color codes. Paste it into a README, a code comment or a chat.',
        text: r.rows.map(row => row.map(c => c.ch ?? QUAD[c.m]).join('').trimEnd()).join('\n'),
      };
    case 'raw':
      return {
        note: 'The exact bytes, with the escape character included. Some apps strip it when you paste, so prefer Download or the install command.',
        text: r.ansi,
      };
    case 'png':
      return {
        note: extras.png
          ? `${extras.png.length.toLocaleString('en-US')} bytes. Pixel-exact copy of the preview, for slides, a README, or any terminal that shows images.`
          : 'Rendering the PNG…',
        text: '',
      };
    case 'graphics': {
      if (!extras.png) return { note: 'Rendering the PNG…', text: '' };
      const proto = S.gfxProto;
      const ext = proto === 'iterm' ? 'iterm' : 'kitty';
      const cols = gfxColumns(S, r);
      const seq = graphicsSequence(proto, extras.png, cols);
      const gfxFile = `${dir}/${n}.${ext}`;
      const label = proto === 'iterm' ? 'iTerm2 / WezTerm' : 'Kitty / Ghostty';
      return {
        note: `Shows the PNG on ${label} and falls back to the block banner everywhere else. Runs from /etc/profile.d at login, skipped inside tmux, which drops image escapes.`,
        text: [
          '# 1. Write both versions',
          `sudo mkdir -p ${dir}`,
          `printf '%s' '${data}' | base64 -d | sudo tee ${file} >/dev/null`,
          `printf '%s' '${toBase64(seq)}' | base64 -d | sudo tee ${gfxFile} >/dev/null`,
          '',
          `# 2. Pick one at login (image for ${label}, blocks otherwise)`,
          `sudo tee /etc/profile.d/00-${n}.sh >/dev/null <<'TRACERY'`,
          `if [ -t 1 ] && [ -z "$TMUX" ]; then`,
          `  if ${graphicsTermTest(proto)}; then cat ${gfxFile}; else cat ${file}; fi`,
          'fi',
          'TRACERY',
          '',
          `# Undo: sudo rm ${file} ${gfxFile} /etc/profile.d/00-${n}.sh`,
          `# If you also installed the block-only MOTD, remove /etc/update-motd.d/00-${n} so it doesn't print twice.`,
        ].join('\n'),
      };
    }
  }
}

export interface ExportDownload { filename: string; data: string | Uint8Array; mime: string }
/** Download the same export shown in the selected tab. PNG contains image bytes. */
export function buildDownload(kind: ExportKind, S: Settings, r: RenderResult, extras: ExportExtras = {}): ExportDownload {
  const n = slug(S.name);
  if (kind === 'png') {
    if (!extras.png) throw new Error('The PNG is not ready.');
    return { filename: `${n}.png`, data: extras.png, mime: 'image/png' };
  }
  if (kind === 'graphics' && !extras.png) throw new Error('The terminal image is not ready.');
  const suffix = kind === 'json' ? 'tracery.json' : kind === 'raw' ? 'ansi' : kind === 'text' ? 'txt' : kind === 'agent' ? 'agent.txt' : kind === 'graphics' ? 'graphics.sh' : kind === 'printf' ? 'printf.sh' : 'install.sh';
  return { filename: `${n}.${suffix}`, data: buildExport(kind, S, r, extras).text + (kind === 'raw' ? '' : '\n'), mime: kind === 'json' ? 'application/json' : 'text/plain;charset=utf-8' };
}

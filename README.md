# Tracery

Set a word in one of 1,300 FIGlet and TheDraw fonts, or start from ASCII art or a logo, color it, and install it as your server's login message (MOTD).

```
Font ──────────────── Characters ───────────────────┐
Font (Blocks) ─┐                                    ├─▶ ANSI ─▶ /etc/update-motd.d
ASCII art ─────┤                                    │
Text ──────────┼─▶ mask ─▶ stylize ─▶ encode ───────┘
Image ─────────┘
```

## Quick start

```sh
npm install
npm run dev        # web app at http://localhost:5173
npm test           # build the CLI and run its tests
npm run build      # type-check, then web app → dist/web, CLI → dist/cli/tracery.js
```

To open the dev server from another device on your tailnet, run `tailscale serve --bg <port>`; `vite.config.ts` already allows `*.ts.net` hosts.

## Web app

**Home** (`/`) lists every banner saved in this browser. **New banner** opens the **picker** (`/b/<id>/font`): type once and see your text in every FIGlet, TheDraw and web font, or start from pasted ASCII art or an image. Filter by Favorites or Colored, look (Solid or Lines) and size, search by name, and choose how many fonts sit in a row. Pick one to land in the editor; Done, Esc or the browser's back button also return there. `npm run font-meta` rebuilds the size and look data after the font set changes.

**The editor** (`/b/<id>`) is one screen:

- **Toolbar:** what's drawn. Its name opens the picker, and its tools follow the source: color variant, spacing, alignment and wrapping for FIGlet and TheDraw fonts; height, tracking and line gap for web fonts; character size for ASCII art; width, threshold and colors for images. Drop or paste an image anywhere to use it.
- **Text bar** under the preview: the words, or the pasted art.
- **Sidebar:** how it looks, in one column. **Render as** Characters (the font's glyphs or your ASCII art as typed) or Blocks (block pixels, so every effect works), **Colors** from the font, a palette gradient, or a shade map that keeps the font's texture, then Palette, Effects and Output. Fine-tuning folds under **More**.

Edits save automatically to IndexedDB, and Undo/Redo keeps the last 50 changes.

- **Source:** 332 FIGlet fonts and 3,339 TheDraw fonts (990 families), ASCII art, text in 9 Google Fonts, or an image (PNG, up to 2048 px per side)
- **Color:** 126 palette presets, generated harmonies, a gradient editor, 7 dither patterns
- **Shape:** gap ring, outline, lip, shine, bevel, drop shadow, saved looks
- **Output:** 80 / 103 / 120 columns; half `▀▄`, quadrant `▚` or full `██` blocks; truecolor, 256 or 16 colors
- **Export:** install command, agent prompt, `printf` one-liner, raw ANSI, plain text, PNG, Kitty / iTerm2 image, `.tracery.json` project file

Saved banners stay in this browser. To move one elsewhere, download its project file. If you host the built app, serve `index.html` for every path.

## CLI

The CLI uses the same engine as the web app. It renders ASCII, image and font projects and PNG files. Text projects need the browser to draw web fonts, and PNGs of Characters mode (fonts or ASCII art) need it to draw glyphs. It reads TheDraw fonts from `public/fonts/tdf`, so run it from a checkout of this repository.

```sh
node dist/cli/tracery.js logo.tracery.json --width 80 > banner.ansi
node dist/cli/tracery.js --art logo.txt --palette "Hot Magenta" --mode half
figlet -f slant hello | node dist/cli/tracery.js --art - --color 256
node dist/cli/tracery.js logo.tracery.json --install            # update-motd install script
node dist/cli/tracery.js logo.tracery.json --install-graphics   # terminal image install script
```

Run `--help` to see every flag. `npm link` adds `tracery` to your PATH.

## Installing on a server

The **Install command** export writes `/etc/tracery/<name>.ansi` and adds `/etc/update-motd.d/00-<name>`, so the banner appears at every SSH login. To remove it, run `sudo rm /etc/tracery/<name>.ansi /etc/update-motd.d/00-<name>`.

The **Terminal image** export also installs `/etc/profile.d/00-<name>.sh`. It shows a pixel-exact PNG in Kitty, Ghostty and iTerm2, falls back to block characters everywhere else, and stays quiet inside tmux.

## Terminal notes

- **Quadrant blocks** need a font that draws `▖▗▘▝▚▞`. Ghostty, Kitty, WezTerm and iTerm2 can; if you see gaps, use half blocks.
- **Width:** MOTD scripts run before the terminal reports its size, so pick a width that fits your usual window.
- **Color:** use 256 or 16 colors for `screen`, older macOS Terminal, or anything without truecolor.

## Layout

```
src/engine/            framework-free TypeScript shared by the app and the CLI
src/app/               Svelte 5 web app (Tailwind 4, shadcn-svelte, Heroicons via unplugin-icons)
src/lib/components/ui/ shadcn-svelte components, copied in; add more with `npx shadcn-svelte@latest add <name>`
public/fonts/tdf/      TheDraw fonts, one .tdf file per family (listed in src/engine/tdf-fonts.json)
cli/                   Node CLI, bundled by vite.cli.config.ts
test/                  CLI tests (node --test)
```

## Fonts

FIGlet fonts come from the [figlet](https://github.com/patorjk/figlet.js) package. TheDraw fonts are the BBS-era collection gathered by [tdfiglet](https://github.com/tat3r/tdfiglet), [tdfonts](https://github.com/cognitivegears/tdfonts) and [CODEF Ansi Logo Maker](https://github.com/N0NameN0/CODEF_Ansi_Logo_Maker), named and grouped the way [TAAG](https://patorjk.com/software/taag/) lists them. TAAG's 37 AOL Macro fonts, Technologizer, and 142 TheDraw variants are not in those collections and are missing here.

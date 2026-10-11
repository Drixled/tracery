# Tracery

Turn ASCII art, a word, or a logo into a colored block-character banner for your terminal, then install it as your server's login message (MOTD).

```
ASCII art ─┐
Text  ─────┼─▶ mask ─▶ stylize ─▶ encode ─▶ ANSI ─▶ /etc/update-motd.d
Image ─────┘
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

**Home** (`/`) lists every banner saved in this browser. **A banner** (`/b/<id>`) shows the preview beside the Source, Color, Shape and Output controls. Edits save automatically to IndexedDB, and Undo/Redo keeps the last 50 changes.

- **Source:** ASCII art, text in 9 Google Fonts, or an image (PNG, up to 2048 px per side)
- **Color:** 126 palette presets, generated harmonies, a gradient editor, 7 dither patterns
- **Shape:** gap ring, outline, lip, shine, bevel, drop shadow, saved looks
- **Output:** 80 / 103 / 120 columns; half `▀▄`, quadrant `▚` or full `██` blocks; truecolor, 256 or 16 colors
- **Export:** install command, agent prompt, `printf` one-liner, raw ANSI, PNG, Kitty / iTerm2 image, `.tracery.json` project file

Saved banners stay in this browser. To move one elsewhere, download its project file. If you host the built app, serve `index.html` for every path.

## CLI

The CLI uses the same engine as the web app. It renders ASCII projects, image projects and PNG files. Text projects need the browser to draw fonts.

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
cli/                   Node CLI, bundled by vite.cli.config.ts
test/                  CLI tests (node --test)
```

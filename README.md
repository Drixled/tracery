# Tracery

Turn ASCII art, a word, or a logo into a colored block-character banner for your terminal, then install it as your server's login message (MOTD).

It started as the "Oneir" banner and grew into a playground with presets for palettes, dithering, outlines and shadows.

```
ASCII art ─┐
Text  ─────┼─▶ mask ─▶ stylize ─▶ encode ─▶ ANSI ─▶ /etc/update-motd.d
Image ─────┘   (silhouette)  (fill, gap,   (half / quad /
                              outline,      full blocks)
                              lip, shine,
                              shadow)
```

## Quick start

```sh
npm install
npm run dev        # web app at http://localhost:5173
npm run build      # web app → dist/web, CLI → dist/cli/tracery.js
```

## Web app

The app works like a design tool's file browser:

- **Home** (`/`) shows every banner in this browser, newest edit first. Click a thumbnail to open it. The `⋯` menu on each card renames, duplicates or deletes it. **New banner** and **Import** create a banner and open it.
- **A banner** (`/b/<id>`) has its own address, so you can bookmark or reload it. The preview sits on the left and the Source, Color, Shape and Output controls on the right. The banner's name at the top opens a menu to rename, duplicate, download the project file or delete. **Export** opens the export formats in a dialog.

Banners save themselves about half a second after each edit; there is no Save button. Opening a banner starts a fresh undo history. When hosting the built app, serve `index.html` for every path; `npm run dev` and `npm run preview` already do.

| Area    | What you can change |
|---------|---------------------|
| Source  | Paste ASCII art, type text in 9 Google Fonts, or drop / paste an image (threshold, keep opaque, dark or light pixels, optional source colors) |
| Palette | 126 presets in 10 categories with search, a Generate button for new color harmonies, a 1 to 6 stop ramp editor, 7 dither patterns, vertical / horizontal / diagonal / radial direction, spread, reverse, Shuffle |
| Shape   | Gap ring, outline width and color, darker lower lip, shine dots, bevel, drop shadow with offset, plus one-click looks |
| Output  | Fit exported art to 80, 103, or 120 columns; half blocks `▀▄`, quadrant blocks `▚`, or full blocks `██`; truecolor, xterm-256 or 16-color VGA |
| Preview | Pin a reference beside the current design; fit to width or zoom, terminal cell ratio, background color, rulers at 80 / 103 / 120 columns |
| Image   | PNG at any cell size, transparent or on the terminal background; Kitty / Ghostty or iTerm2 inline-image output |
| Export  | Install command, agent prompt, `printf` one-liner, raw ANSI, PNG, terminal image, project JSON; copy or download each |

Banners, their thumbnails and custom looks are stored in IndexedDB. Source images are stored once and shared by duplicates. These saves belong to this browser and site address; download a project file to move a banner elsewhere.

Save a custom look to reuse its palette and shape settings with another source. Pin a reference to compare a design with later changes. The output width control changes the exported artwork; preview fit and zoom only change its display size.

Drafts from older versions, in IndexedDB or `localStorage`, become a normal banner the first time you open this version. Invalid old data is kept with a recovery copy instead of being replaced. The Project file export saves a versioned `.tracery.json` file with all settings and the source image. Import it to continue later. Existing flat `.kiln.json` settings files and saved ANSI Kiln settings remain readable.

Images are stored as PNGs, with a maximum of 2048 pixels on each side and 3 MB of encoded data. Larger images are resized when loaded. If browser storage is unavailable or full, the app asks you to download the project.

Use Undo and Redo in the top bar to restore settings, resets, and image replacements. A slider drag counts as one edit. The app keeps the latest 50 snapshots. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z work outside text fields; text fields keep their native undo.

Downloads match the selected export: install and terminal image scripts use `.sh`, agent prompts use `.txt`, raw banners use `.ansi`, and images use `.png`. The project download includes the source image. Imports reject unsupported modes, invalid colors, and values outside the control limits without creating a banner.

## CLI

The CLI shares the browser engine and renders ASCII projects, saved image projects, and direct PNG files. Text projects need the browser to load and draw fonts. Direct PNG files must be at most 2048 pixels on each side and 10 MB. Browser image imports are converted to PNG for portable projects.

```sh
npm run build
node dist/cli/tracery.js oneir.tracery.json > banner.ansi
node dist/cli/tracery.js --art logo.txt --palette "Hot Magenta" --mode half
figlet -f slant hello | node dist/cli/tracery.js --art - --color 256
node dist/cli/tracery.js oneir.tracery.json --install   # prints an update-motd install script
node dist/cli/tracery.js --image logo.png --image-colors --width 80 > logo.ansi
node dist/cli/tracery.js logo.tracery.json --png logo.png
node dist/cli/tracery.js --list-palettes
```

Run `node dist/cli/tracery.js --help` for every flag. `npm link` puts `tracery` on your PATH.

## Installing a banner on a server

The Install command tab produces two commands you paste into the server:

1. Decode the banner from base64 into `/etc/<name>/banner.ansi` and print it once.
2. Add `/etc/update-motd.d/00-<name>` so it shows at every SSH login.

Undo with `sudo rm -r /etc/<name> /etc/update-motd.d/00-<name>`.

## Image mode (Kitty / Ghostty / iTerm2)

Block characters depend on your font drawing `▀▄▚` edge to edge. Some fonts leave hairline gaps or stretch line height. Image mode sidesteps that: the banner is rasterized to a PNG and sent with the terminal's own image protocol, so it looks exactly like the preview.

- **Kitty graphics protocol** (Kitty, Ghostty): `ESC _G a=T,f=100,q=2,c=<cols>` with the base64 PNG split into 4096-byte chunks. `c` sets the width in columns, and `q=2` keeps error replies out of your login shell.
- **iTerm2 inline images** (OSC 1337) for iTerm2.

The Terminal image tab installs both files plus `/etc/profile.d/00-<name>.sh`, which shows the image when `$TERM` is `xterm-kitty` or `xterm-ghostty` (or `$LC_TERMINAL` is `iTerm2`), falls back to blocks otherwise, and stays quiet inside tmux, which drops image escapes. Ghostty only sends `xterm-ghostty` over SSH when its terminfo is on the server, which `shell-integration-features = ssh-terminfo` handles.

```sh
node dist/cli/tracery.js oneir.tracery.json --png oneir.png --cell 12
node dist/cli/tracery.js oneir.tracery.json --kitty > oneir.kitty && cat oneir.kitty
node dist/cli/tracery.js oneir.tracery.json --install-graphics
```

## Terminal notes

- **Quadrant blocks** give the finest dither but need a font or terminal that draws `▖▗▘▝▚▞▙▛▜▟`. Ghostty, Kitty, WezTerm and iTerm2 render them natively. Fall back to half blocks if you see gaps.
- **Width:** the update-motd script runs before your terminal reports its size, so pick a banner that fits your usual window. Use the output width control or CLI `--width 80`, `--width 103`, or `--width 120` to shrink the artwork. Smaller artwork is not enlarged. Full blocks use two columns per pixel, so their width can be one column below an odd limit.
- **Color:** use 256 or 16 colors for `screen`, older macOS Terminal, or anything without truecolor.

## Layout

```
src/engine/   shared settings schema, masks, image sampling, styling, fitting, exports
src/app/      editor/history, cached renderer, storage/library, controls, exports, previews
cli/          argument parsing, PNG decoder, Node CLI bundled with the engine
```


## Checks

```sh
npm run build                   # TypeScript check and both production builds
```

The editor commits asynchronous image loads and imports only if no newer edit has replaced them. Undo snapshots share immutable image assets. The renderer caches source masks and reuses finished artwork for preview-only changes. Controls and imported settings use the same schema for limits and choices.

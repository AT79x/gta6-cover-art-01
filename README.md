# Solmar Bay Cover Maker — GTA VI style cover art

[![make.fun](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/AT79x/gta6-cover-art-01/rank.svg)](https://make.fun/bounty/gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/AT79x/gta6-cover-art-01/reward.svg)](https://make.fun/bounty/gta6-cover-art-01)

An offline cover maker that turns your photos and a caption into a
multi-panel poster in the style of GTA VI's key art, built for make.fun's
**GTA 6 cover art** bounty (`gta6-cover-art-01`). Pick a layout, drop in
one photo or several, crop each panel by dragging, pick a Vice City grade,
write the caption — and export a real PNG to share.

## What it does

- **Any photo** — upload photos from your machine (several at once) or try
  the three included samples. Photos are read on your machine and never
  uploaded anywhere.
- **Multi-panel layouts** — Hero (one big photo), Split, Trio (hero over
  two small), Grid (four squares), and Strip (hero over a wide strip).
  Click a panel to select it, then click a photo to put it there, or
  double-click a photo to fill every panel with it.
- **Crop and position per panel** — drag the photo inside its panel to pan
  it, scroll or use the zoom slider to magnify it, switch between fill and
  fit, recenter with one click.
- **Caption** — a big bold title with a slanted poster lean and a colour
  drop shadow, plus a letterspaced subtitle; size slider, top or bottom.
- **Colour grades** — Sunset (warm Vice City dusk), Neon (magenta and
  cyan nights), Noir (high-contrast black and white). Each grade is a
  photo filter plus a wash, a vignette and deterministic film grain
  (seeded PRNG, so the same cover always exports the same PNG).
- **Fast export** — one click writes a real PNG in 1080 × 1080,
  1080 × 1350 or 1920 × 1080.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

Static files only — `app/index.html` and its ES modules, no build step,
no network requests at runtime. Deterministic screenshot views:
`?shot=cover|editor|cover-portrait` with `photo`, `photos`, `caption`,
`subtitle`, `layout`, `grade`, `size` parameters.

## How it is built

| File | Job |
| --- | --- |
| `app/index.html` | Page shell: header, control panel, live preview canvas |
| `app/style.css` | The editor's own dark-plum look with a sunset accent |
| `app/src/cover.js` | The renderer: layouts, grades, grain, lettering, export |
| `app/src/main.js` | The editor: photos, panel picking, drag-pan, zoom, export |
| `app/src/shots.js` | Fixed `?shot=` scenes for the screenshots |
| `app/samples/` | Three sample photos: `pier.jpg`, `boulevard.jpg` (made with an image model for make.fun, free to use) and `solmar.jpg` (a render from the author's own Solmar Bay game) |
| `main.ts` | Hands the entry in: copies `app/` + `screenshots/`, writes `dossier.json` |

## Screenshots

`shots.json` records the four views: the sunset trio cover (cover), the
editor with a photo loaded, a second cover in the grid layout, and the
neon portrait export.

## License

MIT. Unofficial fan tool — not affiliated with or endorsed by Rockstar
Games. No Rockstar logo, artwork, character or font is used; the lettering
is the browser's own heavy system font.

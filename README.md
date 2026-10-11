# Token Map

A keyboard-first design-token playground drawn as a 1970s transit map, in exactly three colors. Change a token and the map redraws immediately. Copy the result as CSS custom properties or DTCG JSON.

| Direction | Page | Live artifact |
|---|---|---|
| A: Schematic Paper | `schematic-paper.html` | [claude.ai/artifact/5hDS8bLPhwDg8eCPYbmapW](https://claude.ai/artifact/5hDS8bLPhwDg8eCPYbmapW) |
| B: Signal Room | `signal-room.html` | [claude.ai/artifact/U2NFaLGkGG53jq9yo92ayy](https://claude.ai/artifact/U2NFaLGkGG53jq9yo92ayy) |

The artifacts are private until shared from their Share menu.

## Run locally

```sh
npm install
npm run preview   # builds, wraps the pages, serves http://localhost:8765
```

`npm run watch` recompiles on save. `npm run typecheck` runs strict TypeScript only.

## What's inside

- **Map:** fits the screen, zooms and pans, and never shrinks labels below 10px. Tap or use the arrow keys to move between stations.
- **Tokens:** 16 tokens covering color, grid, stroke, route, station and label. Step a token with `[` `]`, or set one directly by pressing `/` and typing.
- **Color gates:** a color change that would make text unreadable is refused, with the nearest passing value offered instead.
- **Themes:** three named slots per direction, each with optional names for its colors.
- **Layout:** a side dock on desktop, both panels side by side on wide screens, and a bottom sheet on phones.
- **Help:** a how-to in the header, plus a help window you can drag (`?`).

See [`docs/decisions.md`](docs/decisions.md) for the reasoning behind each rule.

## Structure

```
schematic-paper.html, signal-room.html   direction styles and markup
src/                                     TypeScript Web Components and engine
scripts/preview.mjs                      local preview wrapper
docs/decisions.md                        design and architecture decisions
```

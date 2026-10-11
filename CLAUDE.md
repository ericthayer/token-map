# Token Map

Keyboard-first design-token playground drawn as a 1970s transit map, in exactly three colors. Two visual directions share one engine:

- `schematic-paper.html`: direction A, a printed pocket diagram. Light, ink and red.
- `signal-room.html`: direction B, a dispatcher's track board. Dark, grey lamps and amber.

Both are published as claude.ai Artifacts (URLs in `README.md`). Commands are in `package.json`.

Read `docs/decisions.md` before changing gates, layout modes, theme storage or the color model. It records why each rule exists.

## Locked design

The visual design of both directions is approved. Restyling, retheming or recomposing an established component needs an explicit request.

- Keep every change inside the requested feature. Leave the navigation, masthead and other components alone unless the request names them.
- Keep changes the user made by hand to styling (CSS, layout) or scripting (TS). Never revert them.
- New UI in a direction reuses that direction's existing vocabulary: rules and inverted rows in A; bezels, h2 chips and amber states in B.

## Invariants

- **Three colors.** Every surface reads `--c-ground`, `--c-ink` and `--c-signal`. Other colors appear only where a color is being previewed: picker slider tracks, the picker's candidate swatch, and saved-theme chips.
- **Gates.** Every color change goes through `TokenStore` (`src/tokens.ts`), which refuses any trio that fails a required rule in `src/gates.ts`. Required: ink on ground 4.5:1, signal on ground 4.5:1. Advisory: signal on ink 3:1, because active lines are also cased and listed in the readout.
- **Layout mode** is set by `<app-dock>` on `.app[data-layout]` as `sheet`, `tabs` or `split`, from the app's width. CSS and ARIA both key off it. Breakpoints live in `src/app-dock.ts`.
- **CSS cascade.** Shared sheets in `src/map-styles.ts` and `src/shell-styles.ts` sit in `@layer base, shell`. Direction styles in each page are unlayered, so they always win. A shared rule that must beat a direction rule (for example hiding something) needs `!important`.
- **Page skeleton.** Pages have no `<html>`, `<head>` or `<body>`: the Artifact host wraps them at publish time. `scripts/preview.mjs` adds the same wrapper for local preview.
- **Map scale.** The map fits its viewport but never zooms out past 10px labels; below that it pans.

## Code rules

- Vanilla Web Components, native ES modules, strict TypeScript: explicit return types, no `any`, discriminated unions for variants.
- Every module stays under 300 lines. Split by responsibility when one grows past that.
- Build DOM with `h()` and `s()` from `src/dom.ts`, and put text in through text nodes.
- Batch renders with `rafBatch`. Per-viewer state goes in `localStorage`, wrapped in try/catch, under keys prefixed `transit-`.
- WCAG 2.2 AA: native semantics first, visible focus, 24px minimum targets (44px on coarse pointers), and `aria-live` announcements for value changes.

## Publish

1. `npm run build`.
2. Check the rendered pages through `npm run preview` at 1440×900, 1920×1080, 1024×768 and 390×844. At every size the page itself must not scroll.
3. Publish each page with the Artifact tool. Pass its `file_path` and map every `js/*.js` into `files`. Use the artifact's existing URL so the link stays the same.
4. Commit `src/`, pages, docs and config. `js/` and `preview/` are build output and are ignored.

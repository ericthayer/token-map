# Decisions

Why the system is shaped the way it is. Newest at the bottom of each section.

## Product

- **Two directions, one engine.** Schematic Paper (A) and Signal Room (B) compare visual direction only. Both pages load the same modules, so behavior never diverges between them.
- **Three colors is the constraint.** Line identity comes from stroke pattern and weight, never a fourth hue. Interface states use inversion, outline or the signal color.
- **Fictional network.** Lowmoor has 4 lines and 21 stations (`src/network.ts`). It is invented so the map never imitates a real transit diagram.

## Accessibility gates

| Pair | Rule | Reason |
|---|---|---|
| ink on ground | 4.5:1, required | Carries every label and body text |
| signal on ground | 4.5:1, required | Both directions use signal as text and behind text: the changed output line, B's station readout |
| signal on ink | 3:1, advisory | Active lines also get a ground-colored casing and are listed in the readout, so color is not the only cue. Requiring it would push B's amber toward lemon yellow |

- The gate check lives in one place, `TokenStore`. The picker, command line, themes and stored values all go through it, so no path can bypass it.
- Refusals always offer the nearest passing color (lightness first, then saturation). A refusal with no way forward is a dead end. A refused `colors` command or theme offers it for the first failing role.
- `colors #g #i #s` sets all three colors at once. Without it, switching from dark to light one color at a time can get stuck on a failing in-between state.
- A's default red moved from `#D7261E` (4.36:1) to `#D3251D` (4.51:1) when the gates were introduced.

## Layout

- **One screen, map first.** The page never scrolls; each pane scrolls on its own. The only exception is viewports shorter than 30rem, where the page scrolls instead of squashing the map.
- **Three dock modes:**
  - `sheet`, under 760px: bottom sheet with Tokens, Output and Map info tabs. It is closed on first visit, and opening it collapses the intro.
  - `tabs`, from 760 to 1679px: side dock with Tokens and Output tabs.
  - `split`, 1680px and wider: Tokens and Output side by side.
- **Map info on phones.** Legend, station readout, stats and keys move into a tab in the sheet. A floating action button was rejected because it would add a third navigation pattern alongside the tabs and the sheet.
- **Map scale.** The map fits its viewport. The minimum scale keeps labels at 10px or larger; past that the map pans. Zoom goes up to 300% manually and 250% when fitting. `label.size` starts at 10, so 100% zoom can never draw labels below the floor.
- **Type.** Root font size is fluid with `clamp()` on viewport width, and all sizes are in rem. A is about 15px at 1440 wide, B about 13px.

## Color tools

- The picker uses hue, saturation and lightness sliders plus a hex field. It shades the failing part of each track, applies passing values live and never applies failing ones.
- A typed hex value is kept exactly. HSL rounding never changes what the user entered.
- One slider drag counts as one undo step: edits to the same token within 700ms are merged. History holds 80 steps.

## Themes

- Three slots per direction, stored in this browser only (`transit-themes:<id>`). Stored colors that fail a gate are dropped when loaded.
- Each slot has a theme name and optional names for its colors. Copy that mentions a color (B's "grey is an unlit lamp, amber is live") uses the active slot's name for it. Otherwise it falls back to `colorName()` in `src/color-names.ts`, which names a color by hue band and lightness.
- Replace keeps the theme name, and keeps color names only for colors that did not change.

## Known gaps

- Archivo and Martian Mono rendering has not been checked: font loading was blocked in the build sandbox.
- No screen-reader pass yet. The highest-risk areas are map navigation and the bottom sheet.
- Not yet tested on real touch devices.

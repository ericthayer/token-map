/**
 * Base drawing rules shared by every direction. Every color reads from the three color
 * tokens. Layered, so a direction's own unlayered rules always win.
 */
export const BASE_SHEET = new CSSStyleSheet();
BASE_SHEET.replaceSync(`
@layer base, shell;
@layer base {
transit-map { display: block; position: relative; min-width: 0; min-height: 0; }
.map-scroller { position: absolute; inset: 0; overflow: auto; overscroll-behavior: contain; display: flex; }
.map-scroller.can-pan { cursor: grab; }
.map-scroller.is-panning { cursor: grabbing; user-select: none; }
.map-svg { display: block; margin: auto; flex: none; }
.map-svg .ruler { fill: var(--c-ink); font-size: 11px; }
.map-svg .grid-cross { fill: none; stroke: var(--c-ink); stroke-width: 1; }
.map-svg .grid-dot { fill: var(--c-ink); }
.line-ink { fill: none; stroke: var(--c-ink); }
.line-core, .line-casing { fill: none; stroke: var(--c-ground); }
.line.is-on .line-ink { stroke: var(--c-signal); }
.map-svg .mk-hollow { fill: var(--c-ground); stroke: var(--c-ink); }
.map-svg .mk-solid { fill: var(--c-ink); }
.map-svg .mk-tick { stroke: var(--c-ink); }
.map-svg .stn.is-on .mk-hollow, .map-svg .stn.is-on .mk-tick { stroke: var(--c-signal); }
.map-svg .stn.is-on .mk-solid, .map-svg .pin { fill: var(--c-signal); }
.map-svg .stn-label { fill: var(--c-ink); paint-order: stroke; stroke: var(--c-ground); stroke-width: 3px; stroke-linejoin: round; }
.map-svg .label-chip { fill: var(--c-ink); }
.map-svg .stn-label.is-chip { fill: var(--c-ground); stroke: none; }
.map-svg .focus-mark { stroke: var(--c-signal); }
.map-svg .hit { fill: transparent; stroke: none; cursor: pointer; }
token-rack, contrast-panel, token-output, color-panel, theme-slots, map-legend, map-readout, zoom-control { display: block; min-width: 0; }
.rack-visual .meter-fill { display: block; height: 100%; width: calc(var(--pct, 0) * 100%); }
.swatch-ground { background: var(--c-ground); }
.swatch-ink { background: var(--c-ink); }
.swatch-signal { background: var(--c-signal); }

/* Saved-theme chips: the one place a non-current color can appear */
.tri { display: inline-flex; flex: none; border: 1.5px solid var(--c-ink); }
.tri > span { width: 0.55rem; height: 1.1rem; background: var(--sw); }
.tri-empty { width: calc(1.65rem + 3px); height: calc(1.1rem + 3px); border-style: dashed; }

/* Theme naming form */
.theme-form { display: grid; gap: 0.5rem; min-width: 0; }
.tn-field { display: grid; gap: 0.2rem; min-width: 0; }
.tn-field input { min-width: 0; font: inherit; color: var(--c-ink); background: var(--c-ground); border: 1.5px solid var(--c-ink); padding: 0.3rem 0.45rem; }
.tn-field input::placeholder { color: var(--c-ink); opacity: 1; font-style: italic; }
.tn-colors { border: 0; margin: 0; padding: 0; display: grid; gap: 0.4rem; min-width: 0; }
.tn-colors legend { padding: 0; margin-block-end: 0.2rem; }
.tn-label { display: inline-flex; align-items: center; gap: 0.35rem; }
.tn-chip { width: 0.8rem; height: 0.8rem; flex: none; background: var(--sw); border: 1.5px solid var(--c-ink); }
.theme-colors { display: block; }

/* Color editor tracks show candidate colors, veiled where a gate would fail */
color-editor { display: grid; gap: 0.6rem; --ce-veil: color-mix(in srgb, var(--c-ground) 82%, transparent); }
.ce-head { display: flex; align-items: center; gap: 0.6rem; }
.ce-swatch { width: 2.4rem; height: 2.4rem; flex: none; background: var(--sw); border: 1.5px solid var(--c-ink); }
color-editor.is-blocked .ce-swatch { background: linear-gradient(45deg, transparent 47%, var(--c-ink) 47% 53%, transparent 53%), linear-gradient(-45deg, transparent 47%, var(--c-ink) 47% 53%, transparent 53%), var(--sw); }
.ce-hex { width: 7.5em; min-width: 0; font: inherit; color: var(--c-ink); background: var(--c-ground); border: 1.5px solid var(--c-ink); padding: 0.3rem 0.4rem; text-transform: uppercase; }
.ce-ch { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.25rem 0.6rem; align-items: center; }
.ce-ch input[type="range"] { grid-column: 1 / -1; appearance: none; -webkit-appearance: none; width: 100%; height: 1.4rem; margin: 0; border: 1.5px solid var(--c-ink); background: var(--mask, none), var(--track, var(--c-ground)); }
.ce-ch input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 0.6rem; height: 1.9rem; background: var(--c-ground); border: 2px solid var(--c-ink); box-shadow: 0 0 0 1.5px var(--c-ground); }
.ce-ch input[type="range"]::-moz-range-thumb { width: 0.5rem; height: 1.8rem; background: var(--c-ground); border: 2px solid var(--c-ink); border-radius: 0; box-shadow: 0 0 0 1.5px var(--c-ground); }
.ce-ch input[type="range"]::-moz-range-track { background: transparent; }
.ce-out { font-variant-numeric: tabular-nums; }
.ce-status { margin: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
}
`);

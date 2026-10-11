/**
 * App shell geometry shared by both directions: one screen, no page scroll, map first.
 * Layout keys off `.app[data-layout]`, which <app-dock> sets from the app's width.
 * Directions restyle surfaces and type; they never need to touch this geometry.
 */
export const SHELL_SHEET = new CSSStyleSheet();
SHELL_SHEET.replaceSync(`
@layer shell {
html, body { height: 100%; }
.app { height: 100%; min-height: 30rem; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; container: app / inline-size; }
.app:not([data-layout]) { visibility: hidden; }

/* Masthead */
.masthead { padding-inline: var(--gutter); }
.masthead-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; }
.masthead-bar h1 { margin-inline-end: auto; }
.masthead-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.intro { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 2fr) auto; gap: 1rem 2rem; align-items: start; }
@container app (width < 70rem) { .intro { grid-template-columns: minmax(0, 1fr); } .intro .titleblock, .intro .lede { display: none !important; } }
@media (max-height: 760px) { .intro { grid-template-columns: minmax(0, 1fr); } .intro .titleblock, .intro .lede { display: none !important; } }
.howto { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1rem; }
@container app (width < 34rem) { .howto { grid-template-columns: minmax(0, 1fr); gap: 0.5rem; } }
.app[data-layout="sheet"] .intro { max-height: 36dvh; overflow: auto; overscroll-behavior: contain; }

#announce { position: fixed; top: 0; left: 0; margin: 0; }
theme-slots[variant="compact"] { display: flex; gap: 0.35rem; }
.slot { display: inline-flex; align-items: center; gap: 0.3rem; min-height: 2rem; }

/* Workspace */
.workspace { min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr); padding-inline: var(--gutter); }
.app[data-layout="tabs"] .workspace, .app[data-layout="split"] .workspace { grid-template-columns: minmax(0, 1fr) auto; }
.app[data-layout="sheet"] .workspace { grid-template-rows: minmax(0, 1fr) auto; }
.map-pane { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
.pane-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1rem; }
.pane-bar h2 { margin-inline-end: auto; }
map-legend { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; }
zoom-control { display: inline-flex; align-items: center; gap: 0.25rem; }
.zoom-value { min-width: 3.4em; text-align: center; font-variant-numeric: tabular-nums; }
map-readout { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; }
.app[data-layout="sheet"] .map-pane map-legend, .app[data-layout="sheet"] .map-pane map-readout { display: none !important; }

/* Dock */
app-dock { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
.app[data-layout="tabs"] app-dock { width: var(--dock-w); }
.app[data-layout="split"] app-dock { width: calc(var(--dock-w) * 2 + var(--split-gap)); grid-template-rows: minmax(0, 1fr); }
.app[data-layout="split"] .dock-bar { display: none !important; }
.app[data-layout="sheet"] app-dock { grid-template-rows: auto auto; }
.dock-bar { display: flex; align-items: center; gap: 0.5rem; }
.dock-tabs { display: flex; flex: 1; gap: 0.25rem 1rem; min-width: 0; }
.dock-panels { min-height: 0; display: grid; }
.app[data-layout="split"] .dock-panels { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--split-gap); }
.app[data-layout="sheet"] .dock-panels { height: min(46dvh, 30rem); }
.dock-panel { min-height: 0; min-width: 0; overflow: auto; overscroll-behavior: contain; }
.dock-panel:focus { outline: none; }

/* Command bar */
.cmdbar { display: grid; grid-template-columns: auto auto minmax(0, 1fr) auto auto; gap: 0.5rem 0.75rem; align-items: center; padding-inline: var(--gutter); }
.cmd-status { grid-column: 1 / -1; }
@container app (width < 30rem) { .cmdbar-label { display: none; } }
.icon-btn { display: inline-grid; place-items: center; width: 2.25rem; height: 2.25rem; padding: 0; }
.icon-btn svg { width: 1.25rem; height: 1.25rem; }

/* Floating help */
dialog.float { position: fixed; inset: auto; left: var(--fx, auto); top: var(--fy, auto); margin: 0; width: min(36rem, calc(100vw - 16px)); max-height: min(70dvh, 44rem); padding: 0; display: none; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; resize: both; min-width: 18rem; min-height: 12rem; z-index: 10; }
dialog.float[open] { display: grid; }
.float-bar { display: flex; align-items: center; gap: 0.5rem; cursor: move; touch-action: none; user-select: none; }
.float-bar h2 { margin-inline-end: auto; }
.float-body { overflow: auto; overscroll-behavior: contain; min-height: 0; }

/* Touch: every target at least 44px, steppers always visible */
@media (pointer: coarse) {
  .rack-step, .zoom-btn, .zoom-fit, .icon-btn, .slot, .theme-act, .pin-btn, .dock-tabs [role="tab"], .dock-toggle { min-width: 44px; min-height: 44px; }
  .legend-btn { min-height: 44px; }
  .rack-steps { visibility: visible !important; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
}
`);

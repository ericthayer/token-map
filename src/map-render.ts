/** SVG builders for the map. Pure functions of a render context: no state, no events. */
import { s } from './dom.js';
import { labelPlacement, pathD, routePoints, strokeFor, tickVector, type MapGeometry } from './geometry.js';
import { GRID, linesAt, station, type LineNumber, type Station, type TransitLine } from './network.js';
import type { TokenStore } from './tokens.js';

export interface RenderCtx {
  readonly geo: MapGeometry;
  readonly mode: string;
  readonly join: string;
  readonly w: number;
  readonly dash: number;
  readonly gap: number;
  readonly shape: string;
  readonly size: number;
  readonly labelSize: number;
  readonly tracking: number;
  readonly upper: boolean;
  readonly offset: number;
  readonly gridMark: string;
  readonly active: ReadonlySet<LineNumber>;
  readonly isolating: boolean;
  readonly pinned: ReadonlySet<string>;
  readonly focused: string;
  /** Radius of the invisible tap target, in map units. */
  readonly hit: number;
}

export function readTokens(st: TokenStore): Omit<RenderCtx, 'geo' | 'active' | 'isolating' | 'pinned' | 'focused' | 'hit'> {
  return {
    mode: st.str('route.geometry'),
    join: st.str('route.join'),
    w: st.num('stroke.line'),
    dash: st.num('stroke.dash'),
    gap: st.num('stroke.gap'),
    shape: st.str('station.shape'),
    size: st.num('station.size'),
    labelSize: st.num('label.size'),
    tracking: st.num('label.tracking'),
    upper: st.str('label.case') === 'upper',
    offset: st.num('label.offset'),
    gridMark: st.str('grid.mark'),
  };
}

export function gridLayer(geo: MapGeometry, mark: string): SVGGElement {
  const g = s('g', { class: 'grid', 'aria-hidden': 'true' });
  for (let x = 0; x <= GRID.cols; x++) {
    g.append(s('text', { class: 'ruler', x: geo.at(x, 0).x, y: geo.oy * 0.4, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String.fromCharCode(65 + x)));
  }
  for (let y = 0; y <= GRID.rows; y++) {
    g.append(s('text', { class: 'ruler', x: geo.ox * 0.4, y: geo.at(0, y).y, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, String(y)));
  }
  if (mark === 'none') return g;
  let d = '';
  for (let x = 0; x <= GRID.cols; x++) {
    for (let y = 0; y <= GRID.rows; y++) {
      const p = geo.at(x, y);
      if (mark === 'cross') d += `M${p.x - 3} ${p.y}h6M${p.x} ${p.y - 3}v6`;
      else g.append(s('circle', { class: 'grid-dot', cx: p.x, cy: p.y, r: 1.6 }));
    }
  }
  if (d) g.append(s('path', { class: 'grid-cross', d }));
  return g;
}

/** One line. Active lines get a ground-colored casing so their state never relies on color alone. */
export function lineGroup(line: TransitLine, c: RenderCtx): SVGGElement {
  const on = c.active.has(line.n);
  const ghost = c.isolating && !on;
  const g = s('g', { class: `line line-${line.n}${on ? ' is-on' : ''}${ghost ? ' is-ghost' : ''}` });
  const d = pathD(routePoints(line.stops, c.mode), c.geo);
  if (ghost) {
    g.append(s('path', { d, class: 'line-ink', 'stroke-width': 1, 'stroke-linejoin': c.join }));
    return g;
  }
  const spec = strokeFor(line.pattern, c.w, c.dash, c.gap);
  if (on) g.append(s('path', { d, class: 'line-casing', 'stroke-width': spec.width + Math.max(4, c.w * 0.8), 'stroke-linejoin': c.join }));
  g.append(s('path', { d, class: 'line-ink', 'stroke-width': spec.width, 'stroke-dasharray': spec.dasharray, 'stroke-linecap': spec.linecap, 'stroke-linejoin': c.join }));
  if (spec.core !== null) g.append(s('path', { d, class: 'line-core', 'stroke-width': spec.core, 'stroke-linejoin': c.join }));
  return g;
}

export function stationGroup(stn: Station, c: RenderCtx): SVGGElement {
  const lines = linesAt(stn.id);
  const interchange = lines.length > 1;
  const on = lines.some((l) => c.active.has(l.n));
  const pinned = c.pinned.has(stn.id);
  const classes = ['stn', on ? 'is-on' : '', c.isolating && !on ? 'is-ghost' : '', pinned ? 'is-pinned' : '', stn.id === c.focused ? 'is-focus' : ''];
  const g = s('g', { class: classes.filter(Boolean).join(' '), 'data-station': stn.id });
  const p = c.geo.at(stn.x, stn.y);
  const outline = Math.max(1.5, c.w * 0.45);
  let extent = c.size;
  if (interchange) {
    const r = c.size * 1.35;
    extent = r;
    g.append(c.shape === 'block'
      ? s('rect', { class: 'mk mk-hollow', x: p.x - r, y: p.y - r, width: 2 * r, height: 2 * r, 'stroke-width': outline })
      : s('circle', { class: 'mk mk-hollow', cx: p.x, cy: p.y, r, 'stroke-width': outline }));
  } else if (c.shape === 'tick') {
    const v = tickVector(stn.id);
    extent = c.size * 1.6 + c.w / 2;
    g.append(s('line', { class: 'mk mk-tick', x1: p.x, y1: p.y, x2: p.x + v.x * extent, y2: p.y + v.y * extent, 'stroke-width': Math.max(2, c.w * 0.8) }));
  } else if (c.shape === 'ring') {
    g.append(s('circle', { class: 'mk mk-hollow', cx: p.x, cy: p.y, r: c.size, 'stroke-width': outline }));
  } else {
    g.append(s('rect', { class: 'mk mk-solid', x: p.x - c.size, y: p.y - c.size, width: 2 * c.size, height: 2 * c.size }));
  }
  if (pinned) g.append(s('rect', { class: 'pin', x: p.x - 3, y: p.y - 3, width: 6, height: 6 }));
  const lp = labelPlacement(stn.label, c.offset + extent);
  g.append(s('text', {
    class: 'stn-label', x: p.x + lp.dx, y: p.y + lp.dy, 'text-anchor': lp.anchor, 'dominant-baseline': lp.baseline,
    'font-size': c.labelSize, 'letter-spacing': `${c.tracking}em`,
  }, c.upper ? stn.name.toUpperCase() : stn.name));
  g.append(s('circle', { class: 'hit', cx: p.x, cy: p.y, r: c.hit }));
  return g;
}

export function focusMark(c: RenderCtx): SVGPathElement {
  const st = station(c.focused);
  const p = c.geo.at(st.x, st.y);
  const m = c.size * 1.35 + Math.max(4, c.w * 0.6) + 4;
  const k = Math.max(5, m * 0.45);
  const d = `M${p.x - m} ${p.y - m + k}V${p.y - m}H${p.x - m + k}M${p.x + m - k} ${p.y - m}H${p.x + m}V${p.y - m + k}`
    + `M${p.x + m} ${p.y + m - k}V${p.y + m}H${p.x + m - k}M${p.x - m + k} ${p.y + m}H${p.x - m}V${p.y + m - k}`;
  return s('path', { class: 'focus-mark', d, 'stroke-width': 2.5, fill: 'none' });
}

/** Inverts the focused station's name onto an ink chip so the cursor reads at any zoom. Needs a laid-out SVG. */
export function chipFocusedLabel(svg: SVGSVGElement): void {
  const label = svg.querySelector<SVGTextElement>('.is-focus .stn-label');
  if (!label || !label.isConnected) return;
  const box = label.getBBox();
  const pad = 3;
  label.before(s('rect', { class: 'label-chip', x: box.x - pad, y: box.y - pad / 2, width: box.width + pad * 2, height: box.height + pad }));
  label.classList.add('is-chip');
}

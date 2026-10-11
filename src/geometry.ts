/** Pure drawing math: grid placement, routing, stroke patterns, label anchors. */
import { GRID, LINES, station, type LabelSide, type LinePattern } from './network.js';

export interface Pt {
  readonly x: number;
  readonly y: number;
}
export interface MapGeometry {
  readonly unit: number;
  readonly ox: number;
  readonly oy: number;
  readonly width: number;
  readonly height: number;
  at(x: number, y: number): Pt;
}
export interface StrokeSpec {
  readonly width: number;
  readonly dasharray: string | null;
  readonly linecap: 'butt' | 'round';
  /** Width of the ground-colored core that turns one stroke into a double rule. */
  readonly core: number | null;
}
export interface LabelPlacement {
  readonly dx: number;
  readonly dy: number;
  readonly anchor: 'start' | 'middle' | 'end';
  readonly baseline: 'central' | 'auto' | 'hanging';
}

const r2 = (n: number): number => Number(n.toFixed(2));

export function geometry(unit: number): MapGeometry {
  const ox = unit * 1.2;
  const oy = unit * 0.9;
  return {
    unit,
    ox,
    oy,
    width: Math.round(ox + (GRID.cols + 2.3) * unit),
    height: Math.round(oy + (GRID.rows + 0.9) * unit),
    at: (x: number, y: number): Pt => ({ x: r2(ox + x * unit), y: r2(oy + y * unit) }),
  };
}

/** Grid-space points for a line. Orthogonal mode turns each diagonal into an L, horizontal first. */
export function routePoints(stops: readonly string[], mode: string): Pt[] {
  const pts: Pt[] = [];
  for (const id of stops) {
    const st = station(id);
    const prev = pts[pts.length - 1];
    if (prev && mode === 'orthogonal' && prev.x !== st.x && prev.y !== st.y) pts.push({ x: st.x, y: prev.y });
    pts.push({ x: st.x, y: st.y });
  }
  return pts;
}

export function pathD(points: readonly Pt[], geo: MapGeometry): string {
  return points
    .map((p, i) => {
      const q = geo.at(p.x, p.y);
      return `${i === 0 ? 'M' : 'L'}${q.x} ${q.y}`;
    })
    .join('');
}

export function strokeFor(pattern: LinePattern, w: number, dash: number, gap: number): StrokeSpec {
  switch (pattern) {
    case 'solid':
      return { width: w, dasharray: null, linecap: 'butt', core: null };
    case 'dashed':
      return { width: w, dasharray: `${r2(w * dash)} ${r2(w * gap)}`, linecap: 'butt', core: null };
    case 'double':
      return { width: r2(w * 1.5), dasharray: null, linecap: 'butt', core: r2(w * 0.5) };
    case 'dotted':
      return { width: w, dasharray: `0 ${r2(w * (1 + gap))}`, linecap: 'round', core: null };
  }
}

const SIDE_VECTORS: Readonly<Record<LabelSide, Pt>> = {
  r: { x: 1, y: 0 },
  l: { x: -1, y: 0 },
  t: { x: 0, y: -1 },
  b: { x: 0, y: 1 },
  tr: { x: 0.75, y: -0.75 },
  tl: { x: -0.75, y: -0.75 },
  br: { x: 0.75, y: 0.75 },
  bl: { x: -0.75, y: 0.75 },
};

export function labelPlacement(side: LabelSide, distance: number): LabelPlacement {
  const v = SIDE_VECTORS[side];
  const anchor = v.x > 0 ? 'start' : v.x < 0 ? 'end' : 'middle';
  const baseline = v.y > 0 ? 'hanging' : v.y < 0 ? 'auto' : 'central';
  return { dx: r2(v.x * distance), dy: r2(v.y * distance), anchor, baseline };
}

/** Unit vector perpendicular to the station's line, turned toward its label, as on printed diagrams. */
export function tickVector(id: string): Pt {
  const line = LINES.find((l) => l.stops.includes(id));
  const st = station(id);
  const side = SIDE_VECTORS[st.label];
  if (!line) return side;
  const i = line.stops.indexOf(id);
  const a = station(line.stops[Math.max(0, i - 1)] ?? id);
  const b = station(line.stops[Math.min(line.stops.length - 1, i + 1)] ?? id);
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len = Math.hypot(vx, vy) || 1;
  const px = -vy / len;
  const py = vx / len;
  return px * side.x + py * side.y >= 0 ? { x: px, y: py } : { x: -px, y: -py };
}

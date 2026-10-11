/** The fictional Lowmoor network. Grid coordinates use 45° and 90° segments only. */
export type LabelSide = 'r' | 'l' | 't' | 'b' | 'tr' | 'tl' | 'br' | 'bl';
export type LinePattern = 'solid' | 'dashed' | 'double' | 'dotted';
export type LineNumber = 1 | 2 | 3 | 4;

export interface Station {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly label: LabelSide;
}
export interface TransitLine {
  readonly n: LineNumber;
  readonly name: string;
  readonly pattern: LinePattern;
  readonly stops: readonly string[];
}

export const NETWORK_NAME = 'Lowmoor';
export const GRID = { cols: 14, rows: 10 } as const;

export const STATIONS: readonly Station[] = [
  { id: 'a', name: 'Westgate', x: 1, y: 5, label: 't' },
  { id: 'b', name: 'Copper Lane', x: 3, y: 5, label: 't' },
  { id: 'c', name: 'Mill Street', x: 5, y: 5, label: 'b' },
  { id: 'x', name: 'Central Exchange', x: 7, y: 5, label: 'tl' },
  { id: 'd', name: 'Foundry', x: 9, y: 5, label: 'br' },
  { id: 'e', name: 'Kestrel Yard', x: 11, y: 3, label: 'br' },
  { id: 'f', name: 'Eastmoor', x: 13, y: 3, label: 'r' },
  { id: 'g', name: 'Northfield', x: 7, y: 1, label: 'r' },
  { id: 'h', name: 'Observatory', x: 7, y: 3, label: 'l' },
  { id: 'i', name: 'Market Hall', x: 7, y: 7, label: 'tr' },
  { id: 'j', name: 'Southwharf', x: 9, y: 9, label: 'b' },
  { id: 'k', name: 'Lantern Docks', x: 11, y: 9, label: 'r' },
  { id: 'l', name: 'Brickworks', x: 1, y: 8, label: 'b' },
  { id: 'm', name: 'Ashford Road', x: 4, y: 8, label: 'b' },
  { id: 'n', name: 'Tannery', x: 5, y: 7, label: 'tl' },
  { id: 'v', name: 'Parkside', x: 8, y: 4, label: 'r' },
  { id: 'o', name: 'Gasworks Hill', x: 9, y: 3, label: 't' },
  { id: 'p', name: 'Airfield', x: 12, y: 2, label: 'r' },
  { id: 'q', name: 'Orchard', x: 3, y: 7, label: 'l' },
  { id: 'r', name: 'Pottery Row', x: 6, y: 8, label: 'b' },
  { id: 't', name: 'Cattle Market', x: 9, y: 7, label: 'r' },
];

export const LINES: readonly TransitLine[] = [
  { n: 1, name: 'Crosstown', pattern: 'solid', stops: ['a', 'b', 'c', 'x', 'd', 'e', 'f'] },
  { n: 2, name: 'Northfield', pattern: 'dashed', stops: ['g', 'h', 'x', 'i', 'j', 'k'] },
  { n: 3, name: 'Airfield', pattern: 'double', stops: ['l', 'm', 'n', 'x', 'v', 'o', 'e', 'p'] },
  { n: 4, name: 'Market loop', pattern: 'dotted', stops: ['b', 'q', 'm', 'r', 'i', 't', 'd'] },
];

const byId = new Map(STATIONS.map((st) => [st.id, st] as const));

export function station(id: string): Station {
  const st = byId.get(id);
  if (!st) throw new Error(`Unknown station ${id}`);
  return st;
}

export function linesAt(id: string): readonly TransitLine[] {
  return LINES.filter((line) => line.stops.includes(id));
}

export function neighbors(id: string): readonly string[] {
  const out = new Set<string>();
  for (const line of LINES) {
    const i = line.stops.indexOf(id);
    if (i < 0) continue;
    const prev = line.stops[i - 1];
    const next = line.stops[i + 1];
    if (prev) out.add(prev);
    if (next) out.add(next);
  }
  return [...out];
}

/** Map index reference, as printed in the margin of the diagram: column letter, row number. */
export function gridRef(st: Station): string {
  return `${String.fromCharCode(65 + st.x)}${st.y}`;
}

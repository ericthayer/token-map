/** Token schema: the sixteen tokens every direction exposes. */
export type TokenGroup = 'color' | 'grid' | 'stroke' | 'route' | 'station' | 'label';
export type NumberUnit = 'px' | 'em' | 'x';

interface TokenBase {
  readonly name: string;
  readonly group: TokenGroup;
  readonly description: string;
}
export interface NumberToken extends TokenBase {
  readonly kind: 'number';
  readonly unit: NumberUnit;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
}
export interface EnumToken extends TokenBase {
  readonly kind: 'enum';
  readonly options: readonly string[];
  readonly value: string;
}
export interface ColorToken extends TokenBase {
  readonly kind: 'color';
  readonly value: string;
}
export type TokenDef = NumberToken | EnumToken | ColorToken;
export type TokenValue = string | number;

export const GROUP_LABELS: Readonly<Record<TokenGroup, string>> = {
  color: 'Color',
  grid: 'Grid',
  stroke: 'Stroke',
  route: 'Route',
  station: 'Station',
  label: 'Label',
};

export const TOKEN_DEFS: readonly TokenDef[] = [
  { kind: 'color', name: 'color.ground', group: 'color', value: '#F2EFE6', description: 'The surface everything sits on.' },
  { kind: 'color', name: 'color.ink', group: 'color', value: '#141414', description: 'Lines, stations, labels and rules.' },
  { kind: 'color', name: 'color.signal', group: 'color', value: '#D3251D', description: 'Focus, selection and the active line.' },
  { kind: 'number', name: 'grid.unit', group: 'grid', unit: 'px', min: 28, max: 72, step: 2, value: 44, description: 'Distance between grid points at 100% zoom.' },
  { kind: 'enum', name: 'grid.mark', group: 'grid', options: ['cross', 'dot', 'none'], value: 'cross', description: 'Mark drawn at each grid point.' },
  { kind: 'number', name: 'stroke.line', group: 'stroke', unit: 'px', min: 2, max: 14, step: 1, value: 6, description: 'Line weight for all four lines.' },
  { kind: 'number', name: 'stroke.dash', group: 'stroke', unit: 'x', min: 1, max: 6, step: 0.5, value: 3, description: 'Dash length on line 2, as a multiple of line weight.' },
  { kind: 'number', name: 'stroke.gap', group: 'stroke', unit: 'x', min: 0.5, max: 4, step: 0.25, value: 1.5, description: 'Gap on lines 2 and 4, as a multiple of line weight.' },
  { kind: 'enum', name: 'route.geometry', group: 'route', options: ['octilinear', 'orthogonal'], value: 'octilinear', description: '45° diagonals, or right angles only.' },
  { kind: 'enum', name: 'route.join', group: 'route', options: ['miter', 'round', 'bevel'], value: 'round', description: 'How lines turn a corner.' },
  { kind: 'enum', name: 'station.shape', group: 'station', options: ['tick', 'ring', 'block'], value: 'tick', description: 'Marker for single-line stations. Interchanges get a larger outlined marker.' },
  { kind: 'number', name: 'station.size', group: 'station', unit: 'px', min: 3, max: 14, step: 1, value: 6, description: 'Marker radius.' },
  { kind: 'number', name: 'label.size', group: 'label', unit: 'px', min: 9, max: 20, step: 1, value: 12, description: 'Station name size at 100% zoom. The map never zooms out past 10px.' },
  { kind: 'number', name: 'label.tracking', group: 'label', unit: 'em', min: 0, max: 0.2, step: 0.01, value: 0.02, description: 'Letter spacing for station names.' },
  { kind: 'enum', name: 'label.case', group: 'label', options: ['mixed', 'upper'], value: 'mixed', description: 'Station names as written, or in capitals.' },
  { kind: 'number', name: 'label.offset', group: 'label', unit: 'px', min: 2, max: 24, step: 1, value: 6, description: 'Gap between a marker and its name.' },
];

const UNIT_TEXT: Readonly<Record<NumberUnit, string>> = { px: 'px', em: 'em', x: '×' };

export function formatValue(def: TokenDef, value: TokenValue): string {
  return def.kind === 'number' ? `${value}${UNIT_TEXT[def.unit]}` : String(value);
}

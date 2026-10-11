/** Plain-language color names for copy that mentions the current theme, e.g. "amber is live". */
import { hexToRgb } from './color.js';

const HUES: readonly (readonly [number, string])[] = [
  [12, 'red'], [38, 'orange'], [48, 'amber'], [66, 'yellow'], [90, 'lime'], [160, 'green'], [185, 'teal'],
  [200, 'cyan'], [245, 'blue'], [270, 'indigo'], [292, 'violet'], [320, 'purple'], [345, 'magenta'], [360, 'red'],
];

function neutral(l: number, warm: boolean): string {
  if (l < 0.1) return 'black';
  if (l < 0.25) return 'charcoal';
  if (l < 0.45) return 'dark grey';
  if (l < 0.68) return 'grey';
  if (l < 0.86) return warm ? 'stone' : 'silver';
  return warm ? 'cream' : 'white';
}

/** Names a hex color by hue band, with lightness modifiers. Deterministic and dependency-free. */
export function colorName(hex: string): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const l = (max + min) / 2;
  let h = 0;
  if (chroma > 0) {
    if (max === r) h = ((g - b) / chroma + 6) % 6;
    else if (max === g) h = (b - r) / chroma + 2;
    else h = (r - g) / chroma + 4;
    h *= 60;
  }
  if (chroma < 0.1) return neutral(l, chroma > 0.02 && h >= 20 && h <= 70);
  const base = HUES.find(([limit]) => h < limit)?.[1] ?? 'red';
  if (l < 0.32) {
    if (base === 'orange' || base === 'amber') return 'brown';
    if (base === 'red') return 'maroon';
    if (base === 'blue' || base === 'indigo') return 'navy';
    return `dark ${base}`;
  }
  if ((base === 'red' || base === 'magenta') && l > 0.65) return 'pink';
  if (l > 0.78) return `pale ${base}`;
  return base;
}

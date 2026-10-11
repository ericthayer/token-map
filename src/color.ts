/** Hex parsing, lightness stepping and WCAG contrast. */
export type Rgb = readonly [number, number, number];
type Hsl = readonly [number, number, number];

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(input: string): string | null {
  const body = HEX_RE.exec(input.trim())?.[1];
  if (body === undefined) return null;
  const full = body.length === 3 ? [...body].map((c) => c + c).join('') : body;
  return `#${full.toUpperCase()}`;
}

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(rgb: Rgb): string {
  const part = (v: number): string =>
    Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${rgb.map(part).join('')}`.toUpperCase();
}

function rgbToHsl([r, g, b]: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue: number;
  if (max === rn) hue = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) hue = (bn - rn) / d + 2;
  else hue = (rn - gn) / d + 4;
  return [hue * 60, sat, l];
}

function hslToRgb([hue, sat, lig]: Hsl): Rgb {
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = (((hue % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r, g, b]: Rgb =
    hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = lig - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Hue in degrees 0–360, saturation and lightness in percent 0–100. */
export interface HslColor {
  readonly h: number;
  readonly s: number;
  readonly l: number;
}

export function hexToHsl(hex: string): HslColor {
  const [h, sat, lig] = rgbToHsl(hexToRgb(hex));
  return { h: Math.round(h), s: Math.round(sat * 100), l: Math.round(lig * 100) };
}

export function hslToHex({ h, s, l }: HslColor): string {
  return rgbToHex(hslToRgb([h, s / 100, l / 100]));
}

/** Steps HSL lightness by a percentage, keeping hue and saturation. */
export function adjustLightness(hex: string, deltaPct: number): string {
  const [hue, sat, lig] = rgbToHsl(hexToRgb(hex));
  return rgbToHex(hslToRgb([hue, sat, Math.min(1, Math.max(0, lig + deltaPct / 100))]));
}

export function relativeLuminance(hex: string): number {
  const channel = (v: number): number => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Accessibility gates for the three-color trio. Required rules block a change; advisory rules only report. */
import { contrastRatio, hexToHsl, hslToHex, type HslColor } from './color.js';

export type ColorRole = 'ground' | 'ink' | 'signal';
export type Trio = Readonly<Record<ColorRole, string>>;
export type GateLevel = 'required' | 'advisory';

export interface GateRule {
  readonly fg: ColorRole;
  readonly bg: ColorRole;
  readonly min: number;
  readonly level: GateLevel;
  readonly use: string;
}
export interface GateResult {
  readonly rule: GateRule;
  readonly ratio: number;
  readonly pass: boolean;
}
export type HslChannel = keyof HslColor;

export const ROLES: readonly ColorRole[] = ['ground', 'ink', 'signal'];

export const GATE_RULES: readonly GateRule[] = [
  { fg: 'ink', bg: 'ground', min: 4.5, level: 'required', use: 'Station names, labels and all body text' },
  { fg: 'signal', bg: 'ground', min: 4.5, level: 'required', use: 'Focus ring, active line, and text set in or on the signal color' },
  { fg: 'signal', bg: 'ink', min: 3, level: 'advisory', use: 'Active line beside inactive lines. Active lines are also outlined and listed in the readout, so color is not the only cue.' },
];

export const CHANNEL_MAX: Readonly<Record<HslChannel, number>> = { h: 360, s: 100, l: 100 };

export function evaluate(trio: Trio): GateResult[] {
  return GATE_RULES.map((rule) => {
    const ratio = contrastRatio(trio[rule.fg], trio[rule.bg]);
    return { rule, ratio, pass: ratio >= rule.min };
  });
}

/** Required rules a trio breaks. Empty means the trio is allowed. */
export function failures(trio: Trio): GateResult[] {
  return evaluate(trio).filter((r) => r.rule.level === 'required' && !r.pass);
}

export const passes = (trio: Trio): boolean => failures(trio).length === 0;

export function describeFailure(f: GateResult): string {
  return `${f.rule.fg} on ${f.rule.bg} would be ${f.ratio.toFixed(2)}:1, and it needs ${f.rule.min}:1`;
}

/** Closest passing color for one role, searching lightness first, then saturation. */
export function nearestPassing(role: ColorRole, candidate: string, trio: Trio): string | null {
  const base = hexToHsl(candidate);
  const test = (hsl: HslColor): string | null => {
    const hex = hslToHex(hsl);
    return passes({ ...trio, [role]: hex }) ? hex : null;
  };
  for (let d = 0; d <= 100; d++) {
    for (const l of d === 0 ? [base.l] : [base.l - d, base.l + d]) {
      if (l < 0 || l > 100) continue;
      const hit = test({ ...base, l });
      if (hit) return hit;
    }
  }
  for (let s = base.s - 10; s >= 0; s -= 10) {
    for (let l = 0; l <= 100; l++) {
      const hit = test({ ...base, s, l });
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Samples one HSL channel across its range and reports where the role passes.
 * Used to shade the failing parts of a slider track.
 */
export function channelPassMap(role: ColorRole, hsl: HslColor, channel: HslChannel, trio: Trio, samples = 48): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i <= samples; i++) {
    const v = (i / samples) * CHANNEL_MAX[channel];
    out.push(passes({ ...trio, [role]: hslToHex({ ...hsl, [channel]: v }) }));
  }
  return out;
}

/** Plain-language summary of passing ranges, e.g. "0–38 and 90–100". */
export function rangeText(map: readonly boolean[], max: number): string {
  const ranges: string[] = [];
  let start = -1;
  map.forEach((ok, i) => {
    if (ok && start < 0) start = i;
    if ((!ok || i === map.length - 1) && start >= 0) {
      const end = ok ? i : i - 1;
      const toV = (n: number): number => Math.round((n / (map.length - 1)) * max);
      ranges.push(start === end ? `${toV(start)}` : `${toV(start)}–${toV(end)}`);
      start = -1;
    }
  });
  return ranges.length ? ranges.join(' and ') : 'none';
}

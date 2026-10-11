/** Serializes the store as CSS custom properties or DTCG JSON, one token per line. */
import type { TokenDef, TokenStore, TokenValue } from './tokens.js';

export type OutputFormat = 'css' | 'json';
export interface OutputLine {
  readonly text: string;
  readonly token: string | null;
}

const cssName = (name: string): string => `--${name.replace(/\./g, '-')}`;

function cssValue(def: TokenDef, v: TokenValue): string {
  if (def.kind !== 'number') return String(v);
  return def.unit === 'x' ? String(v) : `${v}${def.unit}`;
}

function dtcgValue(def: TokenDef, v: TokenValue): string {
  switch (def.kind) {
    case 'color':
      return `"$type": "color", "$value": "${v}"`;
    case 'enum':
      return `"$value": "${v}", "$description": "One of ${def.options.join(', ')}"`;
    case 'number':
      if (def.unit === 'px') return `"$type": "dimension", "$value": { "value": ${v}, "unit": "px" }`;
      return `"$type": "number", "$value": ${v}, "$description": "${def.unit === 'em' ? 'em' : 'multiple of stroke.line'}"`;
  }
}

export function toCss(store: TokenStore): OutputLine[] {
  return [
    { text: ':root {', token: null },
    ...store.defs().map((def) => ({ text: `  ${cssName(def.name)}: ${cssValue(def, store.get(def.name))};`, token: def.name })),
    { text: '}', token: null },
  ];
}

export function toDtcg(store: TokenStore): OutputLine[] {
  const groups = new Map<string, TokenDef[]>();
  for (const def of store.defs()) {
    const group = def.name.split('.')[0] ?? def.name;
    groups.set(group, [...(groups.get(group) ?? []), def]);
  }
  const out: OutputLine[] = [{ text: '{', token: null }];
  const entries = [...groups];
  entries.forEach(([group, defs], gi) => {
    out.push({ text: `  "${group}": {`, token: null });
    defs.forEach((def, di) => {
      const leaf = def.name.slice(group.length + 1);
      const comma = di < defs.length - 1 ? ',' : '';
      out.push({ text: `    "${leaf}": { ${dtcgValue(def, store.get(def.name))} }${comma}`, token: def.name });
    });
    out.push({ text: `  }${gi < entries.length - 1 ? ',' : ''}`, token: null });
  });
  out.push({ text: '}', token: null });
  return out;
}

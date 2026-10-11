/** Command line grammar. Pure dispatch over the store, themes, map and output. */
import { formatValue, type TokenDef, type TokenStore } from './tokens.js';
import type { ThemeStore } from './themes.js';

export interface CommandResult {
  readonly ok: boolean;
  readonly text: string;
}
export interface CommandTargets {
  readonly store: TokenStore;
  readonly themes: ThemeStore;
  copy(): void;
  fit(): void;
  select(name: string): void;
}

export const COMMAND_WORDS: readonly string[] = [
  'reset', 'undo', 'redo', 'copy', 'fit', 'theme 1', 'theme 2', 'theme 3', 'save 1', 'save 2', 'save 3', 'name 1 ',
];

function hint(def: TokenDef): string {
  if (def.kind === 'number') return `Range ${formatValue(def, def.min)} to ${formatValue(def, def.max)}.`;
  if (def.kind === 'enum') return `Options: ${def.options.join(', ')}.`;
  return 'Give a hex value. Changes that break a contrast gate are refused.';
}

function unknown(store: TokenStore, name: string): string {
  const names = store.defs().map((d) => d.name);
  const leaf = name.split('.').pop() ?? name;
  const guess = names.find((n) => n.startsWith(name)) ?? names.find((n) => leaf.length > 2 && n.includes(leaf));
  return `No token or command named ${name}. ${guess ? `Try ${guess}.` : 'Press ? for the full list.'}`;
}

const slotOf = (arg: string): number => {
  const n = Number.parseInt(arg, 10);
  return n >= 1 && n <= 3 ? n - 1 : -1;
};

export function runCommand(raw: string, t: CommandTargets): CommandResult {
  const { store, themes } = t;
  const [head, ...rest] = raw.trim().split(/\s+/).filter(Boolean);
  const arg = rest.join(' ');
  switch (head) {
    case undefined:
      return { ok: false, text: 'Type a token name and a value, for example stroke.line 8.' };
    case 'reset': {
      if (!arg) {
        store.reset();
        return { ok: true, text: 'All tokens reset to this direction’s defaults. Undo with Ctrl+Z.' };
      }
      const def = store.def(arg);
      if (!def) return { ok: false, text: unknown(store, arg) };
      store.reset(arg);
      return { ok: true, text: `${arg} reset to ${formatValue(def, store.get(arg))}.` };
    }
    case 'undo':
      return store.undo() ? { ok: true, text: 'Undone.' } : { ok: false, text: 'Nothing to undo.' };
    case 'redo':
      return store.redo() ? { ok: true, text: 'Redone.' } : { ok: false, text: 'Nothing to redo.' };
    case 'copy':
      t.copy();
      return { ok: true, text: 'Copying the output.' };
    case 'fit':
      t.fit();
      return { ok: true, text: 'Map fitted to view.' };
    case 'colors': {
      if (rest.length !== 3) return { ok: false, text: 'colors takes three hex values: ground, ink, signal. For example colors #0A0A0A #8A8A85 #FFB000.' };
      const [ground = '', ink = '', signal = ''] = rest;
      const result = store.setColors({ ground, ink, signal }, 'edit');
      return result.ok ? { ok: true, text: `Colors set to ${String(result.value)}.` } : { ok: false, text: result.error };
    }
    case 'theme': {
      const i = slotOf(arg);
      if (i < 0) return { ok: false, text: 'theme takes a slot number from 1 to 3.' };
      const result = themes.apply(i);
      return result.ok ? { ok: true, text: `Theme ${i + 1} applied.` } : { ok: false, text: result.error };
    }
    case 'save': {
      const i = slotOf(arg);
      if (i < 0) return { ok: false, text: 'save takes a slot number from 1 to 3.' };
      themes.save(i);
      return { ok: true, text: `Current colors saved as theme ${i + 1}.` };
    }
    case 'name': {
      const i = slotOf(rest[0] ?? '');
      const label = rest.slice(1).join(' ');
      if (i < 0 || !label) return { ok: false, text: 'name takes a slot number and a name, for example name 2 Night shift.' };
      const result = themes.rename(i, label);
      return result.ok ? { ok: true, text: `Theme ${i + 1} named ${String(result.value)}.` } : { ok: false, text: result.error };
    }
    default: {
      const def = store.def(head);
      if (!def) return { ok: false, text: unknown(store, head) };
      t.select(head);
      if (!arg) return { ok: true, text: `${head} is ${formatValue(def, store.get(head))}. ${hint(def)}` };
      const result = store.set(head, arg);
      if (!result.ok) return { ok: false, text: def.kind === 'color' ? result.error : `${result.error} ${hint(def)}` };
      const clamped = def.kind === 'number' && Number.parseFloat(arg) !== result.value;
      return { ok: true, text: `${head} set to ${formatValue(def, result.value)}${clamped ? ', the nearest allowed value' : ''}.` };
    }
  }
}

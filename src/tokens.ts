/** TokenStore: the single source of truth. Enforces color gates and keeps undo history. */
import { adjustLightness, normalizeHex } from './color.js';
import { describeFailure, failures, nearestPassing, type ColorRole, type Trio } from './gates.js';
import { TOKEN_DEFS, type TokenDef, type TokenValue } from './token-defs.js';

export * from './token-defs.js';

export type TokenDefaults = Readonly<Partial<Record<string, TokenValue>>>;
export type SetResult =
  | { readonly ok: true; readonly value: TokenValue; readonly changed: boolean }
  | { readonly ok: false; readonly error: string; readonly suggestion?: string };
export type ChangeSource = 'edit' | 'undo' | 'redo' | 'reset' | 'theme';
export interface TokenChange {
  readonly name: string | null;
  readonly source: ChangeSource;
}
type Snapshot = ReadonlyMap<string, TokenValue>;
type Coerced = { readonly ok: true; readonly value: TokenValue } | { readonly ok: false; readonly error: string };

const HISTORY_LIMIT = 80;
const COALESCE_MS = 700;
const decimals = (step: number): number => String(step).split('.')[1]?.length ?? 0;
const roleOf = (name: string): ColorRole | null =>
  name === 'color.ground' || name === 'color.ink' || name === 'color.signal' ? (name.slice(6) as ColorRole) : null;

function coerce(def: TokenDef, raw: TokenValue): Coerced {
  switch (def.kind) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number.parseFloat(raw);
      if (!Number.isFinite(n)) return { ok: false, error: `${def.name} needs a number from ${def.min} to ${def.max}.` };
      const clamped = Math.min(def.max, Math.max(def.min, n));
      const snapped = Math.round((clamped - def.min) / def.step) * def.step + def.min;
      return { ok: true, value: Number(snapped.toFixed(decimals(def.step))) };
    }
    case 'enum': {
      const v = String(raw).trim().toLowerCase();
      return def.options.includes(v) ? { ok: true, value: v } : { ok: false, error: `${def.name} accepts ${def.options.join(', ')}.` };
    }
    case 'color': {
      const hex = normalizeHex(String(raw));
      return hex ? { ok: true, value: hex } : { ok: false, error: `${def.name} needs a hex color, for example #1A1A1A.` };
    }
  }
}

export class TokenStore extends EventTarget {
  readonly #defs = new Map<string, TokenDef>();
  readonly #defaults = new Map<string, TokenValue>();
  readonly #values = new Map<string, TokenValue>();
  readonly #storageKey: string;
  #past: Snapshot[] = [];
  #future: Snapshot[] = [];
  #lastEdit = { name: '', at: 0 };

  constructor(overrides: TokenDefaults, storageKey: string) {
    super();
    this.#storageKey = storageKey;
    for (const def of TOKEN_DEFS) {
      this.#defs.set(def.name, def);
      const override = overrides[def.name];
      const result = override === undefined ? null : coerce(def, override);
      const value = result?.ok ? result.value : def.value;
      this.#defaults.set(def.name, value);
      this.#values.set(def.name, value);
    }
    const bad = failures(this.#trioOf(this.#defaults));
    if (bad[0]) console.warn(`Direction defaults break a gate: ${describeFailure(bad[0])}.`);
    this.#restore();
  }

  defs(): readonly TokenDef[] {
    return [...this.#defs.values()];
  }
  def(name: string): TokenDef | undefined {
    return this.#defs.get(name);
  }
  get(name: string): TokenValue {
    const v = this.#values.get(name);
    if (v === undefined) throw new Error(`Unknown token ${name}`);
    return v;
  }
  num(name: string): number {
    const v = this.get(name);
    if (typeof v !== 'number') throw new Error(`${name} is not a number token`);
    return v;
  }
  str(name: string): string {
    return String(this.get(name));
  }
  isDefault(name: string): boolean {
    return this.#values.get(name) === this.#defaults.get(name);
  }
  trio(): Trio {
    return this.#trioOf(this.#values);
  }
  defaultTrio(): Trio {
    return this.#trioOf(this.#defaults);
  }
  get canUndo(): boolean {
    return this.#past.length > 0;
  }
  get canRedo(): boolean {
    return this.#future.length > 0;
  }

  set(name: string, raw: TokenValue): SetResult {
    const def = this.#defs.get(name);
    if (!def) return { ok: false, error: `No token named ${name}.` };
    const result = coerce(def, raw);
    if (!result.ok) return result;
    const role = roleOf(name);
    if (role) {
      const candidate = { ...this.trio(), [role]: String(result.value) };
      const bad = failures(candidate);
      if (bad[0]) {
        const suggestion = nearestPassing(role, String(result.value), this.trio()) ?? undefined;
        const tail = suggestion ? ` Nearest passing: ${suggestion}.` : ' Change the other colors first.';
        return { ok: false, error: `Blocked: ${describeFailure(bad[0])}.${tail}`, ...(suggestion ? { suggestion } : {}) };
      }
    }
    const changed = this.#values.get(name) !== result.value;
    if (changed) {
      this.#record(name);
      this.#values.set(name, result.value);
      this.#commit(name, 'edit');
    }
    return { ok: true, value: result.value, changed };
  }

  /** Sets all three colors at once, so a dark-to-light switch never deadlocks on an intermediate state. */
  setColors(trio: Trio, source: ChangeSource = 'theme'): SetResult {
    const next: Record<ColorRole, string> = { ground: '', ink: '', signal: '' };
    for (const role of ['ground', 'ink', 'signal'] as const) {
      const hex = normalizeHex(trio[role]);
      if (!hex) return { ok: false, error: `${trio[role]} is not a hex color.` };
      next[role] = hex;
    }
    const bad = failures(next);
    if (bad[0]) return { ok: false, error: `Blocked: ${describeFailure(bad[0])}.` };
    this.#record(null);
    for (const role of ['ground', 'ink', 'signal'] as const) this.#values.set(`color.${role}`, next[role]);
    this.#commit('color.ground', source);
    return { ok: true, value: `${next.ground} ${next.ink} ${next.signal}`, changed: true };
  }

  step(name: string, dir: 1 | -1, big = false): SetResult {
    const def = this.#defs.get(name);
    if (!def) return { ok: false, error: `No token named ${name}.` };
    const current = this.get(name);
    switch (def.kind) {
      case 'number':
        return this.set(name, Number(current) + dir * def.step * (big ? 10 : 1));
      case 'enum': {
        const count = def.options.length;
        const index = def.options.indexOf(String(current));
        return this.set(name, def.options[(index + dir + count) % count] ?? def.value);
      }
      case 'color':
        return this.set(name, adjustLightness(String(current), dir * (big ? 10 : 2)));
    }
  }

  reset(name?: string): void {
    this.#record(null);
    for (const n of name === undefined ? [...this.#defs.keys()] : [name]) {
      const d = this.#defaults.get(n);
      if (d !== undefined) this.#values.set(n, d);
    }
    if (failures(this.trio()).length) for (const r of ['ground', 'ink', 'signal']) this.#values.set(`color.${r}`, this.#defaults.get(`color.${r}`) ?? '');
    this.#commit(name ?? null, 'reset');
  }

  undo(): boolean {
    return this.#travel(this.#past, this.#future, 'undo');
  }
  redo(): boolean {
    return this.#travel(this.#future, this.#past, 'redo');
  }

  onChange(listener: (change: TokenChange) => void): () => void {
    const handler = (e: Event): void => {
      if (e instanceof CustomEvent) listener(e.detail as TokenChange);
    };
    this.addEventListener('change', handler);
    return () => this.removeEventListener('change', handler);
  }

  #travel(from: Snapshot[], to: Snapshot[], source: 'undo' | 'redo'): boolean {
    const snap = from.pop();
    if (!snap) return false;
    to.push(new Map(this.#values));
    for (const [k, v] of snap) this.#values.set(k, v);
    this.#lastEdit = { name: '', at: 0 };
    this.#commit(null, source);
    return true;
  }

  /** Saves a snapshot before a change. Rapid edits to one token (a slider drag) share one undo step. */
  #record(name: string | null): void {
    const now = performance.now();
    const coalesce = name !== null && name === this.#lastEdit.name && now - this.#lastEdit.at < COALESCE_MS;
    this.#lastEdit = { name: name ?? '', at: now };
    if (coalesce) return;
    this.#past.push(new Map(this.#values));
    if (this.#past.length > HISTORY_LIMIT) this.#past.shift();
    this.#future = [];
  }

  #trioOf(map: ReadonlyMap<string, TokenValue>): Trio {
    const get = (r: ColorRole): string => String(map.get(`color.${r}`) ?? '');
    return { ground: get('ground'), ink: get('ink'), signal: get('signal') };
  }

  #commit(name: string | null, source: ChangeSource): void {
    try {
      localStorage.setItem(this.#storageKey, JSON.stringify(Object.fromEntries(this.#values)));
    } catch {
      /* Storage is optional. */
    }
    this.dispatchEvent(new CustomEvent<TokenChange>('change', { detail: { name, source } }));
  }

  #restore(): void {
    try {
      const raw = localStorage.getItem(this.#storageKey);
      const saved: unknown = raw ? JSON.parse(raw) : null;
      if (typeof saved !== 'object' || saved === null) return;
      for (const [name, value] of Object.entries(saved)) {
        const def = this.#defs.get(name);
        if (!def || (typeof value !== 'string' && typeof value !== 'number')) continue;
        const result = coerce(def, value);
        if (result.ok) this.#values.set(name, result.value);
      }
      if (failures(this.trio()).length) {
        for (const r of ['ground', 'ink', 'signal']) this.#values.set(`color.${r}`, this.#defaults.get(`color.${r}`) ?? '');
      }
    } catch {
      /* Storage is optional. */
    }
  }
}

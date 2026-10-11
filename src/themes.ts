/**
 * ThemeStore: three saved color sets per direction, kept in this browser only.
 * Each slot has a theme name and optional names for its colors. Copy that mentions
 * a color uses the active slot's name for it, and falls back to an automatic name.
 */
import { normalizeHex } from './color.js';
import { passes, type ColorRole, type Trio } from './gates.js';
import type { SetResult, TokenStore } from './tokens.js';

export const SLOT_COUNT = 3;
export const NAME_MAX = 24;
export type ColorNames = Readonly<Partial<Record<ColorRole, string>>>;
export interface ThemeSlot extends Trio {
  readonly name: string;
  readonly names: ColorNames;
}
export type Slot = ThemeSlot | null;

const ROLES: readonly ColorRole[] = ['ground', 'ink', 'signal'];
const sameTrio = (a: Trio, b: Trio): boolean => a.ground === b.ground && a.ink === b.ink && a.signal === b.signal;
export const defaultName = (i: number): string => `Theme ${i + 1}`;

export function cleanName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX) : '';
}

function cleanNames(value: unknown): ColorNames {
  const out: Partial<Record<ColorRole, string>> = {};
  if (typeof value !== 'object' || value === null) return out;
  const rec = value as Record<string, unknown>;
  for (const role of ROLES) {
    const name = cleanName(rec[role]);
    if (name) out[role] = name;
  }
  return out;
}

function parseSlot(value: unknown, i: number): Slot {
  if (typeof value !== 'object' || value === null) return null;
  const rec = value as Record<string, unknown>;
  const pick = (k: string): string | null => (typeof rec[k] === 'string' ? normalizeHex(rec[k]) : null);
  const ground = pick('ground');
  const ink = pick('ink');
  const signal = pick('signal');
  if (!ground || !ink || !signal || !passes({ ground, ink, signal })) return null;
  return { ground, ink, signal, name: cleanName(rec['name']) || defaultName(i), names: cleanNames(rec['names']) };
}

export class ThemeStore extends EventTarget {
  readonly #store: TokenStore;
  readonly #key: string;
  readonly #slots: Slot[] = Array.from({ length: SLOT_COUNT }, () => null);

  constructor(store: TokenStore, id: string) {
    super();
    this.#store = store;
    this.#key = `transit-themes:${id}`;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(this.#key) ?? 'null');
      if (Array.isArray(saved)) saved.slice(0, SLOT_COUNT).forEach((v, i) => { this.#slots[i] = parseSlot(v, i); });
    } catch {
      /* Storage is optional. */
    }
    store.onChange((c) => {
      if (c.name === null || c.name.startsWith('color.')) this.#emit();
    });
  }

  slots(): readonly Slot[] {
    return [...this.#slots];
  }

  /** Index of the slot matching the current colors, or -1. */
  active(): number {
    const now = this.#store.trio();
    return this.#slots.findIndex((s) => s !== null && sameTrio(s, now));
  }

  /** The active slot's own name for a color, if it has one. */
  colorName(role: ColorRole): string | null {
    const slot = this.#slots[this.active()];
    return slot?.names[role] ?? null;
  }

  /** Saves the current colors. Keeps the theme name, and keeps color names only for colors that did not change. */
  save(i: number): void {
    if (i < 0 || i >= SLOT_COUNT) return;
    const prev = this.#slots[i];
    const trio = this.#store.trio();
    const names: Partial<Record<ColorRole, string>> = {};
    for (const role of ROLES) {
      const kept = prev?.names[role];
      if (kept && prev[role] === trio[role]) names[role] = kept;
    }
    this.#slots[i] = { ...trio, name: prev?.name ?? defaultName(i), names };
    this.#persist();
  }

  /** Renames a slot and its colors. Empty strings fall back to the defaults. */
  rename(i: number, name: string, names: ColorNames = this.#slots[i]?.names ?? {}): SetResult {
    const slot = this.#slots[i];
    if (!slot) return { ok: false, error: `Theme ${i + 1} is empty. Save colors to it first.` };
    this.#slots[i] = { ...slot, name: cleanName(name) || defaultName(i), names: cleanNames(names) };
    this.#persist();
    return { ok: true, value: this.#slots[i]?.name ?? '', changed: true };
  }

  clear(i: number): void {
    if (i < 0 || i >= SLOT_COUNT) return;
    this.#slots[i] = null;
    this.#persist();
  }

  apply(i: number): SetResult {
    const slot = this.#slots[i];
    if (!slot) return { ok: false, error: `Theme ${i + 1} is empty.` };
    return this.#store.setColors(slot, 'theme');
  }

  /** Applies the next saved theme after the active one. Returns its index, or -1 if none are saved. */
  cycle(): number {
    const filled = this.#slots.map((s, i) => (s ? i : -1)).filter((i) => i >= 0);
    if (!filled.length) return -1;
    const current = this.active();
    const next = filled.find((i) => i > current) ?? filled[0] ?? -1;
    if (next >= 0) this.apply(next);
    return next;
  }

  onChange(listener: () => void): void {
    this.addEventListener('change', listener);
  }

  #persist(): void {
    try {
      localStorage.setItem(this.#key, JSON.stringify(this.#slots));
    } catch {
      /* Storage is optional. */
    }
    this.#emit();
  }

  #emit(): void {
    this.dispatchEvent(new Event('change'));
  }
}

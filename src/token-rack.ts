/** <token-rack>: a listbox of the non-color tokens, adjusted entirely from the keyboard. Colors live in <color-panel>. */
import { h, type Announce } from './dom.js';
import { GROUP_LABELS, formatValue, type TokenDef, type TokenGroup, type TokenStore } from './tokens.js';

interface RowRefs {
  readonly row: HTMLElement;
  readonly value: HTMLElement;
  readonly visual: HTMLElement;
}

const idFor = (name: string): string => `tok-${name.replace(/\./g, '-')}`;

export class TokenRack extends HTMLElement {
  #store: TokenStore | null = null;
  #unsubscribe: (() => void) | null = null;
  #announce: Announce = () => undefined;
  #index = 0;
  readonly #names: string[] = [];
  readonly #rows = new Map<string, RowRefs>();

  set store(store: TokenStore) {
    this.#unsubscribe?.();
    this.#store = store;
    this.#unsubscribe = store.onChange((c) => this.#update(c.name));
    this.#build();
  }
  set announce(fn: Announce) {
    this.#announce = fn;
  }
  get current(): string | undefined {
    return this.#names[this.#index];
  }

  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.setAttribute('role', 'listbox');
    this.setAttribute('aria-label', 'Design tokens');
    this.addEventListener('keydown', this.#onKey);
  }
  disconnectedCallback(): void {
    this.removeEventListener('keydown', this.#onKey);
  }

  select(name: string): void {
    const i = this.#names.indexOf(name);
    if (i >= 0) this.#select(i);
  }

  #build(): void {
    const st = this.#store;
    if (!st || this.#names.length) return;
    const groups = new Map<TokenGroup, TokenDef[]>();
    for (const def of st.defs()) if (def.kind !== 'color') groups.set(def.group, [...(groups.get(def.group) ?? []), def]);
    const frag = document.createDocumentFragment();
    for (const [group, defs] of groups) {
      const labelId = `rack-group-${group}`;
      const wrap = h('div', { role: 'group', 'aria-labelledby': labelId, class: 'rack-group' },
        h('div', { id: labelId, class: 'rack-group-label' }, GROUP_LABELS[group]));
      for (const def of defs) {
        wrap.append(this.#row(def));
        this.#names.push(def.name);
      }
      frag.append(wrap);
    }
    this.replaceChildren(frag);
    this.#update(null);
    this.#select(0);
  }

  #row(def: TokenDef): HTMLElement {
    const id = idFor(def.name);
    const value = h('span', { class: 'rack-value' });
    const visual = h('span', { class: `rack-visual rack-visual-${def.kind}`, 'aria-hidden': 'true' });
    if (def.kind === 'enum') visual.append(...def.options.map((o) => h('span', { class: 'opt', 'data-opt': o }, o)));
    if (def.kind === 'number') visual.append(h('span', { class: 'meter' }, h('span', { class: 'meter-fill' })));
    const stepper = (dir: 1 | -1, glyph: string): HTMLButtonElement => {
      const b = h('button', { type: 'button', tabindex: -1, class: 'rack-step', 'aria-hidden': 'true' }, glyph);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.select(def.name);
        this.#step(def.name, dir, e.shiftKey);
        this.focus();
      });
      return b;
    };
    const row = h('div', { role: 'option', id, class: 'rack-row', 'aria-selected': 'false', 'aria-describedby': `${id}-d` },
      h('span', { class: 'rack-name' }, def.name),
      value,
      h('span', { class: 'rack-steps' }, stepper(-1, '−'), stepper(1, '+')),
      visual,
      h('span', { id: `${id}-d`, class: 'rack-desc' }, def.description));
    row.addEventListener('click', () => {
      this.select(def.name);
      this.focus();
    });
    this.#rows.set(def.name, { row, value, visual });
    return row;
  }

  #update(name: string | null): void {
    const st = this.#store;
    if (!st) return;
    for (const n of name === null ? this.#names : [name]) {
      const refs = this.#rows.get(n);
      const def = st.def(n);
      if (!refs || !def) continue;
      const v = st.get(n);
      const text = formatValue(def, v);
      refs.value.textContent = text;
      refs.row.setAttribute('aria-label', `${def.name}, ${text}`);
      refs.row.classList.toggle('is-modified', !st.isDefault(n));
      if (def.kind === 'number') refs.visual.style.setProperty('--pct', String((Number(v) - def.min) / (def.max - def.min)));
      if (def.kind === 'enum') {
        for (const opt of refs.visual.querySelectorAll<HTMLElement>('.opt')) opt.classList.toggle('is-current', opt.dataset['opt'] === v);
      }
    }
  }

  #select(i: number): void {
    this.#index = Math.max(0, Math.min(this.#names.length - 1, i));
    const name = this.current;
    if (!name) return;
    for (const [n, refs] of this.#rows) refs.row.setAttribute('aria-selected', String(n === name));
    this.setAttribute('aria-activedescendant', idFor(name));
    if (this.contains(document.activeElement) || document.activeElement === this) this.#rows.get(name)?.row.scrollIntoView({ block: 'nearest' });
  }

  #step(name: string, dir: 1 | -1, big: boolean): void {
    const st = this.#store;
    const def = st?.def(name);
    if (!st || !def) return;
    const result = st.step(name, dir, big);
    if (!result.ok) return;
    const text = formatValue(def, result.value);
    this.#announce(result.changed ? `${name} ${text}` : `${name} is at its ${dir > 0 ? 'maximum' : 'minimum'}, ${text}.`);
  }

  readonly #onKey = (e: KeyboardEvent): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const name = this.current;
    const st = this.#store;
    const def = name ? st?.def(name) : undefined;
    if (!name || !st || !def) return;
    switch (e.key) {
      case 'ArrowDown': this.#select(this.#index + 1); break;
      case 'ArrowUp': this.#select(this.#index - 1); break;
      case 'Home': this.#select(0); break;
      case 'End': this.#select(this.#names.length - 1); break;
      case 'ArrowRight': case ']': case '}': this.#step(name, 1, e.shiftKey); break;
      case 'ArrowLeft': case '[': case '{': this.#step(name, -1, e.shiftKey); break;
      case 'Enter':
        if (def.kind !== 'enum') return;
        this.#step(name, 1, false);
        break;
      case '0':
        st.reset(name);
        this.#announce(`${name} reset to ${formatValue(def, st.get(name))}.`);
        break;
      default: return;
    }
    e.preventDefault();
  };
}

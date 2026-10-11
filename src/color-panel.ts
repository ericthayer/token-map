/** <color-panel>: the three color rows, one inline editor, and the theme manager. */
import { ColorEditor } from './color-editor.js';
import { h, type Announce } from './dom.js';
import { evaluate, ROLES, type ColorRole } from './gates.js';
import { ThemeSlots } from './theme-slots.js';
import type { ThemeStore } from './themes.js';
import type { TokenStore } from './tokens.js';

interface RowRefs {
  readonly button: HTMLButtonElement;
  readonly value: HTMLElement;
  readonly ratio: HTMLElement;
}

export class ColorPanel extends HTMLElement {
  #store: TokenStore | null = null;
  #open: ColorRole | null = null;
  readonly #rows = new Map<ColorRole, RowRefs>();
  readonly #editor = new ColorEditor();
  readonly #slots = new ThemeSlots();

  set store(store: TokenStore) {
    this.#store = store;
    this.#editor.store = store;
    store.onChange((c) => {
      if (c.name === null || c.name.startsWith('color.')) this.#update();
    });
    this.#update();
  }
  set themes(themes: ThemeStore) {
    this.#slots.themes = themes;
  }
  set announce(fn: Announce) {
    this.#slots.announce = fn;
  }

  connectedCallback(): void {
    if (this.childElementCount) return;
    this.#editor.id = 'color-editor';
    this.#editor.hidden = true;
    this.#editor.setAttribute('role', 'group');
    this.#editor.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !this.#open) return;
      e.preventDefault();
      e.stopPropagation();
      const role = this.#open;
      this.toggle(role);
      this.#rows.get(role)?.button.focus();
    });
    this.#slots.setAttribute('variant', 'full');
    this.#slots.setAttribute('aria-labelledby', 'themes-label');
    const list = h('div', { class: 'color-rows' });
    for (const role of ROLES) {
      const value = h('span', { class: 'rack-value' });
      const ratio = h('span', { class: 'color-ratio' });
      const button = h('button', { type: 'button', class: 'color-row', 'aria-expanded': 'false', 'aria-controls': 'color-editor' },
        h('span', { class: `swatch swatch-${role}`, 'aria-hidden': 'true' }),
        h('span', { class: 'rack-name' }, `color.${role}`),
        value,
        ratio);
      button.addEventListener('click', () => this.toggle(role));
      this.#rows.set(role, { button, value, ratio });
      list.append(button);
    }
    this.append(
      h('div', { class: 'rack-group' },
        h('div', { class: 'rack-group-label', id: 'color-label' }, 'Color'),
        list),
      h('div', { class: 'rack-group' },
        h('div', { class: 'rack-group-label', id: 'themes-label' }, 'Themes'),
        h('p', { class: 'panel-note' }, 'Save up to three color sets in this browser. Press C to cycle them.'),
        this.#slots),
    );
    this.#update();
  }

  /** Opens the editor under a row, or closes it if that row is already open. */
  toggle(role: ColorRole, focus = false): void {
    const closing = this.#open === role;
    this.#open = closing ? null : role;
    for (const [r, refs] of this.#rows) refs.button.setAttribute('aria-expanded', String(r === this.#open));
    if (closing) {
      this.#editor.hidden = true;
      return;
    }
    this.#rows.get(role)?.button.after(this.#editor);
    this.#editor.hidden = false;
    this.#editor.edit(role);
    if (focus) this.#editor.focusFirst();
  }

  #update(): void {
    const st = this.#store;
    if (!st || !this.#rows.size) return;
    const results = evaluate(st.trio()).filter((r) => r.rule.level === 'required');
    for (const [role, refs] of this.#rows) {
      const hex = st.str(`color.${role}`);
      refs.value.textContent = hex;
      const mine = results.filter((r) => r.rule.fg === role || r.rule.bg === role);
      const worst = mine.reduce((m, r) => Math.min(m, r.ratio), Infinity);
      refs.ratio.textContent = `${worst.toFixed(1)}:1`;
      refs.button.classList.toggle('is-modified', !st.isDefault(`color.${role}`));
      refs.button.setAttribute('aria-label', `color.${role}, ${hex}, lowest required contrast ${worst.toFixed(2)} to 1`);
    }
  }
}

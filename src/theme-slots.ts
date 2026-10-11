/**
 * <theme-slots variant="compact|full">: quick switcher in the masthead, full manager in the Color panel.
 * The full manager can name a theme and its colors. Color names left blank use automatic names.
 */
import { colorName } from './color-names.js';
import { h, type Announce } from './dom.js';
import type { ColorRole, Trio } from './gates.js';
import { NAME_MAX, SLOT_COUNT, type ColorNames, type ThemeSlot, type ThemeStore } from './themes.js';

const ROLES: readonly ColorRole[] = ['ground', 'ink', 'signal'];
const LABEL: Readonly<Record<ColorRole, string>> = { ground: 'Ground', ink: 'Ink', signal: 'Signal' };
interface Draft {
  name: string;
  names: Partial<Record<ColorRole, string>>;
}

function triSwatch(trio: Trio): HTMLElement {
  const el = h('span', { class: 'tri', 'aria-hidden': 'true' });
  for (const role of ROLES) {
    const chip = h('span', { class: `tri-${role}` });
    chip.style.setProperty('--sw', trio[role]);
    el.append(chip);
  }
  return el;
}

const nameOf = (slot: ThemeSlot, role: ColorRole): string => slot.names[role] ?? colorName(slot[role]);
const describe = (s: ThemeSlot): string => `${s.name}: ${ROLES.map((r) => `${r} ${nameOf(s, r)} ${s[r]}`).join(', ')}`;

export class ThemeSlots extends HTMLElement {
  #themes: ThemeStore | null = null;
  #announce: Announce = () => undefined;
  #editing = -1;
  #draft: Draft = { name: '', names: {} };

  set themes(themes: ThemeStore) {
    this.#themes = themes;
    themes.onChange(() => this.#render());
    this.#render();
  }
  set announce(fn: Announce) {
    this.#announce = fn;
  }

  get #full(): boolean {
    return this.getAttribute('variant') === 'full';
  }

  connectedCallback(): void {
    this.setAttribute('role', 'group');
    if (!this.hasAttribute('aria-label') && !this.hasAttribute('aria-labelledby')) this.setAttribute('aria-label', 'Saved themes');
  }

  #apply(i: number): void {
    const result = this.#themes?.apply(i);
    const slot = this.#themes?.slots()[i];
    if (result) this.#announce(result.ok ? `${slot?.name ?? `Theme ${i + 1}`} applied.` : result.error);
  }

  #save(i: number): void {
    this.#themes?.save(i);
    this.#announce(`Current colors saved as ${this.#themes?.slots()[i]?.name ?? `theme ${i + 1}`}.`);
  }

  #startEdit(i: number): void {
    const slot = this.#themes?.slots()[i];
    if (!slot) return;
    this.#editing = i;
    this.#draft = { name: slot.name, names: { ...slot.names } };
    this.#render();
    this.querySelector<HTMLInputElement>('#tn-name')?.select();
  }

  #endEdit(i: number, commit: boolean): void {
    const themes = this.#themes;
    this.#editing = -1;
    if (commit && themes) {
      const result = themes.rename(i, this.#draft.name, this.#draft.names as ColorNames);
      this.#announce(result.ok ? `Theme ${i + 1} named ${String(result.value)}.` : result.error);
    }
    this.#render();
    this.querySelector<HTMLElement>(`[data-key="${i}:Rename"]`)?.focus();
  }

  #form(i: number, slot: ThemeSlot): HTMLFormElement {
    const field = (id: string, label: Node | string, value: string, placeholder: string, set: (v: string) => void): HTMLElement => {
      const input = h('input', { id, value, placeholder, maxlength: NAME_MAX, autocomplete: 'off', spellcheck: 'false' });
      input.addEventListener('input', () => set(input.value));
      return h('div', { class: 'tn-field' }, h('label', { for: id }, label), input);
    };
    const swatchLabel = (role: ColorRole): HTMLElement => {
      const chip = h('span', { class: 'tn-chip', 'aria-hidden': 'true' });
      chip.style.setProperty('--sw', slot[role]);
      return h('span', { class: 'tn-label' }, chip, `${LABEL[role]} name`);
    };
    const cancel = h('button', { type: 'button', class: 'theme-act' }, 'Cancel');
    cancel.addEventListener('click', () => this.#endEdit(i, false));
    const form = h('form', { class: 'theme-form', 'aria-label': `Name theme ${i + 1}` },
      field('tn-name', 'Theme name', this.#draft.name, `Theme ${i + 1}`, (v) => { this.#draft.name = v; }),
      h('fieldset', { class: 'tn-colors' },
        h('legend', {}, 'Color names. Leave blank for automatic.'),
        ...ROLES.map((role) => field(`tn-${role}`, swatchLabel(role), this.#draft.names[role] ?? '', colorName(slot[role]), (v) => { this.#draft.names[role] = v; }))),
      h('div', { class: 'theme-acts' }, h('button', { type: 'submit', class: 'theme-act' }, 'Save names'), cancel));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.#endEdit(i, true);
    });
    form.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      this.#endEdit(i, false);
    });
    return form;
  }

  #render(): void {
    const themes = this.#themes;
    if (!themes) return;
    const slots = themes.slots();
    const active = themes.active();
    const focused = document.activeElement instanceof HTMLElement && this.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused?.dataset['key'] ?? (focused?.id ? `#${focused.id}` : undefined);
    const refocus = (): void => {
      if (!focusKey) return;
      if (focusKey.startsWith('#')) {
        this.querySelector<HTMLElement>(focusKey)?.focus();
        return;
      }
      const slot = focusKey.split(':')[0] ?? '';
      (this.querySelector<HTMLElement>(`[data-key="${focusKey}"]`) ?? this.querySelector<HTMLElement>(`[data-key^="${slot}:"]`))?.focus();
    };
    if (!this.#full) {
      this.replaceChildren(...slots.map((slot, i) => {
        const b = h('button', { type: 'button', class: `slot${slot ? '' : ' is-empty'}`, 'data-key': `${i}:slot` });
        if (slot) {
          b.setAttribute('aria-pressed', String(i === active));
          b.setAttribute('aria-label', describe(slot));
          b.append(triSwatch(slot), h('span', { class: 'slot-n', 'aria-hidden': 'true' }, String(i + 1)));
          b.addEventListener('click', () => this.#apply(i));
        } else {
          b.setAttribute('aria-label', `Save current colors as theme ${i + 1}`);
          b.append(h('span', { class: 'slot-plus', 'aria-hidden': 'true' }, '+'), h('span', { class: 'slot-n', 'aria-hidden': 'true' }, String(i + 1)));
          b.addEventListener('click', () => this.#save(i));
        }
        b.title = slot ? slot.name : (b.getAttribute('aria-label') ?? '');
        return b;
      }));
      refocus();
      return;
    }
    const list = h('ol', { class: 'theme-list' });
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = slots[i] ?? null;
      if (slot && i === this.#editing) {
        list.append(h('li', { class: 'theme-row is-editing' }, triSwatch(slot), this.#form(i, slot)));
        continue;
      }
      const act = (label: string, aria: string, fn: () => void): HTMLButtonElement => {
        const b = h('button', { type: 'button', class: 'theme-act', 'aria-label': aria, 'data-key': `${i}:${label}` }, label);
        b.addEventListener('click', fn);
        return b;
      };
      const title = slot?.name ?? `Theme ${i + 1}`;
      const name = h('span', { class: 'theme-name' }, title,
        i === active ? h('span', { class: 'theme-on' }, ' in use') : '',
        slot ? h('span', { class: 'theme-colors' }, ROLES.map((r) => nameOf(slot, r)).join(', ')) : '');
      list.append(h('li', { class: `theme-row${slot ? '' : ' is-empty'}` },
        slot ? triSwatch(slot) : h('span', { class: 'tri tri-empty', 'aria-hidden': 'true' }),
        name,
        h('span', { class: 'theme-acts' },
          ...(slot ? [act('Apply', `Apply ${title}`, () => this.#apply(i)), act('Rename', `Rename ${title}`, () => this.#startEdit(i))] : []),
          act(slot ? 'Replace' : 'Save current', `${slot ? `Replace ${title} with` : 'Save'} current colors${slot ? '' : ` as theme ${i + 1}`}`, () => this.#save(i)),
          ...(slot ? [act('Clear', `Clear ${title}`, () => { themes.clear(i); this.#announce(`${title} cleared.`); })] : []))));
    }
    this.replaceChildren(list);
    refocus();
  }
}

/**
 * <color-editor>: hue, saturation and lightness sliders plus a hex field for one color role.
 * Passing values apply live. Failing values are shown but never applied, and the slider
 * tracks shade the ranges that would fail.
 */
import { hexToHsl, hslToHex, type HslColor } from './color.js';
import { h } from './dom.js';
import { CHANNEL_MAX, channelPassMap, failures, rangeText, type ColorRole, type HslChannel } from './gates.js';
import type { TokenStore } from './tokens.js';

const CHANNELS: readonly { readonly key: HslChannel; readonly label: string; readonly unit: string }[] = [
  { key: 'h', label: 'Hue', unit: '°' },
  { key: 's', label: 'Saturation', unit: '%' },
  { key: 'l', label: 'Lightness', unit: '%' },
];

interface ChannelRefs {
  readonly input: HTMLInputElement;
  readonly out: HTMLOutputElement;
  readonly pass: HTMLElement;
}

function trackGradient(hsl: HslColor, ch: HslChannel): string {
  const stops: string[] = [];
  const n = ch === 'h' ? 12 : 6;
  for (let i = 0; i <= n; i++) stops.push(hslToHex({ ...hsl, [ch]: (i / n) * CHANNEL_MAX[ch] }));
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function failMask(map: readonly boolean[]): string {
  const seg = 100 / map.length;
  const veil = 'var(--ce-veil)';
  const stops = map.map((ok, i) => `${ok ? 'transparent' : veil} ${(i * seg).toFixed(2)}% ${((i + 1) * seg).toFixed(2)}%`);
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

export class ColorEditor extends HTMLElement {
  #store: TokenStore | null = null;
  #role: ColorRole = 'ground';
  #hsl: HslColor = { h: 0, s: 0, l: 0 };
  readonly #channels = new Map<HslChannel, ChannelRefs>();
  readonly #swatch = h('span', { class: 'ce-swatch', 'aria-hidden': 'true' });
  readonly #hex = h('input', { id: 'ce-hex', class: 'ce-hex', spellcheck: 'false', autocomplete: 'off', maxlength: 7, 'aria-describedby': 'ce-status' });
  readonly #status = h('p', { id: 'ce-status', class: 'ce-status', 'aria-live': 'polite' });
  readonly #snap = h('button', { type: 'button', class: 'ce-snap', hidden: true });
  #snapValue = '';
  /** Exact hex from the hex field or the store, kept so HSL rounding never alters a typed value. */
  #exact: string | null = null;

  set store(store: TokenStore) {
    this.#store = store;
    store.onChange((c) => {
      if (this.hidden || !(c.name === null || c.name.startsWith('color.'))) return;
      const current = store.str(`color.${this.#role}`);
      if (hslToHex(this.#hsl) !== current && this.#exact !== current) {
        this.#hsl = hexToHsl(current);
        this.#exact = current;
      }
      this.#sync(false);
    });
  }

  connectedCallback(): void {
    if (this.childElementCount) return;
    const fields = CHANNELS.map(({ key, label, unit }) => {
      const id = `ce-${key}`;
      const input = h('input', { type: 'range', id, min: 0, max: CHANNEL_MAX[key], step: 1, 'aria-describedby': `${id}-pass` });
      const out = h('output', { for: id, class: 'ce-out' });
      const pass = h('span', { id: `${id}-pass`, class: 'sr-only' });
      input.addEventListener('input', () => {
        this.#hsl = { ...this.#hsl, [key]: Number(input.value) };
        this.#exact = null;
        this.#commit();
      });
      out.dataset['unit'] = unit;
      this.#channels.set(key, { input, out, pass });
      return h('div', { class: 'ce-ch' }, h('label', { for: id }, label), out, input, pass);
    });
    this.#hex.addEventListener('change', () => this.#fromHex());
    this.#hex.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.#fromHex();
      }
    });
    this.#snap.addEventListener('click', () => {
      this.#hsl = hexToHsl(this.#snapValue);
      this.#exact = this.#snapValue;
      this.#commit();
      this.#channels.get('l')?.input.focus();
    });
    this.append(
      h('div', { class: 'ce-head' }, this.#swatch, h('label', { for: 'ce-hex', class: 'ce-hex-label' }, 'Hex'), this.#hex),
      ...fields,
      this.#status,
      this.#snap,
    );
  }

  /** Points the editor at a role and loads its current value. */
  edit(role: ColorRole): void {
    this.#role = role;
    this.setAttribute('aria-label', `Edit color.${role}`);
    if (this.#store) {
      this.#exact = this.#store.str(`color.${role}`);
      this.#hsl = hexToHsl(this.#exact);
    }
    this.#sync(true);
  }

  focusFirst(): void {
    this.#channels.get('l')?.input.focus();
  }

  #fromHex(): void {
    const raw = this.#hex.value.trim();
    const value = raw.startsWith('#') ? raw : `#${raw}`;
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
      this.#setStatus(`${raw || 'That'} is not a hex color. Use six digits, for example #1A1A1A.`, 'error');
      return;
    }
    this.#exact = value.toUpperCase();
    this.#hsl = hexToHsl(this.#exact);
    this.#commit();
  }

  #commit(): void {
    const st = this.#store;
    if (!st) return;
    const hex = this.#exact ?? hslToHex(this.#hsl);
    const result = st.set(`color.${this.#role}`, hex);
    this.#sync(false);
    if (result.ok) {
      this.#snap.hidden = true;
      if (this.#status.dataset['state'] === 'error') this.#setStatus(`Applied ${hex}.`, 'ok');
      return;
    }
    this.#snapValue = result.suggestion ?? '';
    this.#snap.hidden = !result.suggestion;
    this.#snap.textContent = `Use nearest passing ${this.#snapValue}`;
    const why = failures({ ...st.trio(), [this.#role]: hex })[0];
    // Rule-level text stays the same through a drag, so the live region speaks once, not on every step.
    this.#setStatus(why ? `Not applied: ${why.rule.fg} on ${why.rule.bg} needs ${why.rule.min}:1.` : result.error, 'error');
  }

  #setStatus(text: string, state: 'ok' | 'error'): void {
    if (this.#status.textContent !== text) this.#status.textContent = text;
    this.#status.dataset['state'] = state;
    this.classList.toggle('is-blocked', state === 'error');
  }

  #sync(clearStatus: boolean): void {
    const st = this.#store;
    if (!st) return;
    const trio = st.trio();
    const hex = this.#exact ?? hslToHex(this.#hsl);
    this.#swatch.style.setProperty('--sw', hex);
    if (document.activeElement !== this.#hex) this.#hex.value = hex;
    for (const { key, unit } of CHANNELS) {
      const refs = this.#channels.get(key);
      if (!refs) continue;
      refs.input.value = String(Math.round(this.#hsl[key]));
      refs.out.value = `${Math.round(this.#hsl[key])}${unit}`;
      const map = channelPassMap(this.#role, this.#hsl, key, trio);
      refs.input.style.setProperty('--track', trackGradient(this.#hsl, key));
      refs.input.style.setProperty('--mask', failMask(map));
      refs.pass.textContent = `Passing ${CHANNELS.find((c) => c.key === key)?.label.toLowerCase() ?? key}: ${rangeText(map, CHANNEL_MAX[key])}`;
    }
    if (clearStatus) {
      this.#snap.hidden = true;
      this.#status.textContent = 'Shaded parts of each track would fail a contrast gate.';
      this.#status.dataset['state'] = 'ok';
      this.classList.remove('is-blocked');
    }
  }
}

/** <contrast-panel>: live gate status for the three color pairs. Required gates can never show a failure. */
import { h } from './dom.js';
import { evaluate } from './gates.js';
import type { TokenStore } from './tokens.js';

export class ContrastPanel extends HTMLElement {
  #store: TokenStore | null = null;

  set store(store: TokenStore) {
    this.#store = store;
    store.onChange((c) => {
      if (c.name === null || c.name.startsWith('color.')) this.#render();
    });
    this.#render();
  }

  #render(): void {
    const st = this.#store;
    if (!st) return;
    const rows = evaluate(st.trio()).map(({ rule, ratio, pass }) => {
      const verdict = pass ? 'Pass' : rule.level === 'advisory' ? 'Below' : 'Fail';
      return h('tr', { class: `${pass ? 'is-pass' : 'is-fail'} is-${rule.level}` },
        h('th', { scope: 'row' },
          h('span', { class: 'pair', 'aria-hidden': 'true' }, h('span', { class: `swatch swatch-${rule.fg}` }), h('span', { class: `swatch swatch-${rule.bg}` })),
          h('span', { class: 'pair-name' }, `${rule.fg} on ${rule.bg}`),
          h('span', { class: 'pair-use' }, rule.use)),
        h('td', { class: 'num' }, `${ratio.toFixed(2)}:1`),
        h('td', {}, `${verdict} ${rule.min}:1`, h('span', { class: 'gate-level' }, rule.level === 'required' ? 'Gate' : 'Advisory')));
    });
    this.replaceChildren(h('table', { class: 'contrast' },
      h('caption', {}, 'Contrast gates, WCAG 2.2'),
      h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Pair'), h('th', { scope: 'col' }, 'Ratio'), h('th', { scope: 'col' }, 'Needs'))),
      h('tbody', {}, ...rows)));
  }
}

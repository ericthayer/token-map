/** <map-legend>: line key that doubles as an isolation toolbar. One tab stop, arrow keys move between lines. */
import { h, s } from './dom.js';
import { strokeFor } from './geometry.js';
import { LINES } from './network.js';
import type { TokenStore } from './tokens.js';
import type { TransitMap } from './transit-map.js';

interface ItemRefs {
  readonly button: HTMLButtonElement;
  readonly swatch: SVGSVGElement;
}

export class MapLegend extends HTMLElement {
  #store: TokenStore | null = null;
  #map: TransitMap | null = null;
  #index = 0;
  readonly #items: ItemRefs[] = [];

  set store(store: TokenStore) {
    this.#store = store;
    store.onChange(() => this.#update());
    this.#update();
  }
  set map(map: TransitMap) {
    this.#map = map;
    map.addEventListener('mapstate', () => this.#update());
    this.#update();
  }

  connectedCallback(): void {
    if (this.#items.length) return;
    this.setAttribute('role', 'toolbar');
    this.setAttribute('aria-label', 'Lines. Press a line to show only that line.');
    for (const [i, line] of LINES.entries()) {
      const swatch = s('svg', { class: 'legend-swatch', viewBox: '0 0 44 16', width: 44, height: 16, 'aria-hidden': 'true' });
      const button = h('button', { type: 'button', class: `legend-btn line line-${line.n}`, tabindex: i === 0 ? 0 : -1, 'aria-pressed': 'false' },
        h('kbd', { 'aria-hidden': 'true' }, String(line.n)), swatch, h('span', {}, line.name));
      button.setAttribute('aria-label', `Line ${line.n}, ${line.name}`);
      button.addEventListener('click', () => {
        this.#index = i;
        this.#map?.toggleLine(line.n);
      });
      this.#items.push({ button, swatch });
    }
    this.addEventListener('keydown', (e) => {
      const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
      const jump = e.key === 'Home' ? 0 : e.key === 'End' ? this.#items.length - 1 : -1;
      if (!delta && jump < 0) return;
      e.preventDefault();
      this.#index = jump >= 0 ? jump : (this.#index + delta + this.#items.length) % this.#items.length;
      this.#items.forEach((it, i) => { it.button.tabIndex = i === this.#index ? 0 : -1; });
      this.#items[this.#index]?.button.focus();
    });
    this.append(...this.#items.map((it) => h('span', { class: 'legend-item' }, it.button)));
    this.#update();
  }

  #update(): void {
    const st = this.#store;
    if (!st || !this.#items.length) return;
    const w = Math.min(st.num('stroke.line'), 8);
    const isolated = this.#map?.isolated ?? new Set<number>();
    LINES.forEach((line, i) => {
      const item = this.#items[i];
      if (!item) return;
      const spec = strokeFor(line.pattern, w, st.num('stroke.dash'), st.num('stroke.gap'));
      const ink = s('path', { d: 'M2 8H42', class: 'line-ink', 'stroke-width': spec.width, 'stroke-dasharray': spec.dasharray, 'stroke-linecap': spec.linecap });
      item.swatch.replaceChildren(ink, ...(spec.core !== null ? [s('path', { d: 'M2 8H42', class: 'line-core', 'stroke-width': spec.core })] : []));
      const on = isolated.has(line.n);
      item.button.setAttribute('aria-pressed', String(on));
      item.button.classList.toggle('is-on', on);
    });
  }
}

/** <map-readout>: status bar for the selected station, with a pin toggle for pointer and touch users. */
import { h } from './dom.js';
import { STATIONS, gridRef, linesAt } from './network.js';
import type { TransitMap } from './transit-map.js';

export class MapReadout extends HTMLElement {
  #map: TransitMap | null = null;
  readonly #dl = h('dl', { class: 'map-readout' });
  readonly #values = {
    station: h('dd', {}),
    grid: h('dd', {}),
    lines: h('dd', {}),
    pinned: h('dd', {}),
  };
  readonly #pin = h('button', { type: 'button', class: 'pin-btn', 'aria-pressed': 'false' }, 'Pin');

  set map(map: TransitMap) {
    this.#map = map;
    map.addEventListener('mapstate', () => this.#update());
    this.#update();
  }

  connectedCallback(): void {
    if (this.#dl.isConnected) return;
    const row = (label: string, dd: HTMLElement, extra?: HTMLElement): HTMLElement =>
      h('div', { class: `ro-${label.toLowerCase()}` }, h('dt', {}, label), dd, ...(extra ? [extra] : []));
    this.#dl.append(
      row('Station', this.#values.station),
      row('Grid', this.#values.grid),
      row('Lines', this.#values.lines),
      row('Pinned', this.#values.pinned),
    );
    this.#pin.addEventListener('click', () => this.#map?.togglePin());
    this.append(this.#dl, this.#pin);
    this.#update();
  }

  #update(): void {
    const map = this.#map;
    if (!map || !this.#dl.isConnected) return;
    const st = map.focused;
    const pinned = STATIONS.filter((x) => map.pinned.has(x.id)).map((x) => x.name);
    this.#values.station.textContent = st.name;
    this.#values.grid.textContent = gridRef(st);
    this.#values.lines.textContent = linesAt(st.id).map((l) => `${l.n} ${l.name}`).join(', ');
    this.#values.pinned.textContent = pinned.length ? pinned.join(', ') : 'None yet';
    const on = map.pinned.has(st.id);
    this.#pin.setAttribute('aria-pressed', String(on));
    this.#pin.textContent = on ? `Unpin ${st.name}` : `Pin ${st.name}`;
  }
}

/** <zoom-control>: −, current zoom, +, and Fit for the map. */
import { h } from './dom.js';
import type { MapZoom, TransitMap } from './transit-map.js';

export class ZoomControl extends HTMLElement {
  #map: TransitMap | null = null;
  readonly #out = h('output', { class: 'zoom-value', 'aria-live': 'off' }, '100%');
  readonly #minus = h('button', { type: 'button', class: 'zoom-btn', 'aria-label': 'Zoom out', title: 'Zoom out (−)' }, '−');
  readonly #plus = h('button', { type: 'button', class: 'zoom-btn', 'aria-label': 'Zoom in', title: 'Zoom in (+)' }, '+');
  readonly #fit = h('button', { type: 'button', class: 'zoom-fit', 'aria-pressed': 'true', title: 'Fit to view (F)' }, 'Fit');

  set map(map: TransitMap) {
    this.#map = map;
    map.addEventListener('mapzoom', (e) => {
      if (e instanceof CustomEvent) this.#update(e.detail as MapZoom);
    });
    this.#update(map.zoom);
  }

  connectedCallback(): void {
    if (this.#out.isConnected) return;
    this.setAttribute('role', 'group');
    this.setAttribute('aria-label', 'Zoom');
    this.#minus.addEventListener('click', () => this.#map?.zoomOut());
    this.#plus.addEventListener('click', () => this.#map?.zoomIn());
    this.#fit.addEventListener('click', () => this.#map?.fitView());
    this.append(this.#minus, this.#out, this.#plus, this.#fit);
  }

  #update(z: MapZoom): void {
    this.#out.value = `${Math.round(z.scale * 100)}%`;
    this.#minus.setAttribute('aria-disabled', String(z.scale <= z.min + 0.001));
    this.#plus.setAttribute('aria-disabled', String(z.scale >= z.max - 0.001));
    this.#fit.setAttribute('aria-pressed', String(z.fit));
  }
}

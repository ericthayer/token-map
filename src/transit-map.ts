/** <transit-map>: draws the network in its own scroll container; owns focus, pins, isolation and zoom. Emits `mapstate` and `mapzoom`. */
import { h, listJoin, rafBatch, s, type Announce } from './dom.js';
import { geometry } from './geometry.js';
import { chipFocusedLabel, focusMark, gridLayer, lineGroup, readTokens, stationGroup, type RenderCtx } from './map-render.js';
import { LINES, NETWORK_NAME, STATIONS, gridRef, linesAt, neighbors, station, type LineNumber, type Station } from './network.js';
import type { TokenStore } from './tokens.js';

export interface MapZoom {
  readonly scale: number;
  readonly fit: boolean;
  readonly min: number;
  readonly max: number;
}

const MIN_LABEL_PX = 10;
const MAX_SCALE = 3;
const FIT_MAX = 2.5;
const ZOOM_STEP = 1.25;
const ARROWS: Readonly<Record<string, { readonly x: number; readonly y: number; readonly word: string }>> = {
  ArrowUp: { x: 0, y: -1, word: 'north' },
  ArrowDown: { x: 0, y: 1, word: 'south' },
  ArrowLeft: { x: -1, y: 0, word: 'west' },
  ArrowRight: { x: 1, y: 0, word: 'east' },
};
const LINE_KEYS: Readonly<Record<string, LineNumber>> = { '1': 1, '2': 2, '3': 3, '4': 4 };
const coarse = matchMedia('(pointer: coarse)');

export class TransitMap extends HTMLElement {
  #store: TokenStore | null = null;
  #announce: Announce = () => undefined;
  #focused = 'x';
  #lampTest = false;
  #scrollOnRender = true;
  #firstScroll = true;
  #fit = true;
  #manual = 1;
  #scale = 1;
  #drag: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
  readonly #pinned = new Set<string>();
  readonly #isolated = new Set<LineNumber>();
  readonly #svg = s('svg', { class: 'map-svg', role: 'img', 'aria-labelledby': 'map-svg-title' });
  readonly #scroller = h('div', { class: 'map-scroller' });
  readonly #schedule = rafBatch(() => this.#render());
  readonly #resize = new ResizeObserver(() => {
    this.#scrollOnRender = true;
    this.#applyZoom(null);
    this.#schedule();
  });

  set store(store: TokenStore) {
    this.#store = store;
    store.onChange(() => this.#schedule());
    this.#schedule();
  }
  set announce(fn: Announce) {
    this.#announce = fn;
  }
  get focused(): Station {
    return station(this.#focused);
  }
  get pinned(): ReadonlySet<string> {
    return this.#pinned;
  }
  get isolated(): ReadonlySet<LineNumber> {
    return this.#isolated;
  }
  get zoom(): MapZoom {
    return { scale: this.#scale, fit: this.#fit, min: this.#minScale(), max: MAX_SCALE };
  }

  connectedCallback(): void {
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    this.setAttribute('role', 'application');
    this.setAttribute('aria-roledescription', 'transit map');
    this.setAttribute('aria-label', `${NETWORK_NAME} transit map`);
    if (!this.#scroller.isConnected) {
      this.#scroller.append(this.#svg);
      this.append(this.#scroller);
      this.#scroller.addEventListener('click', this.#onClick);
      this.#scroller.addEventListener('pointerdown', this.#onPointerDown);
      this.#scroller.addEventListener('wheel', this.#onWheel, { passive: false });
    }
    this.addEventListener('keydown', this.#onKey);
    this.#resize.observe(this.#scroller);
    this.#schedule();
  }

  disconnectedCallback(): void {
    this.removeEventListener('keydown', this.#onKey);
    this.#resize.disconnect();
  }

  select(id: string, announce = true): void {
    this.#focused = id;
    this.#scrollOnRender = true;
    if (announce) this.#announce(this.#describe(station(id)));
    this.#schedule();
  }

  togglePin(): void {
    const id = this.#focused;
    const was = this.#pinned.delete(id);
    if (!was) this.#pinned.add(id);
    this.#announce(`${station(id).name} ${was ? 'unpinned' : 'pinned'}.`);
    this.#schedule();
  }

  toggleLine(n: LineNumber): void {
    if (!this.#isolated.delete(n)) this.#isolated.add(n);
    const shown = [...this.#isolated].sort().map(String);
    this.#announce(shown.length ? `Showing line${shown.length > 1 ? 's' : ''} ${listJoin(shown)}.` : 'Showing all lines.');
    this.#schedule();
  }

  clearIsolation(): void {
    this.#isolated.clear();
    this.#announce('Showing all lines.');
    this.#schedule();
  }

  /** Lights every line briefly, like the lamp-test switch on a control panel. */
  lampTest(ms = 900): void {
    this.#lampTest = true;
    this.#announce('Lamp test.');
    this.#schedule();
    window.setTimeout(() => {
      this.#lampTest = false;
      this.#schedule();
    }, ms);
  }

  zoomBy(factor: number, anchor: { x: number; y: number } | null = null): void {
    this.#fit = false;
    this.#manual = this.#scale * factor;
    this.#applyZoom(anchor);
    this.#announce(`Zoom ${Math.round(this.#scale * 100)}%.`);
  }
  zoomIn(): void { this.zoomBy(ZOOM_STEP); }
  zoomOut(): void { this.zoomBy(1 / ZOOM_STEP); }
  fitView(): void {
    this.#fit = true;
    this.#applyZoom(null);
    this.#announce(`Fit to view, ${Math.round(this.#scale * 100)}%.`);
  }

  readonly #onKey = (e: KeyboardEvent): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const arrow = ARROWS[e.key];
    const line = LINE_KEYS[e.key];
    if (arrow) this.#move(arrow, arrow.word);
    else if (line) this.toggleLine(line);
    else if (e.key === 'Enter' || e.key === ' ') this.togglePin();
    else if (e.key === '0') this.clearIsolation();
    else return;
    e.preventDefault();
  };

  readonly #onClick = (e: MouseEvent): void => {
    if (this.#drag?.moved) return;
    const target = e.target instanceof Element ? e.target.closest<SVGGElement>('[data-station]') : null;
    const id = target?.dataset['station'];
    if (!id) return;
    this.focus({ preventScroll: true });
    if (id === this.#focused) this.togglePin();
    else this.select(id);
  };

  /** Mouse drag pans the map when it overflows. Touch keeps native scrolling. */
  readonly #onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const sc = this.#scroller;
    if (sc.scrollWidth <= sc.clientWidth && sc.scrollHeight <= sc.clientHeight) return;
    this.#drag = { x: e.clientX, y: e.clientY, left: sc.scrollLeft, top: sc.scrollTop, moved: false };
    const move = (ev: PointerEvent): void => {
      const d = this.#drag;
      if (!d) return;
      const dx = ev.clientX - d.x;
      const dy = ev.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      sc.classList.add('is-panning');
      sc.scrollLeft = d.left - dx;
      sc.scrollTop = d.top - dy;
    };
    const up = (): void => {
      sc.classList.remove('is-panning');
      window.removeEventListener('pointermove', move);
      window.setTimeout(() => { this.#drag = null; }, 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up, { once: true });
  };

  readonly #onWheel = (e: WheelEvent): void => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const box = this.#scroller.getBoundingClientRect();
    this.zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, { x: e.clientX - box.left, y: e.clientY - box.top });
  };

  #move(dir: { x: number; y: number }, word: string): void {
    const cur = station(this.#focused);
    const best = (ids: readonly string[], minCos: number): string | null => {
      let pick: string | null = null;
      let top = -Infinity;
      for (const id of ids) {
        if (id === cur.id) continue;
        const st = station(id);
        const vx = st.x - cur.x;
        const vy = st.y - cur.y;
        const dist = Math.hypot(vx, vy);
        const cos = (vx * dir.x + vy * dir.y) / dist;
        const score = cos * 3 - dist * 0.25;
        if (cos >= minCos && score > top) {
          top = score;
          pick = id;
        }
      }
      return pick;
    };
    const next = best(neighbors(cur.id), 0.38) ?? best(STATIONS.map((st) => st.id), 0.5);
    if (next) this.select(next);
    else this.#announce(`No station further ${word} of ${cur.name}.`);
  }

  #describe(st: Station): string {
    const nums = linesAt(st.id).map((l) => String(l.n));
    const pinned = this.#pinned.has(st.id) ? ', pinned' : '';
    return `${st.name}, grid ${gridRef(st)}, line${nums.length > 1 ? 's' : ''} ${listJoin(nums)}${pinned}.`;
  }

  #minScale(): number {
    return this.#store ? Math.min(1, MIN_LABEL_PX / this.#store.num('label.size')) : 1;
  }

  /** Sizes the SVG for the current zoom. Keeps the anchor point (default: viewport center) still. */
  #applyZoom(anchor: { x: number; y: number } | null): void {
    const st = this.#store;
    if (!st) return;
    const geo = geometry(st.num('grid.unit'));
    const sc = this.#scroller;
    const vw = sc.clientWidth;
    const vh = sc.clientHeight;
    if (!vw || !vh) return;
    const min = this.#minScale();
    const fit = Math.min(vw / geo.width, vh / geo.height);
    const next = Math.min(this.#fit ? FIT_MAX : MAX_SCALE, Math.max(min, this.#fit ? fit : this.#manual));
    const prev = this.#scale;
    const a = anchor ?? { x: vw / 2, y: vh / 2 };
    const fx = (sc.scrollLeft + a.x) / prev;
    const fy = (sc.scrollTop + a.y) / prev;
    this.#scale = next;
    this.#svg.setAttribute('width', String(Math.round(geo.width * next)));
    this.#svg.setAttribute('height', String(Math.round(geo.height * next)));
    if (prev !== next) {
      sc.scrollLeft = fx * next - a.x;
      sc.scrollTop = fy * next - a.y;
      this.#schedule();
    }
    sc.classList.toggle('can-pan', geo.width * next > vw + 1 || geo.height * next > vh + 1);
    this.dispatchEvent(new CustomEvent<MapZoom>('mapzoom', { detail: this.zoom }));
  }

  #render(): void {
    const st = this.#store;
    if (!st) return;
    const geo = geometry(st.num('grid.unit'));
    const active = this.#lampTest ? new Set(LINES.map((l) => l.n))
      : this.#isolated.size ? this.#isolated : new Set(linesAt(this.#focused).map((l) => l.n));
    const ctx: RenderCtx = {
      ...readTokens(st), geo, active,
      isolating: this.#isolated.size > 0 && !this.#lampTest,
      pinned: this.#pinned,
      focused: this.#focused,
      hit: (coarse.matches ? 22 : 12) / this.#scale,
    };
    const svg = this.#svg;
    svg.setAttribute('viewBox', `0 0 ${geo.width} ${geo.height}`);
    const lines = [...LINES].sort((a, b) => Number(active.has(a.n)) - Number(active.has(b.n)));
    const mark = focusMark(ctx);
    svg.replaceChildren(
      s('title', { id: 'map-svg-title' }, `${NETWORK_NAME} network, ${LINES.length} lines and ${STATIONS.length} stations`),
      gridLayer(geo, ctx.gridMark),
      s('g', { class: 'lines' }, ...lines.map((line) => lineGroup(line, ctx))),
      s('g', { class: 'stations' }, ...STATIONS.map((stn) => stationGroup(stn, ctx))),
      mark,
    );
    this.#applyZoom(null);
    chipFocusedLabel(svg);
    if (this.#scrollOnRender) {
      this.#scrollOnRender = false;
      const where = this.#firstScroll ? 'center' : 'nearest';
      this.#firstScroll = false;
      mark.scrollIntoView({ block: where, inline: where });
    }
    this.dispatchEvent(new Event('mapstate'));
  }
}

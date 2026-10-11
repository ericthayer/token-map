/**
 * <app-dock>: Tokens, Output and Map info panels.
 * Picks one of three layouts from the app's width and writes it to `.app[data-layout]`:
 *   sheet  (< 760px)   bottom sheet under the map, tabbed, collapsible, all three panels
 *   tabs   (760–1679)  side dock, tabbed, Tokens and Output
 *   split  (≥ 1680px)  side dock, Tokens and Output side by side, no tabs
 * ARIA roles follow the layout, so CSS and semantics never disagree.
 */
export type DockTab = 'tokens' | 'output' | 'info';
export type DockLayout = 'sheet' | 'tabs' | 'split';

const SHEET_MAX = 760;
const SPLIT_MIN = 1680;
const isTab = (v: unknown): v is DockTab => v === 'tokens' || v === 'output' || v === 'info';

export class AppDock extends HTMLElement {
  #layout: DockLayout | null = null;
  #active: DockTab = 'tokens';
  #open = true;
  #stored = false;
  #storageKey = 'transit-dock';
  #tabs: HTMLButtonElement[] = [];
  #panels: HTMLElement[] = [];
  #toggle: HTMLButtonElement | null = null;
  #panelBox: HTMLElement | null = null;
  readonly #observer = new ResizeObserver((entries) => {
    const width = entries[0]?.contentRect.width ?? 0;
    this.#setLayout(width < SHEET_MAX ? 'sheet' : width >= SPLIT_MIN ? 'split' : 'tabs');
  });

  get layout(): DockLayout | null {
    return this.#layout;
  }

  connectedCallback(): void {
    this.#storageKey = `transit-dock:${this.dataset['id'] ?? 'app'}`;
    this.#tabs = [...this.querySelectorAll<HTMLButtonElement>('[role="tab"][data-tab]')];
    this.#panels = [...this.querySelectorAll<HTMLElement>('[data-panel]')];
    this.#toggle = this.querySelector<HTMLButtonElement>('.dock-toggle');
    this.#panelBox = this.querySelector<HTMLElement>('.dock-panels');
    this.#restore();
    for (const tab of this.#tabs) {
      tab.addEventListener('click', () => {
        const id = tab.dataset['tab'];
        if (!isTab(id)) return;
        if (this.#layout === 'sheet' && this.#open && id === this.#active) this.setOpen(false);
        else this.show(id);
      });
    }
    this.querySelector('[role="tablist"]')?.addEventListener('keydown', (e) => this.#onTabKey(e as KeyboardEvent));
    this.#toggle?.addEventListener('click', () => this.setOpen(!this.#open));
    const app = this.closest<HTMLElement>('.app');
    if (app) this.#observer.observe(app);
  }

  disconnectedCallback(): void {
    this.#observer.disconnect();
  }

  /** Brings a panel forward. In sheet layout it also opens the sheet. */
  show(tab: DockTab, focus = false): void {
    const target = !this.#visibleTab(tab) ? 'tokens' : tab;
    this.#active = target;
    if (this.#layout === 'sheet') this.#setOpenState(true);
    this.#apply();
    if (!focus) return;
    const panel = this.#panels.find((p) => p.dataset['panel'] === target);
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel;
    first?.focus();
  }

  setOpen(open: boolean): void {
    this.#setOpenState(open);
    this.#apply();
  }

  /** Opening the sheet tells the page, so it can make room for the map. */
  #setOpenState(open: boolean): void {
    const opening = open && !this.#open;
    this.#open = open;
    this.#stored = true;
    if (opening) this.dispatchEvent(new Event('dockopen'));
  }

  #visibleTab(tab: DockTab): boolean {
    return tab !== 'info' || this.#layout === 'sheet';
  }

  #setLayout(layout: DockLayout): void {
    if (layout === this.#layout) return;
    this.#layout = layout;
    if (layout === 'sheet' && !this.#stored) this.#open = false;
    if (!this.#visibleTab(this.#active)) this.#active = 'tokens';
    this.closest<HTMLElement>('.app')?.setAttribute('data-layout', layout);
    this.#apply();
  }

  #apply(): void {
    const layout = this.#layout;
    if (!layout) return;
    const split = layout === 'split';
    const sheetClosed = layout === 'sheet' && !this.#open;
    for (const tab of this.#tabs) {
      const id = tab.dataset['tab'];
      const on = id === this.#active;
      tab.hidden = !isTab(id) || !this.#visibleTab(id);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    for (const panel of this.#panels) {
      const id = panel.dataset['panel'];
      const label = this.#tabs.find((t) => t.dataset['tab'] === id)?.textContent?.trim() ?? '';
      if (split) {
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-label', label);
        panel.removeAttribute('aria-labelledby');
        panel.hidden = id === 'info';
      } else {
        panel.setAttribute('role', 'tabpanel');
        panel.removeAttribute('aria-label');
        panel.setAttribute('aria-labelledby', `tab-${id ?? ''}`);
        panel.hidden = id !== this.#active;
      }
      panel.tabIndex = -1;
    }
    if (this.#panelBox) this.#panelBox.hidden = sheetClosed;
    this.classList.toggle('is-closed', sheetClosed);
    if (this.#toggle) {
      this.#toggle.hidden = layout !== 'sheet';
      this.#toggle.setAttribute('aria-expanded', String(!sheetClosed));
      this.#toggle.setAttribute('aria-label', sheetClosed ? 'Show panel' : 'Hide panel');
    }
    try {
      localStorage.setItem(this.#storageKey, JSON.stringify({ active: this.#active, open: this.#open }));
    } catch {
      /* Storage is optional. */
    }
  }

  #onTabKey(e: KeyboardEvent): void {
    const visible = this.#tabs.filter((t) => !t.hidden);
    const i = visible.findIndex((t) => t.dataset['tab'] === this.#active);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % visible.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + visible.length) % visible.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = visible.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = visible[next]?.dataset['tab'];
    if (!isTab(id)) return;
    this.show(id);
    visible[next]?.focus();
  }

  #restore(): void {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(this.#storageKey) ?? 'null');
      if (typeof saved !== 'object' || saved === null) return;
      const rec = saved as Record<string, unknown>;
      if (isTab(rec['active'])) this.#active = rec['active'];
      if (typeof rec['open'] === 'boolean') {
        this.#open = rec['open'];
        this.#stored = true;
      }
    } catch {
      /* Storage is optional. */
    }
  }
}

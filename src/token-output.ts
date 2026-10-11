/** <token-output>: live CSS or DTCG output with a copy action. */
import { h, rafBatch, type Announce } from './dom.js';
import { toCss, toDtcg, type OutputFormat } from './export.js';
import type { TokenStore } from './tokens.js';

const LABELS: Readonly<Record<OutputFormat, string>> = { css: 'CSS', json: 'JSON' };

export class TokenOutput extends HTMLElement {
  #store: TokenStore | null = null;
  #unsubscribe: (() => void) | null = null;
  #announce: Announce = () => undefined;
  #format: OutputFormat = 'css';
  #changed: string | null = null;
  #copiedTimer = 0;
  readonly #tabs: Readonly<Record<OutputFormat, HTMLButtonElement>>;
  readonly #tablist = h('div', { role: 'tablist', 'aria-label': 'Output format', class: 'out-tabs' });
  readonly #pre = h('pre', { id: 'out-panel', class: 'out-code', role: 'tabpanel', tabindex: 0, 'data-autofocus': true });
  readonly #copyBtn = h('button', { type: 'button', class: 'out-copy' }, 'Copy CSS');
  readonly #schedule = rafBatch(() => this.#render());

  constructor() {
    super();
    this.#tabs = { css: this.#tab('css', 'CSS variables'), json: this.#tab('json', 'DTCG JSON') };
  }

  set store(store: TokenStore) {
    this.#unsubscribe?.();
    this.#store = store;
    this.#unsubscribe = store.onChange((c) => {
      this.#changed = c.name;
      this.#schedule();
    });
    this.#schedule();
  }
  set announce(fn: Announce) {
    this.#announce = fn;
  }

  connectedCallback(): void {
    if (this.#tablist.isConnected) return;
    this.#tablist.append(this.#tabs.css, this.#tabs.json);
    this.#tablist.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      this.#setFormat(this.#format === 'css' ? 'json' : 'css', true);
    });
    this.#copyBtn.addEventListener('click', () => void this.copy());
    this.append(this.#tablist, this.#pre, this.#copyBtn);
    this.#setFormat('css', false);
  }

  focusTabs(): void {
    this.#tabs[this.#format].focus();
  }

  async copy(): Promise<void> {
    const text = this.#pre.textContent ?? '';
    const label = LABELS[this.#format];
    try {
      await navigator.clipboard.writeText(text);
      this.#copyBtn.textContent = 'Copied';
      window.clearTimeout(this.#copiedTimer);
      this.#copiedTimer = window.setTimeout(() => {
        this.#copyBtn.textContent = `Copy ${label}`;
      }, 1600);
      this.#announce(`Copied ${label}.`);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(this.#pre);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      this.#announce('Copy is blocked here. The output is selected, so press Ctrl+C or Cmd+C.');
    }
  }

  #tab(format: OutputFormat, text: string): HTMLButtonElement {
    const tab = h('button', { type: 'button', role: 'tab', id: `out-tab-${format}`, 'aria-controls': 'out-panel' }, text);
    tab.addEventListener('click', () => this.#setFormat(format, false));
    return tab;
  }

  #setFormat(format: OutputFormat, focus: boolean): void {
    this.#format = format;
    for (const [f, tab] of Object.entries(this.#tabs)) {
      const on = f === format;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    this.#pre.setAttribute('aria-labelledby', `out-tab-${format}`);
    this.#copyBtn.textContent = `Copy ${LABELS[format]}`;
    if (focus) this.#tabs[format].focus();
    this.#render();
  }

  #render(): void {
    const st = this.#store;
    if (!st) return;
    const lines = this.#format === 'css' ? toCss(st) : toDtcg(st);
    this.#pre.replaceChildren(...lines.map((line) =>
      h('span', { class: `out-line${line.token !== null && line.token === this.#changed ? ' is-changed' : ''}` }, line.text, '\n')));
  }
}

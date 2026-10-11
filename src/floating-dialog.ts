/**
 * FloatingDialog: a non-modal <dialog> that can be dragged by its title bar, or moved
 * with the arrow keys from its grip button. Escape closes it and focus returns to the opener.
 */
const KEY_STEP = 16;
const EDGE = 8;

export class FloatingDialog {
  readonly #dialog: HTMLDialogElement;
  readonly #openers: readonly HTMLElement[];
  #returnTo: HTMLElement | null = null;
  #placed = false;
  #x = 0;
  #y = 0;

  constructor(dialog: HTMLDialogElement, openers: readonly HTMLElement[]) {
    this.#dialog = dialog;
    this.#openers = openers;
    const bar = dialog.querySelector<HTMLElement>('.float-bar');
    const grip = dialog.querySelector<HTMLButtonElement>('.float-grip');
    dialog.querySelector<HTMLButtonElement>('.float-close')?.addEventListener('click', () => this.close());
    dialog.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      this.close();
    });
    dialog.addEventListener('close', () => this.#syncOpeners());
    bar?.addEventListener('pointerdown', (e) => this.#drag(e, bar));
    grip?.addEventListener('keydown', (e) => {
      const big = e.shiftKey ? 4 : 1;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault();
      this.#moveTo(this.#x + (d[0] ?? 0) * KEY_STEP * big, this.#y + (d[1] ?? 0) * KEY_STEP * big);
    });
    window.addEventListener('resize', () => {
      if (dialog.open) this.#moveTo(this.#x, this.#y);
    });
  }

  get open(): boolean {
    return this.#dialog.open;
  }

  show(): void {
    if (this.#dialog.open) return;
    this.#returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.#dialog.show();
    if (!this.#placed) this.#placeDefault();
    else this.#moveTo(this.#x, this.#y);
    this.#dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    this.#syncOpeners();
  }

  close(): void {
    if (!this.#dialog.open) return;
    this.#dialog.close();
    const back = this.#returnTo && this.#returnTo.isConnected ? this.#returnTo : this.#openers[0];
    back?.focus();
  }

  toggle(): void {
    if (this.#dialog.open) this.close();
    else this.show();
  }

  /** Default spot: bottom right, clear of the command bar. */
  #placeDefault(): void {
    const rect = this.#dialog.getBoundingClientRect();
    const bar = document.querySelector('.cmdbar')?.getBoundingClientRect();
    const bottom = bar ? bar.top : window.innerHeight;
    this.#placed = true;
    this.#moveTo(window.innerWidth - rect.width - 24, bottom - rect.height - 16);
  }

  #moveTo(x: number, y: number): void {
    const rect = this.#dialog.getBoundingClientRect();
    this.#x = Math.round(Math.min(Math.max(EDGE, x), Math.max(EDGE, window.innerWidth - rect.width - EDGE)));
    this.#y = Math.round(Math.min(Math.max(EDGE, y), Math.max(EDGE, window.innerHeight - Math.min(rect.height, 64))));
    this.#dialog.style.setProperty('--fx', `${this.#x}px`);
    this.#dialog.style.setProperty('--fy', `${this.#y}px`);
  }

  #drag(e: PointerEvent, bar: HTMLElement): void {
    if (e.button !== 0 || (e.target instanceof Element && e.target.closest('button:not(.float-grip)'))) return;
    e.preventDefault();
    bar.setPointerCapture(e.pointerId);
    const start = { x: e.clientX - this.#x, y: e.clientY - this.#y };
    const move = (ev: PointerEvent): void => this.#moveTo(ev.clientX - start.x, ev.clientY - start.y);
    const up = (): void => {
      bar.removeEventListener('pointermove', move);
      bar.classList.remove('is-dragging');
    };
    bar.classList.add('is-dragging');
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up, { once: true });
    bar.addEventListener('pointercancel', up, { once: true });
  }

  #syncOpeners(): void {
    for (const o of this.#openers) o.setAttribute('aria-expanded', String(this.#dialog.open));
  }
}

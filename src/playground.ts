/** Mounts a direction: registers elements, binds color tokens to the page, wires commands and global keys. */
import { AppDock } from './app-dock.js';
import { relativeLuminance } from './color.js';
import { colorName } from './color-names.js';
import { ColorEditor } from './color-editor.js';
import { ColorPanel } from './color-panel.js';
import { COMMAND_WORDS, runCommand } from './commands.js';
import { ContrastPanel } from './contrast-panel.js';
import { h, rafBatch, type Announce } from './dom.js';
import { FloatingDialog } from './floating-dialog.js';
import { MapLegend } from './map-legend.js';
import { MapReadout } from './map-readout.js';
import { BASE_SHEET } from './map-styles.js';
import { SHELL_SHEET } from './shell-styles.js';
import { ThemeSlots } from './theme-slots.js';
import { ThemeStore } from './themes.js';
import { TokenOutput } from './token-output.js';
import { TokenRack } from './token-rack.js';
import { TokenStore, formatValue, type TokenDefaults } from './tokens.js';
import { TransitMap } from './transit-map.js';
import { ZoomControl } from './zoom-control.js';

export { AppDock, ColorEditor, ColorPanel, ContrastPanel, MapLegend, MapReadout, ThemeSlots, ThemeStore, TokenOutput, TokenRack, TokenStore, TransitMap, ZoomControl };

export interface PlaygroundConfig {
  readonly id: string;
  readonly defaults: TokenDefaults;
  /** Binds the L key to a lamp test. */
  readonly lampTest?: boolean;
}
export interface Playground {
  readonly store: TokenStore;
  readonly themes: ThemeStore;
}

const ELEMENTS: readonly (readonly [string, CustomElementConstructor])[] = [
  ['color-editor', ColorEditor], ['theme-slots', ThemeSlots], ['color-panel', ColorPanel], ['transit-map', TransitMap],
  ['token-rack', TokenRack], ['token-output', TokenOutput], ['contrast-panel', ContrastPanel], ['map-legend', MapLegend],
  ['map-readout', MapReadout], ['zoom-control', ZoomControl], ['app-dock', AppDock],
];

function need<T extends Element>(selector: string, type: { new (): T; prototype: T }): T {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`Playground markup is missing ${selector}`);
  return el;
}
const all = <T extends Element>(selector: string, type: { new (): T; prototype: T }): T[] =>
  [...document.querySelectorAll(selector)].filter((el): el is T => el instanceof type);

function storageFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}
function saveFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    /* Storage is optional. */
  }
}

export function mountPlayground(cfg: PlaygroundConfig): Playground {
  for (const [tag, ctor] of ELEMENTS) if (!customElements.get(tag)) customElements.define(tag, ctor);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets.filter((s) => s !== BASE_SHEET && s !== SHELL_SHEET), BASE_SHEET, SHELL_SHEET];

  const store = new TokenStore(cfg.defaults, `transit-tokens:${cfg.id}`);
  const themes = new ThemeStore(store, cfg.id);
  const live = need('#announce', HTMLElement);
  let liveTimer = 0;
  const announce: Announce = (message) => {
    live.textContent = '';
    window.clearTimeout(liveTimer);
    liveTimer = window.setTimeout(() => { live.textContent = message; }, 40);
  };

  const root = document.documentElement;
  const bound = [...document.querySelectorAll<HTMLElement>('[data-token]')];
  const named = [...document.querySelectorAll<HTMLElement>('[data-color-name]')];
  const undoBtn = need('#undo', HTMLButtonElement);
  const redoBtn = need('#redo', HTMLButtonElement);
  const sync = (): void => {
    for (const role of ['ground', 'ink', 'signal'] as const) root.style.setProperty(`--c-${role}`, store.str(`color.${role}`));
    root.style.colorScheme = relativeLuminance(store.str('color.ground')) < 0.18 ? 'dark' : 'light';
    for (const el of bound) {
      const def = store.def(el.dataset['token'] ?? '');
      if (def) el.textContent = formatValue(def, store.get(def.name));
    }
    for (const el of named) {
      const role = el.dataset['colorName'];
      if (role !== 'ground' && role !== 'ink' && role !== 'signal') continue;
      const name = themes.colorName(role) ?? colorName(store.str(`color.${role}`));
      el.textContent = el.hasAttribute('data-capitalize') ? name.charAt(0).toUpperCase() + name.slice(1) : name;
    }
    undoBtn.setAttribute('aria-disabled', String(!store.canUndo));
    redoBtn.setAttribute('aria-disabled', String(!store.canRedo));
  };
  sync();
  const scheduleSync = rafBatch(sync);
  store.onChange(scheduleSync);
  themes.onChange(scheduleSync);

  const map = need('transit-map', TransitMap);
  const rack = need('token-rack', TokenRack);
  const output = need('token-output', TokenOutput);
  const dock = need('app-dock', AppDock);
  const colors = need('color-panel', ColorPanel);
  map.announce = announce;
  rack.announce = announce;
  output.announce = announce;
  colors.announce = announce;
  map.store = store;
  rack.store = store;
  output.store = store;
  colors.store = store;
  colors.themes = themes;
  need('contrast-panel', ContrastPanel).store = store;
  need('zoom-control', ZoomControl).map = map;
  for (const legend of all('map-legend', MapLegend)) {
    legend.store = store;
    legend.map = map;
  }
  for (const readout of all('map-readout', MapReadout)) readout.map = map;
  for (const slots of all('theme-slots[variant="compact"]', ThemeSlots)) {
    slots.themes = themes;
    slots.announce = announce;
  }

  const undo = (): void => announce(store.undo() ? 'Undone.' : 'Nothing to undo.');
  const redo = (): void => announce(store.redo() ? 'Redone.' : 'Nothing to redo.');
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);

  // Intro: open until dismissed, remembered per browser.
  const introKey = `transit-intro:${cfg.id}`;
  const intro = need('#intro', HTMLElement);
  const introBtn = need('#intro-toggle', HTMLButtonElement);
  const setIntro = (open: boolean): void => {
    intro.hidden = !open;
    introBtn.setAttribute('aria-expanded', String(open));
    introBtn.textContent = open ? 'Hide intro' : 'How it works';
    document.querySelector('.masthead')?.classList.toggle('is-compact', !open);
  };
  setIntro(storageFlag(introKey, window.innerHeight >= 620));
  // Only the user's own choice is remembered, not the screen-size default or the sheet's auto-collapse.
  introBtn.addEventListener('click', () => {
    setIntro(Boolean(intro.hidden));
    saveFlag(introKey, !intro.hidden);
  });
  dock.addEventListener('dockopen', () => {
    if (dock.layout === 'sheet' && !intro.hidden) setIntro(false);
  });

  // Help: non-modal, draggable.
  const helpBtn = need('#help-btn', HTMLButtonElement);
  const help = new FloatingDialog(need('#help', HTMLDialogElement), [helpBtn]);
  helpBtn.addEventListener('click', () => help.toggle());
  for (const link of document.querySelectorAll<HTMLButtonElement>('[data-open-help]')) link.addEventListener('click', () => help.show());

  // Command line.
  const form = need('#cmd-form', HTMLFormElement);
  const input = need('#cmd', HTMLInputElement);
  const status = need('#cmd-status', HTMLElement);
  const list = need('#token-names', HTMLDataListElement);
  const fillList = (): void => {
    const t = store.trio();
    const words = [...store.defs().map((d) => d.name), ...COMMAND_WORDS, `colors ${t.ground} ${t.ink} ${t.signal}`];
    list.replaceChildren(...words.map((value) => h('option', { value })));
  };
  fillList();
  const scheduleList = rafBatch(fillList);
  let running = false;
  store.onChange(() => {
    if (!running) status.textContent = '';
    scheduleList();
  });
  let returnTo: HTMLElement | null = null;
  const targets = {
    store, themes,
    copy: (): void => void output.copy(),
    fit: (): void => map.fitView(),
    select: (name: string): void => {
      if (name.startsWith('color.')) return;
      rack.select(name);
      dock.show('tokens');
    },
  };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    running = true;
    const result = runCommand(input.value, targets);
    running = false;
    status.textContent = result.text;
    status.dataset['state'] = result.ok ? 'ok' : 'error';
    announce(result.text);
    if (result.ok) input.value = '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (input.value) input.value = '';
    else (returnTo ?? map).focus();
  });

  const focusPanel = (tab: 'tokens' | 'output' | 'info'): void => {
    dock.show(tab, true);
  };

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.altKey) return;
    // Sliders and other non-text inputs keep the global keys, so undo still works after a drag.
    const typing = e.target instanceof Element
      && e.target.closest('input:not([type="range"], [type="checkbox"], [type="radio"], [type="button"]), textarea, select, [contenteditable]');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !typing && (e.key === 'z' || e.key === 'Z' || e.key === 'y')) {
      e.preventDefault();
      if (e.key === 'y' || e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod || typing) return;
    switch (e.key) {
      case '/':
        returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        input.focus();
        break;
      case '?': help.toggle(); break;
      case 'e': void output.copy(); break;
      case 'm': map.focus(); break;
      case 't': focusPanel('tokens'); break;
      case 'o': focusPanel('output'); break;
      case 'i':
        if (dock.layout === 'sheet') focusPanel('info');
        else document.querySelector<HTMLElement>('.map-pane map-legend [tabindex="0"]')?.focus();
        break;
      case 'c': {
        const i = themes.cycle();
        announce(i < 0 ? 'No saved themes yet. Save one from the Themes list.' : `Theme ${i + 1} applied.`);
        break;
      }
      case '+': case '=': map.zoomIn(); break;
      case '-': case '_': map.zoomOut(); break;
      case 'f': map.fitView(); break;
      case 'l': case 'L':
        if (!cfg.lampTest) return;
        map.lampTest();
        break;
      default: return;
    }
    e.preventDefault();
  });

  return { store, themes };
}

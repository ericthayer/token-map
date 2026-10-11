/** Tiny DOM builders. All text goes through text nodes, never innerHTML. */
export type AttrValue = string | number | boolean | null | undefined;
export type Attrs = Readonly<Record<string, AttrValue>>;
export type Child = Node | string;
export type Announce = (message: string) => void;

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyAttrs(node: Element, attrs: Attrs): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  node.append(...children);
  return node;
}

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs);
  node.append(...children);
  return node;
}

/** Coalesces repeated calls into one animation frame. */
export function rafBatch(fn: () => void): () => void {
  let pending = 0;
  return (): void => {
    if (pending !== 0) return;
    pending = requestAnimationFrame(() => {
      pending = 0;
      fn();
    });
  };
}

export function listJoin(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`;
}

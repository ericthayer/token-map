// Wraps each page in the same skeleton the Artifact host adds at publish time, so it can be served locally.
// Output: preview/<page>.html plus a copy of js/. Run through `npm run preview`.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const PAGES = ['schematic-paper', 'signal-room'];
const HEAD = '<!doctype html><html><head><meta charset="utf-8">'
  + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
  + 'body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';

mkdirSync('preview', { recursive: true });
cpSync('js', 'preview/js', { recursive: true });
for (const page of PAGES) {
  writeFileSync(`preview/${page}.html`, `${HEAD}${readFileSync(`${page}.html`, 'utf8')}</body></html>`);
}
console.log(`Preview ready: ${PAGES.map((p) => `http://localhost:8765/${p}.html`).join('  ')}`);

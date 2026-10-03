#!/usr/bin/env node
/*
  node lucide-sync.mjs [glob-prefix]   e.g.  node lucide-sync.mjs reminders-
  node lucide-sync.mjs --icon users,foo  icons a state never drew, from the production app's own
                                         lucide-react package (same version, same paths)

  Copies every Lucide icon the production screen drew in the captured states (react DOM dumps)
  into js/components/icons.js, verbatim, if it is not there yet. Icons are data, not design: this
  keeps the prototype's glyphs byte-identical to production's without hand-copying SVG paths.
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const iconArg = process.argv.indexOf('--icon');
const prefix = iconArg === -1 ? (process.argv[2] || '') : '\u0000';
const icons = new Map();
if (iconArg !== -1) {
  const SO = process.env.REACT_SALES_ORDERS || path.resolve(HERE, '../../../../../../foodbridge-module-route-delivery/development/sales-orders');
  for (const name of process.argv[iconArg + 1].split(',')) {
    const src = fs.readFileSync(path.join(SO, 'node_modules/lucide-react/dist/esm/icons', `${name}.js`), 'utf8');
    const nodes = [...src.matchAll(/\[\s*"(\w+)",\s*\{([^}]*)\}\s*\]/g)].map(([, tag, attrs]) => {
      const a = [...attrs.matchAll(/(\w+): "([^"]*)"/g)].filter(([, k]) => k !== 'key').map(([, k, v]) => ` ${k}="${v}"`).join('');
      return `<${tag}${a}></${tag}>`;
    });
    icons.set(name, nodes.join(''));
  }
}
for (const vp of fs.readdirSync(path.join(HERE, '__shots__/react'))) {
  const dir = path.join(HERE, '__shots__/react', vp);
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(prefix) && x.endsWith('.dom.html'))) {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of s.matchAll(/<svg[^>]*class="lucide lucide-([a-z0-9-]+)[^"]*"[^>]*>(.*?)<\/svg>/gs)) if (!icons.has(m[1])) icons.set(m[1], m[2]);
  }
}
const file = path.join(HERE, '../../js/components/icons.js');
let src = fs.readFileSync(file, 'utf8');
const start = src.indexOf('const LUCIDE = {');
const end = src.indexOf('};', start);
const have = new Set([...src.slice(start, end).matchAll(/^\s+'?([a-z0-9-]+)'?:/gm)].map((m) => m[1]));
const add = [...icons].filter(([k]) => !have.has(k)).sort(([a], [b]) => a.localeCompare(b));
src = src.slice(0, end) + add.map(([k, v]) => `  '${k}': '${v}',\n`).join('') + src.slice(end);
fs.writeFileSync(file, src);
console.log(add.length ? `added: ${add.map(([k]) => k).join(', ')}` : 'nothing new');

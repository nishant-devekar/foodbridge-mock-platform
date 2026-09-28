/*
  Icons, rendered the way their production components render them.

    fi('FiPlus', { size, cls })        react-icons/fi (GenIcon): stroke icons, 1em unless sized
    lucide('Search', { size, cls })    lucide-react: `lucide lucide-<name>` classes, 24px unless sized

  The node data is generated from the same packages production bundles (icon-data.js, by
  tests/parity/lucide-sync.mjs) — never hand-copied.
*/
import { FI, LUCIDE } from './icon-data.js';

const a = (name, v) => (v === undefined || v === null || v === '' ? '' : ` ${name}="${v}"`);

export function fi(name, { size, cls, style } = {}) {
  const body = FI[name];
  if (body === undefined) throw new Error(`icon ${name} is not in icon-data.js — run tests/parity/lucide-sync.mjs`);
  const s = size ?? '1em';
  return `<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"${a('class', cls)}${a('style', style)} height="${s}" width="${s}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
}

export function lucide(name, { size = 24, cls = '', strokeWidth = 2 } = {}) {
  const icon = LUCIDE[name];
  if (!icon) throw new Error(`icon ${name} is not in icon-data.js — run tests/parity/lucide-sync.mjs`);
  const klass = ['lucide', `lucide-${icon.cls}`, cls].filter(Boolean).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" class="${klass}">${icon.body}</svg>`;
}

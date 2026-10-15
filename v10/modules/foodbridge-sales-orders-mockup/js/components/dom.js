/* Tiny helpers shared by every view: escaping, class joining, attribute output. */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes a value for HTML text or an attribute. Data is trusted, but the product escapes too. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/** Joins class fragments, dropping empty ones: cls('a', on && 'b'). */
export const cls = (...parts) => parts.filter(Boolean).join(' ');

/** ` name="value"`, or nothing when the value is null/false. `true` renders a bare attribute. */
export const attr = (name, value) => {
  if (value === null || value === undefined || value === false) return '';
  if (value === true) return ` ${name}=""`;
  return ` ${name}="${esc(value)}"`;
};

/** Delegated event handling: data-act="name" on any element routes clicks to handlers[name]. */
export function delegate(root, type, handlers) {
  root.addEventListener(type, (event) => {
    const el = event.target.closest('[data-act]');
    if (!el || !root.contains(el)) return;
    const fn = handlers[el.dataset.act];
    if (fn) fn(event, el);
  });
}

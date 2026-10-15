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

/**
 * Updates `target`'s children in place to match `html`, the way React reconciles: a node of the
 * same kind at the same position is KEPT (attributes and text patched), so focus, caret, text
 * selection, hover and scroll survive a re-render. `data-key` pins identity: a keyed node is found
 * by its key and moved into place, wherever it was.
 */
export function morph(target, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  morphChildren(target, tpl.content);
}

/** morph() for an element and its own attributes: `html` is the element's outer HTML. */
export function morphOuter(el, html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  const next = tpl.content.firstElementChild;
  morphAttrs(el, next);
  morphChildren(el, next);
}

const same = (a, b) => a.nodeType === b.nodeType && a.nodeName === b.nodeName
  && (a.nodeType !== 1 || a.getAttribute('data-key') === b.getAttribute('data-key'));

/**
 * Children marked `data-keep` belong to someone else (a modal a component renders inline, after its
 * own children): they are neither matched, replaced nor removed, and new nodes go in before them.
 */
const kept = (n) => n.nodeType === 1 && n.hasAttribute('data-keep');

function morphChildren(from, to) {
  const next = [...to.childNodes];
  const anchor = [...from.childNodes].find(kept) || null;
  const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute('data-key') : null);
  const keyed = new Map();
  for (const c of from.childNodes) if (!kept(c) && keyOf(c) !== null) keyed.set(keyOf(c), c);
  const ownNow = () => [...from.childNodes].filter((c) => !kept(c));
  const wanted = new Set(next.map(keyOf).filter((k) => k !== null));
  for (let i = 0; i < next.length; i += 1) {
    let cur = ownNow()[i];
    // A keyed node whose key is gone goes first, so the nodes after it need not move (moving a
    // node blurs the field inside it).
    while (cur && keyOf(cur) !== null && !wanted.has(keyOf(cur))) { cur.remove(); cur = ownNow()[i]; }
    const n = next[i];
    // A keyed node moves to where its key now is (React's keyed reconciliation), so it keeps
    // its identity — and its focus — when siblings before it come and go.
    const key = keyOf(n);
    const match = key !== null ? keyed.get(key) : null;
    if (match && match !== cur && match.parentNode === from) { from.insertBefore(match, cur || anchor); cur = match; }
    if (!cur) { from.insertBefore(n, anchor); continue; }
    if (!same(cur, n)) {
      // A keyed node in the way may still be wanted further on: step in front of it.
      if (keyOf(cur) !== null) from.insertBefore(n, cur); else from.replaceChild(n, cur);
      continue;
    }
    if (cur.nodeType !== 1) { if (cur.nodeValue !== n.nodeValue) cur.nodeValue = n.nodeValue; continue; }
    morphAttrs(cur, n);
    if (cur.nodeName === 'TEXTAREA') { const v = n.textContent; if (cur.value !== v) cur.value = v; continue; }
    morphChildren(cur, n);
    if (cur.nodeName === 'SELECT') { const opt = [...n.options].find((o) => o.hasAttribute('selected')) || n.options[0]; if (opt && cur.value !== opt.value) cur.value = opt.value; }
  }
  for (const extra of ownNow().slice(next.length)) extra.remove();
}

function morphAttrs(cur, n) {
  for (const a of [...cur.attributes]) if (!n.hasAttribute(a.name)) cur.removeAttribute(a.name);
  for (const a of [...n.attributes]) if (cur.getAttribute(a.name) !== a.value) cur.setAttribute(a.name, a.value);
  if (cur.nodeName === 'INPUT') {
    // React drives the PROPERTIES of a controlled input, not just its attributes. An input rendered
    // without a value attribute is uncontrolled (the search box): what the user typed stays.
    if (n.hasAttribute('value') && cur.type !== 'file' && cur.value !== n.getAttribute('value')) cur.value = n.getAttribute('value');
    if ((cur.type === 'checkbox' || cur.type === 'radio') && cur.checked !== n.hasAttribute('checked')) cur.checked = n.hasAttribute('checked');
  }
  if (cur.nodeName === 'OPTION') cur.selected = n.hasAttribute('selected');
}

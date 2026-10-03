/*
  Hover tooltips, as the product shows them (react-tooltip): any element with data-tooltip="text"
  gets a dark bubble on hover, inserted right after it and positioned against its offset parent.

  Placement follows react-tooltip's rules: prefer the anchor's place (data-tooltip-place, default
  TOP), 10px off the anchor; if that leaves the visible area (the viewport clipped by every
  scrolling/clipping ancestor), try its opposite, then the other axis; then nudge along the axis to
  stay 5px inside. The arrow points at the anchor's centre.

  Two looks: the product's styled bubble (slate, a text-sm span), and react-tooltip's plain
  default (data-tooltip-plain: #222, the text alone).
*/
import { esc } from './dom.js';

const GAP = 10;
const PAD = 5;
const ARROW = 8;
const FALLBACK = { top: ['top', 'bottom', 'left', 'right'], bottom: ['bottom', 'top', 'left', 'right'], left: ['left', 'right', 'top', 'bottom'], right: ['right', 'left', 'top', 'bottom'] };

/**
 * The area a tooltip can paint into: the viewport, cut by its clipping ancestors — floating-ui's
 * rule. An absolutely positioned tooltip escapes every static ancestor's overflow on the way up to
 * its containing block, so only the containing block and what contains IT can clip it.
 */
function clipRect(tip) {
  let r = { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: document.documentElement.clientHeight };
  let escaping = true; // the tooltip itself is position: absolute
  for (let p = tip.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    const cs = getComputedStyle(p);
    const containing = cs.position !== 'static' || cs.transform !== 'none' || cs.filter !== 'none' || cs.contain.includes('paint');
    if (escaping && !containing) continue;
    if (/(hidden|auto|scroll|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY)) {
      const b = p.getBoundingClientRect();
      const inner = {
        left: b.left + p.clientLeft, top: b.top + p.clientTop,
        right: b.left + p.clientLeft + p.clientWidth, bottom: b.top + p.clientTop + p.clientHeight,
      };
      r = { left: Math.max(r.left, inner.left), top: Math.max(r.top, inner.top), right: Math.min(r.right, inner.right), bottom: Math.min(r.bottom, inner.bottom) };
    }
    escaping = cs.position === 'absolute' || cs.position === 'fixed' ? true : cs.position === 'static' ? escaping : false;
  }
  return r;
}

function coords(place, ref, w, h) {
  const cx = ref.left + ref.width / 2 - w / 2;
  const cy = ref.top + ref.height / 2 - h / 2;
  if (place === 'top') return { x: cx, y: ref.top - GAP - h };
  if (place === 'bottom') return { x: cx, y: ref.bottom + GAP };
  if (place === 'left') return { x: ref.left - GAP - w, y: cy };
  return { x: ref.right + GAP, y: cy };
}

const overflow = (c, w, h, clip) => Math.max(0, clip.left - c.x) + Math.max(0, c.x + w - clip.right)
  + Math.max(0, clip.top - c.y) + Math.max(0, c.y + h - clip.bottom);

export function showTooltip(anchor) {
  hideTooltip();
  const text = anchor.getAttribute('data-tooltip');
  if (!text) return;
  const tip = document.createElement('div');
  tip.setAttribute('role', 'tooltip');
  tip.dataset.soTooltip = '';
  tip.className = 'react-tooltip rt-tooltip';
  const plain = anchor.hasAttribute('data-tooltip-plain');
  if (!plain) tip.style.cssText = `background-color: ${anchor.dataset.tooltipBg || 'rgb(51, 65, 85)'};`;
  const body = plain ? esc(text) : `<span class="text-sm font-medium" style="color: rgb(255, 255, 255);">${esc(text)}</span>`;
  tip.innerHTML = `<div class="react-tooltip-content-wrapper rt-tooltip__content">${body}</div><div class="react-tooltip-arrow rt-tooltip__arrow" style="--rt-arrow-size: 8px;"></div>`;
  // react-tooltip's own sequence, which also decides how the bubble rasterises: mounted
  // transparent at its parent's origin, positioned a frame later, then faded in.
  anchor.after(tip);
  requestAnimationFrame(() => {
    if (!tip.isConnected) return;
    place(anchor, tip);
    requestAnimationFrame(() => tip.classList.add('react-tooltip__show'));
  });
}

function place(anchor, tip) {
  const ref = anchor.getBoundingClientRect();
  // The bubble's size exactly as floating-ui measures it: the computed CSS width/height strings
  // (rounded to 4 places), unless those disagree with the rounded offset size.
  const cs = getComputedStyle(tip);
  let w = parseFloat(cs.width);
  let h = parseFloat(cs.height);
  if (Math.round(w) !== tip.offsetWidth || Math.round(h) !== tip.offsetHeight) { w = tip.offsetWidth; h = tip.offsetHeight; }
  const clip = clipRect(tip);
  const order = FALLBACK[anchor.dataset.tooltipPlace] || FALLBACK.top;
  let side = order.find((p) => overflow(coords(p, ref, w, h), w, h, clip) === 0);
  if (!side) side = order.reduce((best, p) => (overflow(coords(p, ref, w, h), w, h, clip) < overflow(coords(best, ref, w, h), w, h, clip) ? p : best), order[0]);
  let { x, y } = coords(side, ref, w, h);
  const horizontal = side === 'top' || side === 'bottom';
  if (horizontal) x = Math.min(Math.max(x, clip.left + PAD), clip.right - PAD - w);
  else y = Math.min(Math.max(y, clip.top + PAD), clip.bottom - PAD - h);

  const parent = tip.offsetParent || document.body;
  const pr = parent.getBoundingClientRect();
  tip.style.left = `${x - pr.left - parent.clientLeft + parent.scrollLeft}px`;
  tip.style.top = `${y - pr.top - parent.clientTop + parent.scrollTop}px`;
  tip.classList.add(`react-tooltip__place-${side}`);

  // floating-ui's arrow: centred on the bubble's integer client size, then pulled toward the
  // anchor's centre, and kept inside the bubble.
  const arrow = tip.lastElementChild;
  const client = horizontal ? tip.clientWidth : tip.clientHeight;
  const [rs, rl, fs, fl] = horizontal ? [ref.left, ref.width, x, w] : [ref.top, ref.height, y, h];
  const toRef = ((rl + rs - fs - fl) - (fs - rs)) / 2;
  const pos = Math.min(Math.max(client / 2 - ARROW / 2 + toRef, 0), client - ARROW);
  arrow.style[horizontal ? 'left' : 'top'] = `${pos}px`;
  arrow.style[{ top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side]] = '-3px';
}

export function hideTooltip() {
  document.querySelectorAll('[data-so-tooltip]').forEach((t) => t.remove());
}

let pointer = null;
window.addEventListener('mousemove', (e) => { pointer = [e.clientX, e.clientY]; }, true);
window.addEventListener('mousedown', (e) => { pointer = [e.clientX, e.clientY]; }, true);

/**
 * After a region re-renders under a pointer that has not moved, show the tooltip of whatever is
 * now beneath it — react-tooltip keeps its anchor across renders, so the bubble stays (with any
 * new text, e.g. "Show email and address" → "Hide details").
 */
export function refreshTooltip() {
  if (!pointer) return;
  const a = document.elementFromPoint(...pointer)?.closest?.('[data-tooltip]');
  if (a && !a.nextElementSibling?.hasAttribute('data-so-tooltip')) showTooltip(a);
}

/** Wires hover tooltips for every [data-tooltip] under `root`. */
export function wireTooltips(root) {
  root.addEventListener('mouseover', (e) => {
    const a = e.target.closest?.('[data-tooltip]');
    if (a && root.contains(a) && !a.nextElementSibling?.hasAttribute('data-so-tooltip')) showTooltip(a);
  });
  root.addEventListener('mouseout', (e) => {
    const a = e.target.closest?.('[data-tooltip]');
    if (a && !a.contains(e.relatedTarget)) hideTooltip();
  });
  // react-tooltip also opens on focus (a click focuses a button) — re-rendering its bubble — and
  // closes on blur.
  root.addEventListener('focusin', (e) => {
    const a = e.target.closest?.('[data-tooltip]');
    if (a && root.contains(a)) showTooltip(a);
  });
  root.addEventListener('focusout', (e) => { if (e.target.closest?.('[data-tooltip]')) hideTooltip(); });
  window.addEventListener('scroll', hideTooltip, true);
}

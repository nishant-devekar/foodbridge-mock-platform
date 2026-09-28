/*
  A react-datepicker 4.25 look-alike, for a `selectsRange` picker: the same popper DOM, the same
  day classes (Day.getClassNames, in its order), and the same placement popper.js v2 computes for
  `bottom-end` — the popper's right edge on the input wrapper's right edge, rounded by device pixel
  ratio, with the triangle centred on the wrapper and clamped inside the calendar.

  It renders into `#root-portal` (the picker's portalId), created on first open and left in <body>,
  empty, once closed — as react-datepicker leaves it.

    createRangePicker({ wrapper, input, onChange })   wrapper/input: () => Element
      .open() .close() .isOpen   .setRange([start, end])  (the controlled startDate/endDate props)
*/
import { esc } from './dom.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a, b) => Boolean(a && b) && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d, n) => { const r = new Date(d.getFullYear(), d.getMonth() + n, 1); r.setDate(Math.min(d.getDate(), new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate())); return r; };
const inRange = (d, a, b) => Boolean(a && b) && startOfDay(a) <= startOfDay(b) && d >= startOfDay(a) && d <= startOfDay(b);
const ordinal = (n) => { const s = n % 100; if (s >= 11 && s <= 13) return `${n}th`; return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`; };
/** date-fns 'PPPP' in en-US: "Monday, September 28th, 2026". */
const longDate = (d) => `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${ordinal(d.getDate())}, ${d.getFullYear()}`;
/** date-fns 'dd MMM, yyyy' in en-US: "14 Sep, 2026" — the format the Purchase Orders field asks for. */
export const formatPickerDate = (d) => `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].slice(0, 3)}, ${d.getFullYear()}`;
/** react-datepicker's input text for a range: "start - end", "start - " while picking the end. */
export const formatRange = ([a, b]) => (a ? `${formatPickerDate(a)} - ${b ? formatPickerDate(b) : ''}` : '');

export function createRangePicker({ wrapper, input, onChange, onClose = () => {} }) {
  const st = { open: false, month: null, pre: null, hover: null, start: null, end: null };
  let portal = null;
  let refocusing = false;

  function dayHtml(day, month) {
    const d = day;
    const selecting = st.hover ?? st.pre;
    const today = sameDay(d, new Date());
    const keyboard = sameDay(d, st.pre);
    const rangeStart = Boolean(st.start && st.end) && sameDay(d, st.start);
    const rangeEnd = Boolean(st.start && st.end) && sameDay(d, st.end);
    const inR = inRange(d, st.start, st.end);
    const inSel = Boolean(st.start && !st.end && selecting && startOfDay(selecting) >= startOfDay(st.start)) && inRange(d, st.start, selecting);
    const selStart = inSel && sameDay(d, st.start);
    const selEnd = inSel && sameDay(d, selecting);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const outside = d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear();
    const c = ['react-datepicker__day', `react-datepicker__day--${String(d.getDate()).padStart(3, '0')}`];
    if (keyboard) c.push('react-datepicker__day--keyboard-selected');
    if (rangeStart) c.push('react-datepicker__day--range-start');
    if (rangeEnd) c.push('react-datepicker__day--range-end');
    if (inR) c.push('react-datepicker__day--in-range');
    if (inSel) c.push('react-datepicker__day--in-selecting-range');
    if (selStart) c.push('react-datepicker__day--selecting-range-start');
    if (selEnd) c.push('react-datepicker__day--selecting-range-end');
    if (today) c.push('react-datepicker__day--today');
    if (weekend) c.push('react-datepicker__day--weekend');
    if (outside) c.push('react-datepicker__day--outside-month');
    return `<div class="${c.join(' ')}" tabindex="${keyboard ? 0 : -1}" aria-label="Choose ${longDate(d)}" role="option" title="" aria-disabled="false"${today ? ' aria-current="date"' : ''} aria-selected="${inR}" data-dp-day="${d.getFullYear()}-${d.getMonth()}-${d.getDate()}">${d.getDate()}</div>`;
  }

  function monthHtml() {
    const m = st.month;
    const first = new Date(m.getFullYear(), m.getMonth(), 1);
    let week = addDays(first, -first.getDay());
    const weeks = [];
    // Month.renderWeeks, not fixedHeight: a week is drawn while any of its days is in the month.
    do {
      weeks.push(`<div class="react-datepicker__week">${Array.from({ length: 7 }, (_, i) => dayHtml(addDays(week, i), m)).join('')}</div>`);
      week = addDays(week, 7);
    } while (week.getMonth() === m.getMonth() || addDays(week, 6).getMonth() === m.getMonth());
    const ym = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
    return `<div class="react-datepicker__month" aria-label="month  ${ym}" role="listbox" data-dp-month>${weeks.join('')}</div>`;
  }

  function html() {
    return `<div><div class="react-datepicker__tab-loop"><div class="react-datepicker__tab-loop__start" tabindex="0"></div>`
      + `<div class="react-datepicker-popper date-picker-popper-fixed" data-placement="bottom-end" style="position: absolute; inset: 0px 0px auto auto;"><div style="display: contents;"><div class="react-datepicker">`
      + `<div class="react-datepicker__triangle" style="position: absolute; left: 0px;"></div><span role="alert" aria-live="polite" class="react-datepicker__aria-live"></span>`
      + `<button type="button" class="react-datepicker__navigation react-datepicker__navigation--previous" aria-label="Previous Month" data-dp-nav="-1"><span class="react-datepicker__navigation-icon react-datepicker__navigation-icon--previous">Previous Month</span></button>`
      + `<button type="button" class="react-datepicker__navigation react-datepicker__navigation--next" aria-label="Next Month" data-dp-nav="1"><span class="react-datepicker__navigation-icon react-datepicker__navigation-icon--next">Next Month</span></button>`
      + `<div class="react-datepicker__month-container"><div class="react-datepicker__header "><div class="react-datepicker__current-month">${esc(MONTHS[st.month.getMonth()])} ${st.month.getFullYear()}</div><div class="react-datepicker__header__dropdown react-datepicker__header__dropdown--scroll"></div>`
      + `<div class="react-datepicker__day-names">${SHORT.map((s) => `<div class="react-datepicker__day-name">${s}</div>`).join('')}</div></div>${monthHtml()}</div>`
      + `</div></div></div><div class="react-datepicker__tab-loop__end" tabindex="0"></div></div></div>`;
  }

  /**
   * popper.js v2, placement bottom-end, strategy absolute, gpuAcceleration + adaptive. Computed when
   * the calendar opens and then kept: popper updates on scroll and resize, not when the field under
   * it changes width (the clear button appearing after the first pick leaves the calendar where it
   * was, as it does in production).
   */
  let placed = null;
  function place() {
    if (placed) { applyPlacement(placed); return; }
    const popper = portal.querySelector('.react-datepicker-popper');
    const cal = portal.querySelector('.react-datepicker');
    const tri = portal.querySelector('.react-datepicker__triangle');
    const r = wrapper().getBoundingClientRect();
    const w = popper.offsetWidth;
    const h = popper.offsetHeight;
    const dpr = window.devicePixelRatio || 1;
    const round = (v) => Math.round(v * dpr) / dpr || 0;
    const cw = document.documentElement.clientWidth;
    const ch = document.documentElement.clientHeight;
    let x = r.left + r.width - w;
    x = Math.max(0, Math.min(x, cw - w)); // preventOverflow on the main axis
    // flip: below unless it does not fit there and fits above.
    const top = r.bottom + h > ch && r.top - h >= 0;
    const right = cw - (x + w);
    // The arrow modifier: the reference's centre, in the arrow's offset parent (the calendar).
    const startDiff = x - r.left;
    const endDiff = r.width + r.left - x - w;
    const size = cal.clientWidth;
    const center = size / 2 + (endDiff / 2 - startDiff / 2);
    placed = {
      placement: top ? 'top-end' : 'bottom-end',
      inset: top ? 'auto 0px 0px auto' : '0px 0px auto auto',
      transform: top ? `translate(${-round(right)}px, ${-round(ch - r.top - window.scrollY)}px)` : `translate(${-round(right)}px, ${round(r.bottom + window.scrollY)}px)`,
      triangle: `translate(${round(Math.max(0, Math.min(center, size)))}px, 0px)`,
    };
    applyPlacement(placed);
  }
  function applyPlacement(p) {
    const popper = portal.querySelector('.react-datepicker-popper');
    popper.setAttribute('data-placement', p.placement);
    popper.style.inset = p.inset;
    popper.style.transform = p.transform;
    portal.querySelector('.react-datepicker__triangle').style.transform = p.triangle;
  }

  function render() {
    if (!st.open) { if (portal) portal.innerHTML = ''; return; }
    if (!portal) {
      portal = document.getElementById('root-portal') || Object.assign(document.createElement('div'), { id: 'root-portal' });
      if (!portal.isConnected) document.body.appendChild(portal);
    }
    portal.innerHTML = html();
    place();
  }

  function renderDays() {
    const m = portal?.querySelector('[data-dp-month]');
    if (!m) return;
    const tpl = document.createElement('template');
    tpl.innerHTML = monthHtml();
    // Patch classes only — the day nodes stay the ones under the pointer.
    const next = tpl.content.querySelectorAll('.react-datepicker__day');
    m.querySelectorAll('.react-datepicker__day').forEach((el, i) => {
      for (const a of ['class', 'tabindex', 'aria-selected']) if (el.getAttribute(a) !== next[i].getAttribute(a)) el.setAttribute(a, next[i].getAttribute(a));
    });
  }

  function open() {
    if (st.open) return;
    st.open = true;
    placed = null;
    st.pre = st.start || startOfDay(new Date());
    st.month = new Date(st.pre.getFullYear(), st.pre.getMonth(), 1);
    st.hover = null;
    render();
  }
  function close() {
    if (!st.open) return;
    st.open = false;
    st.hover = null;
    render();
    onClose();
  }

  function pick(day) {
    let next;
    if (!st.start || st.end || startOfDay(day) < startOfDay(st.start)) next = [day, null];
    else next = [st.start, day];
    st.start = next[0]; st.end = next[1];
    st.pre = day;
    onChange(next);
    if (next[1]) close(); else render();
    // react-datepicker hands focus back to its input (without reopening); the host then selects
    // the field's text.
    const el = input();
    refocusing = true;
    el.focus();
    el.select();
    refocusing = false;
  }

  document.addEventListener('mousedown', (e) => {
    if (!st.open) return;
    if (portal?.contains(e.target)) {
      // Days are not buttons: keep the input focused while one is pressed.
      if (e.target.closest('[data-dp-day]')) e.preventDefault();
      return;
    }
    if (wrapper()?.contains(e.target)) return;
    close();
  }, true);
  document.addEventListener('click', (e) => {
    if (wrapper()?.contains(e.target) && e.target.matches('input')) { open(); return; }
    if (!st.open || !portal?.contains(e.target)) return;
    const nav = e.target.closest('[data-dp-nav]');
    if (nav) {
      const n = Number(nav.dataset.dpNav);
      st.month = addMonths(st.month, n);
      st.pre = addMonths(st.pre, n);
      render();
      portal.querySelector(`[data-dp-nav="${n}"]`)?.focus();
      return;
    }
    const dayEl = e.target.closest('[data-dp-day]');
    if (dayEl) { const [y, m, d] = dayEl.dataset.dpDay.split('-').map(Number); pick(new Date(y, m, d)); }
  });
  document.addEventListener('focusin', (e) => { if (!refocusing && wrapper()?.contains(e.target) && e.target.matches('input')) open(); });
  document.addEventListener('keydown', (e) => { if (st.open && e.key === 'Escape') close(); });
  // popper's eventListeners modifier: scroll (any ancestor) and resize re-place the calendar.
  const replace = () => { if (st.open && portal) { placed = null; place(); } };
  window.addEventListener('resize', replace);
  document.addEventListener('scroll', replace, true);
  document.addEventListener('mouseover', (e) => {
    if (!st.open || !portal?.contains(e.target)) return;
    const dayEl = e.target.closest('[data-dp-day]');
    const inMonth = e.target.closest('[data-dp-month]');
    const hover = dayEl ? (() => { const [y, m, d] = dayEl.dataset.dpDay.split('-').map(Number); return new Date(y, m, d); })() : (inMonth ? st.hover : null);
    if (!sameDay(hover, st.hover) && (hover || st.hover)) { st.hover = hover; renderDays(); }
  });

  return {
    open, close,
    get isOpen() { return st.open; },
    setRange([a, b]) { st.start = a || null; st.end = b || null; if (st.open) renderDays(); },
  };
}

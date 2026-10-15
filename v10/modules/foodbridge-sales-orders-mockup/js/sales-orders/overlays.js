/*
  Everything that floats above the screen, rendered into the screen's own portal container (as the
  product portals into its own root): the Bulk menu, the Smart Insights card, the date-range
  calendar, and toasts. Positions are computed from the anchor exactly as the product computes
  them, so the overlay lands on the same pixel.
*/
import { fi, lucide } from '../components/icons.js';
import { esc, cls } from '../components/dom.js';

// ── Bulk orders menu ────────────────────────────────────────────────────────────────────────
/**
 * @param pos  null on the first frame: the product renders the menu at top 0 / right 0 and moves
 *             it under the button one frame later (its position is set in an effect), and that
 *             first paint decides how the layer rasterises — so the prototype opens it the same way.
 */
export function bulkMenu(m, anchor, pos) {
  const r = anchor.getBoundingClientRect();
  const L = esc(m.label);
  const top = pos ? r.bottom + 4 : 0;
  const right = pos ? window.innerWidth - r.right : 0;
  return `<div data-overlay="bulk" style="position: fixed; top: ${top}px; right: ${right}px; z-index: 9999;" class="w-56 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">
    <button type="button" data-act="bulk-pick" data-mode="STANDARD" class="w-full flex items-start gap-3 px-4 py-3 text-sm text-left text-gray-700 hover:bg-emerald-50 transition">${lucide('file-spreadsheet', { cls: 'h-4 w-4 shrink-0 mt-0.5 text-emerald-600' })}<div><div class="font-medium">Bulk <!---->${L}</div><div class="text-xs text-gray-400 mt-0.5">Create regular bulk orders</div></div></button>
    <div class="border-t border-gray-100"></div>
    <button type="button" data-act="bulk-pick" data-mode="ROUTE" class="w-full flex items-start gap-3 px-4 py-3 text-sm text-left text-gray-700 hover:bg-indigo-50 transition">${lucide('route', { cls: 'h-4 w-4 shrink-0 mt-0.5 text-indigo-500' })}<div><div class="font-medium">Route Bulk <!---->${L}</div><div class="text-xs text-gray-400 mt-0.5">Create orders for route delivery</div></div></button>
  </div>`;
}

// ── Google Sheet mode menu (GoogleSheetToolbar) ─────────────────────────────────────────────
/** Placed like the Bulk menu: at 0/0 on its first frame, then under the button (an effect sets it). */
export function gsheetMenu(anchor, pos) {
  const r = anchor.getBoundingClientRect();
  const item = (mode, hover, color, title, sub) => `<button type="button" data-act="gsheet-pick" data-mode="${mode}" class="w-full flex items-start gap-3 px-4 py-3 text-sm text-left text-gray-700 ${hover} transition">${lucide('file-spreadsheet', { cls: `h-4 w-4 shrink-0 mt-0.5 ${color}` })}<div><div class="font-medium">${title}</div><div class="text-xs text-gray-400 mt-0.5">${sub}</div></div></button>`;
  return `<div data-overlay="gsheet" style="position: fixed; top: ${pos ? r.bottom + 4 : 0}px; right: ${pos ? window.innerWidth - r.right : 0}px; z-index: 9999;" class="w-56 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden">${item('current', 'hover:bg-emerald-50', 'text-emerald-600', 'New / Current Orders', 'Export &amp; sync live orders')}<div class="border-t border-gray-100"></div>${item('history', 'hover:bg-indigo-50', 'text-indigo-500', 'Historical Orders', 'Import past order data')}</div>`;
}

// ── Invoice print menu ──────────────────────────────────────────────────────────────────────
export function invoiceMenu(button, testId) {
  const r = button.getBoundingClientRect();
  const item = (act, label, suffix) => `<button data-act="${act}" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap" data-testid="${testId}-${suffix}">${fi('printer', { size: 14, cls: 'flex-shrink-0' })}${label}</button>`;
  return `<div data-overlay="invoice" style="position: fixed; top: ${r.bottom + 4}px; right: ${window.innerWidth - r.right}px; z-index: 99999; min-width: 210px;" class="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">${item('invoice-a4', 'A4 Print', 'a4')}<div class="border-t border-gray-100"></div>${item('invoice-thermal', 'Thermal Print', 'thermal')}</div>`;
}

// ── Smart Insights card ─────────────────────────────────────────────────────────────────────
/** Where the card goes for an icon: below it, flipped above when it would overflow, kept on screen. */
export function insightPosition(iconEl) {
  const rect = iconEl.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = 320;
  const estimated = 400;
  let top = rect.bottom + 8;
  let left = rect.left;
  if (top + estimated > vh) {
    top = rect.top - estimated - 8;
    if (top < 16) top = Math.max(16, vh - estimated - 16);
  }
  if (left + width > vw - 16) left = vw - width - 16;
  left = Math.max(16, left);
  return { top, left };
}

const SEV = {
  critical: ['bg-red-50 border-l-red-500', 'text-red-900'],
  high: ['bg-amber-50 border-l-amber-500', 'text-amber-900'],
  warning: ['bg-orange-50 border-l-orange-500', 'text-orange-900'],
  medium: ['bg-yellow-50 border-l-yellow-500', 'text-yellow-900'],
  success: ['bg-emerald-50 border-l-emerald-500', 'text-emerald-900'],
  info: ['bg-sky-50 border-l-sky-500', 'text-sky-900'],
};
const sev = (s) => SEV[s] || ['bg-blue-50 border-l-blue-500', 'text-blue-900'];

export function insightCard(m, order, pos) {
  const items = m.insights(order);
  const body = items.length ? items.map((it, i) => `<div data-testid="order-insight-item-${order.id}-${i}" data-status="${it.severity}" class="p-3 rounded border-l-4 transition-all duration-200 overflow-hidden ${sev(it.severity)[0]}">
      <div class="flex items-start gap-2 mb-1.5">${it.severity === 'critical' ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white whitespace-nowrap flex-shrink-0">URGENT</span>' : ''}${it.severity === 'high' ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-600 text-white whitespace-nowrap flex-shrink-0">HIGH</span>' : ''}<h4 class="text-xs font-bold break-words flex-1 min-w-0 leading-tight ${sev(it.severity)[1]}">${esc(it.title)}</h4></div>
      <p class="text-xs text-slate-700 leading-snug break-words mb-2">${esc(it.message)}</p>
      ${it.action ? `<div class="flex items-center gap-1.5 pt-2 border-t border-slate-200"><span class="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded flex items-center gap-1"><svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>${esc(it.action)}</span></div>` : ''}
    </div>`).join('')
    : `<div data-testid="order-insights-empty-${order.id}" class="py-8 px-4 text-center">${fi('zap', { cls: 'w-6 h-6 text-slate-300 mx-auto mb-2' })}<p class="text-xs text-slate-500">Analyzing order data...</p></div>`;
  return `<div data-overlay="insights" style="position: fixed; top: ${pos.top}px; left: ${pos.left}px; width: 320px; max-width: calc(100vw - 32px); z-index: 9999;" class="pointer-events-auto">
    <div data-testid="order-insights-card-${order.id}" class="bg-white rounded-lg shadow-2xl border-2 border-purple-200 overflow-hidden transition-all duration-150">
      <div class="bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-2.5"><div class="flex items-center gap-2"><div class="flex-shrink-0">${fi('zap', { cls: 'w-4 h-4 text-white' })}</div><div class="flex-1 min-w-0"><span class="text-sm font-bold text-white block">Smart Insights</span></div></div></div>
      <div class="p-3 space-y-2 max-h-96 overflow-y-auto overflow-x-hidden">${body}</div>
      <div class="px-3 py-2 bg-slate-100 border-t border-slate-200"><div class="flex items-center justify-center gap-1.5"><div class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div><p class="text-[9px] text-slate-600 font-medium">Foodbridge Analytics</p></div></div>
    </div>
  </div>`;
}

// ── Date range calendar (react-datepicker, range mode, placement bottom-end) ────────────────
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sameDay = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export function calendar(s, now) {
  const view = s.calMonth;
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const [start, end] = s.dateRange;
  const hover = s.calHover;
  const today = startOfDay(new Date(now));
  const keyboard = start || today;
  const weeks = [];
  const cursor = new Date(gridStart);
  do {
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(cursor);
      const weekend = d.getDay() === 0 || d.getDay() === 6;
      const outside = d.getMonth() !== view.getMonth();
      const inRange = start && end && d >= start && d <= end;
      const selecting = start && !end && hover && d >= start && d <= hover;
      const c = cls(
        'react-datepicker__day',
        `react-datepicker__day--${String(d.getDate()).padStart(3, '0')}`,
        sameDay(d, keyboard) && !inRange && 'react-datepicker__day--keyboard-selected',
        sameDay(d, start) && 'react-datepicker__day--selected react-datepicker__day--range-start',
        inRange && 'react-datepicker__day--in-range',
        sameDay(d, end) && 'react-datepicker__day--range-end',
        selecting && 'react-datepicker__day--in-selecting-range',
        sameDay(d, today) && 'react-datepicker__day--today',
        weekend && 'react-datepicker__day--weekend',
        outside && 'react-datepicker__day--outside-month',
      );
      days.push(`<div class="${c}" data-act="cal-day" data-date="${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}" tabindex="${sameDay(d, keyboard) ? 0 : -1}" role="option">${d.getDate()}</div>`);
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(`<div class="react-datepicker__week">${days.join('')}</div>`);
  } while (cursor.getMonth() === view.getMonth() && weeks.length < 6);
  return `<div class="react-datepicker">
    <div class="react-datepicker__triangle" data-dp-arrow style="position: absolute; left: 0px;"></div>
    <span role="alert" aria-live="polite" class="react-datepicker__aria-live"></span>
    <button type="button" data-act="cal-prev" class="react-datepicker__navigation react-datepicker__navigation--previous" aria-label="Previous Month"><span class="react-datepicker__navigation-icon react-datepicker__navigation-icon--previous">Previous Month</span></button>
    <button type="button" data-act="cal-next" class="react-datepicker__navigation react-datepicker__navigation--next" aria-label="Next Month"><span class="react-datepicker__navigation-icon react-datepicker__navigation-icon--next">Next Month</span></button>
    <div class="react-datepicker__month-container">
      <div class="react-datepicker__header "><div class="react-datepicker__current-month">${MONTHS[view.getMonth()]} ${view.getFullYear()}</div><div class="react-datepicker__header__dropdown react-datepicker__header__dropdown--scroll"></div>
        <div class="react-datepicker__day-names">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((n) => `<div class="react-datepicker__day-name">${n}</div>`).join('')}</div></div>
      <div class="react-datepicker__month" role="listbox">${weeks.join('')}</div>
    </div>
  </div>`;
}

/**
 * Floating placement "bottom-end": the calendar's right edge on the input's right edge, top on
 * its bottom, positioned against the page. The arrow points at the input's centre.
 */
export function placeCalendar(popper, inputEl) {
  const r = inputEl.getBoundingClientRect();
  const docW = document.documentElement.clientWidth;
  const x = r.right - docW;
  const y = r.bottom + window.scrollY;
  popper.style.cssText = `position: absolute; inset: 0px 0px auto auto; transform: translate(${Math.round(x)}px, ${Math.round(y)}px);`;
  const cal = popper.querySelector('.react-datepicker');
  const arrow = popper.querySelector('[data-dp-arrow]');
  if (cal && arrow) {
    // floating-ui measures the arrow against the calendar's padding box (inside its 1px border).
    const c = cal.getBoundingClientRect();
    const ax = Math.max(0, Math.min(c.width, r.left + r.width / 2 - c.left - cal.clientLeft));
    arrow.style.transform = `translate(${Math.round(ax)}px, 0px)`;
  }
}

// ── Toasts (react-toastify, top-center, light theme; error toasts are 335px wide) ───────────────
const SUCCESS = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="var(--toastify-icon-color-success)"><path d="M12 0a12 12 0 1012 12A12.014 12.014 0 0012 0zm6.927 8.2l-6.845 9.289a1.011 1.011 0 01-1.43.188l-4.888-3.908a1 1 0 111.25-1.562l4.076 3.261 6.227-8.451a1 1 0 111.61 1.183z"></path></svg>';
const ERROR = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="var(--toastify-icon-color-error)"><path d="M11.983 0a12.206 12.206 0 00-8.51 3.653A11.8 11.8 0 000 12.207 11.779 11.779 0 0011.8 24h.214A12.111 12.111 0 0024 11.791 11.766 11.766 0 0011.983 0zM10.5 16.542a1.476 1.476 0 011.449-1.53h.027a1.527 1.527 0 011.523 1.47 1.475 1.475 0 01-1.449 1.53h-.027a1.529 1.529 0 01-1.523-1.47zM11 12.5v-6a1 1 0 012 0v6a1 1 0 11-2 0z"></path></svg>';
const CLOSE = '<svg aria-hidden="true" viewBox="0 0 14 16"><path fill-rule="evenodd" d="M7.71 8.23l3.75 3.75-1.48 1.48-3.75-3.75-3.75 3.75L1 11.98l3.75-3.75L1 4.48 2.48 3l3.75 3.75L9.98 3l1.48 1.48-3.75 3.75z"></path></svg>';

/** One toast. Its progress bar's animation is its timer: the toast closes when it ends. */
export function toastItem(t, i, len, paused = false) {
  return `<div data-toast="${t.id}" class="Toastify__toast Toastify__toast-theme--light Toastify__toast--${t.type} Toastify__toast--close-on-click Toastify--animate Toastify__bounce-enter--top-center" style="${t.type === 'error' ? 'width: 335px; ' : ''}--nth: ${i + 1}; --len: ${len};" data-act="toast-close" data-id="${t.id}">
    <div role="alert" class="Toastify__toast-body"><div class="Toastify__toast-icon Toastify--animate-icon Toastify__zoom-enter">${t.type === 'error' ? ERROR : SUCCESS}</div><div>${esc(t.message)}</div></div>
    <button class="Toastify__close-button Toastify__close-button--light" type="button" aria-label="close">${CLOSE}</button>
    <div role="progressbar" aria-hidden="false" aria-label="notification timer" class="Toastify__progress-bar Toastify__progress-bar--animated Toastify__progress-bar-theme--light Toastify__progress-bar--${t.type}" style="animation-duration: 3000ms; animation-play-state: ${paused ? 'paused' : 'running'}; opacity: 1;"></div>
  </div>`;
}

export function toasts(list, paused = false) {
  if (!list.length) return '<div class="Toastify"></div>';
  return `<div class="Toastify"><div class="Toastify__toast-container Toastify__toast-container--top-center">${list.map((t, i) => toastItem(t, i, list.length, paused)).join('')}</div></div>`;
}

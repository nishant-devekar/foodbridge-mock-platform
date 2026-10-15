/*
  Generate Demand (tenant flag `demandReport`): pick orders, name the report, preview it.

  Which orders are offered is production's rule as it behaves: every order except those whose
  dispatches ALL sit in the workflow's `deliveryAllowedStatuses` — for this tenant that is
  "Dispatch Created", so orders still waiting to go out are the ones hidden and delivered ones stay.
  Reproduced as production does it (see README → Known differences).

  The preview's "Download Excel" and "Create Stock Request" are production's xlsx export and the
  Procurement module's request modal — outside this module's prototype; "Print" prints the report.
*/
import { renderDrawer } from '../components/drawer.js';
import { lucide, selectChevron, selectCross } from '../components/icons.js';
import { esc } from '../components/dom.js';
import { toTitleCase } from './model.js';
import { renderReport } from './demand-report.js';

const DATES = [['', 'All Dates'], ['today', 'Today'], ['yesterday', 'Yesterday'], ['thisWeek', 'This Week'], ['lastWeek', 'Last Week'], ['thisMonth', 'This Month']];
const BTN = 'align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none';
const OUTLINE = 'rounded-md text-sm text-gray-600 border-gray-200 border dark:text-gray-400 focus:outline-none rounded-lg border bg-gray-200 border-gray-200 px-4 w-full mr-3 flex items-center justify-center cursor-pointer h-10';
const PRIMARY = 'rounded-md text-sm text-white bg-green-600 border border-transparent active:bg-green-700 hover:bg-green-700';
/** windmill's primary Button: disabled, its hover/active colours give way to a faded look. */
const primary = (disabled) => (disabled ? 'rounded-md text-sm text-white bg-green-600 border border-transparent opacity-50 cursor-not-allowed' : PRIMARY);
const INPUT = 'block w-full h-10 border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none dark:text-gray-300 leading-5 rounded-md bg-gray-100 focus:bg-white dark:focus:bg-gray-700 focus:border-gray-200 border-gray-200 dark:border-gray-600 dark:focus:border-gray-500 dark:bg-gray-700';

/** The orders the drawer lists, newest first, before its own filters. */
function offered(m) {
  const done = m.workflow.deliveryAllowedStatuses || [];
  return [...m.data.orders].sort((a, b) => b.createdAt - a.createdAt).filter((o) => {
    const ds = m.dispatchesOf(o.id);
    return !(ds.length && done.length && ds.every((d) => done.includes(d.status)));
  });
}

function inDateWindow(o, win, now) {
  if (!win) return true;
  const n = new Date(now);
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const d = o.createdAt;
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
  const lastWeekStart = new Date(weekStart); lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(weekStart); lastWeekEnd.setDate(lastWeekEnd.getDate() - 1); lastWeekEnd.setHours(23, 59, 59, 999);
  const yEnd = new Date(yesterday); yEnd.setHours(23, 59, 59, 999);
  if (win === 'today') return d >= today;
  if (win === 'yesterday') return d >= yesterday && d <= yEnd;
  if (win === 'thisWeek') return d >= weekStart;
  if (win === 'lastWeek') return d >= lastWeekStart && d <= lastWeekEnd;
  if (win === 'thisMonth') return d >= new Date(n.getFullYear(), n.getMonth(), 1);
  return true;
}

export function visibleOrders(m, k, now) {
  const q = k.search.toLowerCase().trim();
  // A catalogue keeps the orders whose customer's phone is among that catalogue's customers'.
  const phones = k.catalogues.length ? new Set(m.data.customers.filter((c) => k.catalogues.includes(m.catalogueOf(c).id)).map((c) => String(c.phone))) : null;
  return offered(m).filter((o) => {
    const c = m.customerOf(o);
    if (phones && !phones.has(String(c?.phone || ''))) return false;
    if (!inDateWindow(o, k.date, now)) return false;
    return !q || String(o.number).toLowerCase().includes(q) || String(c?.name || '').toLowerCase().includes(q) || String(c?.phone || '').toLowerCase().includes(q);
  });
}

// ── react-select look-alikes (the drawer's two filters) ───────────────────────────────────
function select({ id, n, multi, value, placeholder, menu, clear }) {
  const shown = multi
    ? (value.length ? value.map((v) => `<div class="dr-multi"><div class="dr-multi-label">${esc(v.label)}</div><div class="dr-multi-remove" role="button" aria-label="Remove ${esc(v.label)}" data-act="dr-cat-remove" data-id="${v.value}"><svg height="14" width="14" viewBox="0 0 20 20" aria-hidden="true" focusable="false" class="rs-svg"><path d="M14.348 14.849c-0.469 0.469-1.229 0.469-1.697 0l-2.651-3.030-2.651 3.029c-0.469 0.469-1.229 0.469-1.697 0-0.469-0.469-0.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-0.469-0.469-0.469-1.228 0-1.697s1.228-0.469 1.697 0l2.652 3.031 2.651-3.031c0.469-0.469 1.228-0.469 1.697 0s0.469 1.229 0 1.697l-2.758 3.152 2.758 3.15c0.469 0.469 0.469 1.229 0 1.698z"></path></svg></div></div>`).join('') : '')
    : (value ? `<div class="dr-single">${esc(value.label)}</div>` : '');
  const empty = multi ? !value.length : !value;
  return `<div class="text-sm dr-container" data-dr-select="${id}"><span id="react-select-${n}-live-region" class="cs-a11y"></span><span aria-live="polite" aria-atomic="false" aria-relevant="additions text" role="log" class="cs-a11y"></span>
    <div class="dr-control${multi ? ' dr-control--multi' : ''}" data-act="dr-select-toggle" data-id="${id}"><div class="${multi ? 'dr-value dr-value--multi' : 'dr-value'}">${empty ? `<div class="dr-placeholder" id="react-select-${n}-placeholder">${placeholder}</div>` : shown}<div class="cs-input-wrap" data-value=""><input class="" autocapitalize="none" autocomplete="off" autocorrect="off" id="${id}" spellcheck="false" tabindex="0" type="text" aria-autocomplete="list" aria-expanded="${!!menu}" aria-haspopup="true" role="combobox"${empty ? ` aria-describedby="react-select-${n}-placeholder"` : ''} value="" style="color: inherit; background: 0px center; opacity: 1; width: 100%; grid-area: 1 / 2; font: inherit; min-width: 2px; border: 0px; margin: 0px; outline: 0px; padding: 0px;"></div></div>
    <div class="bc-indicators">${!empty ? `<div class="bc-ind" aria-hidden="true" data-act="${clear}">${selectCross()}</div>` : ''}<span class="cs-sep"></span><div class="bc-ind" aria-hidden="true">${selectChevron()}</div></div></div>${menu}</div>`;
}

function selectView(m, k, now) {
  const orders = visibleOrders(m, k, now);
  const L = m.label.toLowerCase();
  const catOptions = m.catalogues.map((c) => ({ value: c.id, label: c.name }));
  const menu = (options, isOn, act) => `<div class="dr-menu"><div class="dr-list" role="listbox">${options.map((o, i) => `<div class="dr-option${isOn(o) ? ' dr-option--selected' : ''}${i === k.focus ? ' dr-option--focused' : ''}" role="option" data-act="${act}" data-value="${o.value}" data-index="${i}">${esc(o.label)}</div>`).join('')}</div></div>`;
  const catMenu = k.menu === 'cat' ? menu(catOptions, (o) => k.catalogues.includes(o.value), 'dr-cat-pick') : '';
  const dateMenu = k.menu === 'date' ? menu(DATES.map(([value, label]) => ({ value, label })), (o) => o.value === k.date && !!k.date, 'dr-date-pick') : '';
  const catSelect = select({ id: 'demand-report-catalogue-filter-input', n: 3, multi: true, value: catOptions.filter((o) => k.catalogues.includes(o.value)), placeholder: 'All Catalogues', menu: catMenu, clear: 'dr-cat-clear' });
  const dateLabel = DATES.find(([v]) => v === k.date)?.[1];
  const dateSelect = select({ id: 'demand-report-date-filter-input', n: 4, multi: false, value: k.date ? { label: dateLabel } : null, placeholder: 'All Dates', menu: dateMenu, clear: 'dr-date-clear' });
  const allOn = orders.length > 0 && k.selected.length === orders.length;
  const rows = orders.length ? `<div class="space-y-2">${orders.map((o) => {
    const on = k.selected.includes(o.id);
    const c = m.customerOf(o);
    const name = esc(toTitleCase(c?.name || 'Unknown Customer'));
    const phone = esc(c?.phone || '-');
    const date = o.createdAt.toLocaleDateString('en-GB');
    return `<div data-act="dr-toggle" data-id="${o.id}" data-testid="demand-report-order-row-${o.id}" data-status="${on ? 'selected' : 'unselected'}" class="p-3 border rounded-lg cursor-pointer transition-all hover:shadow-sm ${on ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-gray-300 bg-white'}">`
      + `<div class="hidden md:flex items-center gap-3"><input type="checkbox"${on ? ' checked=""' : ''} data-dr-box data-testid="demand-report-order-checkbox-${o.id}" class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"><div class="flex items-center gap-2 flex-shrink-0 w-36">${lucide('hash', { cls: 'w-4 h-4 text-gray-400' })}<span class="text-sm font-semibold text-gray-900">${esc(o.number)}</span></div><div class="flex items-center gap-2 flex-1 min-w-0">${lucide('user', { cls: 'w-4 h-4 text-gray-400 flex-shrink-0' })}<span class="text-sm font-medium text-gray-800 truncate">${name}</span></div><div class="flex items-center gap-2 flex-shrink-0 w-32">${lucide('phone', { cls: 'w-4 h-4 text-gray-400' })}<span class="text-sm text-gray-700">${phone}</span></div><div class="flex items-center gap-2 flex-shrink-0 w-28">${lucide('calendar', { cls: 'w-4 h-4 text-gray-400' })}<span class="text-sm text-gray-700">${date}</span></div></div>`
      + `<div class="md:hidden flex items-start gap-3"><input type="checkbox"${on ? ' checked=""' : ''} data-dr-box data-testid="demand-report-order-checkbox-mobile-${o.id}" class="w-4 h-4 mt-1 text-green-600 border-gray-300 rounded focus:ring-green-500 shrink-0"><div class="min-w-0 flex-1"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-1.5 min-w-0">${lucide('hash', { cls: 'w-3.5 h-3.5 text-gray-400 shrink-0' })}<span class="text-sm font-semibold text-gray-900 truncate">${esc(o.number)}</span></div><span class="flex items-center gap-1 text-xs text-gray-500 shrink-0">${lucide('calendar', { cls: 'w-3 h-3 text-gray-400' })}${date}</span></div><div class="flex items-center gap-1.5 mt-1 min-w-0">${lucide('user', { cls: 'w-3.5 h-3.5 text-gray-400 shrink-0' })}<span class="text-sm text-gray-800 truncate">${name}</span></div><div class="flex items-center gap-1.5 mt-1 text-xs text-gray-600">${lucide('phone', { cls: 'w-3 h-3 text-gray-400 shrink-0' })}${phone}</div></div></div></div>`;
  }).join('')}</div>` : `<div data-testid="demand-report-orders-empty" class="text-center py-12">${lucide('file-text', { cls: 'w-16 h-16 text-gray-300 mx-auto mb-4' })}<p class="text-gray-500">${k.search ? `No ${L} found matching your search` : `No ${L} available`}</p></div>`;
  return `<div class="flex-1 overflow-hidden"><div class="h-full flex flex-col"><div class="px-4 py-3 border-b border-gray-200 bg-white"><div class="flex flex-col md:flex-row items-stretch md:items-center gap-2"><div class="flex-1 relative">${lucide('search', { cls: 'absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' })}<input class="${INPUT} pl-9" type="search" placeholder="Search by order #, name or contact..." data-testid="demand-report-search-input" value="${esc(k.search)}">${k.search ? `<button data-act="dr-search-clear" data-testid="demand-report-search-clear-btn" class="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors" aria-label="Clear search">${lucide('x', { cls: 'h-4 w-4' })}</button>` : ''}</div><div class="w-full md:min-w-[260px] md:max-w-[260px]">${catSelect}</div><div class="w-full md:min-w-[160px]">${dateSelect}</div></div>
    <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-200"><label class="flex items-center gap-2 cursor-pointer"><input type="checkbox"${allOn ? ' checked=""' : ''} data-dr-all data-testid="demand-report-select-all-checkbox" class="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"><span class="text-sm font-medium text-gray-700">Select All (<!---->${orders.length}<!----> orders)</span></label><span class="text-sm text-gray-600">${k.selected.length}<!----> selected</span></div></div>
    <div class="flex-1 overflow-y-auto p-4 md:p-6" data-dr-list>${rows}</div></div></div>
    <div class="p-4 md:p-6 border-t border-gray-200 bg-white"><div class="flex flex-row items-center justify-between gap-3 md:gap-4"><button class="${BTN} px-4 py-2 ${OUTLINE} px-4 md:px-6 whitespace-nowrap" type="button" data-act="dr-close" data-testid="demand-report-drawer-cancel-btn">Cancel</button><button class="${BTN} px-4 py-2 ${primary(!k.selected.length)} px-4 md:px-6 bg-green-500 hover:bg-green-600 text-white whitespace-nowrap"${k.selected.length ? '' : ' disabled=""'} type="button" data-act="dr-preview" data-testid="demand-report-drawer-preview-btn">Preview Demand Report (<!---->${k.selected.length}<!---->)</button></div></div>`;
}

function previewView(m, k, now) {
  const orders = offered(m).filter((o) => k.selected.includes(o.id));
  const sm = `${BTN} px-3 py-1`;
  return `<div class="flex-1 overflow-hidden"><div class="flex flex-col h-full" data-testid="demand-report-pdf"><div class="flex flex-col md:flex-row md:items-center md:justify-between gap-2 p-3 border-b border-gray-200 bg-white"><button class="${sm} ${OUTLINE} flex items-center justify-center gap-1.5 px-3 py-2 w-full md:w-auto" type="button" data-act="dr-back" data-testid="demand-report-pdf-back-btn">${lucide('arrow-left', { cls: 'w-4 h-4' })}<span class="text-sm">Back</span></button>
    <div class="grid grid-cols-3 md:flex md:items-center gap-2"><button class="${sm} ${PRIMARY} flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-2 md:px-4 py-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed" type="button" data-act="dr-stock" data-testid="demand-report-pdf-stock-request-btn">${lucide('shopping-cart', { cls: 'w-4 h-4' })}<span class="text-[11px] md:text-sm font-medium leading-tight text-center"><span class="md:hidden">Stock Request</span><span class="hidden md:inline">Create Stock Request</span></span></button><button class="${sm} ${PRIMARY} flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 bg-green-600 hover:bg-green-700 text-white px-2 md:px-4 py-2 whitespace-nowrap" type="button" data-act="dr-excel" data-testid="demand-report-pdf-excel-btn">${lucide('download', { cls: 'w-4 h-4' })}<span class="text-[11px] md:text-sm font-medium leading-tight"><span class="md:hidden">Excel</span><span class="hidden md:inline">Download Excel</span></span></button><button class="${sm} ${PRIMARY} flex flex-col md:flex-row items-center justify-center gap-1 md:gap-1.5 !bg-gray-600 hover:!bg-gray-700 text-white px-2 md:px-4 py-2 whitespace-nowrap" type="button" data-act="dr-print" data-testid="demand-report-pdf-print-btn">${lucide('printer', { cls: 'w-4 h-4' })}<span class="text-[11px] md:text-sm leading-tight">Print</span></button></div></div>
    <div class="flex-1 overflow-auto p-2 md:p-4 bg-gray-100 ">${renderReport(m, orders, k.reportName, now)}</div></div></div>`;
}

export function renderDemand(m, k, now) {
  const L = m.label.toLowerCase();
  const n = k.selected.length;
  const head = `<div class="flex items-center justify-between gap-3 p-4 md:p-6 border-b border-gray-200 bg-white"><div class="flex items-center gap-3 min-w-0"><div class="p-2 bg-green-50 rounded-lg shrink-0">${lucide('file-text', { cls: 'w-6 h-6 text-green-600' })}</div><div class="min-w-0"><h2 class="text-lg md:text-xl font-semibold text-gray-800 truncate">${k.preview ? 'Demand Report Preview' : 'Generate Demand Report'}</h2><p class="text-xs md:text-sm text-gray-500 truncate">${k.preview ? `Report for ${n} order${n > 1 ? 's' : ''}` : `Select ${esc(L)} to generate demand report`}</p></div></div><button data-act="dr-close" data-testid="demand-report-drawer-close-btn" class="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0">${lucide('x', { cls: 'w-5 h-5 text-gray-500' })}</button></div>`;
  const overlay = k.generating ? `<div data-testid="demand-report-drawer-generating-overlay" class="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50"><div class="flex flex-col items-center gap-4">${lucide('loader-circle', { size: 48, cls: 'animate-spin text-gray-400' })}<div class="text-center"><p class="text-lg font-semibold text-gray-700">Generating Demand Report...</p><p class="text-sm text-gray-500 mt-1">Processing <!---->${n}<!----> order<!---->${n > 1 ? 's' : ''}</p></div></div></div>` : '';
  return `<div class="flex flex-col h-full relative" data-testid="demand-report-drawer" data-status="${k.preview ? 'preview' : 'select'}">${head}${overlay}${k.preview ? previewView(m, k, now) : selectView(m, k, now)}</div>`;
}

/** The report-name prompt (production's FormModal), portalled beside the drawer. */
export const nameModal = (k) => `<div data-dr-modal class="fixed inset-0 bg-black/50" role="dialog" aria-modal="true" aria-labelledby=":r0:" style="z-index: 9999;"><div class="h-full w-full overflow-y-auto px-4 py-4" data-act="dr-name-backdrop"><div class="min-h-full flex items-start justify-center sm:items-center"><div data-testid="demand-report-name" class="relative w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 shadow-2xl overflow-visible"><div class="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700"><div><h2 id=":r0:" class="text-lg font-semibold text-gray-800 dark:text-gray-100">Enter Report Name</h2></div><button data-act="dr-name-cancel" data-testid="demand-report-name-close-btn" class="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition" aria-label="Close modal" type="button">${lucide('x', { cls: 'w-5 h-5' })}</button></div><div class="p-6 overflow-visible"><div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700 mb-2">Report Name</label><input class="${INPUT} w-full" type="text" placeholder="Enter report name" data-dr-name data-testid="demand-report-name-input" value="${esc(k.reportName)}"></div><div class="flex justify-end gap-3 pt-2"><button class="${BTN} px-4 py-2 ${OUTLINE}" type="button" data-act="dr-name-cancel" data-testid="demand-report-name-cancel-btn">Cancel</button><button class="${BTN} px-4 py-2 ${primary(!k.reportName.trim())} bg-green-500 hover:bg-green-600 text-white"${k.reportName.trim() ? '' : ' disabled=""'} type="button" data-act="dr-name-continue" data-testid="demand-report-name-continue-btn">Continue</button></div></div></div></div></div></div></div>`;

/** The drawer's state and interactions. */
export function demandFlow({ model: m, host, drawers, now, onClosed }) {
  let k = null;
  const fresh = () => ({ search: '', catalogues: [], date: '', selected: [], menu: null, focus: 0, naming: false, reportName: '', generating: false, preview: false });
  function render({ entering = false } = {}) {
    const active = document.activeElement;
    const key = active && host.contains(active) && (active.dataset?.testid || (active.id && `#${active.id}`));
    const caret = key && ['search', 'text'].includes(active.type) ? [active.selectionStart, active.selectionEnd] : null;
    const scroll = host.querySelector(':scope > [data-drawer] [data-dr-list]')?.scrollTop || 0;
    drawers.show(renderDrawer({ testId: 'drawer-demand-report', size: 'large', entering, content: renderDemand(m, k, now()) }), { entering });
    const list = host.querySelector(':scope > [data-drawer] [data-dr-list]');
    if (list) list.scrollTop = scroll;
    host.querySelector(':scope > [data-dr-modal]')?.remove();
    if (k.naming) host.insertAdjacentHTML('beforeend', nameModal(k));
    if (key) {
      const el = host.querySelector(key.startsWith('#') ? key : `[data-testid="${key}"]`);
      if (el) { el.focus({ preventScroll: true }); if (caret) try { el.setSelectionRange(...caret); } catch { /* */ } }
    }
  }
  const set = (patch) => { Object.assign(k, patch); render(); };
  const toggle = (id) => set({ selected: k.selected.includes(id) ? k.selected.filter((x) => x !== id) : [...k.selected, id] });
  function close() {
    const closed = renderDrawer({ testId: 'drawer-demand-report', size: 'large', open: false, content: renderDemand(m, { ...k, naming: false }, now()) });
    host.querySelector(':scope > [data-dr-modal]')?.remove();
    k = null;
    drawers.close(closed);
    onClosed?.();
  }
  function print() {
    // react-to-print: the report alone, in a print frame.
    const report = host.querySelector('[data-demand-print]');
    if (!report) return;
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position: fixed; width: 0; height: 0; border: 0;';
    document.body.appendChild(frame);
    frame.contentDocument.write(`<!doctype html><title>${esc(k.reportName.replace(/\//g, '-').replace(/\s+/g, '_'))}</title><style>@page { size: legal landscape; margin: 0; } html, body { margin: 0; padding: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; } .demand-page { break-after: page; }</style>${report.outerHTML}`);
    frame.contentDocument.close();
    setTimeout(() => { frame.contentWindow.print(); setTimeout(() => frame.remove(), 1000); }, 100);
  }
  const handlers = {
    'dr-close': () => close(),
    'dr-toggle': (e, el) => { if (e.target.matches('[data-dr-box]')) { e.stopPropagation(); } toggle(el.dataset.id); },
    'dr-search-clear': () => set({ search: '' }),
    'dr-select-toggle': (e, el) => {
      if (e.target.closest('[data-act="dr-cat-clear"], [data-act="dr-date-clear"], [data-act="dr-cat-remove"]')) return;
      const which = el.dataset.id === 'demand-report-date-filter-input' ? 'date' : 'cat';
      set({ menu: k.menu === which ? null : which, focus: 0 });
    },
    'dr-cat-pick': (_e, el) => { const v = el.dataset.value; set({ catalogues: k.catalogues.includes(v) ? k.catalogues.filter((x) => x !== v) : [...k.catalogues, v] }); }, // the menu stays open
    'dr-cat-remove': (e, el) => { e.stopPropagation(); set({ catalogues: k.catalogues.filter((x) => x !== el.dataset.id) }); },
    'dr-cat-clear': (e) => { e.stopPropagation(); set({ catalogues: [], menu: null }); },
    'dr-date-pick': (_e, el) => set({ date: el.dataset.value, menu: null }),
    'dr-date-clear': (e) => { e.stopPropagation(); set({ date: '', menu: null }); },
    'dr-preview': () => { if (k.selected.length) set({ naming: true, reportName: `Demand Report - ${new Date(now()).toLocaleDateString('en-GB')}` }); },
    'dr-name-cancel': () => set({ naming: false }),
    'dr-name-backdrop': (e) => { if (e.target === e.currentTarget || !e.target.closest('[data-testid="demand-report-name"]')) set({ naming: false }); },
    'dr-name-continue': () => {
      if (!k.reportName.trim()) return;
      set({ naming: false, generating: true });
      setTimeout(() => { if (k) set({ generating: false, preview: true }); }, 250);
    },
    'dr-back': () => set({ preview: false }),
    'dr-print': () => print(),
    'dr-excel': () => {}, // production writes an .xlsx with its XLSX library — outside the prototype
    'dr-stock': () => {}, // the Procurement module's stock-request modal — outside this module
  };
  function onInput(e) {
    if (!k) return false;
    const t = e.target;
    if (t.matches('[data-testid="demand-report-search-input"]')) { set({ search: t.value }); return true; }
    if (t.matches('[data-dr-name]')) { k.reportName = t.value; const b = host.querySelector('[data-testid="demand-report-name-continue-btn"]'); if (b) b.disabled = !k.reportName.trim(); return true; }
    return false;
  }
  function onChange(e) {
    if (!k || !e.target.matches('[data-dr-all]')) return false;
    const ids = visibleOrders(m, k, now()).map((o) => o.id);
    set({ selected: k.selected.length === ids.length ? [] : ids });
    return true;
  }
  return {
    handlers, onInput, onChange,
    isOpen: () => !!k,
    open() { k = fresh(); render({ entering: true }); },
    close,
    onMouseDown(e) { if (k?.menu && !e.target.closest('[data-dr-select]')) set({ menu: null }); },
  };
}

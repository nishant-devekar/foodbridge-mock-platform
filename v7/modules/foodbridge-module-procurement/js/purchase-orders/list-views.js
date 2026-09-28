/*
  The list screen's views: state in, HTML out. Markup and classes follow production's components
  (SourcingOrderScreen, SourcingTable, SourcingOrderCardList, PurchaseForecastBanner,
  CustomPagination, NotFound, TableLoading) and the Windmill components they wrap, class for class.

  `<!---->` marks a boundary between two JSX text nodes ({a} text {b} renders as separate DOM text
  nodes, and the browser shapes them separately) — kept so the text lays out exactly as production's.
*/
import { esc, cls, attr } from '../components/dom.js';
import { fi, lucide } from '../components/icons.js';
import { NO_RESULT_SVG } from '../components/no-result.js';
import { orderTotal, statusControl, documentState, supplierChip, STATUS_THEME, fmtDate, fmtTime, forecastStats } from './model.js';

const T = '<!---->';
const MONEY_SPACE = ' ';

// Windmill (with the host's myTheme) — resolved class strings.
export const W = {
  input: 'block w-full h-10 border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none dark:text-gray-300 leading-5 rounded-md bg-gray-100 focus:bg-white dark:focus:bg-gray-700 focus:border-gray-200 border-gray-200 dark:border-gray-600 dark:focus:border-gray-500 dark:bg-gray-700',
  button: 'align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-4 py-2 rounded-md text-sm text-white bg-green-600 border border-transparent active:bg-green-700 hover:bg-green-700',
  card: 'min-w-0 rounded-lg overflow-hidden bg-white dark:bg-gray-800',
  tableContainer: 'w-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg',
  thead: 'text-sm font-medium tracking-wide text-left text-zinc-500 uppercase border-b border-gray-200 dark:border-gray-700 bg-white dark:text-gray-400 dark:bg-gray-800',
  td: 'px-4 py-2',
  tbody: 'bg-white divide-y divide-gray-100 dark:divide-gray-700 dark:bg-gray-800 text-gray-800 dark:text-gray-400',
  tfoot: 'px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white text-gray-500 dark:text-gray-400 dark:bg-gray-800',
};

const skeleton = (cls2, style) => `<span class="react-loading-skeleton ${cls2}" style="${style}">‌</span>`;

// ── Forecast banner (PurchaseForecastBanner) ────────────────────────────────────────────────────
export function forecastBanner(f, host) {
  if (f.loading) {
    return `<div data-testid="purchase-forecast-banner-loading"><span aria-live="polite" aria-busy="true">${skeleton('rounded-xl mb-5', 'height: 104px; --base-color: #f1f5f9; --highlight-color: #e2e8f0;')}<br></span></div>`;
  }
  if (f.unavailable) return '';
  const s = forecastStats(f.data);
  if (s.count === 0) return '';
  const unit = (r) => host.getOrderingUnitFromUnitIndex(r.measurement, 0);
  const mobileItems = s.topItems.map((r) => `<div class="flex items-center justify-between gap-3 text-xs"><span class="flex items-center gap-2 min-w-0"><span class="w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.severity === 'red' ? 'bg-red-500' : 'bg-amber-400'}"></span><span class="text-slate-700 truncate">${esc(r.product)}</span></span><span class="font-semibold text-orange-600 flex-shrink-0 whitespace-nowrap">${r.recommendedPurchase}${T} ${T}${esc(unit(r))}</span></div>`).join('');
  const deskItems = s.topItems.map((r) => `<div class="flex items-center justify-between gap-6 text-sm"><span class="flex items-center gap-2 min-w-0"><span class="w-2 h-2 rounded-full flex-shrink-0 ${r.severity === 'red' ? 'bg-red-500' : 'bg-amber-400'}"></span><span class="text-slate-700 truncate">${esc(r.product)}</span></span><span class="font-semibold text-orange-600 flex-shrink-0 whitespace-nowrap">${r.recommendedPurchase}${T} ${T}${esc(unit(r))}</span></div>`).join('');
  const plural = s.count === 1 ? '' : 's';
  const open = f.mobileExpanded;
  return `<div data-testid="purchase-forecast-banner-mobile" class="md:hidden rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50/60 px-4 py-3 cursor-pointer select-none mb-5" role="button" tabindex="0" aria-expanded="${open}" data-act="forecast-mobile-toggle">`
    + `<div class="flex items-start justify-between gap-2"><div class="flex items-center gap-3 min-w-0"><div class="relative flex items-center justify-center w-11 h-11 rounded-full bg-orange-100 flex-shrink-0">${fi('FiShoppingCart', { cls: 'text-orange-500', size: 20 })}<span class="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold ring-2 ring-orange-50">!</span></div>`
    + `<div class="min-w-0"><p class="text-sm font-bold text-slate-800 leading-tight">Stock low: ${T}${s.count}${T} item${T}${plural}</p><p class="text-xs text-gray-500 mt-0.5">${open ? 'Order now to keep shelves full' : 'Tap for details'}</p></div></div>`
    + `${fi('FiChevronDown', { size: 16, cls: `flex-shrink-0 mt-1 text-orange-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}` })}</div>`
    + `<div class="overflow-hidden transition-all duration-300 ${open ? 'max-h-72 opacity-100 mt-3 pt-3 border-t border-dashed border-orange-200' : 'max-h-0 opacity-0'}">`
    + `<div class="flex items-center gap-5 mb-2.5"><div><p class="text-base font-extrabold text-orange-600 leading-none">${s.count}</p><p class="text-[9px] font-semibold uppercase tracking-wide text-gray-400 mt-1">Items to order</p></div><div><p class="text-base font-extrabold text-orange-600 leading-none">${s.totalQty}${T} units</p><p class="text-[9px] font-semibold uppercase tracking-wide text-gray-400 mt-1">Suggested qty</p></div></div>`
    + `<div class="flex items-center justify-between mb-1.5"><p class="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Top Items Low on Stock</p><p class="text-[10px] font-medium text-gray-400">Qty to restock</p></div>`
    + `<div class="space-y-1.5 mb-3">${mobileItems}</div>`
    + `<button type="button" data-testid="purchase-forecast-mobile-view-btn" class="w-full text-center py-2 rounded-lg border border-orange-300 text-orange-700 bg-white text-xs font-semibold" data-act="forecast-open">View Forecast Details</button></div></div>`
    + `<div class="hidden md:block rounded-xl border border-orange-100 bg-gradient-to-r from-orange-50 to-amber-50/60 px-6 py-5 sm:px-8 mb-5" data-testid="purchase-forecast-banner-desktop"><div class="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-0">`
    + `<div class="flex items-center gap-4 flex-shrink-0 lg:pr-6"><div class="relative flex items-center justify-center w-14 h-14 rounded-full bg-orange-100 flex-shrink-0">${fi('FiShoppingCart', { cls: 'text-orange-500', size: 24 })}<span class="absolute -top-0.5 -right-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] font-bold ring-2 ring-orange-50">!</span></div>`
    + `<div><p class="text-base font-bold text-slate-800">Stock to Reorder</p><p class="text-sm text-gray-600 mt-0.5"><span class="font-semibold text-orange-600">${s.count}</span>${T} ${T}item${T}${plural}${T} running low</p><p class="text-xs text-gray-400 mt-0.5">Order now to keep shelves full</p></div></div>`
    + `<div class="hidden lg:block w-px self-stretch bg-orange-100"></div>`
    + `<div class="flex items-center gap-3 flex-shrink-0 lg:px-6"><div class="flex items-center justify-center w-9 h-9 rounded-full bg-orange-100 flex-shrink-0">${fi('FiShoppingBag', { cls: 'text-orange-500', size: 16 })}</div><div><p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Items to Order</p><p class="text-xl font-bold text-orange-600 leading-tight mt-0.5">${s.count}</p></div></div>`
    + `<div class="hidden lg:block w-px self-stretch bg-orange-100"></div>`
    + `<div class="flex items-center gap-3 flex-shrink-0 lg:px-6"><div class="flex items-center justify-center w-9 h-9 rounded-full bg-orange-100 flex-shrink-0">${fi('FiPackage', { cls: 'text-orange-500', size: 16 })}</div><div><p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Suggested Order Qty</p><p class="text-xl font-bold text-orange-600 leading-tight mt-0.5">${s.totalQty}${T} units</p></div></div>`
    + `<div class="hidden lg:block w-px self-stretch bg-orange-100"></div>`
    + `<div class="lg:pl-6 flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6"><div class="flex-1 min-w-0"><div class="flex items-center justify-between mb-2"><p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Top Items Low on Stock</p><p class="text-[10px] font-medium text-gray-400">Qty to restock</p></div><div class="space-y-1.5">${deskItems}</div></div>`
    + `<button type="button" data-testid="purchase-forecast-desktop-view-btn" class="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-orange-300 text-orange-700 bg-white hover:bg-orange-50 font-medium text-sm transition-colors whitespace-nowrap" data-act="forecast-open">${fi('FiTrendingUp', { size: 15 })}View Forecast Details</button></div></div></div>`;
}

// ── Toolbar (the filter form) ───────────────────────────────────────────────────────────────────
export function toolbar(state, host, parts) {
  const label = host.menuLabel('sourcing-orders');
  const chips = (state.status ? 1 : 0) + (state.startDate || state.endDate ? 1 : 0);
  const hasFilters = Boolean(state.searchInput || state.status || state.startDate || state.endDate);
  const rawMapping = host.appProp.productRawMaterialMapping;
  return `<form class="sticky top-0 z-20 md:static bg-white rounded-xl border border-gray-200 shadow-sm px-3.5 py-2.5 md:px-4 md:py-3 mb-3 md:mb-5 grid grid-cols-1 gap-3 md:flex md:flex-row md:items-center" data-po-form>`
    + `<div class="flex items-center gap-2 md:contents"><div class="flex-1 relative min-w-0">${lucide('Search', { cls: 'absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' })}<input data-po-search class="${W.input} pl-9" type="search" name="search" data-testid="sourcing-search-input" placeholder="Search ${esc(label.toLowerCase())} by order id, supplier, item"></div>`
    + `<button type="button" aria-expanded="${state.mobileFiltersOpen}" data-testid="sourcing-mobile-filters-toggle-btn" class="md:hidden relative flex-shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors" data-act="mobile-filters">${fi('FiSliders', { size: 14 })}Filters${fi('FiChevronDown', { size: 14, cls: `transition-transform ${state.mobileFiltersOpen ? 'rotate-180' : ''}` })}${chips > 0 ? `<span class="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] font-bold">${chips}</span>` : ''}</button></div>`
    + `<div class="grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 md:contents ${state.mobileFiltersOpen ? 'grid' : 'hidden'}">`
    + `<div class="min-w-0 h-10 md:h-auto md:w-[176px]" data-po-status-slot>${parts.statusSelect}</div>`
    + `<div class="min-w-0 h-12 md:h-auto md:w-[272px] relative" data-testid="sourcing-date-range-field" data-po-date-field>${parts.dateField}</div>`
    + (hasFilters ? `<button type="button" aria-label="Clear filters" title="Clear filters" data-testid="sourcing-clear-filters-btn" class="md:hidden flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors" data-act="clear-filters">${fi('FiXCircle', { size: 16 })}</button>` : '')
    + `</div>`
    + (rawMapping ? `<button type="button" data-testid="sourcing-raw-material-calculator-btn" class="hidden md:inline-flex flex-shrink-0 items-center gap-2 h-10 px-3.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap" data-act="raw-material">${fi('FiFileText', { size: 14 })}Raw Material Calculator</button>` : '')
    + `<button class="${W.button} hidden md:inline-flex rounded-lg h-10 whitespace-nowrap flex-shrink-0 disabled:cursor-not-allowed" type="button" data-testid="sourcing-create-order-btn" data-act="create"><span class="mr-2">${fi('FiPlus')}</span>Create ${T}${esc(label)}</button>`
    + `</form>`;
}

/** The date-range field's inside (SourcingOrderScreen): calendar icon, the datepicker input, clear, quick ranges. */
export function dateField(state) {
  const has = Boolean(state.range[0] || state.range[1]);
  return `<div class="flex items-center h-12 md:h-10 w-full rounded-md border border-gray-300 bg-white hover:border-gray-400 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-colors">`
    + fi('FiCalendar', { cls: 'ml-3 text-gray-400 h-4 w-4 flex-shrink-0 pointer-events-none' })
    + `<div class="react-datepicker-wrapper flex-1 min-w-0"><div class="react-datepicker__input-container"><input type="text" placeholder="Filter by date range" class="w-full pl-2 pr-1 py-2 text-sm border-none focus:outline-none focus:ring-0 bg-transparent cursor-pointer${state.pickerOpen ? ' react-datepicker-ignore-onclickoutside' : ''}" value="${esc(state.rangeText)}" data-po-date-input></div></div>`
    + (has ? `<button type="button" aria-label="Clear date range" data-testid="sourcing-clear-date-range-btn" class="flex-shrink-0 p-1 mr-1 text-gray-400 hover:text-gray-600 transition-colors" data-act="clear-range">${fi('FiX', { size: 16 })}</button>` : '')
    + `<div class="hidden md:block w-px h-5 bg-gray-200 flex-shrink-0"></div>`
    + `<button type="button" aria-expanded="${state.quickRangeOpen}" aria-label="Quick date range shortcuts" title="Quick date range shortcuts" data-testid="sourcing-quick-range-toggle-btn" class="hidden md:inline-flex flex-shrink-0 items-center justify-center h-full w-9 rounded-r-md text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors" data-act="quick-range">${fi('FiChevronDown', { size: 16, cls: `transition-transform ${state.quickRangeOpen ? 'rotate-180' : ''}` })}</button>`
    + `</div>`
    + (state.quickRangeOpen ? `<div class="hidden md:block absolute right-0 top-full mt-1 z-30 w-40 rounded-lg border border-gray-200 bg-white shadow-lg py-1">${QUICK_RANGES.map((p) => `<button type="button" data-testid="sourcing-quick-range-${p.toLowerCase().replace(/\s+/g, '-')}-btn" class="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors" data-act="quick-range-pick" data-range="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : '');
}
export const QUICK_RANGES = ['Today', 'Last 7 days', 'Last 30 days', 'This month', 'Last month'];

// ── The list body (inside the Card) ─────────────────────────────────────────────────────────────
export function listBody(state, host, page) {
  if (state.loading) {
    const header = Array.from({ length: 8 }, () => skeleton('mx-1 my-1 dark:bg-gray-200 bg-gray-200', 'width: 160px; height: 40px; --base-color: #d7d7d7cd; --highlight-color: #f5f8faff;')).join('');
    const row = Array.from({ length: 8 }, () => skeleton('mx-1 my-1 dark:bg-gray-800 bg-gray-200', 'width: 160px; height: 20px; --base-color: #d7d7d7cd; --highlight-color: #E5E7EB;')).join('');
    const foot = skeleton('dark:bg-gray-800 bg-gray-200', 'width: 290px; height: 25px; --base-color: #d7d7d7cd; --highlight-color: #F9FAFB;');
    return `<div class="hidden md:block"><div class="${W.tableContainer} mb-8" data-testid="sourcing-list-loading"><div class="text-center"><span aria-live="polite" aria-busy="true">${header}</span>${Array.from({ length: 12 }, () => `<div><span aria-live="polite" aria-busy="true">${row}</span></div>`).join('')}</div><div class="${W.tfoot} flex justify-between"><span aria-live="polite" aria-busy="true">${foot}<br></span><span aria-live="polite" aria-busy="true">${foot}<br></span></div></div></div>`
      + `<div class="md:hidden space-y-3" data-testid="sourcing-list-loading-mobile">${Array.from({ length: 4 }, () => '<div class="h-32 rounded-xl border border-gray-200 bg-gray-100 animate-pulse dark:border-gray-600 dark:bg-gray-700"></div>').join('')}</div>`;
  }
  const label = host.menuLabel('sourcing-orders').toLowerCase();
  if (page.rows.length >= 1) {
    return `<div class="hidden md:block" data-testid="sourcing-table-list"><div class="${W.tableContainer} mb-8 bg-white rounded-lg shadow-sm border border-slate-200"><div class="w-full overflow-x-auto"><table class="w-full whitespace-nowrap">`
      + `<thead class="${W.thead} bg-slate-50 border-b-2 border-slate-200"><tr>${[['PO Number', 200], ['Supplier', 180], ['Items', 100], ['Amount', 130], ['Status', 140], ['Actions', 150]].map(([t, w]) => `<td class="${W.td} py-3.5 px-6 w-[${w}px]"><span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">${t}</span></td>`).join('')}</tr></thead>`
      + tableBody(state, host, page.rows)
      + `</table></div><div class="${W.tfoot}">${pagination(page, 'sourcing-table')}</div></div></div>`
      + `<div class="md:hidden" data-testid="sourcing-card-list">${cardList(state, host, page.rows)}<div class="mt-3 rounded-xl border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800">${pagination(page, 'sourcing-card')}</div></div>`;
  }
  if (state.searchInput || state.status || state.startDate || state.endDate) {
    return notFound(`no ${esc(label)} match your current filters.`, 'sourcing-list-empty-filtered',
      `<button type="button" data-testid="sourcing-list-empty-clear-filters-btn" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-sm font-medium text-emerald-700 hover:bg-emerald-100 transition-colors" data-act="clear-filters">${fi('FiXCircle', { size: 14 })}Clear filters</button>`);
  }
  return notFound(`but no ${esc(label)} are available at the moment.`, 'sourcing-list-empty');
}

function notFound(title, testId, action) {
  return `<div class="text-center align-middle mx-auto p-5 my-5" data-testid="${testId}"><div class="flex justify-center"><img class="my-4 w-full max-w-xs sm:max-w-sm md:max-w-md" src="${NO_RESULT_SVG}" alt="no-result"></div><h2 class="text-lg md:text-xl lg:text-2xl xl:text-2xl text-center mt-2 font-medium font-serif text-gray-600">We're sorry, ${T}${title}</h2>${action ? `<div class="flex justify-center mt-4">${action}</div>` : ''}</div>`;
}

// ── CustomPagination ────────────────────────────────────────────────────────────────────────────
export function pagination(page, prefix) {
  const { current, totalPages, total } = page;
  const pages = [];
  if (totalPages <= 6) for (let i = 1; i <= totalPages; i += 1) pages.push(i);
  else {
    pages.push(1);
    if (current > 3) pages.push('left-ellipsis');
    for (let i = Math.max(2, current - 1); i <= Math.min(totalPages - 1, current + 1); i += 1) pages.push(i);
    if (current < totalPages - 2) pages.push('right-ellipsis');
    pages.push(totalPages);
  }
  const start = (current - 1) * 20 + 1;
  const end = Math.min(current * 20, total);
  const btn = (p) => (typeof p === 'string'
    ? '<span class="px-2 text-gray-500 dark:text-gray-400 font-medium">...</span>'
    : `<li><button type="button" data-testid="${prefix}-page-${p}" class="align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-3 py-1 rounded-md text-xs ${current === p ? 'text-white bg-green-500 hover:bg-green-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}" data-act="page" data-page="${p}">${p}</button></li>`);
  return `<div class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm"><span class="font-semibold tracking-wide uppercase text-xs" data-testid="${prefix}-summary">SHOWING ${T}${start}${T}–${T}${end}${T} OF ${T}${total}</span>`
    + `<div class="mt-2 sm:mt-0"><nav aria-label="Table navigation"><ul class="inline-flex items-center space-x-2">`
    + `<li><button${attr('disabled', current === 1)} data-testid="${prefix}-prev-btn" class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50" data-act="page" data-page="${current - 1}">‹</button></li>`
    + pages.map(btn).join('')
    + `<li><button${attr('disabled', current === totalPages)} data-testid="${prefix}-next-btn" class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50" data-act="page" data-page="${current + 1}">›</button></li>`
    + `</ul></nav></div></div>`;
}

// ── SourcingTable ───────────────────────────────────────────────────────────────────────────────
function tableBody(state, host, rows) {
  return `<tbody class="${W.tbody}">${rows.map((row) => tableRow(state, host, row)).join('')}</tbody>`;
}

function tableRow(state, host, row) {
  const { order, seller } = row;
  const id = order._id;
  const expanded = state.expanded.includes(id);
  const docs = documentState(order, host, state.addedDocuments.table[id]);
  const copied = state.copiedId === order.order_number;
  const sc = statusControl(order, host);
  const chip = seller?._sourceType ? supplierChip(seller) : null;
  const phone = seller?.phone || seller?.contact;
  const counts = state.fulfillmentCounts[id] || { dispatches: 0, deliveries: 0 };
  const meta = counts.dispatches > 0 || counts.deliveries > 0 || docs.needsInvoice;
  return `<tr class="group hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent transition-all duration-200 border-b border-slate-100" data-testid="sourcing-row-${id}" data-status="${esc(order.status)}">`
    // PO number
    + `<td class="${W.td} py-4 px-6 w-[200px]"><div class="flex flex-col gap-1.5"><div class="flex items-center gap-3">`
    + `<button class="p-1.5 -ml-1 hover:bg-slate-200 rounded-lg transition-all duration-200 hover:shadow-sm" aria-label="${expanded ? 'Collapse fulfillment' : 'Expand fulfillment'}" data-testid="sourcing-toggle-suborders-${id}" data-act="toggle-row" data-id="${id}">${fi(expanded ? 'FiChevronUp' : 'FiChevronDown', { cls: 'w-4 h-4 text-slate-600' })}</button>`
    + `<span data-testid="sourcing-order-number-${id}" class="text-sm font-semibold text-slate-900 tracking-tight">${esc(order.order_number)}</span>`
    + `<button class="p-1 rounded-md hover:bg-slate-100 transition-all duration-200 group/copy" title="${copied ? 'Copied!' : 'Copy Order Id'}" data-testid="sourcing-copy-id-${id}" data-act="copy-id" data-value="${esc(order.order_number)}">${copied ? fi('FiCheck', { cls: 'w-3.5 h-3.5 text-emerald-500' }) : fi('FiCopy', { cls: 'w-3.5 h-3.5 text-slate-400 group-hover/copy:text-slate-600' })}</button></div>`
    + (order.created_date ? `<div class="flex items-center gap-1 pl-10 text-slate-500">${fi('FiClock', { size: 11 })}<span class="text-xs">${fmtDate(order.created_date)}${T} ${T}·${T} ${T}${fmtTime(order.created_date)}</span></div>` : '')
    + (meta ? `<div class="flex items-center gap-3 pl-10 flex-wrap">`
      + (counts.dispatches > 0 ? `<div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><button data-testid="sourcing-dispatch-count-${id}" class="text-xs font-medium text-emerald-600" data-act="toggle-row" data-id="${id}">${counts.dispatches}${T} dispatch${T}${counts.dispatches > 1 ? 'es' : ''}</button></div>` : '')
      + (counts.deliveries > 0 ? `<div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-purple-500"></div><button data-testid="sourcing-delivery-count-${id}" class="text-xs font-medium text-purple-600" data-act="toggle-row" data-id="${id}">${counts.deliveries}${T} deliver${T}${counts.deliveries > 1 ? 'ies' : 'y'}</button></div>` : '')
      + (docs.needsInvoice ? `<div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-amber-500"></div><button class="text-xs font-medium text-purple-600" title="Upload the supplier invoice for this delivered order" data-testid="sourcing-invoice-reminder-${id}" data-act="doc-invoice" data-id="${id}">Invoice Upload Pending</button></div>` : '')
      + `</div>` : '')
    + `</div></td>`
    // Supplier
    + `<td class="${W.td} py-4 px-6 w-[180px]"><div class="flex flex-col gap-1"><div class="flex flex-row items-center gap-2"><span class="text-sm font-medium text-slate-900">${esc(seller?.name || 'Unknown Supplier')}</span>`
    + (chip ? `<span class="inline-flex items-center w-fit px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${chip.classes}">${chip.label}</span>` : '')
    + `</div>${phone ? `<div class="flex items-center gap-1 text-slate-500">${fi('FiPhone', { size: 11 })}<span class="text-xs">${esc(phone)}</span></div>` : ''}</div></td>`
    // Items
    + `<td class="${W.td} py-4 px-6 w-[100px]"><span class="text-sm text-slate-700">${order.item_list?.length || 0}</span></td>`
    // Amount
    + `<td class="${W.td} py-4 px-6 w-[130px]"><div class="flex flex-col items-start gap-1"><span class="text-sm font-semibold text-slate-900">${esc(host.currency)}${T}${MONEY_SPACE}${T}${host.formatAmountValue(orderTotal(order, host))}</span>${order.tax !== undefined ? `<span class="text-xs text-gray-400">${esc(order.tax)}${T} incl. tax</span>` : ''}</div></td>`
    // Status
    + `<td class="${W.td} py-4 px-6 w-[140px]"><select${attr('disabled', sc.disabled)} data-testid="sourcing-status-select-${id}" class="w-full min-w-[140px] px-2.5 py-1.5 text-sm font-medium rounded-md border transition-all duration-200 ${!sc.disabled ? 'border-slate-300 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer' : 'border-slate-200 bg-slate-50 cursor-not-allowed text-slate-400'}" data-act-change="status" data-id="${id}">${sc.options.map((s) => `<option value="${esc(s)}"${s === sc.value ? ' selected' : ''}>${esc(sc.label(s))}</option>`).join('')}</select></td>`
    // Actions
    + `<td class="${W.td} py-4 px-6 w-[150px]">${documentsTrigger(state, row, docs)}</td>`
    + `</tr>`
    + (expanded ? `<tr class="bg-gray-50"><td colspan="6" class="${W.td} p-4">${state.renderFulfillment(row)}</td></tr>` : '');
}

/** The row's actions menu (RowActionsMenu): every action a row offers, in production's order. */
export function rowActions(order, docs) {
  const id = order._id;
  const actions = [{ icon: 'FiFileText', label: 'PO Document', color: 'text-blue-700 hover:bg-blue-50', testId: `sourcing-row-${id}-po-document-item`, act: 'doc-po' }];
  if (docs.showGoodsReceipt) actions.push({ icon: 'FiCheckCircle', label: 'Goods Received Receipt', color: 'text-emerald-700 hover:bg-emerald-50', testId: `sourcing-row-${id}-grn-item`, act: 'doc-grn' });
  if (docs.showSupplierDocuments) {
    actions.push({ icon: 'FiFileText', label: docs.invoiceCount > 0 ? 'Manage Invoices' : 'Add Invoice', color: docs.needsInvoice ? 'text-purple-700 bg-purple-50 hover:bg-purple-100 font-semibold' : 'text-purple-700 hover:bg-purple-50', testId: `sourcing-row-${id}-invoice-item`, act: 'doc-invoice' });
    for (const d of docs.otherDocs) actions.push({ icon: 'FiFileText', label: d.name || 'Document', color: 'text-gray-700 hover:bg-gray-100', testId: `sourcing-row-${id}-document-${d._id}-item`, act: 'doc-other', doc: d._id });
    actions.push({ icon: 'FiPlus', label: 'Add Document', color: 'text-gray-700 hover:bg-gray-100', testId: `sourcing-row-${id}-add-document-item`, act: 'doc-add' });
  }
  return actions;
}

function documentsTrigger(state, row, docs) {
  const id = row.order._id;
  const open = state.menu?.id === id;
  return `<div class="relative inline-block"><button type="button" aria-haspopup="menu" aria-expanded="${open}" data-testid="sourcing-row-${id}-documents-trigger-btn" class="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors" data-act="menu" data-id="${id}">${fi('FiFileText', { size: 14 })}Documents${fi('FiChevronDown', { size: 12, cls: `transition-transform ${open ? 'rotate-180' : ''}` })}${docs.needsInvoice ? '<span class="absolute -top-[0.5rem] -right-[0.5rem] w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white"></span>' : ''}</button></div>`;
}

/** The open actions menu, portalled to <body> at the position the trigger measured. */
export function actionsMenu(menu, actions) {
  return `<div class="fixed inset-0 z-[9998]" data-act="menu-close"></div><div style="position: fixed; top: ${menu.top}px; left: ${menu.left}px; width: 220px;" role="menu" class="z-[9999] overflow-hidden rounded-md bg-white shadow-lg border border-gray-100 focus:outline-none py-1">${actions.map((a, i) => `<button type="button" role="menuitem" data-testid="${a.testId}" class="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors ${a.color}" data-act="menu-pick" data-index="${i}">${fi(a.icon, { size: 15 })}${esc(a.label)}</button>`).join('')}</div>`;
}

// ── SourcingOrderCardList (phone) ───────────────────────────────────────────────────────────────
function cardList(state, host, rows) {
  return `<div class="flex flex-col gap-2">${rows.map((row) => card(state, host, row)).join('')}</div>`;
}

function card(state, host, row) {
  const { order, seller } = row;
  const id = order._id;
  const sc = statusControl(order, host);
  const theme = STATUS_THEME[(sc.value || '').toLowerCase()] || 'bg-slate-100 text-slate-500';
  const docs = documentState(order, host, state.addedDocuments.card[id]);
  const open = state.cardExpanded.includes(id);
  const phone = seller?.phone || seller?.contact;
  const n = order.item_list?.length || 0;
  const chip = seller?._sourceType ? supplierChip(seller) : null;
  let body = `<div class="px-3.5 py-3"><div class="flex items-center gap-2"><div class="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-emerald-50">${fi('FiFileText', { cls: 'text-emerald-600', size: 13 })}</div>`
    + `<p class="min-w-0 flex-1 text-[15px] font-bold text-slate-900 whitespace-nowrap"><span class="font-medium text-slate-400">PO${T}-</span>${esc(order.order_number)}</p>`
    + `<div class="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-transparent pl-2 py-1 ${sc.disabled ? 'pr-2' : 'pr-1.5'} ${theme}"><select${attr('disabled', sc.disabled)} data-testid="sourcing-card-status-select-${id}" class="appearance-none bg-transparent focus:outline-none text-[11px] font-semibold ${sc.disabled ? '' : 'cursor-pointer'}" data-act-change="status" data-id="${id}">${sc.options.map((s) => `<option value="${esc(s)}"${s === sc.value ? ' selected' : ''}>${esc(sc.label(s))}</option>`).join('')}</select>`
    + (!sc.disabled ? `<button type="button" tabindex="-1" aria-hidden="true" class="flex-shrink-0" data-act="status-picker" data-id="${id}">${fi('FiChevronDown', { cls: 'w-2.5 h-2.5' })}</button>` : '') + `</div>`
    + `<button type="button" aria-label="${open ? 'Collapse' : 'Expand'}" aria-expanded="${open}" data-testid="sourcing-card-toggle-expand-${id}" class="flex-shrink-0 p-1 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors" data-act="toggle-card" data-id="${id}">${fi('FiChevronDown', { cls: `w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}` })}</button></div>`
    + `<div class="mt-1.5 pl-9 flex items-center gap-2">${order.created_date ? `<span class="min-w-0 flex-1 truncate text-[11px] text-slate-400">${fmtDate(order.created_date, false)}${T} ${T}·${T} ${T}${fmtTime(order.created_date)}</span>` : ''}<span class="flex-shrink-0 text-[15px] font-bold text-slate-900">${esc(host.currency)}${T} ${T}${host.getNumberTwo(orderTotal(order, host))}</span></div>`
    + `<div class="mt-1 pl-9 flex items-start justify-between gap-2"><div class="min-w-0 flex flex-col gap-0.5"><span class="flex items-center gap-1 min-w-0 text-xs font-medium text-slate-700">${fi('FiHome', { size: 11, cls: 'text-slate-400 flex-shrink-0' })}<span class="truncate">${esc(seller?.name || 'Unknown Supplier')}</span>${chip ? `<span class="flex-shrink-0 text-[10px] font-medium text-slate-400 tracking-wide">${chip.label}</span>` : ''}</span>`
    + (phone ? `<span class="flex items-center gap-1 text-[11px] text-slate-400">${fi('FiPhone', { size: 10, cls: 'flex-shrink-0' })}${esc(phone)}</span>` : '') + `</div>`
    + `<span class="flex-shrink-0 inline-flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">${fi('FiPackage', { size: 11 })}${n}${T} item${T}${n === 1 ? '' : 's'}</span></div>`
    + (docs.needsInvoice ? `<button type="button" data-testid="sourcing-card-invoice-reminder-${id}" class="mt-1.5 ml-9 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 text-[11px] font-semibold" data-act="doc-invoice" data-id="${id}">${fi('FiFileText', { size: 12 })}Upload supplier invoice</button>` : '')
    + `</div>`;
  if (open) {
    const items = order.item_list || [];
    body += `<div class="border-t border-slate-100">`
      + (items.length > 0 ? `<div class="px-4 py-3"><div class="flex items-center justify-between px-1 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wide"><span>Items (${T}${items.length}${T})</span><span>Qty</span></div><div class="divide-y divide-slate-100">${items.map((it) => `<div class="flex items-center gap-3 py-2.5"><div class="flex items-center justify-center w-11 h-11 rounded-lg bg-slate-100 flex-shrink-0">${fi('FiPackage', { cls: 'text-slate-300', size: 16 })}</div><div class="min-w-0 flex-1"><p class="text-sm font-semibold text-slate-900 line-clamp-2">${esc(it.name)}</p>${it.articleNumber ? `<p class="text-xs text-slate-400 mt-0.5">Art no: ${T}${esc(it.articleNumber)}</p>` : ''}</div><span class="text-sm font-semibold text-slate-900 flex-shrink-0">${esc(it.qty)}${T} ${T}${esc(it.orderingUnit || it.measurement || '')}</span></div>`).join('')}</div></div>` : '')
      + `<div class="flex items-center justify-center flex-wrap gap-x-6 gap-y-2 py-3 border-t border-slate-100">`
      + `<button class="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors" title="View PO Document" data-testid="sourcing-card-row-${id}-po-document-btn" data-act="doc-po" data-id="${id}">${fi('FiFileText', { size: 16 })}PO${T} Document</button>`
      + (docs.showGoodsReceipt ? `<button class="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors" title="View Goods Received Receipt" data-testid="sourcing-card-row-${id}-grn-btn" data-act="doc-grn" data-id="${id}">${fi('FiFileText', { size: 16 })}Goods Received Receipt</button>` : '')
      + (docs.showSupplierDocuments ? `<div class="w-px h-5 bg-slate-200"></div>` : '')
      + (docs.showSupplierDocuments ? `<button type="button" class="inline-flex items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-700 transition-colors" title="${docs.invoiceCount > 0 ? 'View / Add Invoices' : 'Add Invoice'}" data-testid="sourcing-card-row-${id}-invoice-btn" data-act="doc-invoice" data-id="${id}">${fi('FiFileText', { size: 16 })}${docs.invoiceCount > 0 ? 'Manage Invoices' : 'Add Invoice'}</button>` : '')
      + (docs.showSupplierDocuments ? docs.otherDocs.map((d) => `<button type="button" class="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-700 transition-colors" title="${esc(d.name || 'Document')}" data-testid="sourcing-card-row-${id}-document-${d._id}-btn" data-act="doc-other" data-id="${id}" data-doc="${d._id}">${fi('FiFileText', { size: 16 })}${esc(d.name || 'Document')}</button>`).join('') : '')
      + (docs.showSupplierDocuments ? `<button type="button" class="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-700 transition-colors" title="Add Document" data-testid="sourcing-card-row-${id}-add-document-btn" data-act="doc-add" data-id="${id}">${fi('FiPlus', { size: 16 })}Add Document</button>` : '')
      + `</div></div>`;
  }
  return `<div data-testid="sourcing-card-row-${id}" data-status="${esc(sc.value)}" class="rounded-2xl bg-white border overflow-hidden transition-colors shadow-sm ${open ? 'border-emerald-400 shadow-emerald-100' : 'border-slate-200'}">${body}</div>`;
}

// ── The phone's sticky action bar ───────────────────────────────────────────────────────────────
export function mobileFooter(host) {
  const label = host.menuLabel('sourcing-orders');
  const inset = 'min(max(env(safe-area-inset-bottom, 0px), 6px), 20px)';
  const raw = host.appProp.productRawMaterialMapping;
  return `<div class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"><div class="flex items-stretch px-1 pt-1" style="padding-bottom: ${inset};">`
    + (raw ? `<div class="flex-1 flex items-center justify-center"><button type="button" title="Raw Material Calculator" data-testid="sourcing-mobile-raw-material-calculator-btn" class="relative group flex flex-col items-center justify-center gap-0.5 px-1 py-0.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition" data-act="raw-material">${fi('FiFileText', { cls: 'w-5 h-5' })}<span class="text-[10px] font-medium leading-none">Raw Material</span></button></div><div class="w-px bg-gray-200 dark:bg-gray-600 my-1.5"></div>` : '')
    + `<div class="flex-1 flex items-center justify-center"><button type="button" title="Create ${esc(label)}" data-testid="sourcing-mobile-create-order-btn" class="relative group flex flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-0.5 text-emerald-700 hover:bg-emerald-50 transition" data-act="create"><span class="rounded-lg bg-emerald-600 px-2.5 py-0.5 text-white">${fi('FiPlus', { cls: 'w-4 h-4' })}</span><span class="text-[10px] font-medium leading-none">Create</span></button></div>`
    + `</div></div><div class="md:hidden" style="height: calc(2.75rem + ${inset});"></div>`;
}

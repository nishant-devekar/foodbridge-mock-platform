/*
  Order Forecast (tenant flag `orderForecast`): a drawer with the stores that have order history
  on the left, and for the one picked, what it is likely to reorder — "Due now", "Coming up",
  "Dormant" — with a suggested quantity per product. "Add … to order" hands the picks to Create
  Order. The numbers are the module's own demand engine (model.forecast).
*/
import { renderDrawer } from '../components/drawer.js';
import { lucide } from '../components/icons.js';
import { esc } from '../components/dom.js';

const PAGE = 20;
const TABS = ['due', 'upcoming', 'lapsed'];
const STATUS = {
  due: { label: 'Due now', icon: 'bell', rail: 'bg-emerald-500', text: 'text-emerald-600', activeTab: 'border-emerald-500 text-emerald-700', badge: 'bg-emerald-50 text-emerald-700' },
  upcoming: { label: 'Coming up', icon: 'clock', rail: 'bg-amber-400', text: 'text-amber-600', activeTab: 'border-amber-400 text-amber-600', badge: 'bg-amber-100 text-amber-600' },
  lapsed: { label: 'Dormant', icon: 'moon', rail: 'bg-gray-300', text: 'text-gray-500', activeTab: 'border-gray-400 text-gray-600', badge: 'bg-gray-200 text-gray-600' },
};
const TIER_DOT = { high: 'bg-emerald-500', medium: 'bg-amber-400', low: 'bg-gray-300' };
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const roundQty = (n) => Math.max(0, Math.round(Number(n) || 0));
const roundQtyInit = (n) => { const raw = Number(n) || 0; return raw > 0 ? Math.max(1, Math.round(raw)) : 0; };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function metaLine(r) {
  const qty = round2(r.predictedQty);
  if (r.status === 'due') return `Usually ${qty} ${r.unit || ''} · every ~${r.intervalDays ?? '—'}d · ${r.daysSinceLast}d since last`;
  if (r.status === 'upcoming') {
    const due = r.daysUntilDue != null ? `due in ~${Math.max(r.daysUntilDue, 0)}d` : 'due soon';
    return `${due} · usually ${qty} ${r.unit || ''} every ~${r.intervalDays ?? '—'}d`;
  }
  return `Last ordered ${r.daysSinceLast}d ago · was ~${qty} ${r.unit || ''} every ~${r.intervalDays ?? '—'}d`;
}

const stateBlock = ({ icon, label, spin, tone, big, testId }) => `<div data-testid="${testId}" class="flex flex-col items-center justify-center text-center ${big ? 'py-20' : 'py-12'} px-6">${lucide(icon, { size: big ? 28 : 22, cls: `${spin ? 'animate-spin ' : ''}${tone === 'error' ? 'text-red-400' : 'text-gray-300'} mb-3` })}<p class="text-sm ${tone === 'error' ? 'text-red-500' : 'text-gray-400'} max-w-xs">${esc(label)}</p></div>`;

/** Everything the drawer shows, derived. */
function view(f) {
  const recs = f.forecast?.recommendations || [];
  const buckets = { due: [], upcoming: [], lapsed: [] };
  recs.forEach((r) => (buckets[r.status] || buckets.upcoming).push(r));
  const q = f.prodFilter.trim().toLowerCase();
  const visible = (buckets[f.tab] || []).filter((r) => !q || (r.name || r.articleNumber || '').toLowerCase().includes(q));
  const selectedItems = recs.filter((r) => f.picks[r.articleNumber]?.selected && (f.picks[r.articleNumber]?.qty || 0) > 0)
    .map((r) => ({ articleNumber: r.articleNumber, productId: r.productId, name: r.name, unit: r.unit, qty: f.picks[r.articleNumber].qty }));
  const allVisible = visible.length > 0 && visible.every((r) => f.picks[r.articleNumber]?.selected);
  return { buckets, visible, selectedItems, allVisible };
}

function productRow(f, r) {
  const s = STATUS[r.status] || STATUS.upcoming;
  const pick = f.picks[r.articleNumber];
  const on = !!pick?.selected;
  const qty = pick?.qty ?? roundQtyInit(r.predictedQty);
  const a = esc(r.articleNumber);
  return `<li data-testid="order-forecast-product-row-${a}" data-status="${r.status}" class="relative flex items-stretch rounded-xl border bg-white overflow-hidden transition ${on ? 'border-green-500 ring-1 ring-green-500/30' : 'border-gray-200 hover:border-gray-300'}"><span class="w-1 shrink-0 ${s.rail}" aria-hidden="true"></span>`
    + `<button type="button" data-act="fc-toggle" data-art="${a}" data-testid="order-forecast-product-toggle-${a}" data-status="${on ? 'selected' : 'unselected'}" class="flex items-start gap-3 flex-1 min-w-0 text-left px-3.5 py-3"><span class="mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${on ? 'bg-green-600 border-green-600 text-white' : 'border-gray-300 text-transparent'}">${lucide('check', { size: 13, stroke: 3 })}</span><span class="min-w-0 flex-1"><span class="flex items-center gap-2"><span class="text-sm font-semibold text-gray-800 truncate" title="${esc(r.name || '')}">${esc(r.name || r.articleNumber)}</span><span class="w-1.5 h-1.5 rounded-full shrink-0 ${TIER_DOT[r.confidenceTier] || TIER_DOT.low}" title="${esc(`${r.confidenceTier} confidence (${r.ordersCount} past orders)`)}"></span></span><span class="block text-xs text-gray-400 mt-1 truncate">${esc(metaLine(r))}</span></span></button>`
    + `<div class="flex items-center gap-1 pr-3 pl-1 shrink-0"><button data-act="fc-qty" data-art="${a}" data-step="-1" class="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100" aria-label="Decrease ${esc(r.name || '')}">${lucide('minus', { size: 13 })}</button><input type="number" inputmode="numeric" min="0" step="1" data-fc-qty="${a}" class="w-12 text-center text-sm font-medium tabular-nums border border-gray-200 rounded-md py-1 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500" aria-label="Quantity for ${esc(r.name || '')}" value="${qty}"><button data-act="fc-qty" data-art="${a}" data-step="1" class="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-100" aria-label="Increase ${esc(r.name || '')}">${lucide('plus', { size: 13 })}</button></div></li>`;
}

export function renderForecast(f) {
  const v = view(f);
  const customers = f.loadingCustomers ? stateBlock({ icon: 'loader-circle', spin: true, label: 'Loading customers…', testId: 'order-forecast-customers-loading' })
    : !f.customers.length ? stateBlock({ icon: 'package-search', label: 'No customers match that search.', testId: 'order-forecast-customers-empty' })
      : `<ul class="space-y-1">${f.customers.map((c) => {
        const active = f.selected?.buyerLocationId === c.buyerLocationId;
        return `<li><button data-act="fc-customer" data-id="${c.buyerLocationId}" data-testid="order-forecast-customer-row-${c.buyerLocationId}" data-status="${active ? 'selected' : 'unselected'}" class="w-full text-left px-3 py-2.5 rounded-lg transition flex items-center justify-between gap-2 ${active ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'hover:bg-gray-50'}"><span class="min-w-0"><span class="block text-sm font-medium truncate ${active ? 'text-emerald-600' : 'text-gray-700'}">${esc(c.name)}</span><span class="block text-[11px] text-gray-400 mt-0.5">${c.orderCount}<!----> orders · last <!---->${fmtDate(c.lastOrderDate)}</span></span><span class="w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-emerald-500' : 'bg-transparent'}"></span></button></li>`;
      }).join('')}${f.customers.length < f.total ? `<li data-fc-sentinel data-testid="order-forecast-customers-loading-more" class="flex items-center justify-center gap-2 py-3 text-xs text-gray-400">${lucide('loader-circle', { size: 13, cls: 'animate-spin' })}Loading more customers…</li>` : ''}</ul>`;
  const aside = `<aside class="${f.mobileView === 'detail' ? 'hidden' : 'flex'} md:flex flex-col w-full md:w-[18rem] lg:w-[20rem] shrink-0 bg-white border-r border-gray-100"><div class="px-5 pt-6 pb-3"><h2 class="text-base font-semibold text-gray-800 flex items-center gap-2">${lucide('store', { size: 17, cls: 'text-emerald-600' })} Customers</h2><p class="text-xs text-gray-400 mt-0.5">Pick one to see their reorder forecast</p></div><div class="px-5 pb-3"><div class="relative">${lucide('search', { size: 15, cls: 'absolute left-1 top-[0.75rem]  text-gray-400' })}<input placeholder="Search customers" data-testid="order-forecast-customer-search-input" class="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500" value="${esc(f.custSearch)}"></div></div><div data-fc-list class="flex-1 overflow-y-auto px-3 pb-4">${customers}</div></aside>`;

  let detail;
  if (!f.selected) {
    detail = `<div class="hidden md:flex flex-1 flex-col items-center justify-center text-center px-8 bg-gray-50/60"><div class="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">${lucide('store', { size: 26, cls: 'text-emerald-600' })}</div><h3 class="text-base font-semibold text-gray-700">Choose a customer</h3><p class="text-sm text-gray-400 mt-1 max-w-xs">Select a customer on the left to see what they're likely to reorder, how much, and when.</p></div>`;
  } else {
    const fc = f.forecast;
    const tabs = fc ? `<nav class="flex gap-1 mt-4 -mb-px" role="tablist">${TABS.map((t) => {
      const s = STATUS[t]; const n = v.buckets[t].length; const on = f.tab === t;
      return `<button role="tab" aria-selected="${on}"${n === 0 ? ' disabled=""' : ''} data-act="fc-tab" data-tab="${t}" data-testid="order-forecast-tab-${t}" class="group flex items-center gap-2 px-3 lg:px-4 py-2.5 text-sm font-medium border-b-2 transition disabled:opacity-40 disabled:cursor-not-allowed ${on ? s.activeTab : 'border-transparent text-gray-500 hover:text-gray-700'}">${lucide(s.icon, { size: 15, cls: on ? s.text : 'text-gray-400' })}${s.label}<span class="text-xs font-semibold rounded-full px-1.5 py-0.5 min-w-[20px] text-center ${on ? s.badge : 'bg-gray-100 text-gray-500'}">${n}</span></button>`;
    }).join('')}</nav>` : '';
    const header = `<header class="px-5 lg:px-7 pt-6 pb-4 bg-white border-b border-gray-100 shrink-0"><div class="flex items-start gap-3 pr-12"><button data-act="fc-back" data-testid="order-forecast-back-to-customers-btn" class="md:hidden mt-0.5 text-gray-400 hover:text-gray-700" aria-label="Back to customers">${lucide('arrow-left', { size: 20 })}</button><div class="min-w-0"><h3 class="text-lg font-semibold text-gray-800 truncate">${esc(f.selected.name)}</h3><p class="text-xs text-gray-400 mt-0.5">${fc ? `${fc.totals.skusConsidered} products tracked · ${fc.totals.dueNow} due now` : 'Building forecast…'}</p></div></div>${tabs}</header>`;
    let body = '';
    if (f.loadingForecast) body = stateBlock({ icon: 'loader-circle', spin: true, label: 'Building forecast…', big: true, testId: 'order-forecast-building' });
    else if (fc) {
      const rows = v.visible.length ? `<ul class="px-5 lg:px-7 py-4 space-y-2">${v.visible.map((r) => productRow(f, r)).join('')}</ul>`
        : stateBlock({ icon: 'package-search', label: f.prodFilter ? 'No products match that filter.' : `Nothing ${STATUS[f.tab].label.toLowerCase()} for this customer.`, big: true, testId: 'order-forecast-products-empty' });
      body = `<div class="sticky top-0 z-10 bg-gray-50/95 backdrop-blur px-5 lg:px-7 py-3 flex items-center gap-3 border-b border-gray-100"><div class="relative flex-1 max-w-xs">${lucide('search', { size: 14, cls: 'absolute left-1 top-[0.6rem]  text-gray-400' })}<input placeholder="Filter products" data-testid="order-forecast-product-filter-input" class="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500" value="${esc(f.prodFilter)}"></div>${v.visible.length ? `<button data-act="fc-select-all" data-testid="order-forecast-select-all-btn" class="text-sm font-medium text-emerald-600 hover:underline whitespace-nowrap">${v.allVisible ? 'Deselect all' : 'Select all'}</button>` : ''}</div>${rows}<div class="h-4"></div>`;
    }
    const n = v.selectedItems.length;
    const footer = fc ? `<footer class="shrink-0 bg-white border-t border-gray-100 px-5 lg:px-7 py-3 flex items-center justify-between gap-4"><div class="min-w-0"><div class="text-sm text-gray-700 flex items-center gap-3"><span><span class="font-semibold text-gray-900 tabular-nums">${n}</span> <!---->item<!---->${n === 1 ? '' : 's'}<!----> selected</span>${n ? '<button data-act="fc-clear" data-testid="order-forecast-clear-btn" class="text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>' : ''}</div><p class="text-xs text-gray-400 mt-0.5 hidden sm:block">Opens a new order for this customer with these items and quantities.</p></div><button data-act="fc-apply"${n ? '' : ' disabled=""'} data-testid="order-forecast-apply-btn" class="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:shadow-none disabled:cursor-not-allowed transition-all whitespace-nowrap">${lucide('shopping-cart', { size: 16 })}${n ? `Add ${n} to order` : 'Add to order'}${lucide('arrow-right', { size: 16 })}</button></footer>` : '';
    detail = `${header}<div data-fc-body class="flex-1 overflow-y-auto bg-gray-50/60">${body}</div>${footer}`;
  }
  const section = f.selected ? `<section class="${f.mobileView === 'list' ? 'hidden' : 'flex'} md:flex flex-col flex-1 min-w-0">${detail}</section>` : `<section class="${f.mobileView === 'list' ? 'hidden' : 'flex'} md:flex flex-col flex-1 min-w-0">${detail}</section>`;
  return `<div class="flex w-full h-full bg-gray-50/60" data-testid="order-forecast-drawer">${aside}${section}</div>`;
}

/** The drawer's state and interactions. `onApply(customerId, items)` hands the picks to Create Order. */
export function forecastFlow({ model: m, host, drawers, now, onApply, onClosed }) {
  let f = null;
  const fresh = () => ({ customers: [], total: 0, page: 1, loadingCustomers: true, custSearch: '', query: '', selected: null, forecast: null, loadingForecast: false, tab: 'due', prodFilter: '', picks: {}, mobileView: 'list' });
  function render({ entering = false } = {}) {
    const active = document.activeElement;
    const key = active && host.contains(active) && active.dataset?.testid;
    const caret = key && active.type !== 'number' ? [active.selectionStart, active.selectionEnd] : null;
    const scrolls = ['[data-fc-list]', '[data-fc-body]'].map((sel) => host.querySelector(`:scope > [data-drawer] ${sel}`)?.scrollTop || 0);
    drawers.show(renderDrawer({ testId: 'drawer-order-forecast', size: 'large', entering, content: renderForecast(f) }), { entering });
    ['[data-fc-list]', '[data-fc-body]'].forEach((sel, i) => { const el = host.querySelector(`:scope > [data-drawer] ${sel}`); if (el) el.scrollTop = scrolls[i]; });
    if (key) { const el = host.querySelector(`[data-testid="${key}"]`); if (el) { el.focus({ preventScroll: true }); if (caret) try { el.setSelectionRange(...caret); } catch { /* */ } } }
    watchSentinel();
  }
  const set = (patch) => { Object.assign(f, patch); render(); };
  function load(page) {
    const res = m.forecastCustomers({ search: f.query, page, limit: PAGE });
    return res;
  }
  let observer = null;
  function watchSentinel() {
    observer?.disconnect();
    const node = host.querySelector(':scope > [data-drawer] [data-fc-sentinel]');
    if (!node) return;
    observer = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || !f || f.loadingMore) return;
      f.loadingMore = true;
      setTimeout(() => { if (!f) return; const res = load(f.page + 1); f.loadingMore = false; set({ customers: [...f.customers, ...res.data], page: f.page + 1 }); }, 150);
    }, { root: host.querySelector(':scope > [data-drawer] [data-fc-list]'), rootMargin: '0px 0px 150px 0px', threshold: 0 });
    observer.observe(node);
  }
  function fetchCustomers() {
    set({ loadingCustomers: true });
    setTimeout(() => { if (!f) return; const res = load(1); set({ customers: res.data, total: res.total, page: 1, loadingCustomers: false }); }, 150);
  }
  function openCustomer(id) {
    const c = f.customers.find((x) => x.buyerLocationId === id);
    set({ selected: c, forecast: null, picks: {}, prodFilter: '', mobileView: 'detail', loadingForecast: true });
    setTimeout(() => {
      if (!f || f.selected !== c) return;
      const fc = m.forecast(id, now());
      const picks = {};
      fc.recommendations.forEach((r) => { picks[r.articleNumber] = { selected: r.status === 'due', qty: roundQtyInit(r.recommendedQty || r.predictedQty || 0) }; });
      set({ forecast: fc, picks, loadingForecast: false, tab: TABS.find((t) => fc.recommendations.some((r) => r.status === t)) || 'due' });
    }, 150);
  }
  let searchTimer = null;
  const handlers = {
    'fc-customer': (_e, el) => openCustomer(el.dataset.id),
    'fc-back': () => set({ mobileView: 'list' }),
    'fc-tab': (_e, el) => set({ tab: el.dataset.tab }),
    'fc-toggle': (_e, el) => { const a = el.dataset.art; set({ picks: { ...f.picks, [a]: { ...f.picks[a], selected: !f.picks[a]?.selected } } }); },
    'fc-qty': (_e, el) => {
      const a = el.dataset.art; const r = f.forecast.recommendations.find((x) => x.articleNumber === a);
      const cur = f.picks[a]?.qty ?? roundQtyInit(r.predictedQty);
      set({ picks: { ...f.picks, [a]: { ...f.picks[a], qty: roundQty(cur + Number(el.dataset.step)) } } });
    },
    'fc-select-all': () => { const v = view(f); const picks = { ...f.picks }; v.visible.forEach((r) => { picks[r.articleNumber] = { ...picks[r.articleNumber], selected: !v.allVisible }; }); set({ picks }); },
    'fc-clear': () => { const picks = {}; Object.keys(f.picks).forEach((k) => { picks[k] = { ...f.picks[k], selected: false }; }); set({ picks }); },
    'fc-apply': () => { const v = view(f); if (v.selectedItems.length && f.selected) onApply(f.selected.buyerLocationId, v.selectedItems); },
  };
  function onInput(e) {
    if (!f) return false;
    const t = e.target;
    if (t.matches('[data-testid="order-forecast-customer-search-input"]')) {
      f.custSearch = t.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { if (!f) return; const q = f.custSearch.trim(); if (q === f.query) return; f.query = q; fetchCustomers(); }, 350);
      render();
      return true;
    }
    if (t.matches('[data-testid="order-forecast-product-filter-input"]')) { set({ prodFilter: t.value }); return true; }
    if (t.matches('[data-fc-qty]')) { const a = t.dataset.fcQty; f.picks = { ...f.picks, [a]: { ...f.picks[a], qty: roundQty(Number(t.value)) } }; render(); return true; }
    return false;
  }
  return {
    handlers, onInput,
    isOpen: () => !!f,
    open() { f = fresh(); render({ entering: true }); fetchCustomers(); },
    close() {
      observer?.disconnect();
      const closed = renderDrawer({ testId: 'drawer-order-forecast', size: 'large', open: false, content: renderForecast(f) });
      f = null;
      drawers.close(closed);
      onClosed?.();
    },
  };
}

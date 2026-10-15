/*
  The purchase forecast drawer: PurchaseForecastBanner's MainDrawer holding PurchaseForecastDrawer
  and PurchaseForecastTable — search, category filter (react-select multi), sort, per-row
  quantities, row selection, and "Add to Purchase", which hands the rows to the create drawer.

  Like production, the drawer is mounted (closed) as soon as the banner renders, and stays mounted.

  v7, manufacturer only (the platform's fb-persona): a Raw Material / Finished Goods tab bar. The
  Raw Material tab is the same table, filters, selection and hand-off over the raw materials'
  forecast; "Add" opens the create drawer on its Raw Material catalogue. Each tab keeps its own
  search, filter, quantities, selection and sort. A manufacturer buys raw materials, so the drawer
  opens on them and finished goods come second (owner, 29 Sep 2026).
*/
import { esc } from '../components/dom.js';
import { fi } from '../components/icons.js';
import { createMainDrawer } from '../components/drawer.js';
import { multiSelect, menuPortal, CATEGORY_SELECT, TOUCH } from '../components/react-select.js';
import { deriveForecastRow, isManufacturer } from './model.js';
import { W } from './list-views.js';

const T = '<!---->';
const GRID_COLS = 'grid-template-columns: 24px minmax(0px, 2.4fr) minmax(0px, 1.2fr) minmax(0px, 1.2fr) minmax(0px, 0.9fr) minmax(0px, 1.3fr) 80px;';

/** The host's DisplayImage with no image URL: its placeholder, at the size asked for. */
export const displayImage = (cls, size) => `<span class="contents"><img class="${cls} object-fit-scale-down" src="assets/img/Errorimage.png" alt="product" loading="lazy" decoding="async" style="width: ${size}px; height: ${size}px;"></span>`;

const TABS = [{ key: 'raw', label: 'Raw Material' }, { key: 'finished', label: 'Finished Goods' }];

export function createForecastDrawer(host, { onAdd, loadRawMaterials }) {
  const tabState = () => ({ search: '', categories: [], qty: {}, selected: [], sort: { key: 'recommendedPurchase', direction: 'desc' }, catFocused: false, catMenu: false, catFocusIndex: 0, ariaSelection: '' });
  const data = { finished: [], raw: [] };
  const tabs = { finished: tabState(), raw: tabState() };
  let tab = 'finished';
  let st = tabs.finished;
  let tabbed = false;
  let picked = false;   /* once the user picks a tab, later opens keep it */
  let rsPortal = null;
  const drawer = createMainDrawer({ onCloseRequest: () => close() });
  const isRaw = () => tab === 'raw';

  const derived = () => data[tab].map(deriveForecastRow);
  const qtyOf = (r) => st.qty[r.id] ?? r.recommendedPurchase;
  const unitOf = (r) => host.getOrderingUnitFromUnitIndex(r.measurement, 0) || 'units';
  const categories = () => Array.from(new Set(derived().map((r) => r.category).filter(Boolean)));

  function rows() {
    let list = derived();
    const q = st.search.trim().toLowerCase();
    if (q) list = list.filter((r) => String(r.product || '').toLowerCase().includes(q));
    list = list.filter((r) => r.recommendedPurchase > 0);
    if (st.categories.length) list = list.filter((r) => st.categories.includes(r.category));
    const { key, direction } = st.sort;
    const dir = direction === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => (typeof a[key] === 'string' || typeof b[key] === 'string' ? String(a[key]).localeCompare(String(b[key])) * dir : (a[key] - b[key]) * dir));
  }

  const sortIcon = (key) => (st.sort.key === key ? fi(st.sort.direction === 'asc' ? 'FiArrowUp' : 'FiArrowDown', { size: 11 }) : '');

  function catSelect() {
    const all = categories();
    if (!all.length) return '';
    return `<div class="flex-shrink-0 w-[42%] sm:w-[200px]" data-testid="purchase-forecast-category-filter">${multiSelect({
      id: 2, values: st.categories.map((c) => ({ value: c, label: c })), placeholder: 'All Categories', focused: st.catFocused || st.catMenu, open: st.catMenu,
      containerClass: 'text-black', c: CATEGORY_SELECT, ariaSelection: st.ariaSelection,
    })}</div>`;
  }

  function desktopRow(r) {
    const sel = st.selected.includes(r.id);
    const unit = unitOf(r);
    return `<div data-testid="purchase-forecast-row-${esc(r.id)}" class="grid items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors" style="${GRID_COLS}">`
      + `<input type="checkbox"${sel ? ' checked' : ''}${r.recommendedPurchase > 0 ? '' : ' disabled'} data-testid="purchase-forecast-select-${esc(r.id)}" class="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-30 flex-shrink-0" data-fc-toggle="${esc(r.id)}">`
      + `<div class="flex items-center gap-3 min-w-0"><div class="w-9 h-9 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">${displayImage('w-9 h-9 rounded-lg object-cover', 36)}</div><div class="min-w-0"><p class="text-sm font-semibold text-slate-800 truncate">${esc(r.product)}</p><div class="flex items-center gap-1.5 mt-0.5">${r.sku ? `<span class="text-[11px] text-slate-400">${esc(r.sku)}</span>` : ''}${r.category ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">${esc(r.category)}</span>` : ''}</div></div></div>`
      + `<span class="text-sm font-semibold text-slate-700 tabular-nums">${r.demand}${T} ${T}${esc(unit)}</span>`
      + `<span class="text-sm font-semibold tabular-nums text-slate-700">${r.currentStock}${T} ${T}${esc(unit)}${r.onOrder ? `<span class="block text-[11px] font-medium text-slate-400">+ ${r.onOrder} on order</span>` : ''}</span>`
      + (r.shortage > 0 ? `<span class="text-sm font-semibold text-red-600 tabular-nums">${r.shortage}${T} ${T}${esc(unit)}</span>` : '<span class="text-sm text-slate-300">—</span>')
      + (r.recommendedPurchase > 0 ? `<div class="flex items-center gap-1.5"><input type="number" min="0" data-testid="purchase-forecast-qty-${esc(r.id)}-input" class="w-16 h-8 px-2 text-sm text-right border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 tabular-nums" value="${qtyOf(r)}" data-fc-qty="${esc(r.id)}"><span class="text-xs text-gray-400">${esc(unit)}</span></div>` : '<span class="text-sm text-slate-300">—</span>')
      + (r.recommendedPurchase > 0 ? `<button type="button"${st.selected.length > 0 ? ' disabled title="Clear the checkbox selection first, or use the bulk add button below"' : ''} data-testid="purchase-forecast-add-${esc(r.id)}-btn" class="inline-flex items-center justify-center h-8 px-3 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap" data-fc-add="${esc(r.id)}">Add</button>` : '<span class="text-sm text-slate-300">—</span>')
      + `</div>`;
  }

  function card(r) {
    const sel = st.selected.includes(r.id);
    const unit = unitOf(r);
    return `<div data-testid="purchase-forecast-card-${esc(r.id)}" class="relative rounded-xl border border-slate-200 p-3">`
      + `<input type="checkbox"${sel ? ' checked' : ''}${r.recommendedPurchase > 0 ? '' : ' disabled'} data-testid="purchase-forecast-card-select-${esc(r.id)}" class="absolute top-[0.75rem] right-[0.75rem] w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-30 z-10" data-fc-toggle="${esc(r.id)}">`
      + `<div class="flex items-start gap-2.5 pr-7"><div class="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">${displayImage('w-10 h-10 rounded-lg object-cover', 40)}</div><div class="min-w-0 flex-1"><p class="text-sm font-bold text-slate-900 leading-tight truncate">${esc(r.product)}</p><div class="flex items-center gap-1.5 mt-0.5 flex-wrap">${r.sku ? `<span class="text-[11px] text-slate-400">${esc(r.sku)}</span>` : ''}${r.category ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">${esc(r.category)}</span>` : ''}</div></div></div>`
      + `<div class="grid grid-cols-3 gap-1.5 mt-2.5 text-center"><div><p class="text-[10px] text-slate-500">${isRaw() ? 'Needed' : 'Demand (30d)'}</p><p class="text-lg font-bold text-slate-900 mt-0.5 tabular-nums leading-none">${r.demand}</p><p class="text-[10px] text-slate-400 mt-0.5">${esc(unit)}</p></div>`
      + `<div class="border-l border-dashed border-slate-200 pl-1.5"><p class="text-[10px] text-slate-500">Current Stock</p><p class="text-lg font-bold mt-0.5 tabular-nums leading-none text-slate-900">${r.currentStock}</p><p class="text-[10px] text-slate-400 mt-0.5">${esc(unit)}</p></div>`
      + `<div class="border-l border-dashed border-slate-200 pl-1.5"><p class="text-[10px] text-slate-500">To Restock</p><p class="text-lg font-bold text-red-600 mt-0.5 tabular-nums leading-none">${r.recommendedPurchase || '—'}</p><p class="text-[10px] text-slate-400 mt-0.5">${r.recommendedPurchase > 0 ? esc(unit) : 'in stock'}</p></div></div>`
      + (r.recommendedPurchase > 0 ? `<div class="flex items-center gap-1.5 mt-2.5"><div class="flex items-center border border-slate-300 rounded-lg overflow-hidden flex-shrink-0"><button type="button" class="flex items-center justify-center w-8 h-8 text-slate-500 hover:bg-slate-50" aria-label="Decrease quantity" data-testid="purchase-forecast-card-qty-decrease-${esc(r.id)}-btn" data-fc-step="-1" data-id="${esc(r.id)}">${fi('FiMinus', { size: 12 })}</button><input type="number" min="0" data-testid="purchase-forecast-card-qty-${esc(r.id)}-input" class="w-12 h-8 text-center text-sm font-semibold border-x border-slate-300 focus:outline-none tabular-nums" value="${qtyOf(r)}" data-fc-qty="${esc(r.id)}" data-card><button type="button" class="flex items-center justify-center w-8 h-8 text-slate-500 hover:bg-slate-50" aria-label="Increase quantity" data-testid="purchase-forecast-card-qty-increase-${esc(r.id)}-btn" data-fc-step="1" data-id="${esc(r.id)}">${fi('FiPlus', { size: 12 })}</button></div>`
        + `<button type="button"${st.selected.length > 0 ? ' disabled title="Clear the checkbox selection first, or use the bulk add button below"' : ''} data-testid="purchase-forecast-card-add-${esc(r.id)}-btn" class="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors" data-fc-add="${esc(r.id)}">Add</button></div>` : '')
      + `</div>`;
  }

  function table() {
    const all = derived();
    const shortage = all.filter((r) => r.recommendedPurchase > 0).length;
    const list = rows();
    const header = `<div class="flex items-center gap-2 pb-3 flex-wrap"><span class="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap bg-amber-50 text-amber-700 border border-amber-200">Needs Restocking (${T}${shortage}${T})</span></div>`
      + `<div class="flex flex-row items-center gap-2 sm:gap-3 pb-4"><div class="relative flex-1 min-w-0">${fi('FiSearch', { cls: 'absolute left-1 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4 pointer-events-none' })}<input class="${W.input} pl-9" type="search" placeholder="${isRaw() ? 'Search by raw material name' : 'Search by product name'}" data-testid="purchase-forecast-search-input" value="${esc(st.search)}" data-fc-search></div>${catSelect()}</div>`;
    if (!list.length) {
      return `<div class="">${header}<div class="text-center py-10 px-4" data-testid="purchase-forecast-table-empty"><p class="text-sm font-medium text-gray-500">${all.length > 0 ? `All ${isRaw() ? 'raw materials' : 'products'} are sufficiently stocked.` : 'No forecast data available.'}</p></div></div>`;
    }
    return `<div class="">${header}`
      + `<div class="hidden md:block rounded-lg border border-slate-200 overflow-x-auto " data-testid="purchase-forecast-table-list"><div class="min-w-[880px]">`
      + `<div class="grid items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wide" style="${GRID_COLS}"><span></span>`
      + `<button type="button" data-testid="purchase-forecast-sort-product-btn" class="flex items-center gap-1 text-left hover:text-slate-800" data-fc-sort="product">${isRaw() ? 'Raw Material' : 'Product'} ${T}${sortIcon('product')}</button><span>${isRaw() ? 'Needed for plan' : 'Demand (30 days)'}</span><span>${isRaw() ? 'In Store' : 'Current Stock'}</span><span>Gap</span>`
      + `<button type="button" data-testid="purchase-forecast-sort-recommended-qty-btn" class="flex items-center gap-1 hover:text-slate-800" data-fc-sort="recommendedPurchase">Recommended Qty ${T}${sortIcon('recommendedPurchase')}</button><span></span></div>`
      + `<div class="divide-y divide-slate-100">${list.map(desktopRow).join('')}</div></div></div>`
      + `<div class="md:hidden flex flex-col gap-2 " data-testid="purchase-forecast-card-list">${list.map(card).join('')}</div></div>`;
  }

  function footer() {
    const n = st.selected.length;
    const units = derived().filter((r) => st.selected.includes(r.id)).reduce((s, r) => s + qtyOf(r), 0);
    return `<div class="bg-white border-t border-slate-100 px-6 py-3 flex items-center justify-between gap-3 flex-wrap"><span class="text-xs text-slate-500">${n}${T} selected${n > 0 ? `${T} · ${units} units${T} · opens a new purchase order` : ''}</span>`
      + `<button type="button"${n === 0 ? ' disabled' : ''} title="Opens a new purchase order pre-filled with the selected items" data-testid="purchase-forecast-bulk-add-btn" class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors" data-fc-bulk>${fi('FiShoppingCart', { size: 13 })}Add to Purchase${T} (${T}${n}${T})</button></div>`;
  }

  function tabBar() {
    if (!tabbed) return '';
    return `<div class="flex-shrink-0 px-6 border-b border-slate-200 bg-white" data-testid="purchase-forecast-tabs"><nav class="flex gap-6" role="tablist">`
      + TABS.map((t) => {
        const on = t.key === tab;
        return `<button type="button" role="tab" aria-selected="${on}" data-testid="purchase-forecast-tab-${t.key}" class="-mb-px py-3 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors ${on ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}" data-fc-tab="${t.key}">${t.label}</button>`;
      }).join('')
      + '</nav></div>';
  }

  function content() {
    return `<div class="flex flex-col h-full bg-white" data-testid="purchase-forecast-drawer">`
      + `<div class="flex-shrink-0 px-6 py-5 border-b border-slate-200 bg-slate-50"><div class="flex items-center gap-3"><div class="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100">${fi('FiTrendingUp', { cls: 'w-4 h-4 text-emerald-600' })}</div><div class="flex-1 min-w-0"><h2 class="text-base font-semibold text-slate-800 leading-tight">Purchase Forecast</h2></div></div></div>`
      + tabBar()
      + `<div class="flex-1 overflow-y-auto px-6 pt-5 pb-5" data-fc-scroll>${table()}</div>`
      + `<div class="flex-shrink-0" data-fc-footer>${footer()}</div></div>`;
  }

  // Re-render the drawer body in place (MainDrawer morphs it): the focused input, its caret and the
  // table's scroll position stay as they were.
  function render(open = drawer.open) {
    drawer.render(content(), open);
    renderMenu();
  }

  function renderMenu() {
    if (!st.catMenu) { rsPortal?.remove(); rsPortal = null; return; }
    const control = drawer.host.querySelector('[data-testid="purchase-forecast-category-filter"] [data-rs-control]');
    if (!control) return;
    const options = categories().map((c, index) => ({ value: c, label: c, index })).filter((o) => !st.categories.includes(o.value));
    if (!rsPortal) { rsPortal = document.createElement('div'); document.body.appendChild(rsPortal); }
    const r = control.getBoundingClientRect();
    // react-select's portal wrapper is a plain div carrying the menuPortal class; we inline its box.
    rsPortal.outerHTML; rsPortal.innerHTML = '';
    const tpl = document.createElement('template');
    tpl.innerHTML = menuPortal({ id: 2, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, options, focusedIndex: Math.min(st.catFocusIndex, options.length - 1), multi: true, c: CATEGORY_SELECT });
    const node = tpl.content.firstElementChild;
    rsPortal.replaceWith(node); rsPortal = node;
  }

  /** Decided on every open: the business type can change in the platform while the drawer is mounted. */
  function setData(d) {
    data.finished = d || [];
    tabbed = isManufacturer() && typeof loadRawMaterials === 'function';
    if (!tabbed) { tab = 'finished'; st = tabs.finished; return; }
    if (!picked) { tab = 'raw'; st = tabs.raw; }
    loadRawMaterials().then((raw) => { data.raw = raw || []; if (drawer.open) render(); }).catch(() => { data.raw = []; });
  }
  function switchTab(key) {
    if (key === tab) return;
    picked = true;
    st.catMenu = false; st.catFocused = false;
    tab = key; st = tabs[key];
    render();
    drawer.host.querySelector('[data-fc-scroll]')?.scrollTo(0, 0);
  }

  function open(d) { setData(d); render(true); }
  function close() { st.catMenu = false; st.catFocused = false; render(false); }

  function submit(selectedRows) {
    const items = selectedRows.map((row) => ({ productName: row.product, articleNumber: row.articleNumber, productId: row.productId, requestedQty: row.recommendedPurchase }));
    st.selected = [];
    close();
    onAdd(items, isRaw() ? 'raw' : 'finished');
  }

  // ── Events ─────────────────────────────────────────────────────────────────────────────────
  const H = drawer.host;
  H.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-fc-search]')) { st.search = t.value; render(); }
    else if (t.matches('[data-fc-qty]')) {
      const id = t.dataset.fcQty;
      st.qty[id] = Math.max(0, Number(t.value) || 0);
      render();
    }
  });
  H.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-fc-toggle]')) {
      const id = t.dataset.fcToggle;
      st.selected = st.selected.includes(id) ? st.selected.filter((x) => x !== id) : [...st.selected, id];
      render();
    }
  });
  H.addEventListener('mousedown', (e) => {
    const control = e.target.closest('[data-testid="purchase-forecast-category-filter"] [data-rs-control]');
    if (!control) return;
    e.preventDefault();
    const removeBtn = e.target.closest('[data-rs-remove]');
    const clear = e.target.closest('[data-rs-clear]');
    if (removeBtn) { st.categories = st.categories.filter((c) => c !== removeBtn.dataset.rsRemove); st.ariaSelection = ''; }
    else if (clear) { st.categories = []; }
    else { st.catMenu = !st.catMenu; st.catFocusIndex = 0; }
    st.catFocused = true;
    render();
    H.querySelector('[data-testid="purchase-forecast-category-filter"] [data-rs-input]')?.focus();
  });
  document.addEventListener('mousedown', (e) => {
    if (!st.catMenu) return;
    const opt = e.target.closest('[data-rs-option]');
    if (opt && rsPortal?.contains(opt)) {
      e.preventDefault();
      st.categories = [...st.categories, opt.dataset.rsOption];
      st.catMenu = false;
      const input = H.querySelector('[data-testid="purchase-forecast-category-filter"] [data-rs-input]');
      // blurInputOnSelect defaults to isTouchCapable(): on a touch device the select lets go of
      // focus after a pick, and its live region (rendered only while focused) empties.
      if (TOUCH) { st.catFocused = false; st.ariaSelection = ''; render(); input?.blur(); return; }
      st.ariaSelection = `option ${opt.dataset.rsOption}, selected.`;
      render();
      input?.focus();
      return;
    }
    if (rsPortal?.contains(e.target) || e.target.closest('[data-testid="purchase-forecast-category-filter"]')) return;
    st.catMenu = false; st.catFocused = false; render();
  });
  document.addEventListener('mouseover', (e) => {
    if (!st.catMenu || !rsPortal) return;
    const opt = e.target.closest('[data-rs-option]');
    if (!opt || !rsPortal.contains(opt)) return;
    const i = [...rsPortal.querySelectorAll('[data-rs-option]')].indexOf(opt);
    if (i !== st.catFocusIndex) { st.catFocusIndex = i; renderMenu(); }
  });
  H.addEventListener('click', (e) => {
    const t = e.target;
    const tabBtn = t.closest('[data-fc-tab]');
    if (tabBtn) return switchTab(tabBtn.dataset.fcTab);
    const sort = t.closest('[data-fc-sort]');
    if (sort) {
      const key = sort.dataset.fcSort;
      st.sort = st.sort.key === key ? { key, direction: st.sort.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'product' ? 'asc' : 'desc' };
      return render();
    }
    const step = t.closest('[data-fc-step]');
    if (step) {
      const r = derived().find((x) => String(x.id) === step.dataset.id);
      st.qty[r.id] = Math.max(0, qtyOf(r) + Number(step.dataset.fcStep));
      return render();
    }
    const add = t.closest('[data-fc-add]');
    if (add && !add.disabled) {
      const r = derived().find((x) => String(x.id) === add.dataset.fcAdd);
      return submit([{ ...r, recommendedPurchase: qtyOf(r) }]);
    }
    if (t.closest('[data-fc-bulk]') && st.selected.length) {
      return submit(derived().filter((r) => st.selected.includes(r.id)).map((r) => ({ ...r, recommendedPurchase: qtyOf(r) })));
    }
  });

  return {
    /** Mounts the closed drawer (the banner renders it as soon as it has data). */
    mount(d) { setData(d); render(false); },
    open, close,
  };
}

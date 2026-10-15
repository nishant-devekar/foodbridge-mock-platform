/*
  The Purchase Orders screen: its state, which part re-renders when, and the wiring of every flow.
  Production's SourcingOrderScreen + useSourcingOrderList, as one plain state object
  (window.purchaseOrders.store.state) and delegated events.

  Re-rendering morphs the DOM in place (components/dom.js morph), the way React reconciles: the
  focused search box, the date input's selection and whatever is under the pointer stay the same
  nodes, so caret, selection and hover survive.
*/
import { createStore } from '../state/store.js';
import { delegate, morph, morphOuter } from '../components/dom.js';
import { statusSelect, menuPortal, STATUS_MENU, ARIA, TOUCH } from '../components/react-select.js';
import { createRangePicker, formatRange } from '../components/datepicker.js';
import { buildRows, filterRows, pageOf, selectableSources, PAGE_SIZE, isManufacturer } from './model.js';
import { forecastBanner, toolbar, dateField, listBody, mobileFooter, rowActions, actionsMenu, QUICK_RANGES } from './list-views.js';
import { documentState } from './model.js';

// react-select's isAppleDevice(): its focused-option message is spoken on Apple platforms only.
const APPLE = /^(Mac|iPhone|iPad)/i.test(navigator.platform || '');

export function mountPurchaseOrders(host, server, ctx) {
  const store = createStore({
    // list data (useSourcingOrderList)
    loading: true, orders: [], internal: [], external: [], error: '',
    searchInput: '', search: '', status: null, startDate: null, endDate: null, currentPage: 1,
    // screen-local
    mobileFiltersOpen: false, quickRangeOpen: false, range: [null, null],
    // Documents added since the list loaded, per order — kept separately by the table and by the
    // card list, as production's two components each keep their own.
    expanded: [], cardExpanded: [], copiedId: '', menu: null, addedDocuments: { table: {}, card: {} }, fulfillmentCounts: {},
    // sources for the create drawer
    sellerList: [], combinedList: [],
    // forecast banner
    forecast: { loading: true, unavailable: false, data: [], mobileExpanded: false },
    // the host's status filter (react-select)
    ss: { focused: false, open: false, focusIndex: 0, inputHidden: false, selection: '' },
  });
  const S = () => store.state;
  const forecastOn = host.appProp?.sourcingOrderManagementFeature?.finishedGoodsPurchaseForecastEnabled === true;
  // SelectOrderByStatus: the PURCHASE_ORDER workflow's statuses, first letter capitalised.
  const STATUS_OPTIONS = [...new Set(host.orderStatusRules.getStatusWorkflow('PURCHASE_ORDER').map((w) => w.status))]
    .map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

  // ── Frame ──────────────────────────────────────────────────────────────────────────────────
  ctx.outlet.innerHTML = `${forecastOn ? '<div class="tab tab-enter " data-po-banner></div>' : ''}<form data-po-form></form><div class="${'min-w-0 rounded-lg overflow-hidden bg-white dark:bg-gray-800'} min-w-0 shadow-xs overflow-hidden bg-white dark:bg-gray-800 rounded-t-lg rounded-0 mb-4"><div class="p-4" data-po-body></div></div>${mobileFooter(host)}`;
  const $ = (sel) => ctx.outlet.querySelector(sel);
  const portal = document.createElement('div');
  portal.setAttribute('data-po-portal', '');
  document.body.appendChild(portal);
  let statusPortal = null;

  // ── Derived ────────────────────────────────────────────────────────────────────────────────
  let rowsCache = null;
  const allRows = () => {
    const s = S();
    if (!rowsCache || rowsCache.orders !== s.orders || rowsCache.internal !== s.internal || rowsCache.external !== s.external) {
      rowsCache = { orders: s.orders, internal: s.internal, external: s.external, rows: buildRows(s.orders, s.internal, s.external) };
    }
    return rowsCache.rows;
  };
  const page = () => {
    const s = S();
    const filtered = filterRows(allRows(), s);
    return { rows: pageOf(filtered, s.currentPage), current: s.currentPage, totalPages: Math.ceil(filtered.length / PAGE_SIZE), total: filtered.length };
  };

  // ── Render ─────────────────────────────────────────────────────────────────────────────────
  const renderBanner = () => { const el = $('[data-po-banner]'); if (el) el.innerHTML = forecastBanner(S().forecast, host); };
  const statusValue = () => STATUS_OPTIONS.find((o) => o.value === S().status) || null;
  const statusAria = () => {
    const { ss } = S();
    if (!ss.open) return { selection: ss.selection };
    const opt = STATUS_OPTIONS[ss.focusIndex];
    const selected = opt && opt.value === S().status;
    return {
      selection: ss.selection,
      focused: APPLE && opt ? `${opt.label}${selected ? ' selected' : ''}, ${ss.focusIndex + 1} of ${STATUS_OPTIONS.length}.` : '',
      results: ARIA.results(STATUS_OPTIONS.length),
      guidance: ARIA.guidanceMenu,
    };
  };
  const renderToolbar = () => {
    const s = S();
    morphOuter($('[data-po-form]'), toolbar(s, host, {
      statusSelect: statusSelect({ id: 2, value: statusValue()?.label, focused: s.ss.focused, open: s.ss.open, inputHidden: s.ss.inputHidden, aria: statusAria() }),
      dateField: dateField({ ...s, rangeText: formatRange(s.range), pickerOpen: picker?.isOpen }),
    }));
  };
  const renderStatusMenu = () => {
    const { ss } = S();
    if (!ss.open) { statusPortal?.remove(); statusPortal = null; return; }
    const control = $('[data-rs="2"] [data-rs-control]');
    const r = control.getBoundingClientRect();
    const html = menuPortal({ id: 2, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, options: STATUS_OPTIONS, focusedIndex: ss.focusIndex, multi: false, c: STATUS_MENU });
    if (!statusPortal) {
      const tpl = document.createElement('template');
      tpl.innerHTML = html;
      statusPortal = tpl.content.firstElementChild;
      document.body.appendChild(statusPortal);
    } else morphOuter(statusPortal, html);
  };
  const renderBody = () => {
    const s = S();
    morph($('[data-po-body]'), listBody({ ...s, renderFulfillment: (row) => ctx.renderFulfillment(row) }, host, page()));
  };
  const renderMenu = () => {
    const m = S().menu;
    if (!m) { portal.innerHTML = ''; return; }
    const row = allRows().find((r) => r.order._id === m.id);
    portal.innerHTML = actionsMenu(m, rowActions(row.order, documentState(row.order, host, S().addedDocuments.table[m.id])));
  };
  const renderAll = () => { renderBanner(); renderToolbar(); renderBody(); renderMenu(); };

  const TOOLBAR_KEYS = ['searchInput', 'status', 'startDate', 'endDate', 'mobileFiltersOpen', 'quickRangeOpen', 'range', 'ss'];
  const BODY_KEYS = ['loading', 'orders', 'internal', 'external', 'search', 'status', 'startDate', 'endDate', 'currentPage', 'expanded', 'cardExpanded', 'copiedId', 'menu', 'addedDocuments', 'fulfillmentCounts', 'searchInput'];
  store.subscribe((state, patch) => {
    const keys = Object.keys(patch);
    if (keys.includes('forecast')) renderBanner();
    if (keys.some((k) => TOOLBAR_KEYS.includes(k))) renderToolbar();
    if (keys.some((k) => BODY_KEYS.includes(k))) renderBody();
    if (keys.includes('menu') || keys.includes('addedDocuments')) renderMenu();
    if (keys.includes('ss')) renderStatusMenu();
  });

  // ── Data ───────────────────────────────────────────────────────────────────────────────────
  const load = async () => {
    // Loading replaces the table and the card list with skeletons, so everything those two
    // components hold for themselves goes with them: expanded rows, the copied tick, the menu, and
    // the documents they had added since.
    store.set({ loading: true, expanded: [], cardExpanded: [], copiedId: '', menu: null, addedDocuments: { table: {}, card: {} } });
    try {
      const [orders, internal, external] = await Promise.all([
        server.listPurchaseOrders(),
        server.listInternalLocations().catch(() => []),
        server.listExternalSuppliers().catch(() => []),
      ]);
      store.set({ orders, internal, external, error: '', loading: false });
    } catch (err) {
      // useSourcingOrderList keeps the message, but the screen never shows it: the list is empty.
      store.set({ orders: [], error: err?.response?.data?.message ?? 'Something went wrong!', loading: false });
    }
  };
  const loadSources = async () => {
    const [sellers, suppliers] = await Promise.all([server.listSelectableInternalSources(), server.listExternalSuppliers()]);
    const s = sellers.map((x) => ({ ...x, _sourceType: 'internalSupplier' }));
    const e = suppliers.map((x) => ({ ...x, _sourceType: 'externalSupplier' }));
    store.set({ sellerList: s, combinedList: selectableSources([...s, ...e.filter((x) => x.active !== false)]) });
  };
  const loadForecast = async () => {
    store.set({ forecast: { ...S().forecast, loading: true, unavailable: false } });
    try {
      const data = await server.forecastRecommendations();
      /* v7, manufacturer: the banner leads with what production needs to buy */
      const raw = isManufacturer() && server.rawMaterialForecastRecommendations ? await server.rawMaterialForecastRecommendations().catch(() => null) : null;
      store.set({ forecast: { ...S().forecast, data: data || [], raw, loading: false } });
      ctx.onForecastLoaded?.(data || [], raw);
    } catch {
      store.set({ forecast: { ...S().forecast, data: [], unavailable: true, loading: false } });
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────────────────────
  let debounce = null;
  ctx.outlet.addEventListener('input', (e) => {
    if (!e.target.matches('[data-po-search]')) return;
    const value = e.target.value;
    store.set({ searchInput: value });
    // Two 400 ms debounces in production (screen → controller); the filter applies after both.
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      store.set({ search: value.trim(), currentPage: 1 });
    }, 800);
  });
  ctx.outlet.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = $('[data-po-search]').value || '';
    store.set({ searchInput: value, search: value, currentPage: 1 });
  });

  // ── The status filter (SelectOrderByStatus → react-select) ─────────────────────────────────
  const ss = (patch) => store.set({ ss: { ...S().ss, ...patch } });
  const statusInput = () => $('[data-rs="2"] [data-rs-input]');
  let openAfterFocus = false;
  const openStatusMenu = () => {
    const i = STATUS_OPTIONS.findIndex((o) => o.value === S().status);
    ss({ open: true, focusIndex: i > -1 ? i : 0, inputHidden: false });
  };
  ctx.outlet.addEventListener('mousedown', (e) => {
    const control = e.target.closest('[data-rs="2"] [data-rs-control]');
    if (!control || e.button !== 0) return;
    const { focused, open } = S().ss;
    if (e.target.closest('[data-rs-clear]')) {
      e.preventDefault();
      openAfterFocus = false;
      store.set({ status: '', currentPage: 1, ss: { ...S().ss, open: false, selection: 'All selected options have been cleared.' } });
      setTimeout(() => statusInput()?.focus());
      return;
    }
    if (e.target.closest('[data-rs-dropdown]')) {
      e.preventDefault();
      if (!focused) { openAfterFocus = true; statusInput().focus(); } else if (open) ss({ open: false, inputHidden: true }); else openStatusMenu();
      return;
    }
    if (!focused) { openAfterFocus = true; statusInput().focus(); } else if (!open) openStatusMenu(); else if (e.target.tagName !== 'INPUT') ss({ open: false });
    if (e.target.tagName !== 'INPUT') e.preventDefault();
  });
  ctx.outlet.addEventListener('focusin', (e) => {
    if (!e.target.matches('[data-rs="2"] [data-rs-input]')) return;
    ss({ focused: true, inputHidden: false });
    if (openAfterFocus) { openAfterFocus = false; openStatusMenu(); }
  });
  ctx.outlet.addEventListener('focusout', (e) => {
    if (!e.target.matches('[data-rs="2"] [data-rs-input]')) return;
    ss({ focused: false, open: false });
  });
  document.addEventListener('mousedown', (e) => { if (statusPortal?.contains(e.target)) e.preventDefault(); });
  document.addEventListener('mouseover', (e) => {
    const opt = statusPortal?.contains(e.target) && e.target.closest('[data-rs-option]');
    if (!opt) return;
    const i = STATUS_OPTIONS.findIndex((o) => o.value === opt.dataset.rsOption);
    if (i !== S().ss.focusIndex) ss({ focusIndex: i });
  });
  document.addEventListener('click', (e) => {
    const opt = statusPortal?.contains(e.target) && e.target.closest('[data-rs-option]');
    if (!opt) return;
    const o = STATUS_OPTIONS.find((x) => x.value === opt.dataset.rsOption);
    // SidebarContext.handleFilterChange + setStatus; react-select then closes and hides its input.
    store.set({ status: o.value, currentPage: 1, ss: { ...S().ss, open: false, inputHidden: true, selection: ARIA.selected(o.label) } });
    // blurInputOnSelect defaults to isTouchCapable().
    if (TOUCH) { statusInput()?.blur(); ss({ focused: false, selection: '' }); }
  });

  // ── The date range (react-datepicker, selectsRange) ────────────────────────────────────────
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  /** handleDateRangeChange: the field shows what was picked; the filter applies once both ends are. */
  function applyRange([a, b]) {
    store.set({ range: [a, b] });
    if (a && b) store.set({ startDate: ymd(a), endDate: ymd(b), currentPage: 1 });
  }
  const picker = createRangePicker({
    wrapper: () => $('[data-po-date-field] .react-datepicker-wrapper'),
    input: () => $('[data-po-date-input]'),
    onChange: (r) => applyRange(r),
    onClose: () => renderToolbar(),
  });
  // The screen's sync effect: context start/end → the picker's range (new Date('yyyy-mm-dd')).
  store.subscribe((state, patch) => {
    if (!('startDate' in patch || 'endDate' in patch)) return;
    const range = state.startDate && state.endDate ? [new Date(state.startDate), new Date(state.endDate)] : [null, null];
    store.set({ range });
  });
  store.subscribe((state, patch) => { if ('range' in patch) picker.setRange(state.range); });
  document.addEventListener('focusin', (e) => { if (e.target.matches?.('[data-po-date-input]')) queueMicrotask(renderToolbar); });
  function quickRange(label) {
    const now = new Date();
    const back = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    switch (label) {
      case 'Today': return [now, now];
      case 'Last 7 days': return [back(6), new Date()];
      case 'Last 30 days': return [back(29), new Date()];
      case 'This month': return [new Date(now.getFullYear(), now.getMonth(), 1), now];
      default: return [new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 0)];
    }
  }
  // The quick-range menu closes on any mousedown outside the date field.
  document.addEventListener('mousedown', (e) => {
    if (S().quickRangeOpen && !e.target.closest('[data-po-date-field]')) store.set({ quickRangeOpen: false });
  });

  // ── Everything else a click does ───────────────────────────────────────────────────────────
  const handlers = {
    'forecast-mobile-toggle': (e) => { if (e.target.closest('[data-act="forecast-open"]')) return; store.set({ forecast: { ...S().forecast, mobileExpanded: !S().forecast.mobileExpanded } }); },
    'forecast-open': (e) => { e.stopPropagation(); ctx.openForecast?.(S().forecast.data); },
    'mobile-filters': () => store.set({ mobileFiltersOpen: !S().mobileFiltersOpen }),
    'quick-range': () => store.set({ quickRangeOpen: !S().quickRangeOpen }),
    'quick-range-pick': (e, el) => { applyRange(quickRange(el.dataset.range)); store.set({ quickRangeOpen: false }); },
    'clear-range': (e) => { e.preventDefault(); e.stopPropagation(); store.set({ range: [null, null], startDate: '', endDate: '', currentPage: 1 }); },
    'clear-filters': () => {
      const search = $('[data-po-search]'); if (search) search.value = '';
      store.set({ search: '', searchInput: '', status: '', startDate: null, endDate: null, currentPage: 1, mobileFiltersOpen: false });
    },
    create: () => ctx.openCreate?.(),
    'raw-material': () => ctx.openRawMaterial?.(),
    page: (e, el) => store.set({ currentPage: Number(el.dataset.page) }),
    'toggle-row': (e, el) => { const id = el.dataset.id; const x = S().expanded; store.set({ expanded: x.includes(id) ? x.filter((i) => i !== id) : [...x, id] }); },
    'toggle-card': (e, el) => { const id = el.dataset.id; const x = S().cardExpanded; store.set({ cardExpanded: x.includes(id) ? x.filter((i) => i !== id) : [...x, id] }); },
    'copy-id': (e, el) => { navigator.clipboard?.writeText(el.dataset.value).catch(() => {}); store.set({ copiedId: el.dataset.value }); setTimeout(() => store.set({ copiedId: '' }), 2000); },
    menu: (e, el) => {
      const r = el.getBoundingClientRect();
      const id = el.dataset.id;
      store.set({ menu: S().menu?.id === id ? null : { id, top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 220 - 8) } });
    },
    'status-picker': (e, el) => { const sel = ctx.outlet.querySelector(`[data-testid="sourcing-card-status-select-${el.dataset.id}"]`); try { sel.showPicker(); } catch { sel.focus(); } },
  };
  const docAct = (act) => (e, el) => {
    const row = allRows().find((r) => r.order._id === el.dataset.id);
    ctx.openDocument?.(act, row, el.dataset.doc, el.closest('[data-testid="sourcing-card-list"]') ? 'card' : 'table');
  };
  for (const a of ['doc-po', 'doc-grn', 'doc-invoice', 'doc-other', 'doc-add']) handlers[a] = docAct(a);
  delegate(ctx.outlet, 'click', handlers);
  delegate(portal, 'click', {
    'menu-close': () => store.set({ menu: null }),
    'menu-pick': (e, el) => {
      const m = S().menu;
      const row = allRows().find((r) => r.order._id === m.id);
      const action = rowActions(row.order, documentState(row.order, host, S().addedDocuments.table[m.id]))[Number(el.dataset.index)];
      store.set({ menu: null });
      ctx.openDocument?.(action.act, row, action.doc, 'table');
    },
  });
  ctx.outlet.addEventListener('change', (e) => {
    const el = e.target.closest('[data-act-change="status"]');
    if (!el) return;
    const row = allRows().find((r) => r.order._id === el.dataset.id);
    if (el.value !== row.order.status) ctx.openAudit?.(row, el.value);
    renderBody();
  });

  renderAll();
  load();
  loadSources();
  if (forecastOn) loadForecast();

  return { store, reload: () => { load(); loadSources(); }, allRows, applyRange, rerender: renderBody, QUICK_RANGES };
}

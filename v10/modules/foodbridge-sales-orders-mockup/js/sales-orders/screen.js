/*
  The Sales Orders screen: mounts the views, owns the state, and answers every interaction.

  Layout mirrors the product's DOM exactly — the controls, the list, the phone footer, toasts and
  the portal are all DIRECT children of the module root, because the sticky controls and the fixed
  footer position against it. Regions re-render by replacing their own element.

  The list is fetched the way production fetches it — asynchronously, with the skeleton showing
  meanwhile — from the prototype's own data (model.listOrders). ?scenario= makes that "server"
  answer empty, fail, or never answer.
*/
import { createStore } from '../state/store.js';
import { delegate } from '../components/dom.js';
import { renderControls, renderStatusSelect, renderStatusMenu, renderDateInput } from './controls.js';
import { renderList } from './table.js';
import { renderFooter } from './footer.js';
import { bulkMenu, gsheetMenu, invoiceMenu, insightPosition, insightCard, calendar, placeCalendar, toasts, toastItem } from './overlays.js';
import { renderAuditDrawer, auditView, discardContent } from './audit-drawer.js';
import { renderDrawer, renderModal } from '../components/drawer.js';
import { wireTooltips, hideTooltip } from '../components/tooltip.js';
import { createOrderFlow } from './create-order.js';
import { reminderFlow } from './reminders.js';
import { deliveryFlow } from './delivery.js';
import { bulkFlow } from './bulk.js';
import { thermalFlow } from './thermal.js';
import { forecastFlow } from './forecast.js';
import { demandFlow } from './demand.js';

const LATENCY_MS = 150;
const SEARCH_DEBOUNCE_MS = 400;

function readHash() {
  const [path, query = ''] = location.hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(query);
  return {
    path: path || '/orders',
    search: q.get('search') || '',
    status: q.get('status') || '',
    page: Number(q.get('page')) || 1,
    expanded: q.get('expand') ? q.get('expand').split(',') : [],
  };
}

export function mountSalesOrders(host, model, { scenario = null, now = () => Date.now() } = {}) {
  const deep = readHash();
  const store = createStore({
    search: deep.search, searchInput: deep.search, status: deep.status,
    startDate: '', endDate: '', dateRange: [null, null],
    page: deep.page, limit: 20,
    loading: true, error: '', result: null,
    expanded: deep.expanded, tabs: {},
    menu: null, statusFocus: 0, calMonth: null, calHover: null,
    insight: null, copied: '', toasts: [],
    invoiceFor: null, audit: null,
  });
  const S = () => store.state;

  host.innerHTML = `<div class="so-root" data-testid="sales-orders-screen-root">${renderControls(model, S())}<div data-region="list"></div><div data-region="route-modal"></div><div data-region="modals"></div>${renderFooter(model, S())}<div class="Toastify" data-region="toasts"></div><div id="root-portal" class="so-portal"></div></div>`;
  const root = host.firstElementChild;
  const controls = root.firstElementChild;
  const portal = root.querySelector('#root-portal');
  // The product renders its overlays (status menu, Bulk menu, Smart Insights) into a second module
  // root appended to <body>, so they escape every overflow clip on the page.
  let overlayHost = document.getElementById('so-portal-host');
  if (!overlayHost) { overlayHost = document.createElement('div'); overlayHost.id = 'so-portal-host'; overlayHost.className = 'so-root'; document.body.appendChild(overlayHost); }
  const replace = (el, html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); const next = t.content.firstElementChild; el.replaceWith(next); return next; };
  let listEl = root.querySelector('[data-region="list"]');
  const modalsEl = root.querySelector('[data-region="modals"]');
  let footerEl = modalsEl.nextElementSibling;
  let toastsEl = root.querySelector('[data-region="toasts"]');

  // ── Rendering ─────────────────────────────────────────────────────────────────────────
  const renderListRegion = () => { listEl = replace(listEl, renderList(model, S())); listEl.dataset.region = 'list'; };
  const renderFooterRegion = () => { footerEl = replace(footerEl, renderFooter(model, S()).split('<div class="md:hidden h-20"></div>')[0]); };
  // react-select keeps its input focused after a pick — except on touch devices, where it blurs
  // (blurInputOnSelect). The focused control draws its indicators darker.
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  let keepStatusFocus = false;
  const renderStatus = () => {
    controls.querySelector('[data-slot="status"]').innerHTML = renderStatusSelect(model, S());
    const input = controls.querySelector('#orders-status-filter-input');
    if (S().menu === 'status' || keepStatusFocus) input?.focus({ preventScroll: true });
    keepStatusFocus = false;
    renderPortal();
  };
  const pickStatus = (value) => { keepStatusFocus = !isTouch; store.set({ status: value, menu: null, page: 1 }); renderStatus(); load(); };
  controls.addEventListener('focusin', (e) => { if (e.target.id === 'orders-status-filter-input') e.target.closest('.so-select__control')?.classList.add('so-select__control--focused'); });
  controls.addEventListener('focusout', (e) => { if (e.target.id === 'orders-status-filter-input') e.target.closest('.so-select__control')?.classList.remove('so-select__control--focused'); });
  const renderDate = () => { controls.querySelector('[data-slot="date"]').innerHTML = renderDateInput(S()); };

  function renderPortal() {
    const s = S();
    let over = '';
    if (s.menu === 'status') over += renderStatusMenu(model, s, controls.querySelector('.so-select__control'));
    if (s.menu === 'bulk') over += bulkMenu(model, controls.querySelector('[data-bulk-anchor]'), s.bulkPlaced);
    if (s.menu === 'gsheet') over += gsheetMenu(controls.querySelector('[data-gsheet-anchor]'), s.bulkPlaced);
    if (s.menu === 'invoice') {
      const btn = root.querySelector(`[data-testid="${s.invoiceFor}"]`);
      if (btn) over += invoiceMenu(btn, s.invoiceFor);
    }
    if (s.insight) {
      const order = model.data.orderById.get(s.insight.id);
      if (order) over += insightCard(model, order, s.insight.pos);
    }
    // Menus are re-rendered; an open drawer or modal in the same host is left alone.
    overlayHost.querySelectorAll(':scope > :not([data-drawer]):not([data-modal]):not([data-overlay="customer"]):not([data-overlay="bulk-catalogue"]):not([data-thermal]):not([data-dr-modal])').forEach((n) => n.remove());
    overlayHost.insertAdjacentHTML('beforeend', over);
    let html = '';
    if (s.menu === 'date') html += `<div><div class="react-datepicker__tab-loop"><div class="react-datepicker__tab-loop__start" tabindex="0"></div><div class="react-datepicker-popper date-picker-popper-fixed so-dp-popper" data-placement="bottom-end"><div style="display: contents;">${calendar(s, now())}</div></div><div class="react-datepicker__tab-loop__end" tabindex="0"></div></div></div>`;
    portal.innerHTML = html;
    if (s.menu === 'date') placeCalendar(portal.querySelector('.react-datepicker-popper'), controls.querySelector('[data-slot="date"] input'));
    const chevron = controls.querySelector('[data-bulk-chevron]');
    if (chevron) chevron.classList.toggle('rotate-180', s.menu === 'bulk');
    controls.querySelector('[data-gsheet-chevron]')?.classList.toggle('rotate-180', s.menu === 'gsheet');
  }

  // ── The "server" ──────────────────────────────────────────────────────────────────────
  let ticket = 0;
  function load() {
    const mine = ++ticket;
    store.set({ loading: true });
    renderListRegion();
    if (scenario === 'loading') return;
    setTimeout(() => {
      if (mine !== ticket) return;
      if (scenario === 'error') { store.set({ loading: false, error: 'Something went wrong while loading orders' }); renderListRegion(); return; }
      const s = S();
      const result = scenario === 'empty'
        ? { orders: [], totalDoc: 0 }
        : model.listOrders({ search: s.search, status: s.status, startDate: s.startDate, endDate: s.endDate, page: s.page, limit: s.limit });
      model.pinFulfilment(result.orders.map((o) => o.id));
      store.set({ loading: false, error: '', result });
      renderListRegion();
      syncHash();
    }, LATENCY_MS);
  }

  function syncHash() {
    const s = S();
    const q = new URLSearchParams();
    if (s.search) q.set('search', s.search);
    if (s.status) q.set('status', s.status);
    if (s.page > 1) q.set('page', String(s.page));
    if (s.expanded.length) q.set('expand', s.expanded.join(','));
    const hash = `#/orders${q.toString() ? `?${q}` : ''}`;
    if (location.hash !== hash) history.replaceState(null, '', hash + '');
  }

  // ── Toasts (react-toastify) ─────────────────────────────────────────────────────────────
  // A toast lives until its progress bar's 3s animation ends. The bar pauses while the pointer is
  // on a toast and while the window does not have focus, as react-toastify's does. Toasts are
  // added and removed one by one, so a showing toast's timer is never restarted.
  let toastSeq = 0;
  let toastHover = false;
  const toastPaused = () => toastHover || !document.hasFocus();
  function syncToasts() {
    const list = S().toasts;
    if (!list.length) { toastsEl = replace(toastsEl, toasts([])); toastsEl.dataset.region = 'toasts'; return; }
    let box = toastsEl.querySelector('.Toastify__toast-container');
    if (!box) { toastsEl = replace(toastsEl, toasts([])); toastsEl.dataset.region = 'toasts'; toastsEl.insertAdjacentHTML('beforeend', '<div class="Toastify__toast-container Toastify__toast-container--top-center"></div>'); box = toastsEl.firstElementChild; }
    const ids = new Set(list.map((t) => String(t.id)));
    box.querySelectorAll('[data-toast]').forEach((el) => { if (!ids.has(el.dataset.toast)) el.remove(); });
    list.forEach((t, i) => {
      const el = box.querySelector(`[data-toast="${t.id}"]`);
      if (el) { el.style.setProperty('--nth', i + 1); el.style.setProperty('--len', list.length); } else box.insertAdjacentHTML('beforeend', toastItem(t, i, list.length, toastPaused()));
    });
  }
  function toast(message, type = 'success') {
    // The same message is never stacked: while one is showing, a repeat is ignored.
    if (S().toasts.some((t) => t.type === type && t.message === message)) return;
    const id = ++toastSeq;
    store.set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    syncToasts();
  }
  const dropToast = (id) => { store.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })); syncToasts(); };
  root.addEventListener('animationend', (e) => { const el = e.target.closest?.('.Toastify__progress-bar') && e.target.closest('[data-toast]'); if (el) dropToast(Number(el.dataset.toast)); });
  const pauseToasts = () => root.querySelectorAll('.Toastify__progress-bar').forEach((b) => { b.style.animationPlayState = toastPaused() ? 'paused' : 'running'; });
  root.addEventListener('mouseover', (e) => { const on = !!e.target.closest?.('[data-toast]'); if (on !== toastHover) { toastHover = on; pauseToasts(); } });
  window.addEventListener('focus', pauseToasts);
  window.addEventListener('blur', pauseToasts);

  // ── The drawer slot: one drawer at a time (the product's MainDrawer). A closed drawer stays in
  // the DOM, off-screen, with its last content — rc-drawer never unmounts it.
  let closedDrawer = '';
  const drawers = {
    show(html, { entering = false } = {}) {
      overlayHost.querySelector(':scope > [data-drawer]')?.remove();
      overlayHost.classList.add('ant-scrolling-effect');
      overlayHost.style.overflow = 'hidden';
      overlayHost.insertAdjacentHTML('afterbegin', html);
      if (entering) overlayHost.querySelector('.drawer')?.focus({ preventScroll: true }); // rc-drawer focuses its panel on open
    },
    close(closedHtml) {
      closedDrawer = closedHtml;
      overlayHost.querySelector(':scope > [data-drawer]')?.remove();
      overlayHost.classList.remove('ant-scrolling-effect');
      overlayHost.style.overflow = '';
      if (closedDrawer) overlayHost.insertAdjacentHTML('afterbegin', closedDrawer);
    },
  };

  // ── The status-change audit drawer ──────────────────────────────────────────────────────
  let lastAudit = null;
  function renderAudit({ entering = false } = {}) {
    const a = S().audit;
    // Keep the operator's place: focus, caret and scroll survive a re-render.
    const active = document.activeElement;
    const key = active?.dataset?.testid && overlayHost.contains(active) ? active.dataset.testid : null;
    const caret = key && ['text', 'search', 'textarea'].includes(active.type) ? [active.selectionStart, active.selectionEnd] : null;
    const scroll = overlayHost.querySelector('[data-audit-scroll]')?.scrollTop || 0;
    if (!a) {
      drawers.close(lastAudit ? renderDrawer({ testId: 'drawer-update-inventory', size: 'large', open: false, content: renderAuditDrawer(model, { ...lastAudit, discardOpen: false, submitting: false }) }) : closedDrawer);
      return;
    }
    lastAudit = a;
    // The discard prompt lives inside the drawer panel, as the product's does — it is centred on
    // the panel, not the page (the panel's transform makes it the prompt's positioning frame).
    const prompt = a.discardOpen ? renderModal({ testId: 'discard-changes', size: 'sm', zIndex: 60, content: discardContent() }) : '';
    drawers.show(renderDrawer({ testId: 'drawer-update-inventory', size: 'large', entering, content: prompt + renderAuditDrawer(model, a) }), { entering });
    const sc = overlayHost.querySelector('[data-audit-scroll]');
    if (sc) sc.scrollTop = scroll;
    if (key) {
      const el = overlayHost.querySelector(`[data-testid="${key}"]`);
      if (el) { el.focus({ preventScroll: true }); if (caret) try { el.setSelectionRange(...caret); } catch { /* number inputs */ } }
    }
  }
  const setAudit = (patch, opts) => { store.set((s) => ({ audit: s.audit ? { ...s.audit, ...patch } : null })); renderAudit(opts); };
  function openAudit(orderId, newStatus) {
    const live = model.data.orderById.get(orderId);
    const order = { ...live, items: live.items.map((l) => ({ ...l })), stageAudit: [...(live.stageAudit || [])] };
    store.set({ audit: { orderId, order, newStatus, received: {}, comment: '', commentError: false, discardOpen: false, detailOpen: {}, submitting: false } });
    renderAudit({ entering: true });
  }
  function closeAudit() {
    store.set({ audit: null });
    renderAudit();
    load(); // closing the drawer refreshes the list, as the product does
  }
  /** Closing asks first when something was typed ("Discard Changes"). */
  function requestCloseAudit() {
    const a = S().audit;
    if (!a) return;
    if (auditView(model, a).unsaved) setAudit({ discardOpen: true });
    else closeAudit();
  }
  function submitAudit() {
    const a = S().audit;
    const v = auditView(model, a);
    if (v.variance && !a.comment.trim()) {
      setAudit({ commentError: true });
      overlayHost.querySelector('[data-audit-comment]')?.focus();
      toast('Please enter a reason for the variance', 'error');
      return;
    }
    setAudit({ commentError: false, submitting: true });
    setTimeout(() => {
      model.applyStatusChange(a.orderId, a.newStatus, { received: a.received, comment: a.comment, at: new Date(now()) });
      toast('Order audit updated successfully');
      closeAudit();
    }, LATENCY_MS);
  }

  function closeMenus() {
    if (!S().menu) return;
    const was = S().menu;
    store.set({ menu: null, calHover: null });
    if (was === 'status') renderStatus();
    if (was === 'create-mobile') renderFooterRegion();
    renderPortal();
  }

  // ── Create Order ──────────────────────────────────────────────────────────────────────
  const flow = createOrderFlow({ model, host: overlayHost, drawers, toast, now, onClosed: () => { lastAudit = null; load(); } });

  // ── Follow-up Reminders ───────────────────────────────────────────────────────────────
  const reminders = reminderFlow({ model, host: modalsEl, toast, now, onCreate: (id) => setTimeout(() => flow.openFor(id), 100) });

  // ── Create Delivery ───────────────────────────────────────────────────────────────────
  const delivery = deliveryFlow({ model, host: modalsEl, toast, now, onCreated: () => load() });

  // ── Bulk Sales Orders (standard and route) ────────────────────────────────────────────
  const bulk = bulkFlow({ model, host: overlayHost, routeHost: root.querySelector('[data-region="route-modal"]'), drawers, now, onClosed: () => { lastAudit = null; load(); } });

  // ── Invoice → Thermal Print ───────────────────────────────────────────────────────────
  const thermal = thermalFlow({ model, host: overlayHost });

  // ── Order Forecast (tenant flag) ──────────────────────────────────────────────────────
  // "Add to order" opens Create Order for the customer with the picked items (see forecast.js).
  const forecast = forecastFlow({ model, host: overlayHost, drawers, now, onClosed: () => { lastAudit = null; },
    onApply: (customerId, items) => { forecast.close(); setTimeout(() => flow.openSeeded(customerId, items), 0); } });

  // ── Generate Demand (tenant flag) ─────────────────────────────────────────────────────
  const demand = demandFlow({ model, host: overlayHost, drawers, now, onClosed: () => { lastAudit = null; } });

  // ── Interactions ──────────────────────────────────────────────────────────────────────
  const handlers = {
    ...thermal.handlers,
    ...demand.handlers,
    demand: () => { closeMenus(); demand.open(); },
    // Download All: orders.csv for the current filters (export-from-json's CSV).
    'download-all': () => {
      const st = S();
      const csv = model.exportCsv({ search: st.search, status: st.status, startDate: st.startDate, endDate: st.endDate });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'orders.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    ...forecast.handlers,
    forecast: () => { closeMenus(); forecast.open(); },
    ...flow.handlers,
    ...bulk.handlers,
    ...reminders.handlers,
    ...delivery.handlers,
    'create-delivery': () => { closeMenus(); delivery.open(); },
    reminders: () => { closeMenus(); reminders.open(); },
    'create-order': () => { closeMenus(); flow.open(); },
    'status-toggle': (e) => {
      if (e.target.closest('[data-act="status-clear"]')) return;
      const opening = S().menu !== 'status';
      closeMenus();
      if (opening) {
        const idx = Math.max(0, model.statusFilterOptions().findIndex((o) => o.value === S().status));
        store.set({ menu: 'status', statusFocus: idx });
      }
      renderStatus();
    },
    'status-pick': (_e, el) => pickStatus(el.dataset.value),
    'status-clear': (e) => { e.stopPropagation(); store.set({ status: '', menu: null, page: 1 }); renderStatus(); load(); },
    'date-toggle': () => {
      const opening = S().menu !== 'date';
      closeMenus();
      if (opening) {
        const base = S().dateRange[0] || new Date(now());
        store.set({ menu: 'date', calMonth: new Date(base.getFullYear(), base.getMonth(), 1) });
      }
      renderPortal();
    },
    'cal-prev': () => { const m = S().calMonth; store.set({ calMonth: new Date(m.getFullYear(), m.getMonth() - 1, 1) }); renderPortal(); },
    'cal-next': () => { const m = S().calMonth; store.set({ calMonth: new Date(m.getFullYear(), m.getMonth() + 1, 1) }); renderPortal(); },
    'cal-day': (_e, el) => {
      const [y, mo, d] = el.dataset.date.split('-').map(Number);
      const day = new Date(y, mo - 1, d);
      const [start, end] = S().dateRange;
      if (!start || end || day < start) { store.set({ dateRange: [day, null] }); renderDate(); renderPortal(); return; }
      const ymd = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
      store.set({ dateRange: [start, day], startDate: ymd(start), endDate: ymd(day), page: 1, menu: null, calHover: null });
      renderDate(); renderPortal(); load();
    },
    'date-clear': (e) => { e.preventDefault(); e.stopPropagation(); store.set({ dateRange: [null, null], startDate: '', endDate: '', page: 1 }); renderDate(); load(); },
    page: (_e, el) => {
      const p = Number(el.dataset.page);
      if (!p || el.disabled) return;
      store.set({ page: p }); load();
    },
    toggle: (e, el) => {
      if (e.target.closest('label, select')) return; // the card's status control does not toggle it
      const id = el.dataset.id;
      store.set((s) => ({ expanded: s.expanded.includes(id) ? s.expanded.filter((x) => x !== id) : [...s.expanded, id] }));
      renderListRegion(); syncHash();
    },
    tab: (_e, el) => { store.set((s) => ({ tabs: { ...s.tabs, [el.dataset.id]: el.dataset.tab } })); renderListRegion(); },
    copy: (e, el) => {
      e.stopPropagation();
      const value = el.dataset.value;
      const kind = el.dataset.kind;
      navigator.clipboard?.writeText(value).catch(() => {});
      toast(kind ? `${kind} reference copied: ${value}` : `Order reference copied: ${value}`);
      if (!kind || kind === 'Order') {
        store.set({ copied: value }); renderListRegion();
        setTimeout(() => { if (S().copied === value) { store.set({ copied: '' }); renderListRegion(); } }, 2000);
      }
    },
    'bulk-menu': () => {
      const opening = S().menu !== 'bulk';
      closeMenus();
      if (!opening) return;
      store.set({ menu: 'bulk', bulkPlaced: false });
      renderPortal();
      // Moved in place, not re-rendered: the product moves the same element.
      requestAnimationFrame(() => setTimeout(() => {
        if (S().menu !== 'bulk') return;
        store.set({ bulkPlaced: true });
        const el = overlayHost.querySelector('[data-overlay="bulk"]');
        const r = controls.querySelector('[data-bulk-anchor]').getBoundingClientRect();
        if (el) { el.style.top = `${r.bottom + 4}px`; el.style.right = `${window.innerWidth - r.right}px`; }
      }, 0));
    },
    // Google Sheet: both modes authenticate first, and with no credentials configured (as here —
    // there is no Google account behind a prototype) production answers with this error.
    gsheet: () => {
      const opening = S().menu !== 'gsheet';
      closeMenus();
      if (!opening) return;
      store.set({ menu: 'gsheet', bulkPlaced: false });
      renderPortal();
      requestAnimationFrame(() => setTimeout(() => {
        if (S().menu !== 'gsheet') return;
        store.set({ bulkPlaced: true });
        const el = overlayHost.querySelector('[data-overlay="gsheet"]');
        const r = controls.querySelector('[data-gsheet-anchor]').getBoundingClientRect();
        if (el) { el.style.top = `${r.bottom + 4}px`; el.style.right = `${window.innerWidth - r.right}px`; }
      }, 0));
    },
    'gsheet-pick': () => {
      closeMenus();
      toast('Google Sheet credentials missing. Set VITE_CLIENT_EMAIL, VITE_PRIVATE_KEY and VITE_GOOGLE_SPREADSHEET_ID in .env — or configure them in Settings → Google Sheet.', 'error');
    },
    'bulk-pick': (_e, el) => { closeMenus(); if (el.dataset.mode === 'ROUTE') bulk.openRoute(); else bulk.open(); },
    'create-mobile-toggle': () => { const opening = S().menu !== 'create-mobile'; closeMenus(); if (opening) store.set({ menu: 'create-mobile' }); renderFooterRegion(); },
    'create-mobile-close': () => closeMenus(),
    'invoice-menu': (e, el) => {
      e.stopPropagation();
      const opening = !(S().menu === 'invoice' && S().invoiceFor === el.dataset.testid);
      closeMenus();
      if (opening) { store.set({ menu: 'invoice', invoiceFor: el.dataset.testid }); renderPortal(); }
    },
    // A4 opens the invoice PDF in production — outside what the prototype can produce (see README →
    // Known differences). Thermal opens the receipt preview.
    'invoice-a4': () => closeMenus(),
    'invoice-thermal': () => { const id = (S().invoiceFor || '').replace(/^order-invoice-btn-(mobile-)?/, ''); closeMenus(); if (id) thermal.open(id); },
    // View and Timeline lead to host pages (/order/…, /order-timeline/…) outside this module.
    view: (e) => e.preventDefault(),
    timeline: (e) => e.preventDefault(),
    'drawer-close': () => (demand.isOpen() ? demand.close() : forecast.isOpen() ? forecast.close() : bulk.isOpen() ? bulk.requestClose() : flow.isOpen() ? flow.requestClose() : requestCloseAudit()),
    'modal-close': () => (bulk.routeOpen() ? bulk.closeRoute() : bulk.closeModal() ? null : delivery.isOpen() ? delivery.close() : flow.isOpen() ? flow.closeDiscard() : setAudit({ discardOpen: false })),
    'discard-wait': () => (bulk.discardOpen() ? bulk.closeDiscard() : flow.isOpen() ? flow.closeDiscard() : setAudit({ discardOpen: false })),
    'discard-confirm': () => (bulk.discardOpen() ? bulk.confirmDiscard() : flow.isOpen() ? flow.confirmDiscard() : closeAudit()),
    'audit-step': (_e, el) => {
      const a = S().audit;
      const id = el.dataset.id;
      const line = a.order.items.find((l) => l.productId === id);
      const cur = Number(a.received[id] ?? line.qty) || 0;
      setAudit({ received: { ...a.received, [id]: Math.max(0, cur + Number(el.dataset.step)) } });
    },
    'audit-detail': (_e, el) => { const a = S().audit; setAudit({ detailOpen: { ...a.detailOpen, [el.dataset.id]: !a.detailOpen[el.dataset.id] } }); },
    'audit-submit': () => { if (!S().audit.submitting) submitAudit(); },
    'toast-close': (_e, el) => dropToast(Number(el.dataset.id)),
  };
  delegate(root, 'click', handlers);
  delegate(overlayHost, 'click', handlers);
  wireTooltips(root);

  // A row's status control: picking the next status opens the audit; the row keeps showing the
  // current status until the audit is submitted.
  root.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-act-change="status-change"]');
    if (!sel) return;
    const order = model.data.orderById.get(sel.dataset.id);
    const next = sel.value;
    sel.value = order.status;
    if (next !== order.status) openAudit(order.id, next);
  });
  root.addEventListener('input', (e) => bulk.onInput(e));
  overlayHost.addEventListener('change', (e) => { if (!demand.onChange(e)) bulk.onChange(e); });
  overlayHost.addEventListener('input', (e) => {
    if (bulk.onInput(e)) return;
    if (forecast.onInput(e)) return;
    if (demand.onInput(e)) return;
    if (flow.onInput(e)) return;
    const a = S().audit;
    if (!a) return;
    const qty = e.target.closest('[data-audit-qty]');
    if (qty) {
      const v = qty.value;
      if (v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0)) { qty.value = a.received[qty.dataset.auditQty] ?? ''; return; }
      setAudit({ received: { ...a.received, [qty.dataset.auditQty]: v } });
    }
    if (e.target.matches('[data-audit-comment]')) {
      const wasError = a.commentError;
      store.set((s) => ({ audit: { ...s.audit, comment: e.target.value, commentError: false } }));
      if (wasError) renderAudit();
      else if (auditView(model, S().audit).variance) { /* the asterisk is already shown */ }
    }
  });
  overlayHost.addEventListener('focusout', (e) => {
    const qty = e.target.closest?.('[data-audit-qty]');
    if (qty && S().audit && (qty.value === '' || Number(qty.value) < 0)) setAudit({ received: { ...S().audit.received, [qty.dataset.auditQty]: 0 } });
  });
  overlayHost.addEventListener('focusin', (e) => { flow.onFocus(e, true); bulk.onFocus(e, true); });
  overlayHost.addEventListener('focusout', (e) => { flow.onFocus(e, false); bulk.onFocus(e, false); });
  document.addEventListener('mousedown', (e) => { flow.onMouseDown(e); bulk.onMouseDown(e); demand.onMouseDown(e); });
  overlayHost.addEventListener('mousemove', (e) => { flow.onMenuHover(e); bulk.onMenuHover(e); });
  overlayHost.addEventListener('mouseover', (e) => bulk.onHover(e, true));
  overlayHost.addEventListener('mouseout', (e) => bulk.onHover(e, false));
  document.addEventListener('keydown', (e) => {
    if (bulk.onKeyDown(e)) return;
    if (e.key === 'Escape' && flow.isOpen()) { if (flow.discardOpen()) flow.closeDiscard(); else flow.requestClose(); return; }
    if (e.key !== 'Escape' || !S().audit) return;
    if (S().audit.discardOpen) setAudit({ discardOpen: false }); else requestCloseAudit();
  });

  // Anything clicked outside an open menu closes it (react-select, the calendar and the Bulk
  // dropdown all close on an outside press).
  document.addEventListener('mousedown', (e) => {
    const m = S().menu;
    if (!m) return;
    const inside = (m === 'status' && (e.target.closest('.so-select') || e.target.closest('.so-select-portal')))
      || (m === 'date' && (e.target.closest('.react-datepicker') || e.target.closest('[data-slot="date"]')))
      || (m === 'bulk' && (e.target.closest('[data-overlay="bulk"]') || e.target.closest('[data-bulk-anchor]')))
      || (m === 'gsheet' && (e.target.closest('[data-overlay="gsheet"]') || e.target.closest('[data-gsheet-anchor]')))
      || (m === 'create-mobile' && e.target.closest('[data-testid="orders-create-btn-mobile"], [data-testid^="orders-create-menu-"]'))
      || (m === 'invoice' && (e.target.closest('[data-overlay="invoice"]') || e.target.closest(`[data-testid="${S().invoiceFor}"]`)));
    if (!inside) closeMenus();
  });

  // Status options take focus under the pointer, as react-select's do.
  const onMove = (e) => {
    const opt = e.target.closest('.so-select__option');
    if (opt && Number(opt.dataset.index) !== S().statusFocus) { store.set({ statusFocus: Number(opt.dataset.index) }); renderStatus(); }
    const day = e.target.closest('.react-datepicker__day');
    if (day && S().menu === 'date' && S().dateRange[0] && !S().dateRange[1]) {
      const [y, mo, d] = day.dataset.date.split('-').map(Number);
      const h = new Date(y, mo - 1, d);
      if (!S().calHover || S().calHover.getTime() !== h.getTime()) { store.set({ calHover: h }); renderPortal(); }
    }
  };
  root.addEventListener('mousemove', onMove);
  overlayHost.addEventListener('mousemove', onMove);

  // The status filter's keyboard: arrows move the focused option, Enter picks it, Escape closes.
  document.addEventListener('keydown', (e) => {
    if (S().menu !== 'status' && !e.target.closest?.('.so-select')) return;
    const options = model.statusFilterOptions();
    const s = S();
    if (s.menu !== 'status') {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); store.set({ menu: 'status', statusFocus: 0 }); renderStatus(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); store.set({ statusFocus: (s.statusFocus + 1) % options.length }); renderStatus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); store.set({ statusFocus: (s.statusFocus - 1 + options.length) % options.length }); renderStatus(); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = options[s.statusFocus]; if (o) pickStatus(o.value); }
    else if (e.key === 'Escape') { closeMenus(); }
  });

  // Search: debounced, resets to page 1.
  const search = controls.querySelector('[data-testid="orders-search-input"]');
  let debounce = null;
  search.addEventListener('input', () => {
    store.set({ searchInput: search.value });
    clearTimeout(debounce);
    debounce = setTimeout(() => { store.set({ search: search.value.trim(), page: 1 }); load(); }, SEARCH_DEBOUNCE_MS);
  });
  controls.querySelector('[data-filters]').addEventListener('submit', (e) => { e.preventDefault(); clearTimeout(debounce); store.set({ search: search.value.trim(), page: 1 }); load(); });

  // Smart Insights: shown while the pointer is on the ⚡ icon or on the card; hidden 150ms after leaving.
  let hideTimer = null;
  const onOver = (e) => {
    const icon = e.target.closest('[data-insights]');
    const card = e.target.closest('[data-overlay="insights"]');
    if (card) { clearTimeout(hideTimer); return; }
    if (icon && S().insight?.id !== icon.dataset.insights) {
      clearTimeout(hideTimer);
      store.set({ insight: { id: icon.dataset.insights, pos: insightPosition(icon) } });
      renderPortal();
    } else if (icon) clearTimeout(hideTimer);
  };
  root.addEventListener('mouseover', onOver);
  overlayHost.addEventListener('mouseover', onOver);
  const onOut = (e) => {
    const from = e.target.closest('[data-insights], [data-overlay="insights"]');
    if (!from || from.contains(e.relatedTarget)) return;
    const toCard = e.relatedTarget?.closest?.('[data-overlay="insights"]');
    if (toCard) return;
    clearTimeout(hideTimer);
    const delay = from.matches('[data-overlay="insights"]') ? 0 : 150;
    hideTimer = setTimeout(() => { store.set({ insight: null }); renderPortal(); }, delay);
  };
  root.addEventListener('mouseout', onOut);
  overlayHost.addEventListener('mouseout', onOut);
  window.addEventListener('resize', () => { if (S().menu) renderPortal(); flow.reposition(); bulk.reposition(); });
  // The invoice menu follows its button while the page scrolls.
  window.addEventListener('scroll', () => { if (S().menu === 'invoice') renderPortal(); hideTooltip(); }, true);

  load();
  return { store, model, toast, reload: load };
}

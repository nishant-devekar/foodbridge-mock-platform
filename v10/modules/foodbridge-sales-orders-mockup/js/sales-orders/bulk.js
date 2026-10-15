/*
  Bulk Sales Orders: the drawer's state and interactions, standard and route mode.

  Standard: pick customers (a paged, searched list, or a whole catalogue's customers), pick
  products from their catalogue, enter a quantity per product × customer, preview, create one
  order per customer. Route: pick a route first; its customers and every catalogue product are
  pre-selected and the drawer opens straight on the grid.

  Behaviour reproduced from production as it is, including where it surprises:
  - Picking a catalogue adds its customers but NOT its products: the selection is rebuilt from
    the products the operator ticked whenever the customers change, and catalogue products were
    never ticked (ConfigureBulkOrders' rehydrate effect).
  - Creating closes the drawer with no toast; the list refreshes.
  - Closing the drawer with any customer picked asks "Discard Changes" first.

  State in, HTML out (bulk-views.js); every change re-renders the drawer and keeps focus, caret
  and scroll, as the other flows do.
*/
import { renderDrawer } from '../components/drawer.js';
import { renderBulkDrawer, bulkView, qkey, dropdownCustomers, customerOptions, catalogueMenu, catalogueOptions, renderRouteSelect } from './bulk-views.js';
import { toTitleCase } from './model.js';

const LATENCY_MS = 150;
const SEARCH_DEBOUNCE_MS = 300;
const BLUR_CLOSE_MS = 200;

const pathOf = (el, root) => { const p = []; for (let n = el; n && n !== root; n = n.parentElement) p.unshift([...n.parentElement.children].indexOf(n)); return p; };
const elAt = (root, path) => path.reduce((n, i) => n?.children[i], root);

function loadingMessage(count, adding, removing) {
  if (removing) return 'Updating product catalogue...';
  if (count === 1) return 'Fetching products from customer catalogue...';
  if (count === 2) return 'Analyzing catalogues from 2 customers...';
  if (count >= 3) return `Consolidating products from ${count} customer catalogues...`;
  return adding ? 'Loading available products...' : 'Preparing product list...';
}

export function bulkFlow({ model: m, host, routeHost, drawers, now, onClosed }) {
  let b = null;
  let r = null; // the route picker
  const catalogueIds = () => m.catalogue.flatMap((c) => c.subs.flatMap((s) => s.products.map((p) => p.id)));

  const fresh = (mode, route = null) => ({
    mode, route, step: mode === 'ROUTE' ? 0 : 1,
    routeCustomers: route ? route.customerIds.filter((id) => m.data.customerById.has(id)) : [],
    customers: [], selected: [], remembered: [], loadingProducts: false, loadingMsg: '',
    custSearch: '', custQuery: '', custOpen: false, custPages: 1, custLoading: mode !== 'ROUTE', custLoadingMore: false,
    catalogue: null, catMenu: false, catFocus: 0, catFocused: false, confirm: null,
    prodSearch: '', collapsed: [],
    qty: {}, raw: {}, removed: [], prices: {}, editing: null, tempPrice: '', priceError: '', pendingDelete: null,
    preview: false, previewAt: 0, expanded: {}, notify: false, submitting: false, discard: false, tip: false,
  });

  // ── Rendering ───────────────────────────────────────────────────────────────────────────
  let rendering = false;
  function render({ entering = false } = {}) {
    rendering = true;
    try { paint({ entering }); } finally { rendering = false; }
  }
  function paint({ entering }) {
    const active = document.activeElement;
    const inside = active && host.contains(active);
    const key = inside ? (active.id ? `#${CSS.escape(active.id)}` : active.dataset?.testid ? `[data-testid="${active.dataset.testid}"]` : null) : null;
    const caret = key && active.type === 'text' ? [active.selectionStart, active.selectionEnd] : null;
    const drawerEl = host.querySelector(':scope > [data-drawer]');
    const scrolled = [];
    if (drawerEl) for (const el of drawerEl.querySelectorAll('*')) if (el.scrollTop || el.scrollLeft) scrolled.push([pathOf(el, drawerEl), el.scrollTop, el.scrollLeft]);
    drawers.show(renderDrawer({ testId: 'drawer-bulk-order', size: 'large', entering, content: renderBulkDrawer(m, b) }), { entering });
    const fresh = host.querySelector(':scope > [data-drawer]');
    for (const [path, top, left] of scrolled) { const el = elAt(fresh, path); if (el) { el.scrollTop = top; el.scrollLeft = left; } }
    const priceInput = b.editing && host.querySelector('[data-bulk-price]');
    if (priceInput && b.focusPrice) { b.focusPrice = false; priceInput.focus({ preventScroll: true }); } // autoFocus
    else if (key) {
      const el = host.querySelector(key);
      if (el && !el.disabled) {
        if (el.tagName === 'INPUT' && active.tagName === 'INPUT' && el !== active) {
          // The field being typed in survives the re-render as the same node (React keeps it), so
          // its caret, selection and typed text stay exactly where they were.
          for (const a of [...active.attributes]) if (!el.hasAttribute(a.name)) active.removeAttribute(a.name);
          for (const a of el.attributes) if (a.name !== 'value' && active.getAttribute(a.name) !== a.value) active.setAttribute(a.name, a.value);
          el.replaceWith(active);
          active.focus({ preventScroll: true });
        } else { el.focus({ preventScroll: true }); if (caret) try { el.setSelectionRange(...caret); } catch { /* */ } }
      }
    }
    const dd = host.querySelector('[data-bulk-dropdown]');
    if (dd) dd.addEventListener('scroll', onDropdownScroll, { passive: true });
    renderCatalogueMenu();
    requestAnimationFrame(() => { if (b) autoPage(); }); // after paint, as the product's effect runs
  }
  const set = (patch, opts) => { Object.assign(b, patch); render(opts); };

  /**
   * The catalogue picker's focus and menu, updated in place — a re-render between a press and its
   * release would replace the pressed node and cancel the click.
   */
  function syncCatalogue() {
    const ctl = host.querySelector('[data-bc] .bc-control');
    if (ctl) {
      const f = b.catMenu || b.catFocused;
      ctl.classList.toggle('bc-control--focused', f);
      ctl.querySelectorAll('.bc-ind').forEach((x) => x.classList.toggle('bc-ind--focused', f));
      ctl.querySelector('input')?.setAttribute('aria-expanded', String(b.catMenu));
    }
    renderCatalogueMenu();
  }
  /** The catalogue picker's portalled menu, updated in place while open. */
  function renderCatalogueMenu() {
    const existing = host.querySelector(':scope > [data-overlay="bulk-catalogue"]');
    const control = host.querySelector('[data-bc] .bc-control');
    if (!b?.catMenu || !control) { existing?.remove(); return; }
    if (existing) existing.querySelector('.bc-list').innerHTML = catalogueOptions(m, b);
    else host.insertAdjacentHTML('beforeend', catalogueMenu(m, b, control));
  }

  // ── Customers ───────────────────────────────────────────────────────────────────────────
  let fetchTimer = null;
  function fetchCustomers({ pages = 1, query = b.custSearch, append = false } = {}) {
    clearTimeout(fetchTimer);
    if (append) b.custLoadingMore = true; else b.custLoading = true;
    render();
    fetchTimer = setTimeout(() => { if (!b) return; set({ custPages: pages, custQuery: query, custLoading: false, custLoadingMore: false }); }, LATENCY_MS);
  }
  function onDropdownScroll(e) {
    const el = e.currentTarget;
    if (!b || b.mode === 'ROUTE' || b.custLoadingMore || !dropdownCustomers(m, b).hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 48) fetchCustomers({ pages: b.custPages + 1, query: b.custQuery, append: true });
  }
  /** A list too short to scroll pages itself in (a page of 8 barely fills the menu). */
  function autoPage() {
    const el = host.querySelector('[data-bulk-dropdown]');
    if (!el || b.mode === 'ROUTE' || b.custLoadingMore || !dropdownCustomers(m, b).hasMore) return;
    if (el.scrollHeight - el.clientHeight <= 4) fetchCustomers({ pages: b.custPages + 1, query: b.custQuery, append: true });
  }

  /** The customers change: their catalogue reloads, and the selection is rebuilt from what was ticked. */
  let catalogueTimer = null;
  function setCustomers(next, { merged = [] } = {}) {
    const prev = b.customers.length;
    b.customers = next;
    clearTimeout(catalogueTimer);
    if (!next.length) { b.selected = []; b.loadingProducts = false; render(); return; }
    b.loadingProducts = true;
    b.loadingMsg = loadingMessage(next.length, next.length > prev, next.length < prev);
    if (merged.length) b.selected = [...new Set([...b.selected, ...merged])];
    render();
    catalogueTimer = setTimeout(() => {
      if (!b) return;
      set({ loadingProducts: false, collapsed: [], selected: catalogueIds().filter((id) => b.remembered.includes(id)) });
    }, LATENCY_MS * 2);
  }
  const toggleCustomer = (id) => setCustomers(b.customers.includes(id) ? b.customers.filter((x) => x !== id) : [...b.customers, id]);

  // ── Products ────────────────────────────────────────────────────────────────────────────
  const productIdsOf = (subId) => m.catalogue.flatMap((c) => c.subs).find((s) => s.id === subId)?.products.map((p) => p.id) || [];
  function toggleProduct(id, on) {
    b.remembered = on ? [...new Set([...b.remembered, id])] : b.remembered.filter((x) => x !== id);
    b.selected = on ? [...b.selected.filter((x) => x !== id), id] : b.selected.filter((x) => x !== id);
    render();
  }
  function toggleSub(subId) {
    const ids = productIdsOf(subId);
    const all = ids.every((id) => b.selected.includes(id));
    if (all) { b.remembered = b.remembered.filter((x) => !ids.includes(x)); b.selected = b.selected.filter((x) => !ids.includes(x)); }
    else {
      const add = ids.filter((id) => !b.selected.includes(id));
      b.remembered = [...new Set([...b.remembered, ...add])];
      b.selected = [...b.selected, ...add];
      b.collapsed = b.collapsed.filter((x) => x !== subId);
    }
    render();
  }

  // ── Opening and closing ─────────────────────────────────────────────────────────────────
  function open(mode = 'STANDARD', route = null) {
    b = fresh(mode, route);
    render({ entering: true });
    if (mode === 'ROUTE') {
      // Route setup: the route's customers, then their catalogue, then everything selected.
      setTimeout(() => {
        if (!b) return;
        const ids = catalogueIds();
        set({ customers: [...b.routeCustomers], selected: ids, remembered: ids });
        setTimeout(() => { if (b) set({ step: 2 }); }, LATENCY_MS * 2);
      }, LATENCY_MS);
    } else setTimeout(() => { if (b) set({ custLoading: false }); }, LATENCY_MS);
  }
  function close() {
    const closed = renderDrawer({ testId: 'drawer-bulk-order', size: 'large', open: false, content: renderBulkDrawer(m, { ...b, discard: false, preview: false, confirm: null, catMenu: false }) });
    b = null;
    host.querySelector(':scope > [data-overlay="bulk-catalogue"]')?.remove();
    drawers.close(closed);
    onClosed();
  }
  function requestClose() {
    if (!b) return;
    if (b.customers.length) set({ discard: true }); else close();
  }

  // ── Placing the orders ──────────────────────────────────────────────────────────────────
  function create() {
    const v = bulkView(m, b);
    set({ submitting: true });
    setTimeout(() => {
      if (!b) return;
      const at = new Date(now());
      const placed = v.orders.map((o) => m.placeOrder({ customerId: o.customer.id, at, lines: o.items.map((i) => ({ product: i.product, qty: i.qty, price: Number(i.unit) / (1 + (i.product.tax || 0) / 100) })) }));
      // Each line is stored at its ROUNDED tax-inclusive unit price, taken back out of tax — so the
      // placed order totals ₹ 216.85 where the grid showed ₹ 216.83, as production's do.
      // Route mode: the orders go out together as the route's delivery.
      if (b.mode === 'ROUTE' && placed.length) m.createDelivery({ orderIds: placed.map((o) => o.id), staffIds: b.route.staffIds, name: b.route.name, at }); // cafex staffs the run from the template
      b.preview = false;
      close();
    }, LATENCY_MS);
  }

  // ── The route picker ────────────────────────────────────────────────────────────────────
  function renderRoute() {
    const active = document.activeElement;
    const typing = active?.matches?.('[data-route-name]') ? [active.selectionStart, active.selectionEnd] : null;
    routeHost.innerHTML = r ? renderRouteSelect(m, r) : '';
    const input = r && routeHost.querySelector('[data-route-name]');
    if (input && (typing || r.focusName)) { r.focusName = false; input.focus({ preventScroll: true }); if (typing) input.setSelectionRange(...typing); }
  }
  function openRoute() {
    r = { loading: true, selected: null, name: '', staffId: null };
    renderRoute();
    setTimeout(() => { if (r) { r.loading = false; renderRoute(); } }, LATENCY_MS);
  }

  const handlers = {
    // Route picker
    'route-pick': (_e, el) => {
      const t = m.data.routeTemplates.find((x) => x.id === el.dataset.id);
      const d = new Date(now());
      const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      // The first assigned staff member who is still on the roster is picked silently.
      const staffId = t.staffIds.find((id) => m.data.staff.some((s) => s.id === id)) || null;
      Object.assign(r, { selected: t.id, name: `${t.name || 'Route'} ${date}`, staffId, focusName: true });
      renderRoute();
    },
    'route-cancel': () => { r = null; renderRoute(); },
    'route-confirm': () => {
      if (!r?.selected || !r.name.trim()) return;
      const t = m.data.routeTemplates.find((x) => x.id === r.selected);
      const route = { templateId: t.id, customerIds: t.customerIds, staffIds: t.staffIds, name: r.name.trim() };
      r = null; renderRoute();
      open('ROUTE', route);
    },

    // Step 1 — customers
    'bulk-customer-cta': () => { b.custOpen = true; render(); host.querySelector('[data-testid="configure-bulk-order-customer-search-input"]')?.focus(); },
    'bulk-customer-dropdown': () => {
      const opening = !b.custOpen;
      set({ custOpen: opening });
      if (opening) host.querySelector('[data-testid="configure-bulk-order-customer-search-input"]')?.focus();
    },
    'bulk-customer': (_e, el) => toggleCustomer(el.dataset.id),
    'bulk-customers-clear': () => setCustomers([]),
    'bulk-customer-remove': (_e, el) => toggleCustomer(el.dataset.id),
    'bulk-customer-search-clear': () => { b.custSearch = ''; if (b.mode !== 'ROUTE') fetchCustomers({ query: '' }); else render(); },
    // Step 1 — catalogue
    'bulk-catalogue-toggle': (e) => {
      if (e.target.closest('[data-act="bulk-catalogue-clear"]')) return;
      const i = Math.max(0, m.catalogues.findIndex((c) => c.id === b.catalogue));
      Object.assign(b, { catMenu: !b.catMenu, catFocus: i, catFocused: true });
      host.querySelector('#configure-bulk-order-catalogue-select-input')?.focus({ preventScroll: true });
      syncCatalogue();
    },
    'bulk-catalogue-clear': (e) => { e.stopPropagation(); set({ catalogue: null, catMenu: false }); },
    'bulk-catalogue-pick': (_e, el) => {
      const id = el.dataset.id;
      set({ catalogue: id, catMenu: false });
      setTimeout(() => { if (b && b.catalogue === id) set({ confirm: id }); }, LATENCY_MS * 2);
    },
    'bulk-confirm-cancel': () => set({ confirm: null, catalogue: null }),
    'bulk-confirm': () => {
      const id = b.confirm;
      const add = m.data.customers.filter((c) => m.catalogueOf(c).id === id).map((c) => c.id);
      b.confirm = null;
      setCustomers([...new Set([...b.customers, ...add])], { merged: catalogueIds() });
    },
    // Step 1 — products
    // The whole header toggles its section — the checkbox too, as in production: a press on the box
    // reaches the header once (it folds, then selecting unfolds it again); a press on the label
    // reaches it twice (label, then the box), so the section stays as it was.
    'bulk-sub-toggle': (e, el) => {
      const id = el.dataset.id;
      const fold = () => { b.collapsed = b.collapsed.includes(id) ? b.collapsed.filter((x) => x !== id) : [...b.collapsed, id]; };
      if (e.target.closest('input, label')) {
        e.preventDefault(); // applied from state: the re-render replaces the box
        if (!e.target.closest('label')) fold();
        toggleSub(id);
        return;
      }
      fold();
      render();
    },
    'bulk-products-all': () => { const ids = catalogueIds(); set({ selected: ids, remembered: ids, collapsed: [] }); },
    'bulk-products-none': () => set({ selected: [], remembered: [] }),
    'bulk-product-search-clear': () => set({ prodSearch: '', collapsed: [] }),
    'bulk-add-products': () => {}, // the full-catalogue picker adds nothing here: every product is already in the catalogue
    'bulk-proceed': () => { if (b.selected.length && b.customers.length) set({ step: 2, prices: {}, custOpen: false }); },

    // Step 2 — grid
    'bulk-change-selection': () => set({ step: 1, prices: {}, editing: null }),
    'bulk-clear-all': () => set({ qty: {}, raw: {}, removed: [] }),
    'bulk-qty-clear': (_e, el) => {
      const key = el.dataset.key;
      const c = m.data.customerById.get(b.customers.find((id) => key.endsWith(`-${id}`)));
      const cur = Number(b.qty[key]) || 0;
      set({ pendingDelete: { key, prevQty: cur > 0 ? cur : null, customerName: toTitleCase(c?.name) || c?.name } });
    },
    'bulk-pending-keep': () => {
      const { key, prevQty } = b.pendingDelete;
      if (key && prevQty != null) b.qty[key] = prevQty;
      set({ pendingDelete: null });
    },
    'bulk-pending-clear': () => {
      const { key } = b.pendingDelete;
      delete b.qty[key]; delete b.raw[key];
      set({ pendingDelete: null, removed: [...b.removed, key] });
    },
    'bulk-qty-restore': (_e, el) => set({ removed: b.removed.filter((k) => k !== el.dataset.key) }),
    'bulk-price-edit': (_e, el) => {
      const key = el.dataset.key;
      const v = bulkView(m, b);
      const x = v.products.find((y) => key.startsWith(`${y.p.id}-`));
      const c = v.customers.find((y) => key.endsWith(`-${y.id}`));
      set({ editing: key, tempPrice: String(v.unit(x.p, c)), priceError: '', focusPrice: true });
    },
    'bulk-price-confirm': () => confirmPrice(),
    'bulk-price-cancel': () => set({ editing: null, tempPrice: '', priceError: '' }),
    'bulk-preview': () => { if (!bulkView(m, b).previewDisabled) set({ preview: true, previewAt: now(), expanded: {} }); },

    // Preview
    'bulk-preview-toggle': (_e, el) => { const i = el.dataset.index; set({ expanded: { ...b.expanded, [i]: !b.expanded[i] } }); },
    'bulk-preview-back': () => set({ preview: false }),
    'bulk-create': () => { if (!b.submitting) create(); },
  };

  function confirmPrice() {
    const value = b.tempPrice;
    let error = '';
    if (value.trim() === '') error = 'Price cannot be empty';
    else if (Number.isNaN(Number(value))) error = 'Please enter a valid number';
    else if (Number(value) < 0) error = 'Price cannot be negative';
    else if (!/^-?\d*\.?\d+$/.test(value.trim())) error = 'Please enter numbers only';
    if (error) { set({ priceError: error }); return; }
    set({ prices: { ...b.prices, [b.editing]: Number(value) }, editing: null, tempPrice: '', priceError: '' });
  }

  // ── Events the screen forwards ──────────────────────────────────────────────────────────
  let searchTimer = null;
  let blurTimer = null;
  function onInput(e) {
    const t = e.target;
    if (r && t.matches('[data-route-name]')) { r.name = t.value; const btn = routeHost.querySelector('[data-testid="route-select-modal-confirm-btn"]'); if (btn) btn.disabled = !(r.selected && r.name.trim()); return true; }
    if (!b) return false;
    if (t.matches('[data-testid="configure-bulk-order-customer-search-input"]')) {
      b.custSearch = t.value;
      if (b.mode === 'ROUTE') { render(); return true; }
      render();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { if (b) fetchCustomers({ query: t.value }); }, SEARCH_DEBOUNCE_MS);
      return true;
    }
    if (t.matches('[data-testid="configure-bulk-order-product-search-input"]')) { set({ prodSearch: t.value, collapsed: [] }); return true; }
    if (t.matches('[data-bulk-qty]')) {
      const key = t.dataset.bulkQty;
      b.raw[key] = t.value;
      b.qty[key] = t.value === '' ? null : Number.parseInt(t.value, 10) || 0;
      render();
      return true;
    }
    if (t.matches('[data-bulk-price]')) { b.tempPrice = t.value; if (b.priceError) { b.priceError = ''; render(); } return true; }
    if (t.matches('[data-bulk-notify]')) { b.notify = t.checked; return true; }
    return false;
  }
  function onChange(e) {
    if (!b) return false;
    const t = e.target;
    if (t.matches('[data-bulk-product]')) { toggleProduct(t.dataset.bulkProduct, t.checked); return true; }
    return false;
  }
  function onFocus(e, focused) {
    if (!b || rendering) return;
    const t = e.target;
    if (t.matches?.('[data-testid="configure-bulk-order-customer-search-input"]')) {
      clearTimeout(blurTimer);
      if (focused) { if (!b.custOpen) set({ custOpen: true }); }
      else blurTimer = setTimeout(() => { if (b && b.custOpen && document.activeElement !== t) set({ custOpen: false }); }, BLUR_CLOSE_MS);
    }
    if (t.id === 'configure-bulk-order-catalogue-select-input') {
      b.catFocused = focused;
      if (!focused) b.catMenu = false;
      syncCatalogue();
    }
    // A committed quantity's typed form is dropped on blur ("03" shows as 3 again).
    if (!focused && t.matches?.('[data-bulk-qty]')) delete b.raw[t.dataset.bulkQty];
  }
  function onKeyDown(e) {
    if (r && e.key === 'Escape') { r = null; renderRoute(); return true; }
    if (!b) return false;
    if (e.target.matches?.('[data-bulk-price]')) {
      if (e.key === 'Enter') { confirmPrice(); return true; }
      if (e.key === 'Escape') { set({ editing: null, tempPrice: '', priceError: '' }); return true; }
      return false;
    }
    if (e.key !== 'Escape') return false;
    if (b.discard) set({ discard: false });
    else if (b.catMenu) { b.catMenu = false; syncCatalogue(); }
    else requestClose();
    return true;
  }

  return {
    handlers, onInput, onChange, onFocus, onKeyDown, openRoute,
    open: () => open('STANDARD'),
    isOpen: () => !!b,
    routeOpen: () => !!r,
    closeRoute: () => { r = null; renderRoute(); },
    requestClose,
    discardOpen: () => !!b?.discard,
    closeDiscard: () => b && set({ discard: false }),
    confirmDiscard: () => b && close(),
    /** Closes whichever modal is on top inside the drawer. */
    closeModal() {
      if (!b) return false;
      if (b.discard) set({ discard: false });
      else if (b.confirm) set({ confirm: null, catalogue: null });
      else if (b.preview) set({ preview: false });
      else return false;
      return true;
    },
    onMouseDown(e) {
      if (!b) return;
      // The bin keeps focus where it was (it prevents the press from focusing it).
      if (e.target.closest('[data-bulk-nofocus], [data-testid^="configure-bulk-order-customer-option-"], [data-testid="configure-bulk-order-customer-clear-all-btn"]')) e.preventDefault();
      if (b.catMenu && !e.target.closest('[data-bc], [data-overlay="bulk-catalogue"]')) { b.catMenu = false; syncCatalogue(); }
      // react-select keeps its input focused while an option is pressed.
      if (e.target.closest('[data-overlay="bulk-catalogue"]')) e.preventDefault();
    },
    onMenuHover(e) {
      const opt = e.target.closest('.bc-option');
      if (!opt || !b || Number(opt.dataset.index) === b.catFocus) return;
      b.catFocus = Number(opt.dataset.index);
      renderCatalogueMenu();
    },
    onHover(e, entering) {
      if (!b || b.step !== 2) return;
      const wrap = e.target.closest?.('[data-bulk-preview-wrap]');
      if (!wrap || (!entering && wrap.contains(e.relatedTarget))) return;
      const tip = entering && bulkView(m, b).previewDisabled;
      if (tip !== b.tip) set({ tip });
    },
    reposition() { if (b?.catMenu) { host.querySelector(':scope > [data-overlay="bulk-catalogue"]')?.remove(); renderCatalogueMenu(); } },
    get qkey() { return qkey; },
  };
}

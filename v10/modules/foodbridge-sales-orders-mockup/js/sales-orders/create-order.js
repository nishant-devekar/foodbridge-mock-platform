/*
  Create Order: the drawer's state and interactions, from picking a customer to placing the order.

  State in, HTML out (create-views.js, cart-modal.js); every change re-renders the drawer and keeps
  the operator's place — focus, caret and scroll survive. The screen owns the drawer slot (one
  drawer at a time, as the product's MainDrawer) and the toasts.
*/
import { renderDrawer, renderModal } from '../components/drawer.js';
import { renderCreateDrawer, createView, customerMenu, customerOptions, menuPlace } from './create-views.js';
import { renderCart, cartTotals, paymentMethods } from './cart-modal.js';
import { discardContent } from './audit-drawer.js';

const LATENCY_MS = 150;
const SEARCH_DEBOUNCE_MS = 300; // the product's search spinner shows this long
const fresh = () => ({
  customerId: null, menu: null, menuFocus: 0, pickerFocused: false, pickerPages: 1,
  searchInput: '', search: '', searching: false, sub: '', collapsed: [],
  qty: {}, added: [], comment: '', cart: null, discardOpen: false,
});

const pathOf = (el, root) => { const p = []; for (let n = el; n && n !== root; n = n.parentElement) p.unshift([...n.parentElement.children].indexOf(n)); return p; };
const elAt = (root, path) => path.reduce((n, i) => n?.children[i], root);

export function createOrderFlow({ model: m, host, drawers, toast, now, onClosed }) {
  let c = null;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const round2 = (v) => Math.round(v * 100) / 100;
  const cartLines = () => { const v = createView(m, c); return v.items.map((p) => ({ product: p, qty: v.qtyOf(p), unit: v.unit(p) })); };

  function content() {
    let modal = '';
    if (c.cart) modal = renderModal({ testId: 'order-cart', size: 'other', closeButton: false, content: renderCart(m, c.cart, m.data.customerById.get(c.customerId), cartLines()) });
    if (c.discardOpen) modal += renderModal({ testId: 'discard-changes', size: 'sm', zIndex: 60, content: discardContent() });
    return renderCreateDrawer(m, c).replace(/<\/div>\s*$/, `${modal}</div>`);
  }

  function render({ entering = false } = {}) {
    const active = document.activeElement;
    const inside = active && host.contains(active);
    const key = inside ? (active.id ? `#${active.id}` : active.dataset?.testid ? `[data-testid="${active.dataset.testid}"]` : null) : null;
    const caret = key && ['text', 'search', 'tel'].includes(active.type) ? [active.selectionStart, active.selectionEnd] : null;
    // Every scrolled box keeps its offset — including overflow-hidden ones the browser scrolled to
    // reveal a clicked control, which a kept-alive DOM would still show scrolled.
    const drawerEl = host.querySelector(':scope > [data-drawer]');
    const scrolled = [];
    if (drawerEl && c) for (const el of drawerEl.querySelectorAll('*')) if (el.scrollTop || el.scrollLeft) scrolled.push([pathOf(el, drawerEl), el.scrollTop, el.scrollLeft]);
    drawers.show(renderDrawer({ testId: 'drawer-create-order', entering, content: content() }), { entering });
    const fresh = host.querySelector(':scope > [data-drawer]');
    for (const [path, top, left] of scrolled) { const el = elAt(fresh, path); if (el) { el.scrollTop = top; el.scrollLeft = left; } }
    if (key) {
      const el = host.querySelector(key);
      if (el && !el.disabled) { el.focus({ preventScroll: true }); if (caret) try { el.setSelectionRange(...caret); } catch { /* not a text field */ } }
    }
    renderMenu();
  }
  /**
   * The picker's menu. An open menu is updated in place (react-select keeps the same element), and
   * pages in more customers whenever its list is within 64px of the bottom or cannot scroll yet —
   * the product's infinite-scroll menu list.
   */
  function renderMenu() {
    const existing = host.querySelector(':scope > [data-overlay="customer"]');
    const control = host.querySelector('[data-cs] .cs-control');
    if (c?.menu !== 'customer' || !control) { existing?.remove(); return; }
    if (existing) {
      existing.style.cssText = menuPlace(control);
      existing.querySelector('.cs-list').innerHTML = customerOptions(m, c);
    } else {
      host.insertAdjacentHTML('beforeend', customerMenu(m, c, control));
      const list = host.querySelector(':scope > [data-overlay="customer"] .cs-list');
      list.addEventListener('scroll', maybeLoadMore, { passive: true });
      new ResizeObserver(maybeLoadMore).observe(list);
    }
    maybeLoadMore();
  }
  function maybeLoadMore() {
    const list = host.querySelector(':scope > [data-overlay="customer"] .cs-list');
    if (!list || !c || !m.customerPage(c.pickerPages).hasMore) return;
    const room = list.scrollHeight - list.scrollTop - list.clientHeight;
    if (list.scrollHeight - list.clientHeight <= 4 || room <= 64) { c.pickerPages += 1; renderMenu(); }
  }
  const set = (patch, opts) => { Object.assign(c, patch); render(opts); };

  function open() { c = fresh(); render({ entering: true }); }
  /** Opened for a customer handed over (Follow-up Reminders): picked, the picker not focused. */
  function openFor(customerId) {
    c = fresh();
    render({ entering: true });
    setTimeout(() => { if (c) set({ customerId }); }, 400); // the drawer resolves the handed-over customer after it opens
  }
  /**
   * Opened from an Order Forecast selection: the customer picked, each item matched to the
   * catalogue by article number and given its quantity, then "Added N items to the order".
   */
  function openSeeded(customerId, items) {
    c = fresh();
    render({ entering: true });
    setTimeout(() => {
      if (!c) return;
      const qty = {}; const added = []; let matched = 0;
      for (const it of items) {
        const p = m.data.products.find((x) => x.articleNo === it.articleNumber) || m.data.productById.get(it.productId);
        if (!p) continue;
        matched += 1; qty[p.id] = it.qty; added.push(p.id);
      }
      set({ customerId, qty, added, byIdLookup: true });
      const dropped = items.length - matched;
      if (matched) toast(`Added ${matched} item${matched === 1 ? '' : 's'} to the order${dropped ? ` (${dropped} skipped — not in catalogue)` : ''}`);
      else toast("Couldn't match these forecast items to this customer's catalogue. Add them manually.", 'error');
    }, 400);
  }
  function close() {
    const closed = renderDrawer({ testId: 'drawer-create-order', open: false, content: renderCreateDrawer(m, { ...c, menu: null, cart: null }) });
    c = null;
    host.querySelector(':scope > [data-overlay="customer"]')?.remove();
    drawers.close(closed);
    onClosed();
  }
  /** Closing with products in the order asks first. */
  function requestClose() {
    if (!c) return;
    if (c.cart) { set({ cart: null }); return; }
    if (createView(m, c).totalItems > 0) set({ discardOpen: true }); else close();
  }

  function pickCustomer(id) {
    // react-select keeps its input focused after a pick — except on touch devices, where it blurs.
    Object.assign(c, { byIdLookup: false, customerId: id, menu: null, qty: {}, added: [], sub: '', searchInput: '', search: '', pickerFocused: !isTouch });
    render();
    const input = host.querySelector('#create-order-select-customer-input');
    if (isTouch) input?.blur(); else input?.focus({ preventScroll: true });
  }
  function setQty(id, qty) {
    const n = Math.max(0, Number(qty) || 0);
    c.qty = { ...c.qty, [id]: n };
    if (n > 0 && !c.added.includes(id)) c.added = [...c.added, id];
  }

  function place() {
    const lines = cartLines();
    const at = new Date(now());
    setTimeout(() => {
      const order = m.placeOrder({ customerId: c.customerId, lines, comment: c.comment, at });
      toast(`Order created successfully! Order #${order.number}`);
      // The drawer stays open, cleared for the next order.
      c = fresh();
      render();
    }, LATENCY_MS);
  }

  const handlers = {
    'customer-toggle': (e) => {
      if (e.target.closest('[data-act="customer-clear"]')) return;
      set({ menu: c.menu === 'customer' ? null : 'customer', menuFocus: 0, pickerFocused: true });
      host.querySelector('#create-order-select-customer-input')?.focus({ preventScroll: true });
    },
    'customer-clear': (e) => { e.stopPropagation(); set({ customerId: null, menu: null, qty: {}, added: [], sub: '', searchInput: '', search: '' }); },
    'customer-pick': (_e, el) => pickCustomer(el.dataset.id),
    'customer-add': () => set({ menu: null }), // Quick-add customer: outside this module's prototype
    'create-sub': (_e, el) => set({ sub: el.dataset.sub, searchInput: '', search: '', searching: false }),
    'create-cat': (_e, el) => {
      const id = el.dataset.id;
      const folding = !c.collapsed.includes(id);
      const cat = m.catalogue.find((x) => x.id === id);
      set({ collapsed: folding ? [...c.collapsed, id] : c.collapsed.filter((x) => x !== id), sub: folding && cat.subs.some((s) => s.id === c.sub) ? '' : c.sub });
    },
    'create-clear-filters': () => set({ sub: '', searchInput: '', search: '', searching: false }),
    'create-add-item': () => {},
    'create-qty': (_e, el) => { const cur = Number(c.qty[el.dataset.id] || 0); setQty(el.dataset.id, cur + Number(el.dataset.step)); render(); },
    'create-submit': () => {
      const total = cartTotals(m, cartLines()).grand;
      const [first] = paymentMethods(m);
      // Proxy orders open in split mode with the whole total on the first method.
      set({ cart: { step: 0, selected: first ? [first] : [], split: first ? { [first]: round2(total) } : {} } });
    },
    'cart-close': () => set({ cart: null }),
    'cart-next': () => set({ cart: { ...c.cart, step: 1 } }),
    'cart-back': () => set({ cart: { ...c.cart, step: 0 } }),
    'cart-qty': (_e, el) => { const cur = Number(c.qty[el.dataset.id] || 0); setQty(el.dataset.id, Math.max(1, cur + Number(el.dataset.step))); render(); },
    'cart-remove': (_e, el) => { setQty(el.dataset.id, 0); if (!cartLines().length) c.cart = null; render(); },
    'pay-method': (_e, el) => {
      const id = el.dataset.id;
      const k = c.cart;
      const total = round2(cartTotals(m, cartLines()).grand);
      if (k.selected.includes(id)) {
        const { [id]: _drop, ...split } = k.split;
        set({ cart: { ...k, selected: k.selected.filter((x) => x !== id), split } });
      } else {
        const used = k.selected.reduce((s, x) => s + (Number(k.split[x]) || 0), 0);
        set({ cart: { ...k, selected: [...k.selected, id], split: { ...k.split, [id]: round2(Math.max(0, total - used)) } } });
      }
    },
    'pay-equal': () => {
      const k = c.cart;
      const total = round2(cartTotals(m, cartLines()).grand);
      const each = round2(total / k.selected.length);
      const split = Object.fromEntries(k.selected.map((id, i) => [id, i === k.selected.length - 1 ? round2(total - each * (k.selected.length - 1)) : each]));
      set({ cart: { ...k, split } });
    },
    'cart-place': () => place(),
  };

  let searchTimer = null;
  function onInput(e) {
    if (!c) return false;
    const t = e.target;
    if (t.matches('[data-testid="create-order-product-search-input"]')) {
      c.searchInput = t.value;
      clearTimeout(searchTimer);
      if (t.value.trim()) {
        set({ searching: true });
        searchTimer = setTimeout(() => { if (c) set({ search: c.searchInput, searching: false }); }, SEARCH_DEBOUNCE_MS);
      } else set({ search: '', searching: false });
      return true;
    }
    if (t.matches('[data-create-qty]')) {
      const v = t.value.replace(/\D/g, '');
      setQty(t.dataset.createQty, v);
      render();
      return true;
    }
    if (t.matches('[data-testid="create-order-comment-input"]')) { c.comment = t.value; return true; }
    if (t.matches('[data-pay-amount]')) { c.cart.split = { ...c.cart.split, [t.dataset.payAmount]: t.value }; render(); return true; }
    return false;
  }

  return {
    open, openFor, openSeeded, handlers, onInput,
    isOpen: () => !!c,
    requestClose,
    closeDiscard: () => c && set({ discardOpen: false }),
    confirmDiscard: () => c && close(),
    discardOpen: () => !!c?.discardOpen,
    /** An outside press closes the picker's menu. */
    onMouseDown(e) {
      if (c?.menu !== 'customer') return;
      if (e.target.closest('[data-cs], [data-overlay="customer"]')) return;
      set({ menu: null });
    },
    onFocus(e, focused) {
      if (!c || e.target.id !== 'create-order-select-customer-input') return;
      if (c.pickerFocused === focused) return;
      c.pickerFocused = focused;
      const ctl = host.querySelector('[data-cs] .cs-control');
      ctl?.classList.toggle('cs-control--focused', focused || c.menu === 'customer');
      ctl?.querySelectorAll('.cs-ind').forEach((x) => x.classList.toggle('cs-ind--focused', focused || c.menu === 'customer'));
    },
    onMenuHover(e) {
      const opt = e.target.closest('.cs-option');
      if (!opt || !c || Number(opt.dataset.index) === c.menuFocus) return;
      c.menuFocus = Number(opt.dataset.index);
      renderMenu();
    },
    reposition() { if (c?.menu === 'customer') renderMenu(); },
  };
}

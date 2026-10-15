/*
  The Create Order drawer's views: state in, HTML out.

  One drawer serves every width, as the product's does — the phone's product cards and the desktop
  sidebar + table are both rendered, and the breakpoint shows one. The customer picker is the
  product's react-select (styled in sales-orders.css → "Customer picker"); its menu is portalled.

  `<!---->` separates text the product renders as separate text nodes (it changes how a line is
  shaped, so it changes pixels).
*/
import { lucide, selectChevron, selectCross } from '../components/icons.js';
import { esc } from '../components/dom.js';
import { toTitleCase, MONEY_SPACE } from './model.js';

const NB = '&nbsp;';
const money = (m, v) => `${m.currency}<!---->${NB}<!---->${Number(v || 0).toFixed(2)}`;
/** The product's image fallback: a flat grey tile (DisplayImage with no image). */
export const NO_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAVAAAAEYAQMAAAAwLTybAAAAA1BMVEXy8vJkA4prAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAI0lEQVRoge3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAA4McALwgAAQoNfCUAAAAASUVORK5CYII=';
export const img = (cls, size) => `<span class="contents"><img class="${cls} object-fit-scale-down" src="${NO_IMAGE}" alt="product" loading="lazy" decoding="async" style="width: ${size}px; height: ${size}px;"></span>`;
const MINUS = (cls) => `<svg class="${cls}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>`;
const PLUS = (cls) => `<svg class="${cls}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>`;
const MESSAGE = '<svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5 text-gray-400 dark:text-gray-500" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';
const CHIP_ON = 'bg-green-600 border-green-600 text-white shadow-sm';
const CHIP_OFF = 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40';

/** Everything the drawer shows, derived from its state. */
export function createView(m, c) {
  const customer = c.customerId ? m.data.customerById.get(c.customerId) : null;
  const q = c.search.trim().toLowerCase();
  const filtered = customer ? m.catalogue.map((cat) => ({
    ...cat,
    subs: cat.subs.filter((s) => !c.sub || s.id === c.sub)
      .map((s) => ({ ...s, products: s.products.filter((p) => !q || p.name.toLowerCase().includes(q)) }))
      .filter((s) => s.products.length),
  })).filter((cat) => cat.subs.length) : [];
  const products = filtered.flatMap((cat) => cat.subs.flatMap((s) => s.products));
  const unit = (p) => m.roundPaise(p.price * (1 + (p.tax || 0) / 100));
  const qtyOf = (p) => Number(c.qty[p.id] || 0);
  const items = c.added.filter((id) => qtyOf(m.data.productById.get(id)) > 0).map((id) => m.data.productById.get(id));
  const totalItems = Object.values(c.qty).reduce((s, v) => s + (Number(v) > 0 ? Number(v) : 0), 0);
  const total = customer ? items.reduce((s, p) => s + unit(p) * qtyOf(p), 0) : 0;
  let subName = '';
  let catOfSub = null;
  for (const cat of m.catalogue) { const s = cat.subs.find((x) => x.id === c.sub); if (s) { subName = toTitleCase(s.name); catOfSub = cat; } }
  return { customer, products, unit, qtyOf, items, totalItems, total, subName, catOfSub };
}

// ── The customer picker (react-select) ───────────────────────────────────────────────────
export function customerSelect(m, c, v) {
  const open = c.menu === 'customer';
  const focused = open || c.pickerFocused;
  const ind = focused ? 'cs-ind cs-ind--focused' : 'cs-ind';
  // A customer who is not on the picker's loaded pages (one handed over from Follow-up Reminders)
  // is resolved by id — and the product's picker never clears its loading flag after that
  // lookup, so the loading dots stay where the clear ✕ would be. Reproduced as production shows it.
  // A Forecast handoff selects the customer by an id the picker's options do not carry, so it
  // always goes through that lookup, page 1 or not.
  const stuck = !!v.customer && (c.byIdLookup || !m.customerPage(c.pickerPages).customers.some((cu) => cu.id === v.customer.id));
  const value = v.customer ? `<div class="cs-single"><div>${esc(toTitleCase(v.customer.name))}</div></div>` : '<div class="cs-placeholder" id="react-select-3-placeholder">Select Customer</div>';
  return `<div class="text-black z-50 cs-container" data-cs>
    <span id="react-select-3-live-region" class="cs-a11y"></span><span aria-live="polite" aria-atomic="false" aria-relevant="additions text" role="log" class="cs-a11y"></span>
    <div class="cs-control${focused ? ' cs-control--focused' : ''}" data-act="customer-toggle"><div class="cs-value">${value}<div class="cs-input-wrap" data-value=""><input class="" autocapitalize="none" autocomplete="off" autocorrect="off" id="create-order-select-customer-input" spellcheck="false" tabindex="0" type="text" aria-autocomplete="list" aria-expanded="${open}" aria-haspopup="true" role="combobox"${v.customer ? '' : ' aria-describedby="react-select-3-placeholder"'} value="" style="color: inherit; background: 0px center; opacity: ${v.customer ? 0 : 1}; width: 100%; grid-area: 1 / 2; font: inherit; min-width: 2px; border: 0px; margin: 0px; outline: 0px; padding: 0px;"></div></div>
      <div class="cs-indicators">${stuck ? `<div class="cs-loading${focused ? ' cs-ind--focused' : ''}" aria-hidden="true"><span class="cs-dot"></span><span class="cs-dot"></span><span class="cs-dot"></span></div>` : v.customer ? `<div class="${ind}" aria-hidden="true" data-act="customer-clear">${selectCross()}</div>` : ''}<span class="cs-sep"></span><div class="${ind}" aria-hidden="true">${selectChevron()}</div></div>
    </div></div>`;
}

/** The picker's options — the pages loaded so far, then "Add New Customer". */
export function customerOptions(m, c) {
  const opts = m.customerPage(c.pickerPages).customers.map((cu, i) => `<div class="cs-option${i === c.menuFocus ? ' cs-option--focused' : ''}" aria-disabled="false" id="react-select-3-option-${i}" tabindex="-1" role="option" data-act="customer-pick" data-id="${cu.id}" data-index="${i}"><div class="flex flex-col"><div class="font-semibold">${esc(toTitleCase(cu.name))}</div>${cu.phone ? `<div class="text-xs">${esc(cu.phone)}</div>` : ''}</div></div>`);
  const n = opts.length;
  opts.push(`<div class="cs-option${n === c.menuFocus ? ' cs-option--focused' : ''}" aria-disabled="false" id="react-select-3-option-${n}" tabindex="-1" role="option" data-act="customer-add" data-index="${n}"><div class="flex items-center gap-2 text-green-600 font-semibold py-0.5">${lucide('user-plus', { cls: 'w-4 h-4 flex-shrink-0' })}<span>Add New Customer</span></div></div>`);
  return opts.join('');
}

/** Where the portalled menu sits: under the control, as wide as it. */
export const menuPlace = (control) => { const r = control.getBoundingClientRect(); return `left: ${r.left + scrollX}px; top: ${r.bottom + scrollY}px; width: ${r.width}px;`; };

/** The picker's menu, portalled under the control (react-select's menuPortalTarget). */
export function customerMenu(m, c, control) {
  return `<div class="cs-portal" data-overlay="customer" style="${menuPlace(control)}"><div class="cs-menu"><div class="cs-list" role="listbox" aria-multiselectable="false" id="react-select-3-listbox">${customerOptions(m, c)}</div></div></div>`;
}

// ── The drawer ───────────────────────────────────────────────────────────────────────────
export function renderCreateDrawer(m, c) {
  const v = createView(m, c);
  const L = esc(m.label);
  const allowed = !!v.customer;
  const chips = allowed && v.products.length
    ? `<div class="lg:hidden mt-3 w-[calc(200%+0.375rem)] -translate-x-[calc(50%+0.1875rem)] sm:w-full sm:translate-x-0"><div class="flex items-center gap-1 overflow-x-auto py-0.5 sm:gap-2 sm:py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&amp;::-webkit-scrollbar]:hidden">${
      [{ id: '', name: 'All' }, ...m.catalogue.flatMap((cat) => cat.subs)].map((s) => {
        const on = s.id ? s.id === c.sub : !c.sub;
        return `<button type="button" data-act="create-sub" data-sub="${s.id}" data-testid="create-order-subcategory-chip-mobile-${s.id || 'all'}" data-status="${on ? 'selected' : 'unselected'}" class="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] sm:px-4 sm:py-2 sm:text-sm border transition ${on ? CHIP_ON : CHIP_OFF}">${s.id ? esc(toTitleCase(s.name)) : 'All'}</button>`;
      }).join('')}</div></div>`
    : '';
  const subChip = c.sub ? `<div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 px-2.5 py-1 rounded-md border border-green-200 dark:border-green-700"><span class="text-xs font-medium text-green-700 dark:text-green-400 whitespace-nowrap">${esc(v.subName)}</span><button data-act="create-sub" data-sub="" class="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" title="Clear filter" type="button" data-testid="create-order-clear-subcategory-btn">${lucide('x', { cls: 'w-3.5 h-3.5' })}</button></div>` : '';
  const searchIcon = c.searching
    ? '<div class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"><svg class="animate-spin text-green-600" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" stroke="currentColor" stroke-width="4" fill="none" stroke-dasharray="80" stroke-dashoffset="60" stroke-linecap="round"></circle></svg></div>'
    : lucide('search', { cls: 'absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' });

  const top = `<div class="px-4 sm:px-6 py-2 sm:py-4 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50"><div class="grid gap-1.5 sm:gap-2 grid-cols-2 sm:grid-cols-1 lg:grid-cols-2">
    <div class="min-w-0"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">Select Customer</label>${customerSelect(m, c, v)}</div>
    <div class="min-w-0"><div class="flex items-center justify-between gap-2 mb-1 sm:mb-2"><label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Search Products</label></div>
      <div class="relative" title="${allowed ? '' : 'Please select a customer first'}"><div class="flex gap-2"><div class="relative flex-1">${searchIcon}<input type="search"${allowed ? '' : ' disabled=""'} data-testid="create-order-product-search-input" placeholder="Search products..." class="w-full pl-10 h-[42px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-green-600 focus:ring-2 focus:ring-green-600/20 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${c.sub ? 'pr-36' : 'pr-4'}" value="${esc(c.searchInput)}">${subChip}</div></div>${chips}</div></div>
  </div></div>`;

  let body;
  if (!allowed) {
    body = `<div data-testid="create-order-no-customer-empty" class="h-full flex items-center justify-center"><div class="text-center max-w-md mx-auto"><div class="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">${lucide('shopping-cart', { cls: 'w-10 h-10 text-gray-400 dark:text-gray-500' })}</div><h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Ready to Create <!---->${L}</h3><p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose a customer from the dropdown above to view their product catalog and start building<!----> <!---->${L.toLowerCase()}<!---->.</p></div></div>`;
  } else {
    body = `<div class="lg:hidden">${mobilePanel(m, c, v)}</div><div class="hidden lg:block h-full"><div class="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">${sidebar(m, c)}${desktopTable(m, c, v)}</div></div>`;
  }

  const submitTitle = !allowed ? 'Please select a customer first' : v.totalItems < 1 ? 'Please add products with quantities' : '';
  const off = v.totalItems < 1 || !allowed ? ' disabled=""' : '';
  const footer = `<div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 sm:p-5 shadow-lg flex-shrink-0 fixed inset-x-0 bottom-0 z-40 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] lg:static lg:inset-auto lg:z-auto lg:pb-5">
    <div class="lg:hidden"><div class="flex items-center justify-between gap-3"><div class="flex flex-shrink-0 items-center gap-3">
      <div class="text-center"><div class="text-[10px] leading-tight text-gray-500 dark:text-gray-400">Total Items</div><div class="text-sm font-bold leading-tight text-gray-900 dark:text-white">${v.totalItems}</div></div>
      <div class="text-right"><div class="text-[10px] leading-tight text-gray-500 dark:text-gray-400">${L}<!----> Total</div><div class="text-sm font-bold leading-tight text-green-600">${money(m, v.total)}</div></div>
    </div><div class="relative w-[52%] flex-shrink-0"><button${off} data-act="create-submit" data-testid="create-order-submit-btn-mobile" class="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300" type="button" title="${submitTitle}">${lucide('package', { cls: 'h-4 w-4 flex-shrink-0' })}<span class="truncate">Create ${L}</span></button></div></div></div>
    <div class="hidden lg:block"><div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex items-center gap-3 flex-1" title="${allowed ? '' : 'Please select a customer first'}">${MESSAGE}<input placeholder="E.g. Handle with care, Deliver before 5 PM..."${allowed ? '' : ' disabled=""'} data-testid="create-order-comment-input" class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition disabled:opacity-50 disabled:cursor-not-allowed" value="${esc(c.comment)}"></div>
      <div class="flex items-center gap-6">
        <div class="text-right"><div class="text-xs text-gray-500 dark:text-gray-400">Total Items</div><div class="text-xl font-bold text-gray-900 dark:text-white">${v.totalItems}</div></div>
        <div class="text-right"><div class="text-xs text-gray-500 dark:text-gray-400">${L}<!----> Total</div><div class="text-xl font-bold text-green-600">${money(m, v.total)}</div></div>
        <div class="relative"><button${off} title="${submitTitle}" data-act="create-submit" data-testid="create-order-submit-btn" class="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2" type="button">${lucide('package', { cls: 'w-4 h-4' })}Create ${L}</button></div>
      </div></div></div></div>`;

  return `<div class="relative w-full h-full flex flex-col bg-white dark:bg-gray-800">
    <div class="w-full relative px-4 sm:px-6 py-3 sm:py-4 pr-16 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm flex-shrink-0"><div class="flex items-center gap-2 flex-1 min-w-0">${lucide('shopping-cart', { cls: 'w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0' })}<div class="min-w-0"><h2 class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Create ${L}</h2><p class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">Select customer and add products to create a new ${L.toLowerCase()}</p></div></div></div>
    <div class="flex-1 flex flex-col overflow-hidden">${top}<div data-create-scroll class="flex-1 overflow-y-auto px-4 sm:px-6 py-2 sm:py-4 [-ms-overflow-style:none] [scrollbar-width:none] [&amp;::-webkit-scrollbar]:hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-4">${body}</div>${footer}</div>
  </div>`;
}

// ── Phone: product cards ─────────────────────────────────────────────────────────────────
function mobilePanel(m, c, v) {
  if (!v.products.length) {
    return `<div data-testid="mobile-order-product-panel-empty" class="py-10 text-center bg-white dark:bg-gray-800 rounded-xl border border-gray-300 dark:border-gray-600 shadow-md"><div class="w-14 h-14 mx-auto mb-3 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">${lucide('search', { cls: 'w-7 h-7 text-gray-400' })}</div><div class="text-base font-semibold text-gray-900 dark:text-white">No Products Found</div><div class="text-sm text-gray-500 dark:text-gray-400 mt-1">Try changing category or search text.</div>${c.search.trim() || c.sub ? `<button type="button" data-act="create-clear-filters" data-testid="mobile-order-product-panel-clear-filters-btn" class="mt-4 inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium">${lucide('rotate-ccw', { cls: 'w-4 h-4' })}Clear filters</button>` : ''}</div>`;
  }
  return `<div data-testid="mobile-order-product-panel-list" class="space-y-2 pb-2">${v.products.map((p, i) => {
    const qty = v.qtyOf(p);
    const name = esc(toTitleCase(p.name));
    return `<div data-testid="mobile-order-product-row-${p.id}" class="overflow-visible rounded-2xl border bg-white shadow-[0_2px_9px_rgba(15,23,42,0.10)] transition-all dark:border-gray-600 dark:bg-gray-800 ${qty > 0 ? 'border-gray-200 dark:border-gray-600' : 'border-gray-200 hover:border-gray-300 hover:shadow-md dark:border-gray-600'}">
      <div class="relative flex min-h-[75px] items-start gap-3 px-3 pb-1.5 pt-3"><div class="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">${img('h-full w-full !object-cover rounded-custom', 72)}</div>
        <div class="flex min-h-16 min-w-0 flex-1 flex-col"><div class="flex items-start justify-between gap-2">
          <div class="min-w-0"><div class="truncate text-[15px] font-bold leading-tight text-gray-900 dark:text-white" title="${name}">${name}</div><div class="mt-1 text-[11px] leading-tight text-gray-500 dark:text-gray-400">Art No:<!----> <span class="font-medium">${esc(p.articleNo)}</span></div>
            <div class="mt-3 flex min-w-0 flex-wrap items-center gap-1.5"><div data-order-unit-dropdown="true" class="relative"><button type="button" class="flex max-w-[88px] items-center gap-0.5 rounded-md bg-green-50 px-2 py-1 text-[10px] font-medium text-green-600 dark:bg-green-900/25 dark:text-green-400"><span class="truncate">${esc(p.unit)}</span></button></div></div></div>
          <div class="flex-shrink-0 pt-1 text-right"><div class="flex items-start justify-end gap-2"><div><div class="text-[17px] font-bold leading-tight text-gray-900 dark:text-white">${money(m, v.unit(p))}</div></div><button type="button" class="group flex h-5 w-8 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-green-50 dark:hover:bg-green-900/20" aria-label="Edit price of ${esc(p.name)}" title="Edit price">${lucide('pen', { cls: 'h-[15px] w-[15px] text-gray-500 group-hover:text-green-600 dark:text-gray-400' })}</button></div></div>
        </div></div></div>
      <div class="w-full"><div class="grid min-h-[58px] w-full min-w-0 grid-cols-[132px_1fr_auto] items-center gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700">
        <div class="flex h-10 w-[132px] flex-shrink-0 items-center overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-600 dark:bg-gray-700">
          <button type="button" data-act="create-qty" data-id="${p.id}" data-step="-1" data-testid="mobile-order-product-qty-dec-btn-${p.id}"${qty <= 0 ? ' disabled=""' : ''} class="flex h-full w-10 flex-shrink-0 items-center justify-center border-r border-gray-200 text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600" aria-label="Decrease quantity of ${esc(p.name)}">${MINUS('h-[18px] w-[18px]')}</button>
          <input data-testid="mobile-order-product-qty-input-${p.id}" data-create-qty="${p.id}" type="tel" inputmode="numeric" pattern="\\d*" step="1" placeholder="0" id="mobile-qty-input-${i}" autocomplete="off" class="h-full min-w-0 flex-1 border-0 bg-transparent px-1 text-center text-sm font-bold focus:ring-0 text-gray-900 dark:text-white" value="${qty}">
          <button type="button" data-act="create-qty" data-id="${p.id}" data-step="1" data-testid="mobile-order-product-qty-inc-btn-${p.id}" class="flex h-full w-10 flex-shrink-0 items-center justify-center border-l border-gray-200 text-green-600 transition hover:bg-green-50 disabled:cursor-not-allowed disabled:text-gray-300 dark:border-gray-600 dark:text-green-400 dark:hover:bg-gray-600" aria-label="Increase quantity of ${esc(p.name)}" title="Increase">${PLUS('h-[18px] w-[18px]')}</button>
        </div>
        <div class="min-w-0 text-center text-[11px] leading-tight"><div><div class="truncate font-bold text-orange-500 dark:text-orange-400">${m.availableStock(p)}<!----> avail.</div><div class="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">In Stock</div></div></div>
        <div class="min-w-[62px] text-right leading-tight"><div class="text-[10px] font-medium text-gray-600 dark:text-gray-300">Total</div><div class="text-sm font-bold text-green-600 dark:text-green-400">${money(m, v.unit(p) * qty)}</div></div>
      </div></div></div>`;
  }).join('')}</div>`;
}

// ── Desktop: categories sidebar ──────────────────────────────────────────────────────────
function sidebar(m, c) {
  const cats = m.catalogue.map((cat) => {
    const open = !c.collapsed.includes(cat.id);
    const subs = open ? `<div class="bg-gray-50/50 dark:bg-gray-900/20">${cat.subs.map((s) => {
      const on = s.id === c.sub;
      return `<button data-act="create-sub" data-sub="${s.id}" data-testid="create-order-sidebar-subcategory-${s.id}" data-status="${on ? 'selected' : 'unselected'}" class="w-full text-left px-4 pl-8 py-2.5 text-sm transition-all flex items-center gap-2 ${on ? 'bg-blue-50 dark:bg-blue-900/20 text-green-700 dark:text-green-400 font-medium border-l-4 border-green-500' : 'text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700/30 border-l-4 border-transparent'}" type="button">${img('block rounded object-cover flex-shrink-0 shadow-none', 20)}${esc(toTitleCase(s.name))}</button>`;
    }).join('')}</div>` : '';
    return `<div class="mb-1"><button type="button" data-act="create-cat" data-id="${cat.id}" data-testid="create-order-sidebar-category-toggle-${cat.id}" class="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors" aria-expanded="${open}"><span class="flex items-center gap-2 min-w-0">${img('block rounded object-cover flex-shrink-0 shadow-none', 20)}<span class="truncate">${esc(toTitleCase(cat.name))}</span></span><svg class="w-4 h-4 text-green-700 transform transition-transform duration-200 ${open ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button>${subs}</div>`;
  }).join('');
  return `<div class="lg:col-span-1 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden flex flex-col"><div class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 px-4 py-3 flex-shrink-0 flex items-center justify-between gap-2"><h4 class="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">Categories</h4></div>
    <div class="py-2 overflow-y-auto custom-scroll flex-1"><button type="button" data-act="create-sub" data-sub="" data-testid="create-order-sidebar-all-products-btn" data-status="${c.sub ? 'unselected' : 'selected'}" class="w-full text-left px-4 py-2.5 text-sm font-medium transition-all mb-1 ${c.sub ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 border-l-4 border-transparent' : 'bg-blue-50 dark:bg-blue-900/20 text-green-700 dark:text-green-400 border-l-4 border-green-500'}">All Products</button>${cats}</div></div>`;
}

// ── Desktop: products table ──────────────────────────────────────────────────────────────
function desktopTable(m, c, v) {
  const wrap = (inner) => `<div class="lg:col-span-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col overflow-hidden relative">${inner}</div>`;
  const search = c.search.trim();
  if (!v.products.length) {
    const msg = search && c.sub ? `No products match "${esc(c.search)}" in the selected category.` : search ? `No products match "${esc(c.search)}".` : 'No products in the selected category.';
    return wrap(`<div data-testid="create-order-products-empty" class="flex-1 flex items-center justify-center p-12"><div class="text-center max-w-sm"><div class="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">${lucide('search', { cls: 'w-8 h-8 text-gray-400' })}</div><h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Products Found</h3><p class="text-sm text-gray-500 dark:text-gray-400 mb-4">${msg}</p><div class="flex items-center justify-center gap-4 flex-wrap"><button data-act="create-clear-filters" data-testid="create-order-products-empty-clear-filters-btn" class="inline-flex items-center gap-2 text-sm text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 font-medium" type="button">${lucide('rotate-ccw', { cls: 'w-4 h-4' })}Clear filters</button><button data-act="create-add-item" data-testid="create-order-products-empty-add-item-btn" class="inline-flex items-center gap-2 text-sm text-white bg-green-600 hover:bg-green-700 font-medium px-3 py-1.5 rounded-lg transition-colors" type="button">${lucide('plus', { cls: 'w-4 h-4' })}Add as New Item</button></div></div></div>`);
  }
  const sep = '<span class="text-gray-300 dark:text-gray-600">/</span>';
  const crumbs = [`<button type="button" data-act="create-sub" data-sub="" data-testid="create-order-breadcrumb-all-products-btn" class="hover:text-green-600 dark:hover:text-green-400 transition-colors">All Products</button>`];
  if (c.sub) crumbs.push(sep, `<span class="flex items-center gap-1 text-gray-500 dark:text-gray-400">${img('block rounded object-cover flex-shrink-0 shadow-none', 16)}${esc(toTitleCase(v.catOfSub.name))}</span>`, sep, `<span class="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-200">${img('block rounded object-cover flex-shrink-0 shadow-none', 16)}${esc(v.subName)}</span>`);
  if (search) crumbs.push(sep, `<span class="italic">Search: "<!---->${esc(c.search)}<!---->"</span>`);
  const rows = v.products.map((p, i) => {
    const qty = v.qtyOf(p);
    const avail = m.availableStock(p);
    const tax = Number(p.tax || 0);
    return `<tr data-testid="create-order-product-row-${p.id}" data-status="available" class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800">
      <td class="py-4 px-4 align-top"><div class="flex items-center gap-3"><div class="w-14 h-14 bg-white dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600">${img('w-full h-full object-cover rounded-custom', 56)}</div><div><div class="text-sm font-semibold">${esc(toTitleCase(p.name))}</div><div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Art No:<!----> <span class="">${esc(p.articleNo)}</span></div></div></div></td>
      <td class="py-4 text-center px-4 text-sm text-gray-700 dark:text-gray-300">-</td>
      <td class="py-4 text-center px-4"><div class="flex items-center justify-center"><div class="flex items-center gap-2"><span class="text-sm font-medium text-gray-800 dark:text-gray-200">${money(m, v.unit(p))}${tax ? `<span class="block text-[11px] text-gray-500 leading-tight">${tax}% incl. tax</span>` : ''}</span><button type="button" data-testid="create-order-product-price-edit-btn-${p.id}" class="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md transition-colors group" title="Edit price">${lucide('pen', { cls: 'w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-green-600' })}</button></div></div></td>
      <td class="py-4 px-4"><div class="flex flex-col items-center gap-1"><div data-order-unit-dropdown="true" class="relative flex min-h-[1.125rem] w-[9.75rem] items-center justify-center gap-1 text-center text-xs leading-4 text-gray-500 dark:text-gray-400 max-sm:w-36"><span class="font-medium text-gray-700 dark:text-gray-200">${esc(p.unit)}</span><span>${avail <= 0 ? '· Out of stock' : `· ${avail} avail.`}</span></div>
        <div class="flex h-10 w-[9.75rem] items-center overflow-hidden rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700 max-sm:w-36"><button type="button"${qty <= 0 ? ' disabled=""' : ''} data-act="create-qty" data-id="${p.id}" data-step="-1" data-testid="create-order-product-qty-decrement-${p.id}" class="flex h-full w-10 flex-shrink-0 items-center justify-center border-r border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600 dark:disabled:hover:bg-transparent">${MINUS('w-4 h-4')}</button><input type="text" inputmode="numeric" pattern="\\d*" step="1" placeholder="0" id="qty-input-${i}" data-create-qty="${p.id}" data-testid="create-order-product-qty-input-${p.id}" autocomplete="off" class="h-full w-[4.75rem] border-0 bg-transparent px-2 text-center text-sm focus:outline-none focus:ring-0 max-sm:w-16 text-gray-900 dark:text-white" value="${esc(c.qty[p.id] ? String(c.qty[p.id]) : '')}"><button type="button" aria-label="increment" data-act="create-qty" data-id="${p.id}" data-step="1" data-testid="create-order-product-qty-increment-${p.id}" class="flex h-full w-10 flex-shrink-0 items-center justify-center border-l border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600 dark:disabled:hover:bg-transparent">${PLUS('w-4 h-4')}</button></div>
        <div class="text-xs text-gray-500 dark:text-gray-400"></div></div></td>
      <td class="py-4 px-4 text-center"><div class="flex flex-col items-center gap-0.5"><div class="font-semibold text-green-600">${qty > 0 ? `${m.currency}${MONEY_SPACE}${(v.unit(p) * qty).toFixed(2)}` : '-'}</div></div></td>
    </tr>`;
  }).join('');
  return wrap(`<div class="overflow-x-auto w-full"><div class="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-700/40 text-xs text-gray-500 dark:text-gray-400">${crumbs.join('')}</div>
    <table class="min-w-full text-sm text-gray-900 dark:text-white border-collapse"><thead class="bg-gray-50 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide border-b border-gray-200 dark:border-gray-600"><tr><th class="text-left py-3 px-4 w-4/12">Product</th><th class="text-center py-3 px-4 w-1/12">Brand</th><th class="text-center py-3 px-4 w-2/12">Price</th><th class="text-center py-3 px-4 w-2/12">Quantity</th><th class="text-left py-3 px-4 w-1/12">Total</th></tr></thead>
    <tbody class="divide-y divide-gray-200 dark:divide-gray-700">${rows}</tbody></table></div>`);
}


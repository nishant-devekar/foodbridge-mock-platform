/*
  Bulk Sales Orders — the drawer's views: state in, HTML out.

  Two steps in one drawer, as the product's BulkOrderDrawer: "Configure Bulk Orders" (customers,
  then the products of their catalogue) and "Bulk Order Creation" (a product × customer quantity
  grid). The preview, the catalogue confirmation and the clear-quantity prompt render INSIDE the
  drawer panel, as the product's do — their backdrops cover the panel, not the page.

  `<!---->` separates text the product renders as separate text nodes.
*/
import { renderModal } from '../components/drawer.js';
import { lucide, fi, selectChevron, selectCross } from '../components/icons.js';
import { esc } from '../components/dom.js';
import { toTitleCase } from './model.js';
import { img } from './create-views.js';
import { discardContent } from './audit-drawer.js';

const NB = '&nbsp;';
const money = (m, v) => `${m.currency}<!---->${NB}<!---->${v}`;
const pid = (p) => p.id;
export const qkey = (productId, customerId) => `${productId}-${customerId}`;

// ── Derived state ─────────────────────────────────────────────────────────────────────────
/**
 * Everything both steps show. Prices are the product's: a unit price is tax-inclusive and rounded
 * to paise; the GRID totals a line as (price × qty × tax) to 2 places, while the PREVIEW totals it
 * as the rounded unit price × qty — so the two can differ by paise (₹ 317.63 vs ₹ 317.65), as in
 * production.
 */
export function bulkView(m, b) {
  const all = m.catalogue.flatMap((cat) => cat.subs.flatMap((s) => s.products.map((p) => ({ p, sub: s, cat }))));
  const byId = new Map(all.map((x) => [x.p.id, x]));
  const customers = b.customers.map((id) => m.data.customerById.get(id)).filter(Boolean);
  const products = b.selected.map((id) => byId.get(id)).filter(Boolean);
  const tax = (p) => (p.tax || 0) / 100;
  const custom = (p, c) => b.prices[qkey(p.id, c.id)];
  /** The price per ordering unit, with tax, as the grid shows it. */
  const unit = (p, c) => m.roundPaise(custom(p, c) != null ? custom(p, c) : p.price * (1 + tax(p)));
  /** The price without tax the order is placed at (an edit is entered with tax and stored without). */
  const base = (p, c) => (custom(p, c) != null ? custom(p, c) / (1 + tax(p)) : p.price);
  const qtyOf = (p, c) => Number(b.qty[qkey(p.id, c.id)]) || 0;
  const line = (p, c) => { const q = qtyOf(p, c); return Number((base(p, c) * q * (1 + tax(p))).toFixed(2)); };
  const rowTotal = (p) => ({ qty: customers.reduce((s, c) => s + qtyOf(p, c), 0), total: customers.reduce((s, c) => s + line(p, c), 0).toFixed(2) });
  const customerTotal = (c) => products.reduce((s, x) => s + line(x.p, c), 0).toFixed(2);
  const grand = products.reduce((s, x) => s + customers.reduce((t, c) => t + (qtyOf(x.p, c) > 0 ? line(x.p, c) : 0), 0), 0).toFixed(2);
  const totalItems = products.reduce((s, x) => s + customers.reduce((t, c) => t + qtyOf(x.p, c), 0), 0);
  const totalOrders = customers.filter((c) => products.some((x) => !b.removed.includes(qkey(x.p.id, c.id)) && qtyOf(x.p, c) > 0)).length;
  // The preview's orders: per customer, its lines in the order their quantities were first entered.
  const orders = customers.map((c) => {
    const items = [];
    let totalTax = 0;
    for (const [key, raw] of Object.entries(b.qty)) {
      const q = Number(raw) || 0;
      if (!key.endsWith(`-${c.id}`) || q <= 0) continue;
      const x = byId.get(key.slice(0, -(c.id.length + 1)));
      if (!x || !b.selected.includes(x.p.id)) continue;
      const withTax = unit(x.p, c) * q;
      const without = withTax / (1 + tax(x.p));
      totalTax += withTax - without;
      items.push({ product: x.p, qty: q, unit: unit(x.p, c).toFixed(2), subtotal: without.toFixed(2), total: withTax.toFixed(2), base: base(x.p, c) });
    }
    const subtotal = items.reduce((s, i) => s + Number(i.subtotal), 0);
    const total = items.reduce((s, i) => s + Number(i.total), 0);
    return { customer: c, items, totalItems: items.reduce((s, i) => s + i.qty, 0), subtotal: subtotal.toFixed(2), totalTax: totalTax.toFixed(2), grandTotal: total.toFixed(2) };
  }).filter((o) => o.items.length);
  const previewDisabled = totalItems < 1 || !!b.editing || !products.length || !customers.length;
  return { all, byId, customers, products, unit, base, qtyOf, rowTotal, customerTotal, grand, totalItems, totalOrders, orders, previewDisabled };
}

const previewTip = (b, v) => {
  if (b.editing) return 'Please confirm or cancel price editing first';
  if (!v.products.length) return 'Please select at least one product';
  if (!v.customers.length) return 'Please select at least one customer';
  return 'Please enter quantities for at least one product-customer combination';
};

// ── The drawer ────────────────────────────────────────────────────────────────────────────
export function renderBulkDrawer(m, b) {
  const v = bulkView(m, b);
  const discard = b.discard ? renderModal({ testId: 'discard-changes', size: 'sm', zIndex: 60, content: discardContent() }) : '';
  const route = b.mode === 'ROUTE';
  const configuring = b.step === 1;
  const head = configuring
    ? `<div class="flex items-center gap-3">${lucide('settings', { cls: 'h-8 w-8 text-orange-600' })}<div><h4 class="text-xl font-medium dark:text-gray-300">Configure Bulk Orders</h4><p class="mb-0 text-sm dark:text-gray-300">Select Products &amp; Customers</p></div></div>`
    : `<div class="flex items-center justify-between"><div class="flex min-w-0 items-center gap-3 text-left">${lucide('file-spreadsheet', { cls: 'h-8 w-8 flex-shrink-0 text-orange-600' })}<div class="min-w-0"><h4 class="text-lg sm:text-xl font-medium dark:text-gray-300">Bulk Order Creation</h4><p class="mb-0 text-sm dark:text-gray-300">${v.products.length}<!----> Products ×<!----> <!---->${v.customers.length}<!----> Customers</p></div></div>
      <div class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 gap-2 border-t border-gray-200 bg-white/95 p-3 backdrop-blur sm:static sm:z-auto sm:flex sm:items-center sm:gap-4 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none sm:backdrop-blur-0 sm:mr-14 sm:w-auto">
        <button data-act="bulk-change-selection" data-testid="bulk-order-change-selection-btn" class="flex items-center justify-center gap-2 text-xs xs:text-sm font-medium border border-gray-150 px-3 py-2 bg-white rounded-md hover:bg-gray-100 transition-colors w-full sm:w-auto">${lucide('settings', { cls: 'w-4 h-4' })}<span class="hidden sm:inline">Change Selection</span></button>
        <button data-act="bulk-clear-all" data-testid="bulk-order-clear-all-btn" class="flex items-center justify-center gap-2 text-xs xs:text-sm font-medium border border-gray-150 px-3 py-2 bg-white rounded-md hover:bg-gray-100 transition-colors w-full sm:w-auto">${lucide('rotate-ccw', { cls: 'h-4 w-4' })}<span class="hidden sm:inline">Clear All</span></button>
        <div class="relative inline-block w-full sm:w-auto" data-bulk-preview-wrap><button${v.previewDisabled ? ' disabled=""' : ''} data-act="bulk-preview" data-testid="bulk-order-preview-btn" class="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-xs xs:text-sm font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed w-full sm:w-auto">${lucide('eye', { cls: 'w-4 h-4' })}<span class="hidden xs:inline sm:hidden">Preview</span><span class="hidden sm:inline">Preview Orders</span></button>${b.tip && v.previewDisabled ? `<div data-testid="bulk-order-preview-disabled-tooltip" class="absolute z-50 top-full left-1/2 transform -translate-x-1/2 mt-2 pointer-events-none"><div class="bg-gray-800 text-white text-xs rounded py-2 px-3 shadow-lg whitespace-nowrap"><div class="absolute bottom-full left-1/2 transform -translate-x-1/2"><div class="border-4 border-transparent border-b-gray-800"></div></div>${previewTip(b, v)}</div></div>` : ''}</div>
      </div></div>`;
  let body;
  if (b.step === 0) {
    body = `<div data-testid="bulk-order-route-setup-loading" class="flex flex-col items-center justify-center h-full gap-4 py-24"><div class="flex items-center gap-1.5"><div class="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce" style="animation-delay: 0ms;"></div><div class="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce" style="animation-delay: 150ms;"></div><div class="w-2.5 h-2.5 bg-orange-500 rounded-full animate-bounce" style="animation-delay: 300ms;"></div></div><p class="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading route customers and products…</p></div>`;
  } else body = configuring ? configureBody(m, b, v) : gridBody(m, b, v);
  let modals = '';
  if (b.preview) modals += renderModal({ testId: 'bulk-order-preview', size: 'xl', content: previewBody(m, b, v) });
  if (b.confirm) modals += renderModal({ testId: 'bulk-order-selection-confirmation', size: 'lg', content: confirmBody(m, b) });
  return `${discard}<div class="w-full relative px-3 sm:px-6 py-3 border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" data-testid="bulk-order-drawer" data-status="${route ? 'route' : 'standard'}">${head}</div>`
    + `<div class="w-full md:w-7/12 lg:w-8/12 xl:w-8/12 relative dark:bg-gray-700 dark:text-gray-200" style="position: relative; overflow: hidden; width: 100%; height: 100%;"><div data-bulk-scroll style="position: absolute; inset: 0px; overflow: scroll; margin-right: 0px; margin-bottom: 0px;">${body}${modals}</div>`
    + '<div style="position: absolute; height: 6px; display: none; right: 2px; bottom: 2px; left: 2px; border-radius: 3px;"><div style="position: relative; display: block; height: 100%; cursor: pointer; border-radius: inherit; background-color: rgba(0, 0, 0, 0.2);"></div></div>'
    + '<div style="position: absolute; width: 6px; display: none; right: 2px; bottom: 2px; top: 2px; border-radius: 3px;"><div style="position: relative; display: block; width: 100%; cursor: pointer; border-radius: inherit; background-color: rgba(0, 0, 0, 0.2);"></div></div></div>';
}

// ── Step 1: Configure ─────────────────────────────────────────────────────────────────────
const dots = (color) => `<div class="flex items-center gap-1.5 mb-3"><div class="w-2 h-2 ${color} rounded-full animate-bounce" style="animation-delay: 0ms;"></div><div class="w-2 h-2 ${color} rounded-full animate-bounce" style="animation-delay: 150ms;"></div><div class="w-2 h-2 ${color} rounded-full animate-bounce" style="animation-delay: 300ms;"></div></div>`;
const SPIN = (size) => `<svg class="animate-spin" viewBox="0 0 24 24" width="${size}" height="${size}"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="60" stroke-dashoffset="40"></circle></svg>`;

/** The customers the dropdown lists: a page-by-8 server search, or the route's own customers. */
export function dropdownCustomers(m, b) {
  if (b.mode === 'ROUTE') {
    const q = b.custSearch.toLowerCase();
    return { customers: b.routeCustomers.map((id) => m.data.customerById.get(id)).filter((c) => c && (c.name.toLowerCase().includes(q) || String(c.phone || '').toLowerCase().includes(q))), hasMore: false };
  }
  return m.customerPage(b.custPages, b.custQuery);
}

export function customerOptions(m, b) {
  const list = dropdownCustomers(m, b).customers;
  const opts = list.length ? list.map((c) => {
    const on = b.customers.includes(c.id);
    return `<button data-act="bulk-customer" data-id="${c.id}" data-testid="configure-bulk-order-customer-option-${c.id}" data-status="${on ? 'selected' : 'unselected'}" class="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${on ? 'bg-gray-50' : ''}"><div class="flex items-center gap-3"><input type="checkbox"${on ? ' checked=""' : ''} readonly="" tabindex="-1" class="w-4 h-4 text-blue-600 border-gray-300 rounded pointer-events-none"><div class="flex-1"><div class="text-sm font-medium text-gray-900">${esc(toTitleCase(c.name))}</div><div class="text-xs text-gray-500 mt-0.5">${esc(c.phone || c.email || '')}</div></div></div></button>`;
  }).join('') : `<div data-testid="configure-bulk-order-customer-dropdown-empty" class="px-4 py-8 text-center">${lucide('search-x', { cls: 'w-8 h-8 text-gray-400 mx-auto mb-2' })}<p class="text-sm text-gray-600">No customers found</p></div>`;
  const more = b.mode !== 'ROUTE' && b.custLoadingMore ? `<div data-testid="configure-bulk-order-customer-dropdown-loading-more" class="flex items-center justify-center gap-2 px-4 py-2 text-gray-400">${SPIN(16)}<span class="text-xs">Loading more customers...</span></div>` : '';
  return `<div class="sticky top-0 z-10 flex items-center justify-end gap-2 border-b border-gray-100 bg-white px-3 py-2"><button data-act="bulk-customers-clear" data-testid="configure-bulk-order-customer-clear-all-btn" class="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors">Clear All</button></div>${opts}${more}`;
}

/** The catalogue picker (react-select, the module's own styles). Its menu is portalled. */
function catalogueSelect(m, b) {
  const value = b.catalogue ? m.catalogues.find((c) => c.id === b.catalogue) : null;
  const focused = b.catMenu || b.catFocused;
  const ind = focused ? 'bc-ind bc-ind--focused' : 'bc-ind';
  const shown = value ? `<div class="bc-single">${esc(toTitleCase(value.name))}</div>` : '<div class="bc-placeholder" id="react-select-3-placeholder">Select catalogue to auto-fill customers</div>';
  return `<div class="text-black bc-container" data-bc><span id="react-select-3-live-region" class="cs-a11y"></span><span aria-live="polite" aria-atomic="false" aria-relevant="additions text" role="log" class="cs-a11y"></span>
    <div class="bc-control${focused ? ' bc-control--focused' : ''}" data-act="bulk-catalogue-toggle"><div class="bc-value">${shown}<div class="cs-input-wrap" data-value=""><input class="" autocapitalize="none" autocomplete="off" autocorrect="off" id="configure-bulk-order-catalogue-select-input" spellcheck="false" tabindex="0" type="text" aria-autocomplete="list" aria-expanded="${b.catMenu}" aria-haspopup="true" role="combobox"${value ? '' : ' aria-describedby="react-select-3-placeholder"'} value="" style="color: inherit; background: 0px center; opacity: 1; width: 100%; grid-area: 1 / 2; font: inherit; min-width: 2px; border: 0px; margin: 0px; outline: 0px; padding: 0px;"></div></div>
    <div class="bc-indicators">${value ? `<div class="${ind}" aria-hidden="true" data-act="bulk-catalogue-clear">${selectCross()}</div>` : ''}<span class="cs-sep"></span><div class="${ind}" aria-hidden="true">${selectChevron()}</div></div></div></div>`;
}

export const catalogueOptions = (m, b) => m.catalogues.map((c, i) => `<div class="bc-option${i === b.catFocus ? ' bc-option--focused' : ''}" aria-disabled="false" id="react-select-3-option-${i}" tabindex="-1" role="option" data-act="bulk-catalogue-pick" data-id="${c.id}" data-index="${i}">${esc(toTitleCase(c.name))}</div>`).join('');

export const catalogueMenu = (m, b, control) => {
  const r = control.getBoundingClientRect();
  return `<div class="bc-portal" data-overlay="bulk-catalogue" style="left: ${r.left + scrollX}px; top: ${r.bottom + scrollY}px; width: ${r.width}px;"><div class="bc-menu"><div class="bc-list" role="listbox" aria-multiselectable="false" id="react-select-3-listbox">${catalogueOptions(m, b)}</div></div></div>`;
};

function configureBody(m, b, v) {
  const route = b.mode === 'ROUTE';
  const stillLoading = !route && b.custLoading;
  const n = b.customers.length;
  const searchInput = `<div class="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white">${lucide('search', { cls: 'w-4 h-4 text-gray-400 flex-shrink-0' })}<input type="text" data-testid="configure-bulk-order-customer-search-input" placeholder="${n ? 'Search to change customer...' : 'Type customer name or phone...'}" class="flex-1 text-sm outline-none placeholder:text-gray-400" value="${esc(b.custSearch)}">${b.custSearch ? `<button data-act="bulk-customer-search-clear" data-testid="configure-bulk-order-customer-search-clear-btn" class="flex-shrink-0 p-0.5 hover:bg-gray-100 rounded transition-colors" aria-label="Clear search">${lucide('x', { cls: 'w-4 h-4 text-gray-400 hover:text-gray-600' })}</button>` : ''}<button data-act="bulk-customer-dropdown" data-testid="configure-bulk-order-customer-dropdown-toggle-btn" class="flex-shrink-0 p-0.5 hover:bg-gray-100 rounded transition-colors cursor-pointer" aria-label="Toggle dropdown">${lucide('chevron-down', { cls: `w-4 h-4 text-gray-400 hover:text-gray-600 transition-transform ${b.custOpen ? 'rotate-180' : ''}` })}</button></div>`;
  const dropdown = b.custOpen && !stillLoading ? `<div data-testid="configure-bulk-order-customer-dropdown" data-bulk-dropdown class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-y-auto z-10">${customerOptions(m, b)}</div>` : '';
  const cta = n === 0 && !stillLoading && !b.custOpen ? `<div class="relative"><button data-act="bulk-customer-cta" data-testid="configure-bulk-order-select-customer-cta-btn" class="w-full p-6 border border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all group bg-gray-50/30"><div class="flex flex-col items-center text-center space-y-3"><div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-gray-200 transition-colors">${lucide('users', { cls: 'w-8 h-8 text-gray-400' })}</div><div><h3 class="text-base font-semibold text-gray-900 mb-1">Select Customer to Create Order</h3><p class="text-sm text-gray-600">Click search above or click here to choose a customer</p></div></div></button></div>` : '';
  const loading = stillLoading ? `<div data-testid="configure-bulk-order-customers-loading" class="flex flex-col items-center justify-center py-12 px-4 border border-gray-200 rounded-md">${dots('bg-blue-600')}<p class="text-sm text-gray-600 animate-pulse">Loading customers...</p></div>` : '';
  const chips = n ? `<div data-testid="configure-bulk-order-selected-customers" class="rounded-md border border-gray-200 bg-gray-50/50 p-2 sm:p-3"><p class="mb-1.5 text-[10px] font-medium text-gray-500 sm:mb-2 sm:text-xs">Selected Customers (<!---->${n}<!---->)</p><div class="custom-scroll grid max-h-[170px] grid-cols-3 gap-1.5 overflow-y-auto pr-1 sm:max-h-none sm:grid-cols-2 sm:gap-2 sm:overflow-visible sm:pr-0 lg:max-h-[calc(100dvh-390px)] lg:overflow-y-auto lg:overscroll-contain lg:pb-2 lg:pr-1">${v.customers.map((c) => {
    const name = esc(toTitleCase(c.name));
    const contact = esc(c.phone || c.email || '');
    return `<div data-testid="configure-bulk-order-selected-customer-chip-${c.id}" class="flex min-h-[38px] min-w-0 items-start justify-between gap-1 rounded-lg border border-blue-100 bg-blue-50/60 px-2 py-1.5 sm:min-h-0 sm:items-center sm:gap-3 sm:rounded-md sm:border-gray-200 sm:bg-white sm:px-3 sm:py-2" title="${name}${contact ? ` - ${contact}` : ''}"><div class="min-w-0"><p class="truncate text-[9px] font-semibold leading-tight text-gray-900 sm:text-sm sm:font-medium sm:leading-normal">${name}</p><p class="mt-0.5 truncate text-[8px] leading-tight text-gray-500 sm:text-xs sm:leading-normal">${contact}</p></div><button type="button" data-act="bulk-customer-remove" data-id="${c.id}" data-testid="configure-bulk-order-remove-customer-btn-${c.id}" class="-mr-1 -mt-0.5 shrink-0 rounded-full bg-white/80 p-0.5 text-blue-500 transition-colors hover:bg-blue-100 hover:text-blue-700 sm:m-0 sm:rounded sm:bg-transparent sm:p-1 sm:text-gray-600 sm:hover:bg-gray-100 sm:hover:text-gray-600" aria-label="Remove ${name}">${lucide('x', { cls: 'h-3 w-3 sm:h-4 sm:w-4' })}</button></div>`;
  }).join('')}</div></div>` : '';

  // Products: the customers' catalogue, one box per sub-category.
  const q = b.prodSearch.toLowerCase();
  let products;
  if (!n) products = `<div data-testid="configure-bulk-order-products-select-customers-first" class="flex flex-col items-center justify-center py-12 px-4"><div class="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">${lucide('users', { cls: 'w-8 h-8 text-blue-400' })}</div><h3 class="text-sm font-medium text-gray-900 mb-1">Select customers first</h3><p class="text-xs text-gray-500 text-center max-w-xs">Choose customers from the left panel to view their catalogue products</p></div>`;
  else if (b.loadingProducts) products = `<div data-testid="configure-bulk-order-products-loading" class="flex flex-col items-center justify-center py-16 px-4">${dots('bg-green-600')}<p class="text-sm text-gray-600 animate-pulse">${esc(b.loadingMsg || 'Fetching products from customer catalogue...')}</p></div>`;
  else {
    const subs = m.catalogue.flatMap((cat) => cat.subs).map((s) => ({ s, list: s.products.filter((p) => p.name.toLowerCase().includes(q)) })).filter((x) => x.list.length);
    products = subs.length ? subs.map(({ s, list }) => {
      const open = q ? list.length > 0 && !b.collapsed.includes(s.id) : !b.collapsed.includes(s.id);
      const allOn = list.every((p) => b.selected.includes(p.id));
      return `<div data-testid="configure-bulk-order-category-${s.id}" data-status="${open ? 'open' : 'closed'}" class="border border-gray-200 rounded-md"><div class="flex items-center gap-3 p-3 bg-gray-50" data-act="bulk-sub-toggle" data-id="${s.id}"><input type="checkbox" id="${s.id}"${allOn ? ' checked=""' : ''} data-bulk-sub="${s.id}" data-testid="configure-bulk-order-category-checkbox-${s.id}" class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"><label for="${s.id}" class="text-sm font-medium text-blue-600 cursor-pointer">${esc(toTitleCase(s.name))}<!----> (<!---->${list.length}<!----> Products)</label><button data-testid="configure-bulk-order-category-toggle-${s.id}" class="flex justify-end flex-1 text-gray-400 hover:text-gray-600">${lucide('chevron-down', { cls: `w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}` })}</button></div>${open ? `<div class="p-3 space-y-2 border-t border-gray-200">${list.map((p) => { const on = b.selected.includes(p.id); return `<div data-testid="configure-bulk-order-product-row-${p.id}" data-status="${on ? 'selected' : 'unselected'}" class="flex items-center gap-3 pl-7"><input type="checkbox" id="${p.id}"${on ? ' checked=""' : ''} data-bulk-product="${p.id}" data-testid="configure-bulk-order-product-checkbox-${p.id}" class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"><label for="${p.id}" class="flex-1 text-sm text-gray-700 cursor-pointer">${esc(toTitleCase(p.name))}</label></div>`; }).join('')}</div>` : ''}</div>`;
    }).join('') : `<div data-testid="configure-bulk-order-products-empty" class="flex flex-col items-center justify-center py-12 px-4"><div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">${lucide('search-x', { cls: 'w-8 h-8 text-gray-400' })}</div><h3 class="text-sm font-medium text-gray-900 mb-1">No products found</h3><p class="text-xs text-gray-500 text-center max-w-xs">${b.prodSearch ? `No products match "${esc(b.prodSearch)}".` : 'No products available in customer catalogue.'}</p><button data-act="bulk-add-products" data-testid="configure-bulk-order-add-products-from-catalogue-btn" class="mt-4 px-3 py-1.5 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-md border border-purple-200 transition-colors flex items-center gap-1.5">${fi('plus', { cls: 'w-3.5 h-3.5' })}Add Products from Full Catalogue</button></div>`;
  }
  const stat = (icon, color, short, long, value) => `<div class="flex items-center justify-center sm:justify-start gap-2 sm:gap-3 rounded-md bg-gray-50 sm:bg-transparent px-2 py-2 sm:p-0">${lucide(icon, { cls: `h-5 w-5 sm:h-8 sm:w-8 ${color}` })}<div><p class="text-[10px] sm:text-sm leading-tight text-gray-600"><span class="sm:hidden">${short}</span><span class="hidden sm:inline">${long}</span></p><p class="text-lg sm:text-2xl leading-none font-bold text-gray-900">${value}</p></div></div>`;
  const canProceed = b.selected.length && n;
  return `<div class="px-3 sm:px-6 py-4 pb-40 lg:pb-4"><div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="flex items-center justify-between mb-3"><div class="flex items-center gap-3">${lucide('users', { cls: 'h-5 w-5 text-blue-600' })}<div><h2 class="text-lg font-semibold text-gray-900">Select Customer for Order</h2><p class="text-xs text-gray-500">Choose one or more customers to create bulk orders</p></div></div></div>
      <div class="space-y-3"><div class="flex flex-wrap gap-2"><div class="flex flex-col gap-1 flex-1 min-w-[200px]"><span class="text-[10px] font-medium text-gray-500 uppercase tracking-wide">By Name / Phone</span><div class="relative">${searchInput}${dropdown}</div></div>
        <div class="flex flex-col gap-1 flex-1 min-w-[200px]"><span class="text-[10px] font-medium text-gray-500 uppercase tracking-wide">By Catalogue</span>${catalogueSelect(m, b)}</div></div>${cta}${loading}${chips}</div></div>
    <div class="bg-white rounded-lg border border-gray-200 p-4 lg:flex lg:h-[calc(100dvh-190px)] lg:min-h-0 lg:flex-col ${n ? '' : 'opacity-50 pointer-events-none'}"><div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3"><div class="flex items-center gap-3 min-w-0">${lucide('package', { cls: 'h-5 w-5 text-green-600' })}<div class="min-w-0"><h2 class="text-lg font-semibold text-gray-900">Select Products &amp; Categories</h2><p class="text-xs text-gray-500">${n ? `From ${n} customer${n !== 1 ? 's' : ''} catalogue` : 'Select customers to view products'}</p></div></div><div class="grid grid-cols-3 gap-2 sm:flex sm:gap-2"><button data-act="bulk-products-all" data-testid="configure-bulk-order-select-all-products-btn" class="px-3 py-1 text-xs font-medium rounded-md bg-green-50 text-green-600 hover:bg-green-100 border border-green-200 transition-colors">Select All</button><button data-act="bulk-products-none" data-testid="configure-bulk-order-clear-all-products-btn" class="px-3 py-1 text-xs font-medium rounded-md bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">Clear All</button></div></div>
      <div class="mb-4"><div class="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white">${lucide('search', { cls: 'w-4 h-4 text-gray-400 flex-shrink-0' })}<input type="text" data-testid="configure-bulk-order-product-search-input" placeholder="Search products..." class="flex-1 text-sm outline-none placeholder:text-gray-400" value="${esc(b.prodSearch)}">${b.prodSearch ? `<button data-act="bulk-product-search-clear" data-testid="configure-bulk-order-product-search-clear-btn" class="flex-shrink-0 p-0.5 hover:bg-gray-100 rounded transition-colors" aria-label="Clear search">${lucide('x', { cls: 'w-4 h-4 text-gray-400 hover:text-gray-600' })}</button>` : ''}</div></div>
      <div class="custom-scroll -mr-6 max-h-96 space-y-2 overflow-y-auto pr-6 lg:min-h-0 lg:max-h-none lg:flex-1 xl:max-h-none">${products}</div></div></div>
    <div class="fixed left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 p-3 lg:bg-gray-50 lg:fixed lg:left-[0] lg:right-[0] lg:bottom-[0] lg:border-gray-200 lg:p-6 lg:shadow-none"><div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-6"><div class="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-6 md:gap-8">${stat('package', 'text-green-600', 'Products', 'Selected Products', b.selected.length)}${stat('users', 'text-blue-600', 'Customers', 'Selected Customers', n)}${stat('calculator', 'text-purple-600', 'Combos', 'Total Combinations', b.selected.length * n)}</div><button${canProceed ? '' : ' disabled=""'} data-act="bulk-proceed" data-testid="configure-bulk-order-proceed-btn" class="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white px-6 py-3 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition-colors w-full md:w-auto">Proceed to Order Entry<!---->${fi('arrow-right', { cls: 'w-4 h-4' })}</button></div></div></div>`;
}

/** The catalogue confirmation: what picking a catalogue would add. */
function confirmBody(m, b) {
  const cat = m.catalogues.find((c) => c.id === b.confirm);
  const customers = m.data.customers.filter((c) => m.catalogueOf(c).id === cat.id);
  const products = m.catalogue.flatMap((x) => x.subs.flatMap((s) => s.products));
  const fmt = (v) => `${m.currency}${NB}${v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const productRows = products.map((p) => `<li data-testid="selection-confirmation-product-row-${p.id}" class="py-2 px-1 border-b border-gray-100 last:border-0"><div class="font-medium text-gray-800 text-sm">${esc(toTitleCase(p.name))}</div>${customers.map((c) => `<div class="text-xs text-gray-500 mt-0.5">${esc(toTitleCase(c.name))}<!---->:<!----> <span class="font-medium">${fmt(Number((p.price * (1 + (p.tax || 0) / 100)).toFixed(2)))}</span></div>`).join('')}</li>`).join('');
  const customerRows = customers.map((c) => `<li data-testid="selection-confirmation-customer-row-${c.id}" class="py-2 px-1 border-b border-gray-100 last:border-0"><div class="font-medium text-gray-800 text-sm">${esc(c.name)}</div><div class="text-xs text-gray-500 mt-0.5">${esc(c.phone ?? c.email ?? '-')}</div></li>`).join('');
  return `<div class="mb-4"><h3 class="text-lg font-semibold">${esc(cat.name)}</h3><p class="text-sm text-gray-500 mt-1">Selected products and customers from this catalogue to create bulk orders</p></div>
    <div class="border-t border-b py-4 h-[400px]"><div class="flex gap-6 h-full">
      <div class="flex flex-col h-full flex-1"><div class="flex items-center justify-between mb-3"><div class="font-medium text-gray-800">Products (<!---->${products.length}<!---->)</div></div><div class="bg-white border rounded-lg p-2 flex-1 overflow-auto">${products.length ? `<ul>${productRows}</ul>` : '<div data-testid="selection-confirmation-products-empty" class="text-xs text-gray-400">No products</div>'}</div></div>
      <div class="flex flex-col h-full flex-1"><div class="flex items-center justify-between mb-3"><div class="font-medium text-gray-800">Customers (<!---->${customers.length}<!---->)</div></div><div class="bg-white border rounded-lg p-2 flex-1 overflow-auto">${customers.length ? `<ul>${customerRows}</ul>` : '<div data-testid="selection-confirmation-customers-empty" class="text-xs text-gray-400">No customers</div>'}</div></div>
    </div></div>
    <div class="mt-4 flex items-center justify-between gap-4"><div class="text-sm text-gray-600">These will be added to your current selection.</div><div class="flex gap-3"><button data-act="bulk-confirm-cancel" data-testid="selection-confirmation-modal-cancel-btn" class="text-sm h-10 px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium transition-colors">Cancel</button><button data-act="bulk-confirm"${products.length && customers.length ? '' : ' disabled=""'} data-testid="selection-confirmation-modal-confirm-btn" class="text-sm h-10 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors">Confirm</button></div></div>`;
}

// ── Step 2: the quantity grid ─────────────────────────────────────────────────────────────
const taxLabel = (t) => (Number(t || 0) === 0 ? '0% tax' : `${t}% incl. tax`);

function qtyCell(b, p, c) {
  const key = qkey(p.id, c.id);
  const label = esc(toTitleCase(c.name) || c.name || 'this customer');
  if (b.removed.includes(key)) return `<td class="p-2 text-center"><div class="flex min-h-8 items-center justify-center gap-1"><button type="button" data-act="bulk-qty-restore" data-key="${key}" data-testid="bulk-order-qty-restore-btn-${p.id}-${c.id}" class="inline-flex h-7 w-7 items-center justify-center rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Add quantity for ${label}" aria-label="Add quantity for ${label}">${fi('plus', { cls: 'w-4 h-4' })}</button></div></td>`;
  const raw = b.raw[key] ?? (Number(b.qty[key]) > 0 ? String(b.qty[key]) : '');
  return `<td class="p-2 text-center"><div class="flex min-h-8 items-center justify-center gap-1"><input type="number" min="0" data-bulk-qty="${key}" data-testid="bulk-order-qty-input-${p.id}-${c.id}" class="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="0" autocomplete="off" value="${esc(raw)}"><button type="button" data-act="bulk-qty-clear" data-key="${key}" data-bulk-nofocus data-testid="bulk-order-qty-clear-btn-${p.id}-${c.id}" class="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Clear quantity for ${label}" aria-label="Clear quantity for ${label}">${fi('trash-2', { cls: 'w-3.5 h-3.5' })}</button></div></td>`;
}

function priceContent(m, b, v, p, c, single) {
  const key = qkey(p.id, c.id);
  if (b.removed.includes(key)) return '';
  if (b.editing === key) {
    return `<div class="relative"><div class="flex flex-nowrap items-center justify-center gap-1"><span class="text-xs text-gray-600">${m.currency}</span><div class="relative"><input type="number" inputmode="decimal" min="0" step="0.01" data-bulk-price="${key}" data-testid="bulk-order-price-input-${p.id}-${c.id}" class="w-20 max-w-full px-2 py-1 border-2 ${b.priceError ? 'border-red-500' : 'border-amber-400'} rounded text-center text-xs focus:ring-2 ${b.priceError ? 'focus:ring-red-500 focus:border-red-500' : 'focus:ring-amber-500 focus:border-amber-500'} bg-white" placeholder="0.00" value="${esc(b.tempPrice)}">${b.priceError ? `<div data-testid="bulk-order-price-error-${p.id}-${c.id}" class="absolute z-50 top-full left-1/2 transform -translate-x-1/2 mt-1"><div class="bg-red-500 text-white text-xs rounded py-1 px-2 whitespace-nowrap shadow-lg">${esc(b.priceError)}<div class="absolute bottom-full left-1/2 transform -translate-x-1/2"><div class="border-4 border-transparent border-b-red-500"></div></div></div></div>` : ''}</div><button type="button" data-act="bulk-price-confirm" data-key="${key}" data-testid="bulk-order-price-confirm-btn-${p.id}-${c.id}" class="p-1 hover:bg-green-100 rounded transition-colors" title="Confirm">${lucide('check', { cls: 'w-3.5 h-3.5 text-green-600' })}</button><button type="button" data-act="bulk-price-cancel" data-testid="bulk-order-price-cancel-btn-${p.id}-${c.id}" class="p-1 hover:bg-red-100 rounded transition-colors" title="Cancel">${lucide('x', { cls: 'w-3.5 h-3.5 text-red-600' })}</button></div></div>`;
  }
  const u = v.unit(p, c);
  const shown = `<span class="text-sm font-medium text-gray-800">${money(m, u.toFixed(2))}</span>${m.appProp.allowOrderPriceOverride === true ? `<button type="button" data-act="bulk-price-edit" data-key="${key}" data-testid="bulk-order-price-edit-btn-${p.id}-${c.id}" class="p-1 hover:bg-amber-100 rounded transition-colors group" title="Edit price">${lucide('pen', { cls: 'w-3.5 h-3.5 text-gray-500 group-hover:text-amber-600' })}</button>` : ''}`;
  return single
    ? `<div class="flex flex-col items-center justify-center gap-1"><div class="flex items-center gap-2">${shown}</div><span class="block text-[11px] text-gray-500 leading-tight">${taxLabel(p.tax)}</span></div>`
    : `<div class="flex items-center justify-center gap-2">${shown}</div>`;
}

function gridBody(m, b, v) {
  const cs = v.customers;
  const single = cs.length === 1;
  const multi = cs.length > 1;
  const rs = multi ? ' rowSpan=&quot;2&quot;' : '';
  const rowspan = multi ? '2' : '1';
  const span = 2 + (single ? 2 : cs.length) + 2;
  const custHead = (c, extra) => `<th class="${extra}"><div class="text-sm"><div class="font-semibold">${esc(toTitleCase(c.name) || c.name)}</div><div class="text-xs text-gray-600 font-normal">${esc(c.phone || c.email || '')}</div></div></th>`;
  const heads = single
    ? `<th class="text-center text-sm py-4 px-2 font-medium text-gray-900 bg-zinc-50 min-w-[100px]">Price / Unit</th>${custHead(cs[0], 'text-center text-sm py-4 px-2 font-medium text-gray-900 bg-blue-50 min-w-[100px]')}`
    : cs.map((c) => custHead(c, 'text-center p-2 font-medium text-gray-900 bg-blue-50 min-w-[100px] max-w-[100px]')).join('');
  // Grouped as the product groups its selection: by category, then sub-category, in the order
  // products were selected.
  const groups = [];
  for (const x of v.products) {
    let g = groups.find((y) => y.cat === x.cat.id);
    if (!g) groups.push(g = { cat: x.cat.id, subs: [] });
    let s = g.subs.find((y) => y.sub.id === x.sub.id);
    if (!s) g.subs.push(s = { sub: x.sub, items: [] });
    s.items.push(x.p);
  }
  const rows = groups.flatMap((g) => g.subs).map(({ sub, items }) => `<tr><td colspan="${span}" class="p-3 bg-blue-100 border-b border-gray-200 top-[55px] z-10"><h4 class="font-medium text-blue-800 text-center">${esc(sub.name)}</h4></td><td colspan="${span - 1}" class="bg-blue-100 border-b border-gray-200 sticky top-[55px] z-10"></td></tr>${items.map((p) => {
    const free = m.availableStock(p);
    const t = v.rowTotal(p);
    const priceSingle = single ? `<td class="p-2 text-center min-w-[150px] sm:min-w-[160px]">${priceContent(m, b, v, p, cs[0], true)}</td>` : '';
    const main = `<tr data-testid="bulk-order-product-row-${p.id}" class="border-b border-gray-200 hover:bg-gray-50"><td class="p-2 text-sm font-medium text-gray-900 bg-white sticky left-0 z-20 border-r border-gray-200 min-w-[140px] md:min-w-48${multi ? ' ' + rs.trim() : ' '}" rowspan="${rowspan}"><div class="flex items-center gap-3"><div class="min-w-10">${img('hidden mr-2 md:block shadow-none rounded-custom', 32)}</div><div class="flex min-w-0 flex-col"><span class="font-medium max-w-[76px] md:max-w-48 break-words leading-tight">${esc(toTitleCase(p.name))}</span><span class="text-xs text-gray-500">${esc(p.articleNo)}</span><span class="text-[11px] font-medium mt-0.5 ${free <= 0 ? 'text-red-500' : 'text-green-600'}">${free <= 0 ? 'Out of stock' : `${free} avail.`}</span></div></div></td><th class="text-center text-xs py-2 px-2 font-medium text-gray-900 bg-zinc-50 min-w-12${multi ? ' ' + rs.trim() : ' '}" rowspan="${rowspan}">${esc(p.unit || 'N/A')}</th>${priceSingle}${cs.map((c) => qtyCell(b, p, c)).join('')}<td class="py-2 px-2 text-center text-sm font-medium text-black bg-zinc-50${multi ? ' ' + rs.trim() : ' '}" rowspan="${rowspan}">${t.qty}</td><td class="py-2 px-2 text-center text-sm font-medium text-black bg-green-50${multi ? ' ' + rs.trim() : ' '}" rowspan="${rowspan}">${money(m, t.total)}</td></tr>`;
    const priceRow = multi ? `<tr class="border-b border-gray-200 hover:bg-gray-50 bg-gray-50">${cs.map((c) => `<td class="p-2 text-center bg-amber-50 min-w-[150px] sm:min-w-[160px]">${priceContent(m, b, v, p, c, false)}</td>`).join('')}</tr>` : '';
    return main + priceRow;
  }).join('')}`).join('');
  const card = (icon, color, label, value, extra = '') => `<div class="bg-white rounded-lg border border-gray-200 py-2 px-3 sm:px-4"><div class="flex items-center gap-3">${lucide(icon, { cls: `h-6 w-6 sm:h-8 sm:w-8 ${color} flex-shrink-0` })}<div class="min-w-0"><p class="text-xs sm:text-sm text-gray-600">${label}</p><p class="text-xl sm:text-2xl font-bold text-gray-900${extra}">${value}</p></div></div></div>`;
  const pending = b.pendingDelete ? `<div data-testid="bulk-order-remove-confirm-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"><div class="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-5"><div class="flex items-center justify-between"><h3 class="text-lg font-bold text-gray-900">Clear Quantity?</h3><button data-act="bulk-pending-keep" data-testid="bulk-order-remove-confirm-modal-close-btn" class="p-1 text-gray-400 hover:text-gray-600 transition-colors">${lucide('x', { cls: 'w-5 h-5' })}</button></div><p class="text-sm text-gray-600">Do you want to clear this product quantity only for ${esc(b.pendingDelete.customerName || 'this customer')}? Other customers will not be changed.</p><div class="flex gap-3 justify-end"><button class="px-5 py-2 text-sm font-medium border border-gray-300 !bg-white hover:!bg-gray-50 rounded-lg transition-colors" data-act="bulk-pending-keep" data-testid="bulk-order-remove-confirm-modal-keep-btn">No, Keep</button><button class="px-5 py-2 text-sm font-medium text-white !bg-emerald-500 hover:!bg-emerald-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" data-act="bulk-pending-clear" data-testid="bulk-order-remove-confirm-modal-confirm-btn">${fi('trash-2', { cls: 'w-4 h-4' })}Yes, Clear</button></div></div></div>` : '';
  return `<div class="py-3 px-3 sm:px-6 pb-28 sm:pb-3"><div class="max-w-full"><div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-4">${card('shopping-cart', 'text-blue-600', 'Total Orders', v.totalOrders)}${card('package', 'text-green-600', 'Total QTY', v.totalItems)}${card('file-spreadsheet', 'text-purple-600', 'Selected Products', v.products.length)}${card('calculator', 'text-orange-600', 'Grand Total', money(m, v.grand), ' truncate')}</div>
    <div class="bg-white rounded-lg border border-gray-200 overflow-auto max-h-[calc(100vh-17rem)] sm:max-h-[75vh]" data-bulk-table><table class="w-full min-w-max border-collapse"><thead class="sticky top-0 z-30"><tr class="border-b border-gray-200"><th class="text-left p-4 font-medium text-gray-900 bg-gray-100 sticky left-0 z-40 min-w-[140px] md:min-w-48">Product</th><th class="text-center text-sm py-4 px-2 font-medium text-gray-900 bg-zinc-50 min-w-12">Unit Type</th>${heads}<th class="text-center text-sm py-4 px-2 font-medium text-gray-900 bg-zinc-50 min-w-12">Total Qty</th><th class="text-center text-sm py-4 px-2 font-medium text-gray-900 bg-green-50 min-w-16">Total Value</th></tr></thead>
      <tbody>${rows}<tr class="bg-blue-50 border-t-2 border-blue-200"><td class="p-4 font-bold text-gray-900 bg-blue-50 sticky left-0 z-10" colspan="2">CUSTOMER TOTALS</td>${single ? '<td class="bg-blue-50"></td>' : ''}${cs.map((c) => `<td class="p-2 text-center font-bold">${money(m, v.customerTotal(c))}</td>`).join('')}<td class="p-2 text-center font-bold">${v.totalItems}</td><td class="p-2 text-center font-bold">${money(m, v.grand)}</td></tr></tbody></table></div></div>${pending}</div>`;
}

// ── The preview ───────────────────────────────────────────────────────────────────────────
function previewBody(m, b, v) {
  const date = new Date(b.previewAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const unique = new Set(v.orders.flatMap((o) => o.items.map((i) => i.product.articleNo))).size;
  const grand = v.orders.reduce((s, o) => s + Number(o.grandTotal), 0).toFixed(2);
  const qty = v.orders.reduce((s, o) => s + o.totalItems, 0);
  const card = (icon, color, label, value, extra = '') => `<div class="bg-white rounded-lg border border-gray-200 py-2 px-3 md:px-4"><div class="flex items-center gap-3">${lucide(icon, { cls: `h-6 w-6 md:h-8 md:w-8 ${color} flex-shrink-0` })}<div class="min-w-0"><p class="text-xs md:text-sm text-gray-600">${label}</p><p class="text-xl md:text-2xl font-bold text-gray-900${extra}">${value}</p></div></div></div>`;
  const rows = v.orders.map((o, i) => {
    const open = !!b.expanded[i];
    const c = o.customer;
    const body = open ? `<div class="border-t border-gray-200 bg-white"><div class="px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-5"><div class="grid grid-cols-12 gap-2 sm:gap-3 md:gap-4 sm:min-w-[520px] pb-2 sm:pb-3 border-b border-gray-300 text-[10px] sm:text-xs font-semibold text-gray-600 uppercase"><div class="col-span-4 sm:col-span-5">Product</div><div class="col-span-2">QTY</div><div class="col-span-3 sm:col-span-2">Unit Price</div><div class="col-span-3 sm:col-span-2 text-right sm:text-left">Total</div></div>
      <div class="divide-y divide-gray-100">${o.items.map((it, j) => `<div data-testid="order-preview-item-row-${c.id}-${j}" class="py-3 sm:min-w-[520px]"><div class="grid grid-cols-12 gap-2 sm:gap-4 items-center"><div class="col-span-4 sm:col-span-5 flex items-center gap-2 sm:gap-3 min-w-0"><div class="hidden sm:block flex-shrink-0">${img('hidden mr-2 md:block shadow-none rounded-custom', 32)}</div><div class="flex-1 min-w-0"><div class="text-sm text-gray-900 font-medium truncate">${esc(toTitleCase(it.product.name))}</div><div class="text-xs text-gray-500 mt-0.5">#<!---->${esc(it.product.articleNo || 'N/A')}</div></div></div><div class="col-span-2 text-[11px] sm:text-sm text-gray-900 min-w-0"><div class="font-medium break-words">${it.qty}<!----> <!---->${esc(it.product.unit || 'Box')}</div></div><div class="col-span-3 sm:col-span-2 text-xs sm:text-sm text-gray-900 font-medium tabular-nums min-w-0">${money(m, it.unit)}<span class="block text-[11px] text-gray-500 leading-tight">${taxLabel(it.product.tax)}</span></div><div class="col-span-3 sm:col-span-2 text-[11px] sm:text-sm text-gray-900 font-semibold tabular-nums whitespace-nowrap min-w-0 text-right sm:text-left">${money(m, it.total)}</div></div></div>`).join('')}</div>
      <div class="mt-3 pt-3 border-t border-gray-200"><div class="space-y-1"><div class="flex justify-between items-center py-1"><span class="text-sm text-gray-700 font-normal">Subtotal</span><span class="text-sm text-gray-800 font-normal tabular-nums">${money(m, o.subtotal)}</span></div><div class="flex justify-between items-center py-1"><span class="text-sm text-gray-700 font-normal">Tax</span><span class="text-sm text-gray-800 font-normal tabular-nums">${money(m, o.totalTax)}</span></div><div class="flex justify-between items-center py-1 border-t border-gray-200 mt-1 pt-2"><span class="text-sm text-gray-700 font-semibold uppercase">Grand Total</span><span class="text-sm text-gray-800 font-semibold tabular-nums">${money(m, o.grandTotal)}</span></div></div></div></div></div>` : '';
    return `<div data-testid="order-preview-row-${c.id}" data-status="${open ? 'open' : 'closed'}" class="border border-gray-200 rounded-lg overflow-hidden bg-white"><button data-act="bulk-preview-toggle" data-index="${i}" data-testid="order-preview-toggle-${c.id}" class="w-full hover:bg-gray-50 px-3 py-3 sm:p-4 transition-colors" aria-expanded="${open}"><div class="flex items-center justify-between gap-2 sm:gap-6"><div class="flex items-center gap-2 sm:gap-3 flex-1 min-w-0"><div class="flex-shrink-0"><div class="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-full flex items-center justify-center">${lucide('user', { cls: 'w-5 h-5 text-blue-600' })}</div></div><div class="flex-1 text-left min-w-0"><h2 class="text-sm font-semibold text-gray-900 truncate">${esc(toTitleCase(c.name))}</h2>${c.phone ? `<div class="flex items-center gap-1.5 text-xs text-gray-500 mt-1 font-normal">${lucide('phone', { cls: 'w-3.5 h-3.5' })}<span>${esc(c.phone)}</span></div>` : ''}</div></div>
      <div class="flex items-center gap-2 sm:gap-6 flex-shrink-0"><div class="text-center hidden sm:block min-w-[60px]"><div class="text-xs text-gray-500 font-normal mb-1">Items</div><div class="text-base font-semibold text-gray-900">${o.totalItems}</div></div><div class="text-right min-w-[84px] sm:min-w-[100px]"><div class="text-xs text-gray-500 font-normal mb-1">Total</div><div class="text-base font-bold text-gray-900">${money(m, o.grandTotal)}</div></div><div class="flex-shrink-0">${lucide('chevron-down', { cls: `w-5 h-5 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}` })}</div></div></div></button>${body}</div>`;
  }).join('');
  const notify = m.appProp?.notification?.isEnabled;
  const n = v.orders.length;
  return `<div data-testid="order-preview" class="bg-white rounded-lg w-full max-h-[calc(90vh-2rem)] min-h-0 flex flex-col"><div class="pb-4 border-b border-gray-200 flex-shrink-0"><div class="flex items-center justify-between mb-4"><div class="flex items-center gap-3"><div class="p-2 bg-blue-50 rounded-lg">${lucide('file-text', { cls: 'w-6 h-6 text-blue-600' })}</div><div><h1 class="text-xl font-bold text-gray-900">Order Preview</h1><p class="text-xs text-gray-600 flex items-center gap-1 mt-1">${lucide('calendar', { cls: 'w-3 h-3' })}${date}</p></div></div></div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">${card('shopping-cart', 'text-blue-600', 'Total Orders', n)}${card('package', 'text-green-600', 'Total QTY', qty)}${card('file-spreadsheet', 'text-purple-600', 'Selected Products', unique)}${card('calculator', 'text-orange-600', 'Grand Total', money(m, grand), ' truncate')}</div></div>
    <div class="py-3 sm:py-4 space-y-3 flex-1 min-h-0 sm:-mr-2 sm:pr-2 md:-mr-6 md:pr-6 overflow-y-auto overflow-x-hidden custom-scroll">${rows}</div>
    <div class="sticky bottom-0 z-10 -mx-2 md:mx-0 bg-white px-2 md:px-0 pb-2 pt-3 border-t border-gray-200 flex-shrink-0 flex flex-col sm:flex-row gap-3 sm:gap-4 ${notify ? 'sm:justify-between' : 'sm:justify-end'}">${notify ? `<div class="flex items-center gap-2 p-3"><input type="checkbox" id="notifyUser" name="notifyUser" data-bulk-notify${b.notify ? ' checked=""' : ''} class="w-4 h-4"><label for="notifyUser" class="text-sm text-gray-700 cursor-pointer">Send notification to customers about new orders</label></div>` : ''}<div class="grid grid-cols-2 gap-3 sm:flex sm:justify-end"><button data-act="bulk-preview-back"${b.submitting ? ' disabled=""' : ''} data-testid="order-preview-back-btn" class="px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed">Back to Edit</button><button data-act="bulk-create"${b.submitting ? ' disabled=""' : ''} data-testid="order-preview-submit-btn" class="px-4 sm:px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium flex items-center justify-center gap-2 transition-colors disabled:bg-green-400 disabled:hover:bg-green-400 disabled:cursor-not-allowed">${b.submitting ? `${lucide('loader-circle', { cls: 'w-4 h-4 animate-spin' })}<span>Creating Orders...</span>` : `${lucide('check', { cls: 'w-4 h-4' })}Create<!----> <!---->${n}<!----> <!---->${n === 1 ? 'Order' : 'Orders'}`}</button></div></div></div>`;
}

// ── Route picker ──────────────────────────────────────────────────────────────────────────
export function renderRouteSelect(m, r) {
  let list;
  if (r.loading) list = `<div data-testid="route-select-loading" class="flex flex-col gap-0 divide-y divide-gray-100 dark:divide-gray-700">${[1, 2, 3].map(() => '<div class="flex items-center gap-3 px-4 py-3.5"><div class="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-600 animate-pulse flex-shrink-0"></div><div class="flex-1 space-y-1.5"><div class="h-3.5 bg-gray-200 dark:bg-gray-600 rounded animate-pulse w-2/3"></div><div class="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse w-1/3"></div></div></div>').join('')}</div>`;
  else {
    const routes = m.data.routeTemplates.filter((t) => t.customerIds.length > 0);
    list = routes.length ? `<div class="divide-y divide-gray-100 dark:divide-gray-700/60 max-h-72 overflow-y-auto">${routes.map((t) => {
      const on = r.selected === t.id;
      const nc = t.customerIds.length;
      return `<div data-testid="route-select-row-${t.id}" data-status="${on ? 'selected' : 'unselected'}"><button type="button" data-act="route-pick" data-id="${t.id}" data-testid="route-select-row-toggle-${t.id}" class="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${on ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'}"><div class="flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${on ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 dark:border-gray-500'}">${on ? '<div class="w-1.5 h-1.5 rounded-full bg-white"></div>' : ''}</div><div class="flex-1 min-w-0"><p class="text-sm font-medium truncate ${on ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-800 dark:text-white'}">${esc(t.name)}</p><div class="flex items-center gap-3 mt-0.5"><span class="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">${lucide('users', { cls: 'w-3 h-3' })}${nc}<!----> customer<!---->${nc !== 1 ? 's' : ''}</span><span class="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">${lucide('map-pin', { cls: 'w-3 h-3' })}${t.staffIds.length}<!----> staff</span></div></div></button>${on ? `<div class="px-4 pb-3.5 pt-1 bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-100 dark:border-indigo-800/40"><label class="block text-xs font-medium text-indigo-600 dark:text-indigo-400 mb-1.5">Delivery Name</label><input type="text" placeholder="e.g. Bandra Route 27/05/2026" data-route-name data-testid="route-select-delivery-name-input" class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-lg outline-none text-gray-800 dark:text-white placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors" value="${esc(r.name)}"></div>` : ''}</div>`;
    }).join('')}</div>` : '<p data-testid="route-select-empty" class="text-center text-gray-400 dark:text-gray-500 text-sm py-10">No routes with customers found.</p>';
  }
  const can = r.selected && r.name.trim();
  return renderModal({ testId: 'route-select', size: 'md', content: `<div class="flex flex-col gap-5 pb-1"><div class="flex items-center gap-3"><div class="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex-shrink-0">${lucide('route', { cls: 'w-5 h-5 text-indigo-600' })}</div><h2 class="text-base font-semibold text-gray-800 dark:text-white leading-tight">Select Route</h2></div><div class="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">${list}</div><div class="flex gap-3"><button type="button" data-act="route-cancel" data-testid="route-select-modal-cancel-btn" class="flex-1 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors">Cancel</button><button type="button" data-act="route-confirm"${can ? '' : ' disabled=""'} data-testid="route-select-modal-confirm-btn" class="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Start Bulk Order</button></div></div>` });
}

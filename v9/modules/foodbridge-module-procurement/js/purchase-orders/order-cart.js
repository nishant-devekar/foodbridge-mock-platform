/*
  OrderCartModal: the review cart the create drawer opens on "Create Purchase Order" — a CustomModal
  (size "other") rendered INSIDE the drawer, as production renders it. Cart Items / Deleted Items
  tabs, a table (tablet and up) or cards (phone), and the summary: the desktop sidebar or the phone's
  bottom bar. An external supplier's order is one step ("Place Order"); an internal one follows the
  host's checkout steps ("NEXT →" to payment).

  Its own state lives here and survives closing, except what production resets on close.
*/
import { esc } from '../components/dom.js';
import { lucide } from '../components/icons.js';
import { customModal } from '../components/modal.js';
import { displayImage } from '../components/windmill.js';
import { taxLabel, policyOf, policyDuration } from './create-drawer.js';

const T = '<!---->';
const NB = ' ';
const STEP_LABELS = { cart: 'Cart', payment: 'Payment', shipping: 'Shipping' };
const STYLE = `
          @media (max-width: 767px) {
            .order-cart-tabs-sticky { position: sticky; top: 0; z-index: 20; background: white; padding-bottom: 0.25rem; }
            .dark .order-cart-tabs-sticky { background: #1f2937; }
            .order-cart-inner { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
            .order-cart-product-list { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
            .order-cart-tab-content { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
          }
          @media (min-width: 768px) and (max-width: 1023px) {
            .order-cart-inner { flex-direction: column !important; }
            .order-cart-summary-desktop { width: 100% !important; position: static !important; }
          }
          @media (min-width: 1024px) {
            .order-cart-inner { flex-direction: row; align-items: stretch; gap: 1.5rem; }
            .order-cart-summary-desktop { width: 30%; flex-shrink: 0; }
            .order-cart-summary-desktop > div { min-height: 420px; height: 100%; }
            .order-cart-product-list { flex: 1; min-width: 0; }
            .offers-scroll-area { scrollbar-width: thin; scrollbar-color: #d1d5db transparent; }
            .offers-scroll-area::-webkit-scrollbar { width: 4px; }
            .offers-scroll-area::-webkit-scrollbar-track { background: transparent; }
            .offers-scroll-area::-webkit-scrollbar-thumb { background-color: #d1d5db; border-radius: 4px; }
          }
          @media (min-width: 1280px) {
            .order-cart-inner { gap: 2rem; }
            .order-cart-summary-desktop { width: 33.333%; }
            .order-cart-summary-desktop > div { min-height: 505px; height: 100%; }
          }
        `;

/** cartHelpers.computeFinancials (no offers, no manual discount on a purchase order). */
function financials(items) {
  let taxTotal = 0;
  let subtotal = 0;
  const grandTotal = items.reduce((s, it) => s + Number(it.pricePerOrderingUnit ?? it.unitPrice ?? 0) * Number(it.quantity || 0), 0);
  for (const it of items) {
    const line = Number(it.pricePerOrderingUnit ?? it.unitPrice ?? 0) * Number(it.quantity || 0);
    const rate = Number(it.tax || 0);
    if (rate > 0) { const excl = line / (1 + rate / 100); taxTotal += line - excl; subtotal += excl; } else subtotal += line;
  }
  return { subtotal, taxTotal, grandTotal };
}
function displayName(c) {
  if (!c) return 'Customer';
  let raw = typeof c.name === 'object' && c.name !== null ? c.name.en || c.name.default || Object.values(c.name)[0] || '' : typeof c.name === 'string' ? c.name : '';
  if (!raw) raw = c.orgName || c.company || c.user?.name || `${c.firstName || c.firstname || ''} ${c.lastName || c.lastname || ''}`.trim() || 'Customer';
  return String(raw || 'Customer').trim();
}
const roundMoney = (v) => { const n = Number(v); return Math.round((Number.isFinite(n) ? Math.max(0, n) : 0) * 100) / 100; };
/** splitPaymentUtils.equalSplit / autoBalance */
function equalSplit(ids, total) {
  if (!ids.length) return {};
  if (ids.length === 1) return { [ids[0]]: total };
  const base = Math.floor((total / ids.length) * 100) / 100;
  const out = {};
  let assigned = 0;
  ids.forEach((id, i) => { if (i === ids.length - 1) out[id] = Math.round((total - assigned) * 100) / 100; else { out[id] = base; assigned += base; } });
  return out;
}
function autoBalance({ changedId, newAmount, total, selectedIds, manuallySet, currentAmounts }) {
  const manual = new Set([...manuallySet, changedId]);
  const adjusters = selectedIds.filter((id) => id !== changedId && !manual.has(id));
  const locked = selectedIds.filter((id) => id !== changedId && manual.has(id)).reduce((sum, id) => sum + (Number(currentAmounts[id]) || 0), 0);
  const remaining = Math.max(0, total - newAmount - locked);
  const amounts = { ...currentAmounts, [changedId]: newAmount };
  if (adjusters.length) {
    const base = Math.floor((remaining / adjusters.length) * 100) / 100;
    let given = 0;
    adjusters.forEach((id, i) => { if (i === adjusters.length - 1) amounts[id] = Math.max(0, Math.round((remaining - given) * 100) / 100); else { amounts[id] = base; given += base; } });
  }
  return { amounts, manuallySet: manual };
}
const titleCase = (s) => String(s || '').toLowerCase().split(' ').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export function createOrderCart(host, { rerender, props }) {
  const currency = host.currency;
  const money = (v) => `${esc(currency)}${NB}${Number(v).toFixed(2)}`; // formatMoney: one template string
  let s = fresh();
  function fresh() { return { activeTab: 'cart', deletedItems: [], sidebarView: 'summary', currentStep: 0, mobileSummaryExpanded: false, wasOpen: false, prevTotal: 0, ...splitDefaults() }; }
  /** The split-payment state OrderCartModal starts with — and returns to on every close. */
  function splitDefaults() {
    const split = Boolean(host.appProp.splitPaymentEnabled);
    const first = host.getActivePaymentMethods()[0]?.id;
    return { isSplitMode: split, splitSelected: split ? [first].filter(Boolean) : [], splitAmounts: {}, splitManual: new Set(), selectedMethod: first || 'pod' };
  }
  let P = null;

  const visible = () => P.cartItems.map((i) => ({ ...i })).filter((i) => !s.deletedItems.some((d) => d._id === i._id)).filter((i) => Number(i.quantity) > 0);
  const qtyKey = (item) => `${item._id}-${P.customerId || ''}`;
  const displayVal = (item) => {
    const raw = P.tempQuantities[qtyKey(item)] !== undefined ? P.tempQuantities[qtyKey(item)] : String(item.quantity ?? '');
    if (raw === '') return '';
    const n = Number(raw);
    return !Number.isNaN(n) ? String(n) : String(Number(item.quantity || 1));
  };
  /** updateTempQuantity: never below 1; the drawer then commits it. */
  function setQty(item, value) {
    let v = value;
    if (value !== '' && !Number.isNaN(Number(value)) && !Number(value)) v = '1';
    P.setTempQuantities({ ...P.tempQuantities, [qtyKey(item)]: v });
    if (v) P.onQtyChange(item, v); else rerender();
  }

  // ── Views ──
  const tab = (active, label, testId, act) => `<button type="button" data-testid="${testId}" class="shrink-0 px-3 py-1.5 text-xs font-semibold transition border rounded-lg lg:px-5 lg:py-2.5 lg:text-sm ${active ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/40'} " data-oc="${act}">${label}</button>`;

  function stepper(item, index, variant) {
    const mobile = variant === 'mobile';
    const cur = displayVal(item) === '' ? 0 : Number(displayVal(item));
    const btn = mobile ? 'h-10 w-10 text-sm' : 'w-10 h-9 text-base';
    const bc = mobile ? 'border-gray-200' : 'border-gray-300';
    return `<div class="flex flex-col ${!mobile ? 'w-full max-w-[160px]' : ''}"><div class="flex items-center border ${mobile ? 'border-gray-200 shadow-[0_2px_6px_rgba(15,23,42,0.10)]' : 'border-gray-300'} dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">`
      + `<button${cur <= 1 ? ' disabled=""' : ''} data-testid="cart-item-qty-decrement-btn-${variant}-${esc(item._id)}" class="${btn} flex-shrink-0 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold border-r ${bc} dark:border-gray-600" title="${cur <= 1 ? 'Minimum quantity is 1' : 'Decrease quantity'}" aria-label="Decrease quantity" data-oc="dec" data-id="${esc(item._id)}">−</button>`
      + `<input type="tel" inputmode="decimal" pattern="[0-9]*\\.?[0-9]{0,2}" id="cart-qty-input-${variant}-${index}" data-testid="cart-item-qty-input-${variant}-${esc(item._id)}" autocomplete="off" class="${mobile ? 'h-10 w-[52px] text-sm' : 'flex-1 min-w-0 h-9 text-sm'} text-center ${mobile ? 'font-bold' : 'font-medium'} border-0 focus:outline-none focus:ring-0 text-gray-900 dark:text-white bg-transparent" title="Enter quantity" aria-label="Quantity" value="${esc(displayVal(item))}" data-oc-qty="${esc(item._id)}" data-variant="${variant}" data-index="${index}">`
      + `<button data-testid="cart-item-qty-increment-btn-${variant}-${esc(item._id)}" class="${btn} flex-shrink-0 flex items-center justify-center ${mobile ? 'text-green-600 dark:text-green-400 hover:bg-green-50' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100'} dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold border-l ${bc} dark:border-gray-600" title="Increase quantity" aria-label="Increase quantity" data-oc="inc" data-id="${esc(item._id)}">+</button></div></div>`;
  }

  /** PolicyRow: the item's policy badge, "Send activation link", and the buyer's email. */
  function policyRow(item, variant) {
    const policy = policyOf(item);
    if (!policy || !policy.name) return '';
    const st = P.policyActivationRequests?.[item._id] || { enabled: false, email: '' };
    const w = policy.type === 'WARRANTY';
    const badge = w ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
    const dot = w ? 'bg-blue-500' : 'bg-emerald-500';
    const check = w ? 'text-blue-600 focus:ring-blue-500' : 'text-emerald-600 focus:ring-emerald-500';
    const dur = policy.activation?.duration_in_sec ? policyDuration(policy.activation.duration_in_sec) : '';
    if (variant === 'mobile') {
      return '<div class="mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700"><div class="flex flex-wrap items-center gap-1.5">'
        + `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${badge}"><span class="h-1.5 w-1.5 rounded-full ${dot}"></span>${esc(policy.name)}${dur ? `<span class="opacity-70">· ${T}${esc(dur)}</span>` : ''}</span>`
        + `<label class="inline-flex items-center gap-1 text-[10px] text-gray-700 dark:text-gray-300"><input type="checkbox"${st.enabled ? ' checked=""' : ''} data-testid="cart-item-policy-activation-toggle-mobile-${esc(item._id)}" class="h-3 w-3 rounded border-gray-300 ${check}" data-oc="policy-toggle" data-id="${esc(item._id)}"><span class="font-medium">Send activation link</span></label>`
        + `<input type="email" value="${esc(st.email)}"${st.enabled ? '' : ' disabled=""'} placeholder="Buyer email" data-testid="cart-item-policy-email-input-mobile-${esc(item._id)}" class="h-6 flex-1 min-w-0 rounded border px-2 text-[10px] shadow-sm transition-all ${st.enabled ? 'bg-white border-gray-200 focus:border-blue-400 focus:ring-1 focus:ring-blue-100 dark:bg-gray-800 dark:border-gray-700' : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-900/40 dark:border-gray-800'}" data-oc-policy-email="${esc(item._id)}">`
        + '</div></div>';
    }
    return '<tr class="bg-gray-50/70 dark:bg-gray-800/40"><td colspan="5" class="px-5 py-3"><div class="flex items-center gap-3 flex-nowrap overflow-x-auto">'
      + `<span class="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-semibold border shrink-0 whitespace-nowrap ${badge}" title="${esc(policy.ruleset?.[0]?.content || '')}"><span class="h-1.5 w-1.5 rounded-full ${dot}"></span><span>${esc(policy.name)}</span>${dur ? `<span class="opacity-70 font-medium">· ${T}${esc(dur)}</span>` : ''}</span>`
      + `<label class="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 shrink-0 whitespace-nowrap"><input type="checkbox"${st.enabled ? ' checked=""' : ''} data-testid="cart-item-policy-activation-toggle-desktop-${esc(item._id)}" class="h-3.5 w-3.5 rounded border-gray-300 ${check}" data-oc="policy-toggle" data-id="${esc(item._id)}"><span class="font-medium">Send activation link</span></label>`
      + `<input type="email" value="${esc(st.email)}"${st.enabled ? '' : ' disabled=""'} placeholder="Buyer email" data-testid="cart-item-policy-email-input-desktop-${esc(item._id)}" class="h-7 w-48 flex-none rounded-md border px-2.5 text-xs shadow-sm transition-all ${st.enabled ? 'bg-white border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 dark:bg-gray-800 dark:border-gray-700 dark:focus:border-blue-500' : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-900/40 dark:border-gray-800'}" data-oc-policy-email="${esc(item._id)}">`
      + '</div></td></tr>';
  }

  function desktopRow(item, index) {
    const conversion = host.displayUnitConversion(item);
    return `<tr data-testid="cart-item-row-desktop-${esc(item._id)}" data-status="in-stock" class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ">`
      + `<td class="px-5 py-4 align-top"><div class="flex items-center gap-3"><div class="w-14 h-14 bg-white dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600">${displayImage({ size: 56, cls: 'w-full h-full object-cover rounded-custom' })}</div><div class="flex-1 min-w-0"><div class="text-sm font-semibold text-gray-900 dark:text-white truncate">${esc(item.name)}</div><div class="text-xs text-gray-500 dark:text-gray-400 mt-1">${esc(item.brand || '-')}</div><div class="text-xs text-gray-400 dark:text-gray-500">Art No: ${T}${esc(item.articleNumber || item._id)}</div></div></div></td>`
      + `<td class=" py-4 align-top"><div class="flex gap-2 items-center"><div class=""><div class="font-bold text-sm text-gray-900 dark:text-white">${money(item.pricePerOrderingUnit ?? item.unitPrice)}</div><div class="text-[11px] leading-tight text-gray-500 dark:text-gray-400">${esc(item.orderingUnit || item.unit || 'Unit')}</div><span class="block text-[11px] leading-tight text-gray-500">${esc(taxLabel(item.tax))}</span></div></div></td>`
      + `<td class="px-5 py-4 align-top"><div class="flex flex-col items-center gap-1"><div class="flex items-center justify-center gap-1"><span class="text-xs dark:text-gray-500">${esc(item.orderingUnit || item.unit)}</span></div>${stepper(item, index, 'desktop')}${conversion ? `<div class="text-xs text-gray-500 dark:text-gray-400">${conversion.map(esc).join(T)}</div>` : ''}</div></td>`
      + `<td class="px-5 py-4 align-top"><div class="text-base font-bold text-green-600 dark:text-green-400">${money(Number(item.pricePerOrderingUnit ?? item.unitPrice) * Number(item.quantity || 0))}</div></td>`
      + `<td class="px-5 py-4 text-center align-top"><button class="p-2 text-red-600 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" data-testid="cart-item-remove-btn-desktop-${esc(item._id)}" aria-label="Remove item from cart" title="Remove from cart (can be restored from Deleted Items tab)" data-oc="delete" data-id="${esc(item._id)}">${lucide('Trash2', { cls: 'w-5 h-5' })}</button></td></tr>`
      + policyRow(item, 'desktop');
  }

  function mobileCard(item, index) {
    const sum = item.articleNumber ? P.stockSummaryMap[item.articleNumber] : null;
    const ideal = sum ? host.getProductStockFromUnitIndex({ stock: Math.max(0, (sum.availableStock || 0) - (sum.requiredStock || 0)), boxes: sum.boxes || 1, pallets: sum.pallets || 1 }) : null;
    const rawCat = item.categoryName || item.subName || item.subCategoryName || item.category?.name || item.category;
    const cat = typeof rawCat === 'string' ? rawCat.trim() : rawCat?.en || rawCat?.default || '';
    const unit = item.orderingUnit || item.unit;
    return `<div data-testid="cart-item-row-mobile-${esc(item._id)}" data-status="in-stock" class="overflow-visible rounded-2xl border bg-white shadow-[0_2px_9px_rgba(15,23,42,0.10)] dark:bg-gray-800 border-gray-200 dark:border-gray-600">`
      + `<div class="relative flex min-h-[90px] items-start gap-3 px-3 pb-1.5 pt-3"><div class="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-600 dark:bg-gray-700">${displayImage({ size: 72, cls: 'h-full w-full !object-cover rounded-custom' })}</div>`
      + `<div class="min-w-0 flex-1"><div class="truncate text-[15px] font-bold leading-tight text-gray-900 dark:text-white">${esc(item.name)}</div><div class="mt-1 truncate text-[11px] text-gray-500 dark:text-gray-400">Art No: ${T}${esc(item.articleNumber || item._id)}</div><div class="mt-2 flex min-w-0 flex-wrap gap-1.5">`
      + (unit ? `<span class="max-w-[78px] truncate rounded-md bg-green-50 px-2 py-1 text-[10px] font-medium text-green-600 dark:bg-green-900/25 dark:text-green-400">${esc(unit)}</span>` : '')
      + (cat ? `<span class="max-w-[90px] truncate rounded-md bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-600 dark:bg-violet-900/25 dark:text-violet-300">${esc(cat)}</span>` : '')
      + `</div></div><div class="flex-shrink-0 pt-1 text-right"><div class="flex gap-2 items-start justify-end"><div class="text-right"><div class="font-bold text-[17px] text-gray-900 dark:text-white leading-tight">${money(item.pricePerOrderingUnit ?? item.unitPrice)}</div></div></div></div></div>`
      + `<div class="grid min-h-[58px] grid-cols-[132px_1fr_auto] items-center gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700">${stepper(item, index, 'mobile')}`
      + `<div class="min-w-0 text-center text-[11px] leading-tight">${ideal !== null ? `<div class="truncate font-bold text-orange-500 dark:text-orange-400">${ideal}${T} avail.</div>` : ''}<div class="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">In Stock</div></div>`
      + `<div class="flex items-center gap-1.5 text-right"><div class="leading-tight"><div class="text-[10px] font-medium text-gray-600 dark:text-gray-300">Total</div><div class="text-sm font-bold text-green-600 dark:text-green-400">${money(Number(item.pricePerOrderingUnit ?? item.unitPrice) * Number(item.quantity || 0))}</div></div>`
      + `<button type="button" class="flex h-8 w-8 items-center justify-center rounded-md text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" data-testid="cart-item-remove-btn-mobile-${esc(item._id)}" aria-label="Remove item from cart" title="Remove from cart" data-oc="delete" data-id="${esc(item._id)}">${lucide('Trash2', { cls: 'h-[18px] w-[18px]' })}</button></div></div>${policyRow(item, 'mobile')}</div>`;
  }

  function customerInfo(variant) {
    const c = P.customer;
    if (!c) return '';
    const name = displayName(c);
    const initial = name.length ? name.charAt(0).toUpperCase() : 'C';
    const formatted = titleCase(name) || name || 'Customer';
    const phone = c.phone || c.mobile || c.user?.mobile;
    const email = c.email || c.user?.email;
    if (variant === 'mobile') {
      return `<div class="border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"><div class="flex items-center gap-2.5"><div class="w-8 h-8 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">${esc(initial)}</div><div class="flex-1 min-w-0"><div class="text-sm font-bold text-gray-900 dark:text-white truncate">${esc(formatted)}</div><div class="flex items-center gap-2 mt-0.5">`
        + (phone ? `<span class="text-[11px] text-gray-500 flex items-center gap-1">${lucide('Phone', { cls: 'w-3 h-3' })}${esc(phone)}</span>` : '')
        + (email ? `<span class="text-[11px] text-gray-500 flex items-center gap-1 truncate max-w-[150px]">${lucide('Mail', { cls: 'w-3 h-3 flex-shrink-0' })}${esc(email)}</span>` : '')
        + '</div></div></div></div>';
    }
    return `<div class="px-4 py-3 lg:px-6 lg:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex-shrink-0"><div class="flex items-center gap-2 lg:gap-3"><div class="w-8 h-8 lg:w-10 lg:h-10 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 rounded-full flex items-center justify-center text-xs lg:text-sm font-bold shadow-sm flex-shrink-0">${esc(initial)}</div><div class="flex-1 min-w-0 overflow-hidden"><div class="text-xs lg:text-sm font-bold text-gray-900 dark:text-white truncate">${esc(formatted)}</div><div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 lg:flex-col lg:items-start lg:gap-0.5">`
      + (phone ? `<div class="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">${lucide('Phone', { cls: 'w-2.5 h-2.5 lg:w-3 lg:h-3 flex-shrink-0' })}<span>${esc(phone)}</span></div>` : '')
      + (email ? `<div class="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 min-w-0 max-w-full">${lucide('Mail', { cls: 'w-2.5 h-2.5 lg:w-3 lg:h-3 flex-shrink-0' })}<span class="truncate">${esc(email)}</span></div>` : '')
      + '</div></div></div></div>';
  }

  function summaryDesktop(items, totalUnits) {
    const f = financials(items);
    return '<div class="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden dark:border-gray-700 dark:bg-gray-800">'
      + `<div class="flex items-center justify-between px-4 py-3"><div class="flex min-w-0 items-center gap-3"><span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/25 dark:text-blue-300">${lucide('Package', { cls: 'h-5 w-5' })}</span><div class="min-w-0"><div class="text-sm font-bold text-gray-900 dark:text-white">Total Units</div><div class="text-xs text-gray-500 dark:text-gray-400">Total quantity of items</div></div></div><div class="flex-shrink-0 text-right"><div class="text-base font-bold text-gray-900 dark:text-white">${totalUnits}</div><div class="text-xs font-medium text-gray-500 dark:text-gray-400">units</div></div></div>`
      + `<div class="grid grid-cols-2 gap-x-2 gap-y-2 lg:gap-y-2.5 px-4 py-3 border-t border-dashed border-gray-200 dark:border-gray-700"><div class="text-xs lg:text-sm text-gray-500 dark:text-gray-400">Subtotal</div><div class="text-xs lg:text-sm font-semibold text-gray-900 dark:text-white text-right">${money(f.subtotal)}</div><div class="text-xs lg:text-sm text-gray-500 dark:text-gray-400">Tax</div><div class="text-xs lg:text-sm font-semibold text-gray-900 dark:text-white text-right">${money(f.taxTotal)}</div></div>`
      + `<div class="flex justify-between items-center px-4 py-3 border-t border-dashed border-gray-200 dark:border-gray-700"><div class="text-sm lg:text-base font-bold text-gray-900 dark:text-white">Grand Total</div><div class="text-base lg:text-lg font-bold text-green-600 dark:text-green-400">${money(f.grandTotal)}</div></div></div>`;
  }
  function summaryMobile(items, totalUnits) {
    const f = financials(items);
    const n = items.length;
    return `<div class=""><div class="grid grid-cols-2 divide-x divide-gray-200 border-b border-gray-100 px-3 py-3 dark:divide-gray-700 dark:border-gray-700"><div class="flex items-center justify-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">${lucide('Package', { cls: 'h-4 w-4 text-gray-500 dark:text-gray-400' })}<span>${n}${T} ${T}${n === 1 ? 'Product' : 'Products'}</span></div><div class="flex items-center justify-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">${lucide('ShoppingBag', { cls: 'h-4 w-4 text-gray-500 dark:text-gray-400' })}<span>${totalUnits}${T} Qty</span></div></div>`
      + `<div class="space-y-3 px-3 py-3 text-xs"><div class="flex items-center justify-between text-gray-600 dark:text-gray-400"><span>Subtotal</span><span class="font-medium text-gray-900 dark:text-white">${money(f.subtotal)}</span></div><div class="flex items-center justify-between text-gray-600 dark:text-gray-400"><span>Tax</span><span class="font-medium text-gray-900 dark:text-white">${money(f.taxTotal)}</span></div></div>`
      + `<div class="border-t border-dashed border-gray-300 px-3 py-3 dark:border-gray-600"><div class="flex items-center justify-between"><span class="text-sm font-bold text-gray-900 dark:text-white">Grand Total</span><span class="text-base font-bold text-green-600 dark:text-green-400">${money(f.grandTotal)}</span></div></div></div>`;
  }

  function cartStepper(steps) {
    return `<div class="flex items-center gap-0 flex-shrink-0">${steps.map((step, i) => {
      const done = i < s.currentStep;
      const active = i === s.currentStep;
      return `<div class="flex items-center"><div class="w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${done ? 'bg-green-600 border-green-600 text-white' : active ? 'bg-white dark:bg-gray-800 border-green-500 text-green-600 dark:text-green-400' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500 text-gray-400 dark:text-gray-500'}" title="${esc(STEP_LABELS[step] || step)}">${done ? lucide('Check', { cls: 'w-3 h-3' }) : `<span class="text-[10px] font-bold leading-none">${i + 1}</span>`}</div>`
        + (i < steps.length - 1 ? `<div class="h-px w-5 flex-shrink-0 transition-all ${done ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}"></div>` : '') + '</div>';
    }).join('')}</div>`;
  }

  /** QuantityStepper, disabled: a read-only box for a deleted line. */
  function disabledStepper(value, mobile) {
    const size = mobile ? 'h-10 w-10 text-base' : 'w-10 h-9 text-base';
    return `<div class="flex flex-col"><div class="flex items-center ${mobile ? 'border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-700 opacity-50' : 'border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 opacity-50'}">`
      + `<div class="${size} flex items-center justify-center text-gray-400 dark:text-gray-500 border-r border-gray-200 dark:border-gray-600">−</div>`
      + `<div class="${mobile ? 'h-10 w-[52px] text-base' : 'w-12 h-9 text-sm'} flex items-center justify-center font-bold text-gray-500 dark:text-gray-400 overflow-hidden">${esc(value)}</div>`
      + `<div class="${size} flex items-center justify-center text-green-500 dark:text-green-500 border-l border-gray-200 dark:border-gray-600">+</div></div></div>`;
  }

  /** DeletedItemsTab: struck-through lines, each with a "+" to put it back. */
  function deletedTab() {
    const items = s.deletedItems;
    if (!items.length) {
      return `<div data-testid="cart-deleted-items-empty" class="flex flex-col items-center justify-center lg:py-16 lg:px-6 py-5 px-3"><div class="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">${lucide('RotateCcw', { cls: 'w-10 h-10 text-gray-400 dark:text-gray-500' })}</div><h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No deleted items</h3><p class="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">Items removed from your cart will appear here for easy restoration</p></div>`;
    }
    const price = (it) => Number(it.pricePerOrderingUnit ?? it.unitPrice);
    const mobile = items.map((it) => {
      const rawCat = it.categoryName || it.subName || it.subCategoryName || it.category?.name || it.category;
      const cat = typeof rawCat === 'string' ? rawCat.trim() : rawCat?.en || rawCat?.default || '';
      const unit = it.orderingUnit || it.unit;
      return `<div data-testid="cart-deleted-item-row-mobile-${esc(it._id)}" class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_2px_9px_rgba(15,23,42,0.10)] dark:border-gray-600 dark:bg-gray-800"><div class="flex min-h-[90px] items-start gap-3 px-3 pb-1.5 pt-3 opacity-60"><div class="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 grayscale dark:border-gray-600 dark:bg-gray-700">${displayImage({ size: 72, cls: 'h-full w-full !object-cover rounded-custom' })}</div>`
        + `<div class="flex-1 min-w-0"><div class="truncate text-[15px] font-bold leading-tight text-gray-700 line-through dark:text-gray-300">${esc(it.name)}</div><div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">Art No: ${T}${esc(it.articleNumber || it._id)}</div><div class="mt-2 flex min-w-0 flex-wrap gap-1.5">`
        + (unit ? `<span class="max-w-[78px] truncate rounded-md bg-gray-100 px-2 py-1 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">${esc(unit)}</span>` : '')
        + (cat ? `<span class="max-w-[90px] truncate rounded-md bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-500 dark:bg-violet-900/20 dark:text-violet-400">${esc(cat)}</span>` : '')
        + `</div></div><div class="flex-shrink-0 text-right"><div class="text-[17px] font-bold leading-tight text-gray-600 dark:text-gray-400">${money(price(it))}</div></div></div>`
        + `<div class="grid min-h-[58px] grid-cols-[132px_1fr_auto] items-center gap-2 border-t border-gray-100 px-3 py-2 dark:border-gray-700">${disabledStepper(it.quantity, true)}<div class="text-right leading-tight text-gray-500 dark:text-gray-400"><div class="text-[10px] font-medium">Total</div><div class="text-sm font-bold">${money(price(it) * Number(it.quantity || 0))}</div></div>`
        + `<button type="button" class="flex h-8 w-8 items-center justify-center rounded-md bg-green-50 text-green-600 transition-colors hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40" data-testid="cart-deleted-item-restore-btn-mobile-${esc(it._id)}" aria-label="Add item back to cart" title="Add item back to cart" data-oc="restore" data-id="${esc(it._id)}">${lucide('Plus', { cls: 'h-[18px] w-[18px]' })}</button></div></div>`;
    }).join('');
    const rows = items.map((it) => `<tr data-testid="cart-deleted-item-row-desktop-${esc(it._id)}" class="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors relative bg-gray-50/50 dark:bg-gray-700/30 group">`
      + `<td class="px-5 py-4 align-top relative z-10"><div class="flex items-center gap-3"><div class="w-14 h-14 bg-white dark:bg-gray-700 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200 dark:border-gray-600 opacity-50 grayscale">${displayImage({ size: 56, cls: 'w-full h-full object-cover rounded-custom' })}</div><div class="flex-1 min-w-0"><div class="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate line-through">${esc(it.name)}</div><div class="text-xs text-gray-400 dark:text-gray-500 mt-1">${esc(it.brand || '-')}</div><div class="text-xs text-gray-400 dark:text-gray-500">Art No: ${T}${esc(it.articleNumber || it._id)}</div></div></div></td>`
      + `<td class="px-5 py-4 align-top relative z-10"><div><div class="text-sm font-bold text-gray-500 dark:text-gray-500">${money(price(it))}</div><span class="block text-[11px] text-gray-500 leading-tight">${esc(taxLabel(it.tax))}</span></div><div class="text-xs text-gray-400 dark:text-gray-500">per ${T}${esc(it.orderingUnit || it.unit || 'Unit')}</div></td>`
      + `<td class="px-5 py-4 align-top relative z-10">${disabledStepper(it.quantity, false)}</td>`
      + `<td class="px-5 py-4 align-top relative z-10"><div class="text-base font-bold text-gray-500 dark:text-gray-500">${money(price(it) * Number(it.quantity || 0))}</div></td>`
      + `<td class="px-5 py-4 text-center align-top relative z-10"><button class="p-2.5 text-green-600 dark:text-green-400 hover:text-white dark:hover:text-white bg-green-50 dark:bg-green-900/20 hover:bg-green-600 dark:hover:bg-green-600 rounded-lg transition-all shadow-sm hover:shadow-md border border-green-200 dark:border-green-700 hover:border-green-600" data-testid="cart-deleted-item-restore-btn-desktop-${esc(it._id)}" aria-label="Add item back to cart" title="Add item back to cart" data-oc="restore" data-id="${esc(it._id)}">${lucide('Plus', { cls: 'w-5 h-5' })}</button></td></tr>`).join('');
    return `<div class="block space-y-3 px-1 md:hidden" data-key="deleted-cards">${mobile}</div>`
      + '<div data-key="deleted-table" class="hidden md:grid grid-cols-12 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 max-h-[500px]"><table class="min-w-full text-sm text-gray-700 dark:text-gray-300 col-span-12"><thead class="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10"><tr><th class="text-left px-5 py-3 font-semibold uppercase text-xs w-4/12">Product</th><th class="text-left px-5 py-3 font-semibold uppercase text-xs w-2/12">Price</th><th class="text-left px-5 py-3 font-semibold uppercase text-xs w-2/12">Quantity</th><th class="text-left px-5 py-3 font-semibold uppercase text-xs w-2/12">Total</th><th class="text-center px-5 py-3 font-semibold uppercase text-xs w-2/12">Action</th></tr></thead>'
      + `<tbody class="divide-y divide-gray-200 dark:divide-gray-700">${rows}</tbody></table></div>`;
  }

  function render() {
    P = props();
    if (P.open) s.wasOpen = true;
    else if (s.wasOpen) { // production's reset-on-close effect
      s.wasOpen = false; s.deletedItems = []; s.mobileSummaryExpanded = false; s.sidebarView = 'summary'; s.currentStep = 0;
      Object.assign(s, splitDefaults());
    }
    // The payable total changed (a quantity, a line): the split goes back to an equal split.
    const payable = financials(P.cartItems.filter((i) => Number(i.quantity) > 0)).grandTotal;
    if (payable !== s.prevTotal) {
      s.prevTotal = payable;
      if (s.isSplitMode && s.splitSelected.length) { s.splitAmounts = equalSplit(s.splitSelected, payable); s.splitManual = new Set(); }
    }
    if (!P.open) return '';
    const steps = P.checkoutSteps;
    const items = visible();
    const totalUnits = P.totalUnits;
    const onLast = s.currentStep === steps.length - 1;
    const label = onLast ? 'Place Order' : 'NEXT →';
    // A policy activation turned on needs the buyer's email first.
    const invalidPolicy = Object.values(P.policyActivationRequests || {}).some((r) => r.enabled && !r.email.trim());
    const disabled = items.length === 0 || invalidPolicy;
    const onPayment = steps[s.currentStep] === 'payment';
    const title = items.length === 0 ? 'Add items to cart to confirm order'
      : invalidPolicy ? 'Please provide email for policy activation links'
      : onPayment && s.isSplitMode && s.splitSelected.length === 0 ? 'Select at least one payment method'
        : !onLast ? 'Proceed to next step'
          : onPayment && !s.isSplitMode && !s.selectedMethod ? 'Select a payment method to confirm' : 'Confirm and place order';

    let left;
    if (s.currentStep === 0) {
      const body = s.activeTab === 'cart'
        ? (items.length === 0
          ? `<div data-testid="order-cart-empty" class="flex flex-col items-center justify-center lg:py-16 lg:px-6 py-5 px-3"><div class="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">${lucide('ShoppingCart', { cls: 'w-10 h-10 text-gray-400 dark:text-gray-500' })}</div><h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Your cart is empty</h3><p class="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">Add products to start building your order.</p><div class="mt-5"><button type="button" data-testid="order-cart-browse-products-btn" class="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl shadow transition-colors" data-oc="close">Browse Products</button></div></div>`
          : `<div class="block md:hidden space-y-3 px-1" data-key="cart-cards">${items.map(mobileCard).join('')}</div>`
            + '<div data-key="cart-table" class="hidden md:grid grid-cols-12 overflow-x-auto overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 max-h-[500px]"><table class="min-w-full text-sm text-gray-700 dark:text-gray-300 col-span-12"><thead class="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10"><tr><th class="text-left px-5 py-3 font-semibold uppercase text-xs w-4/12">Product</th><th class="text-left px-5 py-3 font-semibold uppercase text-xs w-2/12">Price</th><th class="text-center px-5 py-3 font-semibold uppercase text-xs w-3/12">Quantity</th><th class="text-left px-5 py-3 font-semibold uppercase text-xs w-2/12">Total</th><th class="text-center px-5 py-3 font-semibold uppercase text-xs w-1/12">Action</th></tr></thead>'
            + `<tbody class="divide-y divide-gray-200 dark:divide-gray-700">${items.map(desktopRow).join('')}</tbody></table></div>`)
        : deletedTab();
      left = '<div class="order-cart-tabs-sticky mb-2 lg:mb-4 lg:flex-shrink-0"><div class="flex items-center gap-2 overflow-x-auto py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&amp;::-webkit-scrollbar]:hidden lg:overflow-visible lg:flex-wrap">'
        + tab(s.activeTab === 'cart', 'Cart Items', 'order-cart-tab-cart', 'tab-cart') + tab(s.activeTab === 'deleted', 'Deleted Items', 'order-cart-tab-deleted', 'tab-deleted')
        + `</div></div><div class="order-cart-tab-content md:bg-white md:dark:bg-gray-800 md:rounded-xl md:border md:border-gray-200 md:dark:border-gray-700 overflow-hidden md:shadow-sm">${body}</div>`;
    } else {
      left = `<div class="md:bg-white md:dark:bg-gray-800 md:rounded-xl md:border md:border-gray-200 md:dark:border-gray-700 md:shadow-sm overflow-hidden flex flex-col h-full"><div class="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex-shrink-0"><h3 class="text-base font-semibold text-gray-900 dark:text-white">Choose Payment Method</h3><p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Select how you'd like to pay for this order</p></div><div class="flex-1 min-h-0">${paymentStep(s.prevTotal)}</div></div>`;
    }

    const sideHeader = `<div class="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 px-4 py-3 lg:px-5 lg:py-3 border-b border-gray-200 dark:border-gray-600 flex-shrink-0"><div class="flex items-center justify-between gap-2"><div class="flex items-center gap-2 min-w-0">`
      + (s.currentStep > 0 && s.sidebarView === 'summary' ? `<button data-testid="order-cart-step-back-btn" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex-shrink-0" aria-label="Back" data-oc="step-back">${lucide('ChevronLeft', { cls: 'w-4 h-4 text-gray-600 dark:text-gray-300' })}</button>`
        : s.sidebarView !== 'summary' ? `<button data-testid="order-cart-sidebar-back-btn" class="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex-shrink-0" aria-label="Back" data-oc="view-summary">${lucide('ChevronLeft', { cls: 'w-4 h-4 text-gray-600 dark:text-gray-300' })}</button>` : '')
      + `<div class="text-sm font-bold text-gray-900 dark:text-white truncate">${s.sidebarView === 'comment' ? 'Add Comment' : `${esc(P.ordersLabel)} Summary`}</div></div>`
      + (steps.length > 1 && s.sidebarView === 'summary' ? cartStepper(steps) : '') + '</div></div>';

    const summaryView = s.sidebarView !== 'summary' ? '' : `<div class="flex flex-col flex-1">${customerInfo('desktop')}<div class="px-4 py-3 lg:px-6 lg:py-4">${summaryDesktop(items, totalUnits)}</div>`
      + (s.currentStep === 0 ? `<div class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 lg:px-6 lg:py-4 space-y-2 lg:space-y-3 flex-shrink-0"><div data-testid="order-cart-comment-card" class="flex items-center justify-between px-3 py-2 lg:p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all" data-oc="view-comment"><div class="flex items-center gap-2">${lucide('MessageSquare', { cls: 'w-3.5 h-3.5 lg:w-4 lg:h-4 text-gray-500 dark:text-gray-400' })}<span class="text-xs lg:text-sm font-medium text-gray-700 dark:text-gray-300">${P.comment ? 'Comment Added' : 'Add Comment'}</span></div>${P.comment ? `<span class="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400 truncate max-w-[100px]">${esc(P.comment)}</span>` : ''}</div></div>` : '')
      + '<div class="border-t border-gray-200 dark:border-gray-700 px-4 py-3 lg:px-6 lg:py-4 flex-shrink-0">'
      + (P.isLoading ? '<button disabled="" data-testid="order-cart-confirm-btn-loading" class="h-12 w-full bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-base shadow-md hover:shadow-lg transition-all" title="hold on while your order is being placed" aria-label="Confirm order">CREATING ORDER...</button>'
        : `<button data-testid="order-cart-confirm-btn" class="h-12 w-full bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-base shadow-md hover:shadow-lg transition-all"${disabled ? ' disabled=""' : ''} title="${esc(title)}" aria-label="${esc(label)}" data-oc="confirm">${esc(label)}</button>${items.length === 0 ? '<p class="text-xs text-center text-gray-400 mt-2">Add at least one product to place an order</p>' : ''}`)
      + '</div></div>';
    const commentView = s.currentStep === 0 && s.sidebarView === 'comment'
      ? `<div class="flex flex-col" style="min-height: inherit;"><div class="flex-1 px-6 py-4 min-h-[300px]"><p class="text-sm text-gray-600 dark:text-gray-400 mb-3">Add a note to your order (e.g., delivery instructions, special requests)</p><textarea data-testid="order-cart-comment-input" class="w-full h-32 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none" placeholder="E.g. Handle with care, Deliver before 5 PM..." data-oc-comment>${esc(P.comment)}</textarea></div><div class="border-t border-gray-200 dark:border-gray-700 px-6 py-4 mt-auto"><button data-testid="order-cart-comment-done-btn" class="h-12 w-full bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-base shadow-md hover:shadow-lg transition-all" data-oc="view-summary">Done</button></div></div>` : '';

    const content = `<style>${STYLE}</style>`
      + `<button class="absolute right-2 w-8 h-8 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full flex items-center justify-center transition-colors hover:scale-110 active:scale-95 z-50" style="top: 0.5rem;" aria-label="Close cart" title="Close" data-testid="order-cart-close-btn" data-oc="close">${lucide('X', { cls: 'w-4 h-4' })}</button>`
      + `<div class="order-cart-inner w-full flex flex-col gap-3 flex-1 min-h-0 md:overflow-y-auto"><div class="order-cart-product-list flex-1 min-w-0">${left}</div>`
      + `<div class="order-cart-summary-desktop hidden md:block w-full"><div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-md overflow-hidden lg:sticky lg:top-0 flex flex-col">${sideHeader}${summaryView}${commentView}</div></div></div>`
      + mobileBar(items, totalUnits, label, disabled, title);
    return customModal({ size: 'other', hideCloseButton: true, testId: 'order-cart', content });
  }

  function mobileBar(items, totalUnits, label, disabled, title) {
    const ex = s.mobileSummaryExpanded;
    let expanded = '';
    if (ex) {
      if (s.currentStep > 0) expanded = `<div class="px- py-3"><div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">${customerInfo('mobile')}${summaryMobile(items, totalUnits)}</div></div>`;
      else if (s.sidebarView === 'comment') expanded = `<div><div class="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600"><span class="text-sm font-bold text-gray-900 dark:text-white">Add Comment</span><button class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" aria-label="Close add comment" data-testid="mobile-summary-subview-close-btn" data-oc="view-summary">${lucide('ChevronDown', { cls: 'w-4 h-4 text-gray-600 dark:text-gray-300' })}</button></div><div class="px-4 py-3"><p class="text-xs text-gray-600 dark:text-gray-400 mb-2">Add a note to your order</p><textarea data-testid="mobile-summary-comment-input" class="w-full h-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none" placeholder="E.g. Handle with care, Deliver before 5 PM..." data-oc-comment>${esc(P.comment)}</textarea></div><div class="px-4 py-2.5 border-t border-gray-200 dark:border-gray-700"><button data-testid="mobile-summary-subview-done-btn" class="h-10 w-full bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm shadow-md transition-all" data-oc="view-summary">Done</button></div></div>`;
      else expanded = `<div><div class="px-1 py-2"><div class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">${customerInfo('mobile')}${summaryMobile(items, totalUnits)}<div class="p-2 "><div data-testid="mobile-summary-comment-card" class="w-full flex cursor-pointer items-center justify-between rounded-lg border border-gray-200 px-2.5 py-2 transition-all hover:border-green-500 hover:bg-green-50 dark:border-gray-700 dark:hover:bg-green-900/10" data-oc="view-comment"><div class="flex items-center gap-2">${lucide('MessageSquare', { cls: 'h-3.5 w-3.5 text-gray-500 dark:text-gray-400' })}<span class="text-xs font-medium text-gray-700 dark:text-gray-300">${P.comment ? 'Comment Added' : 'Add Comment'}</span></div>${P.comment ? `<span class="max-w-[60px] truncate text-[10px] text-gray-500">${esc(P.comment)}</span>` : ''}</div></div></div></div></div>`;
    }
    const back = s.currentStep > 0;
    return `<div class="md:hidden flex-shrink-0 bg-white dark:bg-gray-800 z-30">${ex ? `<div class="max-h-[55vh] overflow-y-auto">${expanded}</div>` : ''}`
      + `<div class="px-1 py-2 space-y-2"><button data-testid="mobile-summary-expand-toggle" data-status="${ex ? 'expanded' : 'collapsed'}" class="w-full flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors" data-oc="expand"><div class="flex items-center gap-2">${lucide('ShoppingCart', { cls: 'w-4 h-4 text-green-600' })}<span class="text-sm font-bold text-gray-900 dark:text-white">Order Summary</span></div>${lucide(ex ? 'ChevronDown' : 'ChevronUp', { cls: 'w-4 h-4 text-gray-500 dark:text-gray-400' })}</button>`
      + (!(ex && s.sidebarView !== 'summary') ? `<div class="flex items-stretch gap-1.5"><button class="h-11 flex items-center justify-center px-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg transition-all flex-shrink-0" aria-label="${back ? 'Back to previous step' : 'Back to products'}" title="${back ? 'Back' : 'Back to products'}" data-testid="mobile-summary-back-btn" data-oc="${back ? 'step-back' : 'close'}">${lucide('ChevronLeft', { cls: 'w-4 h-4' })}</button>`
        + (P.isLoading ? '<button disabled="" class="h-11 flex-1 bg-green-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed font-bold text-sm shadow-md transition-all" title="Hold on while your order is being placed" aria-label="Confirm order" data-testid="mobile-summary-confirm-btn-loading">CREATING ORDER...</button>'
          : `<div class="grid min-w-0 flex-1 gap-1.5 grid-cols-1"><button class="h-11 min-w-0 whitespace-nowrap rounded-lg bg-green-600 px-2 text-xs font-bold text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-300"${disabled ? ' disabled=""' : ''} title="${esc(title)}" aria-label="${esc(label)}" data-testid="mobile-summary-confirm-btn" data-oc="confirm">${esc(label)}</button></div>`)
        + '</div>' : '')
      + '</div></div>';
  }

  // ── PaymentStep (cart/PaymentStep.jsx) — the buyer pays for themselves, so no split toggle ──
  const METHOD_ICONS = { pod: 'Truck', cash: 'Truck', credits: 'Wallet', upi: 'Smartphone', QR: 'QrCode', stripe: 'CreditCard', razorpay: 'CreditCard', payOnline: 'CreditCard', neft: 'CreditCard', cheque: 'CreditCard' };
  const METHOD_META = {
    pod: { subtitle: 'Pay in cash upon delivery', inputLabel: 'Cash amount' },
    cash: { subtitle: 'Pay in cash', inputLabel: 'Cash amount' },
    credits: { subtitle: 'Deducted from buyer’s store credit balance', inputLabel: 'Credits to use', badge: 'Instant', badgeStyle: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
    upi: { subtitle: 'GPay · PhonePe · Paytm', inputLabel: 'UPI amount' },
    QR: { subtitle: 'Scan QR code to complete payment', inputLabel: 'QR amount' },
    stripe: { subtitle: 'Secure card payment via Stripe', inputLabel: 'Card amount', badge: 'Recommended', badgeStyle: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    razorpay: { subtitle: 'UPI, cards & netbanking via Razorpay', inputLabel: 'Amount', badge: 'Recommended', badgeStyle: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    payOnline: { subtitle: 'Cards, UPI, netbanking & wallets', inputLabel: 'Amount', badge: 'Online', badgeStyle: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
    neft: { subtitle: 'Bank transfer (NEFT / RTGS / IMPS)', inputLabel: 'Transfer amount' },
    cheque: { subtitle: 'Pay by cheque', inputLabel: 'Cheque amount' },
  };
  const fmtAmount = (v) => roundMoney(v).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const inputAmount = (v) => { if (v === '') return ''; if (typeof v === 'string') return v; const r = roundMoney(v); return Number.isInteger(r) ? String(r) : r.toFixed(2); };
  const cur3 = (v) => `${esc(currency)}${T}${NB}${T}${esc(fmtAmount(v))}`;

  function paymentStep(totalPrice) {
    const methods = host.getActivePaymentMethods();
    if (!methods.length) return '';
    const allocated = roundMoney(s.splitSelected.reduce((sum, id) => sum + (Number(s.splitAmounts[id]) || 0), 0));
    const remaining = roundMoney(totalPrice - allocated);
    const valid = s.splitSelected.length > 0 && allocated >= totalPrice - 0.01;
    const pct = totalPrice > 0 ? Math.min(100, (allocated / totalPrice) * 100) : 0;
    const previous = 0; // orgOutstanding is only fetched on the admin (customer-order) path
    const orderTotal = roundMoney(totalPrice);
    const paidNow = roundMoney(s.isSplitMode ? allocated : orderTotal);
    const pending = roundMoney(Math.max(0, orderTotal - paidNow));
    const projected = Math.round((previous + orderTotal - paidNow) * 100) / 100;
    const outstanding = Math.max(0, projected);
    const surplus = Math.max(0, Math.abs(Math.min(0, projected)));
    const tone = surplus > 0 ? 'emerald' : outstanding > 0 ? 'amber' : 'emerald';

    const strip = '<div class="mx-5 mt-4 grid grid-cols-3 gap-2 flex-shrink-0">'
      + `<div class="rounded-xl border px-3 py-2.5 text-center ${previous > 0 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/50' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'}"><div class="text-[9px] font-bold uppercase tracking-widest mb-1 ${previous > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400 dark:text-gray-500'}">Previous Outstanding</div><div class="text-sm font-bold text-gray-800 dark:text-gray-100 tabular-nums">${cur3(previous)}</div><div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Before this order</div></div>`
      + `<div class="rounded-xl bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-700/50 px-3 py-2.5 text-center"><div class="text-[9px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest mb-1">This Order</div><div class="text-sm font-bold text-sky-700 dark:text-sky-300 tabular-nums">${cur3(orderTotal)}</div><div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">${esc(pending > 0 ? `${currency}${NB}${fmtAmount(pending)} pending` : `${currency}${NB}${fmtAmount(paidNow)} paid now`)}</div></div>`
      + `<div class="rounded-xl border px-3 py-2.5 text-center bg-${tone}-50 dark:bg-${tone}-900/20 border-${tone}-200 dark:border-${tone}-700/50"><div class="text-[9px] font-bold uppercase tracking-widest mb-1 text-${tone}-600 dark:text-${tone}-400">${surplus > 0 ? 'Advance' : outstanding > 0 ? 'Total Outstanding' : 'Balance'}</div>`
      + `<div class="text-sm font-bold tabular-nums text-${tone}-700 dark:text-${tone}-300">${surplus > 0 ? esc(`+${currency}${NB}${fmtAmount(surplus)}`) : outstanding > 0 ? esc(`${currency}${NB}${fmtAmount(outstanding)}`) : '<span class="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Settled</span>'}</div>`
      + `<div class="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">${surplus > 0 ? 'Advance after this order' : outstanding > 0 ? 'After this order' : 'Fully settled'}</div></div></div>`;

    const list = methods.map((m) => {
      const meta = METHOD_META[m.id] || { subtitle: null, inputLabel: 'Amount' };
      const selSplit = s.isSplitMode && s.splitSelected.includes(m.id);
      const selSingle = !s.isSplitMode && s.selectedMethod === m.id;
      const sel = s.isSplitMode ? selSplit : selSingle;
      const subtitle = meta.subtitle || (m.hasIntegration ? `Processed by ${m.provider}` : null);
      const amt = s.splitAmounts[m.id] === '' ? '' : inputAmount(s.splitAmounts[m.id]);
      const card = `<button type="button" aria-disabled="false" data-testid="payment-step-method-${esc(m.id)}" data-status="${sel ? 'selected' : 'unselected'}" class="${['w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all duration-150 group', sel ? (s.isSplitMode ? 'border-purple-400 bg-purple-50 dark:bg-purple-900/20 shadow-sm ring-1 ring-purple-400/30' : 'border-green-500 bg-green-50 dark:bg-green-900/20 shadow-sm ring-1 ring-green-500/30') : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'].join(' ')}" data-oc="pay-method" data-method="${esc(m.id)}">`
        + `<div class="${['w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors', sel ? (s.isSplitMode ? 'bg-purple-100 dark:bg-purple-800/50' : 'bg-green-100 dark:bg-green-800/50') : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'].join(' ')}">${lucide(METHOD_ICONS[m.id] || 'CreditCard', { cls: `w-4 h-4 ${sel ? (s.isSplitMode ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400') : 'text-gray-500 dark:text-gray-400'}` })}</div>`
        + `<div class="flex-1 min-w-0"><div class="flex items-center gap-1.5 flex-wrap"><span class="text-sm font-semibold leading-tight ${sel ? (s.isSplitMode ? 'text-purple-700 dark:text-purple-300' : 'text-green-700 dark:text-green-300') : 'text-gray-800 dark:text-gray-100'}">${esc(m.label)}</span>${meta.badge ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${meta.badgeStyle}">${esc(meta.badge)}</span>` : ''}</div>${subtitle ? `<p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">${esc(subtitle)}</p>` : ''}</div>`
        + (s.isSplitMode
          ? `<div class="${['w-4.5 h-4.5 w-[18px] h-[18px] rounded border-2 flex-shrink-0 flex items-center justify-center transition-all', selSplit ? 'border-purple-500 bg-purple-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'].join(' ')}">${selSplit ? lucide('CheckCircle2', { cls: 'w-3 h-3 text-white', strokeWidth: 3 }) : ''}</div>`
          : `<div class="${['w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all', selSingle ? 'border-green-500 bg-green-500' : 'border-gray-300 dark:border-gray-600'].join(' ')}">${selSingle ? lucide('CheckCircle2', { cls: 'w-3.5 h-3.5 text-white', strokeWidth: 2.5 }) : ''}</div>`)
        + '</button>';
      const input = selSplit ? `<div class="mx-0.5 px-3.5 pb-3 pt-0 -mt-1 rounded-b-xl border-x border-b border-purple-200 dark:border-purple-700/50 bg-purple-50/60 dark:bg-purple-900/10"><div class="flex items-center gap-2 mt-2.5 mb-1"><span class="text-[11px] text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0">${esc(meta.inputLabel)}</span><div class="relative flex-1"><span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 font-medium pointer-events-none select-none">${esc(currency)}</span><input type="number" inputmode="decimal" min="0" step="1" placeholder="0" data-testid="payment-step-split-amount-input-${esc(m.id)}" class="w-full pl-7 pr-3 py-1.5 text-sm font-semibold rounded-lg border border-purple-200 dark:border-purple-700/60 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-400 dark:focus:ring-purple-500 transition [appearance:textfield] [&amp;::-webkit-outer-spin-button]:appearance-none [&amp;::-webkit-inner-spin-button]:appearance-none" value="${esc(amt)}" data-oc-split="${esc(m.id)}"></div></div></div>` : '';
      return `<div>${card}${input}</div>`;
    }).join('');

    const bar = s.isSplitMode && s.splitSelected.length > 0
      ? `<div class="mx-5 mb-3 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 flex-shrink-0"><div class="flex items-center justify-between mb-1.5"><span class="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Allocated</span><span class="text-xs font-bold tabular-nums ${valid ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-200'}">${cur3(allocated)}<span class="font-normal text-gray-400 dark:text-gray-500 mx-1">/</span>${cur3(totalPrice)}</span></div>`
        + `<div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-2"><div class="h-full rounded-full transition-all duration-300 ${valid ? 'bg-green-500' : 'bg-purple-500'}" style="width: ${pct}%;"></div></div>`
        + `<div class="flex items-center justify-between"><span class="text-[11px] font-medium ${valid ? 'text-green-600 dark:text-green-400' : allocated > 0.01 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-gray-400'}">${esc(valid ? '✓ Fully allocated' : allocated > 0.01 ? `⚠ Partial — ${currency}${NB}${fmtAmount(remaining)} remaining` : `Remaining: ${currency}${NB}${fmtAmount(remaining)}`)}</span><button type="button" data-testid="payment-step-equal-split-btn" class="flex items-center gap-1 text-[11px] text-gray-400 hover:text-purple-600 dark:text-gray-500 dark:hover:text-purple-400 transition-colors" data-oc="pay-equal">${lucide('RotateCcw', { cls: 'w-3 h-3' })}Equal split</button></div></div>`
      : '';

    return `<div class="flex flex-col h-full">${strip}<div class="flex-1 min-h-0 px-5 py-3 space-y-2 overflow-y-auto [&amp;::-webkit-scrollbar]:hidden [scrollbar-width:none] [-ms-overflow-style:none]">${list}</div>${bar}`
      + `<div class="px-5 py-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center gap-1.5 flex-shrink-0">${lucide('ShieldCheck', { cls: 'w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0' })}<span class="text-[11px] text-gray-400 dark:text-gray-500">All transactions are secured and encrypted</span></div></div>`;
  }

  // ── Events (routed from the drawer) ──
  function handleClick(e) {
    const el = e.target.closest('[data-oc]');
    if (!el || !P?.open) return false;
    const id = el.dataset.id;
    const item = () => P.cartItems.find((i) => i._id === id);
    switch (el.dataset.oc) {
      case 'close': P.onClose(); return true;
      case 'tab-cart': s.activeTab = 'cart'; break;
      case 'tab-deleted': s.activeTab = 'deleted'; break;
      case 'delete': { const it = visible().find((i) => i._id === id); s.deletedItems = [...s.deletedItems, it]; P.onDelete(it); break; }
      case 'restore': { const it = s.deletedItems.find((i) => i._id === id); s.deletedItems = s.deletedItems.filter((i) => i._id !== id); P.onRestore(it); break; }
      case 'inc': { const it = item(); const cur = Number(P.tempQuantities[qtyKey(it)] ?? it.quantity ?? 0); setQty(it, String(cur + 1)); return true; }
      case 'dec': { const it = item(); const cur = Number(P.tempQuantities[qtyKey(it)] ?? it.quantity ?? 0); if (cur > 1) setQty(it, String(cur - 1)); return true; }
      case 'policy-toggle': P.onPolicyToggle?.(id); break;
      case 'view-comment': s.sidebarView = 'comment'; break;
      case 'view-summary': s.sidebarView = 'summary'; break;
      case 'expand': s.mobileSummaryExpanded = !s.mobileSummaryExpanded; break;
      case 'step-back': s.currentStep = Math.max(0, s.currentStep - 1); s.sidebarView = 'summary'; break;
      case 'pay-method':
        if (s.isSplitMode) {
          const m = el.dataset.method;
          if (s.splitSelected.includes(m)) { s.splitSelected = s.splitSelected.filter((x) => x !== m); const next = { ...s.splitAmounts }; delete next[m]; s.splitAmounts = next; }
          else { s.splitSelected = [...s.splitSelected, m]; s.splitAmounts = { ...s.splitAmounts, [m]: 0 }; }
          s.splitManual = new Set();
        } else s.selectedMethod = el.dataset.method;
        break;
      case 'pay-equal': s.splitAmounts = equalSplit(s.splitSelected, s.prevTotal); s.splitManual = new Set(); break;
      case 'confirm':
        if (s.currentStep < P.checkoutSteps.length - 1) { s.sidebarView = 'summary'; s.currentStep += 1; break; }
        P.onConfirm(s.deletedItems.map((i) => i._id), {
          comment: P.comment,
          policyActivationRequests: P.policyActivationRequests || {},
          paymentMethod: s.isSplitMode && s.splitSelected.length > 1 ? 'split' : s.isSplitMode && s.splitSelected.length === 1 ? s.splitSelected[0] : s.selectedMethod,
        });
        return true;
      default: return false;
    }
    rerender();
    return true;
  }
  function handleInput(e) {
    const el = e.target;
    if (el.matches('[data-oc-policy-email]') && P?.open) { P.onPolicyEmail?.(el.dataset.ocPolicyEmail, el.value); rerender(); return true; }
    if (el.matches('[data-oc-split]')) {
      const value = el.value;
      if (!/^\d*\.?\d{0,2}$/.test(value)) { rerender(); return true; }
      const id = el.dataset.ocSplit;
      const r = autoBalance({ changedId: id, newAmount: roundMoney(Math.max(0, Number(value) || 0)), total: s.prevTotal, selectedIds: s.splitSelected, manuallySet: s.splitManual, currentAmounts: s.splitAmounts });
      r.amounts[id] = value;
      s.splitAmounts = r.amounts; s.splitManual = r.manuallySet; rerender(); return true;
    }
    if (el.matches('[data-oc-comment]')) { P.setComment(el.value); rerender(); return true; }
    if (el.matches('[data-oc-qty]')) { setQty(P.cartItems.find((i) => i._id === el.dataset.ocQty), el.value); return true; }
    return false;
  }
  function handleKeydown(e) {
    const el = e.target;
    if (!el.matches('[data-oc-qty]')) return false;
    const index = Number(el.dataset.index);
    let target = null;
    if (e.key === 'ArrowUp') { e.preventDefault(); target = index - 1; } else if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); target = index + 1; }
    if (target !== null) {
      const n = [document.getElementById(`cart-qty-input-desktop-${target}`), document.getElementById(`cart-qty-input-mobile-${target}`)].find((x) => x && x.offsetParent !== null);
      if (n) { n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); n.focus(); setTimeout(() => n.select(), 0); }
    }
    return true;
  }
  // A blurred, emptied quantity: the desktop row removes the line, the phone card puts back 1.
  document.addEventListener('focusout', (e) => {
    const el = e.target;
    if (!P?.open || !el.matches?.('[data-oc-qty]')) return;
    const it = P.cartItems.find((i) => i._id === el.dataset.ocQty);
    if (!it) return;
    if (el.value) setQty(it, el.value);
    else if (el.dataset.variant === 'desktop') { s.deletedItems = [...s.deletedItems, it]; P.onDelete(it); rerender(); } else setQty(it, '1');
  }, true);

  return {
    render,
    afterRender() {},
    handleClick, handleInput, handleKeydown,
    reset() { s = fresh(); P = null; },
  };
}

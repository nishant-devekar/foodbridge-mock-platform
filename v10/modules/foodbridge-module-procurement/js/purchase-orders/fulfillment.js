/*
  The panel a desktop row expands into: OrderFulfillmentMetadata for a purchase order (not a batch),
  which has two tabs — Details and Items. The Details tab's comment is the most recent human stage
  comment, else the creation comment; the host's machine-written comments (COMMENT_PREFIX) are never
  shown. The Status pill is the module's Status (a Windmill Badge in the host theme).
*/
import { esc } from '../components/dom.js';
import { fi } from '../components/icons.js';

const T = '<!---->';
const COMMENT_PREFIX = 'shippingAddressUpdate::';

// Status.jsx's table, and the host theme's Windmill Badge classes (myTheme.badge).
const STATUS_TYPES = {
  warning: ['Pending', 'Inactive', 'Waiting for Password Reset'],
  primary: ['Processing', 'InProgress'],
  success: ['Delivered', 'Active', 'Partial Delivered', 'InDelivery'],
  danger: ['Cancel', 'Cancelled', 'OnHold', 'On-Hold', 'NotAccepted'],
  teal: ['Completed'],
};
const BADGE = {
  base: 'inline-flex px-2 text-xs font-medium leading-5 rounded-full',
  success: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-800 dark:text-emerald-100',
  danger: 'text-red-500 bg-red-100 dark:text-red-100 dark:bg-red-800',
  warning: 'text-yellow-600 bg-yellow-100 dark:text-white dark:bg-yellow-600',
  neutral: 'text-gray-500 bg-gray-100 dark:text-gray-100 dark:bg-gray-800',
  primary: 'text-blue-500 bg-blue-100 dark:text-white dark:bg-blue-800',
};
export function statusBadge(status) {
  let type = 'neutral';
  for (const [t, list] of Object.entries(STATUS_TYPES)) if (list.includes(status)) type = t;
  // 'teal' is not a Windmill badge type: only the base, plus Status.jsx's className override.
  const classes = type === 'teal' ? `${BADGE.base} dark:bg-teal-900 bg-teal-100` : `${BADGE.base} ${BADGE[type]}`;
  return `<span class="${classes}">${esc(status)}</span>`;
}

const label = (t) => `<p class="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">${t}</p>`;

function details(order, seller, copied) {
  const name = seller?.name || order.supplierName || 'N/A';
  const phone = seller?.phone || order.supplierPhone || seller?.contact || null;
  const email = seller?.email || order.supplierEmail || null;
  const external = seller?._sourceType === 'externalSupplier' || Boolean(order.supplier_id);
  const top = typeof order.comments === 'string' ? order.comments.trim()
    : Array.isArray(order.comments) && order.comments.length ? order.comments.map((c) => c.text || c.message).join('\n\n') : '';
  const stage = (order.stageAudit || []).filter((a) => !(typeof a?.comment === 'string' && a.comment.startsWith(COMMENT_PREFIX)));
  const recent = [...stage].reverse().map((a) => a?.comment?.trim() || '').find(Boolean) || '';
  const comment = recent || top;
  const number = order.order_number || order.invoice;
  const date = (d) => new Date(d).toLocaleDateString();
  return `<div class="space-y-5">`
    + (external ? `<div class="flex items-start gap-2.5 pl-3 border-l-2 border-amber-400">${fi('FiAlertCircle', { cls: 'w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5' })}<p class="text-xs text-slate-600 leading-relaxed"><span class="font-semibold text-amber-700">PO${T} shared outside system.</span>${T} ${T}Manual follow-up required — status won't sync automatically with this supplier.</p></div>` : '')
    + `<div class="grid grid-cols-2 gap-x-8 gap-y-3">`
    + `<div>${label(`PO${T} Number`)}<div class="flex items-center gap-1.5"><span class="text-sm font-mono font-semibold text-slate-800">${esc(number)}</span><button data-testid="order-fulfillment-copy-number-btn-${order._id}" class="p-0.5 rounded hover:bg-slate-100 transition-colors" title="Copy PO Number" data-act="fulfillment-copy" data-value="${esc(number)}">${copied === number ? fi('FiCheck', { cls: 'w-3 h-3 text-emerald-500' }) : fi('FiCopy', { cls: 'w-3 h-3 text-slate-400' })}</button></div></div>`
    + `<div>${label('Status')}${statusBadge(order.status)}</div>`
    + `<div>${label('Order Date')}<span class="text-sm text-slate-800">${order.created_date ? date(order.created_date) : 'N/A'}</span></div>`
    + (order.expected_delivery_date ? `<div>${label('Expected Delivery')}<span class="text-sm text-slate-800">${date(order.expected_delivery_date)}</span></div>` : '')
    + (order.metaData?.voucherNumber ? `<div>${label('Voucher Number')}<span class="text-sm text-slate-800">${esc(order.metaData.voucherNumber)}</span></div>` : '')
    + (order.metaData?.receivedDate ? `<div>${label('Received Date')}<span class="text-sm text-slate-800">${date(order.metaData.receivedDate)}</span></div>` : '')
    + `</div>`
    + `<div class="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-3 py-2.5 rounded-lg border border-slate-100 bg-slate-50">`
    + `<div class="flex items-center gap-1.5">${fi('FiUser', { cls: 'w-3 h-3 text-slate-400 flex-shrink-0' })}<span class="text-xs font-medium text-slate-800">${esc(name)}</span></div>`
    + (phone ? `<div class="flex items-center gap-1.5">${fi('FiPhone', { cls: 'w-3 h-3 text-slate-400 flex-shrink-0' })}<a href="tel:${esc(phone)}" class="text-xs text-slate-700 hover:text-blue-600 transition-colors">${esc(phone)}</a></div>` : '')
    + (email ? `<div class="flex items-center gap-1.5">${fi('FiMail', { cls: 'w-3 h-3 text-slate-400 flex-shrink-0' })}<a href="mailto:${esc(email)}" class="text-xs text-slate-700 hover:text-blue-600 transition-colors">${esc(email)}</a></div>` : '')
    + (order.paymentTerms ? `<div class="flex items-center gap-1.5"><span class="text-xs text-slate-400">Terms:</span><span class="text-xs font-medium text-slate-700">${esc(order.paymentTerms)}</span></div>` : '')
    + `</div>`
    + `<div><p class="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-1.5">Notes / Comments</p>`
    + (comment ? `<p class="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">${esc(comment)}</p>` : '<p class="text-xs text-slate-400 italic">No notes added.</p>')
    + `</div></div>`;
}

function items(order) {
  const list = order.item_list || [];
  if (!list.length) return `<div><div data-testid="order-fulfillment-items-empty-${order._id}" class="py-8 text-center text-sm text-slate-500">No items found</div></div>`;
  return `<div><div class="space-y-2">${list.map((it, i) => `<div data-testid="order-fulfillment-item-row-${order._id}-${esc(it._id || it.articleNumber || i)}" class="border border-slate-200 rounded p-2 hover:bg-slate-50 transition-colors"><div class="flex items-center gap-3"><div class="flex-1 min-w-0"><h4 class="text-sm font-medium text-slate-900 truncate">${esc(it.name)}</h4>${it.articleNumber ? `<p class="text-xs text-slate-500">Art no: ${T}${esc(it.articleNumber)}</p>` : ''}</div><div class="flex-shrink-0 text-right"><span class="text-sm font-medium text-slate-900">${esc(it.qty)}${T} ${T}${esc(it.orderingUnit || it.measurement)}</span></div></div></div>`).join('')}</div></div>`;
}

/** The panel for one row. `view` = { tab: 'details'|'items', copied } (the panel's own state). */
export function fulfillmentPanel(order, seller, view) {
  const id = order._id;
  const n = order.item_list?.length || 0;
  const tab = (key, text, icon, extra = '') => {
    const on = view.tab === key;
    return `<button data-testid="order-fulfillment-tab-${key}-${id}" data-status="${on ? 'active' : 'inactive'}" class="flex-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors ${on ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'}" data-act="fulfillment-tab" data-id="${id}" data-tab="${key}"><div class="flex items-center justify-center gap-1.5">${fi(icon, { size: 14 })}<span class="truncate">${text}${extra}</span></div></button>`;
  };
  return `<div data-testid="order-fulfillment-metadata-${id}" class="border-t border-slate-200"><div class="flex border-b border-slate-200 bg-white">`
    + tab('details', 'Details', 'FiFileText')
    + tab('items', 'Items', 'FiShoppingBag', n > 0 ? `<span> (${T}${n}${T})</span>` : '')
    + `</div><div class="p-3 sm:p-6 bg-white">${view.tab === 'details' ? details(order, seller, view.copied) : items(order)}</div></div>`;
}

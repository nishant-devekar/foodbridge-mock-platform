/*
  Create Delivery — turn orders into a route delivery: pick orders (grouped by customer), assign
  staff, name it. The product's CreateDeliveryModal, three steps.

  The phone lists customers as cards, md+ as a table; both are rendered and the breakpoint shows
  one. Amounts here are the modal's own: a line is (price × qty × tax).toFixed(2), printed with
  Indian grouping and at most two decimals, the currency sign attached ("₹1,391.25").
*/
import { lucide } from '../components/icons.js';
import { esc } from '../components/dom.js';
import { renderModal } from '../components/drawer.js';
import { toTitleCase } from './model.js';

const WINDOWS = [3, 7, 14, 21, 30];
const COLORS = ['bg-violet-100 text-violet-700', 'bg-sky-100 text-sky-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-teal-100 text-teal-700'];
const lineTotal = (l) => Number((l.price * l.qty * (1 + (l.tax || 0) / 100)).toFixed(2));
// An order's total here leaves its discount OUT: the modal subtracts `orderDiscount`, but the
// eligibility endpoint is asked only for the fields in DISPATCH_ELIGIBLE_ORDER_FIELDS, which do not
// include it — so production shows discounted orders at their full value. Reproduced.
const orderTotal = (o) => Math.max(0, o.items.reduce((s, l) => s + lineTotal(l), 0) + (o.shippingCost || 0));
const fmtDate = (d) => d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

function avatar(name, size = 'sm') {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return `<div class="rounded-full flex-shrink-0 flex items-center justify-center font-bold ${COLORS[(name || '').charCodeAt(0) % COLORS.length]} ${size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'}">${esc(initials)}</div>`;
}

function stepBar(step) {
  return `<div class="flex items-center gap-0 w-full mb-5">${[['orders', 'Select Orders'], ['staff', 'Assign Staff'], ['review', 'Review &amp; Name']].map(([key, label], i) => {
    const done = i < step;
    const active = i === step;
    return `<div data-testid="create-delivery-step-${key}" data-status="${done ? 'done' : active ? 'active' : 'pending'}" class="flex items-center flex-1 min-w-0"><div class="flex flex-col items-center gap-1 flex-shrink-0"><div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${done ? 'bg-green-600 border-green-600 text-white' : active ? 'bg-white border-green-600 text-green-700' : 'bg-white border-gray-200 text-gray-400'}">${done ? lucide('check', { cls: 'w-3.5 h-3.5' }) : i + 1}</div><span class="text-[10px] font-semibold whitespace-nowrap ${active ? 'text-green-700' : done ? 'text-green-500' : 'text-gray-400'}">${label}</span></div>${i < 2 ? `<div class="flex-1 h-0.5 mx-2 mt-[-12px] rounded ${done ? 'bg-green-500' : 'bg-gray-200'}"></div>` : ''}</div>`;
  }).join('')}</div>`;
}

/** Everything the modal shows, derived. */
function view(m, k, now) {
  const rows = m.dispatchEligible(k.days, now).map((o) => {
    const c = m.data.customerById.get(o.customerId);
    return { orderId: o.id, orgId: c.id, orgName: c.name, address: c.address || '—', orderNumber: o.number, total: orderTotal(o), items: o.items, status: o.status, createdAt: o.createdAt };
  });
  const q = k.search.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.orgName.toLowerCase().includes(q) || r.orderNumber.toLowerCase().includes(q) || r.address.toLowerCase().includes(q)) : rows;
  const groups = [];
  for (const r of filtered) {
    let g = groups.find((x) => x.orgId === r.orgId);
    if (!g) groups.push(g = { orgId: r.orgId, orgName: r.orgName, orders: [], total: 0, itemCount: 0, addresses: [] });
    g.orders.push(r);
    g.total += r.total;
    g.itemCount += r.items.length;
    if (!g.addresses.includes(r.address)) g.addresses.push(r.address);
  }
  for (const g of groups) {
    const real = g.addresses.filter((a) => a !== '—');
    const kept = real.filter((a, i, all) => !all.some((o, j) => j !== i && o.length > a.length && o.toLowerCase().includes(a.toLowerCase())));
    g.addresses = kept.length ? kept : ['—'];
  }
  const selected = rows.filter((r) => k.selected.includes(r.orderId));
  const dates = filtered.map((r) => r.createdAt).sort((a, b) => a - b);
  const range = dates.length ? { first: dates[0], last: dates.at(-1), days: Math.max(1, Math.ceil((dates.at(-1) - dates[0]) / 86400000) + 1) } : null;
  return { rows, filtered, groups, selected, range, customers: new Set(selected.map((r) => r.orgId)).size, value: selected.reduce((s, r) => s + r.total, 0) };
}

function ordersStep(m, k, v, inr) {
  const all = v.filtered.length > 0 && v.filtered.every((r) => k.selected.includes(r.orderId));
  const box = (g) => {
    const n = g.orders.filter((o) => k.selected.includes(o.orderId)).length;
    return { checked: n === g.orders.length, indeterminate: n > 0 && n < g.orders.length };
  };
  const cb = (g, testid) => { const b = box(g); return `<input type="checkbox"${b.checked ? ' checked' : ''} data-indeterminate="${b.indeterminate}" class="w-4 h-4 accent-green-600 rounded flex-shrink-0" data-act="dl-customer" data-id="${g.orgId}" aria-label="Select all orders for ${esc(g.orgName)}" data-testid="${testid}">`; };
  const statusBadge = (st) => (st ? `<span class="inline-block whitespace-nowrap rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">${esc(toTitleCase(st))}</span>` : '<span class="text-gray-300 text-xs">—</span>');
  const itemsTable = (r, checked) => `<tr class="${checked ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-slate-100/80 dark:bg-slate-700/30'}"><td colspan="8" class="px-6 pb-3 pt-0"><div class="border border-gray-100 dark:border-gray-600 rounded-lg overflow-hidden"><table class="w-full text-xs"><thead><tr class="bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600"><th class="py-1.5 px-3 text-left font-semibold text-gray-500 uppercase tracking-wide">Product</th><th class="py-1.5 px-3 text-right font-semibold text-gray-500 uppercase tracking-wide">Qty</th><th class="py-1.5 px-3 text-right font-semibold text-gray-500 uppercase tracking-wide">Price</th></tr></thead><tbody class="divide-y divide-gray-100 dark:divide-gray-700">${r.items.map((l) => `<tr class="bg-white dark:bg-gray-800"><td class="py-1.5 px-3 text-gray-700 dark:text-gray-200">${esc(l.name)}${l.unit ? `<span class="ml-1 text-[10px] text-gray-400 font-normal">(<!---->${esc(l.unit)}<!---->)</span>` : ''}</td><td class="py-1.5 px-3 text-right text-gray-600 dark:text-gray-300">${l.qty}</td><td class="py-1.5 px-3 text-right text-gray-700 dark:text-gray-200 font-medium">${lineTotal(l) > 0 ? inr(lineTotal(l)) : '—'}</td></tr>`).join('')}</tbody></table></div></td></tr>`;

  let list;
  if (!v.filtered.length) {
    list = `<div data-testid="create-delivery-orders-empty" class="flex flex-col items-center justify-center py-14 gap-3 text-gray-400">${lucide('package', { cls: 'w-10 h-10 opacity-20' })}${k.search || v.rows.length ? '<p class="text-sm font-medium">No orders match your search.</p>' : `<p class="text-sm font-medium text-center px-6">No orders without an existing dispatch in the last<!----> <!---->${k.days}<!----> day<!---->${k.days === 1 ? '' : 's'}<!---->.</p>${k.days < 30 ? '<button type="button" data-act="dl-widen" data-testid="create-delivery-orders-empty-widen-window-btn" class="text-xs font-semibold text-green-700 hover:text-green-800 underline underline-offset-2">Try the last<!----> <!---->30 days<!----> <!---->instead</button>' : ''}`}</div>`;
  } else {
    const mobile = v.groups.map((g) => {
      const open = k.expanded.includes(g.orgId);
      const orders = open ? `<div class="ml-5 border-l-2 border-slate-200 bg-slate-50/70 dark:border-slate-600 dark:bg-slate-800/50"><div class="grid grid-cols-[1fr_auto] gap-2 border-b border-slate-200 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500"><span>Order number · Address · Created</span><span>Amount · Items</span></div>${g.orders.map((r, i) => {
        const checked = k.selected.includes(r.orderId);
        const exp = k.itemsOf === r.orderId;
        return `<div data-testid="create-delivery-order-row-mobile-${r.orderId}" data-status="${checked ? 'selected' : 'unselected'}"><div data-act="dl-order" data-id="${r.orderId}" class="flex items-start gap-3 border-b border-slate-200/70 p-3 cursor-pointer transition-colors last:border-b-0 ${checked ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-white dark:hover:bg-slate-700/50'}"><input type="checkbox"${checked ? ' checked' : ''} data-act="dl-order" data-id="${r.orderId}" data-testid="create-delivery-order-checkbox-mobile-${r.orderId}" class="w-4 h-4 mt-1 accent-green-600 rounded flex-shrink-0"><div class="flex-1 min-w-0"><div class="flex items-center justify-between gap-2"><span class="flex items-center gap-1.5 min-w-0"><span class="font-semibold text-slate-700 dark:text-slate-200 truncate">Order <!---->${i + 1}</span>${statusBadge(r.status)}</span><span class="font-bold text-gray-900 dark:text-white whitespace-nowrap">${inr(r.total)}</span></div><div class="flex items-center justify-between gap-2 mt-0.5"><span class="text-gray-500 font-mono text-xs truncate">#${esc(r.orderNumber)}<!----> · <!---->${esc(r.address)}<!----> · <!---->${fmtDate(r.createdAt)}</span>${r.items.length ? `<button data-act="dl-items" data-id="${r.orderId}" data-testid="create-delivery-order-expand-mobile-${r.orderId}" class="p-1 -m-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-0.5 flex-shrink-0" title="Preview items"><span class="text-xs">${r.items.length}<!----> items</span>${lucide(exp ? 'chevron-up' : 'chevron-down', { cls: 'w-3.5 h-3.5' })}</button>` : ''}</div></div></div>${exp ? `<div class="px-3 pb-3 ${checked ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-slate-100/70 dark:bg-slate-700/30'}"><div class="border border-gray-100 dark:border-gray-600 rounded-lg overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">${r.items.map((l) => `<div class="flex items-center justify-between gap-2 px-3 py-1.5 text-xs bg-white dark:bg-gray-800"><span class="text-gray-700 dark:text-gray-200 truncate">${esc(l.name)}${l.unit ? `<span class="ml-1 text-[10px] text-gray-400 font-normal">(<!---->${esc(l.unit)}<!---->)</span>` : ''}</span><span class="text-gray-600 dark:text-gray-300 flex-shrink-0">${l.qty}<!----> × <!---->${lineTotal(l) > 0 ? inr(lineTotal(l)) : '—'}</span></div>`).join('')}</div></div>` : ''}</div>`;
      }).join('')}</div>` : '';
      return `<div data-testid="create-delivery-customer-group-mobile-${g.orgId}" data-status="${open ? 'expanded' : 'collapsed'}" class="bg-white dark:bg-gray-800"><div data-act="dl-expand" data-id="${g.orgId}" data-testid="create-delivery-customer-toggle-mobile-${g.orgId}" class="flex cursor-pointer items-center gap-3 border-l-4 p-3 transition-colors ${open ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'}">${cb(g, `create-delivery-customer-select-all-mobile-${g.orgId}`)}${avatar(g.orgName)}<button type="button" class="flex min-w-0 flex-1 items-center justify-between gap-2 text-left" aria-expanded="${open}"><span class="min-w-0"><span class="block truncate text-sm font-bold text-gray-900 dark:text-white">${esc(g.orgName)}</span><span class="block truncate text-xs text-gray-500 dark:text-gray-400">${esc(g.addresses.join(' • '))}</span><span class="text-xs font-medium ${open ? 'text-emerald-700 dark:text-emerald-300' : 'text-gray-500 dark:text-gray-400'}">${g.itemCount}<!----> item<!---->${g.itemCount !== 1 ? 's' : ''}</span></span><span class="flex items-center gap-2"><span class="text-sm font-bold text-gray-900 dark:text-white">${inr(g.total)}</span>${lucide('chevron-down', { cls: `h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}` })}</span></button></div>${orders}</div>`;
    }).join('');
    const th = (cls, text = '') => `<th class="${cls}">${text}</th>`;
    const desktop = v.groups.map((g) => {
      const open = k.expanded.includes(g.orgId);
      const head = open ? `<tr class="border-l-4 border-slate-200 bg-gray-100 dark:border-slate-600 dark:bg-gray-700">${th('py-2 pl-4 pr-2')}${th('py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500', 'Order Number')}${th('py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500', 'Address')}${th('py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500', 'Created')}${th('py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500', 'Status')}${th('py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500', 'Amount')}${th('py-2 pr-4 pl-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500', 'Items')}${th('py-2 pr-3 pl-2')}</tr>` : '';
      const orders = open ? g.orders.map((r, i) => {
        const checked = k.selected.includes(r.orderId);
        const exp = k.itemsOf === r.orderId;
        return `<tr data-act="dl-order" data-id="${r.orderId}" data-testid="create-delivery-order-row-${r.orderId}" data-status="${checked ? 'selected' : 'unselected'}" class="cursor-pointer border-l-4 border-slate-200 transition-colors dark:border-slate-600 ${checked ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-50/80 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-700/60'}"><td class="py-3 pl-4 pr-2"><input type="checkbox"${checked ? ' checked' : ''} data-act="dl-order" data-id="${r.orderId}" data-testid="create-delivery-order-checkbox-${r.orderId}" class="w-4 h-4 accent-green-600 rounded"></td><td class="py-3 px-3"><div class="flex items-center gap-2 pl-3"><span class="font-mono text-xs text-slate-600 dark:text-slate-300 truncate max-w-[140px]">${r.orderNumber ? `#${esc(r.orderNumber)}` : `Order ${i + 1}`}</span></div></td><td class="py-3 px-3"><span class="line-clamp-2 max-w-[280px] text-gray-500 text-xs" title="${esc(r.address)}">${esc(r.address)}</span></td><td class="py-3 px-3"><span class="text-gray-500 text-xs whitespace-nowrap">${fmtDate(r.createdAt)}</span></td><td class="py-3 px-3">${statusBadge(r.status)}</td><td class="py-3 px-3 text-right"><span class="font-bold text-gray-900 dark:text-white">${inr(r.total)}</span></td><td class="py-3 pr-4 pl-2 text-center"><span class="text-xs text-gray-500">${r.items.length || '—'}</span></td><td class="py-3 pr-3 pl-2 text-center">${r.items.length ? `<button data-act="dl-items" data-id="${r.orderId}" data-testid="create-delivery-order-expand-${r.orderId}" class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 transition-colors" title="Preview items">${lucide(exp ? 'chevron-up' : 'chevron-down', { cls: 'w-3.5 h-3.5' })}</button>` : ''}</td></tr>${exp ? itemsTable(r, checked) : ''}`;
      }).join('') : '';
      return `<tbody data-testid="create-delivery-customer-group-${g.orgId}" data-status="${open ? 'expanded' : 'collapsed'}" class="border-b border-gray-100 last:border-b-0"><tr data-act="dl-expand" data-id="${g.orgId}" data-testid="create-delivery-customer-toggle-${g.orgId}" class="cursor-pointer border-l-4 transition-colors ${open ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700'}"><td class="py-3 pl-4 pr-2">${cb(g, `create-delivery-customer-select-all-${g.orgId}`)}</td><td class="py-3 px-3"><div class="flex w-full items-center gap-2 text-left" aria-expanded="${open}">${avatar(g.orgName)}<span class="min-w-0"><span class="block truncate font-bold text-gray-900 dark:text-white">${esc(g.orgName)}</span></span></div></td><td class="max-w-[280px] py-3 px-3 text-xs text-gray-500" title="${esc(g.addresses.join(' • '))}"><span class="line-clamp-2">${esc(g.addresses.join(' • '))}</span></td><td class="py-3 px-3" aria-hidden="true"></td><td class="py-3 px-3" aria-hidden="true"></td><td class="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">${inr(g.total)}</td><td class="py-3 pr-4 pl-2 text-center text-xs font-medium text-green-700">${g.itemCount}</td><td class="py-3 pr-3 pl-2 text-center"><span class="inline-flex rounded p-1 text-gray-400" aria-label="${open ? 'Collapse' : 'Expand'} ${esc(g.orgName)} orders">${lucide('chevron-down', { cls: `h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}` })}</span></td></tr>${head}${orders}</tbody>`;
    }).join('');
    list = `<div class="block md:hidden divide-y divide-gray-50">${mobile}</div><table class="hidden md:table w-full text-sm"><thead><tr class="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-700">${th('w-8 py-2 pl-4 pr-2')}${th('py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300', 'Customer Name')}${th('py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300', 'Address')}${th('py-2 px-3')}${th('py-2 px-3')}${th('py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300', 'Total Amount')}${th('py-2 pr-4 pl-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300', 'Items')}${th('w-8 py-2 pr-3 pl-2')}</tr></thead>${desktop}</table>`;
  }
  const confirm = k.confirmAll ? `<div data-act="dl-confirm-cancel" class="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/15 p-4 dark:bg-black/25" role="presentation"><div data-testid="create-delivery-select-all-confirm-modal" data-stop class="w-full max-w-lg overflow-hidden rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800" role="alertdialog" aria-modal="true" aria-labelledby="select-all-title" aria-describedby="select-all-description"><div class="px-6 pb-7 pt-8 text-center sm:px-10"><h3 id="select-all-title" class="text-base font-semibold text-gray-900 dark:text-gray-100">Select all <!---->${v.filtered.length}<!----> orders?</h3><p id="select-all-description" class="mt-1.5 text-sm leading-6 text-gray-500 dark:text-gray-400">This will add every available order shown here to the same delivery${v.range ? ` <!---->— spanning <!---->${v.range.days}<!----> day<!---->${v.range.days !== 1 ? 's' : ''}<!---->, from <!---->${fmtDate(v.range.first)}<!----> to <!---->${fmtDate(v.range.last)}` : ''}<!---->. Please confirm before continuing.</p></div><div class="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50 px-5 py-3 sm:flex-row sm:justify-center sm:gap-3 dark:border-gray-700 dark:bg-gray-900/30"><button type="button" data-act="dl-confirm-cancel" data-testid="create-delivery-select-all-confirm-cancel-btn" class="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 sm:w-auto dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">Cancel</button><button type="button" data-act="dl-confirm-all" data-testid="create-delivery-select-all-confirm-btn" class="inline-flex h-10 w-full items-center justify-center rounded-md border border-transparent bg-green-600 px-5 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-300 sm:w-auto">Yes, select all <!---->${v.filtered.length}</button></div></div></div>` : '';
  return `<div class="flex flex-col gap-3 min-h-0">
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3"><div class="relative flex-1">${lucide('search', { cls: 'absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' })}<input type="text" data-dl-search data-testid="create-delivery-search-input" value="${esc(k.search)}" placeholder="Search by customer, address, or order number…" class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">${k.search ? `<button data-act="dl-search-clear" data-testid="create-delivery-search-clear-btn" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">${lucide('x', { cls: 'w-3.5 h-3.5' })}</button>` : ''}</div>
      <div class="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 flex-shrink-0"><span class="font-semibold">${v.rows.length}</span> <!---->available</div>
      <select data-dl-window data-testid="create-delivery-days-window-select" aria-label="Show orders from the last" class="flex-shrink-0 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">${WINDOWS.map((d) => `<option value="${d}"${d === k.days ? ' selected' : ''}>Last <!---->${d} days</option>`).join('')}</select></div>
    ${v.filtered.length ? `<div class="flex items-center justify-between px-1"><label class="flex items-center gap-2 cursor-pointer select-none"><input type="checkbox" data-act="dl-select-all" data-testid="create-delivery-select-all-checkbox"${all ? ' checked' : ''} class="w-4 h-4 accent-green-600 rounded"><span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select all (<!---->${v.filtered.length}<!---->)</span></label>${k.selected.length ? `<span class="text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-0.5 rounded-full border border-green-200">${k.selected.length}<!----> selected · <!---->${inr(v.value)}</span>` : ''}</div>` : ''}
    <div class="border border-gray-100 rounded-xl overflow-hidden flex-1" style="max-height: 380px; overflow-y: auto;">${list}</div>
    <div class="flex gap-3 pt-1"><button data-act="dl-close" data-testid="create-delivery-step1-cancel-btn" class="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button><button${k.selected.length ? '' : ' disabled=""'} data-act="dl-step" data-step="1" data-testid="create-delivery-step1-next-btn" class="flex-1 py-2.5 px-5 bg-green-600 rounded-lg text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">Assign Staff <!---->${lucide('chevron-right', { cls: 'w-4 h-4' })}</button></div>
    ${confirm}</div>`;
}

function staffStep(m, k) {
  const staff = m.data.staff;
  return `<div class="flex flex-col gap-3 min-h-0"><p class="text-sm text-gray-500">Assign one or more staff members to this delivery.</p>
    ${staff.length ? `<div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 overflow-y-auto" style="max-height: 340px;">${staff.map((s) => {
      const on = k.staff.includes(s.id);
      return `<label data-act="dl-staff" data-id="${s.id}" data-testid="create-delivery-staff-row-${s.id}" data-status="${on ? 'selected' : 'unselected'}" class="relative flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer select-none transition-all overflow-hidden ${on ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50 dark:bg-gray-700/30 dark:border-gray-600'}"><input type="checkbox"${on ? ' checked' : ''} data-testid="create-delivery-staff-checkbox-${s.id}" class="sr-only">${avatar(s.name, 'md')}<div class="flex-1 min-w-0"><p class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">${esc(s.name)}${s.role ? `<span class="text-gray-400 dark:text-gray-500 font-normal"> <!---->- <!---->${esc(s.role)}</span>` : ''}</p>${s.phone ? `<p class="text-xs text-gray-400 truncate">${esc(s.phone)}</p>` : ''}</div>${on ? `<div class="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">${lucide('check', { cls: 'w-3 h-3 text-white' })}</div>` : ''}</label>`;
    }).join('')}</div>` : `<div data-testid="create-delivery-staff-empty" class="flex flex-col items-center justify-center py-14 gap-3 text-gray-400">${lucide('users', { cls: 'w-10 h-10 opacity-20' })}<p class="text-sm font-medium">No staff found.</p></div>`}
    ${k.staff.length ? `<p class="text-xs text-green-700 font-medium">${k.staff.length}<!----> staff member<!---->${k.staff.length !== 1 ? 's' : ''}<!----> selected</p>` : ''}
    <div class="flex gap-3 pt-1"><button data-act="dl-step" data-step="0" data-testid="create-delivery-step2-back-btn" class="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300">← Back</button><button${k.staff.length ? '' : ' disabled=""'} data-act="dl-step" data-step="2" data-testid="create-delivery-step2-next-btn" class="flex-1 py-2.5 px-5 bg-green-600 rounded-lg text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">Review &amp; Confirm <!---->${lucide('chevron-right', { cls: 'w-4 h-4' })}</button></div></div>`;
}

function reviewStep(m, k, v, inr) {
  const staff = m.data.staff.filter((s) => k.staff.includes(s.id));
  return `<div class="flex flex-col gap-4 min-h-0">
    <div class="grid grid-cols-3 gap-3"><div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-gray-900 dark:text-white">${k.selected.length}</p><p class="text-xs text-gray-500 mt-0.5">Orders</p></div><div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center"><p class="text-2xl font-bold text-gray-900 dark:text-white">${v.customers}</p><p class="text-xs text-gray-500 mt-0.5">Customers</p></div><div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 text-center"><p class="text-lg font-bold text-gray-900 dark:text-white">${inr(v.value)}</p><p class="text-xs text-gray-500 mt-0.5">Total Value</p></div></div>
    <div class="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3"><p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Staff Assigned</p>${staff.length ? `<div class="flex flex-wrap gap-2">${staff.map((s) => `<div class="flex items-center gap-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full px-2.5 py-1">${avatar(s.name, 'sm')}<div class="flex flex-col leading-tight"><span class="text-xs font-medium text-gray-700 dark:text-gray-200">${esc(s.name)}</span>${s.role ? `<span class="text-[10px] text-indigo-500 font-medium">${esc(s.role)}</span>` : ''}</div></div>`).join('')}</div>` : '<p class="text-sm text-gray-400 italic">None</p>'}</div>
    <div><label class="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Delivery Name <span class="text-red-500">*</span></label><input type="text" data-dl-name data-testid="create-delivery-name-input" value="${esc(k.name)}" placeholder="e.g. Morning Route — 18 Jun" class="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white placeholder:text-gray-400 transition-colors"><p class="text-xs text-gray-400 mt-1">This name appears in the driver's delivery dashboard.</p></div>
    <div class="flex gap-3 pt-1"><button data-act="dl-step" data-step="1"${k.submitting ? ' disabled=""' : ''} data-testid="create-delivery-step3-back-btn" class="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-300">← Back</button><button data-act="dl-submit"${!k.name.trim() || k.submitting ? ' disabled=""' : ''} data-testid="create-delivery-submit-btn" class="flex-1 py-2.5 px-5 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg text-sm font-semibold text-white hover:from-green-700 hover:to-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm">${k.submitting ? `${lucide('loader-circle', { cls: 'w-4 h-4 animate-spin' })} Creating delivery…` : `${lucide('truck', { cls: 'w-4 h-4' })} Create Delivery`}</button></div></div>`;
}

export function renderDelivery(m, k, now) {
  const inr = (n) => `${m.currency}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const v = view(m, k, now);
  const body = k.step === 0 ? ordersStep(m, k, v, inr) : k.step === 1 ? staffStep(m, k) : reviewStep(m, k, v, inr);
  return renderModal({ testId: 'create-delivery', size: 'xl', content: `<div class="flex items-center gap-3 mb-6"><div class="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">${lucide('truck', { cls: 'w-5 h-5 text-white' })}</div><div><h2 class="text-lg font-bold text-gray-900 dark:text-white leading-tight">Create Delivery</h2><p class="text-xs text-gray-500">Turn existing orders into a route delivery</p></div></div>${stepBar(k.step)}${body}` });
}

/** The modal's state and interactions; `onCreated` refreshes the list. */
export function deliveryFlow({ model: m, host, toast, now, onCreated }) {
  let k = null;
  function render() {
    const active = host.contains(document.activeElement) ? document.activeElement : null;
    const key = active?.dataset?.testid;
    const caret = active && ['text'].includes(active.type) ? [active.selectionStart, active.selectionEnd] : null;
    const scroll = host.querySelector('[style*="max-height: 380px"]')?.scrollTop || 0;
    host.innerHTML = k ? renderDelivery(m, k, now()) : '';
    if (!k) return;
    host.querySelectorAll('[data-indeterminate="true"]').forEach((el) => { el.indeterminate = true; });
    const sc = host.querySelector('[style*="max-height: 380px"]');
    if (sc) sc.scrollTop = scroll;
    const el = key && host.querySelector(`[data-testid="${key}"]`);
    if (el) { el.focus({ preventScroll: true }); if (caret) try { el.setSelectionRange(...caret); } catch { /* */ } }
  }
  const set = (patch) => { Object.assign(k, patch); render(); };
  const toggle = (list, id) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const eligible = () => view(m, k, now());
  const handlers = {
    'dl-close': () => { k = null; render(); },
    'modal-close-delivery': () => { k = null; render(); },
    'dl-expand': (e, el) => { if (e.target.closest('input')) return; set({ expanded: toggle(k.expanded, el.dataset.id) }); },
    'dl-customer': (e, el) => {
      e.stopPropagation();
      const g = eligible().groups.find((x) => x.orgId === el.dataset.id);
      const ids = g.orders.map((o) => o.orderId);
      const all = ids.every((id) => k.selected.includes(id));
      set({ selected: all ? k.selected.filter((id) => !ids.includes(id)) : [...new Set([...k.selected, ...ids])] });
    },
    'dl-order': (e, el) => { e.stopPropagation(); set({ selected: toggle(k.selected, el.dataset.id) }); },
    'dl-items': (e, el) => { e.stopPropagation(); set({ itemsOf: k.itemsOf === el.dataset.id ? null : el.dataset.id }); },
    'dl-select-all': (e) => {
      e.preventDefault();
      const v = eligible();
      if (v.filtered.length && v.filtered.every((r) => k.selected.includes(r.orderId))) set({ selected: k.selected.filter((id) => !v.filtered.some((r) => r.orderId === id)) });
      else set({ confirmAll: true });
    },
    'dl-confirm-cancel': (e) => { if (e.target.closest('[data-stop]') && !e.target.closest('[data-act="dl-confirm-cancel"][data-testid]')) return; set({ confirmAll: false }); },
    'dl-confirm-all': () => { const v = eligible(); set({ selected: [...new Set([...k.selected, ...v.filtered.map((r) => r.orderId)])], confirmAll: false }); },
    'dl-widen': () => set({ days: 30 }),
    'dl-search-clear': () => set({ search: '' }),
    'dl-staff': (e, el) => { e.preventDefault(); set({ staff: toggle(k.staff, el.dataset.id) }); },
    'dl-step': (_e, el) => {
      set({ step: Number(el.dataset.step) });
      if (k.step === 2) setTimeout(() => host.querySelector('[data-dl-name]')?.focus(), 80); // the name field takes focus
    },
    'dl-submit': () => {
      if (!k.name.trim() || !k.selected.length) return;
      set({ submitting: true });
      setTimeout(() => {
        m.createDelivery({ orderIds: k.selected, staffIds: k.staff, name: k.name.trim(), at: new Date(now()) });
        toast('Route delivery created successfully');
        k = null; render(); onCreated();
      }, 150);
    },
  };
  host.addEventListener('input', (e) => {
    if (!k) return;
    if (e.target.matches('[data-dl-search]')) set({ search: e.target.value });
    if (e.target.matches('[data-dl-name]')) { k.name = e.target.value; const b = host.querySelector('[data-testid="create-delivery-submit-btn"]'); if (b) b.disabled = !k.name.trim() || k.submitting; }
  });
  host.addEventListener('change', (e) => {
    if (k && e.target.matches('[data-dl-window]')) set({ days: Number(e.target.value) });
  });
  return {
    handlers,
    open() { k = { step: 0, days: 3, search: '', selected: [], expanded: [], itemsOf: null, confirmAll: false, staff: [], name: '', submitting: false }; render(); },
    isOpen: () => !!k,
    close() { k = null; render(); },
  };
}

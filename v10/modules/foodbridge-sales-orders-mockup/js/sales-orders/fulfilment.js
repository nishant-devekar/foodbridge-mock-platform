/*
  The panel an expanded order opens: Details · Items (n) · Comments · Fulfillment.
  Fulfillment draws the order's graph — each dispatch, the delivery run carrying it, and any
  returns against it — with the product's status colours.
*/
import { fi } from '../components/icons.js';
import { esc, cls } from '../components/dom.js';

const TABS = [
  { id: 'details', label: 'Details', icon: 'fileText' },
  { id: 'items', label: 'Items', icon: 'shoppingBag' },
  { id: 'comments', label: 'Comments', icon: 'messageSquare' },
  { id: 'fulfillment', label: 'Fulfillment', icon: 'mapPin' },
];

function tone(status = '') {
  const s = status.toLowerCase();
  if (s.includes('delivered') || s.includes('completed') || s.includes('received')) return { dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' };
  if (s.includes('transit') || s.includes('out') || s.includes('progress')) return { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' };
  if (s.includes('rejected') || s.includes('failed')) return { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
  if (s.includes('pending') || s.includes('created')) return { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  return { dot: 'bg-gray-500', bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
}

const field = (label, value, extra = '') => `<div${extra ? ` class="${extra}"` : ''}><p class="text-xs text-slate-500 mb-1">${label}</p>${value}</div>`;

function details(m, s, r) {
  const o = r.order;
  const c = m.customerOf(o);
  const copied = s.copied === r.number;
  return `<div class="space-y-4"><div class="grid grid-cols-2 gap-4">
    ${field('Order Number', `<div class="flex items-center gap-2"><p class="text-sm font-mono font-medium text-slate-900">${esc(r.number)}</p><button data-act="copy" data-value="${esc(r.number)}" data-kind="Order" data-testid="order-fulfillment-copy-number-btn-${r.id}" class="p-1 rounded-md hover:bg-slate-100 transition-all duration-200 group/copy" title="${copied ? 'Copied!' : 'Copy Order reference'}">${copied ? fi('check', { cls: 'w-3.5 h-3.5 text-emerald-500' }) : fi('copy', { cls: 'w-3.5 h-3.5 text-slate-400 group-hover/copy:text-slate-600' })}</button></div>`)}
    ${field('Status', `<p class="text-sm font-medium text-slate-900 capitalize">${esc(String(o.status).replace(/_/g, ' '))}</p>`)}
    ${field('Customer Name', `<p class="text-sm font-medium text-slate-900">${esc(c.name || 'N/A')}</p>`)}
    ${field('Phone', `<p class="text-sm font-medium text-slate-900">${esc(c.phone || 'N/A')}</p>`)}
    ${field('Email', `<p class="text-sm font-medium text-slate-900 break-all">${esc(c.email || 'N/A')}</p>`, 'col-span-2 sm:col-span-1')}
    ${field('Order Date', `<p class="text-sm font-medium text-slate-900">${o.createdAt.toLocaleString()}</p>`, 'col-span-2 sm:col-span-1')}
  </div></div>`;
}

function items(r) {
  const list = r.order.items;
  if (!list.length) return `<div><div data-testid="order-fulfillment-items-empty-${r.id}" class="py-8 text-center text-sm text-slate-500">No items found</div></div>`;
  return `<div><div class="space-y-2">${list.map((it) => `<div data-testid="order-fulfillment-item-row-${r.id}-${esc(it.articleNo)}" class="border border-slate-200 rounded p-2 hover:bg-slate-50 transition-colors"><div class="flex items-center gap-3">
    <div class="flex-1 min-w-0"><h4 class="text-sm font-medium text-slate-900 truncate">${esc(it.name)}</h4>${it.articleNo ? `<p class="text-xs text-slate-500">Art no: <!---->${esc(it.articleNo)}</p>` : ''}</div>
    <div class="flex-shrink-0 text-right"><span class="text-sm font-medium text-slate-900">${it.qty}<!----> <!---->${esc(it.unit || '')}</span></div>
  </div></div>`).join('')}</div></div>`;
}

function comments(r) {
  const text = r.order.comment;
  return `<div class="bg-white rounded-lg border border-gray-200">${text && text.trim()
    ? `<div class="px-6 py-4"><p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${esc(text)}</p></div>`
    : `<div data-testid="order-fulfillment-comments-empty-${r.id}" class="flex flex-col items-center justify-center py-12 text-center px-6"><div class="p-4 bg-gray-50 rounded-full mb-4">${fi('messageSquare', { size: 28, cls: 'text-gray-400' })}</div><h3 class="text-base font-semibold text-gray-900 mb-1">No Comments Added</h3><p class="text-sm text-gray-500 max-w-sm">There are no comments associated with this order yet.</p></div>`}</div>`;
}

const copyBtn = (value, kind, testid, title) => `<button data-act="copy" data-value="${esc(value)}" data-kind="${kind}" data-testid="${testid}" class="p-1 hover:bg-slate-200 rounded transition-colors" title="${title}">${fi('copy', { cls: 'w-3 h-3 text-slate-500' })}</button>`;

function fulfillment(r) {
  const { dispatches, deliveries, returns } = r.fulfilment;
  if (!dispatches.length && !deliveries.length && !returns.length) {
    return `<div data-testid="order-fulfillment-empty-${r.id}" class="p-3 sm:p-6"><div class="flex flex-col items-center justify-center py-12 text-center"><div class="p-4 rounded-full bg-gray-100 mb-4">${fi('box', { cls: 'w-8 h-8 text-gray-400' })}</div><p class="text-sm font-semibold text-gray-700">No Fulfillment Activity</p><p class="text-xs text-gray-500 mt-1">No dispatches, deliveries, or returns have been created for this order yet</p></div></div>`;
  }
  const cards = dispatches.map((d) => {
    const t = tone(d.status);
    const delivery = deliveries.find((v) => v.dispatchIds.includes(d.id));
    const rets = returns.filter((x) => x.dispatchId === d.id);
    const count = (n) => `• <!---->${n}<!----> item<!---->${n !== 1 ? 's' : ''}`;
    return `<div data-testid="order-fulfillment-dispatch-row-${d.id}" data-status="${esc(d.status)}" class="mb-3"><div class="rounded-lg border ${t.border} ${t.bg} p-3 shadow-sm">
      <div class="flex items-center gap-2">${fi('package', { cls: `w-4 h-4 ${t.text} flex-shrink-0` })}<div class="flex-1">
        <div class="flex items-center gap-2"><span class="text-xs font-medium text-slate-700">Dispatch</span><span class="font-mono text-xs text-slate-600">${esc(d.number)}</span>${copyBtn(d.number, 'Dispatch', `order-fulfillment-copy-dispatch-btn-${d.id}`, 'Copy dispatch reference')}</div>
        <div class="flex items-center gap-2 mt-0.5"><div class="w-1.5 h-1.5 rounded-full ${t.dot}"></div><span class="text-xs ${t.text} capitalize">${esc(d.status.replace(/_/g, ' '))}</span><span class="text-xs text-slate-500">${count(d.items.length)}</span></div>
      </div></div>
      ${delivery ? `<div data-testid="order-fulfillment-delivery-row-${delivery.id}" class="mt-2 ml-1 pl-5 border-l-2 border-purple-300"><div class="bg-white rounded-md p-2 shadow-sm"><div class="flex items-center gap-2">${fi('chevronRight', { cls: 'w-3 h-3 text-slate-400 flex-shrink-0' })}${fi('truck', { cls: 'w-3.5 h-3.5 text-purple-600 flex-shrink-0' })}<div class="flex-1">
        <div class="flex items-center gap-2"><span class="text-xs font-medium text-slate-700">Delivery Run</span><span class="font-mono text-xs text-slate-600">${esc(delivery.number)}</span>${copyBtn(delivery.number, 'Delivery', `order-fulfillment-copy-delivery-btn-${delivery.id}`, 'Copy delivery reference')}</div>
        <div class="mt-1 flex items-center gap-2"><div class="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div class="h-full bg-purple-500 transition-all duration-300" style="width: ${delivery.progress}%;"></div></div><span class="text-xs text-slate-600 font-medium">${delivery.progress}<!---->%</span></div>
      </div></div></div></div>` : ''}
      ${rets.length ? `<div class="mt-2 ml-1 pl-5 border-l-2 border-orange-300 space-y-1.5">${rets.map((x) => { const rt = tone(x.status); return `<div data-testid="order-fulfillment-return-row-${x.id}" data-status="${esc(x.status)}" class="bg-white rounded-md p-2 shadow-sm"><div class="flex items-center gap-2">${fi('chevronRight', { cls: 'w-3 h-3 text-slate-400 flex-shrink-0 transform rotate-180' })}${fi('rotateCcw', { cls: `w-3.5 h-3.5 ${rt.text} flex-shrink-0` })}<div class="flex-1">
        <div class="flex items-center gap-2"><span class="text-xs font-medium text-slate-700">Return</span><span class="font-mono text-xs text-slate-600">${esc(x.number)}</span>${copyBtn(x.number, 'Return', `order-fulfillment-copy-return-btn-${x.id}`, 'Copy return reference')}</div>
        <div class="flex items-center gap-2 mt-0.5"><div class="w-1.5 h-1.5 rounded-full ${rt.dot}"></div><span class="text-xs ${rt.text} capitalize">${esc(x.status.replace(/_/g, ' '))}</span><span class="text-xs text-slate-500">${count(x.items.length)}</span></div>
      </div></div></div>`; }).join('')}</div>` : ''}
    </div></div>`;
  }).join('');
  return `<div class="p-3 sm:p-6 bg-white"><div class="space-y-2">${cards}</div></div>`;
}

export function renderFulfilment(m, s, r) {
  const active = s.tabs[r.id] || 'details';
  const n = r.order.items.length;
  const tabs = TABS.map((t) => `<button data-act="tab" data-id="${r.id}" data-tab="${t.id}" data-testid="order-fulfillment-tab-${t.id}-${r.id}" data-status="${active === t.id ? 'active' : 'inactive'}" class="${cls('flex-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors', active === t.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700')}"><div class="flex items-center justify-center gap-1.5">${fi(t.icon, { size: 14 })}<span class="truncate">${t.label}${t.id === 'items' && n > 0 ? `<span> (<!---->${n}<!---->)</span>` : ''}</span></div></button>`).join('');
  const body = { details: () => details(m, s, r), items: () => items(r), comments: () => comments(r), fulfillment: () => fulfillment(r) }[active]();
  return `<div data-testid="order-fulfillment-metadata-${r.id}" class="border-t border-slate-200"><div class="flex border-b border-slate-200 bg-white">${tabs}</div><div class="${active === 'fulfillment' ? '' : 'p-3 sm:p-6 bg-white'}">${body}</div></div>`;
}

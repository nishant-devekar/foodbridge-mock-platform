/*
  The list region: loading skeleton, error, empty state, and the table itself — a desktop row and
  a phone card per order (both are always in the DOM; CSS shows one), the expanded fulfilment
  panel, and the pager.
*/
import { fi } from '../components/icons.js';
import { esc, attr, cls } from '../components/dom.js';
import { renderFulfilment } from './fulfilment.js';

const dateLabel = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const timeLabel = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

// ── Loading skeleton (TableLoading: 12 rows × 7 columns, 160 × 20) ──────────────────────────
function skeleton(count, { w, h, base, hi, extra }) {
  const one = `<span class="react-loading-skeleton ${extra}" style="width: ${w}px; height: ${h}px; --base-color: ${base}; --highlight-color: ${hi};">‌</span>`;
  return `<span aria-live="polite" aria-busy="true">${one.repeat(count)}</span>`;
}
function renderLoading() {
  const rows = Array.from({ length: 12 }, () => `<div>${skeleton(7, { w: 160, h: 20, base: '#d7d7d7cd', hi: '#E5E7EB', extra: 'mx-1 my-1 dark:bg-gray-800 bg-gray-200' })}</div>`).join('');
  const foot = skeleton(1, { w: 290, h: 25, base: '#d7d7d7cd', hi: '#F9FAFB', extra: 'dark:bg-gray-800 bg-gray-200' });
  return `<div class="w-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg mb-8" data-testid="orders-list-loading">
    <div class="text-center">${skeleton(7, { w: 160, h: 40, base: '#d7d7d7cd', hi: '#f5f8faff', extra: 'mx-1 my-1 dark:bg-gray-200 bg-gray-200' })}${rows}</div>
    <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white text-gray-500 dark:text-gray-400 dark:bg-gray-800 flex justify-between">${foot}${foot}</div>
  </div>`;
}

const renderEmpty = (m) => `<div class="text-center align-middle mx-auto p-5 my-5" data-testid="orders-list-empty"><div class="flex justify-center"><img class="my-4 w-full max-w-xs sm:max-w-sm md:max-w-md" src="assets/img/no-result.svg" alt="no-result"></div><h2 class="text-lg md:text-xl lg:text-2xl xl:text-2xl text-center mt-2 font-medium font-serif text-gray-600">We're sorry, <!---->but no ${esc(m.label.toLowerCase())} are available at the moment.</h2></div>`;

// ── Pieces of a row ─────────────────────────────────────────────────────────────────────────
function invoiceButton(r, mobile) {
  const base = mobile
    ? 'inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap'
    : 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  return `<button${attr('disabled', r.invoiceDisabled)} data-act="invoice-menu" data-id="${r.id}" class="${base}" title="View Invoice" data-testid="order-invoice-btn-${mobile ? 'mobile-' : ''}${r.id}">${fi('fileText', { size: 14 })}<span>Invoice</span>${fi('chevronDown', { size: 12, cls: 'flex-shrink-0' })}</button>`;
}

function chips(r) {
  const c = r.counts;
  if (!(c.dispatches || c.deliveries || c.returns)) return '';
  const chip = (n, dot, text, id, word) => `<div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full ${dot}"></div><button data-act="toggle" data-id="${r.id}" data-testid="order-${id}-count-btn-${r.id}" class="text-xs font-medium ${text}">${word}</button></div>`;
  return `<div class="flex items-center gap-2">${[
    c.dispatches ? chip(c.dispatches, 'bg-emerald-500', 'text-emerald-600', 'dispatch', `${c.dispatches}<!----> dispatch<!---->${c.dispatches > 1 ? 'es' : ''}`) : '',
    c.deliveries ? chip(c.deliveries, 'bg-purple-500', 'text-purple-600', 'delivery', `${c.deliveries}<!----> deliver<!---->${c.deliveries > 1 ? 'ies' : 'y'}`) : '',
    c.returns ? chip(c.returns, 'bg-orange-500', 'text-orange-600', 'return', `${c.returns}<!----> return<!---->${c.returns > 1 ? 's' : ''}`) : '',
  ].join('')}</div>`;
}

function statusCell(r) {
  if (r.locked) {
    return `<select value="${esc(r.locked.status)}" disabled="" data-testid="order-status-select-locked-${r.id}" class="w-full min-w-[140px] px-2.5 py-1.5 text-sm font-medium rounded-md border border-slate-200 bg-slate-50 cursor-not-allowed text-slate-400"><option value="${esc(r.locked.status)}">${esc(r.locked.label)}</option></select>`;
  }
  const on = !r.statusDisabled;
  return `<select data-act-change="status-change" data-id="${r.id}"${attr('disabled', !on)} data-testid="order-status-select-${r.id}" class="w-full min-w-[140px] px-2.5 py-1.5 text-sm font-medium rounded-md border transition-all duration-200 ${on ? 'border-slate-300 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer' : 'border-slate-200 bg-slate-50 cursor-not-allowed text-slate-400'}">${r.statusOptions.map((s) => `<option value="${esc(s)}"${s === r.order.status ? ' selected' : ''}>${esc(titleCase(s))}</option>`).join('')}</select>`;
}
const titleCase = (s) => String(s).toLowerCase().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

function allocationCell(r) {
  const a = r.allocation;
  const tone = a.status === 'complete' ? 'text-emerald-700' : a.status === 'partial' ? 'text-amber-700' : 'text-slate-600';
  const bar = a.status === 'complete' ? 'bg-emerald-500' : a.status === 'partial' ? 'bg-amber-500' : 'bg-slate-400';
  return `<td class="px-4 py-2 py-4 px-6 w-[200px]"><div data-testid="order-allocation-status-${r.id}" data-status="${a.status}" class="flex flex-col gap-2">
    <div class="flex items-center justify-between"><div class="flex items-center gap-1.5"><span class="text-xs font-medium ${tone}">${a.label}</span>
      <span data-tooltip="Shows how much of the order quantity has been dispatched" data-testid="order-allocation-status-tooltip-${r.id}" class="text-md">${fi('info', { style: 'color: rgb(100, 116, 139); font-size: 12px;' })}</span></div>
      <span class="text-sm font-semibold ${tone}">${a.percentage}<!---->%</span></div>
    <div class="relative w-full bg-slate-200 rounded-full h-2 overflow-hidden"><div class="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${bar}" style="width: ${a.percentage}%;"></div></div>
  </div></td>`;
}

function actionsCell(m, r) {
  const L = m.label;
  const editTip = r.editAllowed ? `Edit ${L}` : `Cannot edit ${r.order.status} ${L.toLowerCase()}`;
  return `<td class="px-4 py-2 py-4 px-6 w-[180px]"><div class="flex items-center justify-center gap-1">
    <button${attr('disabled', !r.editAllowed)} data-act="edit" data-id="${r.id}" data-testid="order-edit-btn-${r.id}" class="group/btn relative p-2 rounded-md transition-all duration-200 ${r.editAllowed ? 'hover:bg-slate-100' : 'opacity-40 cursor-not-allowed'}"><span data-tooltip="${esc(editTip)}" data-testid="order-edit-tooltip-${r.id}" class="text-md">${fi('edit', { style: `color: ${r.editAllowed ? 'rgb(71, 85, 105)' : 'rgb(148, 163, 184)'}; font-size: 16px;` })}</span></button>
    <a data-act="timeline" data-id="${r.id}" data-testid="order-timeline-btn-${r.id}" class="group/btn relative p-2 rounded-md hover:bg-slate-100 transition-all duration-200" href="#/order-timeline/${esc(r.number)}/${esc(r.order.status)}"><span data-tooltip="View Timeline" data-testid="order-timeline-tooltip-${r.id}" class="text-md">${fi('clock', { style: 'color: rgb(71, 85, 105); font-size: 16px;' })}</span></a>
    <a data-act="view" data-id="${r.id}" data-testid="order-view-btn-${r.id}" class="group/btn relative p-2 rounded-md hover:bg-slate-100 transition-all duration-200" href="#/order/${esc(r.number)}/${esc(r.order.status)}"><span data-tooltip="View ${esc(L)}" data-testid="order-view-tooltip-${r.id}" class="text-md">${fi('eye', { style: 'color: rgb(71, 85, 105); font-size: 16px;' })}</span></a>
  </div></td>`;
}

function desktopRow(m, s, r) {
  const expanded = s.expanded.includes(r.id);
  const copied = s.copied === r.number;
  return `<tr class="group hidden hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent transition-all duration-200 border-b border-slate-100 md:table-row" data-testid="order-row-${r.id}" data-status="${esc(r.order.status)}">
    <td class="px-4 py-2 py-4 px-6 w-[200px]"><div class="flex items-center gap-3">
      <button data-act="toggle" data-id="${r.id}" data-testid="order-row-toggle-${r.id}" class="p-1.5 -ml-1 hover:bg-slate-200 rounded-lg transition-all duration-200 hover:shadow-sm" aria-label="${expanded ? 'Collapse deliveries' : 'Expand deliveries'}">${fi(expanded ? 'chevronUp' : 'chevronDown', { cls: 'w-4 h-4 text-slate-600' })}</button>
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold text-slate-900 tracking-tight">${esc(r.number)}</span>
          <button data-act="copy" data-value="${esc(r.number)}" data-testid="order-copy-id-btn-${r.id}" class="p-1 rounded-md hover:bg-slate-100 transition-all duration-200 group/copy" title="${copied ? 'Copied!' : `Copy ${esc(m.label)} Id`}">${copied ? fi('check', { cls: 'w-3.5 h-3.5 text-emerald-500' }) : fi('copy', { cls: 'w-3.5 h-3.5 text-slate-400 group-hover/copy:text-slate-600' })}</button>
          <div class="relative inline-block" data-insights="${r.id}"><button data-testid="order-insights-btn-${r.id}" aria-label="Show order insights" class="p-1 rounded-md hover:bg-purple-50 transition-all duration-200">${fi('zap', { cls: 'w-3.5 h-3.5 text-purple-600' })}</button></div>
        </div>
        ${chips(r)}
      </div>
    </div></td>
    <td class="px-4 py-2 py-4 px-6 w-[140px]"><div class="flex flex-col gap-0.5"><span class="text-sm text-slate-700">${dateLabel(r.createdAt)}</span><span class="text-xs text-slate-500">${timeLabel(r.createdAt)}</span></div></td>
    <td class="px-4 py-2 py-4 px-6 w-[180px]"><span class="text-sm font-medium text-slate-900">${esc(r.customerName)}</span><div class="text-xs text-slate-500">${esc(r.customerPhone)}</div></td>
    <td class="px-4 py-2 py-4 px-6 w-[130px]"><div class="flex flex-col items-start"><span class="text-sm font-semibold text-slate-900">${esc(m.currency)}<!---->&nbsp;<!---->${r.amount}</span></div></td>
    <td class="px-4 py-2 py-4 px-6 w-[160px]">${statusCell(r)}</td>
    ${m.features.allocationStatus ? allocationCell(r) : ''}
    ${m.features.invoiceColumn ? `<td class="px-4 py-2 py-4 px-6 w-[120px]"><div class="flex items-center justify-center">${invoiceButton(r, false)}</div></td>` : ''}
    ${actionsCell(m, r)}
  </tr>
  ${expanded ? `<tr data-testid="order-fulfillment-row-${r.id}" class="hidden bg-gray-50 md:table-row"><td colspan="${6 + (m.features.allocationStatus ? 1 : 0) + (m.features.invoiceColumn ? 1 : 0)}" class="px-4 py-2 p-4">${renderFulfilment(m, s, r)}</td></tr>` : ''}`;
}

const STATUS_TONE = (status = '') => {
  const n = status.toLowerCase();
  if (n.includes('deliver') || n.includes('complete')) return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10';
  if (n.includes('cancel') || n.includes('reject')) return 'bg-rose-50 text-rose-700 ring-rose-600/10';
  if (n.includes('progress') || n.includes('transit')) return 'bg-blue-50 text-blue-700 ring-blue-600/10';
  if (n.includes('pending') || n.includes('process')) return 'bg-amber-50 text-amber-700 ring-amber-600/10';
  return 'bg-slate-100 text-slate-700 ring-slate-600/10';
};

function mobileCard(m, s, r) {
  const o = r.order;
  const expanded = s.expanded.includes(r.id);
  const c = r.counts;
  const status = r.mobileCanChangeStatus
    ? `<label class="relative inline-flex items-center rounded-md ring-1 ring-inset ${STATUS_TONE(o.status)}"><span class="pointer-events-none absolute right-1.5 text-current">${fi('chevronDown', { cls: 'h-3 w-3' })}</span><select data-act-change="status-change" data-id="${r.id}" aria-label="Change status for order ${esc(r.number)}" data-testid="order-status-select-mobile-${r.id}" class="cursor-pointer appearance-none border-0 bg-transparent py-1 pl-2 pr-6 text-[10px] font-semibold capitalize text-current outline-none">${r.statusOptions.map((x) => `<option value="${esc(x)}" class="bg-white text-slate-800"${x === o.status ? ' selected' : ''}>${esc(String(x).replace(/_/g, ' '))}</option>`).join('')}</select></label>`
    : `<span data-testid="order-status-badge-mobile-${r.id}" class="inline-flex rounded-md px-2 py-1 text-[10px] font-semibold capitalize ring-1 ring-inset ${STATUS_TONE(o.status)}">${esc(String(o.status || 'Pending').replace(/_/g, ' '))}</span>`;
  return `<tr class="block w-full border-0 bg-transparent pb-3 md:hidden" data-testid="order-row-mobile-${r.id}" data-status="${esc(o.status)}"><td class="block p-0">
    <div data-testid="order-card-mobile-${r.id}" data-status="${esc(o.status)}" class="md:hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div role="button" tabindex="0" data-act="toggle" data-id="${r.id}" aria-expanded="${expanded}" data-testid="order-card-mobile-toggle-${r.id}" class="w-full px-4 py-3.5 text-left transition-colors active:bg-slate-50">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5"><span class="truncate text-sm font-bold tracking-tight text-slate-800">${esc(r.number)}</span>
              <span role="button" tabindex="0" data-act="copy" data-value="${esc(r.number)}" aria-label="Copy order reference" data-testid="order-copy-btn-mobile-${r.id}" class="rounded p-1 text-violet-500 transition-colors hover:bg-violet-50">${fi('copy', { cls: 'h-3.5 w-3.5' })}</span>
              ${fi('zap', { cls: 'h-3.5 w-3.5 flex-shrink-0 text-violet-500' })}</div>
            ${c.dispatches || c.deliveries || c.returns ? `<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium">${[
              c.dispatches ? `<span class="text-emerald-600"><span class="mr-1">●</span>${c.dispatches}<!----> dispatch<!---->${c.dispatches > 1 ? 'es' : ''}</span>` : '',
              c.deliveries ? `<span class="text-violet-600"><span class="mr-1">●</span>${c.deliveries}<!----> deliver<!---->${c.deliveries > 1 ? 'ies' : 'y'}</span>` : '',
              c.returns ? `<span class="text-orange-600"><span class="mr-1">●</span>${c.returns}<!----> return<!---->${c.returns > 1 ? 's' : ''}</span>` : '',
            ].join('')}</div>` : ''}
          </div>
          <div class="flex-shrink-0 text-right">${status}
            <div class="mt-1.5 text-[11px] leading-4 text-slate-500"><div>${r.createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div><div>${timeLabel(r.createdAt)}</div></div>
          </div>
        </div>
        <div class="mt-3 flex items-end justify-between gap-3">
          <div class="flex min-w-0 items-start gap-2">${fi('user', { cls: 'mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400' })}<div class="min-w-0"><div class="truncate text-xs font-semibold text-slate-800">${esc(r.customerName || 'Customer')}</div>${r.rawPhone ? `<div class="mt-0.5 text-[11px] text-slate-500">${esc(r.rawPhone)}</div>` : ''}</div></div>
          <div class="flex-shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-slate-900">${esc(r.total)}</div>
        </div>
      </div>
      <div class="flex items-center border-t border-slate-100 bg-slate-50/70">
        <button type="button" data-act="toggle" data-id="${r.id}" aria-expanded="${expanded}" data-testid="order-card-details-toggle-mobile-${r.id}" class="flex min-w-0 flex-1 items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"><span>${expanded ? 'Hide order details' : 'View order details'}</span>${fi('chevronDown', { cls: `h-4 w-4 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}` })}</button>
        ${m.features.invoiceColumn ? `<div class="shrink-0 border-l border-slate-200 px-2">${invoiceButton(r, true)}</div>` : ''}
      </div>
      ${expanded ? `<div data-testid="order-card-expanded-mobile-${r.id}" class="border-t border-slate-100">${renderFulfilment(m, s, r)}</div>` : ''}
    </div>
  </td></tr>`;
}

function pager(s, total) {
  const limit = s.limit;
  const pages = Math.ceil(total / limit);
  const cur = s.page;
  const nums = [];
  if (pages <= 6) for (let i = 1; i <= pages; i += 1) nums.push(i);
  else {
    nums.push(1);
    if (cur > 3) nums.push('left-ellipsis');
    for (let i = Math.max(2, cur - 1); i <= Math.min(pages - 1, cur + 1); i += 1) nums.push(i);
    if (cur < pages - 2) nums.push('right-ellipsis');
    nums.push(pages);
  }
  const btn = (p) => (typeof p === 'string'
    ? '<span class="px-2 text-gray-500 dark:text-gray-400 font-medium">...</span>'
    : `<li><button data-act="page" data-page="${p}" type="button" data-testid="orders-pagination-page-${p}" class="align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-3 py-1 rounded-md text-xs ${cur === p ? 'text-white bg-green-500 hover:bg-green-600' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}">${p}</button></li>`);
  const start = (cur - 1) * limit + 1;
  const end = Math.min(cur * limit, total);
  return `<div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white text-gray-500 dark:text-gray-400 dark:bg-gray-800"><div class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm">
    <span class="font-semibold tracking-wide uppercase text-xs" data-testid="orders-pagination-summary">SHOWING <!---->${start}<!---->–<!---->${end}<!----> OF <!---->${total}</span>
    <div class="mt-2 sm:mt-0"><nav aria-label="Table navigation"><ul class="inline-flex items-center space-x-2">
      <li><button data-act="page" data-page="${cur - 1}"${attr('disabled', cur === 1)} data-testid="orders-pagination-prev-btn" class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">‹</button></li>
      ${nums.map(btn).join('')}
      <li><button data-act="page" data-page="${cur + 1}"${attr('disabled', cur === pages)} data-testid="orders-pagination-next-btn" class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">›</button></li>
    </ul></nav></div>
  </div></div>`;
}

const TH = (label, w, center) => `<td class="px-4 py-2 py-3.5 px-6 ${w}${center ? ' text-center' : ''}"><span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">${label}</span></td>`;

export function renderList(m, s) {
  if (s.error) return `<span data-testid="orders-list-error" class="text-center mx-auto text-red-500">${esc(s.error)}</span>`;
  const result = s.result;
  const visible = result ? m.visibleOnPage(result.orders, s.status) : [];
  let body = '';
  if (result) {
    body = visible.length
      ? `<div class="overflow-visible"><div class="w-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg mb-8 overflow-visible border-0 bg-transparent shadow-none md:overflow-hidden md:rounded-lg md:border md:border-slate-200 md:bg-white md:shadow-sm"><div class="w-full overflow-x-auto"><table class="block w-full table-auto md:table">
        <thead class="text-sm font-medium tracking-wide text-left text-zinc-500 uppercase border-b border-gray-200 dark:border-gray-700 bg-white dark:text-gray-400 dark:bg-gray-800 hidden bg-slate-50 border-b-2 border-slate-200 md:table-header-group"><tr>
          ${TH(`${esc(m.label)}<!----> ID`, 'w-[200px]')}${TH('Date', 'w-[140px]')}${TH('Customer', 'w-[180px]')}${TH('Amount', 'w-[130px]')}${TH('Status', 'w-[160px]')}
          ${m.features.allocationStatus ? TH('Allocation Status', 'w-[180px]') : ''}${m.features.invoiceColumn ? TH('INVOICE', 'w-[160px]', true) : ''}${TH('Actions', 'w-[160px]', true)}
        </tr></thead>
        <tbody class="bg-white divide-y divide-gray-100 dark:divide-gray-700 dark:bg-gray-800 text-gray-800 dark:text-gray-400 block w-full md:table-row-group" data-testid="orders-list">
          ${visible.map((o) => { const r = m.row(o); return mobileCard(m, s, r) + desktopRow(m, s, r); }).join('')}
        </tbody></table></div>${pager(s, result.totalDoc)}</div></div>`
      : renderEmpty(m);
  }
  return `<div class="relative">${s.loading ? renderLoading() : ''}<div${attr('class', s.loading ? 'hidden' : null)}>${body}</div></div>`;
}

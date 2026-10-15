/*
  The status-change audit: moving an order to its next status opens this drawer instead of
  changing it outright. The operator confirms the quantity of every line (a mismatch is a
  "variance" and then needs a comment), sees the order total, and submits — only then does the
  order move, and the move is recorded as a stage in the order's audit trail.

  State (owned by screen.js):
    { orderId, newStatus, received: { [productId]: value }, comment, commentError, discardOpen }
*/
import { fi, lucide } from '../components/icons.js';
import { esc, cls, attr } from '../components/dom.js';
import { toTitleCase } from './model.js';

// The product's image placeholder for a line with no picture (a flat grey tile).
const NO_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAVAAAAEYAQMAAAAwLTybAAAAA1BMVEXy8vJkA4prAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAAI0lEQVRoge3BAQ0AAADCoPdPbQ43oAAAAAAAAAAAAAAA4McALwgAAQoNfCUAAAAASUVORK5CYII=';
const image = () => `<span class="contents"><img class="hidden mr-2 md:block shadow-none rounded-custom object-fit-scale-down" src="${NO_IMAGE}" alt="product" loading="lazy" decoding="async" style="width: 32px; height: 32px;"></span>`;

/** Match when the confirmed quantity equals the expected one; otherwise the signed difference. */
function badge(expected, input) {
  const e = Number(expected) || 0;
  const i = Number(input) || 0;
  if (e === i) return { label: 'Match', cls: 'bg-green-100 text-green-700 border border-green-200' };
  const d = i - e;
  return { label: d > 0 ? `+${d}` : `${d}`, cls: 'bg-red-100 text-red-700 border border-red-200' };
}

/** Everything the drawer shows, derived from the order and what has been typed. */
export function auditView(m, a) {
  // The order as it was when the drawer opened (the product's drawer holds the order it was
  // opened with, and keeps showing that until it is opened again).
  const order = a.order || m.data.orderById.get(a.orderId);
  const lines = order.items.map((l) => {
    const received = a.received[l.productId] ?? l.qty;
    const unit = m.unitPrice(l);
    return { ...l, expected: l.qty, received, unit, total: unit * (Number(received) || 0), badge: badge(l.qty, received) };
  });
  const raw = lines.reduce((s, l) => s + l.total, 0);
  const rounded = Math.round(raw);
  const roundOff = rounded - raw;
  const stages = [...(order.stageAudit || []).map((s) => s.status)];
  if (!stages.includes(order.status)) stages.push(order.status);
  if (!stages.includes(a.newStatus)) stages.push(a.newStatus);
  return {
    order,
    lines,
    variance: lines.some((l) => Number(l.expected) !== Number(l.received)),
    unsaved: !!a.comment.trim() || lines.some((l) => Number(l.expected) !== Number(l.received)),
    roundOffEnabled: m.roundedAmounts,
    roundOff: `${roundOff >= 0 ? '+' : '-'}${m.formatCurrency(Math.abs(roundOff))}`,
    total: m.formatCurrency(m.roundedAmounts ? rounded : raw),
    stages,
    completed: new Set((order.stageAudit || []).map((s) => s.status)),
  };
}

function breadcrumb(v, a) {
  const all = v.stages.map((stage, index) => ({ stage, index }));
  const shown = all.length > 4 ? [all[0], { ellipsis: true }, all[all.length - 2], all[all.length - 1]] : all;
  return shown.map((it, i) => {
    if (it.ellipsis) return '<div class="flex items-center gap-2"><span class="text-gray-400 font-medium">...</span><span class="text-gray-300 mx-1">&gt;</span></div>';
    const done = v.completed.has(it.stage);
    const current = it.stage === a.newStatus;
    const dot = done
      ? `<span class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">${fi('check', { cls: 'w-3 h-3 text-white' })}</span>`
      : current ? '<span class="w-5 h-5 rounded-full bg-green-500 border-2 border-green-500"></span>'
        : '<span class="w-5 h-5 rounded-full border-2 border-gray-300 bg-white"></span>';
    return `<div class="flex items-center gap-2"><div class="flex items-center gap-1.5">${dot}<span class="${done || current ? 'text-gray-900 font-medium' : 'text-gray-400'}">${esc(toTitleCase(it.stage))}</span></div>${i < shown.length - 1 ? '<span class="text-gray-300 mx-1">&gt;</span>' : ''}</div>`;
  }).join('');
}

function mobileRow(m, l, a) {
  const id = l.productId;
  const open = a.detailOpen?.[id];
  return `<div class="px-3 py-2.5" data-testid="audit-drawer-item-row-mobile-${id}">
    <div class="flex items-start gap-2"><div class="flex-shrink-0">${image()}</div>
      <div class="min-w-0 flex-1"><div class="font-medium text-gray-900 text-xs leading-tight truncate">${esc(l.name)}</div><div class="text-[10px] text-gray-500 truncate">Art No: <!---->${esc(l.articleNo)}</div></div>
      <span class="flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap ${l.badge.cls}">${l.badge.label}</span></div>
    <div class="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100">
      <div class="flex items-center gap-1.5 min-w-0 text-[11px]">
        <span class="text-gray-500 tabular-nums whitespace-nowrap"><span class="text-gray-400">Exp:</span> <!---->${l.expected}</span>
        <span class="text-gray-300 flex-shrink-0">→</span>
        <div class="flex items-center flex-shrink-0 bg-gray-50 border border-gray-200 rounded-md">
          <button type="button" data-act="audit-step" data-id="${id}" data-step="-1" class="w-5 h-5 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-l-md" aria-label="Decrease received quantity" data-testid="audit-drawer-item-qty-decrease-${id}">−</button>
          <input type="number" data-audit-qty="${id}" data-testid="audit-drawer-item-qty-input-mobile-${id}" class="w-8 text-center text-[11px] tabular-nums border-0 bg-transparent py-0.5 focus:outline-none focus:ring-0 [appearance:textfield] [&amp;::-webkit-inner-spin-button]:appearance-none [&amp;::-webkit-outer-spin-button]:appearance-none" value="${esc(l.received)}">
          <button type="button" data-act="audit-step" data-id="${id}" data-step="1" class="w-5 h-5 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-r-md" aria-label="Increase received quantity" data-testid="audit-drawer-item-qty-increase-${id}">+</button>
        </div>
      </div>
      <button type="button" data-act="audit-detail" data-id="${id}" class="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-emerald-700" aria-expanded="${!!open}" data-testid="audit-drawer-item-detail-toggle-${id}">${m.formatCurrency(l.total)}${fi('chevronDown', { cls: `w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}` })}</button>
    </div>
    ${open ? `<div class="flex items-center justify-between gap-2 text-[10px] text-gray-500 bg-gray-50 rounded-md px-2 py-1 mt-1.5"><span>Unit <!---->${m.formatCurrency(l.unit)}</span><span>× <!---->${esc(l.received)}</span><span class="font-semibold text-emerald-700">${m.formatCurrency(l.total)}</span></div>` : ''}
  </div>`;
}

function desktopRow(m, l) {
  const id = l.productId;
  return `<tr data-testid="audit-drawer-item-row-desktop-${id}" class="hover:bg-gray-50">
    <td class="px-3 py-3 align-middle"><div class="flex items-center gap-2 min-w-0"><div class="flex-shrink-0">${image()}</div><div class="min-w-0"><div class="font-medium text-gray-900 text-xs leading-tight break-words">${esc(l.name)}</div><div class="text-xs text-gray-500 truncate">Art No: <!---->${esc(l.articleNo)}</div></div></div></td>
    <td class="px-2 py-3 text-center align-middle"><div class="flex flex-col items-center text-gray-700 font-medium text-xs"><span>${l.expected}</span></div></td>
    <td class="px-2 py-3 align-middle"><div class="flex flex-col items-center gap-0.5"><input class="block w-full h-10 border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none dark:text-gray-300 leading-5 rounded-md bg-gray-100 focus:bg-white dark:focus:bg-gray-700 focus:border-gray-200 border-gray-200 dark:border-gray-600 dark:focus:border-gray-500 dark:bg-gray-700 text-center text-xs" type="number" data-audit-qty="${id}" data-testid="audit-drawer-item-qty-input-desktop-${id}" style="width: 106px; min-height: 32px;" value="${esc(l.received)}"></div></td>
    <td class="px-2 py-3 text-center align-middle"><span class="px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${l.badge.cls}">${l.badge.label}</span></td>
    <td class="px-2 py-3 text-center align-middle text-xs font-medium text-gray-700">${m.formatCurrency(l.unit)}</td>
    <td class="px-2 py-3 text-center align-middle text-xs font-semibold text-gray-900">${m.formatCurrency(l.total)}</td>
  </tr>`;
}

export function renderAuditDrawer(m, a) {
  const v = auditView(m, a);
  const title = esc(toTitleCase(a.newStatus));
  const TH = (label, w, align = 'center', px = 'px-2') => `<th class="text-${align} ${px} py-2.5" style="width: ${w}px;">${label}</th>`;
  return `<div class="w-full flex flex-col h-full bg-white" data-testid="audit-drawer">
    <div class="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
      <h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-1">${title}</h2>
      <p class="text-xs sm:text-sm text-gray-500 break-all leading-snug">Order<!----> #<!---->${esc(v.order.number)}<!----> • Updating to:<!----> <!---->${title}</p>
    </div>
    <div class="px-6 py-3 border-b border-gray-100 bg-gray-50"><div class="flex items-center gap-2 flex-wrap text-sm">${breadcrumb(v, a)}</div></div>
    <div class="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6" data-audit-scroll><div class="pb-20 md:pb-20">
      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div class="sm:hidden">
          <div class="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between"><span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Items</span><span class="text-[10px] text-gray-400">${v.lines.length}<!----> <!---->${v.lines.length === 1 ? 'item' : 'items'}</span></div>
          <div class="divide-y divide-gray-100">${v.lines.map((l) => mobileRow(m, l, a)).join('')}</div>
        </div>
        <div class="hidden sm:block overflow-x-auto"><table class="w-full text-xs" style="min-width: 600px;">
          <thead><tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">${TH('Product', 160, 'left', 'px-3')}${TH('Expected', 80)}${TH('Input', 90)}${TH('Status', 70)}${TH('Unit Price', 100)}${TH('Total Value', 100)}</tr></thead>
          <tbody class="divide-y divide-gray-100">${v.lines.map((l) => desktopRow(m, l)).join('')}</tbody>
        </table></div>
      </div>
      <div class="flex items-center justify-between gap-3 px-4 py-3 mb-6 rounded-lg border border-gray-200 bg-gray-50">
        <span class="text-xs font-semibold uppercase tracking-wide text-gray-600">Order Total</span>
        <div class="flex items-center gap-2">${v.roundOffEnabled ? `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 whitespace-nowrap">round off <!---->${v.roundOff}</span>` : ''}<span class="text-lg font-extrabold text-gray-900">${v.total}</span></div>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">
        <div class="px-4 py-3 bg-gray-50 border-b border-gray-200"><h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Comment for this stage${v.variance ? '<span class="text-red-500 ml-1">*</span>' : ''}</h3></div>
        <div class="p-4">
          <textarea data-audit-comment placeholder="Comment for this stage" rows="3" aria-invalid="${!!a.commentError}" data-testid="audit-drawer-comment-textarea" class="${cls('w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 resize-none', a.commentError ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-200 focus:ring-green-500 focus:border-green-500')}">${esc(a.comment)}</textarea>
          ${a.commentError ? '<p class="mt-1.5 text-xs text-red-600">Please enter a reason for the variance</p>' : ''}
        </div>
      </div>
    </div></div>
    <div class="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-200 sm:justify-end">
      <button data-act="drawer-close" data-testid="audit-drawer-cancel-btn" class="flex-1 sm:flex-initial text-sm h-11 sm:h-10 px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 font-medium transition-colors">Cancel</button>
      <button type="button" data-act="audit-submit"${attr('disabled', a.submitting)} data-testid="audit-drawer-submit-btn" class="align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-4 py-2 rounded-md text-sm text-white bg-green-600 border border-transparent active:bg-green-700 hover:bg-green-700 flex-[2] sm:flex-initial text-sm h-11 sm:h-10 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium flex items-center justify-center gap-2 transition-colors">${a.submitting ? '<span>Submitting...</span><div class="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>' : `<span>${title}</span>${lucide('arrow-right', { cls: 'w-4 h-4' })}`}</button>
    </div>
  </div>`;
}

/** The product's "discard changes?" confirmation, shown when closing with unsaved input. */
export const discardContent = () => `<div class="w-full text-center">
  <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-900/30"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-triangle-alert h-5 w-5 text-amber-600"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"></path><path d="M12 9v4"></path><path d="M12 17h.01"></path></svg></span>
  <h1 class="text-base font-semibold text-gray-900 dark:text-gray-100">Discard Changes</h1>
  <p class="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Are you sure you want to discard the changes ?</p>
  <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
    <button type="button" data-act="discard-wait" data-testid="discard-changes-modal-cancel-btn" class="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 sm:w-auto">No, Wait</button>
    <button type="button" data-act="discard-confirm" data-testid="discard-changes-modal-confirm-btn" class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-transparent bg-amber-600 px-5 text-sm font-medium text-white transition-colors hover:bg-amber-700 active:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-300 sm:w-auto">Yes, Discard</button>
  </div>
</div>`;

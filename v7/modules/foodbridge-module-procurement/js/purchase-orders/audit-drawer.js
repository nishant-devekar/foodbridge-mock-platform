/*
  A row's status change: UpdateAuditDrawer (narrowed to PURCHASE_ORDER) in a MainDrawer.

  Opens with each line's expected quantity (the last stage's verified quantity, else the ordered
  one) as the received quantity; a difference is a variance, and a variance needs a comment. The
  submit writes one stage-audit entry through the order graph (POST /v3/purchase/order/stage-audit)
  whose challan carries the received quantities — and from then on those ARE the order's lines.
  Closing with unsaved changes asks first (DiscardChangesModal), whichever way the close came.
*/
import { esc } from '../components/dom.js';
import { fi, lucide } from '../components/icons.js';
import { createMainDrawer } from '../components/drawer.js';
import { discardChangesModal } from '../components/modal.js';
import { buttonClass, inputClass, displayImage } from '../components/windmill.js';

const T = '<!---->';
const COMMENT_PREFIX = 'shippingAddressUpdate::';
const MATCH = 'bg-green-100 text-green-700 border border-green-200';
const VARIANCE = 'bg-red-100 text-red-700 border border-red-200';

/** getStatusBadge: "Match", or the signed difference. */
function badge(expected, input) {
  const e = Number(expected) || 0;
  const i = Number(input) || 0;
  if (e === i) return { label: 'Match', className: MATCH };
  const diff = i - e;
  return { label: diff > 0 ? `+${diff}` : `${diff}`, className: VARIANCE };
}

/** The drawer's accordion date: en-US, "Sep 28, 2026, 10:25 AM". */
const auditDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '');

export function createAuditDrawer(host, server, { onClosed }) {
  let st = null; // the open drawer's state; null when closed (production unmounts it)
  let pendingResolve = null;
  const drawer = createMainDrawer({ onClose: () => close() });

  const humanStages = (node) => (node.stageAudit || []).filter((a) => !(typeof a?.comment === 'string' && a.comment.startsWith(COMMENT_PREFIX)));
  const stages = () => humanStages(st.node);
  const unitPriceOf = (p) => host.roundPrice(host.calculateItemPrice({ ...p, qty: 1 }));
  const hasVariance = () => st.products.some((p) => (Number(p.receiving) || 0) !== (Number(p.received) || 0));
  const hasUnsaved = () => Boolean(st.comment.trim()) || st.products.some((p) => Number(p.receiving) !== Number(p.received));
  const showVoucher = () => Boolean(st.node.supplier_id) && host.getDeliveryAllowedStatuses().includes(st.node.status);
  const t = (s) => host.toTitleCase(s);

  function open(node, newStatus) {
    const last = humanStages(node).at(-1);
    st = {
      node, newStatus, comment: '', commentError: false, voucher: '', receivedDate: '', accordion: null, submitting: false, discard: false, details: {},
      products: (node.item_list || []).map((item) => {
        const prev = last?.challan?.find((p) => p.id === item.id) || null;
        const expected = prev ? Number(prev.verifiedQty) : Number(item.qty) || 0;
        return { ...item, receiving: expected, received: expected, expectedQty: expected };
      }),
    };
    drawer.registerBeforeClose(async () => {
      if (!hasUnsaved()) return true;
      return new Promise((resolve) => { pendingResolve = resolve; st.discard = true; render(); });
    });
    render(true);
  }

  function close() {
    drawer.destroy();
    st = null;
    pendingResolve = null;
    onClosed?.();
  }

  // ── Views ─────────────────────────────────────────────────────────────────────────────────
  function breadcrumb() {
    const done = stages().map((s) => s.status);
    const all = [...done];
    if (st.node.status && !all.includes(st.node.status)) all.push(st.node.status);
    if (st.newStatus && !all.includes(st.newStatus)) all.push(st.newStatus);
    const n = all.length;
    const visible = n > 4
      ? [{ stage: all[0] }, { ellipsis: true }, { stage: all[n - 2] }, { stage: all[n - 1] }]
      : all.map((stage) => ({ stage }));
    return visible.map((v, i) => {
      if (v.ellipsis) return '<div class="flex items-center gap-2"><span class="text-gray-400 font-medium">...</span><span class="text-gray-300 mx-1">&gt;</span></div>';
      const completed = stages().some((s) => s.status === v.stage);
      const current = v.stage === st.newStatus;
      const dot = completed ? `<span class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">${fi('FiCheck', { cls: 'w-3 h-3 text-white' })}</span>`
        : current ? '<span class="w-5 h-5 rounded-full bg-green-500 border-2 border-green-500"></span>'
          : '<span class="w-5 h-5 rounded-full border-2 border-gray-300 bg-white"></span>';
      return `<div class="flex items-center gap-2"><div class="flex items-center gap-1.5">${dot}<span class="${completed || current ? 'text-gray-900 font-medium' : 'text-gray-400'}">${esc(t(v.stage))}</span></div>${i === visible.length - 1 ? '' : '<span class="text-gray-300 mx-1">&gt;</span>'}</div>`;
    }).join('');
  }

  /** ItemCardRow (phone): stepper when editable, plain text for history. */
  function cardRow({ id, name, articleNumber, unit, expectedQty, value, editable, status, unitPrice, totalValue }) {
    const open = Boolean(st.details[id]);
    const u = unit ? ` ${unit}` : '';
    return `<div class="px-3 py-2.5"${id !== undefined ? ` data-testid="audit-drawer-item-row-mobile-${esc(id)}"` : ''}><div class="flex items-start gap-2"><div class="flex-shrink-0">${displayImage()}</div><div class="min-w-0 flex-1"><div class="font-medium text-gray-900 text-xs leading-tight truncate">${esc(name)}</div><div class="text-[10px] text-gray-500 truncate">Art No: ${T}${esc(articleNumber)}</div></div><span class="flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap ${status.className}">${esc(status.label)}</span></div>`
      + `<div class="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-100"><div class="flex items-center gap-1.5 min-w-0 text-[11px]"><span class="text-gray-500 tabular-nums whitespace-nowrap"><span class="text-gray-400">Exp:</span> ${T}${esc(expectedQty)}${T}${esc(u)}</span><span class="text-gray-300 flex-shrink-0">→</span>`
      + (editable
        ? `<div class="flex items-center flex-shrink-0 bg-gray-50 border border-gray-200 rounded-md"><button type="button" class="w-5 h-5 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-l-md" aria-label="Decrease received quantity" data-testid="audit-drawer-item-qty-decrease-${esc(id)}" data-au-step="-1" data-id="${esc(id)}">−</button><input type="number" data-testid="audit-drawer-item-qty-input-mobile-${esc(id)}" class="w-8 text-center text-[11px] tabular-nums border-0 bg-transparent py-0.5 focus:outline-none focus:ring-0 [appearance:textfield] [&amp;::-webkit-inner-spin-button]:appearance-none [&amp;::-webkit-outer-spin-button]:appearance-none" value="${esc(value)}" data-au-qty="${esc(id)}"><button type="button" class="w-5 h-5 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-r-md" aria-label="Increase received quantity" data-testid="audit-drawer-item-qty-increase-${esc(id)}" data-au-step="1" data-id="${esc(id)}">+</button></div>`
        : `<span class="text-gray-700 font-medium tabular-nums whitespace-nowrap">${esc(value)}${T}${esc(u)}</span>`)
      + `</div><button type="button" class="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-emerald-700" aria-expanded="${open}" data-testid="audit-drawer-item-detail-toggle-${esc(id)}" data-au-detail="${esc(id)}">${esc(host.formatCurrency(totalValue))}${fi('FiChevronDown', { cls: `w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}` })}</button></div>`
      + (open ? `<div class="flex items-center justify-between gap-2 text-[10px] text-gray-500 bg-gray-50 rounded-md px-2 py-1 mt-1.5"><span>Unit ${T}${esc(host.formatCurrency(unitPrice))}</span><span>× ${T}${esc(value)}${T}${esc(u)}</span><span class="font-semibold text-emerald-700">${esc(host.formatCurrency(totalValue))}</span></div>` : '')
      + `</div>`;
  }

  const th = (label, w, align = 'center', px = 'px-2') => `<th class="text-${align} ${px} py-2.5" style="width: ${w}px;">${label}</th>`;
  const qtyCell = (q, unit) => `<div class="flex flex-col items-center text-gray-700 font-medium text-xs"><span>${esc(q)}</span>${unit ? `<span class="text-[10px] text-gray-400 leading-tight">${esc(unit)}</span>` : ''}</div>`;
  const productCell = (name, art) => `<td class="px-3 py-3 align-middle"><div class="flex items-center gap-2 min-w-0"><div class="flex-shrink-0">${displayImage()}</div><div class="min-w-0"><div class="font-medium text-gray-900 text-xs leading-tight break-words">${esc(name)}</div><div class="text-xs text-gray-500 truncate">${art}</div></div></div></td>`;

  function items() {
    const n = st.products.length;
    const rows = st.products.map((p, i) => {
      const status = badge(p.receiving, p.received);
      const unitPrice = unitPriceOf(p);
      return { p, i, status, unitPrice, totalValue: unitPrice * (p.received || 0) };
    });
    return `<div class="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6">`
      + `<div class="sm:hidden"><div class="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between"><span class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Items</span><span class="text-[10px] text-gray-400">${n}${T} ${T}${n === 1 ? 'item' : 'items'}</span></div>`
      + `<div class="divide-y divide-gray-100">${rows.map(({ p, i, status, unitPrice, totalValue }) => cardRow({ id: p.id || i, name: p.name, articleNumber: p.articleNumber, unit: p.orderingUnit, expectedQty: p.receiving || 0, value: p.received, editable: true, status, unitPrice, totalValue })).join('')}</div></div>`
      + `<div class="hidden sm:block overflow-x-auto"><table class="w-full text-xs" style="min-width: 600px;"><thead><tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">${th('Product', 160, 'left', 'px-3')}${th('Expected', 80)}${th('Input', 90)}${th('Status', 70)}${th('Unit Price', 100)}${th('Total Value', 100)}</tr></thead>`
      + `<tbody class="divide-y divide-gray-100">${rows.map(({ p, i, status, unitPrice, totalValue }) => `<tr data-testid="audit-drawer-item-row-desktop-${esc(p.id || i)}" class="hover:bg-gray-50">`
        + productCell(p.name, `Art No: ${T}${esc(p.articleNumber)}`)
        + `<td class="px-2 py-3 text-center align-middle">${qtyCell(p.receiving || 0, p.orderingUnit)}</td>`
        + `<td class="px-2 py-3 align-middle"><div class="flex flex-col items-center gap-0.5"><input class="${inputClass('text-center text-xs')}" type="number" data-testid="audit-drawer-item-qty-input-desktop-${esc(p.id || i)}" value="${esc(p.received)}" style="width: 106px; min-height: 32px;" data-au-qty="${esc(p.id)}">${p.orderingUnit ? `<span class="text-[10px] text-gray-400 leading-tight">${esc(p.orderingUnit)}</span>` : ''}</div></td>`
        + `<td class="px-2 py-3 text-center align-middle"><span class="px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${status.className}">${esc(status.label)}</span></td>`
        + `<td class="px-2 py-3 text-center align-middle text-xs font-medium text-gray-700">${esc(host.formatCurrency(unitPrice))}</td><td class="px-2 py-3 text-center align-middle text-xs font-semibold text-gray-900">${esc(host.formatCurrency(totalValue))}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function total() {
    const raw = st.products.reduce((sum, p) => sum + unitPriceOf(p) * (Number(p.received) || 0), 0);
    const roundOn = host.isRoundedAmountDisplayEnabled();
    const rounded = Math.round(raw);
    const off = rounded - raw;
    return `<div class="flex items-center justify-between gap-3 px-4 py-3 mb-6 rounded-lg border border-gray-200 bg-gray-50"><span class="text-xs font-semibold uppercase tracking-wide text-gray-600">Order Total</span><div class="flex items-center gap-2">`
      + (roundOn ? `<span class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500 whitespace-nowrap">round off ${T}${esc(`${off >= 0 ? '+' : '-'}${host.formatCurrency(Math.abs(off))}`)}</span>` : '')
      + `<span class="text-lg font-extrabold text-gray-900">${esc(host.formatCurrency(roundOn ? rounded : raw))}</span></div></div>`;
  }

  function receipt() {
    if (!showVoucher()) return '';
    const now = new Date();
    const max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return `<div class="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6"><div class="px-4 py-3 bg-gray-50 border-b border-gray-200"><h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Receipt Details</h3></div><div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">`
      + `<div><label class="block text-xs font-medium text-gray-500 mb-1">Voucher Number</label><input class="${inputClass()}" type="text" placeholder="Enter voucher number" data-testid="audit-drawer-voucher-number-input" value="${esc(st.voucher)}" data-au-field="voucher"></div>`
      + `<div><label class="block text-xs font-medium text-gray-500 mb-1">Received Date</label><input class="${inputClass()}" type="date" max="${max}" data-testid="audit-drawer-received-date-input" value="${esc(st.receivedDate)}" data-au-field="receivedDate"></div>`
      + `</div></div>`;
  }

  function comment() {
    return `<div class="bg-white rounded-lg border border-gray-200 overflow-hidden mb-6"><div class="px-4 py-3 bg-gray-50 border-b border-gray-200"><h3 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Comment for this stage${hasVariance() ? '<span class="text-red-500 ml-1">*</span>' : ''}</h3></div><div class="p-4">`
      + `<textarea placeholder="Comment for this stage" rows="3" aria-invalid="${st.commentError}" data-testid="audit-drawer-comment-textarea" class="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 resize-none ${st.commentError ? 'border-red-400 focus:ring-red-500 focus:border-red-500' : 'border-gray-200 focus:ring-green-500 focus:border-green-500'}" data-au-field="comment">${esc(st.comment)}</textarea>`
      + (st.commentError ? '<p class="mt-1.5 text-xs text-red-600">Please enter a reason for the variance</p>' : '')
      + `</div></div>`;
  }

  function history() {
    const list = stages();
    if (!list.length) return '';
    return `<div class="space-y-3"><h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wide">History (Audit Trail)</h3>${[...list].reverse().map((stage, index) => {
      const open = st.accordion === index;
      let body = '';
      if (open) {
        const challan = stage.challan || [];
        const rows = challan.map((p, pi) => {
          const expected = p.expectedQty || 0;
          const verified = p.verifiedQty || 0;
          const unitPrice = unitPriceOf(p);
          return { p, pi, expected, verified, status: badge(expected, verified), unitPrice, totalValue: unitPrice * verified };
        });
        body = `<div class="border-t border-gray-100">`
          + (challan.length ? `<div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden m-3"><div class="sm:hidden divide-y divide-gray-100">${rows.map(({ p, pi, expected, verified, status, unitPrice, totalValue }) => cardRow({ id: `history-${index}-${p.id || pi}`, name: p.name, articleNumber: p.articleNumber, unit: p.orderingUnit, expectedQty: expected, value: verified, editable: false, status, unitPrice, totalValue })).join('')}</div>`
            + `<div class="hidden sm:block overflow-x-auto"><table class="w-full text-xs" style="min-width: 600px;"><thead><tr class="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">${th('Product', 160, 'left', 'px-3')}${th('Expected', 80)}${th('Verified', 80)}${th('Status', 70)}${th('Unit Price', 100)}${th('Total Value', 100)}</tr></thead>`
            + `<tbody class="divide-y divide-gray-100">${rows.map(({ p, pi, expected, verified, status, unitPrice, totalValue }) => `<tr data-testid="audit-drawer-history-item-row-desktop-${index}-${esc(p.id || pi)}" class="hover:bg-gray-50">${productCell(p.name, esc(p.articleNumber))}<td class="px-2 py-3 text-center align-middle">${qtyCell(expected, p.orderingUnit)}</td><td class="px-2 py-3 text-center align-middle">${qtyCell(verified, p.orderingUnit)}</td><td class="px-2 py-3 text-center align-middle"><span class="px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${status.className}">${esc(status.label)}</span></td><td class="px-2 py-3 text-center align-middle text-xs font-medium text-gray-700">${esc(host.formatCurrency(unitPrice))}</td><td class="px-2 py-3 text-center align-middle text-xs font-semibold text-gray-900">${esc(host.formatCurrency(totalValue))}</td></tr>`).join('')}</tbody></table></div></div>` : '')
          + (stage.comment ? `<div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mx-4 mb-4"><div class="px-4 py-3 bg-gray-50 border-b border-gray-200"><h4 class="text-xs font-semibold text-gray-600 uppercase tracking-wide">Comment for this stage</h4></div><div class="p-4"><p class="text-sm text-gray-700">${esc(stage.comment)}</p></div></div>` : '')
          + `</div>`;
      }
      return `<div data-testid="audit-drawer-history-accordion-${index}" data-status="${open ? 'open' : 'closed'}" class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"><button data-testid="audit-drawer-history-toggle-${index}" class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors" data-au-accordion="${index}"><div class="flex items-center gap-3"><span class="font-medium text-gray-900">${esc(t(stage.status))}</span><span class="text-xs text-gray-400">${esc(auditDate(stage.created_date))}</span></div>${fi(open ? 'FiChevronUp' : 'FiChevronDown', { cls: 'w-5 h-5 text-gray-400' })}</button>${body}</div>`;
    }).join('')}</div>`;
  }

  function content() {
    const n = st.node;
    const submit = st.submitting
      ? '<span>Submitting...</span><div class="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>'
      : `<span>${esc(t(st.newStatus))}</span>${lucide('ArrowRight', { cls: 'w-4 h-4' })}`;
    return (st.discard ? discardChangesModal({ title: 'Discard Changes', description: 'Are you sure you want to discard the changes ?', waitAct: 'au-discard-wait', discardAct: 'au-discard-confirm' }) : '')
      + `<div class="w-full flex flex-col h-full bg-white" data-testid="audit-drawer">`
      + `<div class="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200"><h2 class="text-lg sm:text-xl font-semibold text-gray-900 mb-1">${esc(t(st.newStatus))}</h2><p class="text-xs sm:text-sm text-gray-500 break-all leading-snug">Purchase Order${T} #${T}${esc(n.order_number || n._id)}${T} • Updating to:${T} ${T}${esc(t(st.newStatus))}</p></div>`
      + `<div class="px-6 py-3 border-b border-gray-100 bg-gray-50"><div class="flex items-center gap-2 flex-wrap text-sm">${breadcrumb()}</div></div>`
      + `<div class="flex-1 overflow-y-auto px-3 sm:px-6 py-4 sm:py-6" data-au-scroll><div class="pb-20 md:pb-20">${items()}${total()}${receipt()}${comment()}${history()}</div></div>`
      + `<div class="flex items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-200 sm:justify-end">`
      + `<button data-testid="audit-drawer-cancel-btn" class="flex-1 sm:flex-initial text-sm h-11 sm:h-10 px-4 sm:px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 font-medium transition-colors" data-au-act="cancel">Cancel</button>`
      + `<button class="${buttonClass({ disabled: st.submitting, cls: 'flex-[2] sm:flex-initial text-sm h-11 sm:h-10 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium flex items-center justify-center gap-2 transition-colors' })}" type="button"${st.submitting ? ' disabled=""' : ''} data-testid="audit-drawer-submit-btn" data-au-act="submit">${submit}</button>`
      + `</div></div>`;
  }

  function render(opening = false) { if (st) drawer.render(content(), opening || drawer.open); }

  // ── Behaviour ─────────────────────────────────────────────────────────────────────────────
  const setReceived = (id, value) => { st.products = st.products.map((p) => (p.id === id ? { ...p, received: value } : p)); render(); };

  drawer.host.addEventListener('input', (e) => {
    if (!st) return;
    const qty = e.target.closest('[data-au-qty]');
    if (qty) {
      const v = e.target.value;
      if (isNaN(v) || v < 0) { render(); return; } // a controlled input: a rejected edit snaps back
      setReceived(qty.dataset.auQty, v);
      return;
    }
    const field = e.target.dataset.auField;
    if (field === 'voucher') { st.voucher = e.target.value; render(); }
    if (field === 'receivedDate') { const now = new Date(); const max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; st.receivedDate = e.target.value > max ? max : e.target.value; render(); }
    if (field === 'comment') { st.comment = e.target.value; st.commentError = false; render(); }
  });
  drawer.host.addEventListener('focusout', (e) => {
    const qty = st && e.target.closest('[data-au-qty]');
    if (qty && (e.target.value === '' || e.target.value < 0)) setReceived(qty.dataset.auQty, 0);
  });
  drawer.host.addEventListener('click', (e) => {
    if (!st) return;
    if (e.target.matches('[data-au-field="receivedDate"]')) { try { e.target.showPicker?.(); } catch { /* not supported */ } }
    const step = e.target.closest('[data-au-step]');
    if (step) { const p = st.products.find((x) => String(x.id) === step.dataset.id); setReceived(p.id, step.dataset.auStep === '1' ? Number(p.received || 0) + 1 : Math.max(0, Number(p.received || 0) - 1)); return; }
    const detail = e.target.closest('[data-au-detail]');
    if (detail) { st.details[detail.dataset.auDetail] = !st.details[detail.dataset.auDetail]; render(); return; }
    const acc = e.target.closest('[data-au-accordion]');
    if (acc) { const i = Number(acc.dataset.auAccordion); st.accordion = st.accordion === i ? null : i; render(); return; }
    const act = e.target.closest('[data-au-act], [data-act^="au-discard"]');
    if (!act) return;
    const a = act.dataset.auAct || act.dataset.act;
    if (a === 'cancel') drawer.requestClose('mask');
    if (a === 'submit') submit();
    if (a === 'au-discard-wait' || a === 'au-discard-confirm') {
      const resolve = pendingResolve; pendingResolve = null;
      st.discard = false; render();
      resolve?.(a === 'au-discard-confirm');
    }
  });

  async function submit() {
    if (hasVariance() && !st.comment.trim()) {
      st.commentError = true;
      render();
      const ta = drawer.host.querySelector('[data-testid="audit-drawer-comment-textarea"]');
      ta?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ta?.focus();
      host.notify('error', 'Please enter a reason for the variance');
      return;
    }
    st.commentError = false;
    // A line bought from several sources whose quantity changed would first ask how to split it
    // (SourceAllocationModal); purchase orders raised on this screen carry one source per line.
    await performFinalSubmit();
  }

  async function performFinalSubmit() {
    try {
      st.submitting = true; render();
      const user = host.getUserInfo();
      if (!user) { host.notify('error', 'Cannot fetch user details'); return; }
      const isDeliveryStatus = host.getDeliveryAllowedStatuses().includes(st.node.status);
      const challan = st.products.map((item) => {
        const qtyReceiving = Number(item.received);
        const qtyReceived = item.qtyReceived ? Number(item.qtyReceived) + qtyReceiving : qtyReceiving;
        const expectedQty = Number(item.receiving);
        const qtyRemaining = expectedQty - qtyReceived;
        const orderedUnitIndex = host.getUnitIndexForUnit(item, item.orderingUnit);
        // `item.pallet` — sic: the audit reads a key the lines do not carry, as production does.
        const baseQtyReceived = host.getBaseUnitQuantityFromQuantity(qtyReceived, item.boxes, item.pallet, orderedUnitIndex);
        const sources = Array.isArray(item.sources) && item.sources.length === 1 ? item.sources.map((src) => ({ ...src, qty: qtyReceiving })) : item.sources;
        const base = {
          ...item, qty: qtyReceiving, expectedQty, verifiedQty: qtyReceiving,
          totalPrice: (unitPriceOf(item) * qtyReceiving).toFixed(2),
          ...(sources && { sources }),
        };
        return isDeliveryStatus ? { ...base, qtyReceived, qtyReceiving, qtyRemaining, baseQtyReceived } : base;
      });
      const stageAudit = [{
        userId: user._id, roleId: user.userInfo?.role?._id, status: st.newStatus, documents: [], comment: st.comment.trim(), challan,
        freeItemChallan: (st.node.freeItems || []).map((item) => ({ ...item, qty: (item.qty || item.quantity || 0).toString(), expectedQty: item.qty || item.quantity || 0, verifiedQty: item.qty || item.quantity || 0 })),
        created_date: new Date().toISOString(),
      }];
      await server.updateNodeStageAudit([{
        nodeId: st.node._id, nodeType: 'PURCHASE_ORDER', newStatus: st.newStatus, stageAudit,
        ...(showVoucher() && { metaData: { voucherNumber: st.voucher, receivedDate: st.receivedDate } }),
      }]);
      host.notify('success', 'Purchase Order audit updated successfully');
      close();
    } catch (err) {
      host.notify('error', err?.response?.data?.message || 'Failed to update purchase order audit. Please try again.');
    } finally {
      if (st) { st.submitting = false; render(); }
    }
  }

  return { open, get isOpen() { return Boolean(st); } };
}

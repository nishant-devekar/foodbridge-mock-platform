/*
  PODocumentModal: the printable Purchase Order and Goods Received Receipt, built client-side from
  the row's order and counterparty — no network. Download saves the document as an HTML file (the
  page's stylesheets inlined); Print hands it to the browser's print dialog.

  Money is the host's: each line's tax-inclusive UNIT price is resolved at qty 1 and rounded first,
  then multiplied by the quantity (computeLineAmounts); the excl-tax rate is derived back from it.
  Subtotal and Total Tax stay raw; only the Grand Total rounds (with a Round Off row) when the tenant
  shows rounded amounts.
*/
import { esc } from '../components/dom.js';
import { fi } from '../components/icons.js';

const T = '<!---->';
export const DOC_META = {
  PO: { title: 'PO Document', filenamePrefix: 'purchase_order' },
  GRN: { title: 'Goods Received Receipt', filenamePrefix: 'goods_received_receipt' },
};

/** resolveBuyerOrgDetails: the invoice letterhead first, the current location for the rest. */
export function buyerOrg(host) {
  const location = host.getCurrentLocation();
  const cfg = host.getInvoiceLetterhead() || null;
  const address = cfg?.address ? [cfg.address.line1, cfg.address.line2, cfg.address.line3].filter(Boolean).join(', ') : location?.address || location?.address2 || null;
  return {
    name: cfg?.companyName || location?.name || null,
    email: cfg?.email || location?.email || null,
    phone: cfg?.phone || location?.phone || null,
    address: address || null,
    gstNumber: cfg?.gstNumber || cfg?.uinNumber || location?.gstNumber || null,
  };
}

const itemName = (item) => {
  if (item?.name) return item.name;
  if (!item?.title) return '—';
  if (typeof item.title === 'object') return item.title.en ?? Object.values(item.title)[0] ?? '—';
  return item.title;
};

function lineAmounts(item, host) {
  const qty = Number(item?.qty) || Number(item?.quantity) || 0;
  const tax = Number(item?.tax) || 0;
  const unit = host.roundPrice(host.calculateItemPrice({ ...item, qty: 1, taxIncluded: true }));
  const amountWithTax = unit * qty;
  const rateExclTax = tax > 0 ? unit / (1 + tax / 100) : unit;
  const amountExclTax = rateExclTax * qty;
  return { amountExclTax, taxAmount: Math.max(amountWithTax - amountExclTax, 0), amountWithTax, rateExclTax };
}

const docDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const line = (v, mt = 'mt-0.5') => (v ? `<p class="text-gray-500 ${mt}">${v}</p>` : '');
const box = (label, name, lines) => `<div class="flex-1 border border-gray-200 rounded p-3 text-xs"><p class="font-bold uppercase tracking-wide text-gray-500 mb-2">${label}</p><p class="font-semibold text-gray-800">${esc(name || '—')}</p>${lines.join('')}</div>`;
const signatures = (left, leftName, right, rightName) => `<div class="flex flex-col gap-6 sm:flex-row sm:justify-between mt-10 pt-4 border-t border-gray-200 text-xs text-gray-600"><div><div class="border-b border-gray-400 w-36 mb-1"></div><p class="font-semibold">${left}</p><p class="text-gray-400">${esc(leftName)}</p></div><div class="sm:text-right"><div class="border-b border-gray-400 w-36 mb-1 sm:ml-auto"></div><p class="font-semibold">${right}</p><p class="text-gray-400">${esc(rightName)}</p></div></div>`;
const th = (align, width, label) => `<th class="text-${align} align-top px-2 py-2 w-[${width}] border border-gray-300">${label}</th>`;
const desc = (item) => `<td class="align-top px-2 py-2 border border-gray-200 break-words"><p class="font-medium">${esc(itemName(item))}</p>${item.articleNumber ? `<p class="text-[10px] text-gray-400 mt-0.5">SKU: ${T}${esc(item.articleNumber)}</p>` : ''}</td>`;
const title = (h1, sub, badge, badgeBg, dateLabel, date) => `<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-6"><div class="min-w-0"><h1 class="text-xl sm:text-2xl font-bold text-gray-900 break-words uppercase tracking-wide">${h1}</h1><p class="text-xs text-gray-400 mt-1">${sub}</p></div>`
  + `<div class="min-w-0 sm:text-right"><span class="inline-block max-w-full ${badgeBg} text-white text-xs font-bold px-4 py-1.5 rounded break-all">PO #${T}${esc(badge)}</span><p class="text-xs text-gray-500 mt-2">${dateLabel} <span class="ml-1">${esc(date)}</span></p></div></div>`;
const PAGE = 'bg-white px-4 py-6 sm:p-8 w-full max-w-3xl mx-auto font-sans text-gray-900 text-sm whitespace-normal';

/** PurchaseOrderHTMLDocument: the order's current lines (its latest itemListAudit entry). */
export function purchaseOrderDocument(order, supplier, host) {
  const items = order?.item_list || [];
  const buyer = buyerOrg(host);
  const date = order?.created_date ? docDate(order.created_date) : '—';
  let subtotal = 0;
  let totalTax = 0;
  const rows = items.map((item) => { const a = lineAmounts(item, host); subtotal += a.amountExclTax; totalTax += a.taxAmount; return { item, ...a }; });
  const discount = Number(order?.orderDiscount) || 0;
  const discountAmount = (subtotal + totalTax) * (discount / 100);
  const raw = Math.max(0, subtotal + totalTax - discountAmount);
  const roundOn = host.isRoundedAmountDisplayEnabled();
  const off = Math.round(raw) - raw;
  const grand = roundOn ? host.formatAmountValue(raw) : raw.toFixed(2);
  return `<div class="${PAGE}">`
    + title('Purchase Order', 'Official Procurement Document', order?.order_number, 'bg-gray-900', 'Date', date)
    + `<div class="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6">`
    + box('From — Buyer', buyer.name, [line(esc(buyer.email || '')), line(esc(buyer.phone || '')), line(esc(buyer.address || buyer.address2 || '')), buyer.gstNumber ? line(`GSTIN: ${T}${esc(buyer.gstNumber)}`, 'mt-1') : ''])
    + box('To — Supplier', supplier?.name, [line(esc(supplier?.email || '')), line(esc(supplier?.phone || supplier?.contact || '')), line(esc(supplier?.address || '')), supplier?.gstNumber ? line(`GSTIN: ${T}${esc(supplier.gstNumber)}`, 'mt-1') : ''])
    + `</div>`
    + `<div class="mb-6 w-full overflow-x-auto"><table class="w-full min-w-[640px] sm:min-w-0 table-auto sm:table-fixed border-collapse text-xs"><thead><tr class="bg-gray-100">`
    + th('left', '4%', '#') + th('left', '34%', 'Item Description') + th('center', '8%', 'Qty') + th('center', '10%', 'Unit') + th('right', '14%', 'Rate (Excl. Tax)') + th('center', '8%', 'Tax %') + th('right', '10%', 'Tax Amt') + th('right', '12%', 'Total (Incl. Tax)')
    + `</tr></thead><tbody>`
    + (rows.length === 0 ? '<tr><td colspan="8" class="text-center py-6 text-gray-400 border border-gray-200">No items in this order</td></tr>' : '')
    + rows.map(({ item, taxAmount, amountWithTax, rateExclTax }, i) => `<tr class="${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">`
      + `<td class="align-top px-2 py-2 text-gray-500 border border-gray-200">${i + 1}</td>${desc(item)}`
      + `<td class="align-top px-2 py-2 text-center border border-gray-200">${esc(item.qty ?? item.quantity)}</td><td class="align-top px-2 py-2 text-center border border-gray-200">${esc(item.orderingUnit || '—')}</td>`
      + `<td class="align-top px-2 py-2 text-right border border-gray-200">${rateExclTax.toFixed(2)}</td><td class="align-top px-2 py-2 text-center border border-gray-200">${Number(item.tax) || 0}${T}%</td>`
      + `<td class="align-top px-2 py-2 text-right border border-gray-200">${taxAmount.toFixed(2)}</td><td class="align-top px-2 py-2 text-right font-semibold border border-gray-200">${amountWithTax.toFixed(2)}</td></tr>`).join('')
    + `</tbody></table></div>`
    + `<div class="flex justify-end mb-6"><table class="w-full sm:w-64 text-xs"><tbody>`
    + `<tr><td class="py-1 text-gray-500">Subtotal (excl. tax)</td><td class="py-1 text-right font-medium">${subtotal.toFixed(2)}</td></tr>`
    + `<tr><td class="py-1 text-gray-500">Total Tax</td><td class="py-1 text-right font-medium">${totalTax.toFixed(2)}</td></tr>`
    + (discount > 0 ? `<tr><td class="py-1 text-gray-500">Discount (${T}${discount}${T}%)</td><td class="py-1 text-right font-medium text-red-600">- ${T}${discountAmount.toFixed(2)}</td></tr>` : '')
    + (roundOn ? `<tr><td class="py-1 text-gray-500">Round Off</td><td class="py-1 text-right font-medium">${off >= 0 ? '+' : '-'}${Math.abs(off).toFixed(2)}</td></tr>` : '')
    + `<tr class="border-t-2 border-gray-900"><td class="pt-2 font-bold">Grand Total</td><td class="pt-2 text-right font-bold text-base">${esc(grand)}</td></tr></tbody></table></div>`
    + (order?.comments || order?.ShippingDetails?.method ? `<div class="mb-6 text-xs">`
      + (order?.comments ? `<div class="mb-2"><p class="font-bold uppercase tracking-wide text-gray-500 mb-1">Order Notes</p><p class="border border-gray-200 rounded p-2 bg-gray-50 text-gray-600">${esc(order.comments)}</p></div>` : '')
      + (order?.ShippingDetails?.method ? `<div><p class="font-bold uppercase tracking-wide text-gray-500 mb-1">Shipping</p><p class="border border-gray-200 rounded p-2 bg-gray-50 text-gray-600">Method: ${T}${esc(order.ShippingDetails.method)}</p></div>` : '')
      + `</div>` : '')
    + signatures('Authorized Signatory', buyer.name || 'Buyer', 'Acknowledged By', supplier?.name || 'Supplier')
    + `<p class="text-[10px] text-gray-300 text-center mt-6">This is a system-generated purchase order • PO #${T}${esc(order?.order_number)}${T} • Generated on ${T}${esc(date)}</p></div>`;
}

/** GoodsReceivedReceiptHTMLDocument: the delivered stage's challan, ordered vs received. */
export function goodsReceivedDocument(order, supplier, host) {
  const delivered = host.orderStatusRules.getDeliveredStageAudit(order);
  const items = (delivered?.challan && delivered.challan.length > 0 ? delivered.challan : order?.item_list) || [];
  const buyer = buyerOrg(host);
  const receivedDate = delivered?.updatedAt ? docDate(delivered.updatedAt) : '—';
  const rows = items.map((item) => {
    const ordered = Number(item.expectedQty ?? item.qty) || 0;
    const received = Number(item.verifiedQty ?? item.qtyReceived ?? item.qty) || 0;
    const variance = received - ordered;
    return { item, ordered, received, short: Math.max(-variance, 0), excess: Math.max(variance, 0) };
  });
  const hasShort = rows.some((r) => r.short > 0);
  const hasExcess = rows.some((r) => r.excess > 0);
  return `<div class="${PAGE}">`
    + title('Goods Received Receipt', 'Confirms quantities received against the Purchase Order', order?.order_number, 'bg-emerald-700', 'Received on', receivedDate)
    + `<div class="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-6">`
    + box('Received By', buyer.name, [line(esc(buyer.phone || '')), line(esc(buyer.address || buyer.address2 || ''))])
    + box('Supplier', supplier?.name, [line(esc(supplier?.phone || supplier?.contact || '')), line(esc(supplier?.address || ''))])
    + `</div>`
    + (hasShort ? '<div class="mb-3 text-xs border-l-4 border-amber-400 bg-amber-50 text-amber-800 px-3 py-2 rounded">Some items were received short against the ordered quantity — see highlighted rows below.</div>' : '')
    + (hasExcess ? '<div class="mb-4 text-xs border-l-4 border-blue-400 bg-blue-50 text-blue-800 px-3 py-2 rounded">Some items were received in excess of the ordered quantity — see highlighted rows below.</div>' : '')
    + `<div class="mb-6 w-full overflow-x-auto"><table class="w-full min-w-[560px] sm:min-w-0 table-auto sm:table-fixed border-collapse text-xs"><thead><tr class="bg-gray-100">`
    + th('left', '4%', '#') + th('left', '40%', 'Item Description') + th('center', '14%', 'Unit') + th('center', '14%', 'Ordered Qty') + th('center', '14%', 'Received Qty') + th('center', '14%', 'Qty Variance')
    + `</tr></thead><tbody>`
    + (rows.length === 0 ? '<tr><td colspan="6" class="text-center py-6 text-gray-400 border border-gray-200">No items to receive</td></tr>' : '')
    + rows.map(({ item, ordered, received, short, excess }, i) => `<tr class="${short > 0 ? 'bg-amber-50' : excess > 0 ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">`
      + `<td class="align-top px-2 py-2 text-gray-500 border border-gray-200">${i + 1}</td>${desc(item)}`
      + `<td class="align-top px-2 py-2 text-center border border-gray-200">${esc(item.orderingUnit || '—')}</td><td class="align-top px-2 py-2 text-center border border-gray-200">${ordered}</td>`
      + `<td class="align-top px-2 py-2 text-center font-semibold border border-gray-200">${received}</td>`
      + `<td class="align-top px-2 py-2 text-center border border-gray-200 ${short > 0 ? 'text-amber-700 font-semibold' : excess > 0 ? 'text-blue-700 font-semibold' : 'text-gray-400'}">${short > 0 ? `-${short}` : excess > 0 ? `+${excess}` : '—'}</td></tr>`).join('')
    + `</tbody></table></div>`
    + signatures('Received By (Signature)', buyer.name || 'Buyer', 'Delivered By (Signature)', supplier?.name || 'Supplier')
    + `<p class="text-[10px] text-gray-300 text-center mt-6">System-generated goods received receipt • PO #${T}${esc(order?.order_number)}</p></div>`;
}

/** The modal around a document. `m` = { orderNumber, orderData: { order, seller }, docType }. */
export function poDocumentModal(m, host) {
  const meta = DOC_META[m.docType] || null;
  const doc = m.docType === 'PO' ? purchaseOrderDocument(m.orderData.order, m.orderData.seller, host) : goodsReceivedDocument(m.orderData.order, m.orderData.seller, host);
  return `<div class="fixed inset-0 z-50 flex items-center justify-center" data-keep="po-document">`
    + `<div aria-hidden="true" class="absolute inset-0 bg-black bg-opacity-50" data-pd-act="close"></div>`
    + `<div role="dialog" aria-modal="true" aria-labelledby="po-modal-title" data-testid="po-document-modal" class="relative bg-white rounded-lg shadow-2xl w-full max-w-4xl mx-3 sm:mx-auto h-[90dvh] sm:h-[90vh] min-w-0 flex flex-col overflow-hidden">`
    + `<div class="flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200"><div class="min-w-0 flex-1 overflow-hidden"><h2 id="po-modal-title" class="text-base sm:text-xl font-semibold text-gray-900 truncate">${esc(meta?.title || 'Document')}</h2><p class="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">Order: ${T}${esc(m.orderNumber)}</p></div>`
    + `<div class="flex items-center gap-2 flex-shrink-0">`
    + `<button data-testid="po-document-download-btn" class="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Download" data-pd-act="download">${fi('FiDownload', { size: 14 })}<span class="hidden sm:inline">Download</span></button>`
    + `<button data-testid="po-document-print-btn" class="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Print" data-pd-act="print">${fi('FiPrinter', { size: 14 })}<span class="hidden sm:inline">Print</span></button>`
    + `<button data-testid="po-document-close-btn" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Close" data-pd-act="close">${fi('FiX', { size: 18 })}</button>`
    + `</div></div>`
    + `<div class="flex-1 min-w-0 overflow-auto bg-gray-100"><div class="min-w-0 px-2 py-3 sm:px-4 sm:py-4" data-pd-print>${doc}</div></div>`
    + `</div></div>`;
}

/** Every CSS rule the page holds (getPageStyles): what the downloaded file is styled with. */
const pageStyles = () => Array.from(document.styleSheets).flatMap((sheet) => {
  try { return Array.from(sheet.cssRules).map((r) => r.cssText); } catch { return sheet.href ? [`@import url("${sheet.href}");`] : []; }
}).join('\n');

/** handleDownload: the document as a standalone HTML file, named after the order. */
export function downloadDocument(root, m, host) {
  const meta = DOC_META[m.docType];
  // React's serialised markup carries no text-node separators: adjacent texts reparse as one node.
  const html = root.querySelector('[data-pd-print]').innerHTML.replace(/<!---->/g, '');
  const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${meta.title}</title><style>${pageStyles()}</style></head><body>${html}</body></html>`], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${meta.filenamePrefix}_${m.orderNumber}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  host.notify('success', `${meta.title} downloaded successfully`);
}

/** handlePrint: a print-only copy of the document, everything else hidden, then the print dialog. */
export function printDocument(root) {
  const style = document.createElement('style');
  style.textContent = `
        @media print {
          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          body * { visibility: hidden; }
          #po-print-root { display: block !important; visibility: visible;
            position: fixed; inset: 0; background: white; z-index: 9999; }
          #po-print-root * { visibility: visible; }
          @page { margin: 1cm; }
        }
      `;
  const printRoot = document.createElement('div');
  printRoot.id = 'po-print-root';
  printRoot.style.display = 'none';
  printRoot.innerHTML = root.querySelector('[data-pd-print]').innerHTML.replace(/<!---->/g, '');
  document.head.appendChild(style);
  document.body.appendChild(printRoot);
  window.addEventListener('afterprint', () => { document.head.removeChild(style); document.body.removeChild(printRoot); }, { once: true });
  window.print();
}

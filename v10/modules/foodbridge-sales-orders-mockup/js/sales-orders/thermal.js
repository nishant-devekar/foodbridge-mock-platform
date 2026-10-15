/*
  Invoice → Thermal Print: the receipt preview and the printer settings beside it.

  The receipt is production's (mapOrderToReceiptDto + InvoiceThermalTemplate): each line at its
  charged, tax-inclusive unit rate; NO order discount (see receiptOf); the date printed as
  the raw ISO timestamp the API returns; with rounded amounts on, a "Round Off" line and a TOTAL
  rounded to the rupee — shipping left out of that TOTAL, as the template leaves it out.

  Printing itself is the browser's (WebUSB / Web Bluetooth device pickers, then ESC/POS to the
  device) and outside what a prototype can do: "Connect … Printer" does nothing here, so "Print"
  stays "Connect Printer First" (see README → Known differences). The two preferences production
  keeps per browser — paper size and printer type — are kept the same way.
*/
import { fi } from '../components/icons.js';
import { esc } from '../components/dom.js';

const PAPER = [
  { value: '58mm', label: '58mm (2 inch)', description: 'Standard narrow receipt paper', widthPx: 229 },
  { value: '80mm', label: '80mm (3.2 inch)', description: 'Wide receipt paper — POS-80, RP-80 printers', widthPx: 302 },
];
const PRINTERS = [
  { value: 'usb', label: 'USB Thermal Printer', description: 'Desktop printer connected via USB cable', icon: 'monitor', supported: () => !!navigator.usb, hint: 'WebUSB / Web Serial not supported. Use Chrome or Edge.' },
  { value: 'bluetooth', label: 'Bluetooth Thermal Printer', description: 'Portable printer connected via Bluetooth', icon: 'wifi', supported: () => !!navigator.bluetooth, hint: 'Web Bluetooth not supported. Use Chrome or Edge.' },
];
const pref = {
  get: (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private window */ } },
};

const roundMoney = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const fixed = (v) => Number(v || 0).toFixed(2);

/** The receipt for an order, as production maps one. */
export function receiptOf(m, order) {
  const lines = order.items.map((l) => {
    const rate = roundMoney(l.price * (1 + (l.tax || 0) / 100)); // the charged, tax-inclusive rate
    const gross = roundMoney(rate * l.qty);
    return { name: l.name, qty: l.qty, rate, amount: gross, net: gross, discount: 0 };
  });
  // No order discount: the receipt reads it from the list row, and the list row does not carry
  // one — so a discounted order prints its undiscounted total (₹ 575 for an order of ₹ 549).
  // Reproduced as production prints it.
  const subtotal = roundMoney(lines.reduce((s, x) => s + x.amount, 0));
  const discount = roundMoney(lines.reduce((s, x) => s + x.discount, 0));
  const total = roundMoney(Math.max(0, subtotal - discount) + (Number(order.shippingCost) || 0));
  const customer = m.customerOf(order);
  return { date: order.createdAt.toISOString(), customer: customer?.name || 'N/A', billNo: order.number, lines, subtotal, discount, total };
}

function receipt(m, r, paper) {
  const compact = paper === '58mm';
  const f = compact ? '11px' : '12px';
  const [qW, rW, aW] = compact ? ['24px', '44px', '48px'] : ['28px', '52px', '56px'];
  const row = 'display: flex; justify-content: space-between; gap: 8px; margin-bottom: 2px;';
  const left = 'display: flex; justify-content: flex-start; gap: 8px; margin-bottom: 2px;';
  const rule = '<div style="border-top: 1px dashed rgb(17, 17, 17); margin: 6px 0px;"></div>';
  const raw = Math.max(0, r.subtotal - r.discount);
  const rounded = m.roundedAmounts;
  const roundOff = Math.round(raw) - raw;
  const shownTotal = rounded ? Math.round(raw).toLocaleString('en-IN') : fixed(r.total);
  const c = esc(m.currency);
  const items = r.lines.length ? r.lines.map((x) => `<div style="margin-bottom: 5px;"><div style="display: flex; gap: 6px; align-items: flex-start;"><div style="flex: 1 1 0%; word-break: break-word; font-size: ${f};">${esc(x.name || 'Item')}</div><div style="width: ${qW}; text-align: right; font-size: ${f};">${x.qty}</div><div style="width: ${rW}; text-align: right; font-size: ${f};">${fixed(x.rate)}</div><div style="width: ${aW}; text-align: right; font-size: ${f};">${fixed(x.amount)}</div></div></div>`).join('')
    : '<div style="text-align: center; font-size: 10px; padding: 6px 0px;">No item details available for thermal preview.</div>';
  return `<div style="width: ${compact ? '229px' : '315px'}; max-width: 100%; margin: 0px auto; background: rgb(255, 255, 255); color: rgb(17, 17, 17); font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.3; padding: 4px 12px 28px; box-sizing: border-box;">`
    + '<div style="text-align: center; margin-bottom: 8px;"><div style="font-size: 18px; font-weight: 700; letter-spacing: 0.4px;"></div></div>'
    + '<div style="text-align: center; font-weight: 700; font-size: 14px; margin: 8px 0px 10px;">Invoice</div>'
    + `<div style="font-size: 12px; margin-bottom: 8px;"><div style="${row}"><span>Date :</span><span>${esc(r.date)}</span></div><div style="${left}"><span style="min-width: 58px;">Customer :</span><span style="flex: 1 1 0%; font-weight: 700; font-size: 12px;">${esc(r.customer)}</span></div><div style="${left}"><span style="min-width: 58px;">Bill No :</span><span style="flex: 1 1 0%;">${esc(r.billNo)}</span></div><div style="${left}"><span style="min-width: 58px;">Payment :</span><span style="flex: 1 1 0%;">-</span></div><div style="${left}"><span style="min-width: 58px;">DR Ref :</span><span style="flex: 1 1 0%;">${esc(r.billNo)}</span></div></div>`
    + `${rule}<div style="display: flex; font-weight: 700; font-size: ${f}; margin-bottom: 6px;"><div style="flex: 1 1 0%;">Item</div><div style="width: ${qW}; text-align: right;">Qty</div><div style="width: ${rW}; text-align: right;">Rate</div><div style="width: ${aW}; text-align: right;">Amt</div></div>${rule}<div>${items}</div>${rule}`
    + `<div style="font-size: 10px;"><div style="${row}"><span>Sub Total</span><span>${c}<!----> <!---->${fixed(r.subtotal)}</span></div><div style="${row}"><span>(-) Discount</span><span>${c}<!----> <!---->${fixed(r.discount)}</span></div>${rounded ? `<div style="${row}"><span>Round Off</span><span>${c}<!----> <!---->${roundOff >= 0 ? '+' : '-'}${Math.abs(roundOff).toFixed(2)}</span></div>` : ''}<div style="${row} font-weight: 700; margin-top: 4px;"><span>TOTAL</span><span>${c}<!----> <!---->${shownTotal}</span></div></div></div>`;
}

/** The modal (production's ThermalPrintModal, with nothing connected). */
export function renderThermal(m, t) {
  const paper = PAPER.find((p) => p.value === t.paper) || PAPER[0];
  const type = PRINTERS.find((p) => p.value === t.printer) || PRINTERS[0];
  const radio = (name, value, on, label, sub, extra = '', icon = '') => `<label class="thermal-radio-option ${on ? 'border-blue-500 bg-blue-50' : ''} ${extra}"><input type="radio" name="${name}" class="thermal-radio-input" value="${value}"${on ? ' checked=""' : ''}${extra ? ' disabled=""' : ''} data-thermal-${name}="${value}"><div class="thermal-radio-content"><span class="${icon ? 'flex items-center gap-1.5 ' : ''}text-sm font-medium text-gray-900">${icon}${icon ? ' <!---->' : ''}${label}</span><span class="text-xs text-gray-500">${sub}</span></div></label>`;
  const printers = PRINTERS.map((p) => { const ok = p.supported(); return radio('printerType', p.value, t.printer === p.value, p.label, ok ? p.description : p.hint, ok ? '' : 'opacity-50', fi(p.icon, { size: 13 })); }).join('');
  const device = type.supported()
    ? `<p class="text-xs text-gray-400 mb-2">No printer connected</p><button data-act="thermal-connect" class="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">Connect <!---->${t.printer === 'usb' ? 'USB' : 'Bluetooth'}<!----> Printer</button><p class="text-xs text-gray-400 mt-2 leading-relaxed">A browser device picker will appear. Select your printer from the list.</p>`
    : `<div class="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">${fi('alert-circle', { size: 13, cls: 'flex-shrink-0 mt-0.5' })}<span>${type.hint}</span></div>`;
  // Production renders the modal inside the orders table body, so what it does not colour itself
  // (the Copies number) inherits the body's text-gray-800.
  return `<div data-thermal class="fixed inset-0 z-[100] flex items-center justify-center" style="color: rgb(31, 41, 55);"><div class="absolute inset-0 bg-black bg-opacity-50" data-act="thermal-close"></div>
    <div class="relative bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-3 sm:mx-auto h-[92vh] flex flex-col thermal-modal">
      <div class="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 flex-shrink-0"><div class="min-w-0 flex-1"><h2 class="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">${fi('printer', { size: 16 })}Thermal Print Preview</h2><p class="text-xs text-gray-500 mt-0.5 truncate">Invoice</p></div><button data-act="thermal-close" class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2">${fi('x', { size: 18 })}</button></div>
      <div class="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
        <div class="flex-1 overflow-y-auto bg-gray-100 flex flex-col items-center py-6 px-4 min-h-0"><p class="text-xs text-gray-400 uppercase tracking-wide mb-4 self-start">Preview</p><div class="bg-white shadow-md rounded" style="width: ${paper.widthPx}px; max-width: 100%;">${receipt(m, t.receipt, paper.value)}</div></div>
        <div class="w-full md:w-72 flex-shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l border-gray-200 px-4 sm:px-5 py-5 bg-white space-y-5">
          <div><p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Printer Type</p><div class="space-y-2">${printers}</div></div>
          <div><p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Printer Device</p>${device}</div>
          <div><p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Paper Size</p><div class="space-y-2">${PAPER.map((p) => radio('paperSize', p.value, t.paper === p.value, p.label, p.description)).join('')}</div></div>
          <div><p class="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Copies</p><div class="thermal-copies-control"><button data-act="thermal-copies" data-step="-1" class="thermal-copies-btn"${t.copies === 1 ? ' disabled=""' : ''}>−</button><input type="number" min="1" max="99" class="thermal-copies-input" data-thermal-copies value="${t.copies}"><button data-act="thermal-copies" data-step="1" class="thermal-copies-btn"${t.copies === 99 ? ' disabled=""' : ''}>+</button></div></div>
          <div class="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800 leading-relaxed">Paper size and printer type are saved per browser.</div>
        </div>
      </div>
      <div class="flex gap-3 px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg flex-shrink-0"><button data-act="thermal-close" class="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors">Cancel</button><button disabled="" class="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" title="Connect a printer first">${fi('printer', { size: 14 })}Connect Printer First</button></div>
    </div></div>`;
}

/** The modal's state and interactions. */
export function thermalFlow({ model: m, host }) {
  let t = null;
  const render = () => {
    const existing = host.querySelector(':scope > [data-thermal]');
    if (!t) { existing?.remove(); return; }
    const html = renderThermal(m, t);
    if (existing) {
      // Updated in place: the preview and settings panes keep their scroll, the card does not re-animate.
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const fresh = tmp.firstElementChild;
      const scrolls = [...existing.querySelectorAll('.overflow-y-auto')].map((el) => el.scrollTop);
      existing.querySelector('.thermal-modal').replaceChildren(...fresh.querySelector('.thermal-modal').childNodes);
      existing.querySelectorAll('.overflow-y-auto').forEach((el, i) => { el.scrollTop = scrolls[i] || 0; });
    } else host.insertAdjacentHTML('beforeend', html);
  };
  const handlers = {
    'thermal-close': () => { t = null; render(); },
    'thermal-connect': () => {}, // the browser's device picker: outside the prototype
    'thermal-copies': (_e, el) => { t.copies = Math.max(1, Math.min(99, t.copies + Number(el.dataset.step))); render(); },
  };
  host.addEventListener('change', (e) => {
    if (!t) return;
    const el = e.target;
    if (el.dataset.thermalPrintertype) { t.printer = el.value; pref.set('thermal_printer_type', el.value); render(); }
    if (el.dataset.thermalPapersize) { t.paper = el.value; render(); } // saved only when a receipt is printed
    if (el.matches('[data-thermal-copies]')) { t.copies = Math.max(1, Math.min(99, parseInt(el.value, 10) || 1)); render(); }
  });
  return {
    handlers,
    open(orderId) {
      const order = m.data.orderById.get(orderId);
      t = { receipt: receiptOf(m, order), paper: pref.get('thermal_paper_size', '58mm'), printer: pref.get('thermal_printer_type', 'usb'), copies: 1 };
      render();
    },
    isOpen: () => !!t,
    close() { t = null; render(); },
  };
}

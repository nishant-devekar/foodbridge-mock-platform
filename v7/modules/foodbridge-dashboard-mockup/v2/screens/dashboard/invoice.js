/* ============================================================
   invoice.js — the two Invoice print flows
   ------------------------------------------------------------
   Thermal Print → components/common/thermal/ThermalPrintModal.jsx
                   + templates/InvoiceThermalTemplate.jsx
                   + ThermalPrintModal.css (custom classes, injected below)
                   + config/thermalPaperSizes.js
   A4 Print      → InvoicePrintButton.jsx handleA4Print: the app fetches a
                   server-rendered PDF and hands it to the browser's viewer,
                   which is where the print dialog comes from. There is no
                   backend here, so the prototype builds the same Tax Invoice
                   document as HTML in a new window and calls print() — the
                   flow and the document match; the PDF engine does not.

   Exposes window.INVOICE = { thermal(order), a4(order) }.
   ============================================================ */
(function () {
  'use strict';

  var ICON = window.ICON;

  /* ---------- ThermalPrintModal.css — the non-Tailwind classes ---------- */
  var css = document.createElement('style');
  css.textContent = [
    '.thermal-radio-option{display:flex;align-items:flex-start;padding:12px 16px;border:2px solid #e5e7eb;border-radius:8px;cursor:pointer;transition:all .2s}',
    '.thermal-radio-option:hover{border-color:#d1d5db;background:#f9fafb}',
    '.thermal-radio-option input[type="radio"]:checked{accent-color:#3b82f6}',
    '.thermal-radio-option input[type="radio"]:checked ~ .thermal-radio-content{color:#1f2937}',
    '.thermal-radio-input{margin:4px 12px 0 0;width:18px;height:18px;flex-shrink:0;cursor:pointer}',
    '.thermal-radio-content{display:flex;flex-direction:column;gap:2px;flex:1;color:#6b7280}',
    '.thermal-copies-control{display:flex;align-items:center;border:1px solid #d1d5db;border-radius:6px;background:#fff;width:fit-content}',
    '.thermal-copies-btn{width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;font-size:18px;color:#6b7280;transition:all .2s;flex-shrink:0}',
    '.thermal-copies-btn:disabled{opacity:.5;cursor:not-allowed}',
    '.thermal-copies-input{width:60px;height:40px;border:none;text-align:center;font-size:16px;font-weight:600;background:#fff}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- config/thermalPaperSizes.js ---------- */
  var PAPER = [
    { value: '58mm', label: '58mm (2 inch)', description: 'Standard narrow receipt paper', widthPx: 229 },
    { value: '80mm', label: '80mm (3.2 inch)', description: 'Wide receipt paper — POS-80, RP-80 printers', widthPx: 302 }
  ];
  var TYPES = [
    { value: 'usb', label: 'USB Thermal Printer', description: 'Desktop printer connected via USB cable', icon: 'FiMonitor' },
    { value: 'bluetooth', label: 'Bluetooth Thermal Printer', description: 'Portable printer connected via Bluetooth', icon: 'FiWifi' }
  ];

  var state = { type: 'usb', paper: '58mm', copies: 1, connect: 'idle' };

  // ThermalPrintModal.jsx:97-101 — the USB cascade's status strings
  var USB_STATUS = { idle: null, 'trying-usb': { text: 'Connecting to USB printer\u2026' } };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function money2(n) { return Number(n || 0).toFixed(2); }

  /* ================= InvoiceThermalTemplate.jsx ================= */

  function receipt(o) {
    var compact = state.paper === '58mm';
    var w = compact ? '229px' : '315px';
    var itemFont = compact ? '11px' : '12px';
    var qtyW = compact ? '24px' : '28px', rateW = compact ? '44px' : '52px', amtW = compact ? '48px' : '56px';
    var row = 'display:flex;justify-content:space-between;gap:8px;margin-bottom:2px';
    var rule = '<div style="border-top:1px dashed #111;margin:6px 0"></div>';
    var left = 'display:flex;justify-content:flex-start;gap:8px;margin-bottom:2px';

    var subtotal = o.items.reduce(function (s, i) { return s + i.amount; }, 0);
    var discount = 0;
    var raw = Math.max(0, subtotal - discount);
    var rounded = Math.round(raw);
    var off = rounded - raw;
    var offStr = (off >= 0 ? '+' : '-') + Math.abs(off).toFixed(2);

    var items = o.items.map(function (it) {
      return '<div style="margin-bottom:5px"><div style="display:flex;gap:6px;align-items:flex-start">' +
        '<div style="flex:1;word-break:break-word;font-size:' + itemFont + '">' + esc(it.name) + '</div>' +
        '<div style="width:' + qtyW + ';text-align:right;font-size:' + itemFont + '">' + it.qty + '</div>' +
        '<div style="width:' + rateW + ';text-align:right;font-size:' + itemFont + '">' + money2(it.rate) + '</div>' +
        '<div style="width:' + amtW + ';text-align:right;font-size:' + itemFont + '">' + money2(it.amount) + '</div>' +
        '</div></div>';
    }).join('');

    return '<div style="width:' + w + ';max-width:100%;margin:0 auto;background:#fff;color:#111;' +
      'font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.3;padding:4px 12px 28px;box-sizing:border-box">' +
      '<div style="text-align:center;font-weight:700;font-size:14px;margin:8px 0 10px">Invoice</div>' +
      '<div style="font-size:12px;margin-bottom:8px">' +
        '<div style="' + row + '"><span>Date :</span><span>' + esc(isoStamp(o)) + '</span></div>' +
        '<div style="' + left + '"><span style="min-width:58px">Customer :</span>' +
          '<span style="flex:1;font-weight:700;font-size:12px">' + esc(o.customer.name || o.customer.phone) + '</span></div>' +
        '<div style="' + left + '"><span style="min-width:58px">Bill No :</span><span style="flex:1">' + esc(o.id) + '</span></div>' +
        '<div style="' + left + '"><span style="min-width:58px">Payment :</span><span style="flex:1">-</span></div>' +
        '<div style="' + left + '"><span style="min-width:58px">DR Ref :</span><span style="flex:1">' + esc(o.id) + '</span></div>' +
      '</div>' + rule +
      '<div style="display:flex;font-weight:700;font-size:' + itemFont + ';margin-bottom:6px">' +
        '<div style="flex:1">Item</div>' +
        '<div style="width:' + qtyW + ';text-align:right">Qty</div>' +
        '<div style="width:' + rateW + ';text-align:right">Rate</div>' +
        '<div style="width:' + amtW + ';text-align:right">Amt</div></div>' + rule +
      '<div>' + items + '</div>' + rule +
      '<div style="font-size:10px">' +
        '<div style="' + row + '"><span>Sub Total</span><span>Rs ' + money2(subtotal) + '</span></div>' +
        '<div style="' + row + '"><span>(-) Discount</span><span>Rs ' + money2(discount) + '</span></div>' +
        '<div style="' + row + '"><span>Round Off</span><span>Rs ' + offStr + '</span></div>' +
        '<div style="' + row + ';font-weight:700"><span>TOTAL</span><span>Rs ' + rounded + '</span></div>' +
      '</div></div>';
  }

  // the live preview prints the raw ISO timestamp in the Date row
  function isoStamp(o) {
    var t = o.time.replace(/^0/, '');
    var m = /^(\d+):(\d+)\s*(am|pm)$/i.exec(t) || [];
    var h = Number(m[1] || 0) % 12 + (/pm/i.test(m[3] || '') ? 12 : 0);
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return o.date + 'T' + pad(h) + ':' + pad(Number(m[2] || 0)) + ':00.000Z';
  }

  /* ================= ThermalPrintModal.jsx ================= */

  var host = document.createElement('div');
  document.body.appendChild(host);

  function close() { host.innerHTML = ''; }

  // NOTE: the data attribute must be all-lowercase/hyphenated. HTML lowercases
  // attribute names, so `data-printerType` arrives as `data-printertype` and
  // `dataset.printerType` (which maps to `data-printer-type`) reads undefined.
  function radio(group, opt, on) {
    var attr = group === 'printerType' ? 'printer-type' : 'paper-size';
    return '<label class="thermal-radio-option' + (on ? ' border-blue-500 bg-blue-50' : '') + '">' +
      '<input type="radio" name="' + group + '" value="' + opt.value + '"' + (on ? ' checked' : '') +
        ' class="thermal-radio-input" data-' + attr + '="' + opt.value + '">' +
      '<div class="thermal-radio-content">' +
        '<span class="' + (group === 'printerType' ? 'flex items-center gap-1.5 ' : '') + 'text-sm font-medium text-gray-900">' +
          (opt.icon ? ICON.feather(opt.icon, 'w-3.5 h-3.5') : '') + opt.label + '</span>' +
        '<span class="text-xs text-gray-500">' + opt.description + '</span>' +
      '</div></label>';
  }

  function thermal(o) {
    var label = 'text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3';

    host.innerHTML =
      '<div class="fixed inset-0 z-[100] flex items-center justify-center">' +
        '<div class="absolute inset-0 bg-black bg-opacity-50" data-close></div>' +
        '<div class="relative bg-white rounded-lg shadow-2xl w-full max-w-3xl mx-3 sm:mx-auto h-[92vh] flex flex-col thermal-modal">' +

          '<div class="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 flex-shrink-0">' +
            '<div class="min-w-0 flex-1">' +
              '<h2 class="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">' +
                ICON.feather('FiPrinter', 'w-4 h-4') + 'Thermal Print Preview</h2>' +
              '<p class="text-xs text-gray-500 mt-0.5 truncate">Invoice</p></div>' +
            '<button data-close class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0 ml-2">' +
              ICON.feather('FiX', 'w-[18px] h-[18px]') + '</button>' +
          '</div>' +

          '<div class="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">' +
            '<div class="flex-1 overflow-y-auto bg-gray-100 flex flex-col items-center py-6 px-4 min-h-0">' +
              '<p class="text-xs text-gray-400 uppercase tracking-wide mb-4 self-start">Preview</p>' +
              '<div class="bg-white shadow-md rounded" style="width:' +
                (state.paper === '58mm' ? 229 : 302) + 'px;max-width:100%">' + receipt(o) + '</div>' +
            '</div>' +

            '<div class="w-full md:w-72 flex-shrink-0 overflow-y-auto border-t md:border-t-0 md:border-l border-gray-200 px-4 sm:px-5 py-5 bg-white space-y-5">' +
              '<div><p class="' + label + '">Printer Type</p><div class="space-y-2">' +
                TYPES.map(function (t) { return radio('printerType', t, state.type === t.value); }).join('') +
              '</div></div>' +

              '<div><p class="' + label + '">Printer Device</p>' +
                (state.connect === 'trying-usb'
                  // ThermalPrintModal.jsx:344-349 — cascade status while connecting
                  ? '<div class="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700 mb-2">' +
                      ICON.feather('FiLoader', 'w-3 h-3 flex-shrink-0 animate-spin') +
                      '<span>' + USB_STATUS['trying-usb'].text + '</span></div>'
                  : '<p class="text-xs text-gray-400 mb-2">No printer connected</p>') +
                '<button data-connect' + (state.connect === 'trying-usb' ? ' disabled' : '') +
                  ' class="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">' +
                  (state.connect === 'trying-usb' ? 'Connecting\u2026'
                    : 'Connect ' + (state.type === 'usb' ? 'USB' : 'Bluetooth') + ' Printer') + '</button>' +
                (state.connect === 'failed'
                  // ThermalPrintModal.jsx:370-375 — the non-Windows fallback error box
                  ? '<div class="flex items-start gap-2 mt-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">' +
                      ICON.feather('FiAlertCircle', 'w-3.5 h-3.5 flex-shrink-0 mt-0.5') +
                      '<span class="whitespace-pre-line">No printer transport in this prototype.\n' +
                      'The real app calls ' + (state.type === 'usb' ? 'Web Serial, then WebUSB' : 'Web Bluetooth') +
                      ' here and the browser raises its own device picker.</span></div>'
                  : '<p class="text-xs text-gray-400 mt-2 leading-relaxed">A browser device picker will appear. Select your printer from the list.</p>') +
              '</div>' +

              '<div><p class="' + label + '">Paper Size</p><div class="space-y-2">' +
                PAPER.map(function (p) { return radio('paperSize', p, state.paper === p.value); }).join('') +
              '</div></div>' +

              '<div><p class="' + label + '">Copies</p><div class="thermal-copies-control">' +
                '<button class="thermal-copies-btn" data-copies="-1"' + (state.copies === 1 ? ' disabled' : '') + '>−</button>' +
                '<input type="number" min="1" max="99" value="' + state.copies + '" class="thermal-copies-input" data-copies-input>' +
                '<button class="thermal-copies-btn" data-copies="1"' + (state.copies === 99 ? ' disabled' : '') + '>+</button>' +
              '</div></div>' +

              '<div class="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-800 leading-relaxed">' +
                'Paper size and printer type are saved per browser.</div>' +
            '</div>' +
          '</div>' +

          '<div class="flex gap-3 px-4 sm:px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg flex-shrink-0">' +
            '<button data-close class="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors">Cancel</button>' +
            '<button disabled title="Connect a printer first" ' +
              'class="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">' +
              ICON.feather('FiPrinter', 'w-3.5 h-3.5') + 'Connect Printer First</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    host.onclick = function (e) {
      if (e.target.closest('[data-close]')) { close(); return; }
      var t;
      if ((t = e.target.closest('[data-printer-type]'))) { state.type = t.dataset.printerType; state.connect = 'idle'; thermal(o); return; }
      if ((t = e.target.closest('[data-paper-size]'))) { state.paper = t.dataset.paperSize; thermal(o); return; }
      if ((t = e.target.closest('[data-copies]'))) {
        state.copies = Math.max(1, Math.min(99, state.copies + Number(t.dataset.copies)));
        thermal(o); return;
      }
      if (e.target.closest('[data-connect]')) {
        // the app runs Web Serial -> WebUSB (or Web Bluetooth) and the browser
        // raises its device picker. With no transport we show the same cascade
        // and then the failure box the app shows when every leg fails.
        state.connect = 'trying-usb';
        thermal(o);
        setTimeout(function () {
          if (state.connect !== 'trying-usb') return;
          state.connect = 'failed';
          thermal(o);
        }, 1200);
        return;
      }
    };

    // typed copies — ThermalPrintModal.jsx:412-414 clamps to 1..99
    host.onchange = function (e) {
      var inp = e.target.closest('[data-copies-input]');
      if (!inp) return;
      state.copies = Math.max(1, Math.min(99, parseInt(inp.value, 10) || 1));
      thermal(o);
    };
  }

  /* ================= A4 Print — the Tax Invoice document ================= */

  function a4(o) {
    var rows = o.items.map(function (it, i) {
      return '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(it.name) + '</td>' +
        '<td class="r">' + it.qty + ' ' + esc(it.unit) + '</td>' +
        '<td class="r">' + money2(it.rate) + '</td>' +
        '<td class="r">' + money2(it.amount) + '</td></tr>';
    }).join('');

    var doc = '<!doctype html><html><head><meta charset="utf-8">' +
      '<title>Tax Invoice - ' + esc(o.id) + '</title><style>' +
      '@page{size:A4;margin:12mm}' +
      'body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:0}' +
      '.co{font-size:20px;font-weight:700}.ph{font-size:11px;margin-top:2px}' +
      '.bar{background:#f3f4f6;border:1px solid #111;padding:4px 6px;font-weight:700;margin-top:14px}' +
      '.box{border:1px solid #111;border-top:none;padding:6px}' +
      'table{width:100%;border-collapse:collapse;margin-top:14px}' +
      'th,td{border:1px solid #111;padding:4px 6px;text-align:left}' +
      'th{background:#f3f4f6;font-size:11px}' +
      '.n{width:28px;text-align:center}.r{text-align:right}' +
      'tfoot td{font-weight:700}' +
      '</style></head><body>' +
      '<div class="co">Murli</div><div class="ph">Phone: 9130409704</div>' +
      '<div class="bar">Bill To:</div>' +
      '<div class="box"><div><b>' + esc(o.customer.name || o.customer.phone) + '</b></div>' +
      '<div>Contact No: ' + esc(o.customer.phone) + '</div></div>' +
      '<table><thead><tr><th class="n">#</th><th>Item Name</th><th class="r">Qty</th>' +
      '<th class="r">Rate</th><th class="r">Amount</th></tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr><td colspan="4">Total</td><td class="r">' + money2(o.amount) + '</td></tr></tfoot></table>' +
      '</body></html>';

    var w = window.open('', '_blank');
    if (!w) {
      window.alert('The browser blocked the invoice window. Allow pop-ups for this page and try again.');
      return;
    }
    w.document.write(doc);
    w.document.close();
    w.focus();
    // the app lands in the browser's PDF viewer, where the user hits print
    setTimeout(function () { w.print(); }, 250);
  }

  window.INVOICE = { thermal: thermal, a4: a4 };
})();

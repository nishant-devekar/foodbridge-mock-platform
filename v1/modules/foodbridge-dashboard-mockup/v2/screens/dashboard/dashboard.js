/* ============================================================
   dashboard.js — Dashboard discovery prototype behaviour
   ------------------------------------------------------------
   Vanilla JS. Reads window.SEED (seed.inline.js, mirroring
   ../../seed-data/seed.json) and renders with the *literal*
   Tailwind class strings used by storefront-frontend, so the
   prototype and the real app render identically.

   Where a class string is copied from the app, the source line
   is cited. Class strings that keep windmill's base classes
   spell them out first, exactly as @windmill/react-ui composes
   them at runtime (base + passed className).

   Nothing is persisted — every interaction is local so the
   screen can be role-played.
   ============================================================ */
(function () {
  'use strict';

  var S = window.SEED;
  var ICON = window.ICON;
  if (!S || !ICON || !window.SHELL) {
    console.error('seed.inline.js / icons.js / shell.js did not load'); return;
  }

  /* ---------------- formatting — must match the app exactly ---------------- */

  // CardItemTwo.jsx: currency + ' ' + getNumberTwo(price)
  // useUtilsFunction.js getNumberTwo → parseFloat(v).toFixed(2)  → NO grouping
  function kpiMoney(n) { return '₹ ' + parseFloat(n || 0).toFixed(2); }

  // Dashboard.jsx formatDashboardMoney → `${currency}${toLocaleString('en-IN', 2dp)}`
  function money(n) {
    return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // Dashboard.jsx formatDashboardNumber → toLocaleString('en-IN', max 2dp)
  function num(n) { return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 }); }
  // SalesmanRouteReportTab.jsx:24-30 — the ₹ comes first, so a negative renders
  // "₹-1", not "-₹1"; with roundingEnabled the value rounds to whole rupees.
  function money0(n) {
    var v = Number(n || 0);
    if (S.tenant.roundOffEnabled) return '₹' + Math.round(v).toLocaleString('en-IN');
    return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(iso) {
    var p = String(iso).split('-');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function el(id) { return document.getElementById(id); }

  /* ---------------- shared class strings (from the app) ---------------- */

  // TableContainer: windmill base + Dashboard.jsx:1443 className
  var C_CONTAINER = 'w-full overflow-hidden rounded-lg ring-1 ring-black ring-opacity-5 ' +
    'mb-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto';
  var C_TABLE = 'w-full whitespace-nowrap';                           // windmill Table
  // windmill base + :1445 pass `bg-slate-50`, but the DEPLOYED app renders a
  // white header band (verified against b2bgreens on 2026-08-10), so parity with
  // the live screen means bg-white here. See addendum-003 C8.
  var C_THEAD = 'text-xs font-semibold tracking-wide text-left text-gray-500 uppercase border-b ' +
    'bg-white border-slate-200';
  var C_TBODY = 'bg-white divide-y text-gray-700';                    // windmill TableBody
  var C_ROW = 'border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60';   // :1483
  var C_TFOOT = 'px-4 py-3 border-t bg-gray-50 text-gray-500';        // windmill TableFooter
  var C_TH = 'px-4 py-3 py-4 px-6';                                   // windmill TableCell + :1447
  var C_TH_LABEL = 'text-xs font-semibold text-slate-600 uppercase tracking-wide';
  var C_TD = 'px-4 py-3 py-4 px-6 align-middle';
  // filter controls — Dashboard.jsx:1318
  var C_SELECT = 'h-10 w-full sm:w-auto sm:min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 ' +
    'text-sm text-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none';

  function th(label, extra) {
    return '<td class="' + C_TH + ' ' + (extra || '') + '"><span class="' + C_TH_LABEL + '">' + label + '</span></td>';
  }
  function container(inner, footer) {
    return '<div class="' + C_CONTAINER + '"><table class="' + C_TABLE + '">' + inner + '</table>' +
      (footer ? '<div class="' + C_TFOOT + '">' + footer + '</div>' : '') + '</div>';
  }
  /* ---------------- pagination — components/common/CustomPagination.jsx ----------------
     Dashboard.jsx:71-72 — PAGE_SIZE = ITEMS_SOLD_PAGE_SIZE = 8. Page state is
     per tab, reset when a filter narrows the set below the current page.        */
  var PAGE_SIZE = 8;
  var page = {
    product_sales: 1, recent_orders: 1, discount_report: 1,
    customer_order_pattern: 1, salesman_route_report: 1, outstanding_recovery: 1
  };

  function totalPagesOf(n) { return Math.max(1, Math.ceil(n / PAGE_SIZE)); }

  function pageSlice(rows, tab) {
    var tp = totalPagesOf(rows.length);
    if (page[tab] > tp) page[tab] = tp;                 // filter shrank the set
    var from = (page[tab] - 1) * PAGE_SIZE;
    return rows.slice(from, from + PAGE_SIZE);
  }

  // CustomPagination.jsx:16-37 — up to 6 pages listed in full, else 1 … n
  function pageNumbers(current, totalPages) {
    var pages = [], i;
    if (totalPages <= 6) { for (i = 1; i <= totalPages; i++) pages.push(i); return pages; }
    pages.push(1);
    if (current > 3) pages.push('left-ellipsis');
    var start = Math.max(2, current - 1), end = Math.min(totalPages - 1, current + 1);
    for (i = start; i <= end; i++) pages.push(i);
    if (current < totalPages - 2) pages.push('right-ellipsis');
    pages.push(totalPages);
    return pages;
  }

  var C_PAGE_BTN = 'align-bottom inline-flex items-center justify-center cursor-pointer leading-5 ' +
    'transition-colors duration-150 font-medium focus:outline-none px-3 py-1 rounded-md text-xs';
  var C_ARROW = 'px-2 py-1 text-sm rounded-md text-gray-500 hover:bg-gray-200 disabled:opacity-50';

  function pagination(tab, totalResults) {
    var current = page[tab], totalPages = totalPagesOf(totalResults);
    var start = totalResults === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
    var end = Math.min(current * PAGE_SIZE, totalResults);

    var nums = pageNumbers(current, totalPages).map(function (p) {
      if (p === 'left-ellipsis' || p === 'right-ellipsis') {
        return '<span class="px-2 text-gray-500 font-medium">...</span>';
      }
      var state = p === current ? 'text-white bg-green-500 hover:bg-green-600' : 'text-gray-600 hover:bg-gray-200';
      return '<li><button type="button" data-page="' + p + '" class="' + C_PAGE_BTN + ' ' + state + '">' + p + '</button></li>';
    }).join('');

    return '<div class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-gray-200 bg-white text-gray-500 text-sm">' +
      '<span class="font-semibold tracking-wide uppercase text-xs">SHOWING ' +
        (totalResults === 0 ? '0' : start + '–' + end) + ' OF ' + totalResults + '</span>' +
      '<div class="mt-2 sm:mt-0"><nav aria-label="Table navigation"><ul class="inline-flex items-center space-x-2">' +
        '<li><button type="button" data-page="' + (current - 1) + '" class="' + C_ARROW + '"' + (current === 1 ? ' disabled' : '') + '>‹</button></li>' +
        nums +
        '<li><button type="button" data-page="' + (current + 1) + '" class="' + C_ARROW + '"' + (current === totalPages ? ' disabled' : '') + '>›</button></li>' +
      '</ul></nav></div></div>';
  }
  function empty(cols, msg) {
    return '<tr><td colspan="' + cols + '" class="px-6 py-10 text-center text-sm text-slate-500">' + msg + '</td></tr>';
  }

  /* ================= sidebar — SidebarContent.jsx / SidebarSubMenu.jsx ================= */

  // Nav list lives in shell.js so every screen shares one copy.
  var NAV = window.SHELL.NAV;

  var C_NAV_LEAF = 'text-md transition-colors duration-150 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left';
  var C_NAV_GROUP = 'w-full flex justify-between items-center gap-3 px-3 py-2 rounded-lg text-left ' +
    'text-gray-700 hover:text-green-600 hover:bg-gray-100';

  function renderNav() {
    document.querySelector('[data-nav-list]').innerHTML = NAV.map(function (r) {
      if (r.routes) {
        return '<li class="relative gap-y-1 rounded-md transition-colors group">' +
          '<button class="' + C_NAV_GROUP + '" data-nav-toggle>' +
            '<span class="inline-flex items-center">' + ICON.lucide(r.icon, 'w-5 h-5') +
              '<span class="ml-4">' + esc(r.name) + '</span></span>' +
            '<span class="pl-4 text-xs">' + ICON.lucide(r.open ? 'ChevronUp' : 'ChevronDown', 'h-4 w-4') + '</span>' +
          '</button>' +
          '<ul class="ml-8 mt-1 space-y-1 overflow-hidden text-sm text-gray-600 rounded-md"' + (r.open ? '' : ' hidden') + ' aria-label="submenu">' +
            r.routes.map(function (c) {
              return '<li><a class="flex items-center px-3 py-1 rounded transition-colors hover:text-gray-600 hover:bg-gray-100" href="#">' +
                ICON.lucide('Minus', 'mr-1 h-3 w-3') + esc(c) + '</a></li>';
            }).join('') +
          '</ul></li>';
      }
      var on = r.name === 'Dashboard';        // this screen
      var state = on ? 'text-green-700 bg-green-50' : 'text-gray-600 hover:bg-gray-100';
      return '<li class="relative gap-y-1"><a class="' + C_NAV_LEAF + ' ' + state + '" href="' +
        (r.href || '#') + '">' + ICON.lucide(r.icon, 'w-5 h-5') +
        '<span>' + esc(r.name) + '</span></a></li>';
    }).join('');

    // MobileSidebar.jsx renders the same SidebarContent inside the drawer —
    // mirror the rendered shell rather than maintaining it twice.
    var bodies = document.querySelectorAll('[data-sidebar-body]');
    for (var i = 1; i < bodies.length; i++) bodies[i].innerHTML = bodies[0].innerHTML;

    // delegated so it works in the desktop rail and the mobile drawer alike
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-nav-toggle]');
      if (!b) return;
      var ul = b.nextElementSibling;
      var open = ul.hidden;
      ul.hidden = !open;
      b.querySelector('.pl-4').innerHTML = ICON.lucide(open ? 'ChevronUp' : 'ChevronDown', 'h-4 w-4');
    });
  }

  /* ---------------- mobile drawer — MobileSidebar.jsx ---------------- */

  function initDrawer() {
    var drawer = el('mobile-sidebar'), backdrop = el('mobile-backdrop');
    function setOpen(open) {
      drawer.hidden = !open;
      backdrop.hidden = !open;
      drawer.classList.toggle('-translate-x-20', !open);
      drawer.classList.toggle('opacity-0', !open);
      document.body.classList.toggle('overflow-hidden', open);
    }
    setOpen(false);
    el('menu-toggle').addEventListener('click', function () { setOpen(drawer.hidden); });
    backdrop.addEventListener('click', function () { setOpen(false); });
    // the drawer is lg:hidden; keep state sane when resizing back to desktop
    window.addEventListener('resize', function () {
      if (window.innerWidth >= 1024) setOpen(false);
    });

    // Outstanding Recovery swaps composition at a breakpoint (cards ⇄ table) and
    // takes its "why" default from the viewport, so it has to re-render when the
    // window crosses one. Debounced; only that tab cares.
    var lastBand = null, rt;
    window.addEventListener('resize', function () {
      var band = window.innerWidth >= 1280 ? 3 : window.innerWidth >= 1024 ? 2 : window.innerWidth >= 640 ? 1 : 0;
      if (band === lastBand) return;
      lastBand = band;
      clearTimeout(rt);
      rt = setTimeout(function () { if (active === 'outstanding_recovery') renderPanel(); }, 120);
    });
  }

  /* ================= KPI tiles — CardItemTwo.jsx ================= */

  var KPI_TONE = {
    today:      { cls: 'text-white bg-teal-600',   icon: 'ImStack',       kind: 'stacked' },
    yesterday:  { cls: 'text-white bg-orange-400', icon: 'ImStack',       kind: 'stacked' },
    month:      { cls: 'text-white bg-blue-500 card-this-month', icon: 'FiShoppingCart', kind: 'plain' },
    lastmonth:  { cls: 'text-white bg-cyan-600',   icon: 'ImCreditCard',  kind: 'plain' },
    alltime:    { cls: 'text-white bg-green-600',  icon: 'ImCreditCard',  kind: 'plain' }
  };
  var C_KPI_TITLE = 'mb-1 sm:mb-3 text-sm sm:text-base font-medium text-gray-50';
  var C_KPI_PRICE = 'text-xl sm:text-2xl font-bold leading-none text-gray-50';
  var C_KPI_ICON = 'text-center inline-block text-2xl sm:text-3xl';

  function renderKpis() {
    el('kpi-grid').innerHTML = S.kpis.map(function (k) {
      var t = KPI_TONE[k.tone];
      var glyph = t.icon.indexOf('Im') === 0 ? ICON.icomoon(t.icon) : ICON.feather(t.icon, 'w-[1em] h-[1em]');
      var inner =
        '<div class="' + C_KPI_ICON + ' ' + t.cls + '">' + glyph + '</div>' +
        '<div><p class="' + C_KPI_TITLE + '">' + esc(k.label) + '</p>' +
        '<p class="' + C_KPI_PRICE + '">' + kpiMoney(k.value) + '</p></div>';

      // Today/Yesterday take the extra centring wrapper (CardItemTwo.jsx:50-70)
      var body = t.kind === 'stacked'
        ? '<div class="p-4 border border-gray-200 justify-between w-full p-3 sm:p-6 rounded-lg ' + t.cls + '">' +
            '<div class="text-center xl:mb-0 mb-3">' + inner + '</div></div>'
        : '<div class="p-4 border border-gray-200 w-full p-3 sm:p-6 rounded-lg ' + t.cls + '">' + inner + '</div>';

      return '<div class="min-w-0 rounded-lg ring-1 ring-black ring-opacity-5 overflow-hidden bg-white flex justify-center ' +
        (t.kind === 'stacked' ? '' : 'text-center ') + 'h-full">' + body + '</div>';
    }).join('');
  }

  /* ================= tab strip — Dashboard.jsx:1258-1304 ================= */

  var TABS = [
    { key: 'product_sales', label: 'Product Sales' },
    { key: 'recent_orders', label: 'Recent Orders' },
    { key: 'discount_report', label: 'Discount Report' },
    { key: 'customer_order_pattern', label: 'Order Cycle' },
    { key: 'salesman_route_report', label: 'Salesman Route Report' },
    { key: 'outstanding_recovery', label: 'Outstanding Recovery' }
  ];
  var C_TAB = 'inline-block px-4 py-3 rounded-t-lg border-b-2 border-transparent whitespace-nowrap focus:outline-none transition-colors';
  var C_TAB_ON = 'text-emerald-600 border-emerald-600';
  var C_TAB_OFF = 'hover:text-gray-600 hover:border-gray-300';
  var active = 'product_sales';

  function renderTabs() {
    el('tab-list').innerHTML = TABS.map(function (t) {
      return '<li class="mr-1"><button type="button" data-tab="' + t.key + '" class="' + C_TAB + ' ' +
        (t.key === active ? C_TAB_ON : C_TAB_OFF) + '">' + t.label + '</button></li>';
    }).join('');
  }

  function renderPanel() {
    var host = el('panel-host');
    if (active === 'product_sales') host.innerHTML = productSales();
    else if (active === 'recent_orders') host.innerHTML = recentOrders();
    else if (active === 'discount_report') host.innerHTML = discountReport();
    else if (active === 'customer_order_pattern') host.innerHTML = orderCycle();
    else if (active === 'salesman_route_report') host.innerHTML = routeReport();
    else host.innerHTML = outstandingRecovery();
    document.querySelectorAll('[data-filters-for]').forEach(function (f) {
      f.hidden = f.dataset.filtersFor !== active;
    });
  }

  function setTab(key) { active = key; renderTabs(); renderPanel(); }

  /* ================= 1 · Product Sales — Dashboard.jsx:1441-1536 ================= */

  function productSales() {
    var period = el('ps-period').value, sort = el('ps-sort').value;
    var rows = S.productSales.map(function (p) {
      var d = p.periods[period];
      return d ? { name: p.name, code: p.code, unit: p.unit, qty: d.qty, sales: d.sales } : null;
    }).filter(Boolean);

    rows.sort(function (a, b) {
      if (sort === 'sales-asc') return a.sales - b.sales;
      if (sort === 'qty-desc') return b.qty - a.qty;
      if (sort === 'qty-asc') return a.qty - b.qty;
      if (sort === 'name-asc') return a.name.localeCompare(b.name);
      return b.sales - a.sales;
    });

    var visible = pageSlice(rows, 'product_sales');
    var rankBase = (page.product_sales - 1) * PAGE_SIZE;   // Dashboard.jsx:1475-1478

    var head = '<thead class="' + C_THEAD + '"><tr>' +
      th('Rank', 'w-[80px] text-center') + th('Product', 'min-w-[300px]') +
      th('Qty Sold', 'w-[140px] text-right') + th('Sales', 'w-[140px] text-right') + '</tr></thead>';

    var body = '<tbody class="' + C_TBODY + '">' + (visible.length ? visible.map(function (r, i) {
      return '<tr class="' + C_ROW + '">' +
        '<td class="' + C_TD + ' text-center">' +
          '<span class="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-50 px-2 text-xs font-bold text-emerald-700">#' + (rankBase + i + 1) + '</span></td>' +
        '<td class="' + C_TD + '"><div class="min-w-0">' +
          '<p class="text-sm font-semibold text-slate-800 truncate">' + esc(r.name) + '</p>' +
          '<p class="text-xs text-slate-500 mt-1 truncate">' + esc(r.code) + '</p></div></td>' +
        '<td class="' + C_TD + ' text-right"><div>' +
          '<p class="text-sm font-semibold text-slate-800">' + num(r.qty) + '</p>' +
          '<p class="text-xs text-slate-500 mt-0.5">' + esc(r.unit) + '</p></div></td>' +
        '<td class="' + C_TD + ' text-right">' +
          '<p class="text-sm font-semibold text-slate-800">' + money(r.sales) + '</p></td>' +
        '</tr>';
    }).join('') : empty(4, 'there are no matching sold items for this period.')) + '</tbody>';

    // Mobile: card list — Dashboard.jsx:1397-1429
    var cards = '<div class="block sm:hidden mb-8 space-y-2">' + (visible.length ? visible.map(function (r, i) {
      return '<div class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">' +
        '<span class="inline-flex h-8 min-w-[32px] items-center justify-center rounded-full bg-emerald-50 px-2 text-xs font-bold text-emerald-700 flex-shrink-0">#' + (rankBase + i + 1) + '</span>' +
        '<div class="flex-1 min-w-0">' +
          '<p class="text-sm font-semibold text-slate-800 truncate">' + esc(r.name) + '</p>' +
          '<p class="text-xs text-slate-500 truncate">' + esc(r.code) + '</p></div>' +
        '<div class="text-right flex-shrink-0">' +
          '<p class="text-sm font-semibold text-slate-800">' + money(r.sales) + '</p>' +
          '<p class="text-xs text-slate-500">' + num(r.qty) + ' ' + esc(r.unit) +
            ' <span class="text-slate-400">QTY Sold</span></p></div>' +
        '</div>';
    }).join('') : '<p class="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">there are no matching sold items for this period.</p>') +
      '<div class="mt-3">' + pagination('product_sales', rows.length) + '</div></div>';

    // Desktop: table — Dashboard.jsx:1442 wraps it in hidden sm:block
    return cards + '<div class="hidden sm:block">' +
      container(head + body, pagination('product_sales', rows.length)) + '</div>';
  }

  /* ================= 2 · Recent Orders ================= */

  var STATUSES = S.orderStatuses;

  function fulfilChips(f) {
    if (!f || !f.length) return '';
    return '<div class="flex items-center gap-3 mb-1">' + f.map(function (x) {
      var dot = x.kind === 'dispatch' ? 'bg-emerald-500' : 'bg-purple-500';
      var txt = x.kind === 'dispatch' ? 'text-emerald-600' : 'text-purple-600';
      var word = x.kind === 'dispatch'
        ? x.count + ' dispatch' + (x.count > 1 ? 'es' : '')
        : x.count + ' deliver' + (x.count > 1 ? 'ies' : 'y');
      return '<div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full ' + dot + '"></div>' +
        '<span class="text-xs font-medium ' + txt + '">' + word + '</span></div>';
    }).join('') + '</div>';
  }

  /* --- Invoice split-button — components/common/InvoicePrintButton.jsx --- */
  var C_INVOICE = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 ' +
    'hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';

  // OrderTable.jsx:1515-1518 — disabled for Cancelled orders and for any status
  // outside globalSetting.orderWorkflow.invoiceAllowedStatuses (server config,
  // so only the Cancelled rule is reproduced here — addendum-003 I10).
  function invoiceButton(id, disabled) {
    return '<div class="relative inline-block">' +
      '<button class="' + C_INVOICE + '"' + (disabled ? ' disabled' : '') +
        ' data-invoice="' + esc(id) + '" title="View Invoice">' +
        ICON.feather('FiFileText', 'w-4 h-4') + '<span>Invoice</span>' +
        ICON.feather('FiChevronDown', 'w-3 h-3 flex-shrink-0') + '</button></div>';
  }

  // the app portals this dropdown to <body>; same markup, positioned on open
  function invoiceMenu() {
    var item = 'w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap';
    return '<div class="bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">' +
      '<button class="' + item + '" data-print="A4">' + ICON.feather('FiPrinter', 'w-3.5 h-3.5 flex-shrink-0') + 'A4 Print</button>' +
      '<div class="border-t border-gray-100"></div>' +
      '<button class="' + item + '" data-print="Thermal">' + ICON.feather('FiPrinter', 'w-3.5 h-3.5 flex-shrink-0') + 'Thermal Print</button>' +
      '</div>';
  }

  /* --- Expanded row — components/order/OrderFulfillmentMetadata.jsx ---
     Four sub-tabs: Details / Items (n) / Comments / Fulfillment. */
  var expanded = [];        // order ids with an open detail row
  var metaTab = {};         // order id -> active sub-tab

  var META_TABS = [
    { id: 'details', label: 'Details', icon: 'FiFileText' },
    { id: 'items', label: 'Items', icon: 'FiShoppingBag' },
    { id: 'comments', label: 'Comments', icon: 'FiMessageSquare' },
    { id: 'fulfillment', label: 'Fulfillment', icon: 'FiMapPin' }
  ];

  function field(label, value, extra) {
    return '<div' + (extra ? ' class="' + extra + '"' : '') + '>' +
      '<p class="text-xs text-slate-500 mb-1">' + label + '</p>' + value + '</div>';
  }

  function metaDetails(o) {
    var val = 'text-sm font-medium text-slate-900';
    return '<div class="space-y-4"><div class="grid grid-cols-2 gap-4">' +
      field('Order Number', '<div class="flex items-center gap-2">' +
        '<p class="text-sm font-mono font-medium text-slate-900">' + esc(o.id) + '</p>' +
        '<button class="p-1 rounded-md hover:bg-slate-100 transition-all duration-200" data-copy="' + esc(o.id) + '" title="Copy Order reference">' +
        ICON.feather('FiCopy', 'w-3.5 h-3.5 text-slate-400') + '</button></div>') +
      field('Status', '<p class="' + val + ' capitalize">' + esc(displayStatus(o)) + '</p>') +
      field('Customer Name', '<p class="' + val + '">' + esc(o.customer.name || 'N/A') + '</p>') +
      field('Phone', '<p class="' + val + '">' + esc(o.customer.phone || 'N/A') + '</p>') +
      field('Email', '<p class="' + val + ' break-all">' + esc(o.customer.email || 'N/A') + '</p>', 'col-span-2 sm:col-span-1') +
      field('Order Date', '<p class="' + val + '">' + esc(orderDateTime(o)) + '</p>', 'col-span-2 sm:col-span-1') +
      '</div></div>';
  }

  function metaItems(o) {
    return '<div><div class="space-y-2">' + o.items.map(function (it) {
      return '<div class="border border-slate-200 rounded p-2 hover:bg-slate-50 transition-colors">' +
        '<div class="flex items-center justify-between gap-3">' +
          '<p class="text-sm font-medium text-slate-800">' + esc(it.name) + '</p>' +
          '<p class="text-sm font-semibold text-slate-900">' + money(it.amount) + '</p></div>' +
        '<p class="text-xs text-slate-500 mt-0.5">' + it.qty + ' ' + esc(it.unit) + ' x ' + money(it.rate) + '</p>' +
        '</div>';
    }).join('') + '</div></div>';
  }

  function metadataPane(o) {
    var act = metaTab[o.id] || 'details';
    var rail = '<div class="flex border-b border-slate-200 bg-white">' + META_TABS.map(function (t) {
      var on = t.id === act;
      var count = t.id === 'items' && o.items.length ? ' (' + o.items.length + ')' : '';
      return '<button data-metatab="' + t.id + '" data-metaorder="' + esc(o.id) + '" ' +
        'class="flex-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors ' +
        (on ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700') + '">' +
        '<div class="flex items-center justify-center gap-1.5">' + ICON.feather(t.icon, 'w-3.5 h-3.5') +
        '<span class="truncate">' + t.label + count + '</span></div></button>';
    }).join('') + '</div>';

    var pane;
    if (act === 'items') pane = metaItems(o);
    else if (act === 'comments') pane = '<p class="text-sm text-slate-500 text-center py-6">No comments on this order.</p>';
    else if (act === 'fulfillment') pane = '<p class="text-sm text-slate-500 text-center py-6">' +
      (o.fulfilment.length ? 'Dispatch and delivery records live here - not built in this iteration.' : 'No dispatches or deliveries yet.') + '</p>';
    else pane = metaDetails(o);

    return '<div class="border-t border-slate-200">' + rail +
      '<div class="p-3 sm:p-6 bg-white">' + pane + '</div></div>';
  }

  /* --- Smart Insights popover — OrderTable.jsx:1633-1788 --- */
  function insightsFor(o) {
    var itemCount = o.items.length;
    var totalQty = o.items.reduce(function (acc, i) { return acc + i.qty; }, 0);
    if (o.status === 'Cancelled') {
      return [{ title: 'Order Cancelled', message: 'This order was cancelled. No fulfilment action is pending.', action: null }];
    }
    if (!o.fulfilment.length) {
      // OrderTable.jsx:402-411 — message string verbatim
      return [{
        title: '\ud83c\udd95 Fresh Order Ready',
        message: itemCount + ' item' + (itemCount > 1 ? 's' : '') + ', ' + totalQty + ' units, \u20b9' +
          o.amount.toFixed(0) + '. Ready for processing.',
        action: 'Create dispatch'
      }];
    }
    // OrderTable.jsx:591-599 — message string verbatim
    var d = 0, dl = 0;
    o.fulfilment.forEach(function (f) { if (f.kind === 'dispatch') d += f.count; else dl += f.count; });
    return [{
      title: 'Order In Progress',
      message: d + ' dispatch' + (d > 1 ? 'es' : '') + ', ' + dl + ' delivery' + (dl > 1 ? ' runs' : '') + '. Monitoring.',
      action: 'Continue monitoring'
    }];
  }

  function insightsCard(o) {
    var body = insightsFor(o).map(function (ins) {
      return '<div class="p-3 rounded border-l-4 transition-all duration-200 overflow-hidden bg-blue-50 border-l-blue-500">' +
        '<div class="flex items-start gap-2 mb-1.5">' +
          '<h4 class="text-xs font-bold break-words flex-1 min-w-0 leading-tight text-blue-900">' + esc(ins.title) + '</h4></div>' +
        '<p class="text-xs text-slate-700 leading-snug break-words mb-2">' + esc(ins.message) + '</p>' +
        (ins.action ? '<div class="flex items-center gap-1.5 pt-2 border-t border-slate-200">' +
          '<span class="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded flex items-center gap-1">' +
            '<svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>' +
            esc(ins.action) + '</span></div>' : '') +
        '</div>';
    }).join('');

    return '<div class="bg-white rounded-lg shadow-2xl border-2 border-purple-200 overflow-hidden transition-all duration-150">' +
      '<div class="bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-2.5">' +
        '<div class="flex items-center gap-2"><div class="flex-shrink-0">' + ICON.feather('FiZap', 'w-4 h-4 text-white') + '</div>' +
        '<div class="flex-1 min-w-0"><span class="text-sm font-bold text-white block">Smart Insights</span></div></div></div>' +
      '<div class="p-3 space-y-2 max-h-96 overflow-y-auto overflow-x-hidden">' + body + '</div>' +
      '<div class="px-3 py-2 bg-slate-100 border-t border-slate-200">' +
        '<div class="flex items-center justify-center gap-1.5">' +
          '<div class="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>' +
          '<p class="text-[9px] text-slate-600 font-medium">Foodbridge Analytics</p></div></div>' +
      '</div>';
  }

  // PaymentMethodChip — OrderTable.jsx:1805-1814
  function paymentChip(o) {
    if (!o.paymentStatus) return '';
    return '<span class="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none bg-gray-100 text-gray-500">' +
      esc(o.paymentStatus) + '</span>';
  }

  /* The app routes to /order-timeline/<invoice>/<status> and /order/<invoice>/<status>.
     file:// has no router, so the same two values travel as a query string. */
  function timelineHref(o) {
    return 'order-timeline.html?order=' + encodeURIComponent(o.id) + '&status=' + encodeURIComponent(displayStatus(o));
  }
  function orderHref(o) {
    return 'order.html?order=' + encodeURIComponent(o.id) + '&status=' + encodeURIComponent(displayStatus(o));
  }

  // getDashboardOrderStatus renders "InProgress"; the raw seed value is "Inprogress"
  function displayStatus(o) { return o.status === 'Inprogress' ? 'InProgress' : o.status; }
  // Dashboard.jsx:1656 mobile format — dayjs "D MMM YYYY, h:mm A"
  function mobileDateTime(o) {
    return fmtDate(o.date) + ', ' + o.time.replace(/^0/, '').toUpperCase();
  }
  // OrderFulfillmentMetadata.jsx:393 — new Date(...).toLocaleString()
  function orderDateTime(o) {
    var p = o.date.split('-');
    return p[2] + '/' + p[1] + '/' + p[0] + ', ' + o.time.replace(/^0/, '') + ':00';
  }

  function recentOrders() {
    var want = el('ro-status').value;
    var rows = S.orders.filter(function (o) { return want === 'all' || o.status === want; });
    var visible = pageSlice(rows, 'recent_orders');

    /* Dashboard.jsx:1712-1754 emits SIX header cells (Order ID · Date · Customer ·
       Amount · Status · Actions) while OrderTable emits SEVEN body cells once
       showInvoiceAction is on — so every label from "Actions" leftwards sits one
       column left of its data, and the icon column has no header at all. That
       misalignment is in the live app; reproduced here for parity and logged as
       a real defect in addendum-003 "Defects found in the app". */
    var head = '<thead class="' + C_THEAD + '"><tr>' +
      th('Order ID', 'w-[200px]') + th('Date', 'w-[140px]') + th('Customer', 'w-[180px]') +
      th('Amount', 'w-[130px]') + th('Status', 'w-[160px]') + th('Actions', 'w-[160px] text-center') +
      '</tr></thead>';

    var body = '<tbody class="' + C_TBODY + '">' + (visible.length ? visible.map(function (o) {
      // Dashboard.jsx passes isOrderEditable={false}, so on the dashboard the
      // status select is DISABLED — that is the greyed look in the live screen.
      var opts = STATUSES.map(function (st) {
        return '<option' + (st === o.status ? ' selected' : '') + '>' + st + '</option>';
      }).join('');
      var open = expanded.indexOf(o.id) !== -1;
      return '<tr class="' + C_ROW + '" data-order="' + esc(o.id) + '">' +
        // Order ID cell — OrderTable.jsx:1162-1257
        '<td class="' + C_TD + '">' +
          '<div class="flex items-center gap-3">' +
            '<button class="p-1.5 -ml-1 hover:bg-slate-200 rounded-lg transition-all duration-200 hover:shadow-sm" ' +
              'data-expand="' + esc(o.id) + '" aria-label="' + (open ? 'Collapse' : 'Expand') + ' deliveries">' +
              ICON.feather(open ? 'FiChevronUp' : 'FiChevronDown', 'w-4 h-4 text-slate-600') + '</button>' +
            '<div class="flex flex-col gap-1">' +
              '<div class="flex items-center gap-2">' +
                '<span class="text-sm font-semibold text-slate-900 tracking-tight">' + esc(o.id) + '</span>' +
                '<button class="p-1 rounded-md hover:bg-slate-100 transition-all duration-200" data-copy="' + esc(o.id) + '" title="Copy Order Id">' +
                  ICON.feather('FiCopy', 'w-3.5 h-3.5 text-slate-400') + '</button>' +
                '<div class="relative inline-block" data-insight="' + esc(o.id) + '">' +
                  '<button class="p-1 rounded-md hover:bg-purple-50 transition-all duration-200">' +
                    ICON.feather('FiZap', 'w-3.5 h-3.5 text-purple-600') + '</button></div>' +
              '</div>' + fulfilChips(o.fulfilment) +
            '</div></div></td>' +
        '<td class="' + C_TD + '">' +
          '<p class="text-sm text-slate-700">' + fmtDate(o.date) + '</p>' +
          '<p class="text-xs text-slate-500">' + esc(o.time) + '</p></td>' +
        '<td class="' + C_TD + '">' +
          '<p class="text-sm font-semibold text-slate-800">' + esc(o.customer.name || o.customer.phone) + '</p>' +
          '<p class="text-xs text-slate-500">' + esc(o.customer.phone) + '</p></td>' +
        '<td class="' + C_TD + '"><span class="text-sm font-semibold text-slate-900">' + money(o.amount) + '</span></td>' +
        '<td class="' + C_TD + '">' +
          '<select disabled class="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-sm text-slate-500 cursor-not-allowed">' +
          opts + '</select></td>' +
        // Invoice has its own cell — OrderTable.jsx:1503-1541 (w-[120px])
        '<td class="' + C_TD + ' w-[120px]"><div class="flex items-center justify-center">' +
          invoiceButton(o.id, o.status === 'Cancelled') + '</div></td>' +
        // Actions cell — OrderTable.jsx:1543-1604 (w-[180px], gap-1); the edit
        // button is absent because the dashboard passes isOrderEditable={false}
        '<td class="' + C_TD + ' w-[180px]"><div class="flex items-center justify-center gap-1">' +
          '<a class="group/btn relative p-2 rounded-md hover:bg-slate-100 transition-all duration-200" href="' +
            timelineHref(o) + '" title="View Timeline">' +
            ICON.feather('FiClock', 'w-4 h-4 text-slate-600') + '</a>' +
          '<a class="group/btn relative p-2 rounded-md hover:bg-slate-100 transition-all duration-200" href="' +
            orderHref(o) + '" title="View Order">' +
            ICON.feather('FiEye', 'w-4 h-4 text-slate-600') + '</a>' +
        '</div></td></tr>' +
        // expanded metadata row — OrderTable.jsx:1607-1618: bg-gray-50, p-4,
        // colSpan = 6 + 1 for the invoice column
        (open ? '<tr data-detail="' + esc(o.id) + '" class="bg-gray-50"><td colspan="7" class="p-4">' +
          metadataPane(o) + '</td></tr>' : '');
    }).join('') : empty(7, 'There are no orders right now.')) + '</tbody>';

    // Mobile: card list — Dashboard.jsx:1556-1690
    var cards = '<div class="block sm:hidden mb-8 space-y-2">' + (visible.length ? visible.map(function (o) {
      var open = expanded.indexOf(o.id) !== -1;
      return '<div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">' +
        '<div class="px-4 py-3 cursor-pointer" data-mexpand="' + esc(o.id) + '">' +
          '<div class="flex items-start justify-between gap-2 mb-1">' +
            '<div class="flex items-center gap-1.5 min-w-0">' +
              '<span class="text-sm font-semibold text-slate-900 break-all leading-tight">' + esc(o.id) + '</span>' +
              '<button type="button" class="flex-shrink-0 p-1 rounded-md hover:bg-slate-100 transition-colors" data-copy="' + esc(o.id) + '" title="Copy order ID">' +
                ICON.feather('FiCopy', 'w-3.5 h-3.5 text-slate-400') + '</button>' +
              '<a class="flex-shrink-0 p-1 rounded-md hover:bg-slate-100 transition-colors" href="' + timelineHref(o) + '" title="View Timeline">' +
                ICON.feather('FiClock', 'w-3.5 h-3.5 text-slate-500') + '</a>' +
              '<a class="flex-shrink-0 p-1 rounded-md hover:bg-slate-100 transition-colors" href="' + orderHref(o) + '" title="View Order">' +
                ICON.feather('FiEye', 'w-3.5 h-3.5 text-slate-500') + '</a>' +
            '</div>' +
            '<span class="inline-flex flex-shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 whitespace-nowrap">' +
              esc(displayStatus(o)) + '</span>' +
          '</div>' +
          fulfilChips(o.fulfilment) +
          '<p class="text-xs text-slate-400 mb-2">' + mobileDateTime(o) + '</p>' +
          '<div class="flex items-center justify-between">' +
            '<div><p class="text-sm text-slate-700">' + esc(o.customer.name || o.customer.phone) + '</p>' +
              '<p class="text-xs text-slate-500">' + esc(o.customer.phone) + '</p></div>' +
            '<div class="text-right"><p class="text-sm font-semibold text-slate-900">' + money(o.amount) + '</p>' +
              paymentChip(o) + '</div>' +
          '</div>' +
          '<div class="flex items-center justify-end mt-2">' +
            '<span class="text-xs text-slate-400">' + (open ? '\u25b2 less' : '\u25bc details') + '</span></div>' +
        '</div>' +
        (open ? metadataPane(o) : '') +
        '</div>';
    }).join('') : '<p class="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">There are no orders right now.</p>') +
      '<div class="mt-3">' + pagination('recent_orders', rows.length) + '</div></div>';

    return cards + '<div class="hidden sm:block">' +
      container(head + body, pagination('recent_orders', rows.length)) + '</div>';
  }

  function orderById(id) { return S.orders.filter(function (o) { return o.id === id; })[0]; }

  /* ================= 3 · Discount Report =================
     components/dashboard/DiscountReportSection.jsx — the row's DATE cell holds
     the chevron (grid-cols-[24px_1fr]), the expanded panel is a 7-column grid of
     product cards, and a three-card totals bar sits above the pager.          */

  var dcMode = 'customer';
  var dcOpen = [];                 // expanded row ids
  var dcCal = false;               // date-range calendar visible
  var dcMonth = null;              // month shown in the calendar (Date)
  var dcRange = { from: null, to: null };

  function rowId(r) { return dcMode === 'customer' ? r.customer.phone : r.route; }

  // DiscountReportSection.jsx:601 — filter controls are h-12 here, not h-10
  var C_DC_FIELD = 'h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 ' +
    'outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

  function ymd(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function fmtRangeLabel() {
    if (!dcRange.from) return '';
    var f = fmtDate(dcRange.from);
    return dcRange.to ? f + ' - ' + fmtDate(dcRange.to) : f;
  }

  /* react-datepicker in the app (selectsRange, dateFormat "dd MMM, yyyy").
     Its look comes from the package's own stylesheet, so this is a hand-rolled
     equivalent with the same structure — see addendum-003 I11. */
  function calendarFor(which) {
    var range = which === 'sr' ? srRange : dcRange;
    var month = which === 'sr' ? srMonth : dcMonth;
    var today = new Date(S.tenant.asOf);
    var view = month || new Date(today.getFullYear(), today.getMonth(), 1);
    var y = view.getFullYear(), m = view.getMonth();
    var first = new Date(y, m, 1), startDow = first.getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var prevDays = new Date(y, m, 0).getDate();
    var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
      'August', 'September', 'October', 'November', 'December'];

    var cells = [], i;
    for (i = startDow - 1; i >= 0; i--) cells.push({ d: prevDays - i, out: true });
    for (i = 1; i <= daysInMonth; i++) cells.push({ d: i, out: false });
    while (cells.length % 7) cells.push({ d: cells.length - startDow - daysInMonth + 1, out: true });

    var body = cells.map(function (c) {
      if (c.out) return '<span class="h-7 w-7 grid place-items-center text-xs text-slate-300">' + c.d + '</span>';
      var iso = ymd(new Date(y, m, c.d));
      var isToday = iso === ymd(today);
      var inRange = range.from && range.to && iso >= range.from && iso <= range.to;
      var isEdge = iso === range.from || iso === range.to;
      var cls = 'h-7 w-7 grid place-items-center text-xs rounded cursor-pointer hover:bg-slate-100 ';
      if (isEdge) cls += 'bg-emerald-600 text-white hover:bg-emerald-600';
      else if (inRange) cls += 'bg-emerald-50 text-emerald-800';
      else if (isToday) cls += 'bg-blue-100 text-blue-800 font-semibold';
      else cls += 'text-slate-700';
      return '<button data-day="' + iso + '" data-cal-for="' + which + '" class="' + cls + '">' + c.d + '</button>';
    }).join('');

    return '<div class="absolute right-0 z-30 mt-1 w-[248px] rounded-lg border border-slate-200 bg-white p-2 shadow-xl" data-cal>' +
      '<div class="flex items-center justify-between px-1 pb-2">' +
        '<button data-cal-nav="-1" data-cal-for="' + which + '" class="h-6 w-6 grid place-items-center rounded text-slate-400 hover:bg-slate-100">' +
          ICON.feather('FiChevronLeft', 'w-3.5 h-3.5') + '</button>' +
        '<span class="text-sm font-semibold text-slate-700">' + MON[m] + ' ' + y + '</span>' +
        '<button data-cal-nav="1" data-cal-for="' + which + '" class="h-6 w-6 grid place-items-center rounded text-slate-400 hover:bg-slate-100">' +
          ICON.feather('FiChevronRight', 'w-3.5 h-3.5') + '</button>' +
      '</div>' +
      '<div class="grid grid-cols-7 gap-0.5 px-1 pb-1">' +
        ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(function (d) {
          return '<span class="h-6 grid place-items-center text-[11px] font-semibold text-slate-400">' + d + '</span>';
        }).join('') + '</div>' +
      '<div class="grid grid-cols-7 gap-0.5 px-1 pb-1">' + body + '</div>' +
      (range.from ? '<div class="border-t border-slate-100 pt-1.5 px-1">' +
        '<button data-cal-clear data-cal-for="' + which + '" class="text-xs text-slate-500 hover:text-slate-700">Clear range</button></div>' : '') +
      '</div>';
  }

  function dcRows() {
    var byCustomer = dcMode === 'customer';
    var q = (window.__dcSearch || '').trim().toLowerCase();
    var filter = window.__dcFilter || 'all';
    var src = byCustomer ? S.discountByCustomer : S.discountByRoute;

    return src.filter(function (r) {
      var label = byCustomer ? (r.customer.name + ' ' + r.customer.phone) : r.route;
      if (q && label.toLowerCase().indexOf(q) === -1) return false;
      if (dcRange.from && r.date < dcRange.from) return false;
      if (dcRange.to && r.date > dcRange.to) return false;
      if (filter === 'daily' && r.date !== ymd(new Date(S.tenant.asOf))) return false;
      if (filter === 'weekly') {
        var t = new Date(S.tenant.asOf); t.setDate(t.getDate() - 7);
        if (r.date < ymd(t)) return false;
      }
      return true;
    });
  }

  // the 7-column grid used by both the panel header and its product cards
  var DC_GRID = 'grid grid-cols-[190px_minmax(240px,1.35fr)_140px_100px_140px_130px_140px]';
  var DC_HCELL = 'px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-500';

  function detailPanel(r) {
    var orders = Array.isArray(r.orders) ? r.orders : [];
    if (!orders.length) {
      return '<p class="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">' +
        'No products found</p>';
    }
    var lines = [];
    orders.forEach(function (o) {
      o.products.forEach(function (pr) {
        lines.push(
          '<div class="' + DC_GRID + ' items-center rounded-lg border border-slate-200 bg-white shadow-sm transition-colors hover:bg-emerald-50/30">' +
            '<div class="min-w-0 px-4 py-3 text-left"><p class="truncate text-xs font-semibold text-slate-800">' + esc(o.id) + '</p></div>' +
            '<div class="min-w-0 px-4 py-3 text-left">' +
              '<p class="truncate text-sm font-medium text-slate-800">' + esc(pr.name) + '</p>' +
              '<p class="mt-0.5 truncate text-[10px] text-slate-400">' + esc(pr.code) + '</p></div>' +
            '<div class="px-4 py-3 text-center text-xs text-slate-500">' + fmtDate(o.date) + '</div>' +
            '<div class="px-4 py-3 text-center text-xs text-slate-600">' + pr.qty + ' ' + esc(pr.unit) + '</div>' +
            '<div class="px-4 py-3 text-right text-sm text-slate-700">' + money(pr.orderValue) + '</div>' +
            '<div class="px-4 py-3 text-right text-sm ' + (pr.discount > 0 ? 'text-emerald-700' : 'text-slate-500') + '">' +
              money(pr.discount) + '</div>' +
            '<div class="px-4 py-3 text-right text-sm font-semibold text-slate-900">' + money(pr.netValue) + '</div>' +
          '</div>');
      });
    });

    return '<div class="overflow-hidden rounded-xl border border-slate-200 bg-slate-100/70">' +
      '<div class="overflow-x-auto"><div class="min-w-[1080px]">' +
        '<div class="bg-slate-100/95 px-3 pb-2 pt-3">' +
          '<div class="' + DC_GRID + ' rounded-lg border border-slate-200 bg-slate-50 shadow-sm">' +
            '<div class="' + DC_HCELL + ' text-left">Order Id</div>' +
            '<div class="' + DC_HCELL + ' text-left">Products</div>' +
            '<div class="' + DC_HCELL + ' text-center">Date</div>' +
            '<div class="' + DC_HCELL + ' text-center">Qty</div>' +
            '<div class="' + DC_HCELL + ' text-right">Order Value</div>' +
            '<div class="' + DC_HCELL + ' text-right">Discount</div>' +
            '<div class="' + DC_HCELL + ' text-right">Net Value</div>' +
          '</div></div>' +
        '<div class="space-y-2 px-3 pb-3">' + lines.join('') + '</div>' +
      '</div></div></div>';
  }

  function mobileCard(r) {
    var byCustomer = dcMode === 'customer';
    var id = rowId(r), open = dcOpen.indexOf(id) !== -1;
    var name = byCustomer ? r.customer.name : r.route;
    var sub = byCustomer ? r.customer.phone : r.orders + ' orders';
    var stat = function (label, value, extra) {
      return '<div><p class="text-[11px] text-slate-500">' + label + '</p>' +
        '<p class="text-sm font-semibold ' + (extra || 'text-slate-900') + '">' + value + '</p></div>';
    };
    return '<div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">' +
      '<div class="px-4 py-3 cursor-pointer" data-dc-row="' + esc(id) + '">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<div class="min-w-0"><p class="text-sm font-semibold text-slate-900 truncate">' + esc(name) + '</p>' +
            '<p class="text-xs text-slate-500">' + esc(sub) + '</p></div>' +
          ICON.feather(open ? 'FiChevronUp' : 'FiChevronDown', 'w-4 h-4 text-slate-400 flex-shrink-0') +
        '</div>' +
        '<p class="text-xs text-slate-500 mt-1">' + fmtDate(r.date) + ', ' + r.time.replace(/^0/, '').toUpperCase() + '</p>' +
        '<div class="grid grid-cols-3 gap-2 mt-2">' +
          stat('Order', money(r.orderValue)) +
          stat('Discount', money(r.discount) + '<span class="block text-[11px] font-normal text-slate-500">' +
            r.discountPct + '%</span>', r.discount > 0 ? 'text-emerald-700' : 'text-slate-900') +
          stat('Net', money(r.netValue)) +
        '</div></div>' +
      (open ? '<div class="border-t border-slate-100 px-4 py-3 space-y-2">' +
        (Array.isArray(r.orders) ? r.orders : []).map(function (o) {
          return o.products.map(function (pr) {
            return '<div class="rounded-lg border border-slate-200 p-2">' +
              '<div class="flex items-center justify-between gap-2">' +
                '<p class="text-xs font-semibold text-slate-800 truncate">' + esc(o.id) + '</p>' +
                '<p class="text-xs text-slate-500">' + fmtDate(o.date) + '</p></div>' +
              '<p class="text-sm font-medium text-slate-800 mt-1">' + esc(pr.name) + '</p>' +
              '<p class="text-[10px] text-slate-400">' + esc(pr.code) + '</p>' +
              '<div class="grid grid-cols-3 gap-2 mt-1.5">' +
                stat('Qty', pr.qty + ' ' + esc(pr.unit)) +
                stat('Order', money(pr.orderValue)) +
                stat('Net', money(pr.netValue)) +
              '</div></div>';
          }).join('');
        }).join('') + '</div>' : '') +
      '</div>';
  }

  /* ---------------- By Route — DiscountReportSection.jsx:1377-1600 ----------------
     A different table from By Customer: route-template filter instead of the
     view-mode select, a Round Off column behind the roundOffEnabled flag, rows
     that do not expand, and totals computed over THE PAGE, not the whole set. */

  function roundOffCell(v) {
    var off = Math.round(v) - v;
    return Math.abs(off) < 0.005 ? '\u2014' : (off >= 0 ? '+' : '-') + money(Math.abs(off)).slice(1);
  }

  function byRoute() {
    var roundOff = !!S.tenant.roundOffEnabled;
    var q = (window.__dcSearch || '').trim().toLowerCase();
    var tpl = window.__dcTemplate || (S.routeTemplates || [])[0] || 'all';

    var all = S.discountByRoute.filter(function (r) {
      if (q && r.route.toLowerCase().indexOf(q) === -1) return false;
      if (tpl !== 'all' && r.route !== tpl) return false;
      if (dcRange.from && r.date < dcRange.from) return false;
      if (dcRange.to && r.date > dcRange.to) return false;
      return true;
    });
    var visible = pageSlice(all, 'discount_report');

    var segOn = 'px-4 py-1.5 rounded-full text-sm font-medium bg-emerald-600 text-white';
    var segOff = 'px-4 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-slate-800';

    var tools =
      '<div class="flex items-center gap-2 mb-4">' +
        '<div class="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">' +
          '<button data-dc-mode="customer" class="' + segOff + '">By Customer</button>' +
          '<button data-dc-mode="route" class="' + segOn + '">By Route</button>' +
        '</div></div>' +
      '<div class="grid grid-cols-1 gap-3 mb-4 lg:grid-cols-[1fr_180px_200px]">' +
        '<input id="dc-search" value="' + esc(window.__dcSearch || '') + '" placeholder="Search route-delivery" ' +
          'class="' + C_DC_FIELD + '">' +
        '<select id="dc-template" class="' + C_DC_FIELD + '">' +
          (S.routeTemplates || []).map(function (t) {
            return '<option' + (t === tpl ? ' selected' : '') + '>' + esc(t) + '</option>';
          }).join('') + '</select>' +
        '<div class="relative min-w-0">' +
          '<input id="dc-range" readonly value="' + esc(fmtRangeLabel()) + '" placeholder="Date range" ' +
            'class="' + C_DC_FIELD + ' pr-8 cursor-pointer placeholder:text-slate-400 hover:border-slate-300">' +
          (dcRange.from ? '<button data-cal-clear class="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-slate-400 hover:text-slate-600">' +
            ICON.feather('FiX', 'w-3.5 h-3.5') + '</button>' : '') +
          (dcCal ? calendarFor('dc') : '') +
        '</div></div>';

    var TH = 'border-b border-slate-200 py-4 text-xs font-semibold uppercase tracking-wide text-slate-600';
    var wide = visible.length > 0;
    var pad = wide ? 'px-6' : 'px-2';
    var head = '<thead class="bg-slate-50"><tr>' +
      '<th class="' + TH + ' text-center ' + (wide ? 'w-[190px] ' : '') + pad + '">Date</th>' +
      '<th class="' + TH + ' text-left ' + (wide ? 'min-w-[260px] ' : '') + pad + '">Route Name</th>' +
      '<th class="' + TH + ' text-right ' + (wide ? 'w-[170px] ' : '') + pad + '">Order Value</th>' +
      '<th class="' + TH + ' text-right ' + (wide ? 'w-[170px] ' : '') + pad + '">Discount</th>' +
      (roundOff ? '<th class="' + TH + ' text-right ' + (wide ? 'w-[130px] ' : '') + pad + '">Round Off</th>' : '') +
      '<th class="' + TH + ' text-right ' + (wide ? 'w-[170px] ' : '') + pad + '">Net Value</th>' +
      '</tr></thead>';

    var cols = roundOff ? 6 : 5;
    var body = '<tbody class="text-sm text-slate-700">' + (visible.length ? visible.map(function (r) {
      return '<tr class="border-b border-slate-100 hover:bg-slate-50/70">' +
        '<td class="border-b border-slate-100 px-6 py-4 text-center align-middle">' +
          '<p class="font-medium text-slate-800">' + fmtDate(r.date) + '</p>' +
          '<p class="mt-0.5 text-xs lowercase text-slate-500">' + esc(r.time) + '</p></td>' +
        '<td class="border-b border-slate-100 px-6 py-4 text-left align-middle">' +
          '<p class="font-semibold text-slate-800">' + esc(r.route) + '</p>' +
          '<p class="mt-0.5 text-xs text-slate-500">' + r.orders + ' orders</p></td>' +
        '<td class="border-b border-slate-100 px-6 py-4 text-right align-middle font-semibold text-slate-800">' +
          money(r.orderValue) + '</td>' +
        '<td class="border-b border-slate-100 px-6 py-4 text-right align-middle">' +
          '<p class="font-semibold ' + (r.discount > 0 ? 'text-emerald-700' : 'text-slate-700') + '">' +
            money(r.discount) + '</p>' +
          '<p class="mt-0.5 text-xs text-slate-500">' + r.discountPct + '%</p></td>' +
        (roundOff ? '<td class="border-b border-slate-100 px-6 py-4 text-right align-middle text-slate-700">' +
          roundOffCell(r.netValue) + '</td>' : '') +
        '<td class="border-b border-slate-100 px-6 py-4 text-right align-middle font-semibold text-slate-900">' +
          money(r.netValue) + '</td>' +
        '</tr>';
    }).join('')
      // empty state — :1538-1548
      : '<tr><td colspan="' + cols + '" class="h-[300px] px-6 py-10">' +
        '<div class="mx-auto flex max-w-sm flex-col items-center justify-center text-center">' +
          '<div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">' +
            ICON.feather('FiSearch', 'h-5 w-5') + '</div>' +
          '<h4 class="text-sm font-semibold text-slate-800">No route deliveries found</h4>' +
          '<p class="mt-1 text-xs leading-5 text-slate-500">Try another route template or date range.</p>' +
        '</div></td></tr>') + '</tbody>';

    // totals are per PAGE here — :1557-1566
    var tot = visible.reduce(function (a, r) {
      return { o: a.o + r.orderValue, d: a.d + r.discount };
    }, { o: 0, d: 0 });
    var net = Math.max(0, tot.o - tot.d);
    var pct = tot.o ? (tot.d / tot.o * 100) : 0;
    var card = function (label, value, cls) {
      return '<div class="flex items-center justify-between rounded-lg bg-white px-4 py-2.5">' +
        '<span class="font-medium text-slate-500">' + label + '</span>' +
        '<span class="font-semibold ' + (cls || 'text-slate-900') + '">' + value + '</span></div>';
    };
    var totals = '<div class="grid gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3 text-sm ' +
        (roundOff ? 'md:grid-cols-4' : 'md:grid-cols-3') + '">' +
      card('Order Value (this page)', money(tot.o)) +
      card('Discount (this page)', money(tot.d) + ' (' + pct.toFixed(1) + '%)', 'text-emerald-700') +
      (roundOff ? card('Round Off (this page)', roundOffCell(net), 'text-slate-700') : '') +
      card('Net Value (this page)', money(net)) +
      '</div>';

    var desktop = '<div class="hidden sm:block"><div class="' + C_CONTAINER + '">' +
      '<div class="overflow-x-auto"><table class="w-full border-separate border-spacing-0 ' +
        (wide ? 'min-w-[920px]' : 'table-fixed') + '">' + head + body + '</table></div>' +
      totals + pagination('discount_report', all.length) + '</div></div>';

    var mobile = '<div class="block sm:hidden mb-8 space-y-2">' +
      (visible.length ? visible.map(function (r) {
        var stat = function (l, v, c) {
          return '<div><p class="text-[11px] text-slate-500">' + l + '</p>' +
            '<p class="text-sm font-semibold ' + (c || 'text-slate-900') + '">' + v + '</p></div>';
        };
        return '<div class="rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-3">' +
          '<p class="text-sm font-semibold text-slate-900">' + esc(r.route) + '</p>' +
          '<p class="text-xs text-slate-500">' + r.orders + ' orders \u00b7 ' + fmtDate(r.date) + '</p>' +
          '<div class="grid grid-cols-3 gap-2 mt-2">' +
            stat('Order', money(r.orderValue)) +
            stat('Discount', money(r.discount), r.discount > 0 ? 'text-emerald-700' : 'text-slate-900') +
            stat('Net', money(r.netValue)) +
          '</div></div>';
      }).join('')
        : '<div class="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center">' +
          '<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">' +
            ICON.feather('FiSearch', 'h-5 w-5') + '</div>' +
          '<h4 class="text-sm font-semibold text-slate-800">No route deliveries found</h4>' +
          '<p class="mt-1 text-xs leading-5 text-slate-500">Try another route template or date range.</p></div>') +
      '<div class="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 text-sm">' +
        card('Order Value (this page)', money(tot.o)) +
        card('Discount (this page)', money(tot.d) + ' (' + pct.toFixed(1) + '%)', 'text-emerald-700') +
        (roundOff ? card('Round Off (this page)', roundOffCell(net), 'text-slate-700') : '') +
        card('Net Value (this page)', money(net)) +
      '</div>' +
      '<div class="mt-3">' + pagination('discount_report', all.length) + '</div></div>';

    return tools + mobile + desktop;
  }

  function discountReport() {
    if (dcMode !== 'customer') return byRoute();

    var byCustomer = true;
    var all = dcRows();
    var visible = pageSlice(all, 'discount_report');

    var segOn = 'px-4 py-1.5 rounded-full text-sm font-medium bg-emerald-600 text-white';
    var segOff = 'px-4 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-slate-800';

    var tools =
      '<div class="flex items-center gap-2 mb-4">' +
        '<div class="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">' +
          '<button data-dc-mode="customer" class="' + (byCustomer ? segOn : segOff) + '">By Customer</button>' +
          '<button data-dc-mode="route" class="' + (byCustomer ? segOff : segOn) + '">By Route</button>' +
        '</div></div>' +
      '<div class="grid grid-cols-1 gap-3 mb-4 lg:grid-cols-[1fr_180px_200px]">' +
        '<input id="dc-search" value="' + esc(window.__dcSearch || '') + '" placeholder="Search ' +
          (byCustomer ? 'customer' : 'route') + '" class="' + C_DC_FIELD + '">' +
        '<select id="dc-filter" class="' + C_DC_FIELD + '">' +
          [['all', 'All'], ['daily', 'Daily'], ['weekly', 'Weekly']].map(function (o) {
            return '<option value="' + o[0] + '"' + ((window.__dcFilter || 'all') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
          }).join('') + '</select>' +
        '<div class="relative min-w-0">' +
          '<input id="dc-range" readonly value="' + esc(fmtRangeLabel()) + '" placeholder="Date range" ' +
            'class="' + C_DC_FIELD + ' pr-8 cursor-pointer placeholder:text-slate-400 hover:border-slate-300">' +
          (dcRange.from ? '<button data-cal-clear class="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-slate-400 hover:text-slate-600">' +
            ICON.feather('FiX', 'w-3.5 h-3.5') + '</button>' : '') +
          (dcCal ? calendarFor('dc') : '') +
        '</div>' +
      '</div>';

    var head = '<thead class="' + C_THEAD + '"><tr>' +
      th('Date', 'w-[190px]') + th(byCustomer ? 'Customer Name' : 'Route') +
      th('Order Value', 'w-[150px] text-right') + th('Discount', 'w-[130px] text-right') +
      th('Net Value', 'w-[150px] text-right') + '</tr></thead>';

    var body = '<tbody class="text-sm text-slate-700">' + (visible.length ? visible.map(function (r) {
      var id = rowId(r), open = dcOpen.indexOf(id) !== -1;
      var name = byCustomer ? r.customer.name : r.route;
      var sub = byCustomer ? r.customer.phone : r.orders + ' orders';
      return '<tr class="cursor-pointer border-b border-slate-100 hover:bg-slate-50/70" data-dc-row="' + esc(id) + '">' +
          '<td class="border-b border-slate-100 px-4 py-4 text-center align-middle">' +
            '<div class="grid grid-cols-[24px_1fr] items-center gap-2">' +
              '<span class="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">' +
                ICON.feather(open ? 'FiChevronUp' : 'FiChevronDown', 'w-[15px] h-[15px]') + '</span>' +
              '<div class="min-w-0"><p class="font-medium text-slate-800">' + fmtDate(r.date) + '</p>' +
                '<p class="mt-0.5 text-xs lowercase text-slate-500">' + esc(r.time) + '</p></div>' +
            '</div></td>' +
          '<td class="border-b border-slate-100 px-6 py-4 text-left align-middle">' +
            '<p class="font-semibold text-slate-800">' + esc(name) + '</p>' +
            '<p class="mt-0.5 text-xs text-slate-500">' + esc(sub) + '</p></td>' +
          '<td class="border-b border-slate-100 px-6 py-4 text-right align-middle font-semibold text-slate-800">' +
            money(r.orderValue) + '</td>' +
          '<td class="border-b border-slate-100 px-6 py-4 text-right align-middle">' +
            '<p class="font-semibold ' + (r.discount > 0 ? 'text-emerald-700' : 'text-slate-700') + '">' +
              money(r.discount) + '</p>' +
            '<p class="mt-0.5 text-xs text-slate-500">' + r.discountPct + '%</p></td>' +
          '<td class="border-b border-slate-100 px-6 py-4 text-right align-middle font-semibold text-slate-900">' +
            money(r.netValue) + '</td>' +
        '</tr>' +
        (open ? '<tr><td colspan="5" class="border-b border-slate-200 bg-slate-50/70 px-5 py-3">' +
          detailPanel(r) + '</td></tr>' : '');
    }).join('') : '<tr><td colspan="5" class="px-6 py-10 text-center text-sm text-slate-500">' +
      'No rows match these filters.</td></tr>') + '</tbody>';

    // totals bar — DiscountReportSection.jsx:1192-1218 (over the whole filtered set)
    var tot = all.reduce(function (a, r) {
      return { o: a.o + r.orderValue, d: a.d + r.discount, n: a.n + r.netValue };
    }, { o: 0, d: 0, n: 0 });
    var pct = tot.o ? (tot.d / tot.o * 100) : 0;
    var card = function (label, value, cls) {
      return '<div class="flex items-center justify-between rounded-lg bg-white px-4 py-2.5">' +
        '<span class="font-medium text-slate-500">' + label + '</span>' +
        '<span class="font-semibold ' + (cls || 'text-slate-900') + '">' + value + '</span></div>';
    };
    var totals = '<div class="grid gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3 text-sm md:grid-cols-3">' +
      card('Total Order Value', money(tot.o)) +
      card('Total Discount', money(tot.d) + ' (' + pct.toFixed(1) + '%)', 'text-emerald-700') +
      card('Net Value', money(tot.n)) +
      '</div>';

    var desktop = '<div class="hidden sm:block"><div class="' + C_CONTAINER + '">' +
      '<div class="overflow-x-auto"><table class="w-full">' + head + body + '</table></div>' +
      totals + pagination('discount_report', all.length) + '</div></div>';

    var mobile = '<div class="block sm:hidden mb-8 space-y-2">' +
      (visible.length ? visible.map(mobileCard).join('')
        : '<p class="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">No rows match these filters.</p>') +
      '<div class="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 text-sm">' +
        card('Total Order Value', money(tot.o)) +
        card('Total Discount', money(tot.d) + ' (' + pct.toFixed(1) + '%)', 'text-emerald-700') +
        card('Net Value', money(tot.n)) +
      '</div>' +
      '<div class="mt-3">' + pagination('discount_report', all.length) + '</div></div>';

    return tools + mobile + desktop;
  }

  /* ================= 4 · Order Cycle =================
     components/dashboard/CustomerOrderPatternReport.jsx — compact h-8 filters,
     bordered pill tag filters, a coloured left edge per row, a thin progress bar
     with a percentage only when not overdue, and a footer count (no pagination
     until the set exceeds the page limit).                                    */

  // TAG_CONFIG (:15-51). Note there is NO entry for `not_ordering`, so TagBadge's
  // `TAG_CONFIG[tag] || TAG_CONFIG.new` fallback renders it as "New" — which is
  // why the live screen shows a New chip next to "69d without ordering".
  var TAG_CONFIG = {
    overdue:  { label: 'Overdue',  bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-300',  dot: 'bg-orange-500', edge: 'border-l-orange-500' },
    due_soon: { label: 'Due Soon', bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-400',  edge: 'border-l-amber-400' },
    on_track: { label: 'On Track', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500', edge: 'border-l-emerald-500' },
    new:      { label: 'New',      bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-300',   dot: 'bg-slate-400',  edge: 'border-l-slate-300' }
  };
  var TAG_EDGE_NOT_ORDERING = 'border-l-red-500';
  var cycleFilter = null;

  function tagCfg(tag) { return TAG_CONFIG[tag] || TAG_CONFIG.new; }

  // PatternProgress (:108-161)
  function progressCell(r) {
    if (r.status === 'new') return '<span class="text-xs text-slate-400">No pattern yet</span>';

    var rawPct = Math.round((r.daysSince / r.cadenceDays) * 100);
    var barPct = Math.min(rawPct, 100);
    var isOverdue = r.status === 'overdue' || r.status === 'not_ordering';
    var barColor = r.status === 'on_track' ? 'bg-emerald-500'
      : r.status === 'due_soon' ? 'bg-amber-400' : 'bg-red-500';
    var labelColor = r.status === 'on_track' ? 'text-slate-500'
      : r.status === 'due_soon' ? 'text-amber-700' : 'text-red-600';

    var label;
    if (r.status === 'on_track') {
      var rem = Math.round(r.cadenceDays - r.daysSince);
      label = rem === 0 ? 'Due today' : 'Due in ' + rem + 'd';
    } else if (r.status === 'due_soon') {
      label = 'Due in ' + Math.round(r.cadenceDays - r.daysSince) + 'd';
    } else if (r.status === 'overdue') {
      label = Math.round(r.daysSince - r.cadenceDays) + 'd overdue';
    } else {
      label = Math.round(r.daysSince) + 'd without ordering';
    }

    return '<div class="min-w-[130px]">' +
      '<div class="mb-1 flex items-center gap-2">' +
        '<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">' +
          '<div class="h-full rounded-full transition-all duration-300 ' + barColor + '" style="width:' + barPct + '%"></div>' +
        '</div>' +
        (isOverdue ? '' : '<span class="shrink-0 tabular-nums text-[11px] text-slate-400">' + rawPct + '%</span>') +
      '</div>' +
      '<p class="text-xs font-medium ' + labelColor + '">' + label + '</p></div>';
  }

  function tagBadge(tag) {
    var c = tagCfg(tag);
    return '<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ' +
      c.bg + ' ' + c.text + ' ' + c.border + '">' +
      '<span class="h-1.5 w-1.5 rounded-full shrink-0 ' + c.dot + '"></span>' + c.label + '</span>';
  }

  function orderCycle() {
    var q = (window.__ocSearch || '').trim().toLowerCase();
    var win = window.__ocWindow || 'Any time';
    var minDays = /Over (\d+) days/.exec(win);
    minDays = minDays ? Number(minDays[1]) : null;

    var rows = S.orderCycle.filter(function (r) {
      if (q && r.customer.toLowerCase().indexOf(q) === -1) return false;
      if (cycleFilter && r.status !== cycleFilter) return false;   // not_ordering never matches a pill
      if (minDays && r.daysSince <= minDays) return false;
      return true;
    });

    var C_H8 = 'h-8 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 ' +
      'focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-300';

    var pills = Object.keys(TAG_CONFIG).map(function (k) {
      var c = TAG_CONFIG[k], on = cycleFilter === k;
      return '<button data-cycle="' + k + '" class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all ' +
        (on ? c.bg + ' ' + c.text + ' ' + c.border
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50') + '">' +
        '<span class="h-1.5 w-1.5 rounded-full ' + c.dot + '"></span>' + c.label + '</button>';
    }).join('');

    var header =
      '<div class="px-6 pt-5">' +
        '<div class="flex items-start justify-between gap-4">' +
          '<div><h3 class="text-base font-semibold text-slate-800">Order Cycle</h3>' +
            '<p class="mt-0.5 text-xs text-slate-500">Based on each customer\'s ordering history at this location</p></div>' +
          '<button id="oc-refresh" class="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 active:bg-slate-100">' +
            ICON.feather('FiRefreshCw', 'h-3.5 w-3.5') + 'Refresh</button>' +
        '</div>' +
        '<div class="mt-4 flex flex-wrap items-center gap-3">' +
          '<div class="relative">' +
            '<span class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">' +
              ICON.feather('FiSearch', 'h-3.5 w-3.5') + '</span>' +
            '<input id="oc-search" value="' + esc(window.__ocSearch || '') + '" placeholder="Search customer…" ' +
              'class="' + C_H8 + ' pl-8 pr-3 placeholder-slate-400"></div>' +
          '<select id="oc-window" class="' + C_H8 + ' px-2.5">' +
            S.orderCycleWindows.map(function (w) {
              return '<option' + (w === win ? ' selected' : '') + '>' + w + '</option>';
            }).join('') + '</select>' +
          '<div class="h-5 w-px bg-slate-200"></div>' +
          pills +
          (cycleFilter ? '<button data-cycle-clear class="text-xs text-slate-400 underline hover:text-slate-600">Clear filter</button>' : '') +
        '</div></div>';

    var TH = 'border-b border-slate-200 px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap';
    var head = '<thead><tr class="bg-slate-50">' +
      ['Customer', 'Last Ordered', 'Orders Every', 'Cycle Progress', 'Status'].map(function (c) {
        return '<th class="' + TH + '">' + c + '</th>';
      }).join('') + '</tr></thead>';

    var body = '<tbody>' + (rows.length ? rows.map(function (r) {
      var edge = r.status === 'not_ordering' ? TAG_EDGE_NOT_ORDERING : tagCfg(r.status).edge;
      return '<tr class="border-b border-slate-100 border-l-2 hover:bg-slate-50/60 transition-colors ' + edge + '">' +
        '<td class="px-6 py-4">' +
          '<p class="font-medium text-slate-800 leading-tight">' + esc(r.customer) + '</p>' +
          '<p class="mt-0.5 text-[11px] text-slate-400">' + r.ordersTotal + ' orders total</p></td>' +
        '<td class="px-6 py-4">' +
          '<p class="text-sm text-slate-700">' + fmtDate(r.lastOrdered) + '</p>' +
          '<p class="mt-0.5 text-[11px] text-slate-400">' + esc(r.lastOrderedAgo) + '</p></td>' +
        '<td class="px-6 py-4"><p class="text-sm text-slate-700">' + esc(r.cadenceLabel) + '</p></td>' +
        '<td class="px-6 py-4">' + progressCell(r) + '</td>' +
        '<td class="px-6 py-4">' + tagBadge(r.status) + '</td>' +
        '</tr>';
    }).join('')
      : '<tr><td colspan="5" class="px-6 py-12 text-center text-sm text-slate-400">' +
        'No customers match the current filters.</td></tr>') + '</tbody>';

    // the app paginates only past its page limit; below that it is just the count
    var footer = rows.length
      ? (rows.length > PAGE_SIZE ? pagination('customer_order_pattern', rows.length) : '') +
        '<div class="border-t border-slate-100 px-6 py-2.5 text-xs text-slate-400">' +
          rows.length + ' customer' + (rows.length !== 1 ? 's' : '') + ' · current location only</div>'
      : '';

    // mobile keeps the table and scrolls it horizontally — there is no card view here
    return '<div class="' + C_CONTAINER + '">' + header +
      '<div class="overflow-x-auto mt-4"><table class="w-full border-separate border-spacing-0 text-sm">' +
        head + body + '</table></div>' + footer + '</div>';
  }

  /* ================= 5 · Salesman Route Report =================
     components/dashboard/SalesmanRouteReportTab.jsx — the only tab that styles
     with gray-* rather than slate-*, keeps its filters in a separate card, and
     has its own pager markup ("… of N entries"). Its own date-range state, so
     filtering here does not disturb the Discount Report's range.            */

  var srCal = false, srMonth = null, srRange = { from: null, to: null };

  function srRangeLabel() {
    if (!srRange.from) return '';
    return srRange.to ? fmtDate(srRange.from) + ' - ' + fmtDate(srRange.to) : fmtDate(srRange.from);
  }

  // DifferenceValue (:57-62): red below zero, green-600 at or above, "+" when positive
  function differenceValue(n) {
    var cls = n < 0 ? 'text-red-600' : 'text-green-600';
    var sign = n > 0 ? '+' : '';
    return '<span class="font-semibold ' + cls + '">' + sign + money0(n) + '</span>';
  }

  function routeReport() {
    var q = (window.__srSearch || '').trim().toLowerCase();
    var route = window.__srRoute || 'all', staff = window.__srStaff || 'all';

    var all = S.salesmanRouteReport.filter(function (r) {
      if (q && r.route.toLowerCase().indexOf(q) === -1 && r.salesman.toLowerCase().indexOf(q) === -1) return false;
      if (route !== 'all' && r.route.indexOf(route) !== 0) return false;
      if (staff !== 'all' && r.salesman !== staff) return false;
      if (srRange.from && r.date < srRange.from) return false;
      if (srRange.to && r.date > srRange.to) return false;
      return true;
    });
    var visible = pageSlice(all, 'salesman_route_report');

    var C_SR_FIELD = 'h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 ' +
      'outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

    // filter bar is its own card — :166-168
    var filters = '<div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4">' +
      '<div class="grid w-full min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_170px_170px_minmax(180px,240px)]">' +
        '<div class="relative min-w-0"><input type="search" id="sr-search" value="' + esc(window.__srSearch || '') + '" ' +
          'placeholder="Search route-delivery" class="' + C_SR_FIELD + '"></div>' +
        '<select id="sr-route" class="' + C_SR_FIELD + '"><option value="all">All Routes</option>' +
          S.routes.map(function (r) {
            return '<option' + (r === route ? ' selected' : '') + '>' + esc(r) + '</option>';
          }).join('') + '</select>' +
        '<select id="sr-staff" class="' + C_SR_FIELD + '"><option value="all">All Staff</option>' +
          S.staff.map(function (x) {
            return '<option' + (x === staff ? ' selected' : '') + '>' + esc(x) + '</option>';
          }).join('') + '</select>' +
        '<div class="relative min-w-0">' +
          '<input id="sr-range" readonly value="' + esc(srRangeLabel()) + '" placeholder="Date range" ' +
            'class="' + C_SR_FIELD + ' pr-8 cursor-pointer hover:border-slate-300">' +
          (srRange.from ? '<button data-sr-cal-clear class="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-slate-400 hover:text-slate-600">' +
            ICON.feather('FiX', 'w-3.5 h-3.5') + '</button>' : '') +
          (srCal ? calendarFor('sr') : '') +
        '</div>' +
      '</div></div>';

    var TH = 'py-3 px-4 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap';
    var COLS = [
      ['Route', 'text-left'], ['Salesman', 'text-left'], ['Cash', 'text-right'], ['UPI', 'text-right'],
      ['Total Collected', 'text-right'], ['Opening Cash', 'text-right'], ['Expense', 'text-right'],
      ['Handed Over', 'text-right'], ['Difference', 'text-right']
    ];
    var head = '<thead class="bg-gray-50 border-b border-gray-200"><tr>' +
      COLS.map(function (c) { return '<th class="' + c[1] + ' ' + TH + '">' + c[0] + '</th>'; }).join('') +
      '</tr></thead>';

    var cell = function (v, strong) {
      return '<td class="py-3 px-4 text-right ' + (strong ? 'font-semibold text-gray-800' : 'font-medium text-gray-700') +
        '">' + money0(v) + '</td>';
    };

    var body = '<tbody class="divide-y divide-gray-100">' + (visible.length ? visible.map(function (r) {
      return '<tr class="hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent transition-colors duration-150">' +
        '<td class="py-3 px-4"><p class="font-medium text-gray-800">' + esc(r.route) + '</p>' +
          '<p class="text-xs text-gray-500">' + fmtDate(r.date) + '</p></td>' +
        '<td class="py-3 px-4 text-gray-700">' + esc(r.salesman) + '</td>' +
        cell(r.cash) + cell(r.upi) + cell(r.totalCollected, true) + cell(r.openingCash) +
        cell(r.expense) + cell(r.handedOver) +
        '<td class="py-3 px-4 text-right">' + differenceValue(r.difference) + '</td>' +
        '</tr>';
    }).join('')
      : '<tr><td colspan="9" class="py-12 text-center text-gray-400 text-sm">' +
        'No settled routes found for the selected filters.</td></tr>') + '</tbody>';

    // the tab's own pager — :385-400
    var from = all.length ? (page.salesman_route_report - 1) * PAGE_SIZE + 1 : 0;
    var to = Math.min(page.salesman_route_report * PAGE_SIZE, all.length);
    var totalPages = totalPagesOf(all.length);
    var arrow = 'p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600';
    var pager = all.length ? '<div class="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white">' +
        '<p class="text-xs text-gray-500">Showing ' + from + '\u2013' + to + ' of ' + all.length + ' entries</p>' +
        '<div class="flex items-center gap-1">' +
          '<button data-page="' + (page.salesman_route_report - 1) + '" class="' + arrow + '"' +
            (page.salesman_route_report <= 1 ? ' disabled' : '') + '>' + ICON.feather('FiChevronLeft', 'w-3.5 h-3.5') + '</button>' +
          pageNumbers(page.salesman_route_report, totalPages).map(function (n) {
            if (n === 'left-ellipsis' || n === 'right-ellipsis') return '<span class="px-2 text-gray-400">...</span>';
            var on = n === page.salesman_route_report;
            return '<button data-page="' + n + '" class="min-w-[28px] px-2 py-1 rounded border text-xs ' +
              (on ? 'border-emerald-600 bg-emerald-600 text-white font-semibold'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50') + '">' + n + '</button>';
          }).join('') +
          '<button data-page="' + (page.salesman_route_report + 1) + '" class="' + arrow + '"' +
            (page.salesman_route_report >= totalPages ? ' disabled' : '') + '>' + ICON.feather('FiChevronRight', 'w-3.5 h-3.5') + '</button>' +
        '</div></div>' : '';

    var desktop = '<div class="hidden sm:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">' +
      '<div class="overflow-x-auto"><table class="w-full text-sm">' + head + body + '</table></div>' +
      pager + '</div>';

    // mobile: stacked label/value cards — :254-295
    var pair = function (label, value) {
      return '<div class="flex flex-col gap-0.5">' +
        '<span class="text-xs text-gray-400 uppercase tracking-wide">' + label + '</span>' +
        '<span class="text-sm font-semibold text-gray-800">' + value + '</span></div>';
    };
    var mobile = '<div class="sm:hidden bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">' +
      (visible.length ? '<div class="divide-y divide-gray-100">' + visible.map(function (r) {
        return '<div class="px-4 py-3 space-y-2 bg-white">' +
          '<div class="flex items-center justify-between">' +
            '<span class="font-bold text-sm text-gray-900">' + esc(r.route) + '</span>' +
            '<span class="text-xs font-medium text-gray-500">' + fmtDate(r.date) + '</span></div>' +
          '<div class="text-xs text-gray-500">' + esc(r.salesman) + '</div>' +
          '<div class="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">' +
            pair('Cash', money0(r.cash)) + pair('UPI', money0(r.upi)) +
            pair('Total Collected', money0(r.totalCollected)) + pair('Opening Cash', money0(r.openingCash)) +
            pair('Expense', money0(r.expense)) + pair('Handed Over', money0(r.handedOver)) +
            '<div class="flex flex-col gap-0.5 col-span-2">' +
              '<span class="text-xs text-gray-400 uppercase tracking-wide">Difference</span>' +
              differenceValue(r.difference) + '</div>' +
          '</div></div>';
      }).join('') + '</div>'
        : '<div class="py-12 text-center text-gray-400 text-sm">No settled routes found for the selected filters.</div>') +
      pager + '</div>';

    return '<div class="mt-4 space-y-4">' + filters + mobile + desktop + '</div>';
  }

  /* ================= 6 · Outstanding Recovery =================
     The other four report tabs answer "what happened". This one answers
     "where is the cash bleeding, and why" — receivables grouped by CAUSE,
     because each cause needs a different person to fix it. Customer
     Receivables (Finance module) already lists who owes what; a debtor
     list supports exactly one action, so this deliberately is not one.

     Everything rendered here is a reduction over S.recoveryOutstanding —
     cause totals, the ours/theirs split, ageing, concentration and the
     action counts — so no two figures on screen can disagree
     (addendum-002 D8/D9). `_check-recovery.js` asserts the same from the
     seed side. `prevOutstanding` is the one stored aggregate, because no
     row can carry a prior month's state (D10).

     Vocabulary is the Finance module's, unchanged: invoiced / collected /
     outstanding / advance / net receivable.                            */

  var rcCause = null;          // active cause filter (card click)
  var rcRoute = 'all';         // active route filter (concentration panel)
  var rcCustomer = null;       // active customer filter (concentration panel)
  var rcOwnerF = null;         // 'us' | 'them' — the header split, used as a filter
  var rcOpen = [];             // expanded customer ids

  var RC_ASOF = new Date(S.tenant.asOf);

  // whole days, midnight to midnight — a half-day offset would tip a row
  // between ageing buckets and desync the bars from the table
  function rcAge(iso) {
    var a = String(iso).split('-');
    return Math.round((Date.UTC(RC_ASOF.getFullYear(), RC_ASOF.getMonth(), RC_ASOF.getDate()) -
      Date.UTC(Number(a[0]), Number(a[1]) - 1, Number(a[2]))) / 86400000);
  }
  function rcOldest(r) {
    return r.invoices.reduce(function (m, i) { return Math.max(m, rcAge(i.date)); }, 0);
  }
  function rcBucket(age) {
    var bs = S.recoveryAgeBuckets;
    for (var i = 0; i < bs.length; i++) if (bs[i].max === null || age <= bs[i].max) return bs[i];
    return bs[bs.length - 1];
  }
  function rcSum(rows) {
    return rows.reduce(function (a, r) { return a + Number(r.outstanding || 0); }, 0);
  }
  function rcCauseOf(id) {
    return S.recoveryCauses.filter(function (c) { return c.id === id; })[0];
  }
  function rcPct(part, whole) { return whole ? Math.round(part / whole * 100) : 0; }

  // D7 — owner is derived from cause, never stored per row, so the hero
  // split cannot drift from the cards
  /* "Ours to fix / Theirs to chase" tested badly: every rupee here is ours, so
     "theirs" reads as if the money belongs to them. The split is about WHAT IS
     BLOCKING the money, so the labels name the blockage instead, and the
     sub-line names the actual causes rather than describing them abstractly.

     Colour was backwards too — our own errors were emerald, which reads as
     "healthy, nothing to do". Self-inflicted money is the amber one; money a
     customer simply has not paid yet is the neutral one. */
  var RC_OWNER = {
    us: {
      label: 'Our error', head: 'We are the blocker', bar: 'bg-amber-500',
      chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500',
      why: 'Wrong paperwork, failed deliveries, open disputes',
      todo: 'Fix these without calling anyone'
    },
    them: {
      label: 'Unpaid', head: 'Customer has not paid', bar: 'bg-slate-400',
      chip: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400',
      why: 'Past agreed terms, or habitually late',
      todo: 'Needs a call, a visit or tighter terms'
    },
    /* The system cannot derive cause — so rows it cannot explain say so rather
       than being force-fitted into the nearest bucket. A wrong cause sends the
       owner to do the wrong thing; "not established" sends them to find out,
       which is the correct next step and a real finding in its own right. */
    unknown: {
      label: 'Unclassified', head: 'Nobody knows why', bar: 'bg-violet-400',
      chip: 'bg-violet-50 text-violet-700 border-violet-200 border-dashed', dot: 'bg-violet-400',
      why: 'No dispute, no claim, no contact note on file',
      todo: 'Someone has to find out before it can be worked'
    }
  };
  function rcOwner(r) { return RC_OWNER[rcCauseOf(r.cause).owner]; }

  var RC_BUCKET_TONE = { b0: 'bg-emerald-400', b16: 'bg-amber-300', b31: 'bg-orange-400', b60: 'bg-red-500' };

  /* Row actions are cause-dependent: each cause has a different real next
     step, so no row gets a generic "View". The first is the primary and
     shows on the collapsed row. Every one is a deliberate dead end — the
     flows themselves belong to Finance / Logistics. */
  /* `contacted` is the one action this report can genuinely complete. Every
     other one hands off to Finance / Distribution / Customer Management and can
     only say so. This writes lastContact on the row, which drops it out of the
     never-contacted band and re-orders the list — a visible, closed loop. */

  /* Classifying is the second action this report can finish by itself. An
     unexplained row is a question addressed to the office, and answering it is
     the whole job — so the answer is recorded here rather than handed off. */
  var rcClassifying = null;      // row id whose cause picker is open

  function rcSetCause(id, causeId) {
    var r = S.recoveryOutstanding.filter(function (x) { return x.id === id; })[0];
    if (!r || !rcCauseOf(causeId)) return;
    r.cause = causeId;
    r.reason = 'Cause set from the recovery report on ' + fmtDate(S.tenant.asOf) + '.';
    rcClassifying = null;
    renderPanel();
  }

  /* The one control left on a row. It is not an action handed to another
     module — an unexplained row is a question addressed to the office, and
     recording the answer is this report's own job. */
  function rcCausePicker(r) {
    if (r.cause !== 'unclassified') return '';
    if (rcClassifying !== r.id) {
      return '<button data-rc-act="classify" data-rc-for="' + esc(r.id) + '" ' +
        'class="min-h-[44px] w-full rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm ' +
        'font-semibold text-violet-700 transition-colors hover:bg-violet-100 sm:w-auto">Set the cause</button>';
    }
    return '<div class="mt-2 rounded-lg border border-violet-200 bg-violet-50/60 p-2.5">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-violet-700">What is actually holding it?</p>' +
      '<div class="mt-2 flex flex-wrap gap-1.5">' +
        S.recoveryCauses.filter(function (c) { return c.id !== 'unclassified'; }).map(function (c) {
          return '<button data-rc-setcause="' + esc(c.id) + '" data-rc-forrow="' + esc(r.id) + '" ' +
            'class="min-h-[36px] rounded-full border border-slate-200 bg-white px-3 text-xs font-medium ' +
            'text-slate-700 hover:border-emerald-400 hover:bg-emerald-50">' + esc(c.label) + '</button>';
        }).join('') +
      '</div></div>';
  }

  // weighted by rupees, not by row count — one big stale invoice matters
  // more than three small fresh ones
  function rcAvgAge(rows) {
    var t = rcSum(rows);
    if (!t) return 0;
    return Math.round(rows.reduce(function (a, r) { return a + rcOldest(r) * r.outstanding; }, 0) / t);
  }

  /* ---- shared reductions ---- */
  function rcRouteStats(all) {
    return S.routes.map(function (name) {
      var rows = all.filter(function (r) { return r.route === name; });
      var amt = rcSum(rows);
      return {
        route: name, short: name.replace(' Route', ''), rows: rows, amount: amt,
        shops: rows.length, avgAge: rcAvgAge(rows),
        salesman: rows.length ? rows[0].salesman : '—'
      };
    }).filter(function (r) { return r.shops; });
  }

  /* ---- ④ the list ---- */

  /* ---- ① the header — the split, then one sentence (D16) ----
     The previous hero was a ₹32,400 counter. That number is already a KPI tile
     and the Finance module's headline; repeating it bought a screen of height
     and told the owner nothing they could act on. What only THIS report knows
     is how much of it we caused ourselves — so that is the headline now. */
  function rcSplit(all) {
    var by = function (o) { return all.filter(function (r) { return rcCauseOf(r.cause).owner === o; }); };
    var us = by('us'), them = by('them'), unknown = by('unknown');
    return { us: rcSum(us), them: rcSum(them), unknown: rcSum(unknown),
             usRows: us, themRows: them, unknownRows: unknown, total: rcSum(all) };
  }

  function rcHeader(all) {
    var sp = rcSplit(all);
    var prev = S.recoveryCauses.reduce(function (a, c) { return a + c.prevOutstanding; }, 0);
    var d = sp.total - prev;
    var usPct = rcPct(sp.us, sp.total);
    var themPct = rcPct(sp.them, sp.total);
    var unkPct = 100 - usPct - themPct;   // absorbs the rounding, so the bar always fills

    /* Each half is a button. Filtering to "we are the blocker" is the single
       most useful click on the tab, and it is also what teaches the split —
       the list then shows only failed deliveries and bad paperwork, so the
       category explains itself without a legend. */
    var half = function (o, key, amt, pct, rows) {
      var on = rcOwnerF === key;
      return '<button data-rc-owner="' + key + '" class="min-w-[9.5rem] flex-1 rounded-xl border p-2.5 text-left ' +
        'transition-colors ' + (on ? 'border-emerald-500 bg-emerald-50/40' : 'border-transparent hover:bg-slate-50') + '">' +
        '<span class="flex items-center gap-1.5">' +
          '<span class="h-2 w-2 shrink-0 rounded-full ' + o.dot + '"></span>' +
          '<span class="text-xs font-semibold uppercase tracking-wide text-slate-600">' + o.head + '</span></span>' +
        '<span class="mt-1 flex items-baseline gap-2">' +
          '<span class="text-2xl font-bold tabular-nums text-slate-900">' + money0(amt) + '</span>' +
          '<span class="text-xs text-slate-400">' + pct + '% · ' + rows + ' shops</span></span>' +
        '<span class="mt-1 block text-xs leading-snug text-slate-500">' + o.why + '</span>' +
        '<span class="mt-0.5 block text-xs font-medium leading-snug text-slate-600">' + o.todo + '</span>' +
      '</button>';
    };

    return '<section class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">' +
      // Total is context, not the headline, so on a phone it sits on its own
      // line above the split rather than fighting it for width three-up.
      '<div class="mb-2 flex items-baseline gap-2 sm:hidden">' +
        '<span class="text-xs uppercase tracking-wide text-slate-400">Outstanding</span>' +
        '<span class="text-sm font-semibold tabular-nums text-slate-700">' + money0(sp.total) + '</span>' +
        (d ? '<span class="rounded-full px-1.5 py-0.5 text-xs font-semibold ' +
          (d > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700') + '">' +
          (d > 0 ? '▲' : '▼') + money0(Math.abs(d)) + '</span>' : '') +
      '</div>' +
      '<div class="flex flex-wrap items-start gap-x-6 gap-y-3 sm:gap-x-8">' +
        half(RC_OWNER.us, 'us', sp.us, usPct, sp.usRows.length) +
        half(RC_OWNER.them, 'them', sp.them, themPct, sp.themRows.length) +
        (sp.unknown ? half(RC_OWNER.unknown, 'unknown', sp.unknown, unkPct, sp.unknownRows.length) : '') +
        '<div class="ml-auto hidden text-right sm:block">' +
          '<p class="text-xs uppercase tracking-wide text-slate-400">Outstanding</p>' +
          '<p class="mt-0.5 text-lg font-semibold tabular-nums text-slate-700">' + money0(sp.total) + '</p>' +
          (d ? '<span class="mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ' +
            (d > 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700') + '">' +
            (d > 0 ? '▲' : '▼') + money0(Math.abs(d)) + '</span>' : '') +
        '</div>' +
      '</div>' +
      // one proportional bar — the split, readable without reading the numbers
      '<div class="mt-3 flex h-1.5 overflow-hidden rounded-full bg-slate-100">' +
        '<div class="' + RC_OWNER.us.bar + '" style="width:' + usPct + '%"></div>' +
        '<div class="' + RC_OWNER.them.bar + '" style="width:' + themPct + '%"></div>' +
        '<div class="' + RC_OWNER.unknown.bar + '" style="width:' + unkPct + '%"></div>' +
      '</div>' +
    '</section>';
  }

  /* ---- ② filters — the breakdown IS the filter (D17) ----
     Cause and route used to be two read-only panels stacked above the list,
     re-stating the same 14 rows in a different shape and costing ~500px. They
     are chips now: same breakdown, one row each, and every one of them acts. */
  function rcChip(active, attr, val, label, amount, count, dot) {
    return '<button ' + attr + '="' + esc(val) + '" class="inline-flex min-h-[36px] items-center gap-1.5 ' +
      'shrink-0 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors ' +
      (active ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50') + '">' +
      (dot ? '<span class="h-1.5 w-1.5 shrink-0 rounded-full ' + dot + '"></span>' : '') +
      esc(label) +
      (amount != null ? '<span class="tabular-nums ' + (active ? 'text-emerald-700' : 'text-slate-400') + '">' +
        money0(amount) + '</span>' : '') +
      (count != null ? '<span class="' + (active ? 'text-emerald-600' : 'text-slate-300') + '">·&nbsp;' + count + '</span>' : '') +
    '</button>';
  }

  function rcFilters(all) {
    var causes = S.recoveryCauses.slice().filter(function (c) {
      return !rcOwnerF || c.owner === rcOwnerF;
    }).map(function (c) {
      var rows = all.filter(function (r) { return r.cause === c.id; });
      return { c: c, amt: rcSum(rows), n: rows.length };
    }).filter(function (x) { return x.n; }).sort(function (a, b) { return b.amt - a.amt; });

    // count the owner-filtered set, not everything — while one side of the
    // split is active, "all causes" means all causes ON THAT SIDE
    var inScope = rcOwnerF ? all.filter(function (r) { return rcCauseOf(r.cause).owner === rcOwnerF; }) : all;
    var causeChips = rcChip(!rcCause, 'data-rc-cause', '', 'All causes', null, inScope.length) +
      causes.map(function (x) {
        return rcChip(rcCause === x.c.id, 'data-rc-cause', x.c.id, x.c.label, x.amt, x.n,
                      RC_OWNER[x.c.owner].dot);
      }).join('');

    var routeChips = rcChip(rcRoute === 'all', 'data-rc-route', 'all', 'All routes', null, null) +
      rcRouteStats(inScope).sort(function (a, b) { return b.amount - a.amount; }).map(function (st) {
        return rcChip(rcRoute === st.route, 'data-rc-route', st.route,
                      st.short + ' · ' + st.salesman, st.amount, st.shops);
      }).join('');

    // On a phone these wrapped to nine stacked lines (~380px) — taller than the
    // panels they replaced. One scrolling row each keeps the whole breakdown
    // reachable in ~90px; they still wrap normally once there is width for it.
    var row = 'flex gap-1.5 overflow-x-auto rc-nobar [scrollbar-width:none] sm:flex-wrap sm:overflow-visible';
    return '<section class="space-y-2">' +
      '<div class="' + row + '">' + causeChips + '</div>' +
      '<div class="' + row + '">' + routeChips + '</div>' +
    '</section>';
  }

  /* ---- ③ order — by what can be acted on today (D18) ----
     Sorting by amount put a ₹7,450 shop on agreed credit terms above a ₹2,860
     one at 88 days that nobody has ever rung. The second is the winnable one.
     Three keys, each statable in a sentence, so the order is explainable:
       1. our own errors first  — fixable without the customer at all
       2. then never contacted  — untried, so effort still changes the outcome
       3. then oldest           — and amount only as a tie-break */
  var RC_OWNER_RANK = { us: 0, unknown: 1, them: 2 };
  function rcRank(r) {
    // unexplained ranks above "chase the customer": finding out is an internal
    // action you can start today, and nothing else can be decided until you do
    return [RC_OWNER_RANK[rcCauseOf(r.cause).owner], r.lastContact ? 1 : 0, -rcOldest(r), -r.outstanding];
  }
  function rcSort(rows) {
    return rows.slice().sort(function (a, b) {
      var x = rcRank(a), y = rcRank(b);
      for (var i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
      return 0;
    });
  }

  function rcInvoiceLines(r) {
    var rowsHtml = r.invoices.slice().sort(function (a, b) { return rcAge(b.date) - rcAge(a.date); })
      .map(function (i) {
        var age = rcAge(i.date), b = rcBucket(age);
        return { no: i.invoiceNo, date: fmtDate(i.date), age: age, tone: RC_BUCKET_TONE[b.id], amt: i.amount };
      });

    // phone: stacked rows. sm+: a real table.
    var stacked = '<ul class="space-y-2 ' + RC_BP.cards + '">' + rowsHtml.map(function (i) {
      return '<li class="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">' +
        '<span class="min-w-0"><span class="block truncate font-mono text-xs text-slate-700">' + esc(i.no) + '</span>' +
          '<span class="mt-0.5 block text-xs text-slate-400">' + i.date + ' · ' +
          '<span class="inline-flex items-center gap-1"><span class="inline-block h-1.5 w-1.5 rounded-sm ' + i.tone + '"></span>' +
          i.age + 'd</span></span></span>' +
        '<span class="shrink-0 text-sm font-semibold text-slate-900">' + money0(i.amt) + '</span></li>';
    }).join('') + '</ul>';

    var table = '<div class="overflow-hidden rounded-lg border border-slate-200 ' + RC_BP.table + '">' +
      '<table class="w-full text-xs"><thead><tr class="bg-slate-50 text-slate-500">' +
        '<th class="px-3 py-2 text-left font-semibold uppercase tracking-wide">Invoice</th>' +
        '<th class="px-3 py-2 text-left font-semibold uppercase tracking-wide">Raised</th>' +
        '<th class="px-3 py-2 text-right font-semibold uppercase tracking-wide">Age</th>' +
        '<th class="px-3 py-2 text-right font-semibold uppercase tracking-wide">Outstanding</th>' +
      '</tr></thead><tbody class="divide-y divide-slate-100">' + rowsHtml.map(function (i) {
        return '<tr class="bg-white"><td class="px-3 py-2 font-mono text-slate-700">' + esc(i.no) + '</td>' +
          '<td class="px-3 py-2 text-slate-600">' + i.date + '</td>' +
          '<td class="px-3 py-2 text-right"><span class="inline-flex items-center gap-1.5 font-medium text-slate-700">' +
            '<span class="h-2 w-2 rounded-sm ' + i.tone + '"></span>' + i.age + 'd</span></td>' +
          '<td class="px-3 py-2 text-right font-semibold text-slate-900">' + money0(i.amt) + '</td></tr>';
      }).join('') +
      '<tr class="bg-slate-50"><td class="px-3 py-2 font-semibold text-slate-600" colspan="3">Net receivable</td>' +
        '<td class="px-3 py-2 text-right font-bold text-slate-900">' + money0(r.outstanding) + '</td></tr>' +
      '</tbody></table></div>';

    return stacked + table;
  }

  /* Actions live in the expansion on every size. Single column below 380px,
     where two side-by-side buttons each wrap to three lines. */

  function rcWhyStuck(r) {
    return '<div class="rounded-lg bg-slate-50 p-3">' +
      '<p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Why it is stuck</p>' +
      '<p class="mt-1 text-sm leading-relaxed text-slate-700">' + esc(r.reason) + '</p>' +
      '<p class="mt-2 text-xs text-slate-500">Last contacted: ' +
        (r.lastContact ? fmtDate(r.lastContact) + ' (' + rcAge(r.lastContact) + 'd ago)'
                       : '<span class="font-semibold text-red-600">never</span>') + '</p></div>';
  }

  /* Where the card list gives way to the table. The Route / Salesman column
     needs about 100px more than `lg` leaves once the module's own 256px sidebar
     is on screen, so the cards hold until `xl`. */
  var RC_BP = { cards: 'xl:hidden', table: 'hidden xl:block', one: 'xl:grid-cols-1' };

  /* phone + tablet: the table rendered as cards. A sideways-scrolling table is a
     desktop table that has been apologised for (addendum-003 D17) — but a card
     list that lets its content flow freely loses the one thing a table is good
     at, which is that every row puts the same field in the same place so the eye
     can run down a column. So each card keeps fixed positions: name top-left,
     amount top-right, route/salesman under the name, age under the amount, cause
     along the bottom. Amounts are tabular-nums and right-aligned, and a header
     strip labels the two columns above the list.

     Collapsed, a card is data only — the same fields the desktop row carries,
     and nothing else. Actions and invoices come with the expansion, exactly as
     the desktop row expands. Fourteen rows each shouting a green button would
     scan far worse and would compete with "Do these three", which is where the
     acting is meant to happen. */
  function rcCards(rows, all) {
    if (!rows.length) return '<p class="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">' +
      'No shops match the current filters.</p>';

    // column headers, only where the list is a single column
    var head = '<div class="mb-2 flex items-baseline justify-between px-3.5 sm:hidden">' +
      '<span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Shop</span>' +
      '<span class="text-xs font-semibold uppercase tracking-wide text-slate-400">Owes · oldest</span></div>';

    var list = '<ul class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 ' + RC_BP.one + '">' + rows.map(function (r) {
      var c = rcCauseOf(r.cause), o = RC_OWNER[c.owner], age = rcOldest(r), b = rcBucket(age);
      var open = rcOpen.indexOf(r.id) !== -1;

      var row =
        '<button data-rc-row="' + esc(r.id) + '" aria-expanded="' + open + '" ' +
          'class="w-full px-3.5 py-3 text-left transition-colors active:bg-slate-50">' +
          '<span class="flex items-baseline justify-between gap-3">' +
            '<span class="min-w-0 truncate text-[15px] font-semibold leading-tight text-slate-900">' + esc(r.customer) + '</span>' +
            '<span class="shrink-0 text-[15px] font-bold tabular-nums leading-tight text-slate-900">' + money0(r.outstanding) + '</span>' +
          '</span>' +
          '<span class="mt-1 flex items-baseline justify-between gap-3">' +
            '<span class="min-w-0 truncate text-xs text-slate-500">' +
              esc(r.route.replace(' Route', '')) + ' · ' + esc(r.salesman) + ' · ' +
              r.invoices.length + ' invoice' + (r.invoices.length === 1 ? '' : 's') + '</span>' +
            '<span class="inline-flex shrink-0 items-center gap-1 text-xs font-medium tabular-nums ' +
              (age > 60 ? 'text-red-600' : 'text-slate-500') + '">' +
              '<span class="h-2 w-2 rounded-sm ' + RC_BUCKET_TONE[b.id] + '"></span>' + age + 'd</span>' +
          '</span>' +
          '<span class="mt-2 flex items-center justify-between gap-2">' +
            '<span class="inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ' +
              'font-medium ' + o.chip + '">' +
              '<span class="h-1.5 w-1.5 shrink-0 rounded-full ' + o.dot + '"></span>' +
              '<span class="truncate">' + esc(c.label) + '</span></span>' +
            '<span class="shrink-0 text-slate-400">' +
              ICON.feather(open ? 'FiChevronUp' : 'FiChevronDown', 'h-4 w-4') + '</span>' +
          '</span>' +
        '</button>';

      var detail = open
        ? '<div class="space-y-3 border-t border-slate-100 bg-slate-50/60 p-3.5">' +
            rcInvoiceLines(r) + rcWhyStuck(r) + rcCausePicker(r) + '</div>'
        : '';

      return '<li class="overflow-hidden rounded-xl border border-l-4 border-slate-200 ' +
        o.bar.replace('bg-', 'border-l-') + ' bg-white shadow-sm">' + row + detail + '</li>';
    }).join('') + '</ul>';

    return head + list;
  }

  function rcTableRows(rows, all) {
    /* One line per cell. The previous layout stacked name, cause chip and
       phone inside the Shop cell and route above last-contact inside another,
       which cost 97px a row while a third of the table's width sat empty.
       Cause and phone are columns now — the fields an owner reads across, read
       across. Shop is the only elastic column (w-full); every other header is
       w-px + nowrap, which is the shrink-to-content idiom, so nothing overflows
       whatever the sidebar leaves. */
    var TH = 'border-b border-slate-200 px-3 py-2.5 text-left text-xs font-semibold uppercase ' +
             'tracking-wide text-slate-500 whitespace-nowrap';
    var cols = [
      { label: 'Shop', cls: 'w-full' },
      { label: 'Phone' },
      { label: 'Cause' },
      { label: 'Owes / inv', align: 'text-right' },
      { label: 'Oldest', align: 'text-right' },
      { label: 'Route · Salesman' },
      { label: 'Last contact', align: 'text-right' }
    ];
    var span = cols.length;

    var head = '<thead><tr class="bg-slate-50">' + cols.map(function (c) {
      return '<th class="' + TH + ' ' + (c.cls || 'w-px') + ' ' + (c.align || '') + '">' + c.label + '</th>';
    }).join('') + '</tr></thead>';

    var body = '<tbody>' + (rows.length ? rows.map(function (r) {
      var c = rcCauseOf(r.cause), o = RC_OWNER[c.owner], age = rcOldest(r), b = rcBucket(age);
      var open = rcOpen.indexOf(r.id) !== -1;
      var TD = 'px-3 py-2.5 align-middle';
      var since = r.lastContact ? rcAge(r.lastContact) + 'd' : 'never';
      return '<tr data-rc-row="' + esc(r.id) + '" class="cursor-pointer border-b border-slate-100 border-l-2 ' +
          o.bar.replace('bg-', 'border-l-') + ' transition-colors ' +
          (open ? 'bg-slate-50' : 'hover:bg-slate-50/60') + '">' +

        '<td class="' + TD + '"><div class="flex items-center gap-1.5">' +
          '<span class="shrink-0 text-slate-400">' +
            ICON.feather(open ? 'FiChevronUp' : 'FiChevronDown', 'h-4 w-4') + '</span>' +
          '<span class="truncate font-medium text-slate-800">' + esc(r.customer) + '</span>' +
        '</div></td>' +

        '<td class="' + TD + ' whitespace-nowrap text-sm tabular-nums text-slate-500">' + esc(r.phone) + '</td>' +

        '<td class="' + TD + ' whitespace-nowrap"><span class="inline-flex items-center gap-1.5 rounded-full ' +
          'border px-2 py-0.5 text-xs font-medium ' + o.chip + '">' +
          '<span class="h-1.5 w-1.5 shrink-0 rounded-full ' + o.dot + '"></span>' + esc(c.label) + '</span></td>' +

        '<td class="' + TD + ' whitespace-nowrap text-right"><span class="text-sm font-semibold ' +
          'tabular-nums text-slate-900">' + money0(r.outstanding) + '</span>' +
          (r.invoices.length > 1 ? '<span class="ml-1 text-xs text-slate-400">/' + r.invoices.length + '</span>' : '') +
        '</td>' +

        '<td class="' + TD + ' whitespace-nowrap text-right"><span class="inline-flex items-center gap-1.5 ' +
          'text-sm font-medium ' + (age > 60 ? 'text-red-600' : 'text-slate-700') + '">' +
          '<span class="h-2 w-2 rounded-sm ' + RC_BUCKET_TONE[b.id] + '"></span>' + age + 'd</span></td>' +

        '<td class="' + TD + ' whitespace-nowrap text-sm text-slate-600">' +
          esc(r.route.replace(' Route', '')) + ' · <span class="text-slate-400">' + esc(r.salesman) + '</span></td>' +

        '<td class="' + TD + ' whitespace-nowrap text-right text-sm ' +
          (r.lastContact ? 'text-slate-500' : 'font-semibold text-red-600') + '">' + since + '</td>' +

        '</tr>' +
        (open ? '<tr class="bg-slate-50/70"><td colspan="' + span + '" class="px-4 py-5 lg:px-6">' +
          '<div class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">' +
            '<div>' + rcInvoiceLines(r) + '</div>' +
            '<div class="space-y-3">' + rcWhyStuck(r) + rcCausePicker(r) + '</div>' +
          '</div></td></tr>' : '');
    }).join('')
      : '<tr><td colspan="' + span + '" class="px-6 py-12 text-center text-sm text-slate-400">' +
        'No shops match the current filters.</td></tr>') + '</tbody>';

    return head + body;
  }

  function outstandingRecovery() {
    var all = S.recoveryOutstanding;
    var q = (window.__rcSearch || '').trim().toLowerCase();

    var rows = all.filter(function (r) {
      if (rcOwnerF && rcCauseOf(r.cause).owner !== rcOwnerF) return false;
      if (rcCause && r.cause !== rcCause) return false;
      if (rcRoute !== 'all' && r.route !== rcRoute) return false;
      if (rcCustomer && r.id !== rcCustomer) return false;
      if (q && (r.customer + ' ' + r.phone + ' ' + r.salesman).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    rows = rcSort(rows);

    var chips = [];
    if (rcOwnerF) chips.push({ label: RC_OWNER[rcOwnerF].head, clear: 'owner' });
    if (rcCause) chips.push({ label: rcCauseOf(rcCause).label, clear: 'cause' });
    if (rcRoute !== 'all') chips.push({ label: rcRoute, clear: 'route' });
    if (rcCustomer) chips.push({
      label: (all.filter(function (r) { return r.id === rcCustomer; })[0] || {}).customer, clear: 'customer' });

    var chipRow = chips.length
      ? '<div class="flex flex-wrap items-center gap-2">' + chips.map(function (a) {
          return '<button data-rc-clear="' + a.clear + '" class="inline-flex min-h-[36px] items-center gap-1.5 rounded-full ' +
            'border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 hover:bg-emerald-100">' +
            esc(a.label) + ICON.feather('FiX', 'h-3.5 w-3.5') + '</button>';
        }).join('') +
        '<button data-rc-clear="all" class="min-h-[36px] px-1 text-xs text-slate-400 underline hover:text-slate-600">Clear all</button></div>'
      : '';

    var search = '<div class="relative w-full sm:w-64">' +
      '<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">' +
        ICON.feather('FiSearch', 'h-4 w-4') + '</span>' +
      '<input id="rc-search" value="' + esc(window.__rcSearch || '') + '" placeholder="Search shop or salesman…" ' +
        'class="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 ' +
        'placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"></div>';

    var listHead =
      '<div class="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">' +
        '<div><h3 class="text-base font-semibold text-slate-800">' +
          'Who to recover it from</h3>' +
          '<p class="mt-0.5 text-xs text-slate-500">' + rows.length + ' of ' + all.length + ' shops · ' +
            money0(rcSum(rows)) + ' · ours first, then never-contacted, then oldest</p></div>' +
        search +
      '</div>' + (chipRow ? '<div class="px-4 pt-3 sm:px-6">' + chipRow + '</div>' : '');

    // No pagination on either breakpoint. This is a 14-row worklist, not a
    // dataset: paging it hid a third of the debtors behind a control and cost a
    // second scroll to reach them. The shared pagination() chrome stays untouched
    // for the five tabs that genuinely page.

    return '<div class="space-y-3 pb-4">' +
      rcHeader(all) +
      rcFilters(all) +
      '<section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">' +
        listHead +
        '<div class="p-4 ' + RC_BP.cards + '">' + rcCards(rows, all) + '</div>' +
        '<div class="overflow-x-auto ' + RC_BP.table + '"><table class="w-full border-separate border-spacing-0 text-sm">' +
          rcTableRows(rows, all) + '</table></div>' +
      '</section>' +
    '</div>';
  }

  /* ================= events ================= */

  el('tab-list').addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) setTab(b.dataset.tab);
  });

  // static filters that live in dashboard.html (never re-rendered)
  el('ps-period').addEventListener('change', renderPanel);
  el('ps-sort').addEventListener('change', renderPanel);
  el('ro-status').addEventListener('change', function () { page.recent_orders = 1; renderPanel(); });
  el('ro-reminders').addEventListener('click', function () {
    window.REMINDERS.open();          // components/modal/OrderReminderModal.jsx
  });

  var host = el('panel-host');

  host.addEventListener('click', function (e) {
    var t;

    if ((t = e.target.closest('[data-metatab]'))) {
      metaTab[t.dataset.metaorder] = t.dataset.metatab; renderPanel(); return;
    }
    if (e.target.closest('a[href]')) return;          // action links navigate

    /* ---- Outstanding Recovery ----
       Actions are tested first: they sit inside cause cards and inside
       clickable table rows, so otherwise the click would also toggle the
       filter or expand the row underneath them. */
    if ((t = e.target.closest('[data-rc-setcause]'))) { rcSetCause(t.dataset.rcForrow, t.dataset.rcSetcause); return; }
    if ((t = e.target.closest('[data-rc-act="classify"]'))) {
      rcClassifying = rcClassifying === t.dataset.rcFor ? null : t.dataset.rcFor;
      renderPanel(); return;
    }
    if ((t = e.target.closest('[data-rc-owner]'))) {
      rcOwnerF = rcOwnerF === t.dataset.rcOwner ? null : t.dataset.rcOwner;
      rcCause = null;   // a cause lives inside one side of the split; keeping it would contradict
      renderPanel(); return;
    }
    if ((t = e.target.closest('[data-rc-cause]'))) {
      // '' is the "All causes" chip
      rcCause = !t.dataset.rcCause || rcCause === t.dataset.rcCause ? null : t.dataset.rcCause;
      page.outstanding_recovery = 1; renderPanel(); return;
    }
    if ((t = e.target.closest('[data-rc-customer]'))) {
      rcCustomer = rcCustomer === t.dataset.rcCustomer ? null : t.dataset.rcCustomer;
      page.outstanding_recovery = 1; renderPanel(); return;
    }
    if ((t = e.target.closest('[data-rc-route]'))) {
      rcRoute = rcRoute === t.dataset.rcRoute ? 'all' : t.dataset.rcRoute;
      page.outstanding_recovery = 1; renderPanel(); return;
    }
    if ((t = e.target.closest('[data-rc-clear]'))) {
      var which = t.dataset.rcClear;
      if (which === 'owner' || which === 'all') rcOwnerF = null;
      if (which === 'cause' || which === 'all') rcCause = null;
      if (which === 'route' || which === 'all') rcRoute = 'all';
      if (which === 'customer' || which === 'all') rcCustomer = null;
      page.outstanding_recovery = 1; renderPanel(); return;
    }
    if ((t = e.target.closest('[data-rc-row]'))) {
      var rid = t.dataset.rcRow, at = rcOpen.indexOf(rid);
      if (at === -1) rcOpen.push(rid); else rcOpen.splice(at, 1);
      renderPanel(); return;
    }

    if ((t = e.target.closest('[data-expand]')) || (t = e.target.closest('[data-mexpand]'))) {
      var oid = t.dataset.expand || t.dataset.mexpand;
      var at = expanded.indexOf(oid);
      if (at === -1) expanded.push(oid); else expanded.splice(at, 1);
      renderPanel(); return;
    }
    if ((t = e.target.closest('[data-invoice]'))) { if (!t.disabled) openInvoiceMenu(t); return; }
    if ((t = e.target.closest('[data-copy]'))) {
      var svg = t.innerHTML; t.textContent = '\u2713';
      setTimeout(function () { t.innerHTML = svg; }, 900); return;
    }
    if ((t = e.target.closest('[data-page]'))) {
      if (t.disabled) return;
      var pg = Number(t.dataset.page);
      if (pg >= 1) { page[active] = pg; renderPanel(); }
      return;
    }

    /* ---- date-range calendars (Discount Report + Salesman Route Report) ---- */
    if ((t = e.target.closest('[data-sr-cal-clear]'))) {
      srRange = { from: null, to: null }; srCal = false; page.salesman_route_report = 1; renderPanel(); return;
    }
    if ((t = e.target.closest('[data-cal-clear]'))) {
      if (t.dataset.calFor === 'sr') { srRange = { from: null, to: null }; srCal = false; page.salesman_route_report = 1; }
      else { dcRange = { from: null, to: null }; dcCal = false; page.discount_report = 1; }
      renderPanel(); return;
    }
    if ((t = e.target.closest('[data-cal-nav]'))) {
      var sr = t.dataset.calFor === 'sr';
      var asOf = new Date(S.tenant.asOf);
      var base = (sr ? srMonth : dcMonth) || new Date(asOf.getFullYear(), asOf.getMonth(), 1);
      var moved = new Date(base.getFullYear(), base.getMonth() + Number(t.dataset.calNav), 1);
      if (sr) srMonth = moved; else dcMonth = moved;
      renderPanel(); return;
    }
    if ((t = e.target.closest('[data-day]'))) {
      var d = t.dataset.day, isSr = t.dataset.calFor === 'sr';
      var rng = isSr ? srRange : dcRange;
      if (!rng.from || rng.to) rng = { from: d, to: null };                  // start a new range
      else if (d < rng.from) rng = { from: d, to: rng.from };
      else { rng = { from: rng.from, to: d }; if (isSr) srCal = false; else dcCal = false; }
      if (isSr) { srRange = rng; page.salesman_route_report = 1; }
      else { dcRange = rng; page.discount_report = 1; }
      renderPanel(); return;
    }
    if (e.target.id === 'dc-range') { dcCal = !dcCal; srCal = false; renderPanel(); return; }
    if (e.target.id === 'sr-range') { srCal = !srCal; dcCal = false; renderPanel(); return; }
    if ((dcCal || srCal) && !e.target.closest('[data-cal]')) { dcCal = false; srCal = false; renderPanel(); return; }

    /* ---- Discount Report ---- */
    if ((t = e.target.closest('[data-dc-mode]'))) {
      dcMode = t.dataset.dcMode; window.__dcSearch = ''; dcOpen = [];
      page.discount_report = 1; renderPanel(); return;
    }
    if ((t = e.target.closest('[data-dc-row]'))) {
      var rid = t.dataset.dcRow, ix = dcOpen.indexOf(rid);
      if (ix === -1) dcOpen.push(rid); else dcOpen.splice(ix, 1);
      renderPanel(); return;
    }

    /* ---- Order Cycle ---- */
    if ((t = e.target.closest('[data-cycle-clear]'))) { cycleFilter = null; renderPanel(); return; }
    if ((t = e.target.closest('[data-cycle]'))) {
      cycleFilter = cycleFilter === t.dataset.cycle ? null : t.dataset.cycle;
      page.customer_order_pattern = 1; renderPanel(); return;
    }
    if (e.target.closest('#oc-refresh')) { renderPanel(); }
  });

  // searches re-render, so put the caret back where it was
  host.addEventListener('input', function (e) {
    var id = e.target.id, keep;
    if (id === 'dc-search') { window.__dcSearch = e.target.value; page.discount_report = 1; keep = id; }
    else if (id === 'oc-search') { window.__ocSearch = e.target.value; keep = id; }
    else if (id === 'sr-search') { window.__srSearch = e.target.value; page.salesman_route_report = 1; keep = id; }
    else if (id === 'rc-search') { window.__rcSearch = e.target.value; page.outstanding_recovery = 1; keep = id; }
    else return;
    renderPanel();
    var again = document.getElementById(keep);
    if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  });

  // the cause cards are role="button" — Enter/Space must select them too
  host.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var c = e.target.closest('[data-rc-cause]');
    if (!c || e.target !== c) return;
    e.preventDefault();
    rcCause = rcCause === c.dataset.rcCause ? null : c.dataset.rcCause;
    page.outstanding_recovery = 1; renderPanel();
  });

  host.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'dc-filter') { window.__dcFilter = e.target.value; page.discount_report = 1; renderPanel(); return; }
    if (id === 'dc-template') { window.__dcTemplate = e.target.value; page.discount_report = 1; renderPanel(); return; }
    if (id === 'oc-window') { window.__ocWindow = e.target.value; renderPanel(); return; }
    if (id === 'sr-route') { window.__srRoute = e.target.value; page.salesman_route_report = 1; renderPanel(); return; }
    if (id === 'sr-staff') { window.__srStaff = e.target.value; page.salesman_route_report = 1; renderPanel(); return; }
    if (id === 'rc-route') { rcRoute = e.target.value; page.outstanding_recovery = 1; renderPanel(); return; }
    // the dashboard's status select is disabled (isOrderEditable={false}),
    // so there is no status-change handler here — see addendum-003 C11.
  });

  /* ================= popovers — portalled to <body>, as the app does ================= */

  var layer = document.createElement('div');
  document.body.appendChild(layer);

  function closeLayer() { layer.innerHTML = ''; }

  function place(node, anchor, width) {
    var r = anchor.getBoundingClientRect();
    var top = r.bottom + 8, left = r.left;
    if (left + width > window.innerWidth - 16) left = window.innerWidth - width - 16;
    left = Math.max(16, left);
    if (top + node.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - node.offsetHeight - 8);
    node.style.top = top + 'px';
    node.style.left = left + 'px';
  }

  function openInvoiceMenu(btn) {
    if (layer.dataset.kind === 'invoice' && layer.dataset.id === btn.dataset.invoice) { closeLayer(); return; }
    layer.dataset.kind = 'invoice';
    layer.dataset.id = btn.dataset.invoice;
    layer.innerHTML = '<div style="position:fixed;z-index:9999" data-pop>' + invoiceMenu() + '</div>';
    place(layer.firstChild, btn, 180);
  }

  var insightTimer = null;
  function openInsights(wrap) {
    var o = orderById(wrap.dataset.insight);
    layer.dataset.kind = 'insight';
    layer.dataset.id = wrap.dataset.insight;
    layer.innerHTML = '<div style="position:fixed;width:320px;max-width:calc(100vw - 32px);z-index:9999" ' +
      'class="pointer-events-auto" data-pop>' + insightsCard(o) + '</div>';
    place(layer.firstChild, wrap, 320);
  }

  // hover in/out with the app's 150ms grace so the card can be moved onto
  host.addEventListener('mouseover', function (e) {
    var w = e.target.closest('[data-insight]');
    if (!w) return;
    if (insightTimer) { clearTimeout(insightTimer); insightTimer = null; }
    openInsights(w);
  });
  host.addEventListener('mouseout', function (e) {
    if (!e.target.closest('[data-insight]')) return;
    insightTimer = setTimeout(function () {
      if (layer.dataset.kind === 'insight') closeLayer();
    }, 150);
  });
  layer.addEventListener('mouseenter', function () {
    if (insightTimer) { clearTimeout(insightTimer); insightTimer = null; }
  });
  layer.addEventListener('mouseleave', function () {
    if (layer.dataset.kind === 'insight') closeLayer();
  });
  layer.addEventListener('click', function (e) {
    var pr = e.target.closest('[data-print]');
    if (!pr) return;
    var o = orderById(layer.dataset.id);
    closeLayer();
    if (pr.dataset.print === 'A4') window.INVOICE.a4(o);
    else window.INVOICE.thermal(o);
  });
  document.addEventListener('click', function (e) {
    if (layer.dataset.kind === 'invoice' && !e.target.closest('[data-invoice]') && !e.target.closest('[data-pop]')) closeLayer();
  });
  window.addEventListener('scroll', closeLayer, true);

  /* ================= boot ================= */

  renderNav();
  initDrawer();
  renderKpis();
  renderTabs();
  renderPanel();
})();

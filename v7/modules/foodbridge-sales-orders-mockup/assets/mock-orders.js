/*
  DISCOVERY MOCK — Sales Orders (live route: /orders).

  Hand-port of the live storefront-frontend orders list:
    src/pages/Orders.jsx                          → renderPage() (TabOrders branch only)
    src/components/order/OrderTable.jsx           → renderRows() + desktop row cells
    src/components/order/MobileOrderCard.jsx      → renderMobileCard()
    src/components/order/SelectOrderByStatus.jsx  → renderStatusSelect()
    src/components/common/CustomPagination.jsx    → renderPagination()
    src/components/preloader/TableLoading.jsx     → renderTableLoading()
    src/components/table/NotFound.jsx             → renderNotFound()
    src/utils/orders.js                           → status-workflow helpers

  Every Tailwind class string is copied verbatim from the source JSX so the
  rendered DOM carries the same classes the live app does. The table shell is
  Windmill (resolved against the app's own myTheme.js override, see WM); the
  row internals are hand-rolled slate/emerald Tailwind.

  SCOPE — Phase 1 is the orders LIST only. Deliberately not ported:
    • CreateOrderDrawer (4,832 lines), BulkOrderDrawer, OrderForecastDrawer,
      DemandReportDrawer, OrderEditDrawer, SubOrderDrawer, OrderCartModal,
      OrderFulfillmentMetadata — each its own phase.
    • The Google Sheet subsystem (toolbar, export/sync, embedded view) —
      dropped by decision; see addendum divergence D9.
    • The Batch Management / Production / Reports tabs, which are unreachable
      in the live app: OrderTabView is the only caller of setActiveTab and it
      is commented out, so activeTab is permanently "TabOrders". See D4.

  Data comes from seed-data/seed.json — nothing here talks to a real API.
*/
(function () {
  "use strict";

  const { esc, toTitleCaseFun } = window.MockShell.helpers;
  const icon = (name, cls, size, style) => window.MockIcons.get(name, cls, size, style);

  /* ── myTheme.js resolved ──────────────────────────────────────────────── */
  const WM = {
    card: "min-w-0 rounded-lg overflow-hidden bg-white dark:bg-gray-800",
    cardBody: "p-4",
    input:
      "block w-full h-10 border border-gray-200 bg-white px-3 py-1 text-sm focus:outline-none dark:text-gray-300 leading-5 rounded-md bg-gray-100 focus:bg-white dark:focus:bg-gray-700 focus:border-gray-200 border-gray-200 dark:border-gray-600 dark:focus:border-gray-500 dark:bg-gray-700",
    buttonPrimary:
      "align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-4 py-2 rounded-md text-sm text-white bg-green-600 border border-transparent active:bg-green-700 hover:bg-green-700",
    tableContainer:
      "w-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg",
    tableHeader:
      "text-sm font-medium tracking-wide text-left text-zinc-500 uppercase border-b border-gray-200 dark:border-gray-700 bg-white dark:text-gray-400 dark:bg-gray-800",
    tableBody:
      "bg-white divide-y divide-gray-100 dark:divide-gray-700 dark:bg-gray-800 text-gray-800 dark:text-gray-400",
    tableCell: "px-4 py-2",
    tableFooter:
      "px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white text-gray-500 dark:text-gray-400 dark:bg-gray-800",
  };

  const PAGE_SIZE = 20; // SidebarContext.resultsPerPage

  /* ── State ────────────────────────────────────────────────────────────── */
  const state = {
    seed: null,
    label: "Sales Orders",
    currency: "₹",
    orders: [],
    loading: false,
    search: "",
    searchInput: "",
    status: "",
    startDate: null,
    endDate: null,
    page: 1,
    expanded: [],
    copied: "",
    fmTab: {},
    reminderOpen: false, reminderSearch: "", reminderSince: "Today", reminderCatalogue: "All Catalogues",
    deliveryOpen: false, deliverySelected: [],
    createOrderOpen: false,
    invoiceMenuFor: null,
    invoiceMenuPos: { top: 0, left: 0 },
    statusOpen: false,
    dateOpen: false,
    exporting: false,

    // Action bar / Google Sheets / mobile footer
    bulkMenuOpen: false,
    mobileCreateMenuOpen: false,

    // Row-level
    insightFor: null,
    insightPos: { top: 0, left: 0 },
  };

  let outlet = null;
  let searchTimer = null;

  /* ── Date helpers ─────────────────────────────────────────────────────── */
  const todayStart = () => new Date(new Date().setHours(0, 0, 0, 0));
  const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

  const fmtDate = (v) =>
    new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const fmtDate2 = (v) =>
    new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const fmtTime = (v) =>
    new Date(v).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const fmtPickerDate = (d) =>
    d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, " ") : "";
  const toInputVal = (d) =>
    d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
  const fromInputVal = (s) => {
    if (!s) return null;
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  };

  // Order date offsets are resolved to real dates here; see seed `_dateComment`.
  // The invoice number is rebuilt to the live shape: the order date with no
  // zero padding (2026-8-11 -> "2026811") followed by a time-derived counter,
  // giving the 13-14 digit numeric ids the reference screenshot shows.
  function materialiseOrders(seed) {
    return (seed.orders || []).map((o) => {
      const d = new Date(Date.now() - o.createdMinutesAgo * 60000);
      d.setSeconds(0, 0);
      const datePart = `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}`;
      return Object.assign({}, o, {
        createdAt: d.toISOString(),
        invoice: datePart + o.invoiceSuffix,
        createdDaysAgo: Math.floor(o.createdMinutesAgo / 1440),
      });
    });
  }

  /* ── src/utils/orders.js ──────────────────────────────────────────────── */
  const statusWorkflow = () => (state.seed && state.seed.statusWorkflow) || [];

  // Filter dropdown options — every distinct status in the workflow.
  const allStatuses = () =>
    Array.from(new Set(statusWorkflow().map((w) => w.status)));

  // Per-row select options — the current status plus whatever it can move to.
  // A terminal status yields a single option, which renders disabled.
  function statusOptionsFor(status) {
    const wf = statusWorkflow().find((w) => w.status === status);
    return Array.from(new Set([status].concat((wf && wf.nextStatuses) || [])));
  }

  /* ── Money ────────────────────────────────────────────────────────────── */
  const getNumberTwo = (n) =>
    Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const getNumber = (n) =>
    Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

  // OrderTable.calculateOrderPayableTotal — cart line totals less discount.
  function orderTotal(order) {
    if (Array.isArray(order.cart) && order.cart.length > 0) {
      const sum = order.cart.reduce((t, i) => t + (Number(i.itemTotal) || 0), 0);
      return Math.max(0, sum - (Number(order.discount) || 0));
    }
    if (order.total > 0) return order.total;
    if (order.subTotal > 0) return order.subTotal;
    return 0;
  }

  /* ── MobileOrderCard.jsx — status chip colours ────────────────────────── */
  function getStatusClasses(status) {
    const n = String(status || "").toLowerCase();
    if (n.includes("deliver") || n.includes("complete"))
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/10";
    if (n.includes("cancel") || n.includes("reject"))
      return "bg-rose-50 text-rose-700 ring-rose-600/10";
    if (n.includes("progress") || n.includes("transit"))
      return "bg-blue-50 text-blue-700 ring-blue-600/10";
    if (n.includes("pending") || n.includes("process"))
      return "bg-amber-50 text-amber-700 ring-amber-600/10";
    return "bg-slate-100 text-slate-700 ring-slate-600/10";
  }

  /* ── Filtering (server-side live; same contract reproduced here) ──────── */
  function filteredOrders() {
    let list = state.orders;
    if (state.status) list = list.filter((o) => o.status === state.status);
    if (state.startDate || state.endDate) {
      const from = state.startDate;
      const to = state.endDate ? new Date(state.endDate.getTime() + 86399999) : null;
      list = list.filter((o) => {
        const d = new Date(o.createdAt);
        return (!from || d >= from) && (!to || d <= to);
      });
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter(
        (o) =>
          String(o.invoice || "").toLowerCase().includes(q) ||
          String((o.user_info && o.user_info.name) || "").toLowerCase().includes(q) ||
          String((o.user_info && o.user_info.contact) || "").includes(q)
      );
    }
    return list;
  }

  function customerFor(order) {
    const loc = order.buyer_location_id && (state.seed.locations || {})[order.buyer_location_id];
    return {
      name: toTitleCaseFun(loc ? loc.name : (order.user_info || {}).name),
      contact: toTitleCaseFun(loc ? loc.contact : (order.user_info || {}).contact),
    };
  }

  /* ── globalSetting.appProp.orderManagementFeatures ────────────────────── */
  const features = () => (state.seed.appProp && state.seed.appProp.orderManagementFeatures) || {};

  /* ── OrderTable.generateOrderInsights (rule subset) ───────────────────────
     Live this derives everything from the dispatch/delivery/return records.
     Those record sets are a later phase, so the seed carries the derived
     figures and the rules below run against them unchanged — same order, same
     thresholds, same copy, same slice(0, 3) cap. */
  function generateOrderInsights(order) {
    const insights = [];
    const cur = state.currency;
    const f = order.fulfillment || { dispatches: 0, deliveries: 0, returns: 0 };
    const age = order.createdDaysAgo;
    const value = orderTotal(order);
    const itemCount = (order.cart || []).length;
    const qty = order.totalQty || 0;
    const push = (severity, title, message, action) =>
      insights.push({ severity, title, message, action });

    if (String(order.status).toLowerCase() === "cancelled") {
      push("info", "Order Cancelled",
        `Cancelled ${age}d ago. ${cur}${value.toFixed(0)} order archived.`, null);
      return insights.slice(0, 3);
    }
    if (value >= 5000 && f.dispatches === 0 && age >= 2) {
      push("critical", "🔥 High-Value Order at Risk",
        `${cur}${value.toFixed(0)} order delayed ${age}d. No dispatch created. Customer escalation risk.`,
        "Prioritize & dispatch now");
    }
    if ((order.returnRate || 0) >= 30 && f.returns > 0) {
      push("critical", "⚠️ High Return Rate Alert",
        `${order.returnRate}% items returned. Quality or accuracy issue suspected.`,
        "Investigate root cause");
    }
    if ((order.dispatchRejected || 0) >= 2) {
      push("critical", "❌ Multiple Dispatch Failures",
        `${order.dispatchRejected} dispatches rejected. Fulfillment process breakdown.`,
        "Review & create new dispatch");
    }
    if ((order.returnsPending || 0) > 0) {
      push("high", "Return Pickup Required",
        `${order.returnsPending} return${order.returnsPending > 1 ? "s" : ""} awaiting collection.`,
        "Schedule pickup");
    }
    if (f.dispatches === 0) {
      if (age >= 3) {
        push("high", "Fulfillment Critically Delayed",
          `${age}d old, ${itemCount} item${itemCount > 1 ? "s" : ""}, ${qty} units. Zero progress.`,
          "Create dispatch urgently");
      } else if (age >= 1) {
        push("medium", "Dispatch Allocation Pending",
          `${age}d since order. ${itemCount} product${itemCount > 1 ? "s" : ""} (${qty} units) awaiting dispatch.`,
          "Allocate inventory");
      } else {
        push("normal", "🆕 Fresh Order Ready",
          `${itemCount} item${itemCount > 1 ? "s" : ""}, ${qty} units, ${cur}${value.toFixed(0)}. Ready for processing.`,
          "Create dispatch");
      }
      return insights.slice(0, 3);
    }
    const pct = order.fulfilledPct || 0;
    if (pct > 0 && pct < 100) {
      const dispatched = Math.round((qty * pct) / 100);
      push("medium", "Partial Fulfillment",
        `${pct}% dispatched (${dispatched}/${qty} units). ${qty - dispatched} units pending.`,
        "Complete remaining dispatch");
    }
    if ((order.dispatchRejected || 0) === 1) {
      push("high", "Dispatch Rejected",
        `1 dispatch rejected. ${f.returns > 0 ? "Return initiated." : "Create return for rejected items."}`,
        f.returns === 0 ? "Create return" : "Monitor return");
    }
    if ((order.returnsInTransit || 0) > 0) {
      push("warning", "Returns In Transit",
        `${order.returnsInTransit} return${order.returnsInTransit > 1 ? "s" : ""} being returned.`,
        "Track & verify receipt");
    }
    if ((order.unassignedDispatches || 0) > 0) {
      push("medium", "Delivery Assignment Needed",
        `${order.unassignedDispatches} of ${f.dispatches} dispatch${order.unassignedDispatches > 1 ? "es" : ""} not linked to delivery run.`,
        "Create or assign to delivery");
    }
    // ── Normal / success tail ──────────────────────────────────────────────
    if (f.deliveries > 0 && String(order.status).toUpperCase() !== "DELIVERED") {
      push("normal", "🚚 Delivery In Progress",
        `${f.deliveries} active run${f.deliveries > 1 ? "s" : ""} (${pct}% avg progress). ${Math.min(f.deliveries, f.dispatches)}/${f.dispatches} dispatches delivered.`,
        "Monitor delivery");
    }
    if (f.dispatches > 0 && f.deliveries === 0) {
      push("normal", "Dispatches Ready for Delivery",
        `${f.dispatches} dispatch${f.dispatches > 1 ? "es are" : " is"} packed and ready. No delivery run created.`,
        "Create delivery run");
    }
    if (f.returns > 0 && (order.returnsPending || 0) === 0 && (order.returnsInTransit || 0) === 0) {
      push("info", "Returns Received",
        `${f.returns} return${f.returns > 1 ? "s" : ""} received.`,
        "Process refund/exchange");
    }
    if (String(order.status).toUpperCase() === "DELIVERED" && pct >= 100 && f.returns === 0) {
      push("success", "✅ Order Fulfilled",
        `${qty} units delivered across ${f.deliveries} run${f.deliveries > 1 ? "s" : ""}. ${cur}${value.toFixed(0)} completed.`,
        null);
    }
    return insights.slice(0, 3);
  }

  const INSIGHT_STYLES = {
    critical: "bg-red-50 border-l-red-500",
    high: "bg-amber-50 border-l-amber-500",
    warning: "bg-orange-50 border-l-orange-500",
    medium: "bg-yellow-50 border-l-yellow-500",
    success: "bg-emerald-50 border-l-emerald-500",
  };
  const INSIGHT_TITLE = {
    critical: "text-red-900", high: "text-amber-900", warning: "text-orange-900",
    medium: "text-yellow-900", success: "text-emerald-900",
  };

  function renderInsightCard() {
    if (!state.insightFor) return "";
    const order = state.orders.find((o) => o._id === state.insightFor);
    if (!order) return "";
    const insights = generateOrderInsights(order);
    const body =
      insights.length === 0
        ? `<div class="py-8 px-4 text-center">${icon("zap", "w-6 h-6 text-slate-300 mx-auto mb-2")}<p class="text-xs text-slate-500">Analyzing order data...</p></div>`
        : insights
            .map(
              (ins) => `<div class="p-3 rounded border-l-4 transition-all duration-200 overflow-hidden ${
                INSIGHT_STYLES[ins.severity] || "bg-slate-50 border-l-slate-400"
              }">
                <div class="flex items-start justify-between gap-2">
                  <span class="text-xs font-bold ${INSIGHT_TITLE[ins.severity] || "text-slate-900"}">${esc(ins.title)}</span>
                  ${ins.severity === "critical" ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white whitespace-nowrap flex-shrink-0">URGENT</span>` : ""}
                  ${ins.severity === "high" ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-600 text-white whitespace-nowrap flex-shrink-0">HIGH</span>` : ""}
                </div>
                <p class="mt-1 text-[11px] leading-snug text-slate-600">${esc(ins.message)}</p>
                ${ins.action ? `<p class="mt-1.5 text-[11px] font-semibold text-slate-700">→ ${esc(ins.action)}</p>` : ""}
              </div>`
            )
            .join("");
    return `
      <div data-insightcard style="position:fixed;top:${state.insightPos.top}px;left:${state.insightPos.left}px;width:320px;max-width:calc(100vw - 32px);z-index:9999" class="pointer-events-auto">
        <div class="bg-white rounded-lg shadow-2xl border-2 border-purple-200 overflow-hidden transition-all duration-150">
          <div class="bg-gradient-to-r from-purple-600 to-blue-600 px-3 py-2.5">
            <div class="flex items-center gap-2">
              <div class="flex-shrink-0">${icon("zap", "w-4 h-4 text-white")}</div>
              <div class="flex-1 min-w-0"><span class="text-sm font-bold text-white block">Smart Insights</span></div>
            </div>
          </div>
          <div class="p-3 space-y-2 max-h-96 overflow-y-auto overflow-x-hidden">${body}</div>
        </div>
      </div>`;
  }


  /* ── BulkOrderModeDropdown.jsx ────────────────────────────────────────── */
  function renderBulkOrderDropdown() {
    return `
      <div class="relative" data-bulkroot>
        <button type="button" data-bulktoggle
          class="w-full font-medium py-1 px-2 justify-center items-center border !border-gray-200 flex hover:!bg-gray-100 rounded-md h-10 text-sm bg-white text-black">
          ${icon("fileSpreadsheet", "mr-2 mt-[1px]", 14)}Bulk ${esc(state.label)}
          ${icon("chevronDown", `h-3.5 w-3.5 ml-2 shrink-0 transition-transform duration-150 ${state.bulkMenuOpen ? "rotate-180" : ""}`)}
        </button>
        ${state.bulkMenuOpen ? `<div class="absolute right-0 top-full mt-1 w-56 rounded-md border border-gray-200 bg-white shadow-lg overflow-hidden z-[9999]">
          <button type="button" data-bulkmode="STANDARD" class="w-full flex items-start gap-3 px-4 py-3 text-sm text-left text-gray-700 hover:bg-emerald-50 transition">
            ${icon("fileSpreadsheet", "h-4 w-4 shrink-0 mt-0.5 text-emerald-600")}
            <div><div class="font-medium">Bulk ${esc(state.label)}</div><div class="text-xs text-gray-400 mt-0.5">Create regular bulk orders</div></div>
          </button>
          <div class="border-t border-gray-100"></div>
          <button type="button" data-bulkmode="ROUTE" class="w-full flex items-start gap-3 px-4 py-3 text-sm text-left text-gray-700 hover:bg-indigo-50 transition">
            ${icon("route", "h-4 w-4 shrink-0 mt-0.5 text-indigo-500")}
            <div><div class="font-medium">Route Bulk ${esc(state.label)}</div><div class="text-xs text-gray-400 mt-0.5">Create orders for route delivery</div></div>
          </button>
        </div>` : ""}
      </div>`;
  }

  /* ── CustomPagination.jsx ─────────────────────────────────────────────── */
  function renderPagination(currentPage, totalPages, resultsPerPage, totalResults) {
    const pages = [];
    if (totalPages <= 6) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("l");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("r");
      pages.push(totalPages);
    }
    const btn = (p) =>
      p === "l" || p === "r"
        ? `<span class="px-2 text-gray-500 dark:text-gray-400 font-medium">...</span>`
        : `<li><button data-page="${p}" type="button" class="align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-3 py-1 rounded-md text-xs ${
            currentPage === p
              ? "text-white bg-green-500 hover:bg-green-600"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }">${p}</button></li>`;
    const start = (currentPage - 1) * resultsPerPage + 1;
    const end = Math.min(currentPage * resultsPerPage, totalResults);
    return `
      <div class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm">
        <span class="font-semibold tracking-wide uppercase text-xs">SHOWING ${start}–${end} OF ${totalResults}</span>
        <div class="mt-2 sm:mt-0"><nav aria-label="Table navigation"><ul class="inline-flex items-center space-x-2">
          <li><button data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""} class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">‹</button></li>
          ${pages.map(btn).join("")}
          <li><button data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""} class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">›</button></li>
        </ul></nav></div>
      </div>`;
  }

  /* ── TableLoading.jsx (row=12 col=7 width=160 height=20) ──────────────── */
  function renderTableLoading(row = 12, col = 7, width = 160, height = 20) {
    const bar = (h, w) => `<span class="skeleton mx-1 my-1" style="height:${h}px;width:${w}px"></span>`;
    return `
      <div class="${WM.tableContainer} mb-8">
        <div class="text-center">
          ${Array.from({ length: col }, () => bar(40, width)).join("")}
          ${Array.from({ length: row }, () => `<div>${Array.from({ length: col }, () => bar(height, width)).join("")}</div>`).join("")}
        </div>
        <div class="${WM.tableFooter} flex justify-between">${bar(25, 290)}${bar(25, 290)}</div>
      </div>`;
  }

  /* ── NotFound.jsx ─────────────────────────────────────────────────────── */
  const NO_RESULT_SVG =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><g fill="none" stroke="#d1d5db" stroke-width="3"><rect x="60" y="45" width="200" height="120" rx="10"/><line x1="60" y1="78" x2="260" y2="78"/><line x1="90" y1="103" x2="230" y2="103"/><line x1="90" y1="126" x2="200" y2="126"/></g><circle cx="215" cy="140" r="34" fill="#fff" stroke="#9ca3af" stroke-width="4"/><line x1="239" y1="164" x2="262" y2="187" stroke="#9ca3af" stroke-width="7" stroke-linecap="round"/></svg>'
    );

  function renderNotFound(title) {
    return `
      <div class="text-center align-middle mx-auto p-5 my-5">
        <div class="flex justify-center"><img class="my-4 w-full max-w-xs sm:max-w-sm md:max-w-md" src="${NO_RESULT_SVG}" alt="no-result" /></div>
        <h2 class="text-lg md:text-xl lg:text-2xl xl:text-2xl text-center mt-2 font-medium font-serif text-gray-600">We're sorry, ${esc(title)}</h2>
      </div>`;
  }

  /* ── SelectOrderByStatus (react-select stand-in) ──────────────────────── */
  function renderStatusSelect() {
    const opts = allStatuses();
    const label = state.status ? toTitleCaseFun(state.status) : null;
    return `
      <div class="relative" data-statusroot>
        <div class="rs-control ${state.statusOpen ? "is-focused" : ""}" data-statustoggle>
          <span class="${label ? "" : "rs-placeholder"}">${label ? esc(label) : "All Status"}</span>
          <span class="flex items-center gap-1">
            ${state.status ? `<button type="button" data-statusclear class="text-gray-400 hover:text-gray-600">${icon("x", "w-4 h-4")}</button>` : ""}
            ${icon("chevronDown", "w-4 h-4 text-gray-400")}
          </span>
        </div>
        ${
          state.statusOpen
            ? `<div class="rs-menu">${opts
                .map(
                  (s) =>
                    `<div data-statusopt="${esc(s)}" class="px-3 py-2 cursor-pointer text-sm ${
                      s === state.status ? "bg-blue-600 text-white" : "bg-white text-gray-800 hover:bg-blue-600 hover:text-white"
                    }">${esc(toTitleCaseFun(s))}</div>`
                )
                .join("")}</div>`
            : ""
        }
      </div>`;
  }

  /* ── MobileOrderCard.jsx ──────────────────────────────────────────────── */
  function renderMobileCard(order) {
    const cust = customerFor(order);
    const c = order.fulfillment || { dispatches: 0, deliveries: 0, returns: 0 };
    const isExpanded = state.expanded.includes(order._id);
    const opts = statusOptionsFor(order.status);
    const canChange = opts.length > 1;
    const statusLabel = String(order.status || "Pending").replace(/_/g, " ");

    const counts =
      c.dispatches > 0 || c.deliveries > 0 || c.returns > 0
        ? `<div class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium">
             ${c.dispatches > 0 ? `<span class="text-emerald-600"><span class="mr-1">●</span>${c.dispatches} dispatch${c.dispatches > 1 ? "es" : ""}</span>` : ""}
             ${c.deliveries > 0 ? `<span class="text-violet-600"><span class="mr-1">●</span>${c.deliveries} deliver${c.deliveries > 1 ? "ies" : "y"}</span>` : ""}
             ${c.returns > 0 ? `<span class="text-orange-600"><span class="mr-1">●</span>${c.returns} return${c.returns > 1 ? "s" : ""}</span>` : ""}
           </div>`
        : "";

    return `
      <div class="md:hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div role="button" tabindex="0" data-toggle="${esc(order._id)}" aria-expanded="${isExpanded}"
             class="w-full px-4 py-3.5 text-left transition-colors active:bg-slate-50">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="truncate text-sm font-bold tracking-tight text-slate-800">${esc(order.invoice)}</span>
                <span role="button" tabindex="0" data-copy="${esc(order.invoice)}" aria-label="Copy order reference"
                      class="rounded p-1 text-violet-500 transition-colors hover:bg-violet-50">${icon("copy", "h-3.5 w-3.5")}</span>
                ${icon("zap", "h-3.5 w-3.5 flex-shrink-0 text-violet-500")}
              </div>
              ${counts}
            </div>
            <div class="flex-shrink-0 text-right">
              ${
                canChange
                  ? `<label class="relative inline-flex items-center rounded-md ring-1 ring-inset ${getStatusClasses(order.status)}">
                       <span class="pointer-events-none absolute right-1.5 text-current">${icon("chevronDown", "h-3 w-3")}</span>
                       <select data-rowstatus="${esc(order._id)}" aria-label="Change status for order ${esc(order.invoice)}"
                         class="cursor-pointer appearance-none border-0 bg-transparent py-1 pl-2 pr-6 text-[10px] font-semibold capitalize text-current outline-none">
                         ${opts.map((s) => `<option value="${esc(s)}" ${s === order.status ? "selected" : ""} class="bg-white text-slate-800">${esc(String(s).replace(/_/g, " "))}</option>`).join("")}
                       </select>
                     </label>`
                  : `<span class="inline-flex rounded-md px-2 py-1 text-[10px] font-semibold capitalize ring-1 ring-inset ${getStatusClasses(order.status)}">${esc(statusLabel)}</span>`
              }
              <div class="mt-1.5 text-[11px] leading-4 text-slate-500">
                <div>${fmtDate2(order.createdAt)}</div>
                <div>${fmtTime(order.createdAt)}</div>
              </div>
            </div>
          </div>
          <div class="mt-3 flex items-end justify-between gap-3">
            <div class="flex min-w-0 items-start gap-2">
              ${icon("user", "mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400")}
              <div class="min-w-0">
                <div class="truncate text-xs font-semibold text-slate-800">${esc(cust.name || "Customer")}</div>
                ${cust.contact ? `<div class="mt-0.5 text-[11px] text-slate-500">${esc(cust.contact)}</div>` : ""}
              </div>
            </div>
            <div class="flex-shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-slate-900">${state.currency}${getNumberTwo(orderTotal(order))}</div>
          </div>
        </div>
        <div class="flex items-center border-t border-slate-100 bg-slate-50/70">
          <button type="button" data-toggle="${esc(order._id)}" aria-expanded="${isExpanded}"
            class="flex min-w-0 flex-1 items-center justify-between px-4 py-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100">
            <span>${isExpanded ? "Hide order details" : "View order details"}</span>
            ${icon("chevronDown", `h-4 w-4 text-slate-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`)}
          </button>
        </div>
        ${isExpanded ? renderFulfillmentMetadata(order) : ""}
      </div>`;
  }


  /* ── OrderFulfillmentMetadata.jsx — the expanded-row panel ─────────────── */
  const FM_TABS = [
    { id: "details", label: "Details", icon: "fileText" },
    { id: "items", label: "Items", icon: "shoppingBag" },
    { id: "comments", label: "Comments", icon: "messageSquare" },
    { id: "fulfillment", label: "Fulfillment", icon: "mapPin" },
  ];

  function fmField(label, value, extra) {
    return `<div><p class="text-xs text-slate-500 mb-1">${esc(label)}</p>
      <p class="text-sm font-medium text-slate-900${extra || ""}">${value}</p></div>`;
  }

  function renderFmDetails(order) {
    const cust = customerFor(order);
    const copied = state.copied === order.invoice;
    return `<div class="space-y-4">
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-xs text-slate-500 mb-1">Order Number</p>
          <div class="flex items-center gap-2">
            <p class="text-sm font-mono font-medium text-slate-900">${esc(order.invoice)}</p>
            <button data-copy="${esc(order.invoice)}" class="p-1 rounded-md hover:bg-slate-100 transition-all duration-200 group/copy"
              title="${copied ? "Copied!" : "Copy Order reference"}">
              ${copied ? icon("check", "w-3.5 h-3.5 text-emerald-500") : icon("copy", "w-3.5 h-3.5 text-slate-400 group-hover/copy:text-slate-600")}
            </button>
          </div>
        </div>
        <div>
          <p class="text-xs text-slate-500 mb-1">Status</p>
          <p class="text-sm font-medium text-slate-900 capitalize">${esc(String(order.status).replace(/_/g, " "))}</p>
        </div>
        ${fmField("Customer Name", esc(cust.name || "N/A"))}
        ${fmField("Phone", esc(cust.contact || "N/A"))}
        <div class="col-span-2 sm:col-span-1">
          <p class="text-xs text-slate-500 mb-1">Email</p>
          <p class="text-sm font-medium text-slate-900 break-all">${esc(order.email || "N/A")}</p>
        </div>
        <div class="col-span-2 sm:col-span-1">
          <p class="text-xs text-slate-500 mb-1">Order Date</p>
          <p class="text-sm font-medium text-slate-900">${new Date(order.createdAt).toLocaleString()}</p>
        </div>
      </div>
    </div>`;
  }

  function renderFmItems(order) {
    const items = order.item_list || [];
    if (items.length === 0)
      return `<div><div class="py-8 text-center text-sm text-slate-500">No items found</div></div>`;
    return `<div><div class="space-y-2">
      ${items.map((item) => `<div class="border border-slate-200 rounded p-2 hover:bg-slate-50 transition-colors">
        <div class="flex items-center gap-3">
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-medium text-slate-900 truncate">${esc(item.name)}</h4>
            ${item.articleNumber ? `<p class="text-xs text-slate-500">Art no: ${esc(item.articleNumber)}</p>` : ""}
          </div>
          <div class="flex-shrink-0 text-right">
            <span class="text-sm font-medium text-slate-900">${item.qty} ${esc(item.measurement || "")}</span>
          </div>
        </div>
      </div>`).join("")}
    </div></div>`;
  }

  function renderFmComments(order) {
    const has = !!(order.comments && String(order.comments).trim());
    return `<div class="bg-white rounded-lg border border-gray-200">
      ${
        has
          ? `<div class="px-6 py-4"><p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${esc(order.comments)}</p></div>`
          : `<div class="flex flex-col items-center justify-center py-12 text-center px-6">
               <div class="p-4 bg-gray-50 rounded-full mb-4">${icon("messageSquare", "text-gray-400", 28)}</div>
               <h3 class="text-base font-semibold text-gray-900 mb-1">No Comments Added</h3>
               <p class="text-sm text-gray-500 max-w-sm">There are no comments associated with this order yet.</p>
             </div>`
      }
    </div>`;
  }

  function renderFmFulfillment(order) {
    const ds = order.dispatchRecords || [];
    if (ds.length === 0) {
      return `<div class="p-3 sm:p-6">
        <div class="flex flex-col items-center justify-center py-12 text-center">
          <div class="p-4 rounded-full bg-gray-100 mb-4">${icon("box", "w-8 h-8 text-gray-400")}</div>
          <p class="text-sm font-semibold text-gray-700">No Fulfillment Activity</p>
          <p class="text-xs text-gray-500 mt-1">No dispatches, deliveries, or returns have been created for this order yet</p>
        </div>
      </div>`;
    }
    const refRow = (label, ref, iconName, colour) => `
      <div class="flex items-center gap-2">
        ${icon(iconName, `w-4 h-4 ${colour} flex-shrink-0`)}
        <div class="flex-1">
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-slate-700">${label}</span>
            <span class="text-xs font-mono text-slate-600">${esc(ref)}</span>
            <button data-copy="${esc(ref)}" class="p-0.5 rounded hover:bg-slate-100 transition-colors" title="Copy ${label}">
              ${state.copied === ref ? icon("check", "w-3 h-3 text-emerald-500") : icon("copy", "w-3 h-3 text-slate-400")}
            </button>
          </div>
        </div>
      </div>`;
    return `<div class="p-3 sm:p-6 bg-white"><div class="space-y-2">
      ${ds.map((dp) => `
        <div class="rounded-lg border ${dp.border} ${dp.bg} p-3 shadow-sm">
          ${refRow("Dispatch", dp.order_number, "truck", "text-slate-700")}
          <p class="mt-1 pl-6 text-xs text-slate-500 capitalize">${esc(String(dp.status).replace(/_/g, " "))}</p>
          ${
            dp.delivery
              ? `<div class="mt-2 ml-6 rounded-lg border border-violet-200 bg-violet-50 p-2.5">
                   ${refRow("Delivery Run", dp.delivery.order_number, "mapPin", "text-violet-700")}
                   <div class="mt-1.5 pl-6 flex items-center gap-2">
                     <div class="h-1.5 flex-1 rounded-full bg-white overflow-hidden">
                       <div class="h-full rounded-full bg-violet-500" style="width:${dp.delivery.progress}%"></div>
                     </div>
                     <span class="text-xs text-slate-600 font-medium">${dp.delivery.progress}%</span>
                   </div>
                 </div>`
              : ""
          }
          ${(dp.returns || []).map((rt) => `
            <div class="mt-2 ml-6 rounded-lg border border-orange-200 bg-orange-50 p-2.5">
              ${refRow("Return", rt.order_number, "cornerUpLeft", "text-orange-700")}
              <p class="mt-1 pl-6 text-xs text-slate-500 capitalize">${esc(rt.status)}</p>
            </div>`).join("")}
        </div>`).join("")}
    </div></div>`;
  }

  function renderFulfillmentMetadata(order) {
    const active = state.fmTab[order._id] || "details";
    const items = (order.item_list || []).length;
    const tabs = FM_TABS.map((t) => `
      <button data-fmtab="${esc(order._id)}" data-fmtabid="${t.id}"
        class="flex-1 px-2 py-3 text-xs font-medium border-b-2 transition-colors ${
          active === t.id ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
        }">
        <div class="flex items-center justify-center gap-1.5">${icon(t.icon, "", 14)}<span class="truncate">${t.label}${
          t.id === "items" && items > 0 ? ` (${items})` : ""
        }</span></div>
      </button>`).join("");
    let body = "";
    if (active === "details") body = renderFmDetails(order);
    else if (active === "items") body = renderFmItems(order);
    else if (active === "comments") body = renderFmComments(order);
    else body = renderFmFulfillment(order);
    return `<div class="border-t border-slate-200">
      <div class="flex border-b border-slate-200 bg-white">${tabs}</div>
      <div class="${active === "fulfillment" ? "" : "p-3 sm:p-6 bg-white"}">${body}</div>
    </div>`;
  }

  /* ── OrderTable.jsx — desktop row ─────────────────────────────────────── */
  const ALLOC_STYLES = {
    FULLY_ALLOCATED: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Fully Allocated" },
    PARTIALLY_ALLOCATED: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "Partially Allocated" },
    UNALLOCATED: { cls: "bg-slate-100 text-slate-600 border-slate-200", label: "Unallocated" },
  };

  function renderAllocationCell(order) {
    const a = ALLOC_STYLES[order.allocationStatus] || ALLOC_STYLES.UNALLOCATED;
    const pct = order.fulfilledPct || 0;
    return `<div class="flex flex-col gap-2">
      <span class="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${a.cls}">${a.label}</span>
      <div class="flex items-center gap-2">
        <div class="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
          <div class="h-full rounded-full ${pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-amber-500" : "bg-slate-300"}" style="width:${Math.min(100, pct)}%"></div>
        </div>
        <span class="text-[11px] tabular-nums text-slate-500">${order.allocatedQty || 0}/${order.totalQty || 0}</span>
      </div>
    </div>`;
  }

  function renderDesktopRow(order) {
    const cust = customerFor(order);
    const c = order.fulfillment || { dispatches: 0, deliveries: 0, returns: 0 };
    const isExpanded = state.expanded.includes(order._id);
    const opts = statusOptionsFor(order.status);
    const isDisabled = opts.length <= 1;
    // Live: editAllowedStatuses AND no dispatch activity yet.
    const isEditAllowed = ["PENDING", "PROCESSING"].includes(order.status) && c.dispatches === 0;
    const showInvoice = !!(state.seed.appProp && state.seed.appProp.canShowInvoiceAction);
    const showAllocation = features().allocationStatus === true;

    const countPills =
      c.dispatches > 0 || c.deliveries > 0 || c.returns > 0
        ? `<div class="flex items-center gap-2">
             ${c.dispatches > 0 ? `<div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div><button data-toggle="${esc(order._id)}" class="text-xs font-medium text-emerald-600">${c.dispatches} dispatch${c.dispatches > 1 ? "es" : ""}</button></div>` : ""}
             ${c.deliveries > 0 ? `<div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-purple-500"></div><button data-toggle="${esc(order._id)}" class="text-xs font-medium text-purple-600">${c.deliveries} deliver${c.deliveries > 1 ? "ies" : "y"}</button></div>` : ""}
             ${c.returns > 0 ? `<div class="flex items-center gap-1"><div class="w-1.5 h-1.5 rounded-full bg-orange-500"></div><button data-toggle="${esc(order._id)}" class="text-xs font-medium text-orange-600">${c.returns} return${c.returns > 1 ? "s" : ""}</button></div>` : ""}
           </div>`
        : "";

    return `
      <tr class="group hidden hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent transition-all duration-200 border-b border-slate-100 md:table-row">
        <td class="${WM.tableCell} py-4 px-6 w-[200px]">
          <div class="flex items-center gap-3">
            <button data-toggle="${esc(order._id)}" class="p-1.5 -ml-1 hover:bg-slate-200 rounded-lg transition-all duration-200 hover:shadow-sm"
              aria-label="${isExpanded ? "Collapse deliveries" : "Expand deliveries"}">
              ${icon(isExpanded ? "chevronUp" : "chevronDown", "w-4 h-4 text-slate-600")}
            </button>
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-slate-900 tracking-tight">${esc(order.invoice)}</span>
                <button data-copy="${esc(order.invoice)}" class="p-1 rounded-md hover:bg-slate-100 transition-all duration-200 group/copy"
                  title="${state.copied === order.invoice ? "Copied!" : "Copy " + esc(state.label) + " Id"}">
                  ${state.copied === order.invoice ? icon("check", "w-3.5 h-3.5 text-emerald-500") : icon("copy", "w-3.5 h-3.5 text-slate-400 group-hover/copy:text-slate-600")}
                </button>
                <div class="relative inline-block" data-insight="${esc(order._id)}">
                  <button class="p-1 rounded-md hover:bg-purple-50 transition-all duration-200" aria-label="Smart insights">${icon("zap", "w-3.5 h-3.5 text-purple-600")}</button>
                </div>
              </div>
              ${countPills}
            </div>
          </div>
        </td>

        <td class="${WM.tableCell} py-4 px-6 w-[140px]">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm text-slate-700">${fmtDate(order.createdAt)}</span>
            <span class="text-xs text-slate-500">${fmtTime(order.createdAt)}</span>
          </div>
        </td>

        <td class="${WM.tableCell} py-4 px-6 w-[180px]">
          <span class="text-sm font-medium text-slate-900">${esc(cust.name)}</span>
          <div class="text-xs text-slate-500">${esc(cust.contact)}</div>
        </td>

        <td class="${WM.tableCell} py-4 px-6 w-[130px]">
          <div class="flex flex-col items-start">
            <span class="text-sm font-semibold text-slate-900">${state.currency}${getNumberTwo(orderTotal(order))}</span>
          </div>
        </td>

        <td class="${WM.tableCell} py-4 px-6 w-[160px]">
          <select data-rowstatus="${esc(order._id)}" ${isDisabled ? "disabled" : ""}
            class="w-full min-w-[140px] px-2.5 py-1.5 text-sm font-medium rounded-md border transition-all duration-200 ${
              !isDisabled
                ? "border-slate-300 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                : "border-slate-200 bg-slate-50 cursor-not-allowed text-slate-400"
            }">
            ${opts.map((s) => `<option value="${esc(s)}" ${s === order.status ? "selected" : ""}>${esc(toTitleCaseFun(s))}</option>`).join("")}
          </select>
        </td>

        ${
          showAllocation
            ? `<td class="${WM.tableCell} py-4 px-6 w-[200px]">${renderAllocationCell(order)}</td>`
            : ""
        }

        ${
          showInvoice
            ? `<td class="${WM.tableCell} py-4 px-6 w-[120px]">
                 <div class="flex items-center justify-center">
                   <button data-invoice="${esc(order._id)}"
                     class="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                     title="Invoice">
                     ${icon("fileText", "", 14)}<span>Invoice</span>${icon("chevronDown", "flex-shrink-0", 12)}
                   </button>
                   ${
                     state.invoiceMenuFor === order._id
                       ? `<div data-invoicemenu class="absolute z-[9999] mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
                            style="top:${state.invoiceMenuPos.top}px;left:${state.invoiceMenuPos.left}px;position:fixed">
                            <button data-printtype="A4" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap">
                              ${icon("printer", "flex-shrink-0", 14)}A4 Print
                            </button>
                            <div class="border-t border-gray-100"></div>
                            <button data-printtype="Thermal" class="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap">
                              ${icon("printer", "flex-shrink-0", 14)}Thermal Print
                            </button>
                          </div>`
                       : ""
                   }
                 </div>
               </td>`
            : ""
        }

        <td class="${WM.tableCell} py-4 px-6 w-[180px]">
          <div class="flex items-center justify-center gap-1">
            <button ${isEditAllowed ? "" : "disabled"} data-editorder="${esc(order._id)}"
              class="group/btn relative p-2 rounded-md transition-all duration-200 ${isEditAllowed ? "hover:bg-slate-100" : "opacity-40 cursor-not-allowed"}"
              data-tip="${isEditAllowed ? "Edit " + esc(state.label) : "Cannot edit " + esc(order.status) + " " + esc(state.label.toLowerCase())}">
              ${/* Live: IconStyle={{ fontSize: "16px", color: isEditAllowed ? "#475569" : "#94a3b8" }} */ ""}
              ${icon("edit", "", 16, `color:${isEditAllowed ? "#475569" : "#94a3b8"}`)}
            </button>
            <a href="#" onclick="return false" data-timeline="${esc(order._id)}" class="group/btn relative p-2 rounded-md hover:bg-slate-100 transition-all duration-200" data-tip="View Timeline">
              ${icon("clock", "", 16, "color:#475569")}
            </a>
            <a href="#" onclick="return false" data-view="${esc(order._id)}" class="group/btn relative p-2 rounded-md hover:bg-slate-100 transition-all duration-200" data-tip="View ${esc(state.label)}">
              ${icon("eye", "", 16, "color:#475569")}
            </a>
          </div>
        </td>
      </tr>
      ${
        isExpanded
          ? `<tr class="hidden bg-gray-50 md:table-row"><td colspan="${5 + (showAllocation ? 1 : 0) + (showInvoice ? 1 : 0) + 1}" class="${WM.tableCell} p-0">${renderFulfillmentMetadata(order)}</td></tr>`
          : ""
      }`;
  }


  /* ══ OVERLAYS — markup captured from the live app on 2026-08-11 ══════════
     Classes below are copied from the running page's DOM, not inferred from
     source. Customer names and numbers are invented; the live modals show real
     tenant data and this prototype is public. */

  /* ── OrderReminderModal — "Follow-up Reminders" ───────────────────────── */
  function renderReminderModal() {
    if (!state.reminderOpen) return "";
    const rows = (state.seed.followUpCustomers || [])
      .filter((c) => !state.reminderSearch ||
        c.name.toLowerCase().includes(state.reminderSearch.toLowerCase()) ||
        c.phone.includes(state.reminderSearch))
      .filter((c) => state.reminderCatalogue === "All Catalogues" || c.catalogue === state.reminderCatalogue);

    const row = (c) => `
      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm">
        <div class="px-3 py-2.5">
          <div class="hidden sm:flex items-center gap-3">
            <button class="flex-shrink-0 p-0.5 transition-colors">${icon("square", "w-4 h-4 text-gray-400 hover:text-emerald-500 dark:text-gray-500")}</button>
            <div class="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">${icon("user", "w-4 h-4 text-gray-600 dark:text-gray-400")}</div>
            <span class="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1 min-w-0">${esc(c.name)}</span>
            <div class="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
              ${icon("phone", "w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500")}
              <span class="font-medium whitespace-nowrap">${esc(c.phone)}</span>
              <button data-copy="${esc(c.phone)}" class="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">${icon("copy", "w-3 h-3")}</button>
            </div>
            <span class="inline-flex items-center px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs rounded font-medium flex-shrink-0 max-w-[130px]">
              <span class="truncate">${esc(c.catalogue)}</span>
            </span>
            <button data-createorder class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0">Create ${esc(state.label)}</button>
            <button class="p-2 border !border-amber-200 hover:!bg-amber-50 rounded-md bg-amber-50 text-amber-700 flex-shrink-0">${icon("bell", "w-4 h-4")}</button>
            <button class="p-1.5 rounded-lg transition-colors flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0">${icon("chevronDown", "w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform")}</button>
          </div>
        </div>
      </div>`;

    const field = (label, control) => `<div>
      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">${label}</label>
      <div class="relative">${control}</div></div>`;
    const selCls = "w-full pl-3 pr-10 h-[38px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 appearance-none cursor-pointer transition-all duration-150";
    const chev = icon("chevronDown", "absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none");

    return `
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" data-remindermodal>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col mx-4">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <div class="flex items-center gap-3 flex-1">
              <div class="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center flex-shrink-0">${icon("circleAlert", "w-5 h-5 text-emerald-600 dark:text-emerald-400")}</div>
              <div class="flex-1 min-w-0">
                <h2 class="text-lg font-bold text-gray-900 dark:text-white">Follow-up Customers Without ${esc(state.label)} ${esc(state.reminderSince)}</h2>
                <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">These customers haven't placed sales orders in the selected timeframe. Call them to convert into sales.</p>
              </div>
            </div>
            <button data-reminderclose class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 ml-4">${icon("x", "w-5 h-5 text-gray-500")}</button>
          </div>

          <div class="px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
              ${field("Search Customers", `<input data-remindersearch value="${esc(state.reminderSearch)}" placeholder="Search by name, phone, email..."
                class="w-full pl-3 pr-10 h-[38px] text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all duration-150" />
                ${icon("search", "absolute right-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none")}`)}
              ${field("No Sales Orders Since", `<select data-remindersince class="${selCls}">${(state.seed.sinceOptions || []).map((o) => `<option ${o === state.reminderSince ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>${chev}`)}
              ${field("Filter by Catalogue", `<select data-remindercatalogue class="${selCls}">${(state.seed.catalogues || []).map((o) => `<option ${o === state.reminderCatalogue ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>${chev}`)}
            </div>
          </div>

          <div class="flex-1 overflow-y-auto px-6 py-4">
            <div class="space-y-2">${rows.map(row).join("") || `<p class="py-12 text-center text-sm text-gray-500">No customers match that filter.</p>`}</div>
          </div>

          <div class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between flex-wrap gap-2 flex-shrink-0">
            <div class="flex items-center gap-4">
              <p class="text-sm text-gray-700 dark:text-gray-300"><span class="font-bold text-emerald-600 dark:text-emerald-400">${state.seed.followUpTotal}</span> <span class="font-medium">customers to follow up</span></p>
              <div class="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
              <p class="text-xs text-gray-600 dark:text-gray-400"><span class="font-medium">Tip:</span> Call them to convert into orders</p>
            </div>
            <button data-reminderclose class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">Close</button>
          </div>
        </div>
      </div>`;
  }

  /* ── CreateDeliveryModal — 3-step wizard, step 1 ──────────────────────── */
  const TONE = { amber: "bg-amber-100 text-amber-700", blue: "bg-blue-100 text-blue-700",
                 emerald: "bg-emerald-100 text-emerald-700", violet: "bg-violet-100 text-violet-700",
                 rose: "bg-rose-100 text-rose-700" };

  function renderCreateDeliveryModal() {
    if (!state.deliveryOpen) return "";
    const cands = state.seed.deliveryCandidates || [];
    const total = state.seed.deliveryCandidateTotal;
    const sel = state.deliverySelected;

    const step = (n, label, active) => `
      <div class="flex items-center flex-1 min-w-0">
        <div class="flex flex-col items-center gap-1 flex-shrink-0">
          <div class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${active ? "bg-white border-green-600 text-green-700" : "bg-white border-gray-200 text-gray-400"}">${n}</div>
          <span class="text-[10px] font-semibold whitespace-nowrap ${active ? "text-green-700" : "text-gray-400"}">${label}</span>
        </div>
        <div class="flex-1 h-0.5 mx-2 mt-[-12px] rounded bg-gray-200"></div>
      </div>`;

    const th = (t, extra) => `<th class="py-2 px-3 ${extra || "text-left"} text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">${t}</th>`;

    return `
      <div class="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" data-deliverymodal>
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl relative w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
          <div class="flex-shrink-0 bg-white dark:bg-gray-800 p-3 pb-0 relative">
            <button data-deliveryclose class="absolute top-2 right-2 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all z-[1]">${icon("x", "w-5 h-5")}</button>
          </div>
          <div class="flex-1 min-h-0 px-2 pb-2 pt-2 md:px-4 md:pb-4 overflow-y-auto scrollbar-hide flex flex-col">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-sm">${icon("truck", "w-5 h-5 text-white")}</div>
              <div>
                <h2 class="text-lg font-bold text-gray-900 dark:text-white leading-tight">Create Delivery</h2>
                <p class="text-xs text-gray-500">Turn existing orders into a route delivery</p>
              </div>
            </div>

            <div class="flex items-center gap-0 w-full mb-5">
              ${step(1, "Select Orders", true)}${step(2, "Assign Staff", false)}${step(3, "Review &amp; Name", false)}
            </div>

            <div class="flex flex-col gap-3 min-h-0">
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <div class="relative flex-1">
                  ${icon("search", "absolute left-1 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400")}
                  <input placeholder="Search by customer, address, or order number..." class="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </div>
                <div class="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 flex-shrink-0"><span class="font-semibold">${total}</span> available</div>
              </div>

              <div class="flex items-center justify-between px-1">
                <label class="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" data-delselall ${sel.length === cands.length && cands.length ? "checked" : ""} class="w-4 h-4 accent-green-600 rounded" />
                  <span class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Select all ( ${total} )</span>
                </label>
              </div>

              <div class="border border-gray-100 rounded-xl overflow-hidden flex-1">
                <div class="overflow-y-auto" style="max-height:260px">
                  <table class="w-full">
                    <thead><tr class="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-700">
                      <th class="w-8 py-2 pl-4 pr-2"></th>${th("Customer Name")}${th("Address")}
                      <th class="py-2 px-3"></th><th class="py-2 px-3"></th>
                      ${th("Total Amount", "text-right")}
                      <th class="py-2 pr-4 pl-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-300">Items</th>
                      <th class="w-8 py-2 pr-3 pl-2"></th>
                    </tr></thead>
                    <tbody>
                      ${cands.map((c, i) => `<tr data-delrow="${i}" class="cursor-pointer border-l-4 transition-colors ${sel.includes(i) ? "border-green-500 bg-green-50" : "border-transparent bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700"}">
                        <td class="py-3 pl-4 pr-2"><input type="checkbox" data-delcheck="${i}" ${sel.includes(i) ? "checked" : ""} class="w-4 h-4 accent-green-600 rounded flex-shrink-0" /></td>
                        <td class="py-3 px-3">
                          <div class="flex w-full items-center gap-2 text-left">
                            <div class="rounded-full flex-shrink-0 flex items-center justify-center font-bold ${TONE[c.tone] || TONE.blue} w-8 h-8 text-xs">${esc(c.name[0].toUpperCase())}</div>
                            <span class="min-w-0"><span class="block truncate font-bold text-gray-900 dark:text-white">${esc(c.name)}</span></span>
                          </div>
                        </td>
                        <td class="max-w-[280px] py-3 px-3 text-xs text-gray-500"><span class="line-clamp-2">${c.address ? esc(c.address) : "—"}</span></td>
                        <td class="py-3 px-3"></td><td class="py-3 px-3"></td>
                        <td class="py-3 px-3 text-right font-bold text-gray-900 dark:text-white">${state.currency}${getNumberTwo(c.total)}</td>
                        <td class="py-3 pr-4 pl-2 text-center text-xs font-medium text-green-700">${c.items}</td>
                        <td class="py-3 pr-3 pl-2 text-center"><span class="inline-flex rounded p-1 text-gray-400">${icon("chevronDown", "h-4 w-4 transition-transform")}</span></td>
                      </tr>`).join("")}
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="flex items-center gap-3 pt-1">
                <button data-deliveryclose class="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
                <button data-delnext ${sel.length ? "" : "disabled"} class="flex-1 py-2.5 px-5 bg-green-600 rounded-lg text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  Assign Staff ${icon("chevronRight", "w-4 h-4")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── CreateOrderDrawer — "Create Sales Orders", empty state ───────────── */
  function renderCreateOrderDrawer() {
    if (!state.createOrderOpen) return "";
    return `
      <div class="rc-drawer is-open" data-createorderdrawer>
        <div class="rc-drawer-mask" data-createordermask></div>
        <div class="rc-drawer-content">
          <button data-createorderclose class="absolute focus:outline-none z-10 text-red-500 hover:bg-red-100 hover:text-gray-700 transition-colors duration-150 bg-white shadow-md mr-6 right-0 left-auto w-10 h-10 rounded-full block text-center" style="top:1.5rem">${icon("x", "mx-auto")}</button>
          <div class="flex flex-col w-full h-full justify-between">
            <div class="relative w-full h-full flex flex-col bg-white dark:bg-gray-800">
              <div class="w-full relative px-4 sm:px-6 py-3 sm:py-4 pr-16 border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 shadow-sm flex-shrink-0">
                <div class="flex items-center gap-2 flex-1 min-w-0">
                  ${icon("shoppingCart", "w-5 h-5 sm:w-6 sm:h-6 text-green-600 flex-shrink-0")}
                  <div class="min-w-0">
                    <h2 class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white">Create ${esc(state.label)}</h2>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 truncate">Select customer and add products to create a new sales orders</p>
                  </div>
                </div>
              </div>

              <div class="flex-1 flex flex-col overflow-hidden">
                <div class="px-4 sm:px-6 py-2 sm:py-4 flex-shrink-0 bg-gray-50 dark:bg-gray-900/50">
                  <div class="grid gap-1.5 sm:gap-2 grid-cols-2 sm:grid-cols-1 lg:grid-cols-2">
                    <div class="min-w-0">
                      <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">Select Customer</label>
                      <div class="rs-control"><span class="rs-placeholder">Select Customer</span><span class="flex items-center gap-1">${icon("chevronDown", "w-4 h-4 text-gray-400")}</span></div>
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center justify-between gap-2 mb-1 sm:mb-2">
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">Search Products</label>
                      </div>
                      <div class="relative"><div class="flex gap-2"><div class="relative flex-1">
                        ${icon("search", "absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400")}
                        <input placeholder="Search products..." class="w-full pl-9 pr-3 h-[38px] border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      </div></div></div>
                    </div>
                  </div>
                </div>

                <div class="flex-1 overflow-y-auto px-4 sm:px-6 py-2 sm:py-4 scrollbar-hide">
                  <div class="h-full flex items-center justify-center">
                    <div class="text-center max-w-md mx-auto">
                      <div class="w-20 h-20 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">${icon("shoppingCart", "w-10 h-10 text-gray-400 dark:text-gray-500")}</div>
                      <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Ready to Create ${esc(state.label)}</h3>
                      <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">Choose a customer from the dropdown above to view their product catalog and start building sales orders.</p>
                    </div>
                  </div>
                </div>

                <div class="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-3 py-2 sm:p-5 shadow-lg flex-shrink-0">
                  <div class="hidden lg:block">
                    <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div class="flex items-center gap-3 flex-1">
                        ${icon("messageSquare", "w-5 h-5 text-gray-400 dark:text-gray-500")}
                        <input placeholder="E.g. Handle with care, Deliver before 5 PM..." class="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:outline-none" />
                      </div>
                      <div class="flex items-center gap-6">
                        <div class="text-center"><div class="text-[10px] leading-tight text-gray-500 dark:text-gray-400">Total Items</div><div class="text-sm font-bold leading-tight text-gray-900 dark:text-white">0</div></div>
                        <div class="text-right"><div class="text-[10px] leading-tight text-gray-500 dark:text-gray-400">${esc(state.label)} Total</div><div class="text-sm font-bold leading-tight text-green-600">${state.currency}0.00</div></div>
                        <button disabled class="flex h-12 items-center justify-center gap-2 rounded-lg bg-green-600 px-5 text-sm font-bold text-white shadow-sm transition-all hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                          ${icon("package", "h-4 w-4 flex-shrink-0")}<span class="truncate">Create ${esc(state.label)}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  /* ── Orders.jsx — page ────────────────────────────────────────────────── */
  function renderPage() {
    const label = esc(state.label);
    const list = filteredOrders();
    const totalPages = Math.ceil(list.length / PAGE_SIZE) || 1;
    const page = Math.min(state.page, Math.max(1, totalPages));
    const rows = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const showInvoice = !!(state.seed.appProp && state.seed.appProp.canShowInvoiceAction);
    const ff = features();
    const showAllocation = ff.allocationStatus === true;

    const controls = `
      <div class="mobile-orders-controls sticky isolate shrink-0 bg-gray-50 [background-clip:border-box] [backface-visibility:hidden] [overflow-anchor:none] before:pointer-events-none before:absolute before:inset-x-0 before:-top-[2px] before:h-[3px] before:bg-gray-50 after:pointer-events-none after:absolute after:inset-x-0 after:-bottom-[2px] after:h-[3px] after:bg-gray-50 dark:bg-gray-900 dark:before:bg-gray-900 dark:after:bg-gray-900 md:static md:bg-transparent md:[backface-visibility:visible] md:before:hidden md:after:hidden z-20 pb-2 md:z-auto md:pb-0" style="top:0">
        <div class="tab tab-enter max-md:!animate-none max-md:!transform-none max-md:!opacity-100">
          <div class="${WM.card} mb-0 min-w-0 overflow-hidden !bg-gray-50 shadow-xs dark:!bg-gray-900 md:mb-2 md:!bg-transparent dark:md:!bg-gray-800 lg:mb-5">
            <div class="${WM.cardBody} !p-0 !pt-0 lg:!pt-6">
              <div class="pb-0 lg:pb-3 mb-2 lg:mb-5 md:pb-0 grid lg:gap-6 xl:gap-6 xl:flex">
                <div class="flex-grow-0 sm:flex-grow md:flex-grow lg:flex-grow xl:flex-grow"></div>
                <div class="hidden md:flex flex-col sm:flex-row gap-2 lg:gap-4">
                  ${
                    ff.createDelivery
                      ? `<div class="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                           <button data-createdelivery
                             class="w-full font-medium py-1 px-2 justify-center items-center border !border-green-200 flex hover:!bg-green-50 rounded-md h-10 text-sm bg-green-50 text-green-700">
                             ${icon("truck", "mr-2 mt-[1px]", 14)}Create Delivery
                           </button>
                         </div>`
                      : ""
                  }
                  <div class="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                    <button data-createorder
                      class="w-full font-medium py-1 px-2 justify-center items-center border !border-gray-200 flex hover:!bg-gray-100 rounded-md h-10 text-sm bg-white text-black">
                      <span class="mr-2">${icon("plus", "")}</span>Create ${label}
                    </button>
                  </div>
                  ${
                    ff.orderForecast
                      ? `<div class="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                           <button data-forecast
                             class="w-full font-medium py-1 px-2 justify-center items-center border !border-gray-200 flex hover:!bg-gray-100 rounded-md h-10 text-sm bg-white text-black">
                             ${icon("trendingUp", "mr-2 mt-[1px]", 14)}Forecast Orders
                           </button>
                         </div>`
                      : ""
                  }
                  ${
                    ff.bulkProxyOrder
                      ? `<div class="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">${renderBulkOrderDropdown()}</div>`
                      : ""
                  }
                  ${
                    ff.demandReport
                      ? `<div class="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                           <button data-demand
                             class="w-full font-medium py-1 px-2 justify-center items-center border !border-gray-200 flex hover:!bg-gray-100 rounded-md h-10 text-sm bg-white text-black">
                             ${icon("fileText", "mr-2 mt-[1px]", 14)}Generate Demand
                           </button>
                         </div>`
                      : ""
                  }
                  <div class="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                    <button data-reminders
                      class="w-full font-medium py-1 px-2 justify-center items-center border !border-amber-200 flex hover:!bg-amber-50 rounded-md h-10 text-sm bg-amber-50 text-amber-700"
                      title="View customers who need follow-up calls to place orders">
                      ${icon("bell", "w-4 h-4 mr-2")}
                      <span class="hidden sm:inline">Follow-up Reminders</span>
                      <span class="sm:hidden">Reminders</span>
                    </button>
                  </div>
                  ${
                    ff.downloadAllOrders
                      ? `<div class="flex-grow-0 md:flex-grow lg:flex-grow xl:flex-grow">
                           <button data-export ${state.exporting ? "disabled" : ""} class="${WM.buttonPrimary} w-full rounded-md h-10${state.exporting ? " opacity-70 cursor-wait" : ""}">
                             ${state.exporting ? `<span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></span>Downloading…` : `<span class="mr-2">${icon("download", "")}</span>Download All ${label}`}
                           </button>
                         </div>`
                      : ""
                  }
                </div>
              </div>

              ${window.MockShell.renderMobileMenuLabel(state.seed, "/orders", state.label)}

              <form class="mt-2 grid grid-cols-2 gap-2 pb-2 md:flex md:pb-0 lg:mt-4 lg:gap-6 xl:gap-6" data-noop-form>
                <div class="col-span-2 flex-grow-0 md:col-span-1 md:flex-grow lg:flex-grow xl:flex-grow">
                  <div class="relative flex-1">
                    ${icon("search", "absolute left-1 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4")}
                    <input data-search type="search" name="search" value="${esc(state.searchInput)}" class="${WM.input} pl-9"
                      placeholder="Search by customer name, phone, or ${esc(state.label.toLowerCase())} number" />
                  </div>
                </div>

                <div class="h-10 min-w-0 flex-grow-0 md:w-[192px]">${renderStatusSelect()}</div>

                <div class="relative min-w-0 flex-grow-0 md:mb-2 md:w-[280px]">
                  <div class="relative h-10" data-dateroot>
                    ${icon("calendar", "pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-gray-400")}
                    <input readonly data-datetoggle value="${esc(
                      state.startDate || state.endDate
                        ? `${fmtPickerDate(state.startDate)} - ${fmtPickerDate(state.endDate)}`
                        : ""
                    )}" placeholder="Filter by date range"
                      class="box-border h-10 w-full cursor-pointer rounded-md border border-gray-300 bg-white py-2 pl-8 pr-7 text-xs leading-5 transition-colors hover:border-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 md:pl-10 md:pr-10 md:text-sm" />
                    ${
                      state.startDate || state.endDate
                        ? `<button type="button" data-dateclear class="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">${icon("x", "", 16)}</button>`
                        : ""
                    }
                    ${
                      state.dateOpen
                        ? `<div class="absolute right-0 z-30 mt-1 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                             <div class="flex items-center gap-2">
                               <label class="flex items-center gap-1.5 text-xs text-slate-600 font-medium">From
                                 <input type="date" data-daterange="start" value="${toInputVal(state.startDate)}" ${state.endDate ? `max="${toInputVal(state.endDate)}"` : ""}
                                   class="h-8 px-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                               </label>
                               <span class="text-slate-300 text-sm">→</span>
                               <label class="flex items-center gap-1.5 text-xs text-slate-600 font-medium">To
                                 <input type="date" data-daterange="end" value="${toInputVal(state.endDate)}" ${state.startDate ? `min="${toInputVal(state.startDate)}"` : ""}
                                   class="h-8 px-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400" />
                               </label>
                             </div>
                           </div>`
                        : ""
                    }
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>`;

    const methodTotals =
      (state.seed.methodTotals || []).length > 0
        ? `<div class="${WM.card} min-w-0 shadow-xs overflow-hidden bg-white dark:bg-gray-800 rounded-t-lg rounded-0 mb-4">
             <div class="${WM.cardBody}">
               <div class="flex gap-1">
                 ${(state.seed.methodTotals || [])
                   .map(
                     (el) =>
                       `<div class="dark:text-gray-300"><span class="font-medium"> ${esc(el.method)}</span> : <span class="font-semibold mr-2">${state.currency}${getNumber(el.total)}</span></div>`
                   )
                   .join("")}
               </div>
             </div>
           </div>`
        : "";

    let body;
    if (state.loading) {
      body = renderTableLoading();
    } else if (rows.length > 0) {
      const th = (w, text, center) =>
        `<td class="${WM.tableCell} py-3.5 px-6 w-[${w}]${center ? " text-center" : ""}"><span class="text-xs font-semibold text-slate-600 uppercase tracking-wide">${text}</span></td>`;
      body = `
        <div class="overflow-visible">
          <div class="${WM.tableContainer} mb-8 overflow-visible border-0 bg-transparent shadow-none md:overflow-hidden md:rounded-lg md:border md:border-slate-200 md:bg-white md:shadow-sm">
            <div class="w-full overflow-x-auto">
              <table class="block w-full table-auto md:table">
                <thead class="${WM.tableHeader} hidden bg-slate-50 border-b-2 border-slate-200 md:table-header-group">
                  <tr>
                    ${th("200px", label + " ID")}
                    ${th("140px", "Date")}
                    ${th("180px", "Customer")}
                    ${th("130px", "Amount")}
                    ${th("160px", "Status")}
                    ${showAllocation ? th("200px", "Allocation Status") : ""}
                    ${showInvoice ? th("120px", "Invoice") : ""}
                    ${th("160px", "Actions", true)}
                  </tr>
                </thead>
                <tbody class="${WM.tableBody} block w-full md:table-row-group">
                  ${rows
                    .map(
                      (o) => `
                    <tr class="block w-full border-0 bg-transparent pb-3 md:hidden"><td class="${WM.tableCell} block w-full p-0">${renderMobileCard(o)}</td></tr>
                    ${renderDesktopRow(o)}`
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
            <div class="${WM.tableFooter}">${renderPagination(page, totalPages, PAGE_SIZE, list.length)}</div>
          </div>
        </div>`;
    } else {
      body = renderNotFound(`but no ${state.label.toLowerCase()} are available at the moment.`);
    }

    /* ── Mobile sticky footer (Orders.jsx) ──────────────────────────────── */
    const mobileFooter = `
      <div class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
        <div class="flex w-full items-center justify-around px-1 py-2 pb-[env(safe-area-inset-bottom,8px)]">
          <div class="relative flex min-w-0 flex-1 justify-center">
                   ${
                     ff.bulkProxyOrder && state.mobileCreateMenuOpen
                       ? `<div class="fixed inset-0 z-10" data-mobilemenuscrim></div>
                          <div class="absolute bottom-full left-2 z-20 mb-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 text-left shadow-xl">
                            <button type="button" data-createorder class="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50">
                              ${icon("plus", "h-4 w-4 text-emerald-600")}Create ${label}
                            </button>
                            <button type="button" data-bulkmode="STANDARD" class="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50">
                              ${icon("fileSpreadsheet", "h-4 w-4 text-emerald-600")}Bulk ${label}
                            </button>
                            <button type="button" data-bulkmode="ROUTE" class="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-emerald-50">
                              ${icon("map", "h-4 w-4 text-emerald-600")}Route ${label}
                            </button>
                          </div>`
                       : ""
                   }
                   <button data-mobilecreate class="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1 text-emerald-700 hover:bg-emerald-50" title="Create ${label}">
                     <span class="flex items-center rounded-lg bg-emerald-600 px-2.5 py-1 text-white">
                       ${icon("plus", "h-5 w-5")}
                       ${ff.bulkProxyOrder ? icon("chevronUp", `h-3 w-3 transition-transform ${state.mobileCreateMenuOpen ? "rotate-180" : ""}`) : ""}
                     </span>
                     <span class="max-w-full truncate text-[10px] font-medium"> ${label}</span>
                   </button>
                 </div>
                 ${ff.createDelivery ? `<div class="h-8 w-px bg-gray-200"></div>
                   <button data-createdelivery class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 rounded-lg text-green-600 hover:bg-green-50" title="Create Delivery">
                     ${icon("truck", "w-5 h-5")}<span class="max-w-full truncate text-[10px] font-medium">Delivery</span>
                   </button>` : ""}
                 ${ff.demandReport ? `<div class="h-8 w-px bg-gray-200"></div>
                   <button data-demand class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 rounded-lg text-gray-600 hover:bg-gray-100" title="Demand Report">
                     ${icon("fileText", "w-5 h-5")}<span class="max-w-full truncate text-[10px] font-medium">Demand</span>
                   </button>` : ""}
                 <div class="h-8 w-px bg-gray-200"></div>
                 <button data-reminders class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 rounded-lg text-amber-600 hover:bg-amber-50" title="Follow-up Reminders">
                   ${icon("bell", "w-5 h-5")}<span class="max-w-full truncate text-[10px] font-medium">Reminders</span>
                 </button>
                 ${ff.downloadAllOrders ? `<div class="h-8 w-px bg-gray-200"></div>
                   <button data-export ${state.exporting ? "disabled" : ""} class="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40" title="Download All ${label}">
                     ${icon("download", "w-5 h-5")}<span class="max-w-full truncate text-[10px] font-medium">Download</span>
                   </button>` : ""}
        </div>
      </div>
      <div class="md:hidden h-20"></div>`;

    return controls + methodTotals + body + mobileFooter + renderInsightCard() +
      renderReminderModal() + renderCreateDeliveryModal() + renderCreateOrderDrawer();
  }

  /* ── Render + wire ────────────────────────────────────────────────────── */
  function render() {
    outlet.innerHTML = renderPage();
    wire();
  }

  function wire() {
    const $ = (s) => outlet.querySelector(s);
    const $$ = (s) => outlet.querySelectorAll(s);

    $$("[data-noop-form]").forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));

    const search = $("[data-search]");
    if (search)
      search.addEventListener("input", (e) => {
        const v = e.target.value;
        state.searchInput = v;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          state.search = v.trim();
          state.page = 1;
          render();
          const el = outlet.querySelector("[data-search]");
          if (el) {
            el.focus();
            try { el.setSelectionRange(el.value.length, el.value.length); } catch (err) {}
          }
        }, 400);
      });

    const st = $("[data-statustoggle]");
    if (st)
      st.addEventListener("click", (e) => {
        e.stopPropagation();
        state.statusOpen = !state.statusOpen;
        render();
      });
    $$("[data-statusopt]").forEach((o) =>
      o.addEventListener("click", (e) => {
        e.stopPropagation();
        state.status = o.getAttribute("data-statusopt");
        state.statusOpen = false;
        state.page = 1;
        render();
      })
    );
    const sc = $("[data-statusclear]");
    if (sc)
      sc.addEventListener("click", (e) => {
        e.stopPropagation();
        state.status = "";
        state.statusOpen = false;
        state.page = 1;
        render();
      });

    const dt = $("[data-datetoggle]");
    if (dt)
      dt.addEventListener("click", (e) => {
        e.stopPropagation();
        state.dateOpen = !state.dateOpen;
        render();
      });
    $$("[data-daterange]").forEach((el) =>
      el.addEventListener("change", () => {
        const which = el.getAttribute("data-daterange");
        if (which === "start") state.startDate = fromInputVal(el.value);
        else state.endDate = fromInputVal(el.value);
        state.page = 1;
        render();
      })
    );
    const dc = $("[data-dateclear]");
    if (dc)
      dc.addEventListener("click", (e) => {
        e.stopPropagation();
        state.startDate = null;
        state.endDate = null;
        state.page = 1;
        render();
      });

    document.addEventListener("mousedown", (e) => {
      let changed = false;
      const sr = outlet.querySelector("[data-statusroot]");
      if (state.statusOpen && sr && !sr.contains(e.target)) { state.statusOpen = false; changed = true; }
      const dr = outlet.querySelector("[data-dateroot]");
      if (state.dateOpen && dr && !dr.contains(e.target)) { state.dateOpen = false; changed = true; }
      if (state.invoiceMenuFor) {
        const im = outlet.querySelector("[data-invoicemenu]");
        const trigger = outlet.querySelector(`[data-invoice="${state.invoiceMenuFor}"]`);
        if (im && !im.contains(e.target) && trigger && !trigger.contains(e.target)) {
          state.invoiceMenuFor = null; changed = true;
        }
      }
      const br = outlet.querySelector("[data-bulkroot]");
      if (state.bulkMenuOpen && br && !br.contains(e.target)) { state.bulkMenuOpen = false; changed = true; }
      if (changed) render();
    });

    $$("[data-page]").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.disabled) return;
        const p = Number(b.getAttribute("data-page"));
        if (!p) return;
        state.page = p;
        render();
      })
    );

    $$("[data-toggle]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = el.getAttribute("data-toggle");
        const i = state.expanded.indexOf(id);
        if (i > -1) state.expanded.splice(i, 1);
        else state.expanded.push(id);
        render();
      })
    );

    $$("[data-fmtab]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        state.fmTab[b.getAttribute("data-fmtab")] = b.getAttribute("data-fmtabid");
        render();
      })
    );

    $$("[data-copy]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const v = b.getAttribute("data-copy");
        if (navigator.clipboard) navigator.clipboard.writeText(v).catch(() => {});
        state.copied = v;
        render();
        setTimeout(() => { state.copied = ""; render(); }, 2000);
      })
    );

    // Status change — live this fires handleUdateInventory and refetches.
    $$("[data-rowstatus]").forEach((sel) =>
      sel.addEventListener("change", () => {
        const order = state.orders.find((o) => o._id === sel.getAttribute("data-rowstatus"));
        if (order) order.status = sel.value;
        render();
      })
    );

    const ex = $("[data-export]");
    if (ex)
      ex.addEventListener("click", () => {
        // Live: exportFromJSON(...) writes a CSV of every order.
        state.exporting = true;
        render();
        setTimeout(() => {
          state.exporting = false;
          render();
          const list = filteredOrders();
          const head = ["Invoice", "Date", "Customer", "Contact", "Status", "Amount"];
          const csv = [head.join(",")]
            .concat(
              list.map((o) => {
                const c = customerFor(o);
                return [o.invoice, fmtDate(o.createdAt), `"${c.name}"`, c.contact, o.status, orderTotal(o).toFixed(2)].join(",");
              })
            )
            .join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "sales-orders.csv";
          a.click();
          URL.revokeObjectURL(a.href);
        }, 700);
      });

    // Actions that leave this module's boundary.
    const boundary = (msg) => (e) => { e.preventDefault(); e.stopPropagation(); window.alert(msg); };
    $$("[data-view]").forEach((b) => b.addEventListener("click", boundary(
      "Live this opens /order/<invoice>/<status> — the order detail screen.\n\nOutside this discovery round's scope (Phase 1 is the list).")));
    $$("[data-timeline]").forEach((b) => b.addEventListener("click", boundary(
      "Live this opens /order-timeline/<invoice>/<status>.\n\nOutside this discovery round's scope.")));
    $$("[data-editorder]").forEach((b) => b.addEventListener("click", (e) => {
      if (b.disabled) return;
      boundary("Live this opens OrderEditDrawer (636 lines).\n\nDeferred to a later phase — see addendum divergence D5.")(e);
    }));
    $$("[data-invoice]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = b.getAttribute("data-invoice");
        if (state.invoiceMenuFor === id) { state.invoiceMenuFor = null; render(); return; }
        const r = b.getBoundingClientRect();
        state.invoiceMenuPos = { top: r.bottom + 4, left: Math.max(8, r.right - 160) };
        state.invoiceMenuFor = id;
        render();
      })
    );
    $$("[data-printtype]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const kind = b.getAttribute("data-printtype");
        state.invoiceMenuFor = null;
        render();
        window.alert(
          kind === "A4"
            ? "Live this renders an A4 invoice PDF for the order.\n\nPDF generation is outside this discovery round."
            : "Live this opens ThermalPrintModal, a receipt preview for a thermal printer.\n\nNot ported in this round."
        );
      })
    );


    /* ── Action bar / mobile footer ─────────────────────────────────────── */
    // Destinations that are their own phase. Discovery names them rather than
    // pretending; each is a real drawer/modal in the live app.
    const deferred = (name, lines, note) => (e) => {
      e.preventDefault(); e.stopPropagation();
      window.alert(`Live this opens ${name} (${lines} lines).\n\n${note}`);
    };
    $$("[data-createdelivery]").forEach((b) =>
      b.addEventListener("click", () => { state.deliveryOpen = true; state.mobileCreateMenuOpen = false; render(); }));
    $$("[data-createorder]").forEach((b) =>
      b.addEventListener("click", () => { state.createOrderOpen = true; state.mobileCreateMenuOpen = false; state.reminderOpen = false; render(); }));
    $$("[data-forecast]").forEach((b) => b.addEventListener("click",
      deferred("OrderForecastDrawer", "587", "Deferred to the reporting phase.")));
    $$("[data-demand]").forEach((b) => b.addEventListener("click",
      deferred("DemandReportDrawer", "928", "Deferred to the reporting phase.")));
    $$("[data-reminders]").forEach((b) =>
      b.addEventListener("click", () => { state.reminderOpen = true; render(); }));
    $$("[data-bulkmode]").forEach((b) => b.addEventListener("click", (e) => {
      const mode = b.getAttribute("data-bulkmode");
      state.bulkMenuOpen = false; state.mobileCreateMenuOpen = false;
      deferred("BulkOrderDrawer", "617", `Mode: ${mode}. Deferred to the creation phase.`)(e);
    }));

    const bt = $("[data-bulktoggle]");
    if (bt) bt.addEventListener("click", (e) => { e.stopPropagation(); state.bulkMenuOpen = !state.bulkMenuOpen; render(); });

    const mc = $("[data-mobilecreate]");
    if (mc) mc.addEventListener("click", (e) => {
      e.stopPropagation();
      if (features().bulkProxyOrder) { state.mobileCreateMenuOpen = !state.mobileCreateMenuOpen; render(); }
      else deferred("CreateOrderDrawer", "4,832", "Its own phase.")(e);
    });
    const scrim = $("[data-mobilemenuscrim]");
    if (scrim) scrim.addEventListener("click", () => { state.mobileCreateMenuOpen = false; render(); });

    /* ── Smart Insights hover card ──────────────────────────────────────── */
    let insightTimer = null;
    $$("[data-insight]").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        clearTimeout(insightTimer);
        const r = el.getBoundingClientRect();
        const cardW = 320, cardH = 400;
        let top = r.bottom + 8, left = r.left;
        if (top + cardH > window.innerHeight) {
          top = r.top - cardH - 8;
          if (top < 16) top = Math.max(16, window.innerHeight - cardH - 16);
        }
        if (left + cardW > window.innerWidth - 16) left = window.innerWidth - cardW - 16;
        left = Math.max(16, left);
        state.insightPos = { top, left };
        state.insightFor = el.getAttribute("data-insight");
        render();
      });
      el.addEventListener("mouseleave", () => {
        insightTimer = setTimeout(() => { state.insightFor = null; render(); }, 150);
      });
    });
    const card = outlet.querySelector("[data-insightcard]");
    if (card) {
      card.addEventListener("mouseenter", () => clearTimeout(insightTimer));
      card.addEventListener("mouseleave", () => { state.insightFor = null; render(); });
    }


    /* ── Overlay wiring ─────────────────────────────────────────────────── */
    $$("[data-reminderclose]").forEach((b) => b.addEventListener("click", () => { state.reminderOpen = false; render(); }));
    const rs = $("[data-remindersearch]");
    if (rs) rs.addEventListener("input", (e) => {
      const v = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.reminderSearch = v; render();
        const again = outlet.querySelector("[data-remindersearch]");
        if (again) { again.focus(); try { again.setSelectionRange(v.length, v.length); } catch (err) {} }
      }, 300);
    });
    const rsi = $("[data-remindersince]");
    if (rsi) rsi.addEventListener("change", () => { state.reminderSince = rsi.value; render(); });
    const rc = $("[data-remindercatalogue]");
    if (rc) rc.addEventListener("change", () => { state.reminderCatalogue = rc.value; render(); });

    $$("[data-deliveryclose]").forEach((b) => b.addEventListener("click", () => { state.deliveryOpen = false; state.deliverySelected = []; render(); }));
    $$("[data-delcheck]").forEach((cb) => cb.addEventListener("change", (e) => {
      e.stopPropagation();
      const i = Number(cb.getAttribute("data-delcheck"));
      const k = state.deliverySelected.indexOf(i);
      if (k > -1) state.deliverySelected.splice(k, 1); else state.deliverySelected.push(i);
      render();
    }));
    $$("[data-delrow]").forEach((tr) => tr.addEventListener("click", (e) => {
      if (e.target.matches("input")) return;
      const i = Number(tr.getAttribute("data-delrow"));
      const k = state.deliverySelected.indexOf(i);
      if (k > -1) state.deliverySelected.splice(k, 1); else state.deliverySelected.push(i);
      render();
    }));
    const dsa = $("[data-delselall]");
    if (dsa) dsa.addEventListener("change", () => {
      const n = (state.seed.deliveryCandidates || []).length;
      state.deliverySelected = state.deliverySelected.length === n ? [] : Array.from({ length: n }, (_, i) => i);
      render();
    });
    const dn = $("[data-delnext]");
    if (dn) dn.addEventListener("click", () => {
      if (dn.disabled) return;
      window.alert(`Step 2 of 3 — Assign Staff.\n\n${state.deliverySelected.length} order(s) selected. The remaining wizard steps are not ported in this round.`);
    });

    $$("[data-createorderclose], [data-createordermask]").forEach((b) =>
      b.addEventListener("click", () => { state.createOrderOpen = false; render(); }));

    // Tooltips (react-tooltip stand-in)
    $$("[data-tip]").forEach((el) => {
      let tip;
      el.addEventListener("mouseenter", () => {
        tip = document.createElement("div");
        tip.className = "mock-tooltip";
        tip.style.background = "#334155";
        tip.textContent = el.getAttribute("data-tip");
        document.body.appendChild(tip);
        const r = el.getBoundingClientRect();
        tip.style.left = Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2) + "px";
        tip.style.top = r.top - tip.offsetHeight - 6 + "px";
        requestAnimationFrame(() => tip.classList.add("is-visible"));
      });
      el.addEventListener("mouseleave", () => { if (tip) tip.remove(); tip = null; });
    });
  }

  /* ── Boot ─────────────────────────────────────────────────────────────── */
  async function mount(opts) {
    opts = opts || {};
    const seed = await window.MockShell.loadSeed(opts.seedPath || "../../seed-data/seed.json");
    state.seed = seed;
    state.currency = (seed.appProp && seed.appProp.currency) || "₹";
    state.orders = opts.dataset === "empty" ? [] : materialiseOrders(seed);
    state.loading = !!opts.loading;
    if (opts.status) state.status = opts.status;
    if (opts.expand) state.expanded = [opts.expand];
    if (opts.search) { state.search = opts.search; state.searchInput = opts.search; }
    if (opts.dateOpen) state.dateOpen = true;
    if (opts.reminderOpen) state.reminderOpen = true;
    if (opts.deliveryOpen) state.deliveryOpen = true;
    if (opts.deliverySelected) state.deliverySelected = opts.deliverySelected;
    if (opts.createOrderOpen) state.createOrderOpen = true;
    if (opts.insightFor) {
      state.insightFor = opts.insightFor;
      state.insightPos = { top: 210, left: 340 };
    }

    const menu = (seed.storefrontMenus || []).find((m) => m.component === "orders");
    state.label = (menu && menu.name) || "Orders";

    outlet = window.MockShell.renderShell(document.getElementById("root"), seed, {
      activePath: "/orders",
      pageTitle: state.label,
      // /orders is in Layout's hasPageOwnedMobileHeader list — the page renders
      // its own MobileMenuLabel inside the sticky controls surface.
      pageOwnedMobileHeader: true,
    });

    render();
  }

  window.MockOrders = { mount };
})();

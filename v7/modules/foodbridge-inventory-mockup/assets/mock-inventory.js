/*
  DISCOVERY MOCK — Inventory (live routes: /inventory and /raw-material-inventory).

  Hand-port of the live storefront-frontend inventory module:
    src/pages/Inventory.jsx                       → renderPage() + Batch History tab
    src/pages/RawMaterialsInventory.jsx           → same, TABS_RM + Receive Stock button
    src/components/inventory/LiveStockSection.jsx → renderLiveStock()
    src/components/inventory/StockSummarySection.jsx → renderStockUpload()
    src/components/inventory/LowStockSection.jsx  → renderLowStock()   [phase 2]
    src/components/inventory/InventoryHealth.jsx  → renderHealth()
    src/components/inventory/ExpiryFilterBar.jsx  → renderExpiryFilterBar()
    src/components/inventory/BatchDetailPanel.jsx → renderBatchDetail()
    src/components/drawer/AddBatchDrawer.jsx      → renderAddBatchDrawer() [phase 2]
    src/utils/expiryUtils.js                      → expiry helpers below
    src/utils/PriceUtil.js                        → unit helpers below
    src/components/common/CustomPagination.jsx    → renderPagination()

  Every Tailwind class string is copied verbatim from the source JSX so the
  rendered DOM carries the same classes the live app does. These pages use a
  slate/emerald language and hand-rolled tables (not Windmill), except the Batch
  History tab which does use Windmill Table/TableContainer — those come from the
  app's own myTheme.js override, resolved in the WM map.

  Data comes from seed-data/seed.json — nothing here talks to a real API.
*/
(function () {
  "use strict";

  const { esc } = window.MockShell.helpers;
  const icon = (name, cls, size) => window.MockIcons.get(name, cls, size);

  /* ── myTheme.js resolved (Batch History tab only) ─────────────────────── */
  const WM = {
    tableContainer:
      "w-full overflow-hidden border border-gray-200 dark:border-gray-700 rounded-lg",
    tableCell: "px-4 py-2",
    tableFooter:
      "px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white text-gray-500 dark:text-gray-400 dark:bg-gray-800",
  };

  const PAGE_SIZE = 20; // LiveStockSection / StockSummarySection / InventoryHealth
  const BATCH_PAGE_SIZE = 20; // SidebarContext.resultsPerPage

  /* ── src/utils/PriceUtil.js ───────────────────────────────────────────── */
  // getUnitIndex() reads appProp.priceCalculationUnitIndex from localStorage.
  let UNIT_INDEX = 0;
  const getUnitIndex = () => UNIT_INDEX;

  const getOrderingUnitFromUnitIndex = (unit, idx) => {
    const u = String(unit || "");
    if (u.split("-").length === 3) return u.split("-")[idx];
    return [u, "Box", "Pallete"][idx];
  };

  const getDisplayUnit = (product, unitIndex = null) => {
    const measurement = (product && (product.unit || product.measurement)) || "";
    const idx = unitIndex !== null ? Number(unitIndex) : getUnitIndex();
    return getOrderingUnitFromUnitIndex(measurement, idx);
  };

  const roundQty = (n) => Math.round(n * 100) / 100;

  const getProductStockFromUnitIndex = (product, customIndex = null, exact = false) => {
    const stock = (product && product.stock) || 0;
    const boxes = (product && product.boxes) || 1;
    const pallets = (product && product.pallets) || 1;
    const idx = customIndex !== null ? customIndex : getUnitIndex();
    switch (idx) {
      case 0:
        return stock;
      case 1:
        return exact ? roundQty(stock / boxes) : Math.floor(stock / boxes);
      case 2:
        return exact
          ? roundQty(stock / (boxes * pallets))
          : Math.floor(Math.floor(stock / boxes) / pallets);
      default:
        return stock;
    }
  };

  const displayUnitConversion = (product) => {
    const unitIndex = getUnitIndex();
    if (unitIndex === 0) return [];
    const measurement = (product && product.measurement) || "";
    const boxes = Number((product && product.boxes) || 0);
    const pallets = Number((product && product.pallets) || 0);
    const secondaryUnit = getOrderingUnitFromUnitIndex(measurement, 0);
    const baseUnit = getOrderingUnitFromUnitIndex(measurement, 1);
    const pltUnit = getOrderingUnitFromUnitIndex(measurement, 2);
    if (unitIndex === 2 && pallets > 0 && boxes > 0) {
      return [`1 ${pltUnit} → ${pallets} ${baseUnit} → ${pallets * boxes} ${secondaryUnit}`];
    }
    if (unitIndex === 1 && boxes > 0) return [`1 ${baseUnit} → ${boxes} ${secondaryUnit}`];
    return [];
  };

  /* ── src/utils/expiryUtils.js ─────────────────────────────────────────── */
  const todayStart = () => new Date(new Date().setHours(0, 0, 0, 0));
  const addDays = (date, n) => new Date(date.getTime() + n * 86400000);

  const daysFromNow = (val) => {
    if (!val) return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return Math.floor((d - todayStart()) / (1000 * 60 * 60 * 24));
  };

  const formatExpiryDate = (val) => {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatShortDate = (val) => {
    if (!val) return "—";
    const d = new Date(val);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const getExpiryStatus = (expDate) => {
    if (!expDate) return "healthy";
    const d = new Date(expDate);
    if (isNaN(d.getTime())) return "healthy";
    const now = new Date();
    if (d < now) return "expired";
    if (d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) return "near";
    return "healthy";
  };

  const getFilterDateRange = (filterId) => {
    const today = todayStart();
    const dow = today.getDay();
    const isoMondayOffset = dow === 0 ? -6 : 1 - dow;
    switch (filterId) {
      case "all":
        return null;
      case "this_week": {
        const mon = addDays(today, isoMondayOffset);
        return { from: mon, to: addDays(mon, 6) };
      }
      case "this_month":
        return {
          from: new Date(today.getFullYear(), today.getMonth(), 1),
          to: new Date(today.getFullYear(), today.getMonth() + 1, 0),
        };
      case "next_7":
        return { from: today, to: addDays(today, 7) };
      case "next_30":
        return { from: today, to: addDays(today, 30) };
      case "expired":
        return { from: null, to: addDays(today, -1) };
      case "healthy":
        return { from: addDays(today, 31), to: null };
      case "custom":
        return null;
      default:
        return null;
    }
  };

  const getFilterRangeLabelCompact = (filterId) => {
    const range = getFilterDateRange(filterId);
    if (!range) return null;
    const { from, to } = range;
    if (from && to) {
      const sameMonth =
        from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
      if (sameMonth) {
        const month = to.toLocaleDateString("en-IN", { month: "short" });
        return `${from.getDate()}–${to.getDate()} ${month} ${to.getFullYear()}`;
      }
      return `${formatShortDate(from)} – ${formatShortDate(to)} ${to.getFullYear()}`;
    }
    if (!from && to) return `Up to ${formatShortDate(to)} ${to.getFullYear()}`;
    if (from && !to) return `From ${formatShortDate(from)} ${from.getFullYear()}`;
    return null;
  };

  const matchesTimeFilter = (expDate, filterId, customRange = null) => {
    if (filterId === "all") return true;
    const expD = expDate ? new Date(expDate) : null;
    if (!expD || isNaN(expD.getTime())) return filterId === "healthy" || filterId === "all";
    if (filterId === "custom") {
      if (!customRange || (!customRange.from && !customRange.to)) return true;
      const { from, to } = customRange;
      const afterFrom = !from || expD >= from;
      const toEnd = to ? new Date(to.getTime() + 86399999) : null;
      return afterFrom && (!toEnd || expD <= toEnd);
    }
    const range = getFilterDateRange(filterId);
    if (!range) return true;
    const afterFrom = !range.from || expD >= range.from;
    const toEnd = range.to ? new Date(range.to.getTime() + 86399999) : null;
    return afterFrom && (!toEnd || expD <= toEnd);
  };

  const TIME_FILTERS = [
    { id: "all", label: "All Dates" },
    { id: "this_week", label: "This Week" },
    { id: "this_month", label: "This Month" },
    { id: "next_7", label: "Next 7 Days" },
    { id: "next_30", label: "Next 30 Days" },
    { id: "expired", label: "Already Expired" },
    { id: "healthy", label: "Healthy (30+ days)" },
    { id: "custom", label: "Custom Range" },
  ];

  const PILL_STYLES = {
    all: { base: "border-slate-200 text-slate-600", active: "bg-slate-800 border-slate-800 text-white", dot: null },
    this_week: { base: "border-violet-200 text-violet-700", active: "bg-violet-600 border-violet-600 text-white", dot: "bg-violet-400" },
    this_month: { base: "border-blue-200 text-blue-700", active: "bg-blue-600 border-blue-600 text-white", dot: "bg-blue-400" },
    next_7: { base: "border-cyan-200 text-cyan-700", active: "bg-cyan-600 border-cyan-600 text-white", dot: "bg-cyan-400" },
    next_30: { base: "border-indigo-200 text-indigo-700", active: "bg-indigo-600 border-indigo-600 text-white", dot: "bg-indigo-400" },
    expired: { base: "border-red-200 text-red-700", active: "bg-red-600 border-red-600 text-white", dot: "bg-red-400" },
    healthy: { base: "border-emerald-200 text-emerald-700", active: "bg-emerald-600 border-emerald-600 text-white", dot: "bg-emerald-400" },
    custom: { base: "border-orange-200 text-orange-700", active: "bg-orange-500 border-orange-500 text-white", dot: "bg-orange-400" },
  };

  const toInputVal = (date) => {
    if (!date) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  };
  const fromInputVal = (str) => {
    if (!str) return null;
    const d = new Date(str + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  };

  /* ── Sort options ─────────────────────────────────────────────────────── */
  const LIVE_SORT_OPTIONS = [
    { value: "name:asc", label: "Product name A → Z", icon: "arrowDownAZ" },
    { value: "name:desc", label: "Product name Z → A", icon: "arrowUpAZ" },
    { value: "shortfall:desc", label: "Shortfall: highest first" },
    { value: "shortfall:asc", label: "Shortfall: lowest first" },
    { value: "stock:desc", label: "Stock on hand: highest first" },
    { value: "stock:asc", label: "Stock on hand: lowest first" },
    { value: "committed:desc", label: "Committed stock: highest first" },
    { value: "committed:asc", label: "Committed stock: lowest first" },
  ];

  const UPLOAD_SORT_OPTIONS = [
    { value: "outstanding:desc", label: "Outstanding: highest first", icon: "arrowDownWideNarrow" },
    { value: "name:asc", label: "Product name A → Z", icon: "arrowDownAZ" },
    { value: "name:desc", label: "Product name Z → A", icon: "arrowUpAZ" },
  ];

  /* ── Tabs ─────────────────────────────────────────────────────────────── */
  const TABS_FG = [
    { id: "live", label: "Current Stock", icon: "activity" },
    { id: "stock", label: "Quick Stock Upload", icon: "trendingUp" },
    { id: "inventory-health", label: "Expiry report", icon: "packageSearch" },
    { id: "batches", label: "Batch History Report", icon: "archive" },
  ];

  // RawMaterialsInventory.jsx — same shape, different labels, Low Stock in
  // place of Quick Stock Upload.
  const TABS_RM = [
    { id: "live", label: "Live Stock", icon: "activity" },
    { id: "low-stock", label: "Low Stock", icon: "alertTriangle" },
    { id: "inventory-health", label: "Inventory Health", icon: "packageSearch" },
    { id: "batches", label: "Batch History Report", icon: "archive" },
  ];

  const LOW_SORT_OPTIONS = [
    { value: "critical:desc", label: "Most critical first" },
    { value: "name:asc", label: "Product name A → Z", icon: "arrowDownAZ" },
    { value: "name:desc", label: "Product name Z → A", icon: "arrowUpAZ" },
    { value: "needToOrder:desc", label: "Need to order: highest first" },
    { value: "availableStock:asc", label: "Available stock: lowest first" },
  ];

  /* ── State ────────────────────────────────────────────────────────────── */
  const state = {
    seed: null,
    route: "/inventory",
    catalogueType: "",
    tabs: TABS_FG,
    activeTab: "live",
    products: [],
    batches: [],
    loading: false,

    live: { search: "", sort: "name:asc", page: 1, sortOpen: false },
    upload: { search: "", sort: "outstanding:desc", page: 1, sortOpen: false, rows: {} },
    low: { search: "", sort: "critical:desc", page: 1, sortOpen: false, selected: [] },
    health: { search: "", page: 1, timeFilter: "all", customRange: { from: null, to: null } },
    batchTab: { search: "", page: 1, expanded: [], copied: "", detailTab: {} },

    // AddBatchDrawer ("Receive Stock") — /raw-material-inventory only
    drawer: {
      open: false,
      openCategories: [],
      productSearch: "",
      selected: [], // [{_id, productName, articleNumber, unit, boxes, pallets, qty, mfgDate, expDate, price, tax, supplierId}]
      previewOpen: false,
      discardOpen: false,
      creating: false,
      supplierMenuFor: null,
      supplierStubFor: null,
    },
  };

  let outlet = null;
  let searchTimer = null;

  /* ── Seed → runtime shapes ────────────────────────────────────────────── */
  // Batch date offsets are resolved to real dates here; see seed `_dateComment`.
  // The time-of-day comes from the HHMM suffix the batch number already carries
  // (BATCH-20260728-0913 → 09:13) so the "Created" column shows a real clock
  // time consistent with the id, the way live records do, instead of midnight.
  function batchCreatedAt(b) {
    const d = addDays(todayStart(), -b.createdDaysAgo);
    const m = /-(\d{2})(\d{2})$/.exec(b.batchNumber || "");
    if (m) d.setHours(Number(m[1]), Number(m[2]), 0, 0);
    return d.toISOString();
  }

  function materialiseBatches(seed) {
    return (seed.batches || []).map((b) => ({
      _id: b._id,
      batchNumber: b.batchNumber,
      batchName: b.batchName,
      createdAt: batchCreatedAt(b),
      products: (b.products || []).map((p) => ({
        _id: p._id,
        name: p.name,
        articleNo: p.articleNo,
        unit: p.unit,
        boxes: p.boxes,
        pallets: p.pallets,
        stock: p.stock,
        remainingStock: p.remainingStock,
        manufacturingDate: addDays(todayStart(), -p.mfgDaysAgo).toISOString(),
        expiryDate: addDays(todayStart(), p.expiryInDays).toISOString(),
        price: p.price,
        tax: p.tax,
        supplierData: p.supplierData,
      })),
    }));
  }

  /* ── Shared: sort dropdown ────────────────────────────────────────────── */
  function renderSortDropdown(options, value, open, keyAttr, width) {
    const selected = options.find((o) => o.value === value) || options[0];
    return `
      <div class="relative shrink-0" data-sortroot="${keyAttr}">
        <button data-sorttoggle="${keyAttr}"
          class="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors whitespace-nowrap">
          ${selected.icon ? icon(selected.icon, "w-3.5 h-3.5 text-slate-400") : ""}
          <span class="hidden sm:inline">${esc(selected.label)}</span>
          <span class="sm:hidden">Sort</span>
          ${icon("chevronDown", `w-3.5 h-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`)}
        </button>
        ${
          open
            ? `<div class="absolute right-0 mt-1 ${width} bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                 ${options
                   .map((opt) => {
                     const isActive = opt.value === value;
                     return `<button data-sortopt="${keyAttr}" data-sortval="${esc(opt.value)}"
                       class="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-left transition-colors ${
                         isActive
                           ? "bg-emerald-50 text-emerald-700 font-semibold"
                           : "text-slate-700 hover:bg-slate-50"
                       }">
                       ${
                         opt.icon
                           ? icon(opt.icon, `w-3.5 h-3.5 shrink-0 ${isActive ? "text-emerald-500" : "text-slate-400"}`)
                           : `<span class="w-3.5 shrink-0"></span>`
                       }
                       ${esc(opt.label)}
                       ${isActive ? `<span class="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>` : ""}
                     </button>`;
                   })
                   .join("")}
               </div>`
            : ""
        }
      </div>`;
  }

  /* ── Shared: product thumbnail (DisplayImage stand-in) ────────────────── */
  // Live resolves a real product photo via productImageBaseUrl. Discovery has no
  // image host, so this renders the same-sized deterministic placeholder tile
  // DisplayImage falls back to.
  function thumb(name, size, cls) {
    const palette = ["#e2e8f0", "#dcfce7", "#dbeafe", "#fef3c7", "#fae8ff", "#ffe4e6"];
    let h = 0;
    for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const bg = palette[h % palette.length];
    const initials = (name || "?")
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    return `<span class="${cls} inline-flex items-center justify-center shrink-0 font-semibold text-slate-500"
      style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size * 0.34)}px">${esc(
      initials
    )}</span>`;
  }

  /* ── CustomPagination.jsx ─────────────────────────────────────────────── */
  function renderPagination(currentPage, totalPages, resultsPerPage, totalResults, key) {
    const pages = [];
    if (totalPages <= 6) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("left-ellipsis");
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++)
        pages.push(i);
      if (currentPage < totalPages - 2) pages.push("right-ellipsis");
      pages.push(totalPages);
    }
    const btn = (p) =>
      p === "left-ellipsis" || p === "right-ellipsis"
        ? `<span class="px-2 text-gray-500 dark:text-gray-400 font-medium">...</span>`
        : `<li><button data-pagekey="${key}" data-page="${p}" type="button"
             class="align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none px-3 py-1 rounded-md text-xs ${
               currentPage === p
                 ? "text-white bg-green-500 hover:bg-green-600"
                 : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
             }">${p}</button></li>`;
    const start = (currentPage - 1) * resultsPerPage + 1;
    const end = Math.min(currentPage * resultsPerPage, totalResults);
    return `
      <div class="flex flex-col sm:flex-row items-center justify-between px-4 py-3 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-sm">
        <span class="font-semibold tracking-wide uppercase text-xs">SHOWING ${start}–${end} OF ${totalResults}</span>
        <div class="mt-2 sm:mt-0">
          <nav aria-label="Table navigation">
            <ul class="inline-flex items-center space-x-2">
              <li><button data-pagekey="${key}" data-page="${currentPage - 1}" ${
      currentPage === 1 ? "disabled" : ""
    } class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">‹</button></li>
              ${pages.map(btn).join("")}
              <li><button data-pagekey="${key}" data-page="${currentPage + 1}" ${
      currentPage === totalPages ? "disabled" : ""
    } class="px-2 py-1 text-sm rounded-md text-gray-500 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">›</button></li>
            </ul>
          </nav>
        </div>
      </div>`;
  }

  /* ── LiveStockSection.jsx ─────────────────────────────────────────────── */
  function renderRowSkeleton(count) {
    return `<div class="divide-y divide-slate-100">
      ${Array.from({ length: count })
        .map(
          () => `<div class="flex items-center gap-3 px-5 py-3.5">
        <span class="skeleton shrink-0" style="width:36px;height:36px;border-radius:8px"></span>
        <div class="flex-1">
          <span class="skeleton block mb-1" style="width:52%;height:13px"></span>
          <span class="skeleton block" style="width:28%;height:11px"></span>
        </div>
        <span class="skeleton hidden sm:block" style="width:56px;height:13px"></span>
        <span class="skeleton hidden sm:block" style="width:56px;height:13px"></span>
        <span class="skeleton hidden sm:block" style="width:56px;height:13px"></span>
        <span class="skeleton hidden sm:block" style="width:56px;height:13px"></span>
        <span class="skeleton" style="width:72px;height:22px;border-radius:99px"></span>
      </div>`
        )
        .join("")}
    </div>`;
  }

  function outstandingBadge(value, unit) {
    if (value === 0)
      return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">Covered</span>`;
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">${value}${
      unit ? `<span class="font-normal opacity-75">${esc(unit)}</span>` : ""
    }<span>short</span></span>`;
  }

  function colInfo(id, label, definition, example) {
    return `<span class="inline-flex items-center gap-1">${esc(label)}<span data-tip="${esc(
      definition + (example ? " e.g. " + example : "")
    )}" data-tipdark="1" class="inline-flex items-center text-slate-400 hover:text-slate-500 cursor-default">${icon(
      "info",
      "w-3 h-3"
    )}</span></span>`;
  }

  function liveStockList() {
    const s = state.live;
    let list = state.products;
    if (s.search) {
      const lower = s.search.toLowerCase();
      list = list.filter(
        (p) =>
          String(p.productName || "").toLowerCase().includes(lower) ||
          String(p.articleNumber || "").toLowerCase().includes(lower)
      );
    }
    const [key, dir] = s.sort.split(":");
    const m = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (key === "name")
        return m * String(a.productName || "").localeCompare(String(b.productName || ""));
      if (key === "stock")
        return (
          m *
          (Math.max(0, a.availableStock - a.requiredStock) -
            Math.max(0, b.availableStock - b.requiredStock))
        );
      if (key === "committed")
        return (
          m *
          (Math.max(0, Math.min(a.availableStock, a.requiredStock)) -
            Math.max(0, Math.min(b.availableStock, b.requiredStock)))
        );
      if (key === "shortfall") return m * ((a.outstandingStock || 0) - (b.outstandingStock || 0));
      return 0;
    });
  }

  function renderLiveStock() {
    const s = state.live;
    const filtered = liveStockList();
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const page = Math.min(s.page, Math.max(1, totalPages));
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const unitIndex = getUnitIndex();

    const head = `
      <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex items-center gap-3">
        <div class="relative flex-1">
          <span class="absolute inset-y-0 left-1 flex items-center pointer-events-none">${icon(
            "search",
            "w-4 h-4 text-slate-400"
          )}</span>
          <input type="text" data-search="live" value="${esc(s.search)}"
            placeholder="Search by product name or article number…"
            class="w-full pl-9 pr-4 h-9 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-shadow" />
        </div>
        ${renderSortDropdown(LIVE_SORT_OPTIONS, s.sort, s.sortOpen, "live", "w-56")}
      </div>`;

    if (state.loading) return head + renderRowSkeleton(10);

    const count =
      filtered.length > 0
        ? `<div class="px-5 py-2.5 border-b border-slate-100 bg-white">
             <p class="text-xs text-slate-500">${filtered.length} product${
            filtered.length !== 1 ? "s" : ""
          } tracked</p>
           </div>`
        : "";

    if (rows.length === 0) {
      return (
        head +
        `<div class="flex flex-col items-center justify-center py-24 text-slate-400 px-4">
           <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">${icon(
             "search",
             "w-5 h-5 text-slate-400"
           )}</div>
           <p class="text-sm font-medium text-slate-600">No products found</p>
           ${
             s.search
               ? `<p class="text-xs mt-1 text-center">No results for &quot;${esc(
                   s.search
                 )}&quot; — try a different term</p>`
               : ""
           }
         </div>`
      );
    }

    const calc = (p) => {
      const displayUnit = getDisplayUnit(p, unitIndex);
      const wrap = (stock) =>
        getProductStockFromUnitIndex({ stock, boxes: p.boxes, pallets: p.pallets });
      return {
        displayUnit,
        conversionHint: displayUnitConversion({
          measurement: p.unit,
          boxes: p.boxes,
          pallets: p.pallets,
        }),
        totalStockQty: wrap(Math.max(0, p.availableStock || 0)),
        idealQty: wrap(Math.max(0, p.availableStock - p.requiredStock)),
        reservedQty: wrap(Math.max(0, Math.min(p.availableStock, p.requiredStock))),
        outstandingQty: wrap(Math.max(0, p.outstandingStock || 0)),
      };
    };

    const desktop = `
      <div class="hidden md:block">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-sm">
            <tr>
              <th class="w-14 px-5 py-3"></th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">${colInfo(
                "col-total-stock",
                "Total Stock",
                "All stock currently in warehouse/store."
              )}</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">${colInfo(
                "col-reserved",
                "Reserved",
                "Stock reserved for customer orders waiting to be delivered."
              )}</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">${colInfo(
                "col-available",
                "Available",
                "Stock ready for new sales."
              )}</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">${colInfo(
                "col-shortfall",
                "Shortfall",
                "Quantity still needed to fulfil confirmed orders — must be procured, produced, or transferred.",
                "30 boxes short; need to restock before dispatch."
              )}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${rows
              .map((p) => {
                const c = calc(p);
                return `<tr class="transition-colors ${
                  p.outstandingStock > 0 ? "bg-red-50/20 hover:bg-red-50/40" : "hover:bg-slate-50/80"
                }">
                  <td class="px-5 py-3"><div class="h-9 w-9 shrink-0">${thumb(
                    p.productName,
                    36,
                    "block rounded-custom border border-slate-100 object-cover rounded-lg"
                  )}</div></td>
                  <td class="px-4 py-3 max-w-xs">
                    <p class="font-medium text-slate-800 truncate leading-tight">${esc(p.productName)}</p>
                    <p class="text-xs text-slate-400 mt-0.5">${esc(c.displayUnit)}${
                  p.articleNumber ? `<span class="ml-1.5 text-slate-300">·</span>` : ""
                }<span class="ml-1.5 font-mono">${esc(p.articleNumber)}</span></p>
                    ${
                      c.conversionHint.length > 0
                        ? `<p class="text-xs text-slate-400 mt-0.5 italic">${esc(c.conversionHint[0])}</p>`
                        : ""
                    }
                  </td>
                  <td class="px-4 py-3 text-center"><span class="text-sm font-medium text-slate-700 tabular-nums">${
                    c.totalStockQty
                  }</span><span class="ml-1 text-xs text-slate-400">${esc(c.displayUnit)}</span></td>
                  <td class="px-4 py-3 text-center"><span class="text-sm font-medium text-slate-700 tabular-nums">${
                    c.reservedQty
                  }</span><span class="ml-1 text-xs text-slate-400">${esc(c.displayUnit)}</span></td>
                  <td class="px-4 py-3 text-center"><span class="text-sm font-medium text-slate-700 tabular-nums">${
                    c.idealQty
                  }</span><span class="ml-1 text-xs text-slate-400">${esc(c.displayUnit)}</span></td>
                  <td class="px-4 py-3 text-center">${outstandingBadge(
                    c.outstandingQty,
                    p.outstandingStock > 0 ? c.displayUnit : null
                  )}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;

    const mobile = `
      <div class="md:hidden divide-y divide-slate-100">
        ${rows
          .map((p) => {
            const c = calc(p);
            return `<div class="px-4 py-3.5 ${p.outstandingStock > 0 ? "bg-red-50/20" : ""}">
              <div class="flex items-start gap-3 mb-2.5">
                <div class="h-[38px] w-[38px] shrink-0">${thumb(
                  p.productName,
                  38,
                  "block rounded-custom border border-slate-100 object-cover rounded-lg"
                )}</div>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-slate-800 leading-tight">${esc(p.productName)}</p>
                  <p class="text-xs text-slate-400 mt-0.5">${esc(c.displayUnit)}</p>
                </div>
                ${outstandingBadge(c.outstandingQty, p.outstandingStock > 0 ? c.displayUnit : null)}
              </div>
              <div class="flex flex-wrap gap-x-5 gap-y-1 pl-[50px] text-xs">
                <span class="text-slate-500">Total Stock: <span class="font-semibold text-slate-700 tabular-nums">${
                  c.totalStockQty
                }</span> <span class="text-slate-400">${esc(c.displayUnit)}</span></span>
                <span class="text-slate-500">Reserved: <span class="font-semibold text-slate-700 tabular-nums">${
                  c.reservedQty
                }</span> <span class="text-slate-400">${esc(c.displayUnit)}</span></span>
                <span class="text-slate-500">Available: <span class="font-semibold text-slate-700 tabular-nums">${
                  c.idealQty
                }</span> <span class="text-slate-400">${esc(c.displayUnit)}</span></span>
              </div>
            </div>`;
          })
          .join("")}
      </div>`;

    const pager =
      totalPages > 1
        ? `<div class="border-t border-slate-200 bg-white">${renderPagination(
            page,
            totalPages,
            PAGE_SIZE,
            filtered.length,
            "live"
          )}</div>`
        : "";

    return head + count + desktop + mobile + pager;
  }

  /* ── StockSummarySection.jsx — "Quick Stock Upload" ───────────────────── */
  function getRow(key) {
    return Object.assign(
      { qty: "", mfgDate: "", expDate: "", saving: false, touched: {} },
      state.upload.rows[key] || {}
    );
  }

  function getRowErrors(row) {
    const errors = {};
    const qty = Number(row.qty);
    if (!row.qty || qty <= 0) errors.qty = "Enter a quantity greater than 0";
    if (!row.mfgDate) errors.mfgDate = "Manufacturing date is required";
    if (!row.expDate) errors.expDate = "Expiry date is required";
    else if (row.mfgDate && row.expDate < row.mfgDate)
      errors.expDate = "Can't be before the manufacturing date";
    return errors;
  }

  function uploadList() {
    const s = state.upload;
    let list = state.products;
    if (s.search) {
      const lower = s.search.toLowerCase();
      list = list.filter(
        (p) =>
          (p.productName || "").toLowerCase().includes(lower) ||
          (p.articleNumber || "").toLowerCase().includes(lower)
      );
    }
    const [key, dir] = s.sort.split(":");
    const m = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (key === "name")
        return m * String(a.productName || "").localeCompare(String(b.productName || ""));
      if (key === "outstanding") return m * ((a.outstandingStock || 0) - (b.outstandingStock || 0));
      return 0;
    });
  }

  function renderStockUpload() {
    const s = state.upload;
    const filtered = uploadList();
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const page = Math.min(s.page, Math.max(1, totalPages));
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const unitIndex = getUnitIndex();

    const head = `
      <div class="mb-4 flex items-center gap-2">
        <div class="relative flex-1">
          <span class="absolute inset-y-0 left-1 flex items-center pointer-events-none">${icon(
            "search",
            "w-4 h-4 text-slate-400"
          )}</span>
          <input type="text" data-search="upload" value="${esc(s.search)}"
            placeholder="Search by product name or article number…"
            class="w-full pl-9 pr-4 h-9 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
        </div>
        ${renderSortDropdown(UPLOAD_SORT_OPTIONS, s.sort, s.sortOpen, "upload", "w-52")}
      </div>`;

    if (state.loading) {
      return `<div>${head}<div class="border border-slate-200 rounded-xl overflow-hidden bg-white">${renderRowSkeleton(
        8
      )}</div></div>`;
    }

    if (rows.length === 0) {
      return `<div>${head}
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">${
            s.search ? icon("search", "w-6 h-6 text-slate-400") : icon("checkCircle", "w-7 h-7 text-emerald-500")
          }</div>
          <p class="text-sm font-semibold text-slate-700">${
            s.search ? "No products found" : "No products available"
          }</p>
          <p class="text-xs text-slate-400 mt-1.5 max-w-xs">${
            s.search
              ? `No results for "${esc(s.search)}" — try a different term`
              : "No products are available in the catalogue right now"
          }</p>
        </div></div>`;
    }

    const rowCells = (p) => {
      const key = p.articleNumber;
      const row = getRow(key);
      const touched = row.touched || {};
      const errors = getRowErrors(row);
      const displayUnit = getDisplayUnit(p, unitIndex);
      const outstandingQty = getProductStockFromUnitIndex({
        stock: p.outstandingStock,
        boxes: p.boxes,
        pallets: p.pallets,
      });
      return { key, row, touched, errors, hasRowErrors: Object.keys(errors).length > 0, displayUnit, outstandingQty };
    };

    const outstandingPill = (qty, unit) =>
      `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${
        qty === 0
          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
          : "bg-red-50 text-red-700 border-red-200"
      }">${qty}<span class="font-normal opacity-75">${esc(unit)}</span><span>short</span></span>`;

    const desktop = `
      <div class="hidden md:block border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-sm min-w-[720px]">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                <th class="w-12 px-4 py-3"></th>
                <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  <span class="inline-flex items-center gap-1.5">Outstanding${
                    s.sort === "outstanding:desc"
                      ? `<span class="inline-flex items-center gap-0.5 text-slate-400 normal-case tracking-normal font-normal text-[10px] leading-none">${icon(
                          "arrowDownWideNarrow",
                          "w-3 h-3"
                        )}highest first</span>`
                      : ""
                  }</span>
                </th>
                <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Batch Qty</th>
                <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Mfg Date</th>
                <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Exp Date</th>
                <th class="w-24 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${rows
                .map((p) => {
                  const c = rowCells(p);
                  const err = (f) =>
                    c.touched[f] && c.errors[f]
                      ? `<p class="text-[10px] leading-tight text-red-500 mt-1">${esc(c.errors[f])}</p>`
                      : "";
                  const ring = (f) =>
                    c.touched[f] && c.errors[f]
                      ? "border-red-300 focus:ring-red-400"
                      : "border-slate-200 focus:ring-emerald-400";
                  return `<tr class="hover:bg-slate-50/60 transition-colors">
                    <td class="px-4 py-2.5">${thumb(p.productName, 36, "rounded-lg block")}</td>
                    <td class="px-3 py-2.5 max-w-[180px]">
                      <p class="text-sm font-medium text-slate-800 truncate leading-tight" title="${esc(
                        p.productName
                      )}">${esc(p.productName)}</p>
                      <p class="text-xs text-slate-400 mt-0.5">${esc(c.displayUnit)}</p>
                    </td>
                    <td class="px-3 py-2.5 whitespace-nowrap">${outstandingPill(
                      c.outstandingQty,
                      c.displayUnit
                    )}</td>
                    <td class="px-3 py-2.5 align-top">
                      <div class="flex items-center gap-1.5">
                        <input type="number" min="1" data-uprow="${esc(c.key)}" data-ufield="qty" value="${esc(
                    c.row.qty
                  )}" placeholder="0"
                          class="w-20 h-8 px-2 text-sm border rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent tabular-nums ${ring(
                            "qty"
                          )}" />
                        <span class="text-xs text-slate-400 whitespace-nowrap">${esc(c.displayUnit)}</span>
                      </div>${err("qty")}
                    </td>
                    <td class="px-3 py-2.5 align-top">
                      <input type="date" data-uprow="${esc(c.key)}" data-ufield="mfgDate" value="${esc(
                    c.row.mfgDate
                  )}"
                        class="h-8 px-2 text-sm border rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent ${ring(
                          "mfgDate"
                        )}" />${err("mfgDate")}
                    </td>
                    <td class="px-3 py-2.5 align-top">
                      <input type="date" data-uprow="${esc(c.key)}" data-ufield="expDate" value="${esc(
                    c.row.expDate
                  )}"
                        class="h-8 px-2 text-sm border rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent ${ring(
                          "expDate"
                        )}" />${err("expDate")}
                    </td>
                    <td class="px-4 py-2.5 align-top">
                      <button data-usave="${esc(c.key)}" ${c.row.saving ? "disabled" : ""}
                        ${c.hasRowErrors ? 'title="Fill in the required fields to save"' : ""}
                        class="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-colors disabled:cursor-wait ${
                          c.hasRowErrors && !c.row.saving
                            ? "bg-slate-100 text-slate-400 border border-slate-200"
                            : "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-70"
                        }">
                        ${
                          c.row.saving
                            ? `<span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>`
                            : icon("save", "w-3.5 h-3.5")
                        }${c.row.saving ? "Saving…" : "Save"}
                      </button>
                    </td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>`;

    const mobile = `
      <div class="md:hidden rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm divide-y divide-slate-100">
        ${rows
          .map((p) => {
            const c = rowCells(p);
            const err = (f) =>
              c.touched[f] && c.errors[f]
                ? `<p class="text-[10px] leading-tight text-red-500 mt-1">${esc(c.errors[f])}</p>`
                : "";
            const ring = (f) =>
              c.touched[f] && c.errors[f]
                ? "border-red-300 focus:ring-red-400"
                : "border-slate-200 focus:ring-emerald-400";
            return `<div class="px-4 py-3.5">
              <div class="flex items-start gap-3 mb-3">
                ${thumb(p.productName, 38, "rounded-lg block shrink-0")}
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-slate-800 leading-tight truncate">${esc(p.productName)}</p>
                  <p class="text-xs text-slate-400 mt-0.5">${esc(c.displayUnit)}</p>
                </div>
                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border shrink-0 whitespace-nowrap ${
                  c.outstandingQty === 0
                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }">${c.outstandingQty}<span class="font-normal opacity-75">${esc(
              c.displayUnit
            )}</span><span>short</span></span>
              </div>
              <div class="mb-2.5">
                <label class="text-xs font-medium text-slate-500 mb-1 block">Batch Qty</label>
                <div class="flex items-center gap-1.5">
                  <input type="number" min="1" data-uprow="${esc(c.key)}" data-ufield="qty" value="${esc(
              c.row.qty
            )}" placeholder="0"
                    class="w-24 h-9 px-2 text-sm border rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:border-transparent tabular-nums ${ring(
                      "qty"
                    )}" />
                  <span class="text-xs text-slate-400 whitespace-nowrap">${esc(c.displayUnit)}</span>
                </div>${err("qty")}
              </div>
              <div class="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label class="text-xs font-medium text-slate-500 mb-1 block">Mfg Date</label>
                  <input type="date" data-uprow="${esc(c.key)}" data-ufield="mfgDate" value="${esc(
              c.row.mfgDate
            )}" class="w-full h-9 px-2 text-sm border rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent ${ring(
              "mfgDate"
            )}" />${err("mfgDate")}
                </div>
                <div>
                  <label class="text-xs font-medium text-slate-500 mb-1 block">Exp Date</label>
                  <input type="date" data-uprow="${esc(c.key)}" data-ufield="expDate" value="${esc(
              c.row.expDate
            )}" class="w-full h-9 px-2 text-sm border rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:border-transparent ${ring(
              "expDate"
            )}" />${err("expDate")}
                </div>
              </div>
              <button data-usave="${esc(c.key)}" ${c.row.saving ? "disabled" : ""}
                class="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-medium transition-colors disabled:cursor-wait ${
                  c.hasRowErrors && !c.row.saving
                    ? "bg-slate-100 text-slate-400 border border-slate-200"
                    : "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-70"
                }">
                ${
                  c.row.saving
                    ? `<span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>`
                    : icon("save", "w-3.5 h-3.5")
                }${c.row.saving ? "Saving…" : "Save"}
              </button>
            </div>`;
          })
          .join("")}
      </div>`;

    const pager =
      totalPages > 1
        ? `<div class="mt-4 border border-slate-200 rounded-xl bg-white overflow-hidden">${renderPagination(
            page,
            totalPages,
            PAGE_SIZE,
            filtered.length,
            "upload"
          )}</div>`
        : "";

    return `<div>${head}
      <p class="text-xs text-slate-500 mb-3 font-medium">${filtered.length} product${
      filtered.length !== 1 ? "s" : ""
    }</p>
      ${mobile}${desktop}${pager}</div>`;
  }

  /* ── InventoryHealth.jsx ──────────────────────────────────────────────── */
  function healthRows() {
    const unitIndex = getUnitIndex();
    const batchById = {};
    state.batches.forEach((b) => {
      if (b._id) batchById[b._id] = b;
    });

    return state.products
      .map((p) => {
        const pid = p._id || "";
        const articleNumber = p.articleNumber || p.articleNo || "";
        const entries = (p.batchStock || []).flatMap(({ batchId, stock, remainingStock }) => {
          const batch = batchById[batchId];
          if (!batch) return [];
          let expDate = null;
          let mfgDate = null;
          if (Array.isArray(batch.products) && batch.products.length > 0) {
            const bp = batch.products.find(
              (item) =>
                item._id === pid ||
                (articleNumber && (item.articleNo || item.articleNumber || "") === articleNumber)
            );
            expDate = (bp && (bp.expiryDate || bp.expDate)) || null;
            mfgDate = (bp && (bp.manufacturingDate || bp.mfgDate)) || null;
          }
          if (!expDate) expDate = batch.expiryDate || null;
          const rawStock = Math.max(0, Number(remainingStock != null ? remainingStock : stock) || 0);
          return [
            {
              batchId,
              batchNumber: batch.batchNumber || batch.batchName || batchId,
              rawStock,
              expDate,
              mfgDate,
            },
          ];
        });

        const displayUnit = getDisplayUnit(p, unitIndex);
        const totalStock = Math.max(0, p.availableStock || 0);
        const committedStock = Math.max(0, Math.min(totalStock, p.requiredStock || 0));
        const freeStock = Math.max(0, totalStock - committedStock);
        const wrap = (stock) =>
          getProductStockFromUnitIndex({ stock, boxes: p.boxes, pallets: p.pallets });

        return {
          articleNumber,
          productName: p.productName || articleNumber,
          _id: pid || null,
          unit: p.unit,
          boxes: p.boxes,
          pallets: p.pallets,
          displayUnit,
          stockInInventory: wrap(totalStock),
          stockOnHandDisplay: wrap(freeStock),
          committedDisplay: wrap(committedStock),
          availableStockRaw: totalStock,
          entries,
        };
      })
      .filter((row) => row.stockInInventory > 0 || row.entries.length > 0)
      .sort((a, b) => (a.productName || "").localeCompare(b.productName || ""));
  }

  function enrichedHealthRows() {
    const { timeFilter, customRange } = state.health;
    const customHasDates = timeFilter === "custom" && (customRange.from || customRange.to);
    const isFiltering = timeFilter !== "all" && (timeFilter !== "custom" || customHasDates);
    const cr = timeFilter === "custom" ? customRange : null;

    return healthRows()
      .map((row) => {
        const visibleEntries = isFiltering
          ? row.entries.filter((e) => matchesTimeFilter(e.expDate, timeFilter, cr))
          : row.entries;
        if (isFiltering && visibleEntries.length === 0) return null;

        let healthyCount = 0, nearCount = 0, expiredCount = 0;
        let healthyRaw = 0, nearRaw = 0, expiredRaw = 0;
        visibleEntries.forEach(({ expDate, rawStock }) => {
          const status = getExpiryStatus(expDate);
          const qty = Number(rawStock) || 0;
          if (status === "expired") { expiredCount++; expiredRaw += qty; }
          else if (status === "near") { nearCount++; nearRaw += qty; }
          else { healthyCount++; healthyRaw += qty; }
        });

        // Reconcile batch totals against the inventory total — batch
        // remainingStock can be stale and overstate the real figure.
        const totalRaw = Number(row.availableStockRaw) || 0;
        const batchedRaw = healthyRaw + nearRaw + expiredRaw;
        if (batchedRaw > totalRaw && batchedRaw > 0) {
          const scale = totalRaw / batchedRaw;
          healthyRaw = Math.round(healthyRaw * scale);
          nearRaw = Math.round(nearRaw * scale);
          expiredRaw = Math.round(expiredRaw * scale);
          const diff = totalRaw - (healthyRaw + nearRaw + expiredRaw);
          if (diff !== 0) {
            if (expiredRaw >= nearRaw && expiredRaw >= healthyRaw) expiredRaw += diff;
            else if (nearRaw >= healthyRaw) nearRaw += diff;
            else healthyRaw += diff;
          }
        } else if (!isFiltering) {
          const unbatchedRaw = Math.max(0, totalRaw - batchedRaw);
          if (unbatchedRaw > 0) { healthyCount++; healthyRaw += unbatchedRaw; }
        }

        const wrap = (stock) =>
          getProductStockFromUnitIndex({ stock, boxes: row.boxes, pallets: row.pallets });
        let dominantStatus = "healthy";
        if (expiredCount > 0) dominantStatus = "expired";
        else if (nearCount > 0) dominantStatus = "near";

        return Object.assign({}, row, {
          visibleEntries,
          healthyCount, nearCount, expiredCount,
          healthyStock: wrap(healthyRaw),
          nearStock: wrap(nearRaw),
          expiredStock: wrap(expiredRaw),
          dominantStatus,
        });
      })
      .filter(Boolean);
  }

  function renderExpiryFilterBar() {
    const { timeFilter, customRange } = state.health;
    const pills = TIME_FILTERS.map((f) => {
      const isActive = timeFilter === f.id;
      const styles = PILL_STYLES[f.id] || PILL_STYLES.all;
      const rangeLabel =
        f.id !== "all" && f.id !== "custom" ? getFilterRangeLabelCompact(f.id) : null;
      const customLabel =
        f.id === "custom"
          ? customRange.from || customRange.to
            ? `${toInputVal(customRange.from) || "…"} → ${toInputVal(customRange.to) || "…"}`
            : "Pick dates"
          : null;
      const showOnMobile = f.id === "custom" || isActive;
      return `<button type="button" data-timefilter="${f.id}"
        class="${showOnMobile ? "inline-flex" : "hidden md:inline-flex"} items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 leading-tight whitespace-nowrap ${
        isActive ? styles.active : `bg-white hover:bg-slate-50 ${styles.base}`
      }">
        ${!isActive && styles.dot ? `<span class="w-1.5 h-1.5 rounded-full ${styles.dot} shrink-0"></span>` : ""}
        ${esc(f.label)}
        ${
          rangeLabel || customLabel
            ? `<span class="font-normal ${isActive ? "opacity-80" : "text-slate-400"}">${esc(
                rangeLabel || customLabel
              )}</span>`
            : ""
        }
      </button>`;
    }).join("");

    const customInputs =
      timeFilter === "custom"
        ? `<div class="flex flex-wrap items-center gap-2 pt-1">
             ${icon("calendar", "w-4 h-4 text-slate-400 shrink-0")}
             <label class="flex items-center gap-1.5 text-xs text-slate-600 font-medium">From
               <input type="date" data-customrange="from" value="${toInputVal(customRange.from)}" ${
            customRange.to ? `max="${toInputVal(customRange.to)}"` : ""
          }
                 class="h-8 px-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-shadow" />
             </label>
             <span class="text-slate-300 text-sm">→</span>
             <label class="flex items-center gap-1.5 text-xs text-slate-600 font-medium">To
               <input type="date" data-customrange="to" value="${toInputVal(customRange.to)}" ${
            customRange.from ? `min="${toInputVal(customRange.from)}"` : ""
          }
                 class="h-8 px-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-shadow" />
             </label>
             ${
               customRange.from || customRange.to
                 ? `<button type="button" data-clearcustom class="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors">Clear</button>`
                 : ""
             }
           </div>`
        : "";

    return `<div class="flex flex-col gap-2"><div class="flex flex-wrap gap-1.5">${pills}</div>${customInputs}</div>`;
  }

  function stockCell(qty, unit, colorClass, lightClass) {
    if (!qty || qty <= 0) return `<span class="text-slate-300 text-xs">—</span>`;
    return `<span class="inline-flex flex-col items-center justify-center">
      <span class="text-sm font-bold tabular-nums leading-tight ${colorClass}">${qty}</span>
      <span class="text-[10px] leading-tight ${lightClass}">${esc(unit)}</span>
    </span>`;
  }

  function renderHealth() {
    const s = state.health;
    const enriched = enrichedHealthRows();
    const allRows = healthRows();
    let filtered = enriched;
    if (s.search) {
      const lower = s.search.toLowerCase();
      filtered = enriched.filter(
        (r) =>
          String(r.productName || "").toLowerCase().includes(lower) ||
          String(r.articleNumber || "").toLowerCase().includes(lower)
      );
    }
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const page = Math.min(s.page, Math.max(1, totalPages));
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const hasActiveFilter = s.timeFilter !== "all" || !!s.search;

    const head = `
      <div class="px-5 py-4 border-b border-slate-100 bg-white flex flex-col gap-3">
        <div class="flex items-center gap-2">
          <div class="relative flex-1">
            <span class="absolute inset-y-0 left-1 flex items-center pointer-events-none">${icon(
              "search",
              "w-4 h-4 text-slate-400"
            )}</span>
            <input type="text" data-search="health" value="${esc(s.search)}"
              placeholder="Search by product name or article number…"
              class="w-full pl-9 pr-4 h-9 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-shadow" />
          </div>
          ${
            hasActiveFilter
              ? `<button data-clearall aria-label="Clear all filters" title="Clear all filters"
                   class="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors md:w-auto md:h-auto md:rounded-none md:hover:bg-transparent md:px-0">
                   ${icon("x", "w-4 h-4 md:hidden")}
                   <span class="hidden md:inline text-xs underline underline-offset-2 whitespace-nowrap">Clear all</span>
                 </button>`
              : ""
          }
        </div>
        ${renderExpiryFilterBar()}
      </div>`;

    if (state.loading) return head + renderRowSkeleton(8);

    if (rows.length === 0) {
      return (
        head +
        `<div class="flex flex-col items-center justify-center py-24 text-slate-400 px-4">
           <div class="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">${icon(
             "search",
             "w-5 h-5 text-slate-400"
           )}</div>
           <p class="text-sm font-medium text-slate-600">No products found</p>
           ${
             hasActiveFilter
               ? `<p class="text-xs mt-1 text-center text-slate-400">Try adjusting your search or filters</p>`
               : ""
           }
         </div>`
      );
    }

    const count = `
      <div class="px-5 py-2 border-b border-slate-100 bg-white flex items-center gap-2">
        <span class="text-xs text-slate-500">Showing <span class="font-semibold text-slate-700">${
          filtered.length
        }</span> ${filtered.length === 1 ? "product" : "products"}${
      filtered.length !== allRows.length ? `<span class="text-slate-400"> of ${allRows.length}</span>` : ""
    }</span>
      </div>`;

    const desktop = `
      <div class="hidden md:block overflow-x-auto">
        <table class="w-full text-sm min-w-[900px]">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="w-10 px-2 py-3"></th>
              <th class="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
              <th class="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Stock in Inventory</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-emerald-600 uppercase tracking-wide whitespace-nowrap"><span class="inline-flex items-center gap-1">${icon(
                "checkCircle2",
                "w-3.5 h-3.5"
              )} Healthy</span></th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-amber-600 uppercase tracking-wide whitespace-nowrap"><span class="inline-flex items-center justify-center gap-1">${icon(
                "alertTriangle",
                "w-3.5 h-3.5"
              )} Near Expiry</span></th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-red-600 uppercase tracking-wide whitespace-nowrap"><span class="inline-flex items-center justify-center gap-1">${icon(
                "xCircle",
                "w-3.5 h-3.5"
              )} Expired</span></th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((row) => {
                const rowBg =
                  row.dominantStatus === "expired"
                    ? "bg-red-50/20 hover:bg-red-50/30"
                    : row.dominantStatus === "near"
                    ? "bg-amber-50/20 hover:bg-amber-50/30"
                    : "hover:bg-slate-50/80";
                return `<tr class="border-b border-slate-100 transition-colors ${rowBg}">
                  <td class="px-2 py-3">${thumb(row.productName, 34, "rounded-lg block")}</td>
                  <td class="px-3 py-3 max-w-[220px]">
                    <p class="font-semibold text-slate-800 truncate leading-tight">${esc(row.productName)}</p>
                    <p class="text-xs text-slate-400 mt-0.5">${esc(row.displayUnit)}${
                  row.articleNumber
                    ? `<span class="mx-1.5 text-slate-300">·</span><span class="font-mono">${esc(
                        row.articleNumber
                      )}</span>`
                    : ""
                }</p>
                  </td>
                  <td class="px-4 py-3 text-right whitespace-nowrap">
                    <span class="text-sm font-semibold text-slate-800 tabular-nums">${row.stockInInventory}</span>
                    <span class="ml-1 text-xs text-slate-400">${esc(row.displayUnit)}</span>
                    <div class="text-[10px] text-slate-400 mt-0.5 tabular-nums">${
                      row.stockOnHandDisplay
                    } on hand<span class="mx-1 text-slate-300">·</span>${row.committedDisplay} committed</div>
                  </td>
                  <td class="px-4 py-3 text-center align-middle">${stockCell(
                    row.healthyStock,
                    row.displayUnit,
                    "text-emerald-700",
                    "text-emerald-500"
                  )}</td>
                  <td class="px-4 py-3 text-center align-middle">${stockCell(
                    row.nearStock,
                    row.displayUnit,
                    "text-amber-600",
                    "text-amber-400"
                  )}</td>
                  <td class="px-4 py-3 text-center align-middle">${stockCell(
                    row.expiredStock,
                    row.displayUnit,
                    "text-red-600",
                    "text-red-400"
                  )}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;

    const mobile = `
      <div class="md:hidden divide-y divide-slate-100">
        ${rows
          .map((row) => {
            const rowBg =
              row.dominantStatus === "expired"
                ? "bg-red-50/20"
                : row.dominantStatus === "near"
                ? "bg-amber-50/20"
                : "";
            return `<div class="px-4 py-3.5 ${rowBg}">
              <div class="flex items-start gap-3 mb-2.5">
                ${thumb(row.productName, 34, "rounded-lg block shrink-0")}
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-slate-800 leading-tight">${esc(row.productName)}</p>
                  <p class="text-xs text-slate-400 mt-0.5">${esc(row.displayUnit)}<span class="mx-1.5 text-slate-300">·</span><span class="font-mono">${esc(
              row.articleNumber
            )}</span></p>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-sm font-semibold text-slate-800 tabular-nums">${row.stockInInventory}</span>
                  <span class="ml-1 text-xs text-slate-400">${esc(row.displayUnit)}</span>
                </div>
              </div>
              <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs pl-[46px]">
                <span class="text-slate-500">Healthy: <span class="font-semibold text-emerald-700 tabular-nums">${
                  row.healthyStock || "—"
                }</span></span>
                <span class="text-slate-500">Near: <span class="font-semibold text-amber-600 tabular-nums">${
                  row.nearStock || "—"
                }</span></span>
                <span class="text-slate-500">Expired: <span class="font-semibold text-red-600 tabular-nums">${
                  row.expiredStock || "—"
                }</span></span>
              </div>
            </div>`;
          })
          .join("")}
      </div>`;

    const pager =
      totalPages > 1
        ? `<div class="border-t border-slate-200 bg-white">${renderPagination(
            page,
            totalPages,
            PAGE_SIZE,
            filtered.length,
            "health"
          )}</div>`
        : "";

    return head + count + desktop + mobile + pager;
  }

  /* ── BatchDetailPanel.jsx ─────────────────────────────────────────────── */
  const fmtDate = (val) => {
    if (!val) return "—";
    const d = new Date(val);
    return isNaN(d.getTime())
      ? String(val)
      : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };
  const isExpired = (val) => !!val && new Date(val) < new Date();
  const isExpiringSoon = (val) => {
    if (!val) return false;
    const d = new Date(val);
    const now = new Date();
    return d >= now && d <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  };

  function renderBatchDetail(batch) {
    const activeTab = state.batchTab.detailTab[batch._id] || "products";
    const products = batch.products || [];
    const unitIndex = getUnitIndex();
    const totalQuantity = products.reduce(
      (sum, p) =>
        sum +
        getProductStockFromUnitIndex({
          stock: Number(p.stock) || 0,
          boxes: p.boxes,
          pallets: p.pallets,
        }),
      0
    );

    const expClass = (v) =>
      isExpired(v) ? "text-red-600 font-medium" : isExpiringSoon(v) ? "text-amber-600" : "text-slate-600";
    const expBadge = (v) =>
      isExpired(v)
        ? `<span class="px-1.5 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-600 border border-red-200">Expired</span>`
        : isExpiringSoon(v)
        ? `<span class="px-1.5 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">Expiring soon</span>`
        : "";

    const productsDesktop = `
      <div class="hidden md:block overflow-x-auto">
        ${
          products.length > 0
            ? `<table class="w-full text-sm min-w-[640px]">
                <thead>
                  <tr class="border-b border-slate-200 bg-slate-50">
                    ${["Product", "Stock", "Mfg Date", "Exp Date", "Price", "Tax"]
                      .map(
                        (h) =>
                          `<th class="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">${h}</th>`
                      )
                      .join("")}
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-100">
                  ${products
                    .map((product) => {
                      const displayUnit = getDisplayUnit(product, unitIndex);
                      const displayStock = getProductStockFromUnitIndex({
                        stock: Number(product.stock) || 0,
                        boxes: product.boxes,
                        pallets: product.pallets,
                      });
                      const exp = product.expiryDate;
                      const mfg = product.manufacturingDate;
                      return `<tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-4 py-3">
                          <div class="font-medium text-slate-900">${esc(product.name)}</div>
                          ${
                            product.articleNo
                              ? `<div class="text-xs text-slate-500 mt-0.5">${esc(product.articleNo)}</div>`
                              : ""
                          }
                        </td>
                        <td class="px-4 py-3 font-medium text-slate-800">${
                          product.stock != null ? `${displayStock} ${esc(displayUnit)}`.trim() : "—"
                        }</td>
                        <td class="px-4 py-3 text-slate-600 text-sm">${
                          mfg
                            ? `<span class="inline-flex items-center gap-1">${icon(
                                "calendar",
                                "h-3 w-3 text-slate-400 shrink-0"
                              )}${fmtDate(mfg)}</span>`
                            : "—"
                        }</td>
                        <td class="px-4 py-3 text-sm">${
                          exp
                            ? `<span class="inline-flex items-center gap-1.5 flex-wrap">${icon(
                                "calendar",
                                "h-3 w-3 text-slate-400 shrink-0"
                              )}<span class="${expClass(exp)}">${fmtDate(exp)}</span>${expBadge(exp)}</span>`
                            : "—"
                        }</td>
                        <td class="px-4 py-3 text-slate-700">${
                          product.price != null ? `₹${Number(product.price).toFixed(2)}` : "—"
                        }</td>
                        <td class="px-4 py-3 text-slate-700">${
                          product.tax != null
                            ? `${product.tax}%<span class="ml-1 px-1 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 align-middle">Excl.</span>`
                            : "—"
                        }</td>
                      </tr>`;
                    })
                    .join("")}
                </tbody>
              </table>`
            : `<div class="py-10 text-center text-sm text-slate-500">No products in this batch</div>`
        }
      </div>`;

    const productsMobile = `
      <div class="md:hidden divide-y divide-slate-100">
        ${
          products.length > 0
            ? products
                .map((product) => {
                  const displayUnit = getDisplayUnit(product, unitIndex);
                  const displayStock = getProductStockFromUnitIndex({
                    stock: Number(product.stock) || 0,
                    boxes: product.boxes,
                    pallets: product.pallets,
                  });
                  const exp = product.expiryDate;
                  const mfg = product.manufacturingDate;
                  return `<div class="px-4 py-3">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="font-medium text-slate-900 text-sm truncate">${esc(product.name)}</div>
                        ${
                          product.articleNo
                            ? `<div class="text-xs text-slate-500 mt-0.5">${esc(product.articleNo)}</div>`
                            : ""
                        }
                      </div>
                      <div class="text-sm font-medium text-slate-800 shrink-0 whitespace-nowrap">${
                        product.stock != null ? `${displayStock} ${esc(displayUnit)}`.trim() : "—"
                      }</div>
                    </div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-600">
                      <span class="inline-flex items-center gap-1">${icon(
                        "calendar",
                        "h-3 w-3 text-slate-400 shrink-0"
                      )}Mfg: ${mfg ? fmtDate(mfg) : "—"}</span>
                      <span class="inline-flex items-center gap-1 flex-wrap">${icon(
                        "calendar",
                        "h-3 w-3 text-slate-400 shrink-0"
                      )}Exp: <span class="${expClass(exp)}">${exp ? fmtDate(exp) : "—"}</span>${expBadge(exp)}</span>
                    </div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-600">
                      <span>Price: ${product.price != null ? `₹${Number(product.price).toFixed(2)}` : "—"}</span>
                      <span>Tax: ${
                        product.tax != null
                          ? `${product.tax}%<span class="ml-1 px-1 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 align-middle">Excl.</span>`
                          : "—"
                      }</span>
                    </div>
                    ${
                      product.supplierData && product.supplierData.name
                        ? `<div class="mt-1.5 text-xs"><span class="font-medium text-slate-700">${esc(
                            product.supplierData.name
                          )}</span>${
                            product.supplierData.contact
                              ? `<span class="inline-flex items-center gap-1 text-slate-500 ml-2">${icon(
                                  "phone",
                                  "h-3 w-3"
                                )}${esc(product.supplierData.contact)}</span>`
                              : ""
                          }</div>`
                        : ""
                    }
                  </div>`;
                })
                .join("")
            : `<div class="py-10 text-center text-sm text-slate-500">No products in this batch</div>`
        }
      </div>`;

    const supplierMap = new Map();
    products.forEach((p) => {
      if (p.supplierData && p.supplierData.name && !supplierMap.has(p.supplierData.name))
        supplierMap.set(p.supplierData.name, p.supplierData);
    });
    const uniqueSuppliers = Array.from(supplierMap.values());

    const summary = `
      <div class="px-4 py-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span class="inline-flex items-center gap-1.5 text-slate-600 text-xs font-medium bg-slate-100 px-2.5 py-1 rounded-full">${
          products.length
        } product${products.length !== 1 ? "s" : ""}</span>
        <span class="inline-flex items-center gap-1.5 text-slate-600"><span class="text-slate-400 text-sm">Stock</span><span class="font-semibold text-slate-800">${totalQuantity}</span></span>
        ${
          batch.createdAt
            ? `<span class="text-slate-500 text-sm">${new Date(batch.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}</span>`
            : ""
        }
        ${
          uniqueSuppliers.length > 0
            ? `<span class="inline-flex items-center gap-1.5 text-slate-600">${icon(
                "truck",
                "h-3.5 w-3.5 text-emerald-500 shrink-0"
              )}<span class="font-medium text-slate-800">${uniqueSuppliers
                .map((s, i) => `${esc(s.name)}${s.contact ? " · " + esc(s.contact) : ""}${i < uniqueSuppliers.length - 1 ? ", " : ""}`)
                .join("")}</span></span>`
            : ""
        }
      </div>`;

    const tabBtn = (id, label, iconName, count) => `
      <button data-detailtab="${esc(batch._id)}" data-detailtabid="${id}"
        class="px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
          activeTab === id ? "border-emerald-500 text-emerald-600" : "border-transparent text-slate-500 hover:text-slate-700"
        }">
        <div class="flex items-center gap-2">${icon(iconName, "", 16)}${label}${
      count != null
        ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">${count}</span>`
        : ""
    }</div>
      </button>`;

    return `
      <div class="border-t border-slate-200 bg-white">
        <div class="flex border-b border-slate-200 bg-slate-50 px-4">
          ${tabBtn("products", "Products", "shoppingBag", products.length)}
          ${tabBtn("summary", "Summary", "fileText", null)}
        </div>
        <div class="bg-white border-t border-slate-100">
          ${activeTab === "products" ? productsMobile + productsDesktop : summary}
        </div>
      </div>`;
  }

  /* ── Batch History tab (Inventory.jsx) ────────────────────────────────── */
  function batchListForRoute() {
    // Live: /inventory strips raw-material products out of every batch and drops
    // batches left empty; /raw-material-inventory keeps only raw-material lines.
    const rmIds = new Set((state.seed.stockSummary["RAW-MATERIAL"] || []).map((p) => String(p._id)));
    const keepRaw = state.catalogueType === "RAW-MATERIAL";
    return state.batches
      .map((b) =>
        Object.assign({}, b, {
          products: (b.products || []).filter((p) =>
            keepRaw ? rmIds.has(String(p._id)) : !rmIds.has(String(p._id))
          ),
        })
      )
      .filter((b) => b.products.length > 0)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function renderBatches() {
    const s = state.batchTab;
    let list = batchListForRoute();
    if (s.search) {
      const lower = s.search.toLowerCase();
      list = list.filter(
        (b) =>
          (b.batchNumber || "").toLowerCase().includes(lower) ||
          (b.products || []).some((p) => (p.name || "").toLowerCase().includes(lower))
      );
    }
    const totalPages = Math.ceil(list.length / BATCH_PAGE_SIZE);
    const page = Math.min(s.page, Math.max(1, totalPages));
    const rows = list.slice((page - 1) * BATCH_PAGE_SIZE, page * BATCH_PAGE_SIZE);

    const fmtD = (val) =>
      !val ? null : new Date(val).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    const fmtT = (val) =>
      !val ? null : new Date(val).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    const search = `
      <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/30">
        <div class="relative">
          <span class="absolute inset-y-0 left-1 flex items-center pointer-events-none">${icon(
            "search",
            "h-4 w-4 text-slate-400"
          )}</span>
          <input type="search" data-search="batches" value="${esc(s.search)}"
            class="w-full pl-9 pr-4 h-9 text-sm border border-slate-200 rounded-lg bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
            placeholder="Search by batch number or product…" />
        </div>
      </div>`;

    if (state.loading) {
      return (
        search +
        `<div class="p-5"><div class="${WM.tableContainer} mb-8"><div class="text-center">${Array.from({
          length: 10,
        })
          .map(
            () =>
              `<div>${Array.from({ length: 4 })
                .map(() => `<span class="skeleton mx-1 my-1" style="height:20px;width:160px"></span>`)
                .join("")}</div>`
          )
          .join("")}</div></div></div>`
      );
    }

    if (rows.length === 0) {
      return (
        search +
        `<div class="p-5"><div class="text-center align-middle mx-auto p-5 my-5">
           <h2 class="text-lg md:text-xl lg:text-2xl xl:text-2xl text-center mt-2 font-medium font-serif text-gray-600">We're sorry, but no batches are available at the moment.</h2>
         </div></div>`
      );
    }

    const copyBtn = (bn, small) =>
      `<button data-copy="${esc(bn)}" class="${
        small ? "p-1 rounded hover:bg-slate-200 shrink-0 transition-colors" : "p-1 rounded-md hover:bg-slate-100 transition-colors"
      }" aria-label="Copy batch number" title="${s.copied === bn ? "Copied!" : "Copy"}">${
        s.copied === bn
          ? icon("check", "w-3.5 h-3.5 text-emerald-500")
          : icon("copy", "w-3.5 h-3.5 text-slate-400")
      }</button>`;

    const mobile = `
      <div class="md:hidden rounded-xl border border-slate-200 overflow-hidden mb-4">
        <div class="divide-y divide-slate-100">
          ${rows
            .map((batch) => {
              const isExpanded = s.expanded.includes(batch._id);
              return `
              <div data-toggle="${esc(batch._id)}" class="flex items-center justify-between px-4 py-3.5 bg-white hover:bg-slate-50 cursor-pointer select-none transition-colors">
                <div class="flex items-center gap-2 min-w-0">
                  ${icon(isExpanded ? "chevronUp" : "chevronDown", "w-4 h-4 text-slate-500 shrink-0")}
                  <span class="text-sm font-semibold text-slate-900 font-mono truncate tracking-tight">${esc(
                    batch.batchNumber
                  )}</span>
                  ${copyBtn(batch.batchNumber, true)}
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0 ml-2">
                  <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">${
                    batch.products.length
                  } item${batch.products.length !== 1 ? "s" : ""}</span>
                  <span class="text-xs text-slate-400">${fmtD(batch.createdAt)}</span>
                </div>
              </div>
              ${isExpanded ? `<div class="bg-slate-50">${renderBatchDetail(batch)}</div>` : ""}`;
            })
            .join("")}
        </div>
      </div>`;

    const desktop = `
      <div class="${WM.tableContainer} hidden md:block mb-4 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="w-full overflow-x-auto">
          <table class="w-full whitespace-nowrap">
            <thead class="bg-slate-50 border-b border-slate-200">
              <tr>
                ${["Batch ID", "Items", "Created"]
                  .map(
                    (h) =>
                      `<td class="${WM.tableCell} py-3 px-5"><span class="text-xs font-semibold text-slate-500 uppercase tracking-wide">${h}</span></td>`
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>
              ${rows
                .map((batch) => {
                  const isExpanded = s.expanded.includes(batch._id);
                  return `<tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                    <td class="${WM.tableCell} py-3.5 px-5">
                      <div class="flex items-center gap-2">
                        <button data-toggle="${esc(batch._id)}" class="p-1.5 -ml-1 hover:bg-slate-100 rounded-lg transition-colors" aria-label="${
                    isExpanded ? "Collapse" : "Expand"
                  }">${icon(isExpanded ? "chevronUp" : "chevronDown", "w-4 h-4 text-slate-500")}</button>
                        <span class="text-sm font-semibold text-slate-900 tracking-tight font-mono">${esc(
                          batch.batchNumber
                        )}</span>
                        ${copyBtn(batch.batchNumber, false)}
                      </div>
                    </td>
                    <td class="${WM.tableCell} py-3.5 px-5"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">${
                    batch.products.length
                  }</span></td>
                    <td class="${WM.tableCell} py-3.5 px-5">
                      <div><p class="text-sm text-slate-700">${fmtD(batch.createdAt)}</p>
                      <p class="text-xs text-slate-400 mt-0.5">${fmtT(batch.createdAt)}</p></div>
                    </td>
                  </tr>
                  ${
                    isExpanded
                      ? `<tr class="bg-slate-50/50"><td colspan="3" class="${WM.tableCell} p-0">${renderBatchDetail(
                          batch
                        )}</td></tr>`
                      : ""
                  }`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
        <div class="${WM.tableFooter}">${renderPagination(
      page,
      totalPages,
      BATCH_PAGE_SIZE,
      list.length,
      "batches"
    )}</div>
      </div>
      <div class="md:hidden border border-slate-200 rounded-xl bg-white overflow-hidden">${renderPagination(
        page,
        totalPages,
        BATCH_PAGE_SIZE,
        list.length,
        "batches"
      )}</div>`;

    return search + `<div class="p-5">${mobile}${desktop}</div>`;
  }

  /* ── LowStockSection.jsx — /raw-material-inventory tab 2 ──────────────── */
  function lowStockList() {
    const s = state.low;
    // Only products with a Reorder Level set AND currently at or below it.
    let list = state.products
      .filter(
        (p) =>
          p.stockThreshold !== null &&
          p.stockThreshold !== undefined &&
          (p.availableStock || 0) <= p.stockThreshold
      )
      .map((p) =>
        Object.assign({}, p, {
          needToOrder: Math.max(0, (p.stockThreshold || 0) - (p.availableStock || 0)),
        })
      );

    if (s.search) {
      const lower = s.search.toLowerCase();
      list = list.filter(
        (p) =>
          String(p.productName || "").toLowerCase().includes(lower) ||
          String(p.articleNumber || "").toLowerCase().includes(lower)
      );
    }
    const [key, dir] = s.sort.split(":");
    const m = dir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      if (key === "name")
        return m * String(a.productName || "").localeCompare(String(b.productName || ""));
      if (key === "needToOrder") return m * (a.needToOrder - b.needToOrder);
      if (key === "availableStock") return m * ((a.availableStock || 0) - (b.availableStock || 0));
      // "critical" — how far below the reorder level, proportionally, highest first
      const aR = a.stockThreshold > 0 ? a.needToOrder / a.stockThreshold : a.needToOrder;
      const bR = b.stockThreshold > 0 ? b.needToOrder / b.stockThreshold : b.needToOrder;
      return bR - aR;
    });
  }

  function checkbox(id, checked) {
    return `<input type="checkbox" id="${esc(id)}" name="${esc(id)}" data-lowsel="${esc(id)}" ${
      checked ? "checked" : ""
    } class="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />`;
  }

  function renderLowStock() {
    const s = state.low;
    const filtered = lowStockList();
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const page = Math.min(s.page, Math.max(1, totalPages));
    const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const unitIndex = getUnitIndex();
    const selCount = s.selected.length;
    const pageFullySelected =
      rows.length > 0 && rows.every((p) => s.selected.includes(String(p._id)));

    const head = `
      <div class="px-5 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div class="relative flex-1">
          <span class="absolute inset-y-0 left-1 flex items-center pointer-events-none">${icon(
            "search",
            "w-4 h-4 text-slate-400"
          )}</span>
          <input type="text" data-search="low" value="${esc(s.search)}"
            placeholder="Search by product name or article number…"
            class="w-full pl-9 pr-4 h-9 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-shadow" />
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${renderSortDropdown(LOW_SORT_OPTIONS, s.sort, s.sortOpen, "low", "w-56")}
          ${
            filtered.length > 0
              ? `<button data-createpo ${selCount === 0 ? "disabled" : ""} ${
                  selCount === 0 ? 'title="Select one or more raw materials first"' : ""
                }
                 class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium transition-colors shadow-sm whitespace-nowrap ${
                   selCount === 0
                     ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                     : "bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800"
                 }">${icon("shoppingCart", "w-3.5 h-3.5")}Create Purchase Order${
                  selCount > 0 ? ` (${selCount})` : ""
                }</button>`
              : ""
          }
        </div>
      </div>`;

    if (state.loading) return head + renderRowSkeleton(8);

    if (rows.length === 0) {
      return (
        head +
        `<div class="flex flex-col items-center justify-center py-24 text-slate-400 px-4">
           <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mb-3">${icon(
             "search",
             "w-5 h-5 text-emerald-400"
           )}</div>
           <p class="text-sm font-medium text-slate-600">${
             s.search ? "No matching raw materials" : "Nothing is low on stock"
           }</p>
           ${
             s.search
               ? `<p class="text-xs mt-1 text-center">No results for &quot;${esc(
                   s.search
                 )}&quot; — try a different term</p>`
               : `<p class="text-xs mt-1 text-center max-w-xs">Set a Reorder Level on a raw material (in Add/Edit Raw Material) to start tracking it here.</p>`
           }
         </div>`
      );
    }

    const count = `
      <div class="px-5 py-2.5 border-b border-slate-100 bg-white">
        <p class="text-xs text-slate-500">${filtered.length} raw material${
      filtered.length !== 1 ? "s" : ""
    } at or below their reorder level</p>
      </div>`;

    const calc = (p) => {
      const displayUnit = getDisplayUnit(p, unitIndex);
      const wrap = (stock) =>
        getProductStockFromUnitIndex({ stock, boxes: p.boxes, pallets: p.pallets }, unitIndex);
      return {
        displayUnit,
        available: wrap(Math.max(0, p.availableStock || 0)),
        threshold: wrap(Math.max(0, p.stockThreshold || 0)),
        need: wrap(Math.max(0, p.needToOrder || 0)),
      };
    };

    const needBadge = (v, unit) =>
      `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">${v}${
        unit ? `<span class="font-normal opacity-75">${esc(unit)}</span>` : ""
      }</span>`;

    const restockBtn = (id, extra) =>
      `<button type="button" data-restock="${esc(id)}"
        class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-50 active:bg-emerald-100 transition-colors whitespace-nowrap ${
          extra || ""
        }">${icon("refreshCw", "w-3 h-3")}Restock</button>`;

    const desktop = `
      <div class="hidden md:block">
        <table class="w-full text-sm">
          <thead class="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 shadow-sm">
            <tr>
              <th class="w-10 pl-5 pr-1 py-3">${checkbox("selectAllLowStock", pageFullySelected)}</th>
              <th class="w-14 px-2 py-3"></th>
              <th class="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">${colInfo(
                "col-available-stock",
                "Available Stock",
                "Stock currently on hand for this raw material."
              )}</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">${colInfo(
                "col-reorder-level",
                "Reorder Level",
                "The stock level you set for this raw material — when available stock drops to or below this, it shows up here."
              )}</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">${colInfo(
                "col-need-to-order",
                "Need to Order",
                "How much more you need to bring stock back up to the Reorder Level."
              )}</th>
              <th class="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${rows
              .map((p) => {
                const c = calc(p);
                const pid = String(p._id);
                return `<tr class="bg-red-50/20 hover:bg-red-50/40 transition-colors">
                  <td class="pl-5 pr-1 py-3">${checkbox("select-" + pid, s.selected.includes(pid))}</td>
                  <td class="px-2 py-3">${thumb(p.productName, 36, "rounded-lg block")}</td>
                  <td class="px-4 py-3 max-w-xs">
                    <p class="font-medium text-slate-800 truncate leading-tight">${esc(p.productName)}</p>
                    <p class="text-xs text-slate-400 mt-0.5">${esc(c.displayUnit)}<span class="ml-1.5 text-slate-300">·</span><span class="ml-1.5 font-mono">${esc(
                  p.articleNumber
                )}</span></p>
                  </td>
                  <td class="px-4 py-3 text-center"><span class="text-sm font-medium text-slate-700 tabular-nums">${
                    c.available
                  }</span><span class="ml-1 text-xs text-slate-400">${esc(c.displayUnit)}</span></td>
                  <td class="px-4 py-3 text-center"><span class="text-sm font-medium text-slate-700 tabular-nums">${
                    c.threshold
                  }</span><span class="ml-1 text-xs text-slate-400">${esc(c.displayUnit)}</span></td>
                  <td class="px-4 py-3 text-center">${needBadge(c.need, c.displayUnit)}</td>
                  <td class="px-4 py-3 text-center">${restockBtn(pid)}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;

    const mobile = `
      <div class="md:hidden divide-y divide-slate-100">
        ${rows
          .map((p) => {
            const c = calc(p);
            const pid = String(p._id);
            return `<div class="px-4 py-3.5 bg-red-50/20">
              <div class="flex items-start gap-3 mb-2.5">
                <span class="pt-1">${checkbox("m-select-" + pid, s.selected.includes(pid))}</span>
                ${thumb(p.productName, 38, "rounded-lg block shrink-0")}
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-slate-800 leading-tight">${esc(p.productName)}</p>
                  <p class="text-xs text-slate-400 mt-0.5">${esc(c.displayUnit)}</p>
                </div>
                ${needBadge(c.need, c.displayUnit)}
              </div>
              <div class="flex flex-wrap items-center gap-x-5 gap-y-1 pl-[26px] text-xs">
                <span class="text-slate-500">Available: <span class="font-semibold text-slate-700 tabular-nums">${
                  c.available
                }</span> <span class="text-slate-400">${esc(c.displayUnit)}</span></span>
                <span class="text-slate-500">Reorder at: <span class="font-semibold text-slate-700 tabular-nums">${
                  c.threshold
                }</span> <span class="text-slate-400">${esc(c.displayUnit)}</span></span>
                ${restockBtn(pid, "ml-auto")}
              </div>
            </div>`;
          })
          .join("")}
      </div>`;

    const pager =
      totalPages > 1
        ? `<div class="border-t border-slate-200 bg-white">${renderPagination(
            page,
            totalPages,
            PAGE_SIZE,
            filtered.length,
            "low"
          )}</div>`
        : "";

    return head + count + desktop + mobile + pager;
  }

  /* ── AddBatchDrawer.jsx — "Receive Stock" ─────────────────────────────── */
  function drawerProductPool() {
    const key = state.catalogueType === "RAW-MATERIAL" ? "RAW-MATERIAL" : "FINISHED-GOODS";
    const byId = {};
    (state.seed.stockSummary[key] || []).forEach((p) => (byId[p._id] = p));
    return { byId, categories: (state.seed.categoryTree || {})[key] || [] };
  }

  function renderAddBatchDrawer() {
    const d = state.drawer;
    const { byId, categories } = drawerProductPool();
    const search = (d.productSearch || "").toLowerCase();

    // LEFT — category accordion with product checkboxes (ProductSelectionModal)
    const left = categories
      .map((cat) => {
        const prods = cat.productIds.map((id) => byId[id]).filter(Boolean);
        const visible = search
          ? prods.filter(
              (p) =>
                p.productName.toLowerCase().includes(search) ||
                p.articleNumber.toLowerCase().includes(search)
            )
          : prods;
        if (search && visible.length === 0) return "";
        const open = d.openCategories.includes(cat._id) || !!search;
        return `
          <div class="border-b border-gray-100 last:border-b-0">
            <button data-cat="${esc(cat._id)}"
              class="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              <span class="flex items-center gap-2 min-w-0">
                ${icon(open ? "chevronUp" : "chevronDown", "w-4 h-4 text-gray-400 shrink-0")}
                <span class="truncate">${esc(cat.name)}</span>
              </span>
              <span class="text-xs text-gray-400 shrink-0">${visible.length}</span>
            </button>
            ${
              open
                ? `<div class="pb-1">${visible
                    .map((p) => {
                      const checked = d.selected.some((s) => s._id === p._id);
                      return `<label class="flex items-center gap-2.5 px-4 py-1.5 pl-9 cursor-pointer hover:bg-emerald-50/50 transition-colors">
                        <input type="checkbox" data-pickprod="${esc(p._id)}" ${checked ? "checked" : ""}
                          class="peer h-4 w-4 shrink-0 rounded-sm border border-primary focus-visible:outline-none" />
                        <span class="min-w-0 flex-1">
                          <span class="block text-sm text-gray-700 truncate">${esc(p.productName)}</span>
                          <span class="block text-xs text-gray-400 font-mono">${esc(p.articleNumber)}</span>
                        </span>
                      </label>`;
                    })
                    .join("")}</div>`
                : ""
            }
          </div>`;
      })
      .join("");

    // RIGHT — the batch matrix
    const suppliers = state.seed.suppliers || [];
    const matrixRow = (p, i) => {
      const supplier = suppliers.find((s) => s.name === p.supplierId);
      const menuOpen = d.supplierMenuFor === p._id;
      return `
        <tr class="border-b border-gray-100 hover:bg-gray-50/60">
          <td class="px-3 py-2.5 min-w-[180px]">
            <p class="text-sm font-medium text-gray-800 truncate">${esc(p.productName)}</p>
            <p class="text-xs text-gray-400 font-mono mt-0.5">${esc(p.articleNumber)}</p>
          </td>
          <td class="px-3 py-2.5">
            <div class="flex items-center gap-1.5">
              <input type="number" min="1" data-mrow="${esc(p._id)}" data-mfield="qty" value="${esc(p.qty)}" placeholder="0"
                class="w-20 h-8 px-2 text-sm border rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent tabular-nums ${
                  state.drawer.invalid && !p.qty ? "border-red-300" : "border-gray-200"
                }" />
              <span class="text-xs text-gray-400 whitespace-nowrap">${esc(getDisplayUnit(p))}</span>
            </div>
          </td>
          <td class="px-3 py-2.5">
            <input type="date" data-mrow="${esc(p._id)}" data-mfield="mfgDate" value="${esc(p.mfgDate)}"
              class="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
          </td>
          <td class="px-3 py-2.5">
            <input type="date" data-mrow="${esc(p._id)}" data-mfield="expDate" value="${esc(p.expDate)}"
              class="h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
          </td>
          <td class="px-3 py-2.5">
            <input type="number" min="0" step="0.01" data-mrow="${esc(p._id)}" data-mfield="price" value="${esc(p.price)}" placeholder="0.00"
              class="w-24 h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent tabular-nums" />
          </td>
          <td class="px-3 py-2.5">
            <input type="number" min="0" data-mrow="${esc(p._id)}" data-mfield="tax" value="${esc(p.tax)}" placeholder="0"
              class="w-16 h-8 px-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent tabular-nums" />
          </td>
          <td class="px-3 py-2.5 relative min-w-[170px]">
            <button data-suppliertoggle="${esc(p._id)}"
              class="w-full inline-flex items-center justify-between gap-1.5 h-8 px-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors">
              <span class="truncate ${supplier ? "" : "text-gray-400"}">${
        supplier ? esc(supplier.name) : "Select supplier"
      }</span>
              ${icon("chevronDown", "w-3.5 h-3.5 text-gray-400 shrink-0")}
            </button>
            ${
              menuOpen
                ? `<div class="absolute right-3 left-3 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 py-1 max-h-56 overflow-auto">
                     ${suppliers
                       .map(
                         (s) =>
                           `<button data-pickSupplier="${esc(p._id)}" data-suppliername="${esc(
                             s.name
                           )}" class="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 ${
                             supplier && supplier.name === s.name
                               ? "bg-emerald-50 text-emerald-700 font-semibold"
                               : "text-gray-700"
                           }">${esc(s.name)}<span class="block text-[10px] text-gray-400">${esc(
                             s.contact
                           )}</span></button>`
                       )
                       .join("")}
                     <button data-addsupplier="${esc(p._id)}"
                       class="w-full text-left px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border-t border-gray-100 flex items-center gap-1.5">
                       ${icon("plus", "text-blue-700 flex-shrink-0", 13)}Add new supplier
                     </button>
                   </div>`
                : ""
            }
          </td>
          <td class="px-3 py-2.5 text-right">
            <button data-mremove="${esc(p._id)}" class="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors" aria-label="Remove">
              ${icon("trash", "w-3.5 h-3.5")}
            </button>
          </td>
        </tr>`;
    };

    const right =
      d.selected.length > 0
        ? `
        <div class="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shadow-sm overflow-hidden">
          <h2 class="text-base font-semibold flex items-center gap-2 text-gray-800 min-w-0 truncate mr-4">
            ${icon("package", "w-5 h-5 text-gray-500 flex-shrink-0")}
            <span class="truncate">Product Batch Matrix (${d.selected.length} Products)</span>
          </h2>
        </div>
        <div class="flex-1 min-h-0 overflow-auto">
          <table class="w-full text-sm min-w-[900px]">
            <thead class="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                ${["Product", "Quantity", "Mfg Date", "Exp Date", "Price", "Tax %", "Supplier", ""]
                  .map(
                    (h) =>
                      `<th class="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">${h}</th>`
                  )
                  .join("")}
              </tr>
            </thead>
            <tbody>${d.selected.map(matrixRow).join("")}</tbody>
          </table>
        </div>
        <div class="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button data-copytoall
            class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-gray-600 text-xs font-medium hover:bg-gray-50 transition-colors">
            ${icon("copy", "w-3.5 h-3.5")}Copy first row's dates to all
          </button>
          <button data-preview
            class="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm">
            ${icon("packagePlus", "w-4 h-4")}Preview &amp; Create Batch
          </button>
        </div>`
        : `<div class="flex-1 flex flex-col items-center justify-center text-gray-400 px-6 py-16 text-center">
             <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">${icon(
               "package",
               "w-7 h-7 text-gray-400"
             )}</div>
             <p class="text-sm font-medium text-gray-600">No products selected</p>
             <p class="text-xs mt-1.5 max-w-xs">Pick one or more products on the left to start building this batch.</p>
           </div>`;

    const previewModal = d.previewOpen
      ? `<div class="fixed inset-0 z-[10080] flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center mock-backdrop is-open" data-previewbackdrop>
           <div class="w-full px-6 py-4 overflow-hidden bg-white rounded-t-lg sm:rounded-lg sm:m-4 sm:max-w-3xl custom-modal mock-modal" role="dialog" aria-modal="true">
             <h1 class="text-base font-semibold text-gray-900 mb-1">Preview batch</h1>
             <p class="text-sm text-gray-500 mb-4">${d.selected.length} product${
          d.selected.length !== 1 ? "s" : ""
        } will be received into stock.</p>
             <div class="max-h-80 overflow-auto border border-gray-200 rounded-lg">
               <table class="w-full text-sm">
                 <thead class="bg-gray-50 border-b border-gray-200 sticky top-0">
                   <tr>${["Product", "Qty", "Mfg", "Exp", "Supplier"]
                     .map(
                       (h) =>
                         `<th class="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">${h}</th>`
                     )
                     .join("")}</tr>
                 </thead>
                 <tbody class="divide-y divide-gray-100">
                   ${d.selected
                     .map(
                       (p) => `<tr>
                     <td class="px-3 py-2 text-gray-800">${esc(p.productName)}</td>
                     <td class="px-3 py-2 tabular-nums">${esc(p.qty || "—")} ${esc(getDisplayUnit(p))}</td>
                     <td class="px-3 py-2 text-gray-600">${p.mfgDate ? fmtDate(p.mfgDate) : "—"}</td>
                     <td class="px-3 py-2 text-gray-600">${p.expDate ? fmtDate(p.expDate) : "—"}</td>
                     <td class="px-3 py-2 text-gray-600">${esc(p.supplierId || "—")}</td>
                   </tr>`
                     )
                     .join("")}
                 </tbody>
               </table>
             </div>
             <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
               <button data-previewcancel class="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
               <button data-createbatch ${d.creating ? "disabled" : ""}
                 class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-70">
                 ${
                   d.creating
                     ? `<span class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>Creating…`
                     : "Create Batch"
                 }
               </button>
             </div>
           </div>
         </div>`
      : "";

    const supplierStub = d.supplierStubFor
      ? `<div class="fixed inset-0 z-[10090] flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center mock-backdrop is-open" data-stubbackdrop>
           <div class="w-full px-6 py-4 overflow-hidden bg-white rounded-t-lg sm:rounded-lg sm:m-4 sm:max-w-md custom-modal mock-modal" role="dialog" aria-modal="true">
             <div class="w-full text-center">
               <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">${icon(
                 "info",
                 "h-5 w-5 text-slate-500"
               )}</span>
               <h1 class="text-base font-semibold text-gray-900">Not ported in this round</h1>
               <p class="mt-1.5 text-sm text-gray-500">The live <code>AddSupplierModal</code> is a separate
                 879-line supplier CRUD form nested three levels deep. Selecting an existing supplier is
                 fully ported; creating one is out of scope for this discovery round.</p>
               <div class="mt-6"><button data-stubclose class="inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button></div>
             </div>
           </div>
         </div>`
      : "";

    const discardModal = d.discardOpen
      ? `<div class="fixed inset-0 z-[10085] flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center mock-backdrop is-open">
           <div class="w-full px-6 py-4 overflow-hidden bg-white rounded-t-lg sm:rounded-lg sm:m-4 sm:max-w-xl custom-modal mock-modal" role="dialog" aria-modal="true">
             <div class="w-full text-center">
               <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">${icon(
                 "alertTriangle",
                 "h-5 w-5 text-amber-600"
               )}</span>
               <h1 class="text-base font-semibold text-gray-900">Discard Changes</h1>
               <p class="mt-1.5 text-sm text-gray-500">Are you sure you want to discard the changes ?</p>
               <div class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center sm:gap-3">
                 <button data-drawerwait class="inline-flex h-10 w-full items-center justify-center rounded-md border border-gray-300 bg-white px-5 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:w-auto">No, Wait</button>
                 <button data-drawerdiscard class="inline-flex h-10 w-full items-center justify-center rounded-md bg-amber-600 px-5 text-sm font-medium text-white hover:bg-amber-700 sm:w-auto">Yes, Discard</button>
               </div>
             </div>
           </div>
         </div>`
      : "";

    return `
      <div class="rc-drawer ${d.open ? "is-open" : ""}" ${d.open ? "" : "hidden"} data-batchdrawer>
        <div class="rc-drawer-mask" data-drawermask></div>
        <div class="rc-drawer-content">
          <button data-drawerclose aria-label="Close drawer"
            class="absolute focus:outline-none z-10 text-red-500 hover:bg-red-100 hover:text-gray-700 transition-colors duration-150 bg-white shadow-md mr-6 right-0 left-auto w-10 h-10 rounded-full block text-center"
            style="top:1.5rem">${icon("x", "mx-auto")}</button>

          <div class="flex flex-col w-full h-full overflow-hidden">
            <div class="flex-shrink-0 w-full relative px-6 py-4 border-b border-gray-100 bg-gray-50">
              <div class="flex md:flex-row flex-col justify-between mr-20">
                <div>
                  <h4 class="text-xl font-medium">Bulk Add Batch</h4>
                  <p class="mb-0 text-sm">Select products and configure batch details</p>
                </div>
              </div>
            </div>

            <div class="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden md:gap-x-3 md:px-3 md:py-3">
              <div class="flex-shrink-0 w-full h-[42vh] md:h-auto md:w-[300px] lg:w-[340px] xl:w-[380px] border-b md:border-b-0 md:border md:rounded-lg border-gray-200 flex flex-col overflow-hidden bg-white">
                <div class="flex-shrink-0 p-3 border-b border-gray-100">
                  <div class="relative">
                    <span class="absolute inset-y-0 left-1 flex items-center pointer-events-none">${icon(
                      "search",
                      "w-4 h-4 text-gray-400"
                    )}</span>
                    <input type="text" data-prodsearch value="${esc(d.productSearch)}" placeholder="Search products…"
                      class="w-full pl-9 pr-3 h-9 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent" />
                  </div>
                </div>
                <div class="flex-1 overflow-y-auto">${left || '<p class="px-4 py-6 text-sm text-gray-400 text-center">No products match that search.</p>'}</div>
              </div>

              <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-white md:border md:rounded-lg border-gray-200">${right}</div>
            </div>
          </div>
        </div>
        ${previewModal}${supplierStub}${discardModal}
      </div>`;
  }

  /* ── Page (Inventory.jsx / RawMaterialsInventory.jsx) ─────────────────── */
  function renderPage() {
    const tabBar = `
      <div class="grid grid-cols-2 md:flex border-b border-slate-200 bg-slate-50/50">
        ${state.tabs
          .map(({ id, label, icon: ic }) => {
            const isActive = state.activeTab === id;
            return `<button data-tab="${id}"
              class="flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 px-2 md:px-5 py-2.5 md:py-3.5 text-center text-xs md:text-sm font-medium border-b-2 md:whitespace-nowrap transition-all duration-150 ${
                isActive
                  ? "border-emerald-500 text-emerald-600 bg-white"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-white/70"
              }">${icon(ic, "", 15)}<span class="leading-tight">${esc(label)}</span></button>`;
          })
          .join("")}
      </div>`;

    let body = "";
    if (state.activeTab === "live") body = renderLiveStock();
    else if (state.activeTab === "stock") body = `<div class="p-5">${renderStockUpload()}</div>`;
    else if (state.activeTab === "low-stock") body = renderLowStock();
    else if (state.activeTab === "inventory-health") body = renderHealth();
    else if (state.activeTab === "batches") body = renderBatches();

    // RawMaterialsInventory.jsx only — the desktop "Receive Stock" header and
    // its mobile sticky-footer twin. /inventory renders no such control, which
    // is why its AddBatchDrawer is unreachable (see addendum divergence D4).
    const isRM = state.catalogueType === "RAW-MATERIAL";
    const receiveHeader = isRM
      ? `<div class="hidden md:flex items-start justify-end mb-5">
           <div class="flex items-center gap-2 shrink-0">
             <button data-receivestock
               class="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 active:bg-emerald-800 transition-colors shadow-sm">
               ${icon("packagePlus", "w-4 h-4")}Receive Stock
             </button>
           </div>
         </div>`
      : "";
    const receiveFooter = isRM
      ? `<div class="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
           <div class="flex items-center justify-around px-1 py-2 pb-[env(safe-area-inset-bottom,8px)]">
             <button data-receivestock class="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-emerald-700 hover:bg-emerald-50">
               <span class="rounded-lg bg-emerald-600 px-3 py-1 text-white">${icon(
                 "packagePlus",
                 "w-5 h-5"
               )}</span>
               <span class="text-[10px] font-medium">Receive Stock</span>
             </button>
           </div>
         </div>
         <div class="md:hidden h-16"></div>`
      : "";

    return `
      ${isRM ? renderAddBatchDrawer() : ""}
      <div class="tab tab-enter">
        ${receiveHeader}
        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          ${tabBar}${body}
        </div>
        ${receiveFooter}
      </div>`;
  }

  /* ── Render + wire ────────────────────────────────────────────────────── */
  function render() {
    outlet.innerHTML = renderPage();
    wire();
  }

  function debouncedSearchUpdate(which, value, ms) {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state[which === "batches" ? "batchTab" : which].search = value;
      state[which === "batches" ? "batchTab" : which].page = 1;
      render();
      const el = outlet.querySelector(`[data-search="${which}"]`);
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch (e) {
          /* number/date inputs don't support selection */
        }
      }
    }, ms);
  }

  function wire() {
    const $$ = (sel) => outlet.querySelectorAll(sel);
    const $ = (sel) => outlet.querySelector(sel);

    $$("[data-tab]").forEach((b) =>
      b.addEventListener("click", () => {
        state.activeTab = b.getAttribute("data-tab");
        render();
      })
    );

    $$("[data-search]").forEach((el) =>
      el.addEventListener("input", (e) => {
        const which = el.getAttribute("data-search");
        debouncedSearchUpdate(which, e.target.value, which === "batches" ? 400 : 350);
      })
    );

    $$("[data-page]").forEach((b) =>
      b.addEventListener("click", () => {
        if (b.disabled) return;
        const p = Number(b.getAttribute("data-page"));
        const key = b.getAttribute("data-pagekey");
        if (!p) return;
        state[key === "batches" ? "batchTab" : key].page = p;
        render();
      })
    );

    // Sort dropdowns
    $$("[data-sorttoggle]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const k = b.getAttribute("data-sorttoggle");
        state[k].sortOpen = !state[k].sortOpen;
        render();
      })
    );
    $$("[data-sortopt]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const k = b.getAttribute("data-sortopt");
        state[k].sort = b.getAttribute("data-sortval");
        state[k].sortOpen = false;
        state[k].page = 1;
        render();
      })
    );
    // Outside click closes any open sort menu (SortDropdown's mousedown handler)
    document.addEventListener("mousedown", (e) => {
      let changed = false;
      ["live", "upload", "low"].forEach((k) => {
        if (state[k].sortOpen) {
          const root = outlet.querySelector(`[data-sortroot="${k}"]`);
          if (root && !root.contains(e.target)) {
            state[k].sortOpen = false;
            changed = true;
          }
        }
      });
      if (state.drawer.supplierMenuFor) {
        const cell = outlet.querySelector(`[data-suppliertoggle="${state.drawer.supplierMenuFor}"]`);
        if (cell && !cell.parentElement.contains(e.target)) {
          state.drawer.supplierMenuFor = null;
          changed = true;
        }
      }
      if (changed) render();
    });

    // Expiry filter pills
    $$("[data-timefilter]").forEach((b) =>
      b.addEventListener("click", () => {
        state.health.timeFilter = b.getAttribute("data-timefilter");
        state.health.page = 1;
        render();
      })
    );
    $$("[data-customrange]").forEach((el) =>
      el.addEventListener("change", () => {
        state.health.customRange[el.getAttribute("data-customrange")] = fromInputVal(el.value);
        state.health.page = 1;
        render();
      })
    );
    const cc = $("[data-clearcustom]");
    if (cc)
      cc.addEventListener("click", () => {
        state.health.customRange = { from: null, to: null };
        render();
      });
    const ca = $("[data-clearall]");
    if (ca)
      ca.addEventListener("click", () => {
        state.health.timeFilter = "all";
        state.health.customRange = { from: null, to: null };
        state.health.search = "";
        state.health.page = 1;
        render();
      });

    // Quick Stock Upload rows
    $$("[data-uprow]").forEach((el) =>
      el.addEventListener("input", () => {
        const key = el.getAttribute("data-uprow");
        const field = el.getAttribute("data-ufield");
        const row = getRow(key);
        row[field] = el.value;
        state.upload.rows[key] = row;
        refreshUploadRow(key);
      })
    );
    $$("[data-usave]").forEach((b) =>
      b.addEventListener("click", () => {
        const key = b.getAttribute("data-usave");
        const row = getRow(key);
        const errors = getRowErrors(row);
        if (Object.keys(errors).length > 0) {
          row.touched = { qty: true, mfgDate: true, expDate: true };
          state.upload.rows[key] = row;
          render();
          return;
        }
        // Saving is mocked: flip to the spinner, then append a batch locally so
        // the Batch History tab reflects the upload, mirroring reloadBatches().
        row.saving = true;
        state.upload.rows[key] = row;
        render();
        setTimeout(() => {
          const product = state.products.find((p) => p.articleNumber === key);
          const bid = "batch-local-" + Date.now();
          const stamp = new Date();
          state.batches.unshift({
            _id: bid,
            batchNumber:
              "BATCH-" +
              stamp.toISOString().slice(0, 10).replace(/-/g, "") +
              "-" +
              String(stamp.getHours()).padStart(2, "0") +
              String(stamp.getMinutes()).padStart(2, "0"),
            createdAt: stamp.toISOString(),
            products: [
              {
                _id: product._id,
                name: product.productName,
                articleNo: product.articleNumber,
                unit: product.unit,
                boxes: product.boxes,
                pallets: product.pallets,
                stock: Number(row.qty),
                remainingStock: Number(row.qty),
                manufacturingDate: new Date(row.mfgDate).toISOString(),
                expiryDate: new Date(row.expDate).toISOString(),
                price: null,
                tax: null,
                supplierData: null,
              },
            ],
          });
          product.availableStock += Number(row.qty);
          product.batchStock.push({
            batchId: bid,
            stock: Number(row.qty),
            remainingStock: Number(row.qty),
          });
          delete state.upload.rows[key];
          render();
        }, 700);
      })
    );

    // Batch History expand / copy / detail tabs
    $$("[data-toggle]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = el.getAttribute("data-toggle");
        const i = state.batchTab.expanded.indexOf(id);
        if (i > -1) state.batchTab.expanded.splice(i, 1);
        else state.batchTab.expanded.push(id);
        render();
      })
    );
    $$("[data-copy]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const v = b.getAttribute("data-copy");
        if (navigator.clipboard) navigator.clipboard.writeText(v).catch(() => {});
        state.batchTab.copied = v;
        render();
        setTimeout(() => {
          state.batchTab.copied = "";
          render();
        }, 2000);
      })
    );
    $$("[data-detailtab]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        state.batchTab.detailTab[b.getAttribute("data-detailtab")] =
          b.getAttribute("data-detailtabid");
        render();
      })
    );

    /* ── Low Stock: selection, bulk PO, per-row restock ─────────────────── */
    $$("[data-lowsel]").forEach((cb) =>
      cb.addEventListener("change", () => {
        const id = cb.getAttribute("data-lowsel");
        if (id === "selectAllLowStock") {
          const rows = lowStockList().slice(
            (state.low.page - 1) * PAGE_SIZE,
            state.low.page * PAGE_SIZE
          );
          const ids = rows.map((p) => String(p._id));
          const allOn = ids.every((i) => state.low.selected.includes(i));
          state.low.selected = allOn
            ? state.low.selected.filter((i) => !ids.includes(i))
            : Array.from(new Set(state.low.selected.concat(ids)));
        } else {
          const pid = id.replace(/^m?-?select-/, "").replace(/^select-/, "");
          const i = state.low.selected.indexOf(pid);
          if (i > -1) state.low.selected.splice(i, 1);
          else state.low.selected.push(pid);
        }
        render();
      })
    );
    // Live: navigates to SourcingOrder seeded with the selection. Discovery has
    // no such route, so the handoff is surfaced instead of faked.
    const poBtn = $("[data-createpo]");
    if (poBtn)
      poBtn.addEventListener("click", () => {
        if (poBtn.disabled) return;
        window.alert(
          "Live this hands off to the Sourcing Order screen, seeded with " +
            state.low.selected.length +
            " raw material(s) and their Need-to-Order quantities.\n\nThat screen is outside this module's boundary, so the handoff stops here in discovery."
        );
      });
    $$("[data-restock]").forEach((b) =>
      b.addEventListener("click", () => {
        const p = state.products.find((x) => String(x._id) === b.getAttribute("data-restock"));
        window.alert(
          "Live this opens Sourcing Order pre-filled with:\n\n" +
            p.productName +
            " (" +
            p.articleNumber +
            ")\nRequested qty: " +
            Math.max(0, (p.stockThreshold || 0) - (p.availableStock || 0)) +
            "\n\nThat screen is outside this module's boundary."
        );
      })
    );

    /* ── AddBatchDrawer ─────────────────────────────────────────────────── */
    const d = state.drawer;
    $$("[data-receivestock]").forEach((b) =>
      b.addEventListener("click", () => {
        d.open = true;
        render();
      })
    );
    const closeDrawer = () => {
      if (d.selected.length > 0) {
        d.discardOpen = true;
      } else {
        d.open = false;
      }
      render();
    };
    const dc = $("[data-drawerclose]");
    if (dc) dc.addEventListener("click", closeDrawer);
    const dm = $("[data-drawermask]");
    if (dm) dm.addEventListener("click", closeDrawer);
    const dw = $("[data-drawerwait]");
    if (dw)
      dw.addEventListener("click", () => {
        d.discardOpen = false;
        render();
      });
    const dd = $("[data-drawerdiscard]");
    if (dd)
      dd.addEventListener("click", () => {
        d.discardOpen = false;
        d.open = false;
        d.selected = [];
        render();
      });

    $$("[data-cat]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-cat");
        const i = d.openCategories.indexOf(id);
        if (i > -1) d.openCategories.splice(i, 1);
        else d.openCategories.push(id);
        render();
      })
    );
    const ps = $("[data-prodsearch]");
    if (ps)
      ps.addEventListener("input", (e) => {
        clearTimeout(searchTimer);
        const v = e.target.value;
        searchTimer = setTimeout(() => {
          d.productSearch = v;
          render();
          const again = outlet.querySelector("[data-prodsearch]");
          if (again) {
            again.focus();
            try {
              again.setSelectionRange(again.value.length, again.value.length);
            } catch (err) {}
          }
        }, 300);
      });

    $$("[data-pickprod]").forEach((cb) =>
      cb.addEventListener("change", () => {
        const id = cb.getAttribute("data-pickprod");
        const i = d.selected.findIndex((s) => s._id === id);
        if (i > -1) d.selected.splice(i, 1);
        else {
          const { byId } = drawerProductPool();
          const p = byId[id];
          d.selected.push({
            _id: p._id,
            productName: p.productName,
            articleNumber: p.articleNumber,
            unit: p.unit,
            boxes: p.boxes,
            pallets: p.pallets,
            qty: "",
            mfgDate: "",
            expDate: "",
            price: "",
            tax: "",
            supplierId: "",
          });
        }
        render();
      })
    );
    $$("[data-mremove]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.getAttribute("data-mremove");
        d.selected = d.selected.filter((s) => s._id !== id);
        render();
      })
    );
    $$("[data-mrow]").forEach((el) =>
      el.addEventListener("input", () => {
        const row = d.selected.find((s) => s._id === el.getAttribute("data-mrow"));
        if (row) row[el.getAttribute("data-mfield")] = el.value;
      })
    );
    const cta = $("[data-copytoall]");
    if (cta)
      cta.addEventListener("click", () => {
        const first = d.selected[0];
        if (!first) return;
        d.selected.forEach((r) => {
          r.mfgDate = first.mfgDate;
          r.expDate = first.expDate;
        });
        render();
      });
    $$("[data-suppliertoggle]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = b.getAttribute("data-suppliertoggle");
        d.supplierMenuFor = d.supplierMenuFor === id ? null : id;
        render();
      })
    );
    $$("[data-pickSupplier]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const row = d.selected.find((s) => s._id === b.getAttribute("data-pickSupplier"));
        if (row) row.supplierId = b.getAttribute("data-suppliername");
        d.supplierMenuFor = null;
        render();
      })
    );
    $$("[data-addsupplier]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        d.supplierStubFor = b.getAttribute("data-addsupplier");
        d.supplierMenuFor = null;
        render();
      })
    );
    const sc = $("[data-stubclose]");
    if (sc)
      sc.addEventListener("click", () => {
        d.supplierStubFor = null;
        render();
      });

    const pv = $("[data-preview]");
    if (pv)
      pv.addEventListener("click", () => {
        d.previewOpen = true;
        render();
      });
    const pvc = $("[data-previewcancel]");
    if (pvc)
      pvc.addEventListener("click", () => {
        d.previewOpen = false;
        render();
      });
    const cb2 = $("[data-createbatch]");
    if (cb2)
      cb2.addEventListener("click", () => {
        d.creating = true;
        render();
        setTimeout(() => {
          const stamp = new Date();
          const bid = "batch-local-" + Date.now();
          state.batches.unshift({
            _id: bid,
            batchNumber:
              "BATCH-" +
              stamp.toISOString().slice(0, 10).replace(/-/g, "") +
              "-" +
              String(stamp.getHours()).padStart(2, "0") +
              String(stamp.getMinutes()).padStart(2, "0"),
            createdAt: stamp.toISOString(),
            products: d.selected.map((r) => ({
              _id: r._id,
              name: r.productName,
              articleNo: r.articleNumber,
              unit: r.unit,
              boxes: r.boxes,
              pallets: r.pallets,
              stock: Number(r.qty) || 0,
              remainingStock: Number(r.qty) || 0,
              manufacturingDate: r.mfgDate ? new Date(r.mfgDate).toISOString() : null,
              expiryDate: r.expDate ? new Date(r.expDate).toISOString() : null,
              price: r.price === "" ? null : Number(r.price),
              tax: r.tax === "" ? null : Number(r.tax),
              supplierData: (state.seed.suppliers || []).find((s) => s.name === r.supplierId) || null,
            })),
          });
          d.selected.forEach((r) => {
            const p = state.products.find((x) => x._id === r._id);
            if (!p) return;
            p.availableStock += Number(r.qty) || 0;
            p.batchStock.push({
              batchId: bid,
              stock: Number(r.qty) || 0,
              remainingStock: Number(r.qty) || 0,
            });
          });
          d.creating = false;
          d.previewOpen = false;
          d.open = false;
          d.selected = [];
          state.activeTab = "batches";
          render();
        }, 800);
      });

    // Column-info tooltips (react-tooltip stand-in)
    $$("[data-tip]").forEach((el) => {
      let tip;
      el.addEventListener("mouseenter", () => {
        tip = document.createElement("div");
        tip.className = "mock-tooltip";
        if (el.hasAttribute("data-tipdark")) {
          tip.style.background = "#1e293b";
          tip.style.maxWidth = "240px";
          tip.style.whiteSpace = "normal";
          tip.style.lineHeight = "1.6";
        }
        tip.textContent = el.getAttribute("data-tip");
        document.body.appendChild(tip);
        const r = el.getBoundingClientRect();
        tip.style.left = Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2) + "px";
        tip.style.top = r.bottom + 6 + "px";
        requestAnimationFrame(() => tip.classList.add("is-visible"));
      });
      el.addEventListener("mouseleave", () => {
        if (tip) tip.remove();
        tip = null;
      });
    });
  }

  // Patch a Quick Stock Upload row's validation in place — re-rendering the
  // whole table on every keystroke would drop focus mid-typing.
  function refreshUploadRow(key) {
    const row = getRow(key);
    const errors = getRowErrors(row);
    const hasErrors = Object.keys(errors).length > 0;
    outlet.querySelectorAll(`[data-usave="${CSS.escape(key)}"]`).forEach((btn) => {
      btn.classList.toggle("bg-slate-100", hasErrors);
      btn.classList.toggle("text-slate-400", hasErrors);
      btn.classList.toggle("border", hasErrors);
      btn.classList.toggle("border-slate-200", hasErrors);
      btn.classList.toggle("bg-emerald-600", !hasErrors);
      btn.classList.toggle("text-white", !hasErrors);
      btn.classList.toggle("hover:bg-emerald-700", !hasErrors);
    });
  }

  /* ── Boot ─────────────────────────────────────────────────────────────── */
  async function mount(opts) {
    opts = opts || {};
    const seed = await window.MockShell.loadSeed(opts.seedPath || "../../seed-data/seed.json");
    state.seed = seed;
    UNIT_INDEX = (seed.appProp && seed.appProp.priceCalculationUnitIndex) || 0;

    state.route = opts.route || "/inventory";
    state.catalogueType = opts.catalogueType || "";
    state.tabs = opts.tabs || TABS_FG;
    state.activeTab = opts.tab || "live";
    state.loading = !!opts.loading;

    const key = state.catalogueType === "RAW-MATERIAL" ? "RAW-MATERIAL" : "FINISHED-GOODS";
    state.products = JSON.parse(JSON.stringify(seed.stockSummary[key] || []));
    if (opts.dataset === "empty") state.products = [];
    state.batches = opts.dataset === "empty" ? [] : materialiseBatches(seed);

    if (opts.expandBatch) state.batchTab.expanded = [opts.expandBatch];
    if (opts.timeFilter) state.health.timeFilter = opts.timeFilter;
    if (opts.openDrawer) state.drawer.open = true;
    if (opts.preselect) {
      const { byId, categories } = (function () {
        const key = state.catalogueType === "RAW-MATERIAL" ? "RAW-MATERIAL" : "FINISHED-GOODS";
        const m = {};
        (seed.stockSummary[key] || []).forEach((p) => (m[p._id] = p));
        return { byId: m, categories: (seed.categoryTree || {})[key] || [] };
      })();
      state.drawer.selected = opts.preselect
        .map((id) => byId[id])
        .filter(Boolean)
        .map((p) => ({
          _id: p._id,
          productName: p.productName,
          articleNumber: p.articleNumber,
          unit: p.unit,
          boxes: p.boxes,
          pallets: p.pallets,
          qty: "",
          mfgDate: "",
          expDate: "",
          price: "",
          tax: "",
          supplierId: "",
        }));
      // Open the categories the preselected products live in, as ticking them
      // by hand would have.
      state.drawer.openCategories = categories
        .filter((c) => c.productIds.some((id) => opts.preselect.includes(id)))
        .map((c) => c._id);
    }

    const menu = (seed.storefrontMenus || []).find((m) =>
      (m.submenus || []).some((s) => s.path === state.route)
    );
    const sub = menu && (menu.submenus || []).find((s) => s.path === state.route);
    const pageTitle = (sub && sub.name) || "Inventory";

    outlet = window.MockShell.renderShell(document.getElementById("root"), seed, {
      activePath: state.route,
      pageTitle,
    });

    render();
  }

  window.MockInventory = { mount, TABS_FG, TABS_RM };
})();

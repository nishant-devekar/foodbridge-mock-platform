/* ==========================================================================
   DELIVERY MANAGEMENT — Home dashboard

     app source   route-delivery-app/pages/HomeDashboard.jsx
                  route-delivery-app/controllers/useDashboardController.js

   The driver's landing screen: who they are, the day's totals, and the routes
   they can act on. Every route card's button is phase-dependent — a READY route
   starts, an IN_PROGRESS one continues, a finished one settles — which is why
   the card computes its own label and destination rather than the list doing it.

   The four stat tiles come from getRouteMetrics(), which is deliberately
   unfiltered: upstream (addendum-091) they must not shift when the list below
   is filtered, or the day's totals would appear to change as you search.
   ========================================================================== */

(function () {
  "use strict";

  const U = window.RD_UI, D = window.RD_DB, SDK = window.RD_SDK;

  /* ── Status configuration (HomeDashboard.jsx STATUS_CONFIG) ────────────── */
  const STATUS_CONFIG = {
    READY:              { label: "Ready",           badgeBg: "#f0fdf4", badgeColor: "#16a34a", btnVariant: "brand",   btnLabel: "Start Route →" },
    IN_PROGRESS:        { label: "In Progress",     badgeBg: "#eff6ff", badgeColor: "#2563eb", btnVariant: "green",   btnLabel: "Continue →" },
    RESTOCKING:         { label: "Restocking",      badgeBg: "#fef3c7", badgeColor: "#b45309", btnVariant: "brand",   btnLabel: "Load Stock →" },
    PENDING_SETTLEMENT: { label: "Settle",          badgeBg: "#fff7ed", badgeColor: "#c2410c", btnVariant: "orange",  btnLabel: "Settle Route →" },
    CLOSED:             { label: "Closed",          badgeBg: "#f3f4f6", badgeColor: "#6b7280", btnVariant: "outline", btnLabel: "View Summary →" },
    STOCK_REQUESTED:    { label: "Stock Requested", badgeBg: "#fef3c7", badgeColor: "#b45309", btnVariant: "brand",   btnLabel: "Review & Load →" },
  };

  const STATUS_FILTER_OPTIONS = [
    { value: null,              label: "All" },
    { value: "READY",           label: "Ready" },
    { value: "STOCK_REQUESTED", label: "Stock Requested" },
    { value: "IN_PROGRESS",     label: "In Progress" },
    { value: "CLOSED",          label: "Closed" },
  ];

  // The list is ordered by what the driver should deal with first, not by id or
  // name: a route in progress outranks one waiting to start, which outranks one
  // already closed. Mirrors sortedRoutes in HomeDashboard.jsx.
  const STATUS_ORDER = { IN_PROGRESS: 0, STOCK_REQUESTED: 1, RESTOCKING: 2, READY: 3, PENDING_SETTLEMENT: 4, CLOSED: 5 };

  function routeSubtitle(r) {
    switch (r.status) {
      case "READY":              return r.totalStops + " customers · " + (r.outstandingAmount == null ? "–" : U.inr(r.outstandingAmount)) + " outstanding";
      case "IN_PROGRESS":        return r.completedStops + "/" + r.totalStops + " done · " + (r.collectedAmount == null ? "–" : U.inr(r.collectedAmount)) + " collected";
      case "RESTOCKING":         return r.completedStops + "/" + r.totalStops + " done · Stock replenishment needed";
      case "PENDING_SETTLEMENT": return r.completedStops + "/" + r.totalStops + " done · Settle now";
      case "CLOSED":             return r.completedStops + "/" + r.totalStops + " completed";
      case "STOCK_REQUESTED":    return r.totalStops + " customers · Stock request pending";
      default:                   return "";
    }
  }

  // Where a card's button goes. Mirrors handleRouteAction in
  // useDashboardController.js: the destination is a function of route status,
  // not of which card was tapped.
  function destinationFor(route) {
    switch (route.status) {
      case "READY":              return "/pre-start/" + route.id;
      case "STOCK_REQUESTED":    return "/load-stock/" + route.id;
      case "RESTOCKING":         return "/restock/" + route.id;
      case "IN_PROGRESS":        return "/queue/" + route.id;
      case "PENDING_SETTLEMENT": return "/settlement/" + route.id;
      case "CLOSED":             return "/closed/" + route.id;
      default:                   return "/queue/" + route.id;
    }
  }

  function RouteProgress(completed, total) {
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return '<div style="' + U.sty({ height: 6, background: "#e5e7eb", borderRadius: 3, marginBottom: 10, overflow: "hidden" }) + '">' +
      '<div style="' + U.sty({ height: "100%", width: pct + "%", background: U.GREEN, borderRadius: 3, opacity: 0.85, transition: "width 0.4s" }) + '"></div></div>';
  }

  function RouteCard(route) {
    const cfg = STATUS_CONFIG[route.status] || STATUS_CONFIG.READY;
    const head =
      '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: route.status === "IN_PROGRESS" ? 8 : 10 }) + '">' +
        '<div style="' + U.sty({ flex: 1, marginRight: 8 }) + '">' +
          '<div style="' + U.sty({ fontSize: 17, fontWeight: 700, color: "#111" }) + '">' + U.esc(route.name) + "</div>" +
          '<div style="' + U.sty({ fontSize: 13, color: "#888", marginTop: 3 }) + '">' + U.esc(routeSubtitle(route)) + "</div>" +
        "</div>" +
        '<span style="' + U.sty({ padding: "4px 10px", background: cfg.badgeBg, color: cfg.badgeColor, borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }) + '">' + cfg.label + "</span>" +
      "</div>";

    const progress = route.status === "IN_PROGRESS" ? RouteProgress(route.completedStops, route.totalStops) : "";

    const button = U.BtnXL({
      variant: cfg.btnVariant, label: cfg.btnLabel,
      style: { fontSize: 15, padding: 15 },
      actName: "route-action", arg: route.id,
    });

    return U.Card(head + progress + button, { status: route.status });
  }

  function SearchRow() {
    const S = window.RD.state;
    const TODAY = U.toLocalDateStr(new Date());
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const YESTERDAY = U.toLocalDateStr(yd);
    const active = S.dateFilter !== null;
    const label = !S.dateFilter ? "Date"
      : S.dateFilter === TODAY ? "Today"
      : S.dateFilter === YESTERDAY ? "Yesterday"
      : U.fmtDateLabel(S.dateFilter);

    return '<div style="' + U.sty({ display: "flex", gap: 8, padding: "12px 12px 10px", alignItems: "center" }) + '">' +
      // Search. The dashboard has its own field rather than the shared
      // SearchInput: an SVG magnifier (not the emoji), tighter padding, and a
      // grey circular clear button. Matched to the reference exactly.
      '<div style="' + U.sty({ flex: 1, minWidth: 0, position: "relative" }) + '">' +
        '<svg viewBox="0 0 20 20" fill="none" stroke="#9ca3af" stroke-width="2" style="' + U.sty({ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, pointerEvents: "none" }) + '">' +
          '<circle cx="8.5" cy="8.5" r="5.5"></circle><path d="M15 15l-3-3" stroke-linecap="round"></path></svg>' +
        '<input type="text" data-model="search" value="' + U.esc(S.search) + '" placeholder="Search routes…" style="' + U.sty({
          width: "100%", boxSizing: "border-box", padding: "11px 32px 11px 33px",
          borderRadius: 12, border: "1.5px solid #e5e7eb", background: "white",
          fontSize: 14, color: "#111", fontFamily: "inherit", outline: "none",
        }) + '" />' +
        (S.search
          ? '<button type="button"' + U.act("clear-search") + ' style="' + U.sty({
              position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
              background: "#f3f4f6", border: "none", borderRadius: "50%",
              width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
              color: "#6b7280", fontSize: 11, cursor: "pointer", lineHeight: 1,
            }) + '">✕</button>'
          : "") +
      "</div>" +
      // Date filter. Matches the reference exactly: an inline SVG calendar (not
      // the colour emoji), and the clear ✕ absolutely positioned INSIDE the
      // button's box with a 28x28 touch target, which is why the button carries
      // 34px of right padding while a date is set.
      '<div style="' + U.sty({ position: "relative", flexShrink: 0 }) + '">' +
        '<label class="rd-chip" style="' + U.sty({
          display: "flex", alignItems: "center", gap: 5,
          padding: "11px " + (active ? 34 : 12) + "px 11px 10px",
          borderRadius: 12,
          border: "1.5px solid " + (active ? U.BRAND : "#e5e7eb"),
          background: active ? "#eef6f7" : "white",
          color: active ? U.BRAND : "#6b7280",
          fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer",
          whiteSpace: "nowrap", position: "relative",
        }) + '">' +
          '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" style="width:15px;height:15px;flex-shrink:0">' +
            '<rect x="2" y="4" width="16" height="14" rx="2"></rect>' +
            '<path d="M6 2v4M14 2v4M2 9h16" stroke-linecap="round"></path></svg>' +
          U.esc(label) +
          '<input type="date" data-model="date" value="' + U.esc(S.dateFilter || "") + '" style="' + U.sty({ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }) + '" />' +
        "</label>" +
        (active
          ? '<button type="button" aria-label="Clear date filter"' + U.act("clear-date") + ' style="' + U.sty({
              position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", padding: 0,
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              color: U.BRAND, fontSize: 13, cursor: "pointer", lineHeight: 1, fontWeight: 700, zIndex: 2,
            }) + '">✕</button>'
          : "") +
      "</div>" +
      "</div>";
  }

  function StatusFilterRow() {
    const S = window.RD.state;
    return '<div class="rd-noscrollbar" style="' + U.sty({ display: "flex", gap: 7, marginBottom: 14, overflowX: "auto", padding: "0 12px 2px" }) + '">' +
      STATUS_FILTER_OPTIONS.map(function (o) {
        return U.StatusChip({ active: S.statusFilter === o.value, label: o.label, actName: "status-filter", arg: String(o.value) });
      }).join("") + "</div>";
  }

  /* ── Screen ────────────────────────────────────────────────────────────── */
  window.RD.screen("home", function () {
    const S = window.RD.state;
    const driver = D.db.driver;
    const metrics = SDK.routeDelivery.getRouteMetrics().data;

    let routes = SDK.routeDelivery.listTodayRoutesBasic({}).data.routes.slice();
    routes.sort(function (a, b) {
      return (STATUS_ORDER[a.status] === undefined ? 9 : STATUS_ORDER[a.status]) -
             (STATUS_ORDER[b.status] === undefined ? 9 : STATUS_ORDER[b.status]);
    });
    if (S.dateFilter) routes = routes.filter(function (r) { return r.scheduledDate === S.dateFilter; });
    if (S.statusFilter) routes = routes.filter(function (r) { return r.status === S.statusFilter; });
    if (S.search.trim()) {
      const q = S.search.trim().toLowerCase();
      routes = routes.filter(function (r) { return r.name.toLowerCase().indexOf(q) !== -1; });
    }

    const tiles = U.StatGrid(
      U.StatTile(metrics.totalRoutes, "All Deliveries", "blue") +
      U.StatTile(U.inr(metrics.totalTarget), "Target", "green") +
      U.StatTile(metrics.uniqueCustomerCount, "Customers", "orange") +
      U.StatTile(U.inr(metrics.totalOutstanding), "Outstanding", "red")
    );

    const list = routes.length
      ? routes.map(RouteCard).join("")
      : U.EmptyState("📭", "No routes available", "Check back later or contact your supervisor.");

    return U.SyncBar(driver.syncedAt, false) +
      U.DriverHeader(driver.name, "New Delivery") +
      '<div class="rd-body">' +
        tiles +
        // Header text is derived, not fixed — QA:
        //   selectedDate ? (isToday ? "Today's Routes" : `Routes · <date>`) : "All Routes"
        U.SectionHeader(
          !S.dateFilter ? "All Routes"
            : S.dateFilter === U.toLocalDateStr(new Date()) ? "Today's Routes"
            : "Routes · " + U.fmtDateLabel(S.dateFilter)
        ) +
        SearchRow() +
        StatusFilterRow() +
        list +
        U.Spacer(12) +
      "</div>" +
      U.TabBar("home");
  });

  /* ── Actions ───────────────────────────────────────────────────────────── */
  window.RD.action("route-action", function (routeId) {
    const route = D.db.routes.find(function (r) { return r.id === routeId; });
    if (!route) return;
    window.RD.go(destinationFor(route));
  });

  window.RD.action("status-filter", function (value) {
    window.RD.state.statusFilter = value === "null" ? null : value;
    window.RD.render();
  });

  window.RD.action("clear-search", function () {
    window.RD.state.search = "";
    window.RD.render();
  });

  window.RD.action("clear-date", function () {
    window.RD.state.dateFilter = null;
    window.RD.render();
  });

  window.RD.action("new-route", function () {
    window.RD.toast("On-the-move route creation — not in this prototype");
  });

  // Typed text must survive the re-render, so the caret is restored after it.
  window.RD.action("model:search", function (value) {
    window.RD.state.search = value;
    window.RD.render();
    const el = document.querySelector('[data-model="search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });

  window.RD.action("model:date", function (value) {
    window.RD.state.dateFilter = value || null;
    window.RD.render();
  });
})();

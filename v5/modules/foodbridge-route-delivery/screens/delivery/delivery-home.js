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

    return '<div style="' + U.sty({ display: "flex", gap: 8, marginBottom: 10, alignItems: "center", padding: "0 12px" }) + '">' +
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
          WebkitAppearance: "none",
        }) + '" />' +
        (S.search
          ? '<button type="button"' + U.act("clear-search") + ' style="' + U.sty({
              position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)",
              background: "#f3f4f6", border: "none", borderRadius: "50%",
              width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#6b7280", fontSize: 11, fontWeight: 700,
              lineHeight: 1, padding: 0,
            }) + '">✕</button>'
          : "") +
      "</div>" +
      // Date filter. QA's markup exactly: a plain <button> that opens a hidden
      // native date input via showPicker(), the clear ✕ as a SIBLING of the
      // button (not nested), and the input itself parked at 0x0 with
      // pointer-events:none so it can never be tapped directly.
      '<div style="' + U.sty({ position: "relative", flexShrink: 0 }) + '">' +
        '<button type="button"' + U.act("open-date") + ' style="' + U.sty({
          display: "flex", alignItems: "center", gap: 5,
          padding: "11px " + (active ? 34 : 12) + "px 11px 10px",
          borderRadius: 12,
          border: "1.5px solid " + (active ? U.BRAND : "#e5e7eb"),
          background: active ? "#eef6f7" : "white",
          color: active ? U.BRAND : "#6b7280",
          fontSize: 13, fontWeight: active ? 600 : 500, cursor: "pointer",
          fontFamily: "inherit", whiteSpace: "nowrap",
          transition: "border-color 0.15s, background 0.15s, color 0.15s",
          WebkitTapHighlightColor: "transparent",
        }) + '">' +
          '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" style="width:15px;height:15px;flex-shrink:0">' +
            '<rect x="2" y="4" width="16" height="14" rx="2"></rect>' +
            '<path d="M6 2v4M14 2v4M2 9h16" stroke-linecap="round"></path></svg>' +
          U.esc(label) +
        "</button>" +
        (active
          ? '<button type="button" aria-label="Clear date filter"' + U.act("clear-date") + ' style="' + U.sty({
              position: "absolute", right: 2, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", padding: 0,
              width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
              color: U.BRAND, fontSize: 13, cursor: "pointer", lineHeight: 1, fontWeight: 700,
              WebkitTapHighlightColor: "transparent",
            }) + '">✕</button>'
          : "") +
        '<input type="date" data-model="date" value="' + U.esc(S.dateFilter || "") + '" max="' + TODAY + '" tabindex="-1" style="' + U.sty({
          position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0, top: 0, left: 0,
        }) + '" />' +
      "</div>" +
      "</div>";
  }

  function StatusFilterRow() {
    const S = window.RD.state;
    return '<div style="' + U.sty({ display: "flex", gap: 7, marginBottom: 14, overflowX: "auto", padding: "0 12px 2px", scrollbarWidth: "none" }) + '">' +
      STATUS_FILTER_OPTIONS.map(function (o) {
        return U.StatusChip({ active: S.statusFilter === o.value, label: o.label, actName: "status-filter", arg: String(o.value) });
      }).join("") + "</div>";
  }

  // NewDeliverySheet — the "+ New Delivery" affordance. QA lists the route
  // templates the driver can start from, with a radio per row and a Start
  // Delivery that stays disabled until one is picked. Templates here are the
  // routes themselves, which is what the real templates are derived from.
  function NewDeliverySheet() {
    const S = window.RD.state;
    const picked = S.newDeliveryPick || null;
    const canSubmit = !!picked && String(S.newDeliveryName || "").trim() !== "";
    const templates = D.db.routes.map(function (r) {
      return { id: r.id, name: r.name, stops: r.totalStops };
    });

    const rows = templates.map(function (t, i) {
      const on = picked === t.id;
      return "<div>" +
        '<button type="button"' + U.act("new-delivery-pick", t.id) + ' style="' + U.sty({
          width: "100%", padding: "14px 16px", display: "flex", alignItems: "center", gap: 12,
          // QA borders every row, the last one included, and tints the chosen one.
          background: on ? "#eef6f7" : "white", border: "none", borderBottom: "1px solid #f0f2f5",
          textAlign: "left", fontFamily: "inherit", cursor: "pointer",
        }) + '">' +
          '<div style="' + U.sty({
            width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
            border: "2.5px solid " + (on ? U.BRAND : "#d1d5db"),
            background: on ? U.BRAND : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }) + '">' + (on ? '<div style="' + U.sty({ width: 7, height: 7, borderRadius: "50%", background: "white" }) + '"></div>' : "") + "</div>" +
          '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
            '<div style="' + U.sty({ fontSize: 15, fontWeight: 700, color: on ? U.BRAND : "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(t.name) + "</div>" +
            '<div style="' + U.sty({ fontSize: 12, color: "#888", marginTop: 2 }) + '">' + t.stops + " customer" + (t.stops === 1 ? "" : "s") + " · 1 staff</div>" +
          "</div>" +
          (on ? '<div style="' + U.sty({ fontSize: 20, color: U.BRAND, flexShrink: 0, fontWeight: 700 }) + '">›</div>' : "") +
        "</button>" +
        // Choosing a template opens the name field QA autofills with
        // "<template> DD/MM/YYYY HH:MM", and a duplicate name is refused.
        (on
          ? '<div style="' + U.sty({ padding: "10px 16px 14px", background: "#eef6f7", borderBottom: "1px solid #d1e8eb" }) + '">' +
              '<label style="' + U.sty({ display: "block", fontSize: 11, fontWeight: 700, color: U.BRAND, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }) + '">Delivery Name</label>' +
              '<input type="text" data-model="new-delivery-name" value="' + U.esc(S.newDeliveryName || "") + '" placeholder="e.g. Bandra Route 11/06/2026 14:30" style="' + U.sty({
                width: "100%", boxSizing: "border-box", padding: "12px 14px",
                border: "2px solid " + (S.newDeliveryNameError ? "#dc2626" : U.BRAND),
                borderRadius: 12, fontSize: 15, fontWeight: 600, color: "#111",
                background: "white", outline: "none", fontFamily: "inherit",
              }) + '" />' +
              (S.newDeliveryNameError
                ? '<div style="' + U.sty({ marginTop: 6, fontSize: 12, color: "#dc2626", fontWeight: 500 }) + '">' + U.esc(S.newDeliveryNameError) + "</div>"
                : "") +
            "</div>"
          : "") +
        "</div>";
    }).join("");

    return '<div' + U.act("new-delivery-close") + ' style="' + U.sty({
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100,
    }) + '"></div>' +
    '<div style="' + U.sty({
      position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
      width: "calc(100% - 32px)", maxWidth: 448, maxHeight: "80dvh",
      background: "white", borderRadius: 20, boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
      zIndex: 101, display: "flex", flexDirection: "column", overflow: "hidden",
    }) + '">' +
      '<div style="' + U.sty({ padding: "18px 16px 14px", borderBottom: "1px solid #f0f2f5", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }) + '">' +
        "<div>" +
          '<div style="' + U.sty({ fontSize: 18, fontWeight: 700, color: "#111" }) + '">New Delivery</div>' +
          '<div style="' + U.sty({ fontSize: 13, color: "#888", marginTop: 2 }) + '">Select a route template to begin</div>' +
        "</div>" +
        '<button type="button"' + U.act("new-delivery-close") + ' style="' + U.sty({
          width: 32, height: 32, borderRadius: "50%", background: "#f3f4f6", color: "#6b7280",
          border: "none", fontSize: 18, fontWeight: 700, cursor: "pointer", marginTop: -2, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
        }) + '">×</button>' +
      "</div>" +
      // The list takes the sheet's slack; header and footer hold their height.
      '<div style="' + U.sty({ flex: 1, position: "relative", overflowY: "auto", WebkitOverflowScrolling: "touch" }) + '">' + rows + "</div>" +
      '<div style="' + U.sty({ padding: "12px 16px", borderTop: "1px solid #f0f2f5", display: "flex", gap: 10, flexShrink: 0 }) + '">' +
        '<button type="button"' + U.act("new-delivery-close") + ' style="' + U.sty({
          flex: 1, padding: "15px 0", borderRadius: 16, border: "2px solid " + U.BRAND,
          background: "white", color: U.BRAND, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
        }) + '">Cancel</button>' +
        U.BtnXL({
          variant: canSubmit ? "brand" : "grey", label: "Start Delivery", disabled: !canSubmit,
          style: { flex: 2, padding: 15, fontSize: 15, opacity: canSubmit ? 1 : 0.5 },
          actName: "new-delivery-start", arg: picked || "",
        }) +
      "</div>" +
    "</div>";
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
      '<div class="rd-body" style="background:' + U.BG + '">' +
        tiles +
        U.Spacer(16) +
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
        U.Spacer(16) +
      "</div>" +
      U.TabBar("home") +
      (S.newDeliveryOpen ? NewDeliverySheet() : "");
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

  window.RD.action("open-date", function () {
    const el = document.querySelector('[data-model="date"]');
    if (!el) return;
    if (el.showPicker) el.showPicker(); else el.click();
  });

  window.RD.action("clear-date", function () {
    window.RD.state.dateFilter = null;
    window.RD.render();
  });

  window.RD.action("new-route", function () {
    window.RD.state.newDeliveryOpen = true;
    window.RD.state.newDeliveryPick = null;
    window.RD.state.newDeliveryName = "";
    window.RD.state.newDeliveryNameError = null;
    window.RD.render();
  });
  window.RD.action("new-delivery-close", function () {
    window.RD.state.newDeliveryOpen = false;
    window.RD.render();
  });
  // "<template> DD/MM/YYYY HH:MM" — defaultDeliveryName upstream.
  function defaultDeliveryName(name) {
    const d = new Date();
    const p2 = function (n) { return String(n).padStart(2, "0"); };
    return (name || "Route") + " " + p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + "/" + d.getFullYear() + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
  }
  window.RD.action("new-delivery-pick", function (id) {
    const S = window.RD.state;
    S.newDeliveryPick = id;
    const t = (D.db.routes.find(function (r) { return r.id === id; }) || {});
    S.newDeliveryName = defaultDeliveryName(t.name);
    S.newDeliveryNameError = null;
    window.RD.render();
  });
  window.RD.action("model:new-delivery-name", function (v) {
    const S = window.RD.state;
    S.newDeliveryName = v;
    if (S.newDeliveryNameError) S.newDeliveryNameError = null;
    window.RD.render();
    const el = document.querySelector('[data-model="new-delivery-name"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("new-delivery-start", function (id) {
    const S = window.RD.state;
    if (!id || !String(S.newDeliveryName || "").trim()) return;
    // QA refuses a name that is already in use rather than creating a twin.
    const taken = D.db.routes.some(function (r) { return r.name === String(S.newDeliveryName).trim(); });
    if (taken) {
      S.newDeliveryNameError = "A delivery with this name already exists. Please use a different name.";
      window.RD.render();
      return;
    }
    S.newDeliveryOpen = false;
    const route = D.db.routes.find(function (r) { return r.id === id; });
    window.RD.go(route ? destinationFor(route) : "");
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

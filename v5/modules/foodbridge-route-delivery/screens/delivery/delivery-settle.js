/* ==========================================================================
   DELIVERY MANAGEMENT — settlement and close

   The end of the day: reconcile what went out against what came back, hand
   over the cash, close the route, then look at how it went.

     Settlement     pages/SettlementOverview.jsx
     Stock Count    pages/StockCount.jsx
     Cash Handover  pages/CashHandover.jsx
     Route Closed   pages/RouteClosed.jsx
     Analytics      pages/RouteAnalytics.jsx
     Reports        pages/Reports.jsx

   The steps unlock in sequence and the route cannot close until all are done —
   that ordering is the control the whole screen exists to enforce, so it is
   reproduced rather than simplified. A discrepancy in either count forces a
   written explanation before it can be confirmed.
   ========================================================================== */

(function () {
  "use strict";

  const U = window.RD_UI, D = window.RD_DB, SDK = window.RD_SDK,
        M = window.RD_MODELS, V = window.RD_VALID;

  function rawInr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

  function routeOr404(routeId) {
    const r = D.db.routeDetails[routeId];
    if (!r) throw new Error("Route " + routeId + " not found");
    return r;
  }

  const STEP_ICONS = { STOCK_COUNT: "📦", CASH_HANDOVER: "💵", CUSTOMER_CLOSURE: "📨" };
  const STEP_DESCRIPTIONS = {
    STOCK_COUNT:      "Verify remaining stock",
    CASH_HANDOVER:    "Count and hand over cash",
    CUSTOMER_CLOSURE: "Dispatch invoices and log follow-ups",
  };

  /* ══ Settlement Overview ═══════════════════════════════════════════════ */

  window.RD.screen("settlement", function (p) {
    const route = routeOr404(p.routeId);
    const ov = SDK.settlement.getSettlementOverview(p.routeId).data;
    // The app's own flow model, not a local re-derivation. It drops
    // CUSTOMER_CLOSURE (no driver-facing action), works out which step is next,
    // and decides allDone — all things a hand-rolled version would get subtly
    // wrong, starting with showing a third step the real screen never shows.
    const flow = M.buildSettlementFlowModel(ov);
    const stats = flow.stats, steps = flow.steps;

    const rows = steps.map(function (step, i) {
      const isDone = step.isDone;
      const unlocked = isDone || step.isCurrent;
      return '<div data-status="' + (isDone ? "done" : unlocked ? "unlocked" : "locked") + '" style="' + U.sty({
          background: "white", borderRadius: 16,
          margin: i < steps.length - 1 ? "0 12px 10px" : "0 12px",
          padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          display: "flex", alignItems: "center", gap: 14,
        }) + '">' +
        '<div style="' + U.sty({ width: 48, height: 48, borderRadius: 14, background: isDone ? "#f0fdf4" : "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }) + '">' +
          (isDone ? "✅" : (STEP_ICONS[step.key] || "📋")) + "</div>" +
        '<div style="' + U.sty({ flex: 1 }) + '">' +
          '<div style="' + U.sty({ fontSize: 16, fontWeight: 700, color: isDone ? "#6b7280" : "#111" }) + '">' + U.esc(step.label) + "</div>" +
          '<div style="' + U.sty({ fontSize: 13, color: "#888", marginTop: 2 }) + '">' + U.esc(STEP_DESCRIPTIONS[step.key] || step.description) + "</div>" +
        "</div>" +
        (unlocked
          ? '<button type="button" class="rd-btn-sm"' + (isDone ? "" : U.act("settle-step", step.key)) + ' style="' + U.sty({
              padding: "9px 14px", background: isDone ? "#6b7280" : U.BRAND, color: "white", border: "none",
              borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: isDone ? "default" : "pointer", opacity: isDone ? 0.7 : 1,
            }) + '">' + (isDone ? "Done ✓" : "Start →") + "</button>"
          : '<button type="button" disabled style="' + U.sty({ padding: "9px 14px", background: "#e5e7eb", color: "#9ca3af", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700 }) + '">🔒</button>') +
        "</div>";
    }).join("");

    const allDone = flow.allDone;
    const closed = route.status === "CLOSED";

    return U.MobileHeader({ title: "Settle Route", subtitle: ov.subtitle || route.name, onBack: false }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        U.StatGrid(
          U.StatTile(String(stats.deliveredCount || 0), "Delivered", "green") +
          U.StatTile(String(stats.skippedCount || 0), "Skipped", "red") +
          U.StatTile(U.inr(stats.collectedAmount), "Collected", "green") +
          U.StatTile(U.inr(stats.outstandingAmount), "Outstanding", "orange")
        ) +
        '<div style="height:14px;background:' + U.BG + '"></div>' +
        U.SectionHeader("Complete All Steps") + rows +
        '<div style="height:16px"></div>' +
      "</div>" +
      (allDone
        ? U.ActionBar(closed
            ? U.BtnXL({ variant: "green", label: "🎉 View Route Summary →", actName: "settle-report", arg: p.routeId })
            : U.BtnXL({ variant: "brand", label: "✅ Complete Delivery", actName: "settle-close", arg: p.routeId }))
        : "");
  });

  window.RD.action("settle-step", function (key) {
    const routeId = window.RD.state.routeId;
    if (key === "STOCK_COUNT") window.RD.go("/settlement/stock/" + routeId);
    else if (key === "CASH_HANDOVER") window.RD.go("/settlement/cash/" + routeId);
    else {
      // Customer closure has no screen of its own upstream — it completes in place.
      SDK.settlement.completeSettlementStep({ routeId: routeId, step: key });
      window.RD.toast("Invoices dispatched · follow-ups logged");
      window.RD.render();
    }
  });
  window.RD.action("settle-close", function (routeId) {
    SDK.settlement.closeRoute(routeId);
    window.RD.toast("Route closed");
    window.RD.go("/closed/" + routeId);
  });
  window.RD.action("settle-report", function (routeId) { window.RD.go("/closed/" + routeId); });

  /* ══ Stock Count ═══════════════════════════════════════════════════════ */

  const PRODUCT_COL = 150;
  const GRID = PRODUCT_COL + "px 62px 74px minmax(100px, 1fr)";

  window.RD.screen("stockCount", function (p) {
    const S = window.RD.state.scratch;
    const sheet = SDK.routeDelivery.getStockCountSheet({ routeId: p.routeId }).data;
    const items = sheet.items || [];
    if (!S.actuals) S.actuals = items.map(function () { return ""; });

    const mismatches = items.map(function (it, i) {
      const raw = S.actuals[i];
      if (raw === "" || raw == null) return null;
      const actual = parseInt(raw, 10);
      if (actual === it.expectedReturn) return null;
      return { productId: it.productId, name: it.name, expected: it.expectedReturn, actual: actual, diff: actual - it.expectedReturn };
    }).filter(Boolean);

    const head = '<div style="' + U.sty({ position: "sticky", top: 0, zIndex: 30, height: 42, boxSizing: "border-box", overflow: "hidden", background: "white", borderBottom: "2px solid #e5e7eb" }) + '">' +
      '<div style="' + U.sty({ display: "grid", gridTemplateColumns: GRID, columnGap: 8, minWidth: 430, width: "100%", background: "white" }) + '">' +
        ["Product", "Loaded", "Expected", "Actual"].map(function (h, i) {
          return '<div style="' + U.sty({ padding: i === 0 ? "10px 8px 10px 12px" : "10px 8px", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", textAlign: i === 3 ? "center" : i > 0 ? "right" : "left" }) + '">' + h + "</div>";
        }).join("") + "</div></div>";

    const rows = '<div style="' + U.sty({ overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "0 0 16px 16px" }) + '">' +
      '<div style="' + U.sty({ minWidth: 430, width: "100%", background: "white" }) + '">' +
      '<div style="' + U.sty({ display: "grid", gridTemplateColumns: GRID, columnGap: 8, width: "100%", background: "white" }) + '">' +
      items.map(function (it, i) {
        const raw = S.actuals[i];
        const has = raw !== "" && raw != null;
        const actual = has ? parseInt(raw, 10) : null;
        const mismatch = has && actual !== it.expectedReturn;
        const cell = { padding: "12px 8px", fontSize: 14, borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center" };
        return '<div style="' + U.sty(U.mix(cell, { paddingLeft: 12, fontWeight: 600, color: "#111" })) + '">' + U.esc(it.name) + "</div>" +
          '<div style="' + U.sty(U.mix(cell, { justifyContent: "flex-end", color: "#555" })) + '">' + it.loadedQty + "</div>" +
          '<div style="' + U.sty(U.mix(cell, { justifyContent: "flex-end", color: "#555", fontWeight: 700 })) + '">' + it.expectedReturn + "</div>" +
          '<div style="' + U.sty(U.mix(cell, { justifyContent: "center" })) + '">' +
            '<input inputmode="numeric" data-model="count-' + i + '" value="' + U.esc(raw) + '" placeholder="—" style="' + U.sty({
              width: 72, height: 38, textAlign: "center", fontSize: 15, fontWeight: 700,
              border: "2px solid " + (mismatch ? "#fbbf24" : has ? "#86efac" : "#e5e7eb"),
              borderRadius: 10, background: mismatch ? "#fffbeb" : "white", color: "#111", outline: "none",
            }) + '" /></div>';
      }).join("") + "</div></div></div>";

    const confirming = !!S.countConfirming;
    const noteMissing = mismatches.length > 0 && !(S.countNote || "").trim();

    const footer = confirming
      ? U.ConfirmPanel({
          action: "Stock Count", amount: items.length + " products counted",
          context: mismatches.length > 0 ? mismatches.length + " discrepancy" + (mismatches.length > 1 ? "ies" : "") + " to explain" : "All counts match expected",
          backLabel: "Recount", commitLabel: "Confirm Count",
          disabled: noteMissing, commitAct: "count-commit", arg: p.routeId,
          extra: mismatches.length > 0
            ? '<div style="' + U.sty({ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }) + '">' +
              '<div style="' + U.sty({ background: "#fff7ed", borderRadius: 10, border: "1px solid #fed7aa", padding: "10px 12px" }) + '">' +
                mismatches.map(function (m) {
                  return '<div style="' + U.sty({ fontSize: 12, color: "#92400e", marginBottom: 2 }) + '">· <strong>' + U.esc(m.name) + ":</strong> expected " + m.expected + ", got " + m.actual + " (" + Math.abs(m.diff) + " " + (m.diff < 0 ? "missing" : "excess") + ")</div>";
                }).join("") + "</div>" +
              '<textarea data-model="count-note" rows="2" placeholder="Explain the discrepancy…" style="' + U.sty({
                width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13,
                border: "1.5px solid " + (noteMissing ? "#ef4444" : "#fbbf24"),
                background: "#fffbeb", color: "#111", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "none",
              }) + '">' + U.esc(S.countNote || "") + "</textarea>" +
              (noteMissing ? '<div style="' + U.sty({ fontSize: 11, color: "#ef4444", fontWeight: 600, marginTop: 2 }) + '">Required before confirming</div>' : "") +
              "</div>"
            : "",
        })
      : U.BtnXL({ variant: "brand", label: "Confirm Stock Count →", actName: "count-confirm" });

    return U.MobileHeader({ title: "Stock Count", subtitle: "Count what's left in the vehicle", backLabel: "Settlement", backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: confirming ? 0.4 : 1, pointerEvents: confirming ? "none" : "auto" }) + '">' +
        '<div style="' + U.sty({ display: "flex", alignItems: "center", gap: 8, margin: "10px 12px 0" }) + '">' +
          '<div style="' + U.sty({ flex: 1, padding: "12px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600, background: "#eff3ff", color: "#1e40af", border: "1px solid #bfdbfe", display: "flex", gap: 8 }) + '">' +
            "<span>📱</span><span>Expected return is auto-calculated. Enter actual count to verify.</span></div></div>" +
        '<div style="height:10px"></div>' +
        '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' + head + rows + "</div>" +
        U.Spacer(8) +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  window.RD.action("count-confirm", function () { window.RD.state.scratch.countConfirming = true; window.RD.render(); });
  // Must re-render: the commit card is disabled until this note is non-empty,
  // so without a re-render the driver types an explanation and the button stays
  // dead. Caret is restored afterwards, as the search fields do.
  window.RD.action("model:count-note", function (v) {
    const had = !!(window.RD.state.scratch.countNote || "").trim();
    window.RD.state.scratch.countNote = v;
    if (had !== !!v.trim()) {
      window.RD.render();
      const el = document.querySelector('[data-model="count-note"]');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  });
  window.RD.action("count-commit", function (routeId) {
    const S = window.RD.state.scratch;
    const sheet = SDK.routeDelivery.getStockCountSheet({ routeId: routeId }).data;
    const counts = (sheet.items || []).map(function (it, i) {
      const raw = S.actuals[i];
      return { productId: it.productId, actualCount: raw === "" || raw == null ? it.expectedReturn : parseInt(raw, 10) };
    });
    SDK.settlement.submitStockCount({ routeId: routeId, items: counts, note: S.countNote || null });
    S.countConfirming = false;
    window.RD.toast("Stock count recorded");
    window.RD.go("/settlement/" + routeId);
  });

  /* ══ Cash Handover ═════════════════════════════════════════════════════ */

  window.RD.screen("cashHandover", function (p) {
    const S = window.RD.state.scratch;
    const sum = SDK.settlement.getCashHandoverSummary
      ? SDK.settlement.getCashHandoverSummary(p.routeId).data
      : null;
    const route = routeOr404(p.routeId);
    const stops = D.getStops(p.routeId);
    const openingCash = (route.checklist && route.checklist.openingCash && route.checklist.openingCash.amount) || 0;
    const cashCollected = stops.filter(function (s) { return s.paymentMethod === "CASH"; }).reduce(function (a, s) { return a + (s.collectedAmount || 0); }, 0);
    const upiCollected = stops.filter(function (s) { return s.paymentMethod === "UPI"; }).reduce(function (a, s) { return a + (s.collectedAmount || 0); }, 0);
    const expected = openingCash + cashCollected - (Number(S.expense) || 0);

    if (S.counted === undefined) S.counted = "";
    const counted = S.counted === "" ? null : Number(S.counted);
    const diff = counted === null ? 0 : counted - expected;
    const confirming = !!S.handoverConfirming;
    const noteMissing = counted !== null && diff !== 0 && !(S.handoverNote || "").trim();

    const footer = confirming
      ? U.ConfirmPanel({
          action: "Cash Handover", amount: U.inr(counted || 0),
          context: diff === 0 ? "Matches expected exactly" : (diff > 0 ? "₹" + Math.abs(diff) + " over expected" : "₹" + Math.abs(diff) + " short"),
          backLabel: "Recount", commitLabel: "Hand Over",
          disabled: noteMissing, commitAct: "handover-commit", arg: p.routeId,
          extra: diff !== 0
            ? '<textarea data-model="handover-note" rows="2" placeholder="Explain the difference…" style="' + U.sty({
                width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13, marginBottom: 12,
                border: "1.5px solid " + (noteMissing ? "#ef4444" : "#fbbf24"),
                background: "#fffbeb", color: "#111", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "none",
              }) + '">' + U.esc(S.handoverNote || "") + "</textarea>"
            : "",
        })
      : U.BtnXL({ variant: "brand", label: "Hand Over " + U.inr(counted || 0) + " →", disabled: counted === null, actName: "handover-confirm" });

    return U.MobileHeader({ title: "Cash Handover", subtitle: "Count your cash before handing over", backLabel: "Settlement", backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: confirming ? 0.4 : 1, pointerEvents: confirming ? "none" : "auto" }) + '">' +
        U.Card(
          U.CardTitle("Summary") +
          U.SettleRow("Opening Cash (change)", rawInr(openingCash)) +
          U.SettleRow("Cash Collected", U.inr(cashCollected), "#16a34a") +
          U.SettleRow("UPI Collected", U.inr(upiCollected), "#2563eb") +
          U.SettleRow("Expense Claimed", rawInr(Number(S.expense) || 0), "#f97316") +
          U.SettleRow("Expected in Hand", U.inr(expected), "#111", true)
        ) +
        U.Card(
          U.CardTitle("Expenses") +
          '<div style="' + U.sty({ fontSize: 12, color: "#888", marginBottom: 6 }) + '">Fuel, tolls, loading — deducted from the cash you hand over.</div>' +
          '<input inputmode="numeric" data-model="expense" value="' + U.esc(S.expense || "") + '" placeholder="0" style="' + U.sty({
            width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 15, fontFamily: "inherit", fontWeight: 700,
          }) + '" />'
        ) +
        U.Card(
          U.CardTitle("Cash Counted") +
          '<input inputmode="numeric" data-model="counted" value="' + U.esc(S.counted) + '" placeholder="Enter the amount you counted" style="' + U.sty({
            width: "100%", padding: "13px 14px", borderRadius: 12,
            border: "2px solid " + (counted === null ? "#e5e7eb" : diff === 0 ? "#86efac" : "#fbbf24"),
            fontSize: 20, fontFamily: "inherit", fontWeight: 800, textAlign: "center",
            background: counted !== null && diff !== 0 ? "#fffbeb" : "white",
          }) + '" />' +
          (counted !== null
            ? '<div style="' + U.sty({ marginTop: 10, textAlign: "center", fontSize: 14, fontWeight: 700, color: diff === 0 ? "#16a34a" : "#b45309" }) + '">' +
              (diff === 0 ? "✓ Matches expected" : (diff > 0 ? "▲ " + rawInr(Math.abs(diff)) + " over" : "▼ " + rawInr(Math.abs(diff)) + " short")) + "</div>"
            : "")
        ) +
        U.Spacer(12) +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  window.RD.action("model:expense", function (v) { window.RD.state.scratch.expense = v.replace(/\D/g, ""); window.RD.render(); });
  window.RD.action("model:counted", function (v) { window.RD.state.scratch.counted = v.replace(/\D/g, ""); window.RD.render(); });
  // Same reason as count-note above: this gates the commit card.
  window.RD.action("model:handover-note", function (v) {
    const had = !!(window.RD.state.scratch.handoverNote || "").trim();
    window.RD.state.scratch.handoverNote = v;
    if (had !== !!v.trim()) {
      window.RD.render();
      const el = document.querySelector('[data-model="handover-note"]');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  });
  window.RD.action("handover-confirm", function () { window.RD.state.scratch.handoverConfirming = true; window.RD.render(); });
  window.RD.action("handover-commit", function (routeId) {
    const S = window.RD.state.scratch;
    SDK.settlement.submitCashHandover({
      routeId: routeId,
      amount: Number(S.counted), actualCounted: Number(S.counted),
      // The SDK takes a list of expense lines, not a single total.
      expenses: Number(S.expense) > 0 ? [{ type: "OTHER", amount: Number(S.expense) }] : [],
      supervisorName: "Supervisor",
    });
    S.handoverConfirming = false;
    window.RD.toast("Cash handed over");
    window.RD.go("/settlement/" + routeId);
  });

  /* ══ Route Closed / Analytics ══════════════════════════════════════════ */
  // One screen, two routes: #/closed/:id and #/analytics/:id both land here,
  // exactly as RouteClosed and RouteAnalytics do upstream.

  function analyticsScreen(p) {
    const route = routeOr404(p.routeId);
    const a = SDK.settlement.getRouteAnalytics(p.routeId).data;
    const score = a.score || {};

    const kpis = '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 12px" }) + '">' +
      (a.kpis || []).map(function (k) {
        return '<div style="' + U.sty({ background: "white", borderRadius: 14, padding: 14 }) + '">' +
          '<div style="' + U.sty({ fontSize: 11, color: "#888", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }) + '">' + U.esc(k.label) + "</div>" +
          '<div style="' + U.sty({ fontSize: 20, fontWeight: 800, color: "#111", marginTop: 4 }) + '">' + U.esc(k.value) + "</div>" +
          (k.percentage
            ? '<div style="' + U.sty({ height: 5, background: "#e5e7eb", borderRadius: 3, marginTop: 8, overflow: "hidden" }) + '">' +
              '<div style="' + U.sty({ height: "100%", width: k.percentage + "%", background: U.GREEN, borderRadius: 3 }) + '"></div></div>'
            : "") +
          "</div>";
      }).join("") + "</div>";

    const cf = a.carriedForward || {};

    return U.MobileHeader({
        title: "Route Intelligence",
        subtitle: route.name + " · " + M.formatRouteDate(route.scheduledDate),
        backLabel: "Routes", backAct: "home",
      }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        U.Card(
          '<div style="' + U.sty({ display: "flex", alignItems: "center", gap: 16 }) + '">' +
            '<div style="' + U.sty({ textAlign: "center" }) + '">' +
              '<div style="' + U.sty({ fontSize: 44, fontWeight: 900, color: U.BRAND, lineHeight: 1 }) + '">' + (score.value || 0) + "</div>" +
              '<div style="' + U.sty({ fontSize: 11, color: "#888" }) + '">/' + (score.max || 100) + "</div>" +
            "</div>" +
            '<div style="' + U.sty({ flex: 1 }) + '">' +
              '<div style="' + U.sty({ fontSize: 18, fontWeight: 800, color: "#111" }) + '">' + U.esc(score.label || "") + "</div>" +
              '<div style="' + U.sty({ fontSize: 13, color: "#888", marginTop: 2 }) + '">' + U.esc(score.percentileText || "") + "</div>" +
            "</div>" +
            U.BtnSm({ variant: "grey", label: "Export", actName: "analytics-export", arg: p.routeId, style: { flex: "0 0 auto" } }) +
          "</div>"
        ) +
        U.SectionHeader("Performance") + kpis + U.Spacer(12) +
        U.SectionHeader("Collection Summary") +
        U.Card(
          U.SettleRow("Collected", U.inr(route.collectedAmount), "#16a34a") +
          U.SettleRow("Outstanding", U.inr(route.outstandingAmount), route.outstandingAmount > 0 ? "#ef4444" : "#16a34a") +
          U.SettleRow("Stops completed", route.completedStops + "/" + route.totalStops) +
          U.SettleRow("Carried forward", (cf.skippedCount || 0) + " skipped", null, true)
        ) +
        U.Spacer(12) +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: "brand", label: "Back to Routes", actName: "home" }));
  }

  window.RD.screen("closed", analyticsScreen);
  window.RD.screen("analytics", analyticsScreen);
  window.RD.action("analytics-export", function (routeId) {
    SDK.settlement.downloadRouteAnalyticsReport(routeId);
    window.RD.toast("Report exported");
  });

  /* ══ Reports ═══════════════════════════════════════════════════════════ */

  const SORTS = [
    { key: "newest", label: "Newest first" },
    { key: "oldest", label: "Oldest first" },
    { key: "az",     label: "Name A–Z" },
    { key: "za",     label: "Name Z–A" },
  ];

  window.RD.screen("reports", function () {
    const S = window.RD.state.scratch;
    const summary = SDK.routeDelivery.getReportsSummary().data;
    const sort = S.reportSort || "newest";
    const search = (S.reportSearch || "").trim().toLowerCase();

    let list = D.db.routes.filter(function (r) { return r.status === "CLOSED"; });
    if (search) list = list.filter(function (r) { return r.name.toLowerCase().indexOf(search) !== -1; });
    list = list.slice().sort(function (a, b) {
      if (sort === "az") return a.name.localeCompare(b.name);
      if (sort === "za") return b.name.localeCompare(a.name);
      const d = String(a.scheduledDate).localeCompare(String(b.scheduledDate));
      return sort === "oldest" ? d : -d;
    });

    const rows = list.length
      ? list.map(function (r) {
          return U.Card(
            '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }) + '">' +
              '<div style="' + U.sty({ flex: 1, marginRight: 8 }) + '">' +
                '<div style="' + U.sty({ fontSize: 16, fontWeight: 700, color: "#111" }) + '">' + U.esc(r.name) + "</div>" +
                '<div style="' + U.sty({ fontSize: 13, color: "#888", marginTop: 3 }) + '">' + M.formatRouteDate(r.scheduledDate) + " · " + r.completedStops + "/" + r.totalStops + " stops</div>" +
              "</div>" +
              '<div style="' + U.sty({ fontSize: 16, fontWeight: 800, color: "#16a34a", flexShrink: 0 }) + '">' + U.inr(r.collectedAmount) + "</div>" +
            "</div>" +
            '<div style="margin-top:10px">' + U.BtnSm({ variant: "grey", label: "View Report →", actName: "report-open", arg: r.id }) + "</div>"
          );
        }).join("")
      : U.EmptyState("📊", "No reports yet", "Closed routes appear here with their day's numbers.");

    return U.MobileHeader({ title: "Reports", subtitle: "Completed route reports", onBack: false }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        U.StatGrid(
          U.StatTile(String(summary.totalReports), "Reports", "blue") +
          U.StatTile(U.inr(summary.totalCollected), "Collected", "green")
        ) +
        U.SectionHeader("Report history") +
        '<div style="padding:0 12px 8px">' + U.SearchInput({ value: S.reportSearch || "", model: "report-search", placeholder: "Search reports…", clearAct: "report-search-clear" }) + "</div>" +
        '<div class="rd-noscrollbar" style="' + U.sty({ display: "flex", gap: 7, marginBottom: 14, overflowX: "auto", padding: "0 12px 2px" }) + '">' +
          SORTS.map(function (s) { return U.StatusChip({ active: sort === s.key, label: s.label, actName: "report-sort", arg: s.key }); }).join("") +
        "</div>" +
        rows + U.Spacer(12) +
      "</div>" +
      U.TabBar("reports");
  });

  window.RD.action("report-sort", function (k) { window.RD.state.scratch.reportSort = k; window.RD.render(); });
  window.RD.action("report-search-clear", function () { window.RD.state.scratch.reportSearch = ""; window.RD.render(); });
  window.RD.action("model:report-search", function (v) {
    window.RD.state.scratch.reportSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="report-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("report-open", function (routeId) { window.RD.go("/analytics/" + routeId); });
})();

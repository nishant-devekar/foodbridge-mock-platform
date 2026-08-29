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
          : '<button type="button" disabled style="' + U.sty({ padding: "9px 14px", background: "#e5e7eb", color: "#9ca3af", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700 }) + '">Locked</button>') +
        "</div>";
    }).join("");

    const allDone = flow.allDone;
    const closed = route.status === "CLOSED";

    return U.MobileHeader({ title: "Settle Route", subtitle: route.name, onBack: false }) +
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
  // Matched to QA: a PRODUCT / LOADED / EXPECTED / ACTUAL table where each of
  // the three numeric columns shows a quantity and its value, a per-row "Match"
  // button that fills the expected figure, and a TOTAL row that sums each
  // column live. QA's own table is 430px wide inside a 375px viewport, so the
  // ACTUAL column scrolls horizontally — reproduced rather than redesigned,
  // since QA is the reference. Flagged in the report as a QA usability issue.

  const SC_GRID = "minmax(150px,1fr) 76px 84px 104px";

  function money(n) { return "₹" + (Number(n) || 0).toFixed(2); }

  window.RD.screen("stockCount", function (p) {
    const S = window.RD.state.scratch;
    const sheet = SDK.routeDelivery.getStockCountSheet({ routeId: p.routeId }).data;
    const items = sheet.items || [];
    if (!S.actuals) S.actuals = items.map(function () { return ""; });

    const rowOf = function (it, i) {
      const raw = S.actuals[i];
      const has = raw !== "" && raw != null;
      const actual = has ? parseInt(raw, 10) : 0;
      return {
        it: it, i: i, has: has, actual: actual,
        loadedVal: it.loadedQty * it.unitPrice,
        expectedVal: it.expectedReturn * it.unitPrice,
        actualVal: actual * it.unitPrice,
        mismatch: has && actual !== it.expectedReturn,
      };
    };
    const rows = items.map(rowOf);
    const counted = rows.filter(function (r) { return r.has; }).length;
    const allCounted = counted === items.length && items.length > 0;
    const mismatches = rows.filter(function (r) { return r.mismatch; }).map(function (r) {
      return { productId: r.it.productId, name: r.it.name, expected: r.it.expectedReturn, actual: r.actual, diff: r.actual - r.it.expectedReturn };
    });

    const totals = rows.reduce(function (a, r) {
      a.loaded += r.loadedVal; a.expected += r.expectedVal; a.actual += r.actualVal; return a;
    }, { loaded: 0, expected: 0, actual: 0 });

    const cell = { padding: "10px 8px", fontSize: 13, display: "flex", flexDirection: "column", justifyContent: "center" };

    const head = '<div style="' + U.sty({ display: "grid", gridTemplateColumns: SC_GRID, columnGap: 8, minWidth: 430, background: "white", borderBottom: "2px solid #e5e7eb", position: "sticky", top: 0, zIndex: 5 }) + '">' +
      ["Product", "Loaded", "Expected", "Actual"].map(function (h, i) {
        return '<div style="' + U.sty({ padding: i === 0 ? "10px 8px 10px 12px" : "10px 8px", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", textAlign: i === 0 ? "left" : "right" }) + '">' + h + "</div>";
      }).join("") + "</div>";

    const body = rows.map(function (r, n) {
      return '<div style="' + U.sty({ display: "grid", gridTemplateColumns: SC_GRID, columnGap: 8, minWidth: 430, borderBottom: n < rows.length - 1 ? "1px solid #f5f5f5" : "none", background: r.mismatch ? "#fffbeb" : "white" }) + '">' +
        '<div style="' + U.sty(U.mix(cell, { paddingLeft: 12 })) + '">' +
          '<div style="' + U.sty({ fontWeight: 600, color: "#111" }) + '">' + U.esc(r.it.name) + "</div>" +
          '<div style="' + U.sty({ fontSize: 11, color: "#888", marginTop: 2 }) + '">' + money(r.it.unitPrice) + "</div></div>" +
        '<div style="' + U.sty(U.mix(cell, { alignItems: "flex-end" })) + '">' +
          '<div style="' + U.sty({ fontWeight: 600, color: "#111" }) + '">' + r.it.loadedQty + "</div>" +
          '<div style="' + U.sty({ fontSize: 11, color: "#888", marginTop: 2 }) + '">' + money(r.loadedVal) + "</div></div>" +
        '<div style="' + U.sty(U.mix(cell, { alignItems: "flex-end" })) + '">' +
          '<div style="' + U.sty({ fontWeight: 700, color: "#111" }) + '">' + r.it.expectedReturn + "</div>" +
          '<div style="' + U.sty({ fontSize: 11, color: "#888", marginTop: 2 }) + '">' + money(r.expectedVal) + "</div></div>" +
        '<div style="' + U.sty(U.mix(cell, { alignItems: "flex-end", gap: 4 })) + '">' +
          '<input inputmode="numeric" data-model="count-' + r.i + '" value="' + U.esc(r.has ? String(r.actual) : "") + '" style="' + U.sty({
            width: 50, height: 34, textAlign: "center", fontSize: 14, fontWeight: 700,
            border: "2px solid " + (r.mismatch ? "#fbbf24" : r.has ? "#86efac" : "#e5e7eb"),
            borderRadius: 8, background: "white", color: "#111", outline: "none",
          }) + '" />' +
          '<div style="' + U.sty({ fontSize: 11, color: "#888" }) + '">' + money(r.actualVal) + "</div>" +
          '<button type="button" class="rd-btn-sm"' + U.act("count-match", r.i) + ' style="' + U.sty({
            padding: "3px 8px", fontSize: 11, fontWeight: 700, borderRadius: 8,
            border: "1px solid #bfdbfe", background: "#eff6ff", color: "#1e40af", cursor: "pointer",
          }) + '">Match</button></div>' +
        "</div>";
    }).join("");

    const totalRow = '<div style="' + U.sty({ display: "grid", gridTemplateColumns: SC_GRID, columnGap: 8, minWidth: 430, background: "#f9fafb", borderTop: "2px solid #e5e7eb" }) + '">' +
      '<div style="' + U.sty({ padding: "12px 8px 12px 12px", fontSize: 12, fontWeight: 800, color: "#111", textTransform: "uppercase" }) + '">Total</div>' +
      [totals.loaded, totals.expected, totals.actual].map(function (v) {
        return '<div style="' + U.sty({ padding: "12px 8px", fontSize: 13, fontWeight: 800, color: "#111", textAlign: "right" }) + '">' + money(v) + "</div>";
      }).join("") + "</div>";

    const confirming = !!S.countConfirming;
    const noteMissing = mismatches.length > 0 && !(S.countNote || "").trim();

    const footer = confirming
      ? U.ConfirmPanel({
          // QA's exact copy on this panel.
          action: "Stock Count",
          amount: mismatches.length === 0 ? "All counts match" : mismatches.length + " count" + (mismatches.length > 1 ? "s" : "") + " differ",
          context: mismatches.length === 0 ? "Ready to submit" : "Explain the difference to submit",
          backLabel: "Edit Count", commitLabel: "Submit Count",
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
              (noteMissing ? '<div style="' + U.sty({ fontSize: 11, color: "#ef4444", fontWeight: 600 }) + '">Required before confirming</div>' : "") +
              "</div>"
            : "",
        })
      : U.BtnXL({
          variant: "brand",
          // QA: idle label until EVERY row is counted, then the ready label.
          label: allCounted ? "Confirm Stock Count ✓" : "Enter all counts to continue",
          disabled: !allCounted, actName: "count-confirm",
        });

    return U.MobileHeader({ title: "Stock Count", subtitle: "Count what's left in the vehicle", backLabel: "Settlement", backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: confirming ? 0.4 : 1, pointerEvents: confirming ? "none" : "auto" }) + '">' +
        '<div style="' + U.sty({ margin: "10px 12px", padding: "12px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600, background: "#eff3ff", color: "#1e40af", border: "1px solid #bfdbfe", display: "flex", gap: 8 }) + '">' +
          "<span>📱</span><span>Expected return is auto-calculated. Enter actual count to verify.</span></div>" +
        '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' +
          '<div style="' + U.sty({ overflowX: "auto", WebkitOverflowScrolling: "touch" }) + '">' +
            '<div style="' + U.sty({ minWidth: 430 }) + '">' + head + body + totalRow + "</div></div></div>" +
        U.Spacer(8) +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  // QA's per-row Match: fills the input with the expected figure.
  window.RD.action("count-match", function (idx) {
    const S = window.RD.state.scratch;
    const sheet = SDK.routeDelivery.getStockCountSheet({ routeId: window.RD.state.routeId }).data;
    S.actuals[Number(idx)] = String((sheet.items[Number(idx)] || {}).expectedReturn || 0);
    window.RD.render();
  });

  window.RD.action("model:count#", function (value, idx) {
    const S = window.RD.state.scratch;
    const clean = String(value).replace(/\D/g, "");
    S.actuals[Number(idx)] = clean;
    window.RD.render();
    const el = document.querySelector('[data-model="count-' + idx + '"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
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

  /* ══ Cash Handover ═════════════════════════════════════════════════════ */
  // Matched to QA: a SUMMARY block (opening cash, cash collected, UPI
  // collected, Expense/Cashbreak toggles, Cash to Hand Over), then Actual Cash
  // Counted, a required Delivery Person, and a denomination breakdown that
  // totals live and can be saved.

  const DENOMS = [500, 200, 100, 50, 20, 10];

  window.RD.screen("cashHandover", function (p) {
    const S = window.RD.state.scratch;
    const route = routeOr404(p.routeId);
    const stops = D.getStops(p.routeId);
    const openingCash = (route.checklist && route.checklist.openingCash && route.checklist.openingCash.amount) || 0;
    const cashCollected = stops.filter(function (s) { return s.paymentMethod === "CASH"; }).reduce(function (a, s) { return a + (s.collectedAmount || 0); }, 0);
    const upiCollected = stops.filter(function (s) { return s.paymentMethod === "UPI"; }).reduce(function (a, s) { return a + (s.collectedAmount || 0); }, 0);

    if (S.denoms === undefined) S.denoms = {};
    if (S.person === undefined) S.person = D.db.driver.name;
    if (S.counted === undefined) S.counted = "";

    const expense = Number(S.expense) || 0;
    const toHandOver = openingCash + cashCollected - expense;
    const counted = S.counted === "" ? null : Number(S.counted);
    const diff = counted === null ? 0 : counted - toHandOver;
    const confirming = !!S.handoverConfirming;
    const personOk = (S.person || "").trim().length >= 3;
    const noteMissing = counted !== null && diff !== 0 && !(S.handoverNote || "").trim();
    const panel = S.cashPanel || null;   // 'expense' | 'cashbreak' | null

    const denomTotal = DENOMS.reduce(function (a, d) { return a + d * (Number(S.denoms[d]) || 0); }, 0);

    const row = function (label, value, color) {
      return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px dashed #e5e7eb" }) + '">' +
        '<span style="' + U.sty({ fontSize: 14, color: "#555" }) + '">' + label + "</span>" +
        '<span style="' + U.sty({ fontSize: 15, fontWeight: 700, color: color || "#111" }) + '">' + value + "</span></div>";
    };

    const toggles = '<div style="' + U.sty({ display: "flex", gap: 8, padding: "10px 0 2px" }) + '">' +
      [["expense", "Expense"], ["cashbreak", "Cashbreak"]].map(function (t) {
        const on = panel === t[0];
        return '<button type="button" class="rd-chip"' + U.act("cash-panel", t[0]) + ' style="' + U.sty({
          flex: 1, padding: "9px 10px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer",
          border: "1.5px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#eef6f7" : "white",
          color: on ? U.BRAND : "#6b7280",
        }) + '">' + t[1] + "</button>";
      }).join("") + "</div>";

    const expensePanel = panel === "expense"
      ? '<div style="' + U.sty({ padding: "10px 0 2px" }) + '">' +
          '<input inputmode="numeric" data-model="expense" value="' + U.esc(S.expense || "") + '" placeholder="Enter amount…" style="' + U.sty({
            width: "100%", padding: "11px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb",
            fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
          }) + '" />' +
          '<div style="' + U.sty({ fontSize: 11, color: "#888", marginTop: 6 }) + '">Fuel, tolls and loading are deducted from the cash you hand over.</div></div>'
      : "";

    const cashbreakPanel = panel === "cashbreak"
      ? '<div style="' + U.sty({ padding: "10px 0 2px" }) + '">' +
          '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 70px 90px", columnGap: 8, fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", paddingBottom: 6, borderBottom: "1px solid #e5e7eb" }) + '">' +
            "<div>Currency</div><div style=\"text-align:center\">Qty</div><div style=\"text-align:right\">Amount</div></div>" +
          DENOMS.map(function (d) {
            const qty = Number(S.denoms[d]) || 0;
            return '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 70px 90px", columnGap: 8, alignItems: "center", padding: "7px 0", borderBottom: "1px solid #f5f5f5" }) + '">' +
              '<div style="' + U.sty({ fontSize: 14, fontWeight: 600, color: "#111" }) + '">' + d + "</div>" +
              '<input inputmode="numeric" data-model="denom-' + d + '" value="' + U.esc(qty ? String(qty) : "") + '" placeholder="0" style="' + U.sty({
                width: "100%", height: 34, textAlign: "center", fontSize: 14, fontWeight: 700,
                border: "1.5px solid #e5e7eb", borderRadius: 8, outline: "none", boxSizing: "border-box",
              }) + '" />' +
              '<div style="' + U.sty({ fontSize: 13, fontWeight: 700, textAlign: "right", color: "#111" }) + '">' + U.inr(d * qty) + "</div></div>";
          }).join("") +
          '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 14, fontWeight: 800 }) + '">' +
            "<span>Total</span><span>" + U.inr(denomTotal) + "</span></div>" +
          '<div style="margin-top:10px">' + U.BtnSm({ variant: "grey", label: "Save Breakdown", actName: "cash-save-breakdown" }) + "</div></div>"
      : "";

    const summary = U.Card(
      U.CardTitle("Summary") +
      row("Opening Cash (change)", rawInr(openingCash)) +
      row("Cash Collected", U.inr(cashCollected), "#16a34a") +
      row("UPI Collected", U.inr(upiCollected), "#2563eb") +
      toggles + expensePanel + cashbreakPanel +
      '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, marginTop: 4, borderTop: "1px solid #e5e7eb" }) + '">' +
        '<span style="' + U.sty({ fontSize: 15, fontWeight: 700, color: "#111" }) + '">Cash to Hand Over</span>' +
        '<span style="' + U.sty({ fontSize: 20, fontWeight: 800, color: "#111" }) + '">' + U.inr(toHandOver) + "</span></div>"
    );

    const entry = U.Card(
      '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }) + '">Actual Cash Counted</div>' +
      '<input inputmode="numeric" data-model="counted" value="' + U.esc(S.counted) + '" placeholder="0" style="' + U.sty({
        width: "100%", padding: "13px 14px", borderRadius: 12, boxSizing: "border-box",
        border: "2px solid " + (counted === null ? "#e5e7eb" : diff === 0 ? "#86efac" : "#fbbf24"),
        fontSize: 22, fontFamily: "inherit", fontWeight: 800, textAlign: "center",
        background: counted !== null && diff !== 0 ? "#fffbeb" : "white", color: "#111", outline: "none",
      }) + '" />' +
      (counted !== null
        ? '<div style="' + U.sty({ marginTop: 8, textAlign: "center", fontSize: 14, fontWeight: 800, color: diff === 0 ? "#16a34a" : "#b45309" }) + '">' +
          (diff === 0 ? "✓ Matches exactly" : (diff > 0 ? "▲ " + rawInr(Math.abs(diff)) + " over" : "▼ " + rawInr(Math.abs(diff)) + " short")) + "</div>"
        : "") +
      '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px", margin: "16px 0 8px" }) + '">Delivery Person *</div>' +
      '<input type="text" data-model="person" value="' + U.esc(S.person || "") + '" placeholder="Enter delivery person\'s name (min. 3 chars)" style="' + U.sty({
        width: "100%", padding: "11px 14px", borderRadius: 10, boxSizing: "border-box",
        border: "1.5px solid " + (personOk ? "#e5e7eb" : "#fbbf24"),
        fontSize: 14, fontFamily: "inherit", outline: "none",
      }) + '" />'
    );

    const footer = confirming
      ? U.ConfirmPanel({
          action: "Cash Handover", amount: U.inr(counted || 0),
          context: diff === 0 ? "Matches expected exactly" : (diff > 0 ? rawInr(Math.abs(diff)) + " over expected" : rawInr(Math.abs(diff)) + " short of expected"),
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
      : U.BtnXL({
          variant: "brand",
          label: counted === null ? "Count cash to continue" : !personOk ? "Enter the delivery person" : "Hand Over " + U.inr(counted) + " →",
          disabled: counted === null || !personOk, actName: "handover-confirm",
        });

    return U.MobileHeader({ title: "Cash Handover", subtitle: "Count your cash before handing over", backLabel: "Settlement", backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: confirming ? 0.4 : 1, pointerEvents: confirming ? "none" : "auto" }) + '">' +
        U.Spacer(12) + summary + entry + U.Spacer(12) +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  window.RD.action("cash-panel", function (which) {
    const S = window.RD.state.scratch;
    S.cashPanel = S.cashPanel === which ? null : which;
    window.RD.render();
  });
  window.RD.action("model:denom#", function (value, d) {
    const S = window.RD.state.scratch;
    S.denoms[d] = Number(String(value).replace(/\D/g, "")) || 0;
    window.RD.render();
    const el = document.querySelector('[data-model="denom-' + d + '"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("model:person", function (v) {
    const S = window.RD.state.scratch;
    const was = (S.person || "").trim().length >= 3;
    S.person = v;
    if (was !== (v.trim().length >= 3)) {
      window.RD.render();
      const el = document.querySelector('[data-model="person"]');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  });
  window.RD.action("cash-save-breakdown", function () {
    const S = window.RD.state.scratch;
    const total = DENOMS.reduce(function (a, d) { return a + d * (Number(S.denoms[d]) || 0); }, 0);
    // Saving the breakdown fills the counted figure from it, which is the point
    // of counting by denomination in the first place.
    S.counted = String(total);
    window.RD.toast("Breakdown saved · " + U.inr(total) + " counted");
    window.RD.render();
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
  // One screen behind two routes (#/closed/:id and #/analytics/:id), matched to
  // QA: a score with a band label, a PERFORMANCE grid, HIGHLIGHTS, and four
  // collapsible summaries. Export opens a modal rather than downloading blindly.

  // QA bands: 8/100 reads "Needs Attention", 91/100 "Excellent Beat".
  function scoreBand(v) {
    if (v >= 80) return "Excellent Beat";
    if (v >= 50) return "Good Beat";
    return "Needs Attention";
  }

  function Accordion(key, title, subtitle, bodyHtml) {
    const open = window.RD.state.scratch["acc_" + key] === true;
    return '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' +
      '<button type="button"' + U.act("acc-toggle", key) + ' style="' + U.sty({
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, padding: "14px 16px", background: "none", border: "none",
        textAlign: "left", fontFamily: "inherit", cursor: "pointer",
      }) + '">' +
        '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 12, fontWeight: 800, color: "#888", textTransform: "uppercase", letterSpacing: "0.5px" }) + '">' + U.esc(title) + "</div>" +
          '<div style="' + U.sty({ fontSize: 12, color: "#7b8490", marginTop: 3 }) + '">' + U.esc(subtitle) + "</div>" +
        "</div>" +
        '<span style="' + U.sty({ fontSize: 12, color: "#9ca3af", flexShrink: 0 }) + '">' + (open ? "▲" : "▼") + "</span></button>" +
      (open ? '<div style="' + U.sty({ padding: "0 16px 14px", borderTop: "1px solid #f3f4f6" }) + '">' + bodyHtml + "</div>" : "") +
      "</div>";
  }

  function miniTable(headers, rows, totalRow) {
    const cols = headers.length;
    const grid = "minmax(110px,1fr)" + " 1fr".repeat(cols - 1);
    const cell = { padding: "8px 4px", fontSize: 12 };
    return '<div style="' + U.sty({ overflowX: "auto" }) + '"><div style="' + U.sty({ minWidth: 300 }) + '">' +
      '<div style="' + U.sty({ display: "grid", gridTemplateColumns: grid, columnGap: 6, borderBottom: "1px solid #e5e7eb", paddingTop: 10 }) + '">' +
        headers.map(function (h, i) { return '<div style="' + U.sty(U.mix(cell, { fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", textAlign: i ? "right" : "left" })) + '">' + U.esc(h) + "</div>"; }).join("") + "</div>" +
      rows.map(function (r) {
        return '<div style="' + U.sty({ display: "grid", gridTemplateColumns: grid, columnGap: 6, borderBottom: "1px solid #f5f5f5" }) + '">' +
          r.map(function (c, i) { return '<div style="' + U.sty(U.mix(cell, { textAlign: i ? "right" : "left", color: "#111", fontWeight: i ? 600 : 500 })) + '">' + c + "</div>"; }).join("") + "</div>";
      }).join("") +
      (totalRow ? '<div style="' + U.sty({ display: "grid", gridTemplateColumns: grid, columnGap: 6, background: "#f9fafb" }) + '">' +
        totalRow.map(function (c, i) { return '<div style="' + U.sty(U.mix(cell, { textAlign: i ? "right" : "left", fontWeight: 800, color: "#111" })) + '">' + c + "</div>"; }).join("") + "</div>" : "") +
      "</div></div>";
  }

  function analyticsScreen(p) {
    const route = routeOr404(p.routeId);
    const a = SDK.settlement.getRouteAnalytics(p.routeId).data;
    const stops = D.getStops(p.routeId);
    const delivered = stops.filter(function (s) { return s.status === "DELIVERED"; });
    const load = D.db.stockLoads[p.routeId];
    const products = (load && load.products) || [];
    const scoreVal = (a.score && a.score.value) || 0;
    const S = window.RD.state.scratch;

    const kpis = '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 12px" }) + '">' +
      (a.kpis || []).map(function (k) {
        // QA spells this "Avg Time / Stop", with spaces around the slash.
        const label = k.label === "Avg Time/Stop" ? "Avg Time / Stop" : k.label;
        return '<div style="' + U.sty({ background: "white", borderRadius: 14, padding: 14 }) + '">' +
          '<div style="' + U.sty({ fontSize: 11, color: "#888", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }) + '">' + U.esc(label) + "</div>" +
          '<div style="' + U.sty({ fontSize: 20, fontWeight: 800, color: "#111", marginTop: 4 }) + '">' + U.esc(k.value) + "</div>" +
          (k.percentage ? '<div style="' + U.sty({ height: 5, background: "#e5e7eb", borderRadius: 3, marginTop: 8, overflow: "hidden" }) + '">' +
            '<div style="' + U.sty({ height: "100%", width: k.percentage + "%", background: U.GREEN, borderRadius: 3 }) + '"></div></div>' : "") +
          "</div>";
      }).join("") + "</div>";

    // HIGHLIGHTS — QA surfaces notable facts about the day here.
    const advanceTotal = stops.reduce(function (t, s) { return t + (s.advanceAmount || 0); }, 0);
    const skipped = stops.filter(function (s) { return s.status === "SKIPPED"; }).length;
    const highlights = [];
    if (advanceTotal > 0) highlights.push("✅ " + U.inr(advanceTotal) + " over payment collected");
    if (route.outstandingAmount > 0) highlights.push("⚠️ " + U.inr(route.outstandingAmount) + " left outstanding");
    if (skipped > 0) highlights.push("⏭️ " + skipped + " stop" + (skipped > 1 ? "s" : "") + " skipped");
    const highlightsBlock = highlights.length
      ? U.SectionHeader("Highlights") + U.Card(highlights.map(function (h, i) {
          return '<div style="' + U.sty({ fontSize: 13, color: "#374151", padding: "6px 0", borderBottom: i < highlights.length - 1 ? "1px solid #f5f5f5" : "none" }) + '">' + h + "</div>";
        }).join(""))
      : "";

    const stopsRows = delivered.map(function (s) {
      return [U.esc(s.customerName), "1", "0", "0", "0"];
    });
    const stockRows = products.map(function (pr) {
      const sold = Math.round(pr.loadedQty * (delivered.length / Math.max(stops.length, 1)));
      const ret = Math.max(0, pr.loadedQty - sold);
      return [U.esc(pr.name) + '<div style="font-size:11px;color:#888">' + money(pr.unitPrice) + "</div>",
        pr.loadedQty + '<div style="font-size:11px;color:#888">' + money(pr.loadedQty * pr.unitPrice) + "</div>",
        sold + '<div style="font-size:11px;color:#888">' + money(sold * pr.unitPrice) + "</div>",
        ret + '<div style="font-size:11px;color:#888">' + money(ret * pr.unitPrice) + "</div>"];
    });
    const totLoaded = products.reduce(function (t, pr) { return t + pr.loadedQty * pr.unitPrice; }, 0);
    const totSold = products.reduce(function (t, pr) { return t + Math.round(pr.loadedQty * (delivered.length / Math.max(stops.length, 1))) * pr.unitPrice; }, 0);

    const cf = a.carriedForward || {};
    const collected = route.collectedAmount || 0;

    return U.MobileHeader({
        title: "Route Intelligence",
        subtitle: route.name + " · " + M.formatRouteDate(route.scheduledDate),
        backLabel: "Routes", backAct: "home",
      }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        U.Card(
          '<div style="' + U.sty({ display: "flex", alignItems: "center", gap: 16 }) + '">' +
            '<div style="' + U.sty({ textAlign: "center" }) + '">' +
              '<div style="' + U.sty({ fontSize: 44, fontWeight: 900, color: U.BRAND, lineHeight: 1 }) + '">' + scoreVal + "</div>" +
              '<div style="' + U.sty({ fontSize: 11, color: "#888" }) + '">/' + ((a.score && a.score.max) || 100) + "</div></div>" +
            '<div style="' + U.sty({ flex: 1 }) + '">' +
              '<div style="' + U.sty({ fontSize: 16, fontWeight: 800, color: "#111" }) + '">' + scoreBand(scoreVal) + "</div>" +
              '<div style="' + U.sty({ fontSize: 13, color: "#888", marginTop: 2 }) + '">' + U.esc((a.score && a.score.percentileText) || "") + "</div></div>" +
            U.BtnSm({ variant: "grey", label: "Export", actName: "analytics-export", arg: p.routeId, style: { flex: "0 0 auto" } }) +
          "</div>"
        ) +
        U.SectionHeader("Performance") + kpis + U.Spacer(12) +
        highlightsBlock +
        Accordion("stops", "Stops Summary", delivered.length + " delivered",
          miniTable(["Customer", "Delivered", "Returned", "Asset Given", "Asset Taken"], stopsRows)) +
        Accordion("stock", "Stock Summary",
          products.reduce(function (t, pr) { return t + pr.loadedQty; }, 0) + " loaded · " +
          delivered.length + " delivered · " + Math.max(0, products.reduce(function (t, pr) { return t + pr.loadedQty; }, 0) - delivered.length) + " returned",
          miniTable(["Product", "Loaded", "Delivered", "Return"], stockRows,
            ["Total", money(totLoaded), money(totSold), money(totLoaded - totSold)])) +
        Accordion("expense", "Expense Summary", "0 expenses · ₹0 total · 0 documents",
          '<div style="' + U.sty({ padding: "14px 0", fontSize: 13, color: "#888", textAlign: "center" }) + '">No expense details recorded</div>') +
        Accordion("collection", "Collection Summary", U.inr(collected) + " collected · " + U.inr(route.outstandingAmount) + " outstanding",
          U.SettleRow("Amount Collected", U.inr(collected), "#16a34a") +
          U.SettleRow("Outstanding Amount", U.inr(route.outstandingAmount), route.outstandingAmount > 0 ? "#ef4444" : "#111") +
          U.SettleRow("Over Payment", U.inr(advanceTotal), "#16a34a", true)) +
        U.Spacer(12) +
      "</div>" +
      (S.exportOpen ? ExportModal(p.routeId) : "") +
      U.TabBar("reports");
  }

  // QA's export modal: a titled sheet with Close / Preview / Download.
  function ExportModal(routeId) {
    return '<div style="' + U.sty({ position: "absolute", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "flex-end" }) + '">' +
      '<div style="' + U.sty({ width: "100%", background: "white", borderRadius: "18px 18px 0 0", padding: 18 }) + '">' +
        '<div style="' + U.sty({ fontSize: 16, fontWeight: 800, color: "#111", marginBottom: 4 }) + '">📊 Route Analytics Report</div>' +
        '<div style="' + U.sty({ fontSize: 13, color: "#888", marginBottom: 16 }) + '">Preview the report or download it for sharing.</div>' +
        '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
          U.BtnSm({ variant: "grey", label: "Close", actName: "export-close" }) +
          U.BtnSm({ variant: "grey", label: "Preview", actName: "export-preview" }) +
          U.BtnSm({ variant: "brand", label: "Download", actName: "export-download", arg: routeId }) +
        "</div></div></div>";
  }

  window.RD.screen("closed", analyticsScreen);
  window.RD.screen("analytics", analyticsScreen);
  window.RD.action("acc-toggle", function (key) {
    const S = window.RD.state.scratch;
    S["acc_" + key] = !S["acc_" + key];
    window.RD.render();
  });
  window.RD.action("analytics-export", function () { window.RD.state.scratch.exportOpen = true; window.RD.render(); });
  window.RD.action("export-close", function () { window.RD.state.scratch.exportOpen = false; window.RD.render(); });
  window.RD.action("export-preview", function () { window.RD.toast("Report preview opened"); });
  window.RD.action("export-download", function (routeId) {
    SDK.settlement.downloadRouteAnalyticsReport(routeId);
    window.RD.state.scratch.exportOpen = false;
    window.RD.toast("Report downloaded");
    window.RD.render();
  });

  /* ══ Reports ═══════════════════════════════════════════════════════════ */
  // Matched to QA: a two-tile header, a sentence-case "Report history" label
  // (not the uppercase SectionHeader used elsewhere), an "All dates" chip
  // alongside the sort chips, and cards carrying a Final badge with a
  // Collected/Outstanding pair.

  const SORTS = [
    { key: "newest", label: "Newest first" },
    { key: "oldest", label: "Oldest first" },
    { key: "az",     label: "Name A–Z" },
    { key: "za",     label: "Name Z–A" },
  ];

  function ReportCard(r) {
    const stat = function (label, value, color) {
      return "<div><div style=\"font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase\">" + label + "</div>" +
        '<div style="' + U.sty({ marginTop: 3, fontSize: 14, fontWeight: 800, color: color }) + '">' + value + "</div></div>";
    };
    return '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' +
      '<div style="' + U.sty({ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }) + '">' +
        '<div style="' + U.sty({ minWidth: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 17, fontWeight: 800, color: "#111827", lineHeight: 1.25, overflowWrap: "anywhere" }) + '">' + U.esc(r.name) + "</div>" +
          '<div style="' + U.sty({ marginTop: 5, fontSize: 12, color: "#7b8490" }) + '">' + M.formatRouteDate(r.scheduledDate) + " · " + r.completedStops + "/" + r.totalStops + " completed</div>" +
        "</div>" +
        '<span style="' + U.sty({ padding: "4px 9px", borderRadius: 20, background: "#edfdf3", color: "#2d7a42", fontSize: 10, fontWeight: 800, flexShrink: 0 }) + '">Final</span>' +
      "</div>" +
      '<div style="' + U.sty({ display: "flex", gap: 18, margin: "14px 0" }) + '">' +
        stat("Collected", U.inr(r.collectedAmount), "#43A047") +
        stat("Outstanding", U.inr(r.outstandingAmount), "#f97316") +
      "</div>" +
      '<button type="button"' + U.act("report-open", r.id) + ' style="' + U.sty({
        width: "100%", minHeight: 46, border: "1.5px solid " + U.BRAND, borderRadius: 13,
        background: "white", color: U.BRAND, fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer",
      }) + '">View Report →</button>' +
      "</div>";
  }

  window.RD.screen("reports", function () {
    const S = window.RD.state.scratch;
    const summary = SDK.routeDelivery.getReportsSummary().data;
    const sort = S.reportSort || "newest";
    const search = (S.reportSearch || "").trim().toLowerCase();

    let list = D.db.routes.filter(function (r) { return r.status === "CLOSED"; });
    if (S.reportDate) list = list.filter(function (r) { return r.scheduledDate === S.reportDate; });
    if (search) list = list.filter(function (r) { return r.name.toLowerCase().indexOf(search) !== -1; });
    list = list.slice().sort(function (a, b) {
      if (sort === "az") return a.name.localeCompare(b.name);
      if (sort === "za") return b.name.localeCompare(a.name);
      const d = String(a.scheduledDate).localeCompare(String(b.scheduledDate));
      return sort === "oldest" ? d : -d;
    });

    const chip = function (label, active, actName, arg) {
      return '<button type="button" class="rd-chip"' + U.act(actName, arg) + ' style="' + U.sty({
        minHeight: 34, padding: "0 12px", borderRadius: 12, fontSize: 12, fontWeight: 700,
        border: "1.5px solid " + (active ? U.BRAND : "#e1e5ea"),
        background: active ? "#eef6f7" : "white", color: active ? U.BRAND : "#667085",
        cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
      }) + '">' + U.esc(label) + "</button>";
    };

    const rows = list.length
      ? list.map(ReportCard).join("")
      : U.EmptyState("📊", "No reports yet", "Closed routes appear here with their day's numbers.");

    return U.MobileHeader({ title: "Reports", subtitle: "Completed route reports", onBack: false }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        U.StatGrid(
          U.StatTile(String(summary.totalReports), "Reports", "blue") +
          U.StatTile(U.inr(summary.totalCollected), "Collected", "green")
        ) +
        // Sentence case and 15px, exactly as QA renders it — not the uppercase
        // SectionHeader the other screens use.
        '<div style="' + U.sty({ fontSize: 15, fontWeight: 700, color: "#111", padding: "14px 16px 8px" }) + '">Report history</div>' +
        '<div style="padding:0 12px 8px">' + U.SearchInput({ value: S.reportSearch || "", model: "report-search", placeholder: "Search reports…", clearAct: "report-search-clear" }) + "</div>" +
        '<div class="rd-noscrollbar" style="' + U.sty({ display: "flex", gap: 7, marginBottom: 14, overflowX: "auto", padding: "0 12px 2px" }) + '">' +
          chip(S.reportDate ? M.formatRouteDate(S.reportDate) : "All dates", !!S.reportDate, "report-date-clear") +
          SORTS.map(function (o) { return chip(o.label, sort === o.key, "report-sort", o.key); }).join("") +
        "</div>" +
        rows + U.Spacer(12) +
      "</div>" +
      U.TabBar("reports");
  });

  window.RD.action("report-date-clear", function () { window.RD.state.scratch.reportDate = null; window.RD.render(); });

  window.RD.action("report-sort", function (k) { window.RD.state.scratch.reportSort = k; window.RD.render(); });
  window.RD.action("report-search-clear", function () { window.RD.state.scratch.reportSearch = ""; window.RD.render(); });
  window.RD.action("model:report-search", function (v) {
    window.RD.state.scratch.reportSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="report-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("report-open", function (routeId) { window.RD.go("/analytics/" + routeId); });
})();

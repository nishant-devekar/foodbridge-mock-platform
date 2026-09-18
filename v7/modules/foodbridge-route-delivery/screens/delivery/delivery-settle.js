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
          : '<button type="button" disabled style="' + U.sty({ padding: "9px 14px", background: "#e5e7eb", color: "#9ca3af", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600 }) + '">Locked</button>') +
        "</div>";
    }).join("");

    const allDone = flow.allDone;
    // QA picks the CTA by privilege, not by route state: a user with
    // VIEW_REPORT always gets the green "View Route Summary" once both steps
    // are done, and it opens the closed-route summary. This cut has that
    // privilege, so it matches what QA renders for the signed-in user.
    const canViewReport = true;

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
        ? U.ActionBar(canViewReport
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
      window.RD.render();
    }
  });
  window.RD.action("settle-close", function (routeId) {
    SDK.settlement.closeRoute(routeId);
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

  const SC_GRID = "160px 62px 74px minmax(100px, 1fr)";

  // en-IN grouping with two decimals, as StockCount.jsx formatCurrency does —
  // toFixed alone drops the lakh separators the rest of the app uses.
  function money(n) {
    return "₹" + (Number(n) || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

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

    // The header is its own 42px sticky bar, and the Product label is drawn
    // twice: once in the scrolling grid and once absolutely over the left
    // column with a white shadow, so the name column stays readable while the rest
    // scrolls sideways. Reproduced from QA rather than simplified — the second
    // copy is what keeps the header aligned with the sticky body column.
    const head = '<div style="' + U.sty({ position: "sticky", top: 0, zIndex: 30, height: 42, boxSizing: "border-box", overflow: "hidden", isolation: "isolate", background: "white", borderBottom: "2px solid #e5e7eb" }) + '">' +
      '<div style="' + U.sty({ display: "grid", gridTemplateColumns: SC_GRID, columnGap: 8, minWidth: 430, width: "100%", background: "white" }) + '">' +
        ["Product", "Loaded", "Expected", "Actual"].map(function (h, i) {
          return '<div style="' + U.sty({ padding: i === 0 ? "10px 8px 10px 12px" : "10px 8px", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", textAlign: i === 3 ? "center" : i > 0 ? "right" : "left" }) + '">' + h + "</div>";
        }).join("") +
      "</div>" +
      '<div style="' + U.sty({ position: "absolute", inset: "0 auto 0 0", zIndex: 2, width: 160, boxSizing: "border-box", padding: "10px 8px 10px 12px", background: "white", boxShadow: "6px 0 8px rgba(255,255,255,0.95)", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase" }) + '">Product</div>' +
    "</div>";

    const AMOUNT_COLOR = "#676768";
    const body = '<div style="' + U.sty({ display: "grid", gridTemplateColumns: SC_GRID, columnGap: 8, width: "100%", background: "white" }) + '">' +
      rows.map(function (r, n) {
        const rowBorder = n < rows.length - 1 ? "1px solid #f5f5f5" : "none";
        const amt = function (v) { return '<div style="' + U.sty({ marginTop: 4, fontSize: 9.5, fontWeight: 700, color: AMOUNT_COLOR, whiteSpace: "nowrap" }) + '">' + money(v) + "</div>"; };
        return '<div style="' + U.sty({
            position: "sticky", left: 0, zIndex: 2, background: "white", boxSizing: "border-box",
            padding: "13px 12px", borderBottom: rowBorder, display: "flex", flexDirection: "column",
            justifyContent: "center", color: "#111", lineHeight: 1.25,
          }) + '">' +
            '<div style="' + U.sty({ whiteSpace: "normal", overflowWrap: "anywhere", fontSize: 14, fontWeight: 600 }) + '">' + U.esc(r.it.name) + "</div>" +
            amt(r.it.unitPrice) +
          "</div>" +
          '<div style="' + U.sty({ padding: "13px 8px", borderBottom: rowBorder, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", textAlign: "right" }) + '">' +
            '<div style="' + U.sty({ fontSize: 14, fontWeight: 800, color: "#374151" }) + '">' + r.it.loadedQty + "</div>" + amt(r.loadedVal) +
          "</div>" +
          '<div style="' + U.sty({ padding: "13px 8px", borderBottom: rowBorder, display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", textAlign: "right" }) + '">' +
            '<div style="' + U.sty({ fontSize: 14, fontWeight: 800, color: "#374151" }) + '">' + r.it.expectedReturn + "</div>" + amt(r.expectedVal) +
          "</div>" +
          '<div style="' + U.sty({ padding: "13px 0", borderBottom: rowBorder, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }) + '">' +
            '<div style="' + U.sty({ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 6, paddingLeft: 10 }) + '">' +
              '<div style="' + U.sty({ width: 50, display: "flex", flexDirection: "column", alignItems: "center" }) + '">' +
                '<input inputmode="numeric" data-model="count-' + r.i + '" value="' + U.esc(r.has ? String(r.actual) : "") + '" style="' + U.sty({
                  width: 50, height: 30, boxSizing: "border-box", padding: 4, outline: "none", borderRadius: 10,
                  fontSize: 15, fontWeight: 700, textAlign: "center",
                  border: "2px solid " + (r.mismatch ? "#ef4444" : U.BRAND),
                  background: r.mismatch ? "#fef2f2" : "#e8f5f7",
                  color: r.mismatch ? "#ef4444" : "#111",
                }) + '" />' +
                '<div style="' + U.sty({ marginTop: 2, width: "100%", textAlign: "center", fontSize: 9.5, fontWeight: 700, color: AMOUNT_COLOR, whiteSpace: "nowrap" }) + '">' + money(r.actualVal) + "</div>" +
              "</div>" +
              '<button type="button"' + U.act("count-match", r.i) + ' style="' + U.sty({
                width: 40, minHeight: 30, border: "2px solid " + U.BRAND, borderRadius: 10, background: "white",
                color: U.BRAND, fontSize: 9, fontWeight: 700, cursor: "pointer", padding: "0 2px",
              }) + '">Match</button>' +
            "</div>" +
          "</div>";
      }).join("") +
      // The totals live inside the same grid, so their columns line up with the
      // rows above them however wide the table gets.
      (function () {
        const border = "1px solid #dbe4ee";
        const cellStyle = { padding: "12px 8px", borderTop: border, display: "flex", alignItems: "center", justifyContent: "start", textAlign: "right", fontSize: 10.5, fontWeight: 800, color: AMOUNT_COLOR, whiteSpace: "nowrap" };
        return '<div style="' + U.sty({ position: "sticky", left: 0, zIndex: 2, background: "white", padding: 12, borderTop: border, fontSize: 11, fontWeight: 900, textTransform: "uppercase", color: AMOUNT_COLOR }) + '">Total</div>' +
          [totals.loaded, totals.expected, totals.actual].map(function (v) {
            return '<div style="' + U.sty(cellStyle) + '">' + money(v) + "</div>";
          }).join("");
      })() +
    "</div>";

    const confirming = !!S.countConfirming;
    const noteMissing = mismatches.length > 0 && !(S.countNote || "").trim();

    const footer = confirming
      ? U.ConfirmPanel({
          // QA's exact copy on this panel.
          action: "Stock Count",
          amount: mismatches.length === 0 ? "All counts match" : mismatches.length + " discrepanc" + (mismatches.length !== 1 ? "ies" : "y"),
          context: mismatches.length === 0 ? "Ready to submit" : "Review and explain before submitting",
          backLabel: "Edit Count", commitLabel: "Submit Count",
          disabled: noteMissing, commitAct: "count-commit", arg: p.routeId,
          // QA groups the textarea and its "Required" line in their own wrapper,
          // so the gap-8 column spaces the amber box from the pair, and the
          // line sits 2px under the field.
          extra: mismatches.length > 0
            ? '<div style="' + U.sty({ display: "flex", flexDirection: "column", gap: 8 }) + '">' +
              '<div style="' + U.sty({ background: "#fff7ed", borderRadius: 10, border: "1px solid #fed7aa", padding: "10px 12px" }) + '">' +
                mismatches.map(function (m) {
                  return '<div style="' + U.sty({ fontSize: 12, color: "#92400e", marginBottom: 2 }) + '">· <strong>' + U.esc(m.name) + ":</strong> expected " + m.expected + ", got " + m.actual + " (" + Math.abs(m.diff) + " " + (m.diff < 0 ? "missing" : "excess") + ")</div>";
                }).join("") + "</div>" +
              "<div>" +
                '<textarea data-model="count-note" rows="2" placeholder="Explain the discrepancy…" style="' + U.sty({
                  width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13,
                  border: "1.5px solid " + (noteMissing ? "#ef4444" : "#fbbf24"),
                  background: "#fffbeb", color: "#111", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "none",
                }) + '">' + U.esc(S.countNote || "") + "</textarea>" +
                (noteMissing ? '<div style="' + U.sty({ fontSize: 11, color: "#ef4444", fontWeight: 600, marginTop: 2 }) + '">Required before confirming</div>' : "") +
              "</div>" +
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
        // The note sits in its own row (QA reserves the space beside it), with a
        // 10px spacer under it rather than a bottom margin.
        '<div style="' + U.sty({ display: "flex", alignItems: "center", gap: 8, margin: "10px 12px 0" }) + '">' +
          '<div style="' + U.sty({ flex: 1, padding: "12px 14px", borderRadius: 14, fontSize: 13, fontWeight: 600, background: "#eff3ff", color: "#1e40af", border: "1px solid #bfdbfe", display: "flex", gap: 8 }) + '">' +
            "<span>📱</span><span>Expected return is auto-calculated. Enter actual count to verify.</span></div>" +
        "</div>" +
        '<div style="' + U.sty({ height: 10 }) + '"></div>' +
        '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", overflow: "visible", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' + head +
          '<div style="' + U.sty({ overflowX: "auto", overflowY: "visible", WebkitOverflowScrolling: "touch", borderRadius: "0 0 16px 16px" }) + '">' +
            '<div style="' + U.sty({ minWidth: 430, width: "100%", background: "white" }) + '">' + body + "</div></div></div>" +
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
    window.RD.go("/settlement/" + routeId);
  });

  /* ══ Cash Handover ═════════════════════════════════════════════════════ */
  // Matched to QA: a SUMMARY block (opening cash, cash collected, UPI
  // collected, Expense/Cashbreak toggles, Cash to Hand Over), then Actual Cash
  // Counted, a required Delivery Person, and a denomination breakdown that
  // totals live and can be saved.

  // The org's configured expense categories, as QA reads them from
  // appProp.settlementFeatures.expenseTypes.
  const EXPENSE_TYPES = [
    { key: "routeBhatta",  label: "Route Bhatta",  defaultAmount: 0, required: false, editableName: false, order: 1, active: true },
    { key: "tollRecharge", label: "Toll Recharge", defaultAmount: 0, required: false, editableName: false, order: 2, active: true },
    { key: "police",       label: "Police",        defaultAmount: 0, required: false, editableName: false, order: 3, active: true },
    { key: "diesel",       label: "Diesel",        defaultAmount: 0, required: false, editableName: false, order: 4, active: true },
  ].filter(function (t) { return t.active !== false; }).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

  const DENOMS = [500, 200, 100, 50, 20, 10];

  window.RD.screen("cashHandover", function (p) {
    const S = window.RD.state.scratch;
    const route = routeOr404(p.routeId);
    const stops = D.getStops(p.routeId);
    const openingCash = (route.checklist && route.checklist.openingCash && route.checklist.openingCash.amount) || 0;
    const cashCollected = stops.filter(function (s) { return s.paymentMethod === "CASH"; }).reduce(function (a, s) { return a + (s.collectedAmount || 0); }, 0);
    const upiCollected = stops.filter(function (s) { return s.paymentMethod === "UPI"; }).reduce(function (a, s) { return a + (s.collectedAmount || 0); }, 0);

    if (S.denoms === undefined) S.denoms = {};
    // QA seeds Cash Handover from the org's configured expense types
    // (appProp.settlementFeatures.expenseTypes); this is the set this org has.
    if (S.expenses === undefined) S.expenses = EXPENSE_TYPES.map(function (t) {
      return {
        id: t.key, name: t.label, amount: t.defaultAmount ? String(t.defaultAmount) : "",
        editableName: t.editableName !== false, required: t.required === true,
      };
    });
    if (S.person === undefined) S.person = "";
    if (S.counted === undefined) S.counted = "";

    // getCashToHandOver: expenses come out of the float first, and the figure
    // never goes below zero.
    const expenseTotal = M.roundMoney(S.expenses.reduce(function (a, e) { return a + (parseFloat(e.amount) || 0); }, 0));
    const toHandOver = Math.max(0, M.roundMoney(openingCash + cashCollected - expenseTotal));
    const counted = S.counted === "" ? null : Number(S.counted);
    const diff = counted === null ? 0 : M.roundMoney(counted - toHandOver);
    const confirming = !!S.handoverConfirming;
    const personOk = (S.person || "").trim().length >= 3;
    const personShort = (S.person || "").trim().length > 0 && (S.person || "").trim().length < 3;
    const hasCounted = counted !== null && !isNaN(counted);
    const denomTotal = DENOMS.reduce(function (a, d) { return a + d * (Number(S.denoms[d]) || 0); }, 0);

    // A 26x26 flat icon button — QA's expense/cashbreak affordances, which have
    // no border or radius of their own.
    const iconBtn = function (inner, actName, arg, off) {
      return '<button type="button"' + (off ? "" : U.act(actName, arg)) + ' style="' + U.sty(U.mix({
        width: 26, height: 26, background: "#f7fcfd", color: U.BRAND, fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
      }, off ? { background: "#f3f4f6", color: "#cbd5e1", cursor: "not-allowed", opacity: 0.7 } : null)) + '">' + inner + "</button>";
    };
    const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="width:14px;height:14px"><path d="M5 12h14"/><path d="M12 5v14"/></svg>';
    const CLIP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M13.234 20.252 21 12.3"/><path d="m16 6-8.414 8.586a2 2 0 0 0 0 2.828 2 2 0 0 0 2.828 0l8.414-8.586a4 4 0 0 0 0-5.656 4 4 0 0 0-5.656 0l-8.415 8.585a6 6 0 1 0 8.486 8.486"/></svg>';
    // The lucide icons QA uses in this section, at their rendered sizes.
    const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" style="width:13px;height:13px"><path d="M20 6 9 17l-5-5"/></svg>';
    const PENCIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="width:12px;height:12px"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>';
    const CROSS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    // The row-level actions are 26x26 too, but rounded and tinted per action.
    const smallBtn = function (inner, actName, arg, color, bg) {
      return '<button type="button"' + U.act(actName, arg) + ' style="' + U.sty({
        width: 26, height: 26, borderRadius: 8, border: "none", fontFamily: "inherit",
        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        color: color, background: bg,
      }) + '">' + inner + "</button>";
    };
    const CHEV = function (open) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="' + U.sty({
        width: 13, height: 13, color: "#9ca3af", transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0,
      }) + '"><path d="m9 18 6-6-6-6"/></svg>';
    };

    const expenseRows = (S.expensesOpen && S.expenses.length)
      ? '<div style="' + U.sty({ margin: "-2px 0 8px", display: "flex", flexDirection: "column" }) + '">' +
          S.expenses.map(function (e, i) {
            const editing = S.expenseEditing === e.id;
            const shell = { minWidth: 0, height: 34, padding: "5px 10px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "center" };
            const field = { width: "100%", height: 22, padding: 0, border: "none", background: "transparent", color: "#111", boxSizing: "border-box", fontSize: 12, fontFamily: "inherit", outline: "none" };
            const amount = parseFloat(e.amount) || 0;
            return '<div style="' + U.sty({ padding: editing ? "4px 0 8px" : "7px 0", borderBottom: i < S.expenses.length - 1 ? "1px dashed #eef2f7" : "none" }) + '">' +
              (editing
                ? '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 88px 28px", gap: 8, alignItems: "center" }) + '">' +
                    '<label style="' + U.sty(shell) + '"><input class="rd-expense-input" data-model="expense-name-' + e.id + '" value="' + U.esc(e.name || "") + '" placeholder="Expense ' + (i + 1) + '"' + (e.editableName === false ? " disabled" : "") + ' style="' + U.sty(field) + '" /></label>' +
                    '<label style="' + U.sty(shell) + '"><input class="rd-expense-input" inputmode="decimal" data-model="expense-amt-' + e.id + '" value="' + U.esc(e.amount || "") + '" placeholder="0" style="' + U.sty(U.mix(field, { textAlign: "right" })) + '" /></label>' +
                    smallBtn(CHECK, "expense-done", e.id, U.GREEN, "#f0fdf4") +
                  "</div>"
                // Settled row: the name is plain text (only the pencil edits it),
                // the amount is neutral and unsigned — the minus belongs to the
                // Total Expenses line, not to each row.
                : '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto 28px 28px", gap: 6, alignItems: "center" }) + '">' +
                    '<span style="' + U.sty({ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: "#6b7280" }) + '">' + U.esc(e.name || "Expense " + (i + 1)) + "</span>" +
                    '<span style="' + U.sty({ fontSize: 12, fontWeight: 800, color: "#4b5563", fontVariantNumeric: "tabular-nums" }) + '">' + U.inr(amount) + "</span>" +
                    smallBtn(PENCIL, "expense-edit", e.id, U.BRAND, "#eef8fa") +
                    // A mandatory category keeps its slot but cannot be removed.
                    (e.required ? '<span aria-hidden="true"></span>' : smallBtn(CROSS, "expense-remove", e.id, "#ef4444", "#fff5f5")) +
                  "</div>") +
            "</div>";
          }).join("") +
          '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 9, borderTop: "1px dashed #e5e7eb" }) + '">' +
            '<span style="' + U.sty({ fontSize: 13, color: "#494747" }) + '">Total Expenses</span>' +
            '<span style="' + U.sty({ fontSize: 16, fontWeight: 800, color: "#dc2626" }) + '">-' + U.inr(expenseTotal) + "</span>" +
          "</div>" +
        "</div>"
      : "";

    const expenseSection = '<section style="' + U.sty({ borderBottom: "1px dashed #e5e7eb" }) + '">' +
      '<div style="' + U.sty({ minHeight: 44, alignItems: "center", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto auto", gap: 8 }) + '">' +
        '<button type="button"' + U.act("expense-toggle") + ' style="' + U.sty({ minWidth: 0, border: "none", background: "transparent", padding: 0, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", textAlign: "left", cursor: "pointer" }) + '">' +
          '<span style="' + U.sty({ fontSize: 14, color: "#555" }) + '">Expense</span>' +
          (S.expenses.length ? CHEV(!!S.expensesOpen) : "") +
        "</button>" +
        iconBtn(PLUS, "expense-add") +
        iconBtn(CLIP, "expense-attach", null, !S.expenseEditing) +
      "</div>" + expenseRows + "</section>";

    const breakRows = (S.breakdownOpen && denomTotal > 0)
      ? '<div style="' + U.sty({ padding: "0 0 8px" }) + '">' +
          DENOMS.filter(function (d) { return (Number(S.denoms[d]) || 0) > 0; }).map(function (d) {
            return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", fontSize: 13, color: "#555" }) + '">' +
              "<span>₹" + d + " × " + (Number(S.denoms[d]) || 0) + "</span>" +
              '<span style="' + U.sty({ fontWeight: 800, color: "#111" }) + '">' + U.inr(d * (Number(S.denoms[d]) || 0)) + "</span></div>";
          }).join("") + "</div>"
      : "";

    const breakSection = "<div>" +
      '<div style="' + U.sty({ minHeight: 44, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto auto", gap: 8, alignItems: "center" }) + '">' +
        '<button type="button"' + U.act(denomTotal > 0 ? "breakdown-toggle" : "cashbreak-open") + ' style="' + U.sty({ minWidth: 0, border: "none", background: "transparent", padding: 0, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit", color: "#555", textAlign: "left", cursor: "pointer" }) + '">' +
          '<span style="' + U.sty({ fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) + '">Cashbreak</span>' +
          (denomTotal > 0 ? CHEV(!!S.breakdownOpen) : "") +
        "</button>" +
        '<button type="button"' + U.act("cashbreak-open") + ' style="' + U.sty({
          width: 26, height: 26, borderRadius: 8, background: "#f7fcfd", color: U.BRAND, fontFamily: "inherit",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }) + '">' + PLUS + "</button>" +
      "</div>" + breakRows + "</div>";

    const summary = '<div style="' + U.sty({ margin: 12, background: "white", borderRadius: 16, padding: 18 }) + '">' +
      U.CardTitle("Summary") +
      U.SettleRow("Opening Cash (change)", "₹" + Number(openingCash).toLocaleString("en-IN")) +
      U.SettleRow("Cash Collected", U.inr(cashCollected), "#16a34a") +
      U.SettleRow("UPI Collected", U.inr(upiCollected), "#2563eb") +
      expenseSection + breakSection +
      '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "2px solid #e5e7eb", paddingTop: 10, marginTop: 4 }) + '">' +
        '<span style="' + U.sty({ fontWeight: 700, fontSize: 15 }) + '">Cash to Hand Over</span>' +
        '<span style="' + U.sty({ fontSize: 22, fontWeight: 800, color: toHandOver >= 0 ? "#16a34a" : "#dc2626" }) + '">' + U.inr(toHandOver) + "</span>" +
      "</div></div>";

    const inputBase = {
      width: "100%", padding: "13px 16px", borderRadius: 14, fontWeight: 700, color: "#111",
      background: "#fafafa", outline: "none", boxSizing: "border-box", border: "2px solid #e5e7eb", fontFamily: "inherit",
    };

    const entry = '<div style="' + U.sty({ padding: "0 12px" }) + '">' +
        '<div style="' + U.sty({ marginBottom: 14 }) + '">' +
          '<label style="' + U.sty({ fontSize: 14, fontWeight: 600, color: "#555", marginBottom: 6, display: "block" }) + '">Actual Cash Counted</label>' +
          '<input inputmode="decimal" data-model="counted" value="' + U.esc(S.counted || "") + '" placeholder="Enter amount…" style="' + U.sty(U.mix(inputBase, {
            fontSize: 22, textAlign: "center", border: "2px solid " + U.BRAND, background: "#fafafa",
          })) + '" /></div>' +
      "</div>" +
      // As soon as anything is counted QA states the difference from what the
      // route says should be in hand — green when it matches or runs over,
      // red when cash is short.
      (String(S.counted || "").trim() !== ""
        ? (function () {
            const ok = diff === 0 || diff > 0;
            const col = ok ? "#39c96e" : "#ef4444";
            return '<div style="' + U.sty({
              margin: denomTotal > 0 ? "12px 12px 0" : "0 12px",
              padding: "14px 16px", borderRadius: 14,
              border: "2px solid " + col, background: ok ? "#e8f5f7" : "#fef2f2",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }) + '">' +
              '<span style="' + U.sty({ fontSize: 15, fontWeight: 700, color: col }) + '">Difference</span>' +
              '<span style="' + U.sty({ fontSize: 24, fontWeight: 800, color: col }) + '">' +
                (diff === 0 ? "₹0 ✓" : (diff > 0 ? "+" : "") + U.inr(Math.abs(diff))) + "</span>" +
            "</div>";
          })()
        : "") +
      U.Spacer(16) +
      '<div style="' + U.sty({ padding: "0 12px" }) + '">' +
        '<label style="' + U.sty({ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6, display: "block" }) + '">Delivery Person <span style="color:#ef4444">*</span></label>' +
        '<input data-model="person" value="' + U.esc(S.person || "") + '" placeholder="Enter delivery person\'s name (min. 3 chars)" style="' + U.sty(U.mix(inputBase, {
          fontSize: 17,
          border: "2px solid " + (personShort ? "#ef4444" : "#e5e7eb"),
          background: personShort ? "#fef2f2" : "#fafafa",
        })) + '" /></div>' +
      U.Spacer(16);

    const footer = confirming
      ? U.ConfirmPanel({
          action: "Cash Handover", amount: U.inr(counted || 0) + " counted",
          context: diff === 0
            ? "✓ Matches expected · delivery person: " + U.esc(S.person)
            : "⚠ " + (diff > 0 ? "+" : "") + U.inr(Math.abs(diff)) + " discrepancy · delivery person: " + U.esc(S.person),
          backLabel: "Recount Cash", commitLabel: "Sign Off",
          backAct: "handover-cancel", commitAct: "handover-commit", arg: p.routeId,
          processing: !!S.committing, processingLabel: "Finalising cash handover…",
        })
      : U.BtnXL({
          variant: "green",
          label: !hasCounted ? "Count cash to continue" : !personOk ? "Enter delivery person name to continue" : "Confirm Cash Handover",
          disabled: !hasCounted || !personOk, actName: "handover-confirm",
        });

    return U.MobileHeader({ title: "Cash Handover", subtitle: "Count your cash before handing over", backLabel: "Settlement", backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: confirming ? 0.45 : 1, pointerEvents: confirming ? "none" : "auto", transition: "opacity 0.2s" }) + '">' +
        summary + entry +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>" +
      CashBreakdownSheet(S);
  });

  // "Add Currency" — the denomination sheet the + on Cashbreak opens.
  function CashBreakdownSheet(S) {
    const denomTotal = DENOMS.reduce(function (a, d) { return a + d * (Number(S.denoms[d]) || 0); }, 0);
    const custom = S.customDenoms || [];
    const customTotal = custom.reduce(function (a, c) { return a + (parseFloat(c.amount) || 0); }, 0);
    const total = denomTotal + customTotal;
    const th = { fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "9px 12px" };
    const rows = DENOMS.map(function (d) {
      const qty = Number(S.denoms[d]) || 0;
      return '<tr style="' + U.sty({ background: "white", borderBottom: "1px solid #eef2f7" }) + '">' +
        '<td style="' + U.sty({ padding: "10px 12px" }) + '"><div style="' + U.sty({ fontSize: 12, fontWeight: 800, color: "#4b5563" }) + '">' + d + "</div></td>" +
        '<td style="' + U.sty({ padding: 8, textAlign: "center" }) + '">' +
          '<input inputmode="numeric" data-model="denom-' + d + '" value="' + U.esc(qty ? String(qty) : "") + '" style="' + U.sty({
            width: 54, height: 30, fontSize: 12, fontWeight: 800, color: "#111", background: "white",
            border: "1px solid #e5e7eb", borderRadius: 8, textAlign: "center", outline: "none",
          }) + '" /></td>' +
        '<td style="' + U.sty({ padding: "10px 12px", textAlign: "right", fontSize: 12, fontWeight: 800, color: "#4b5563" }) + '">' + (qty * d ? (qty * d).toLocaleString("en-IN") : "0") + "</td></tr>";
    }).join("");

    const body =
      '<div style="' + U.sty({ padding: "10px 0 6px", display: "flex", justifyContent: "center", flexShrink: 0 }) + '">' +
        '<div style="' + U.sty({ width: 36, height: 4, borderRadius: 2, background: "#e5e7eb" }) + '"></div></div>' +
      '<div style="' + U.sty({ padding: "4px 20px 14px", flexShrink: 0 }) + '">' +
        '<div style="' + U.sty({ fontSize: 18, fontWeight: 800, color: "#111" }) + '">Add Currency</div></div>' +
      '<div style="' + U.sty({ overflowY: "auto" }) + '">' +
        '<div style="' + U.sty({ border: "1px solid #e5e7eb", borderRadius: 14, margin: "0 16px", overflow: "hidden" }) + '">' +
          '<table style="' + U.sty({ width: "100%", borderCollapse: "collapse" }) + '">' +
            '<colgroup><col style="width:95.5px" /><col style="width:82px" /><col /></colgroup>' +
            '<thead><tr style="' + U.sty({ color: "#6b7280", background: "white", borderBottom: "1px solid #eef2f7" }) + '">' +
              '<th style="' + U.sty(th) + '">Currency</th>' +
              '<th style="' + U.sty(U.mix(th, { textAlign: "center", padding: "9px 8px" })) + '">Qty</th>' +
              '<th style="' + U.sty(U.mix(th, { textAlign: "right" })) + '">Amount</th></tr></thead>' +
            "<tbody>" + rows +
              '<tr><td colspan="2" style="' + U.sty({ padding: "14px 12px", fontSize: 14, fontWeight: 900, color: "#111" }) + '">Total</td>' +
              '<td style="' + U.sty({ padding: "14px 12px", textAlign: "right", fontSize: 18, fontWeight: 900, color: "#16a34a" }) + '">' + U.inr(total) + "</td></tr>" +
            "</tbody></table></div>" +
        '<div style="' + U.sty({ margin: "14px 16px 0", display: "grid", gridTemplateColumns: "1fr 92.7px", gap: 8, alignItems: "center" }) + '">' +
          '<input data-model="denom-custom" value="' + U.esc(S.customDenomInput || "") + '" placeholder="Add note value" style="' + U.sty({
            width: "100%", height: 44, padding: "0 12px", fontSize: 14, fontWeight: 700,
            background: "#fafafa", border: "2px solid #e5e7eb", borderRadius: 12, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
          }) + '" />' +
          '<button type="button"' + U.act("denom-add-field") + ' style="' + U.sty({
            height: 44, padding: "0 12px", fontSize: 14, fontWeight: 800, color: U.BRAND, background: "white",
            border: "2px solid " + U.BRAND, borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
            opacity: (S.customDenomInput || "").trim() ? 1 : 0.45,
          }) + '">Add Field</button>' +
        "</div>" +
        '<div style="' + U.sty({ margin: "14px 16px 0", padding: "14px 16px", background: "#f0f7f8", border: "1px solid rgba(27,98,114,0.133)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }) + '">' +
          '<span style="' + U.sty({ fontSize: 14, fontWeight: 800, color: "rgba(27,98,114,0.8)" }) + '">Total</span>' +
          '<span style="' + U.sty({ fontSize: 24, fontWeight: 900, color: U.BRAND }) + '">' + U.inr(total) + "</span>" +
        "</div>" +
      "</div>" +
      '<div style="' + U.sty({ background: "white", padding: "14px 16px 16px" }) + '">' +
        '<button type="button"' + U.act("cashbreak-save") + ' style="' + U.sty({
          width: "100%", padding: 16, borderRadius: 16, background: U.GREEN, color: "white",
          border: "none", fontSize: 17, fontWeight: 800, cursor: "pointer", fontFamily: "inherit",
        }) + '">Save Breakdown</button></div>';

    // Mounted always, like QA's modal: it slides rather than appears.
    const open = !!S.cashModal;
    return '<div' + U.act("cashbreak-close") + ' style="' + U.sty({
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)", backdropFilter: "blur(2px)",
      WebkitBackdropFilter: "blur(2px)", zIndex: 100,
      opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s",
    }) + '"></div>' +
    '<div style="' + U.sty({
      position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto",
      background: "white", borderRadius: "20px 20px 0 0", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
      zIndex: 101, display: "flex", flexDirection: "column", maxHeight: "86dvh",
      transform: open ? "translateY(0)" : "translateY(100%)",
      pointerEvents: open ? "auto" : "none",
      transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }) + '">' + body + "</div>";
  }

  window.RD.action("expense-toggle", function () {
    const S = window.RD.state.scratch;
    if (S.expenses.length) S.expensesOpen = !S.expensesOpen;
    window.RD.render();
  });
  window.RD.action("expense-add", function () {
    const S = window.RD.state.scratch;
    const id = "EXP-" + (S.expenses.length + 1) + "-" + Date.now().toString().slice(-4);
    S.expenses.push({ id: id, name: "", amount: "" });
    S.expensesOpen = true; S.expenseEditing = id;
    window.RD.render();
  });
  window.RD.action("expense-edit", function (id) { window.RD.state.scratch.expenseEditing = id; window.RD.render(); });
  window.RD.action("expense-done", function () { window.RD.state.scratch.expenseEditing = null; window.RD.render(); });
  window.RD.action("expense-remove", function (id) {
    const S = window.RD.state.scratch;
    S.expenses = S.expenses.filter(function (e) { return e.id !== id; });
    if (S.expenseEditing === id) S.expenseEditing = null;
    if (!S.expenses.length) S.expensesOpen = false;
    window.RD.render();
  });
  // Attaching a document needs a file picker and an upload endpoint; offline
  // this affordance stays inert, which is also how QA renders it until an
  // expense is being edited.
  window.RD.action("expense-attach", function () {});
  window.RD.action("model:expense-name#", function (v, id) {
    const S = window.RD.state.scratch;
    const e = S.expenses.filter(function (x) { return x.id === id; })[0];
    if (e) e.name = v;
  });
  window.RD.action("model:expense-amt#", function (v, id) {
    const S = window.RD.state.scratch;
    const e = S.expenses.filter(function (x) { return x.id === id; })[0];
    if (e) e.amount = String(v).replace(/[^\d.]/g, "");
    window.RD.render();
    const el = document.querySelector('[data-model="expense-amt-' + id + '"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("breakdown-toggle", function () { const S = window.RD.state.scratch; S.breakdownOpen = !S.breakdownOpen; window.RD.render(); });
  window.RD.action("cashbreak-open", function () { window.RD.state.scratch.cashModal = true; window.RD.render(); });
  window.RD.action("cashbreak-close", function () { window.RD.state.scratch.cashModal = false; window.RD.render(); });
  window.RD.action("cashbreak-save", function () {
    const S = window.RD.state.scratch;
    S.cashModal = false;
    // Counting notes fills the counted field, which is the point of the sheet.
    const total = DENOMS.reduce(function (a, d) { return a + d * (Number(S.denoms[d]) || 0); }, 0);
    if (total > 0) S.counted = String(total);
    window.RD.render();
  });
  window.RD.action("denom-add-field", function () {
    const S = window.RD.state.scratch;
    const v = parseFloat(S.customDenomInput);
    if (!v || v <= 0) return;
    S.customDenoms = (S.customDenoms || []).concat([{ value: v, amount: "" }]);
    S.customDenomInput = "";
    window.RD.render();
  });
  window.RD.action("model:denom-custom", function (v) { window.RD.state.scratch.customDenomInput = v; });
  window.RD.action("handover-cancel", function () { window.RD.state.scratch.handoverConfirming = false; window.RD.render(); });

  window.RD.action("model:counted", function (v) {
    const S = window.RD.state.scratch;
    S.counted = String(v).replace(/[^\d.]/g, "");
    window.RD.render();
    const el = document.querySelector('[data-model="counted"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("model:person", function (v) {
    const S = window.RD.state.scratch;
    S.person = v;
    window.RD.render();
    const el = document.querySelector('[data-model="person"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("model:denom#", function (v, d) {
    const S = window.RD.state.scratch;
    const qty = Number(String(v).replace(/\D/g, "")) || 0;
    if (qty > 0) S.denoms[d] = qty; else delete S.denoms[d];
    window.RD.render();
    const el = document.querySelector('[data-model="denom-' + d + '"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });

  window.RD.action("handover-confirm", function () { window.RD.state.scratch.handoverConfirming = true; window.RD.render(); });
  window.RD.action("handover-commit", function (routeId) {
    window.RD.commit(function () {
      const S = window.RD.state.scratch;
      SDK.settlement.submitCashHandover({
        routeId: routeId,
        amount: Number(S.counted), actualCounted: Number(S.counted),
        // The SDK takes a list of expense lines, not a single total.
        expenses: (S.expenses || []).filter(function (e) { return (parseFloat(e.amount) || 0) > 0; })
          .map(function (e) { return { type: "OTHER", name: e.name || "Expense", amount: parseFloat(e.amount) || 0 }; }),
        denominations: S.denoms || {},
        supervisorName: (S.person || "").trim(),
      });
      S.handoverConfirming = false;
      window.RD.go("/settlement/" + routeId);
    });
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

  // Accordion — measured from QA: card radius 14, no shadow, button padding
  // 14px 16px; title 12px/800 #888 uppercase, subtitle 12px/400 #666 mt 2,
  // caret 12px #aaa.
  function Accordion(key, title, subtitle, bodyHtml, bodyPad, note) {
    const open = window.RD.state.scratch["acc_" + key] === true;
    return '<div style="' + U.sty({ background: "white", borderRadius: 14, margin: "0 12px 10px", padding: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' +
      '<button type="button"' + U.act("acc-toggle", key) + ' style="' + U.sty({
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", background: "none", border: "none",
        textAlign: "left", fontFamily: "inherit", cursor: "pointer",
      }) + '">' +
        "<div>" +
          '<div style="' + U.sty({ fontSize: 12, fontWeight: 800, color: "#888", textTransform: "uppercase" }) + '">' + U.esc(title) + "</div>" +
          '<div style="' + U.sty({ fontSize: 12, fontWeight: 400, color: "#666", marginTop: 2 }) + '">' + U.esc(subtitle) + "</div>" +
          (note ? '<div style="' + U.sty({ fontSize: 10, color: "#94a3b8", marginTop: 2 }) + '">' + U.esc(note) + "</div>" : "") +
        "</div>" +
        '<span style="' + U.sty({ fontSize: 12, fontWeight: 400, color: "#aaa", marginLeft: 8 }) + '">' + (open ? "▲" : "▼") + "</span></button>" +
      (open ? '<div style="' + U.sty({ borderTop: "1px solid #f0f2f5", padding: bodyPad || "10px 16px 14px" }) + '">' + bodyHtml + "</div>" : "") +
      "</div>";
  }

  // The analytics tables are one CSS grid per card, with the first column
  // sticky so a long product name never hides the numbers when the table is
  // scrolled sideways (RouteAnalytics.jsx TH/TD/TD_R).
  const A_TH = { fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#aaa", letterSpacing: "0.4px", paddingBottom: 8 };
  const A_TD = { fontSize: 13, fontWeight: 600, color: "#111", padding: "9px 0", borderTop: "1px solid #f0f2f5" };

  function aTh(text, o) {
    return '<div style="' + U.sty(U.mix(A_TH, o || null)) + '">' + text + "</div>";
  }
  function aTd(inner, o) {
    return '<div style="' + U.sty(U.mix(A_TD, o || null)) + '">' + inner + "</div>";
  }
  // A scrolling table: the grid is wider than the card, so the wrapper scrolls.
  function aScroller(grid, width, gap, inner) {
    return '<div style="' + U.sty({ overflowX: "auto", overflowY: "hidden", paddingBottom: 4, WebkitOverflowScrolling: "touch" }) + '">' +
      '<div style="' + U.sty({ display: "grid", gridTemplateColumns: grid, columnGap: gap, width: width }) + '">' + inner + "</div></div>";
  }

  // QA bands: 8/100 renders "Needs Attention", 91/100 "Excellent Beat".
  function scoreBand(v) {
    if (v >= 80) return "Excellent Beat";
    if (v >= 50) return "Good Beat";
    return "Needs Attention";
  }

  // Per-metric colours, read off QA: coverage and productivity brand, collection
  // green, avg-time blue (and its bar always runs full width).
  const KPI_COLOR = { COVERAGE: "#1B6272", PRODUCTIVITY: "#1B6272", COLLECTION: "#2d7a42", AVG_TIME_PER_STOP: "#2563eb" };

  function analyticsScreen(p) {
    const route = routeOr404(p.routeId);
    const a = SDK.settlement.getRouteAnalytics(p.routeId).data;
    const stops = D.getStops(p.routeId);
    const delivered = stops.filter(function (s) { return s.status === "DELIVERED"; });
    const load = D.db.stockLoads[p.routeId];
    const products = (load && load.products) || [];
    const scoreVal = (a.score && a.score.value) || 0;
    const scoreMax = (a.score && a.score.max) || 100;
    const S = window.RD.state.scratch;

    /* ── Header (h=93): title, wrapping subtitle, Export pinned right ─────── */
    const header =
      '<div style="' + U.sty({ background: U.BRAND, padding: "10px 16px 12px", flexShrink: 0, position: "relative" }) + '">' +
        '<div style="' + U.sty({ paddingRight: 82 }) + '">' +
          '<div style="' + U.sty({ fontSize: 20, fontWeight: 700, color: "white" }) + '">Route Intelligence</div>' +
          '<div style="' + U.sty({ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 }) + '">' +
            U.esc(route.name) + " · " + M.formatRouteDate(route.scheduledDate) + "</div>" +
        "</div>" +
        // The button is centred on the header by its own wrapper, not by a
        // hand-picked top offset, and carries lucide's file-down glyph.
        '<div style="' + U.sty({ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)" }) + '">' +
          '<button type="button"' + U.act("analytics-export", p.routeId) + ' style="' + U.sty({
            height: 30, display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px",
            border: "1px solid rgba(255,255,255,0.3)", borderRadius: 9, background: "transparent",
            color: "white", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: 1,
          }) + '">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path>' +
              '<path d="M14 2v4a2 2 0 0 0 2 2h4"></path>' +
              '<path d="M12 18v-6"></path>' +
              '<path d="m9 15 3 3 3-3"></path></svg>' +
            "<span>Export</span></button>" +
        "</div>" +
      "</div>";

    /* ── Score band: full-width white, centred ring, band label under it ──── */
    const pct = Math.max(0, Math.min(100, Math.round((scoreVal / scoreMax) * 100)));
    const scoreBlock =
      '<div style="' + U.sty({ textAlign: "center", background: "white", margin: "0 0 8px", padding: "20px 16px 8px" }) + '">' +
        '<div style="' + U.sty({
          width: 88, height: 88, borderRadius: "50%", margin: "0 auto 8px",
          background: "conic-gradient(" + U.BRAND + " 0%, " + U.BRAND + " " + pct + "%, #e5e7eb " + pct + "%, #e5e7eb 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }) + '">' +
          '<div style="' + U.sty({ width: 70, height: 70, borderRadius: "50%", background: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }) + '">' +
            '<div style="' + U.sty({ fontSize: 22, fontWeight: 800, color: "#111", lineHeight: 1 }) + '">' + scoreVal + "</div>" +
            '<div style="' + U.sty({ fontSize: 11, fontWeight: 400, color: "#888" }) + '">/' + scoreMax + "</div>" +
          "</div></div>" +
        '<div style="' + U.sty({ fontSize: 16, fontWeight: 800, color: "#111", marginTop: 6, lineHeight: 1.1 }) + '">' + scoreBand(scoreVal) + "</div>" +
      "</div>";

    /* ── Performance: one card, four label / bar / value rows ────────────── */
    const perfRows = (a.kpis || []).map(function (k) {
      const color = KPI_COLOR[k.key] || U.BRAND;
      const isTime = k.key === "AVG_TIME_PER_STOP";
      // QA prints the percentage for the first three and the raw figure for
      // time, whose bar always runs full width.
      const shown = isTime ? k.value : (k.percentage || 0) + "%";
      const fill = isTime ? 100 : (k.percentage || 0);
      return '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "86px 1fr 44px", gap: 8, alignItems: "center", marginBottom: 9 }) + '">' +
        // 14.56px line-height measured off QA (1.12), so a single-line row is
        // 15px tall and "Avg Time / Stop" wraps to exactly 29px as it does there.
        '<div style="' + U.sty({ fontSize: 13, fontWeight: 400, color: "#334155", lineHeight: 1.12, whiteSpace: "pre-line" }) + '">' + U.esc(k.label === "Avg Time/Stop" ? "Avg Time / Stop" : k.label) + "</div>" +
        '<div style="' + U.sty({ height: 8, background: "#e1e5ea", borderRadius: 6, overflow: "hidden" }) + '">' +
          '<div style="' + U.sty({ height: 8, width: fill + "%", background: color, borderRadius: 6 }) + '"></div></div>' +
        '<div style="' + U.sty({ textAlign: "right", fontSize: 12, fontWeight: 800, color: color, lineHeight: 1 }) + '">' + U.esc(shown) + "</div>" +
        "</div>";
    }).join("");

    const perfCard = '<div style="' + U.sty({ background: "white", margin: "0 12px 10px", padding: 16, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' +
      '<div style="' + U.sty({ fontSize: 12, fontWeight: 800, color: "#888", textTransform: "uppercase", marginBottom: 12 }) + '">Performance</div>' +
      perfRows + "</div>";

    /* ── Highlights: tinted inner box per item ───────────────────────────── */
    const advanceTotal = stops.reduce(function (t, s) { return t + (s.advanceAmount || 0); }, 0);
    const skipped = stops.filter(function (s) { return s.status === "SKIPPED"; }).length;
    const items = [];
    if (advanceTotal > 0) items.push({ icon: "✅", text: U.inr(advanceTotal) + " over payment collected", bg: "#edfdf3", bd: "#a7f3cc", fg: "#2d7a42" });
    if (route.outstandingAmount > 0) items.push({ icon: "⚠️", text: U.inr(route.outstandingAmount) + " left outstanding", bg: "#fff7ed", bd: "#fed7aa", fg: "#9a3412" });
    if (skipped > 0) items.push({ icon: "⏭️", text: skipped + " stop" + (skipped > 1 ? "s" : "") + " skipped", bg: "#eff6ff", bd: "#bfdbfe", fg: "#1e40af" });

    const highlights = items.length
      ? '<div style="' + U.sty({ background: "white", margin: "0 12px 10px", padding: 16, borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' +
          '<div style="' + U.sty({ fontSize: 12, fontWeight: 800, color: "#888", textTransform: "uppercase", marginBottom: 12 }) + '">Highlights</div>' +
          items.map(function (h, i) {
            return '<div style="' + U.sty({
              background: h.bg, border: "1px solid " + h.bd, borderRadius: 12, padding: "12px 14px",
              fontSize: 13, fontWeight: 800, lineHeight: 1.25, color: h.fg,
              display: "flex", alignItems: "flex-start", gap: 10,
              marginBottom: i < items.length - 1 ? 8 : 0,
            }) + '"><span style="flex-shrink:0">' + h.icon + "</span><span>" + h.text + "</span></div>";
          }).join("") + "</div>"
      : "";

    /* ── Summaries ───────────────────────────────────────────────────────── */
    // Every completed stop appears, skipped ones greyed with a "Skipped" tag.
    const doneStops = stops.filter(function (st) { return st.status === "DELIVERED" || st.status === "SKIPPED"; });
    const skippedCount = doneStops.filter(function (st) { return st.status === "SKIPPED"; }).length;
    const stopQty = function (st) {
      const det = D.resolveStopDetail(p.routeId, st.id) || {};
      return (det.orderItems || []).reduce(function (n, it) { return n + (it.qty || 0); }, 0);
    };
    const stopsBody = aScroller("135px 78px 86px 82px 82px", 519, 14,
      aTh("Customer", { position: "sticky", left: 0, zIndex: 4, background: "white" }) +
      aTh("Delivered", { textAlign: "right" }) +
      aTh("Returned", { textAlign: "right" }) +
      aTh("Asset Given", { textAlign: "right", color: "#3b82f6", whiteSpace: "nowrap" }) +
      aTh("Asset Taken", { textAlign: "right", color: "#16a34a", whiteSpace: "nowrap" }) +
      doneStops.map(function (st) {
        const skipped = st.status === "SKIPPED";
        const dq = skipped ? 0 : stopQty(st);
        const rq = Number(st.returnedQty || 0);
        const ag = Number(st.assetGiven || 0), at = Number(st.assetTaken || 0);
        const num = function (v, on) {
          return aTd(String(v), { textAlign: "right", color: v > 0 ? on : "#94a3b8" });
        };
        return aTd(
            '<div style="' + U.sty({ fontSize: 13, fontWeight: 900, color: skipped ? "#94a3b8" : "#111827", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.25 }) + '">' + U.esc(st.customerName) + "</div>" +
            (skipped ? '<div style="' + U.sty({ fontSize: 9.5, fontWeight: 800, color: "#94a3b8", marginTop: 5 }) + '">Skipped</div>' : ""),
            { position: "sticky", left: 0, zIndex: 2, background: "white", minWidth: 0, paddingRight: 6 }
          ) +
          num(dq, "#111827") + num(rq, "#111827") + num(ag, "#3b82f6") + num(at, "#16a34a");
      }).join(""));

    const loadedTotal = products.reduce(function (t, pr) { return t + pr.loadedQty; }, 0);
    const stockLines = products.map(function (pr) {
      const sold = Math.round(pr.loadedQty * (delivered.length / Math.max(stops.length, 1)));
      return { name: pr.name, price: pr.unitPrice, loaded: pr.loadedQty, sold: sold, ret: Math.max(0, pr.loadedQty - sold) };
    });
    const soldTotal = stockLines.reduce(function (t, l) { return t + l.sold; }, 0);
    const retTotal = stockLines.reduce(function (t, l) { return t + l.ret; }, 0);
    // Each number carries its rupee value underneath, and the row totals are
    // values, not counts.
    const stockCell = function (qty, value, on) {
      return aTd(
        '<div style="' + U.sty({ fontSize: 14, fontWeight: 900, textAlign: "right" }) + '">' + qty + "</div>" +
        '<div style="' + U.sty({ fontSize: 9.5, fontWeight: 800, color: "#676768", marginTop: 5, overflow: "hidden", textAlign: "right" }) + '">' + money(value) + "</div>",
        { textAlign: "right", color: qty > 0 ? on : "#94a3b8" });
    };
    const totalCell = function (value) {
      return aTd('<div style="' + U.sty({ fontSize: 10.5, fontWeight: 900, marginTop: 4, overflow: "hidden", textAlign: "right" }) + '">' + money(value) + "</div>",
        { textAlign: "right", color: "#676768", borderTop: "1px solid #dbe4ee" });
    };
    const totLoaded = stockLines.reduce(function (t, l) { return t + l.loaded * l.price; }, 0);
    const totSold = stockLines.reduce(function (t, l) { return t + l.sold * l.price; }, 0);
    const totRet = stockLines.reduce(function (t, l) { return t + l.ret * l.price; }, 0);
    const stockBody = aScroller("135px 78px 86px 78px", 401, 8,
      aTh("Product", { position: "sticky", left: 0, zIndex: 4, background: "white" }) +
      aTh("Loaded", { textAlign: "right" }) +
      aTh("Delivered", { textAlign: "right" }) +
      aTh("Return", { textAlign: "right" }) +
      stockLines.map(function (l) {
        return aTd(
            '<div style="' + U.sty({ fontSize: 13, fontWeight: 900, color: "#111827", whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: 1.25 }) + '">' + U.esc(l.name) + "</div>" +
            '<div style="' + U.sty({ fontSize: 9.5, fontWeight: 800, color: "#676768", marginTop: 5, overflow: "hidden" }) + '">' + money(l.price) + "</div>",
            { position: "sticky", left: 0, zIndex: 2, background: "white", minWidth: 0, paddingRight: 6 }
          ) +
          stockCell(l.loaded, l.loaded * l.price, "#111827") +
          stockCell(l.sold, l.sold * l.price, "#111827") +
          stockCell(l.ret, l.ret * l.price, "#111827");
      }).join("") +
      aTd("Total", { fontSize: 11, fontWeight: 900, color: "#64748b", textTransform: "uppercase",
        position: "sticky", left: 0, zIndex: 2, background: "white", borderTop: "1px solid #dbe4ee" }) +
      totalCell(totLoaded) + totalCell(totSold) + totalCell(totRet));

    // Asset movements recorded on this route, keyed by asset.
    const assetTotals = {};
    ((D.db.assetMovements && D.db.assetMovements[p.routeId]) || []).forEach(function (m) {
      const row = assetTotals[m.assetId] || (assetTotals[m.assetId] = { name: m.assetName, given: 0, taken: 0 });
      row.given += m.given || 0; row.taken += m.taken || 0;
    });
    const assetRows = Object.keys(assetTotals).map(function (k) { return assetTotals[k]; });
    const assetGivenTotal = assetRows.reduce(function (t, r) { return t + r.given; }, 0);
    const assetTakenTotal = assetRows.reduce(function (t, r) { return t + r.taken; }, 0);
    const assetBody = '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "127px 88px 88px", columnGap: 8 }) + '">' +
      aTh("Asset") +
      aTh("Assets Given", { textAlign: "right", color: "#3b82f6", whiteSpace: "nowrap" }) +
      aTh("Assets Taken", { textAlign: "right", color: "#16a34a", whiteSpace: "nowrap" }) +
      assetRows.map(function (r) {
        return aTd(U.esc(r.name), { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }) +
          aTd(String(r.given), { textAlign: "right", color: r.given > 0 ? "#3b82f6" : "#aaa" }) +
          aTd(String(r.taken), { textAlign: "right", color: r.taken > 0 ? "#16a34a" : "#aaa" });
      }).join("") + "</div>";

    // Expenses recorded at cash handover, with their settlement stamp.
    const settled = (D.db.settlements && D.db.settlements[p.routeId]) || null;
    const expenseItems = (settled && settled.expenses) || [];
    const expenseTotal = expenseItems.reduce(function (t, e) { return t + (parseFloat(e.amount) || 0); }, 0);
    const historyCount = expenseItems.length ? 1 : 0;
    const expenseBody = expenseItems.length
      ? expenseItems.map(function (e, i) {
          return '<div style="' + U.sty({ padding: "10px 0", borderBottom: i < expenseItems.length - 1 ? "1px solid #eef2f7" : "none" }) + '">' +
            '<div style="' + U.sty({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }) + '">' +
              '<span style="' + U.sty({ color: "#475569", fontSize: 13, fontWeight: 600 }) + '">' + U.esc(e.name) + "</span>" +
              '<span style="' + U.sty({ color: "#e87171", fontSize: 14, fontWeight: 800 }) + '">' + U.inr(parseFloat(e.amount) || 0) + "</span>" +
            "</div>" +
            '<div style="' + U.sty({ marginTop: 3, color: "#64748b", fontSize: 10 }) + '">SETTLED' +
              (settled.settledAt ? " · " + new Date(settled.settledAt).toLocaleString("en-IN") : "") + "</div>" +
            '<div style="' + U.sty({ marginTop: 5, color: "#94a3b8", fontSize: 11 }) + '">No documents attached</div>' +
          "</div>";
        }).join("")
      : '<div style="' + U.sty({ padding: "12px 0 4px", color: "#94a3b8", fontSize: 12 }) + '">No expense details recorded</div>';

    const collected = route.collectedAmount || 0;
    const sumRow = function (label, value, color, last) {
      return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: last ? "none" : "1px solid #eef2f7" }) + '">' +
        '<div style="' + U.sty({ fontSize: 13, color: "#475569", fontWeight: 500 }) + '">' + label + "</div>" +
        '<div style="' + U.sty({ fontSize: 14, fontWeight: 800, color: color || "#111" }) + '">' + value + "</div></div>";
    };

    return header +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        scoreBlock + perfCard + highlights +
        Accordion("stops", "Stops Summary",
          doneStops.filter(function (st) { return st.status === "DELIVERED"; }).length + " delivered" +
            (skippedCount > 0 ? " · " + skippedCount + " skipped" : ""),
          stopsBody) +
        Accordion("stock", "Stock Summary",
          loadedTotal + " loaded · " + soldTotal + " delivered · " + retTotal + " returned",
          stockBody) +
        (assetRows.length
          ? Accordion("asset", "Asset Movement",
              assetRows.length + " asset" + (assetRows.length !== 1 ? "s" : "") + " · " + assetGivenTotal + " given · " + assetTakenTotal + " taken back",
              assetBody, "0 16px 12px")
          : "") +
        Accordion("expense", "Expense Summary",
          expenseItems.length + " expense" + (expenseItems.length === 1 ? "" : "s") + " · " + U.inr(expenseTotal) + " total · 0 documents",
          expenseBody, "4px 16px 12px",
          historyCount > 0 ? historyCount + " settled cash audit " + (historyCount === 1 ? "entry" : "entries") : "") +
        Accordion("collection", "Collection Summary", U.inr(collected) + " collected · " + U.inr(route.outstandingAmount) + " outstanding",
          sumRow("Amount Collected", U.inr(collected)) +
          sumRow("Outstanding Amount", U.inr(route.outstandingAmount), route.outstandingAmount > 0 ? "#f97316" : "#2D7A42", !(advanceTotal > 0)) +
          (advanceTotal > 0 ? sumRow("Over Payment", U.inr(advanceTotal), "#16a34a", true) : ""),
          "4px 16px 4px") +
        U.Spacer(12) +
      "</div>" +
      (S.exportOpen ? ExportModal(p.routeId) : "") +
      U.TabBar("reports");
  }

  // QA's export sheet: a bottom sheet with a drag handle, an empty preview
  // area until a report file exists, and a three-button footer whose Preview
  // and Download stay disabled while there is nothing to preview or fetch.
  // A minimal, valid single-page PDF built in the browser — the mock has no
  // server to render a report, so it composes one itself and hands the same
  // blob to Preview and Download that QA hands from its API response.
  function buildReportPdf(routeName) {
    const esc = function (t) { return String(t).replace(/([\\()])/g, "\\$1"); };
    const lines = [
      "BT /F1 18 Tf 56 760 Td (Route Analytics Report) Tj ET",
      "BT /F1 11 Tf 56 736 Td (" + esc(routeName) + ") Tj ET",
    ].join("\n");
    const content = lines;
    const objs = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [];
    objs.forEach(function (o, i) {
      offsets.push(pdf.length);
      pdf += (i + 1) + " 0 obj\n" + o + "\nendobj\n";
    });
    const xref = pdf.length;
    pdf += "xref\n0 " + (objs.length + 1) + "\n0000000000 65535 f \n" +
      offsets.map(function (o) { return String(o).padStart(10, "0") + " 00000 n \n"; }).join("") +
      "trailer\n<< /Size " + (objs.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
    return new Blob([pdf], { type: "application/pdf" });
  }

  function reportFileName(routeName) {
    const safe = String(routeName || "route").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "route";
    return safe + "-analytics-report-" + Date.now() + ".pdf";
  }

  function ExportModal(routeId) {
    const S = window.RD.state.scratch;
    const route = routeOr404(routeId);
    const loading = !S.reportReady;
    const fileName = S.reportFileName || "";
    // QA's sheet reports what stage the report is at, and only lights up
    // Preview/Download once the file exists.
    const body = loading
      ? '<div style="' + U.sty({ textAlign: "center", padding: "40px 12px" }) + '">' +
          '<div style="' + U.sty({ width: 40, height: 40, borderRadius: "50%", margin: "0 auto 16px", border: "4px solid " + U.BRAND + "22", borderTopColor: U.BRAND, animation: "rd-spin 0.8s linear infinite" }) + '"></div>' +
          '<div style="' + U.sty({ fontSize: 14, fontWeight: 700, color: "#111" }) + '">Generating report…</div>' +
          '<div style="' + U.sty({ fontSize: 12, color: "#9ca3af", marginTop: 4 }) + '">This can take a few seconds</div>' +
        "</div>"
      : '<div style="' + U.sty({ textAlign: "center", padding: "28px 12px" }) + '">' +
          '<div style="' + U.sty({ width: 64, height: 64, borderRadius: 16, margin: "0 auto 14px", background: U.BRAND + "14", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }) + '">📄</div>' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 800, color: "#111" }) + '">Report ready</div>' +
          '<div style="' + U.sty({ fontSize: 12, color: "#9ca3af", marginTop: 4, wordBreak: "break-all", padding: "0 10px" }) + '">' + U.esc(fileName) + "</div>" +
        "</div>";

    return '<div' + U.act("export-close") + ' style="' + U.sty({
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
      WebkitBackdropFilter: "blur(2px)", zIndex: 60,
    }) + '"></div>' +
    '<div style="' + U.sty({
      position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto",
      background: "white", borderRadius: "20px 20px 0 0", boxShadow: "0 -4px 32px rgba(0,0,0,0.14)",
      zIndex: 61, display: "flex", flexDirection: "column", maxHeight: "92dvh",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
    }) + '">' +
      '<div style="' + U.sty({ padding: "12px 20px 0" }) + '">' +
        '<div style="' + U.sty({ width: 40, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "0 auto 16px" }) + '"></div>' +
        '<div style="' + U.sty({ fontSize: 17, fontWeight: 800, color: "#111", marginBottom: 16 }) + '">📊 Route Analytics Report</div>' +
      "</div>" +
      '<div style="' + U.sty({ padding: "0 20px 8px", overflowY: "auto" }) + '">' +
        body +
        '<div style="' + U.sty({ height: 8 }) + '"></div>' +
      "</div>" +
      '<div style="' + U.sty({ background: "white", borderTop: "1px solid #f0f0f0", padding: "10px 20px 14px" }) + '">' +
        '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
          U.BtnSm({ variant: "grey", label: "Close", actName: "export-close" }) +
          U.BtnSm({ variant: "grey", label: "Preview", disabled: loading, actName: loading ? null : "export-preview", style: loading ? { opacity: 0.45 } : null }) +
          '<a style="flex:1;text-decoration:none"' + (loading ? "" : ' href="' + (S.reportUrl || "") + '" download="' + U.esc(fileName) + '"') + ">" +
            U.BtnXL({ variant: loading ? "grey" : "brand", label: "Download", disabled: loading, style: U.mix({ padding: "12px 16px", fontSize: 15 }, loading ? { opacity: 0.5 } : null) }) +
          "</a>" +
        "</div>" +
      "</div>" +
    "</div>";
  }

  window.RD.screen("closed", analyticsScreen);
  window.RD.screen("analytics", analyticsScreen);
  window.RD.action("acc-toggle", function (key) {
    const S = window.RD.state.scratch;
    S["acc_" + key] = !S["acc_" + key];
    window.RD.render();
  });
  window.RD.action("analytics-export", function (routeId) {
    const S = window.RD.state.scratch;
    S.exportOpen = true; S.reportReady = false;
    window.RD.render();
    // The report is composed off the main paint, so the sheet shows its
    // generating state first, the way QA's does while its API runs.
    const route = routeOr404(routeId);
    setTimeout(function () {
      if (!window.RD.state.scratch.exportOpen) return;
      const blob = buildReportPdf(route.name || "Route");
      if (S.reportUrl) URL.revokeObjectURL(S.reportUrl);
      S.reportUrl = URL.createObjectURL(blob);
      S.reportFileName = reportFileName(route.name);
      S.reportReady = true;
      window.RD.render();
    }, 900);
  });
  window.RD.action("export-preview", function () {
    const S = window.RD.state.scratch;
    if (S.reportUrl) window.open(S.reportUrl, "_blank", "noopener");
  });
  window.RD.action("export-close", function () {
    const S = window.RD.state.scratch;
    if (S.reportUrl) { URL.revokeObjectURL(S.reportUrl); S.reportUrl = null; }
    S.exportOpen = false; S.reportReady = false;
    window.RD.render();
  });
  window.RD.action("export-preview", function () {});
  window.RD.action("export-download", function (routeId) {
    SDK.settlement.downloadRouteAnalyticsReport(routeId);
    window.RD.state.scratch.exportOpen = false;
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
    { key: "name-asc",  label: "Name A–Z" },
    { key: "name-desc", label: "Name Z–A" },
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
        // Nothing outstanding reads as neutral slate, not as a warning.
        stat("Outstanding", U.inr(r.outstandingAmount), (r.outstandingAmount || 0) > 0 ? "#f97316" : "#64748b") +
      "</div>" +
      '<button type="button"' + U.act("report-open", r.id) + ' style="' + U.sty({
        width: "100%", minHeight: 46, border: "1.5px solid " + U.BRAND, borderRadius: 13,
        background: "white", color: U.BRAND, fontFamily: "inherit", fontSize: 14, fontWeight: 800, cursor: "pointer",
      }) + '">View Report →</button>' +
      "</div>";
  }

  // The field carries the picker's own dd MMM yyyy format ("24 Aug 2026",
  // "24 Aug 2026 - 28 Aug 2026"), not the long-form date used elsewhere: with a
  // customInput, react-datepicker overwrites the value prop with its own.
  // The label is react-datepicker's own dateFormat="dd MMM yyyy" rendering, not
  // the dateRangeLabel() helper in the checked-out source — the deployed build
  // measures as "10 Aug 2026 - 20 Aug 2026", with a plain hyphen and the year,
  // and a trailing "-" while only the start is picked.
  function pickerDate(iso) {
    const d = new Date(iso + "T00:00:00");
    return String(d.getDate()).padStart(2, "0") + " " +
      d.toLocaleDateString("en-US", { month: "short" }) + " " + d.getFullYear();
  }
  function dateRangeLabel(from, to) {
    if (!from) return "";
    return to ? pickerDate(from) + " - " + pickerDate(to) : pickerDate(from) + " - ";
  }

  // react-datepicker, rebuilt: the same 205px calendar with its 8px popper
  // offset, 22.95px day cells, greyed outside-month days, disabled future days
  // and the brand range highlight QA styles it with.
  function DateRangeCalendar(from, to, monthKey) {
    const parts = String(monthKey || "").split("-");
    const year = Number(parts[0]) || new Date().getFullYear();
    const month = (Number(parts[1]) || (new Date().getMonth() + 1)) - 1;
    const first = new Date(year, month, 1);
    const todayIso = U.toLocalDateStr(new Date());
    const todayY = new Date().getFullYear();
    const todayM = new Date().getMonth();
    const monthLabel = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    const cell = { display: "inline-block", width: 22.95, lineHeight: "22.95px", margin: 2.241, textAlign: "center", fontSize: 10.8 };

    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(function (d) {
      return '<div style="' + U.sty(cell) + '">' + d + "</div>";
    }).join("");

    // Six weeks from the Sunday on or before the 1st, as react-datepicker draws.
    const start = new Date(year, month, 1 - first.getDay());
    const weeks = [];
    for (let w = 0; w < 6; w++) {
      let row = "";
      for (let d = 0; d < 7; d++) {
        const day = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
        const iso = U.toLocalDateStr(day);
        const outside = day.getMonth() !== month;
        const disabled = iso > todayIso;
        const isStart = from && iso === from;
        const isEnd = to && iso === to;
        const inRange = from && to && iso > from && iso < to;
        const st = U.mix(cell, null);
        if (disabled) st.color = "#ccc";
        else if (outside) st.color = "#000";
        if (isStart || isEnd) { st.background = U.BRAND; st.color = "white"; st.borderRadius = 4.05; st.fontWeight = 700; }
        else if (inRange) { st.background = "#cfe5e8"; st.color = "#174f58"; st.borderRadius = 4.05; }
        st.cursor = disabled ? "default" : "pointer";
        row += '<div' + (disabled ? "" : U.act("report-cal-pick", iso)) + ' style="' + U.sty(st) + '">' + day.getDate() + "</div>";
      }
      weeks.push('<div style="' + U.sty({ textAlign: "center" }) + '">' + row + "</div>");
      if (new Date(start.getFullYear(), start.getMonth(), start.getDate() + (w + 1) * 7).getMonth() !== month && w >= 4) break;
    }

    const nav = function (delta, label, side) {
      const arrow = { position: "absolute", top: 6, width: 9, height: 9, borderColor: "#ccc", borderStyle: "solid", borderWidth: "3px 3px 0 0", content: "" };
      arrow[side === "left" ? "left" : "right"] = -2;
      arrow.transform = side === "left" ? "rotate(225deg)" : "rotate(45deg)";
      return '<button type="button" aria-label="' + label + '"' + U.act("report-cal-month", delta) + ' style="' + U.sty(U.mix({
        position: "absolute", top: 2, width: 32, height: 32, background: "none", border: "none",
        padding: 0, cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      }, side === "left" ? { left: 2 } : { right: 2 })) + '">' +
        '<span style="' + U.sty(U.mix({ position: "relative", display: "block", width: 0, height: 30 }, side === "left" ? { left: 2 } : { right: 2 })) + '">' +
          '<span style="' + U.sty(arrow) + '"></span>' +
        "</span></button>";
    };

    return '<div style="' + U.sty({ position: "absolute", top: "100%", left: 0, paddingTop: 10, zIndex: 1 }) + '">' +
      '<div style="' + U.sty({
        display: "inline-block", position: "relative", background: "white",
        border: "1px solid #e1e5ea", borderRadius: 4.05,
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.16)",
        fontFamily: "inherit", fontSize: 10.8, lineHeight: 1.5, color: "#000",
      }) + '">' +
        // react-datepicker's pointer: a grey-bordered triangle with a lighter
        // one drawn a pixel below it, 85px in from the calendar's left edge.
        '<div style="' + U.sty({ position: "absolute", left: 0, top: 0, width: 0, height: 0, margin: "-8px 0 0 -4px", transform: "translateX(85px)" }) + '">' +
          '<span style="' + U.sty({ position: "absolute", top: -1, left: -8, width: 1, height: 0, boxSizing: "content-box", borderWidth: "0 8px 8px", borderStyle: "solid", borderColor: "transparent transparent #aeaeae" }) + '"></span>' +
          '<span style="' + U.sty({ position: "absolute", top: 0, left: -8, width: 1, height: 0, boxSizing: "content-box", borderWidth: "0 8px 8px", borderStyle: "solid", borderColor: "transparent transparent #f0f0f0" }) + '"></span>' +
        "</div>" +
        // maxDate is today upstream, so react-datepicker drops the next arrow
        // entirely once the displayed month is the current one — there is no
        // greyed-out state, the button is simply not rendered.
        nav(-1, "Previous Month", "left") +
        (year > todayY || (year === todayY && month >= todayM) ? "" : nav(1, "Next Month", "right")) +
        '<div style="' + U.sty({ width: 202.7 }) + '">' +
          '<div style="' + U.sty({ background: "#f7fafb", borderBottom: "1px solid #e1e5ea", borderRadius: "4.05px 4.05px 0 0", padding: "8px 0", position: "relative", textAlign: "center" }) + '">' +
            '<div style="' + U.sty({ fontSize: 12.744, lineHeight: 1.5, fontWeight: 700, textAlign: "center" }) + '">' + monthLabel + "</div>" +
            '<div style="' + U.sty({ margin: "0 0 -8px", textAlign: "center" }) + '">' + dayNames + "</div>" +
          "</div>" +
          '<div style="' + U.sty({ margin: 5.4, textAlign: "center" }) + '">' + weeks.join("") + "</div>" +
        "</div>" +
      "</div></div>";
  }

  window.RD.screen("reports", function () {
    const S = window.RD.state.scratch;
    const summary = SDK.routeDelivery.getReportsSummary().data;
    const sort = S.reportSort || "newest";
    const search = (S.reportSearch || "").trim().toLowerCase();

    let list = D.db.routes.filter(function (r) { return r.status === "CLOSED"; });
    // A range filter: with only a start picked, that single day is the range.
    if (S.reportFrom) {
      const to = S.reportTo || S.reportFrom;
      list = list.filter(function (r) { return r.scheduledDate >= S.reportFrom && r.scheduledDate <= to; });
    }
    if (search) list = list.filter(function (r) { return r.name.toLowerCase().indexOf(search) !== -1; });
    list = list.slice().sort(function (a, b) {
      if (sort === "name-asc") return a.name.localeCompare(b.name);
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      const d = String(a.scheduledDate).localeCompare(String(b.scheduledDate));
      return sort === "oldest" ? d : -d;
    });

    // Reports has its own tile: a white card with a hairline border, not the
    // colour-block StatTile the dashboard uses.
    const tile = function (value, label, color) {
      return '<div style="' + U.sty({
        minWidth: 0, minHeight: 66, padding: "13px 10px", borderRadius: 14, background: "white",
        textAlign: "center", boxShadow: "0 1px 3px rgba(15,23,42,0.08)", border: "1px solid #e8ebef",
        display: "flex", flexDirection: "column", justifyContent: "center",
      }) + '">' +
        '<div style="' + U.sty({ fontSize: 17, lineHeight: 1.1, fontWeight: 800, color: color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) + '">' + U.esc(value) + "</div>" +
        '<div style="' + U.sty({ marginTop: 5, fontSize: 10, fontWeight: 700, color: "#8a919b", textTransform: "uppercase", letterSpacing: "0.25px" }) + '">' + label + "</div>" +
      "</div>";
    };

    // Two empty states upstream: nothing closed yet, versus nothing matching the
    // filters that are on — the second offers to clear them.
    const hasFilters = !!search || !!S.reportFrom;
    const emptyState = hasFilters
      ? '<div style="' + U.sty({ padding: "38px 24px", textAlign: "center" }) + '">' +
          '<div style="' + U.sty({ fontSize: 34, marginBottom: 10 }) + '">🔍</div>' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 800, color: "#111827" }) + '">No reports match</div>' +
          '<div style="' + U.sty({ marginTop: 6, fontSize: 13, color: "#7b8490" }) + '">Try another search or date.</div>' +
          '<button type="button"' + U.act("report-clear-filters") + ' style="' + U.sty({
            marginTop: 14, padding: "9px 18px", border: "1.5px solid " + U.BRAND, borderRadius: 11,
            background: "white", color: U.BRAND, fontFamily: "inherit", fontWeight: 800, cursor: "pointer",
          }) + '">Clear filters</button>' +
        "</div>"
      : '<div style="' + U.sty({ padding: "38px 24px", textAlign: "center" }) + '">' +
          '<div style="' + U.sty({ fontSize: 38, marginBottom: 10 }) + '">📊</div>' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 800, color: "#111827" }) + '">No completed reports yet</div>' +
          '<div style="' + U.sty({ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "#7b8490" }) + '">Reports will appear here after a route is closed.</div>' +
        "</div>";
    const rows = list.length ? list.map(ReportCard).join("") : emptyState;

    const dateActive = !!S.reportFrom;

    return U.MobileHeader({ title: "Reports", subtitle: "Completed route reports", onBack: false, showHome: false }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, padding: "12px 12px 14px" }) + '">' +
          tile(String(summary.totalReports), "Reports", U.BRAND) +
          tile(U.inr(summary.totalCollected), "Collected", U.GREEN) +
        "</div>" +
        '<div style="' + U.sty({ padding: "0 12px 12px" }) + '">' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 9 }) + '">Report history</div>' +
          '<div style="' + U.sty({ position: "relative", marginBottom: 8 }) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="' + U.sty({
              position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#9ca3af", pointerEvents: "none",
            }) + '"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg>' +
            '<input type="search" data-model="report-search" value="' + U.esc(S.reportSearch || "") + '" placeholder="Search reports…" aria-label="Search reports" style="' + U.sty({
              width: "100%", boxSizing: "border-box", minHeight: 44, padding: "11px 20px 11px 36px",
              border: "1.5px solid #e1e5ea", borderRadius: 12, background: "white", color: "#212b42",
              fontFamily: "inherit", fontSize: 14, outline: "none",
            }) + '" /></div>' +
          // Two controls, not a chip strip: a date-range field and a native
          // sort <select>, as QA renders them.
          '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 8 }) + '">' +
            '<div style="' + U.sty({ position: "relative", minWidth: 0 }) + '">' +
              '<div role="button" tabindex="0" aria-label="Filter reports by date range"' + U.act("report-date-open") + ' style="' + U.sty({
                width: "100%", minHeight: 42, boxSizing: "border-box",
                padding: "0 " + (dateActive ? 34 : 12) + "px 0 12px",
                border: "1.5px solid " + (dateActive ? U.BRAND : "#e1e5ea"), borderRadius: 12,
                background: dateActive ? "#eef6f7" : "white", color: dateActive ? U.BRAND : "#667085",
                display: "flex", alignItems: "center", gap: 8, fontFamily: "inherit", fontSize: 12,
                fontWeight: 700, overflow: "hidden", cursor: "pointer", textAlign: "left",
              }) + '">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;flex-shrink:0"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>' +
                '<span style="' + U.sty({ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) + '">' + (dateActive ? U.esc(dateRangeLabel(S.reportFrom, S.reportTo)) : "All dates") + "</span>" +
                (dateActive
                  ? '<span role="button" aria-label="Clear date filter"' + U.act("report-date-clear") + ' style="' + U.sty({ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center" }) + '">' +
                      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></span>'
                  : "") +
              "</div>" +
              (S.reportDateOpen ? DateRangeCalendar(S.reportFrom, S.reportTo, S.reportCalMonth) : "") +
            "</div>" +
            '<div style="' + U.sty({ position: "relative", minWidth: 0 }) + '">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="' + U.sty({
                position: "absolute", zIndex: 1, left: 11, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: U.BRAND, pointerEvents: "none",
              }) + '"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>' +
              '<select data-model="report-sort" aria-label="Sort reports" style="' + U.sty({
                width: "100%", minHeight: 42, boxSizing: "border-box", padding: "0 28px 0 33px",
                border: "1.5px solid #e1e5ea", borderRadius: 12, background: "white", color: "#475467",
                fontFamily: "inherit", fontSize: 12, fontWeight: 700, outline: "none", cursor: "pointer",
              }) + '">' +
                SORTS.map(function (o) {
                  return '<option value="' + o.key + '"' + (sort === o.key ? " selected" : "") + ">" + U.esc(o.label) + "</option>";
                }).join("") +
              "</select>" +
            "</div>" +
          "</div>" +
        "</div>" +
        rows + U.Spacer(12) +
      "</div>" +
      U.TabBar("reports");
  });

  window.RD.action("report-date-open", function () {
    const S = window.RD.state.scratch;
    S.reportDateOpen = !S.reportDateOpen;
    if (S.reportDateOpen && !S.reportCalMonth) {
      const anchor = S.reportFrom ? new Date(S.reportFrom + "T00:00:00") : new Date();
      S.reportCalMonth = anchor.getFullYear() + "-" + String(anchor.getMonth() + 1).padStart(2, "0");
    }
    window.RD.render();
  });
  window.RD.action("report-cal-month", function (delta) {
    const S = window.RD.state.scratch;
    const parts = String(S.reportCalMonth).split("-");
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1 + Number(delta), 1);
    S.reportCalMonth = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    window.RD.render();
  });
  // A range picker: the first press sets the start and keeps the calendar up,
  // the second sets the end and closes it (shouldCloseOnSelect upstream).
  window.RD.action("report-cal-pick", function (iso) {
    const S = window.RD.state.scratch;
    if (!S.reportFrom || S.reportTo) { S.reportFrom = iso; S.reportTo = null; }
    else if (iso < S.reportFrom) { S.reportFrom = iso; S.reportTo = null; }
    else { S.reportTo = iso; S.reportDateOpen = false; }
    window.RD.render();
  });
  window.RD.action("model:report-date", function (v) {
    window.RD.state.scratch.reportDate = v || null;
    window.RD.render();
  });
  window.RD.action("model:report-sort", function (v) {
    window.RD.state.scratch.reportSort = v;
    window.RD.render();
  });
  window.RD.action("report-date-clear", function () {
    const S = window.RD.state.scratch;
    S.reportFrom = null; S.reportTo = null; S.reportDateOpen = false;
    window.RD.render();
  });

  window.RD.action("report-sort", function (k) { window.RD.state.scratch.reportSort = k; window.RD.render(); });
  window.RD.action("report-search-clear", function () { window.RD.state.scratch.reportSearch = ""; window.RD.render(); });
  window.RD.action("model:report-search", function (v) {
    window.RD.state.scratch.reportSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="report-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("report-clear-filters", function () {
    const S = window.RD.state.scratch;
    S.reportSearch = ""; S.reportFrom = null; S.reportTo = null; S.reportDateOpen = false;
    window.RD.render();
  });
  window.RD.action("report-open", function (routeId) { window.RD.go("/analytics/" + routeId); });
})();

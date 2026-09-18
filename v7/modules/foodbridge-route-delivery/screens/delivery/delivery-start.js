/* ==========================================================================
   DELIVERY MANAGEMENT — start of day

   The four things that must happen before a van leaves, in order, each one
   gating the next:

     Pre-Start     the checklist            pages/RoutePreStart.jsx
     Load Stock    what goes on the van     pages/LoadStock.jsx
     Opening Cash  float for giving change  pages/OpeningCash.jsx
     Sign-Off      driver takes the risk    pages/StaffSignOff.jsx

   The gating is the point: Opening Cash stays locked until stock is confirmed,
   Sign-Off until both are. Tapping a locked step explains what is blocking it
   rather than doing nothing, which is the behaviour the real screen has and the
   one most worth preserving — a driver tapping a dead row assumes a bug.
   ========================================================================== */

(function () {
  "use strict";

  const U = window.RD_UI, D = window.RD_DB, SDK = window.RD_SDK,
        M = window.RD_MODELS, V = window.RD_VALID;

  // Stock value and the cash float are not among the four gated amount types
  // upstream, so they keep natural precision rather than the rounded display.
  function rawInr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

  function routeOr404(routeId) {
    const r = D.db.routeDetails[routeId];
    if (!r) throw new Error("Route " + routeId + " not found");
    return r;
  }

  // The app's own formatter, not a local one: it renders en-US ("August 30,
  // 2026"), and a date that reads differently here than in the real app is
  // exactly the kind of drift these screens are being compared for.
  const fmtRouteDate = M.formatRouteDate;

  /* ══ Pre-Start ═════════════════════════════════════════════════════════ */

  window.RD.screen("preStart", function (p) {
    const route = routeOr404(p.routeId);
    const cl = route.checklist || {};
    const stockLoaded = cl.stockLoad && cl.stockLoad.status === "COMPLETED";
    const cashDone    = cl.openingCash && cl.openingCash.status === "COMPLETED";
    const signOffDone = cl.signOff && cl.signOff.status === "COMPLETED";
    const stockUnits  = (cl.stockLoad && cl.stockLoad.totalUnits) || 0;
    const stockValue  = (cl.stockLoad && cl.stockLoad.estimatedValue) || 0;
    const cashAmount  = (cl.openingCash && cl.openingCash.amount) || 0;
    const inProgress  = route.status === "IN_PROGRESS";

    // Nothing left to do here: usePreStartController redirects a route whose
    // stock load and opening cash are both settled straight to Sign-Off, so
    // Pre-Start is only ever seen with a step still outstanding.
    if (!inProgress && stockLoaded && cashDone) { window.RD.go("/sign-off/" + p.routeId); return ""; }

    const hint = window.RD.state.scratch.lockHint;

    const startLabel = inProgress ? "▶ Continue Route →"
      : !stockLoaded ? "Complete Stock Load to Start"
      : !cashDone ? "Complete Opening Cash to Start"
      : "🚀 Start Route";

    const badges = '<div style="' + U.sty({ display: "flex", gap: 8, padding: "14px 12px 4px", flexWrap: "wrap" }) + '">' +
      '<span style="' + U.sty({ padding: "7px 13px", background: "white", borderRadius: 20, fontSize: 13, fontWeight: 600, color: "#555" }) + '">👥 ' + route.totalStops + " customers</span>" +
      '<span style="' + U.sty({ padding: "7px 13px", background: "white", borderRadius: 20, fontSize: 13, fontWeight: 600, color: "#ef4444" }) + '">' + U.inr(route.outstandingAmount) + " outstanding</span>" +
      (route.beatArea ? '<span style="' + U.sty({ padding: "7px 13px", background: "white", borderRadius: 20, fontSize: 13, fontWeight: 600, color: "#555" }) + '">📍 ' + U.esc(route.beatArea) + "</span>" : "") +
      "</div>";

    const summary = U.Card(
      U.SettleRow("Total Customers", String(route.totalStops)) +
      U.SettleRow("Est. Collection", U.inr(route.estimatedCollectionAmount), "#16a34a") +
      U.SettleRow("Outstanding to collect", U.inr(route.outstandingAmount), "#ef4444") +
      U.SettleRow("Stock Loaded", stockUnits > 0 ? stockUnits + " units" : "—", null, true)
    );

    return U.MobileHeader({
        title: route.name,
        subtitle: [fmtRouteDate(route.scheduledDate), route.driver && route.driver.name].filter(Boolean).join(" · "),
        backLabel: "Routes", backAct: "home",
      }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        badges +
        U.Banner({ type: "blue", icon: "ℹ️", text: "Complete all steps below before starting the route", style: { marginTop: 10 } }) +
        U.SectionHeader("Before You Start") +
        U.CheckItem({
          done: stockLoaded, active: !stockLoaded, title: "Stock Loaded",
          subtitle: stockLoaded
            ? (stockUnits > 0 ? stockUnits + " units · " + rawInr(stockValue) + " est. value" : "Stock confirmed ✓")
            : "Tap to load stock",
          action: stockLoaded ? "Done ✓" : "Start →",
          actName: "prestart-step", arg: "stockLoad",
        }) +
        U.CheckItem({
          done: cashDone, active: stockLoaded && !cashDone, title: "Opening Cash",
          subtitle: cashDone ? rawInr(cashAmount) + " taken for change"
            : stockLoaded ? "Tap to record opening cash" : "🔒 Confirm Stock Load first",
          action: cashDone ? "Done ✓" : stockLoaded ? "Start →" : "🔒",
          actName: "prestart-step", arg: "openingCash",
        }) +
        U.CheckItem({
          done: signOffDone, active: stockLoaded && cashDone && !signOffDone, title: "Staff Sign-Off",
          subtitle: signOffDone ? "Route signed off ✓"
            : (stockLoaded && cashDone) ? "Tap to sign off and start" : "🔒 Complete steps above first",
          action: signOffDone ? "Done ✓" : (stockLoaded && cashDone) ? "Start →" : "🔒",
          actName: "prestart-step", arg: "signOff",
        }) +
        (hint ? '<div style="' + U.sty({ margin: "6px 12px 0", padding: "10px 14px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, fontSize: 13, fontWeight: 600, color: "#92400e" }) + '">' + U.esc(hint) + "</div>" : "") +
        U.Divider({ marginTop: 8 }) +
        U.SectionHeader("Route Summary") +
        summary +
      "</div>" +
      U.ActionBar(U.BtnXL({
        variant: inProgress ? "green" : "brand", label: startLabel,
        actName: "prestart-begin", arg: p.routeId,
      }));
  });

  window.RD.action("prestart-step", function (step) {
    const routeId = window.RD.state.routeId;
    const cl = D.db.routeDetails[routeId].checklist || {};
    const stockDone = cl.stockLoad && cl.stockLoad.status === "COMPLETED";
    const cashDone  = cl.openingCash && cl.openingCash.status === "COMPLETED";

    // A locked step explains itself instead of doing nothing.
    if (step === "openingCash" && !stockDone) {
      window.RD.state.scratch.lockHint = "⚡ Complete Stock Load first to unlock Opening Cash";
      window.RD.render();
      setTimeout(function () { delete window.RD.state.scratch.lockHint; window.RD.render(); }, 2500);
      return;
    }
    if (step === "signOff" && (!stockDone || !cashDone)) {
      window.RD.state.scratch.lockHint = "⚡ Complete " + (!stockDone ? "Stock Load" : "Opening Cash") + " first to unlock Staff Sign-Off";
      window.RD.render();
      setTimeout(function () { delete window.RD.state.scratch.lockHint; window.RD.render(); }, 2500);
      return;
    }
    if (step === "stockLoad") window.RD.go("/load-stock/" + routeId);
    else if (step === "openingCash") window.RD.go("/opening-cash/" + routeId);
    else window.RD.go("/sign-off/" + routeId);
  });

  window.RD.action("prestart-begin", function (routeId) {
    const route = D.db.routeDetails[routeId];
    if (route.status === "IN_PROGRESS") { window.RD.go("/queue/" + routeId); return; }
    const cl = route.checklist || {};
    if (!(cl.stockLoad && cl.stockLoad.status === "COMPLETED")) { window.RD.go("/load-stock/" + routeId); return; }
    if (!(cl.openingCash && cl.openingCash.status === "COMPLETED")) { window.RD.go("/opening-cash/" + routeId); return; }
    window.RD.go("/sign-off/" + routeId);
  });

  /* ══ Load Stock ════════════════════════════════════════════════════════ */
  // Four modes upstream (load / view / approve / restock). This cut covers the
  // two a driver reaches from Pre-Start: editing a load, and viewing one that a
  // DELIVERY-only staffer has requested and cannot change (readOnly).

  function stockRows(routeId) {
    const S = window.RD.state.scratch;
    if (!S.stockQtys) {
      const load = D.db.stockLoads[routeId];
      // The whole catalogue, not a slice: a route with no stock load yet must
      // still offer every product the depot carries, as the reference does.
      const products = (load && load.products) ? load.products : D.db.products.map(function (p) {
        return { productId: p.productId, name: p.title.en, unitPrice: p.prices.priceMap.Piece, planQty: 0, loadedQty: 0 };
      });
      S.stockProducts = products.map(function (p) { return { productId: p.productId, name: p.name, price: p.unitPrice, planQty: p.planQty || 0 }; });
      S.stockQtys = products.map(function (p) { return p.loadedQty || 0; });
    }
    return S;
  }

  window.RD.screen("loadStock", function (p) {
    const route = routeOr404(p.routeId);
    const S = stockRows(p.routeId);
    const readOnly = route.status === "STOCK_REQUESTED";
    const search = (S.stockSearch || "").trim().toLowerCase();

    const rows = S.stockProducts
      .map(function (prod, i) { return { prod: prod, i: i }; })
      .filter(function (r) { return !search || r.prod.name.toLowerCase().indexOf(search) !== -1; });

    const totalUnits = S.stockQtys.reduce(function (a, q) { return a + (Number(q) || 0); }, 0);
    const totalValue = S.stockProducts.reduce(function (a, prod, i) { return a + (Number(S.stockQtys[i]) || 0) * prod.price; }, 0);

    const list = rows.length === 0
      ? '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", padding: "32px 24px", textAlign: "center", color: "#888" }) + '">No products match your search.</div>'
      : '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' +
        rows.map(function (r, fi) {
          const qty = S.stockQtys[r.i] || 0;
          return '<div style="' + U.sty({
              display: "flex", alignItems: "center", justifyContent: "space-between", padding: 16,
              borderBottom: fi < rows.length - 1 ? "1px solid #f5f5f5" : "none",
            }) + '">' +
            "<div>" +
              '<div style="' + U.sty({ fontSize: 16, fontWeight: 600, color: "#111" }) + '">' + U.esc(r.prod.name) + "</div>" +
              '<div style="' + U.sty({ fontSize: 12, color: "#888", marginTop: 2 }) + '">₹' + r.prod.price + " / unit</div>" +
            "</div>" +
            (readOnly
              ? '<div style="' + U.sty({ fontSize: 18, fontWeight: 700, color: "#111", minWidth: 40, textAlign: "right" }) + '">' + qty + "</div>"
              : U.StepperInput({ value: qty, arg: r.i, decAct: "stock-dec", incAct: "stock-inc", model: "stock-qty-" + r.i })) +
            "</div>";
        }).join("") + "</div>";

    const totals = '<div style="' + U.sty({ display: "flex", gap: 10, padding: "0 12px 12px" }) + '">' +
      '<div style="' + U.sty({ flex: 1, background: "white", borderRadius: 14, padding: 13, textAlign: "center" }) + '">' +
        '<div style="' + U.sty({ fontSize: 22, fontWeight: 800, color: U.BRAND }) + '">' + totalUnits + "</div>" +
        '<div style="' + U.sty({ fontSize: 11, color: "#888", fontWeight: 600, marginTop: 2 }) + '">Total Units</div></div>' +
      '<div style="' + U.sty({ flex: 1, background: "white", borderRadius: 14, padding: 13, textAlign: "center" }) + '">' +
        '<div style="' + U.sty({ fontSize: 22, fontWeight: 800, color: "#16a34a" }) + '">' + U.inr(totalValue) + "</div>" +
        '<div style="' + U.sty({ fontSize: 11, color: "#888", fontWeight: 600, marginTop: 2 }) + '">Est. Value</div></div></div>';

    const confirming = !!S.stockConfirming;
    const loadedItems = (S.stockProducts || []).map(function (prod, i) {
      return { name: prod.name, qty: Number(S.stockQtys[i]) || 0, orderingUnit: prod.orderingUnit || "" };
    }).filter(function (it) { return it.qty > 0; });
    const footer = readOnly
      ? '<div style="' + U.sty({ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 14 }) + '">' +
          '<span style="font-size:16px">⏳</span><span style="' + U.sty({ fontSize: 13, color: "#6b7280", fontWeight: 500 }) + '">Waiting for a stock-load staffer to approve this request</span></div>'
      : confirming
        ? U.ConfirmPanel({
            action: "Loading Stock", amount: totalUnits + " units",
            context: U.inr(totalValue) + " estimated value · " + loadedItems.length + " product" + (loadedItems.length !== 1 ? "s" : ""),
            backLabel: "Edit Quantities", commitLabel: "Confirm Load",
            commitAct: "stock-commit", arg: p.routeId,
            processing: !!S.committing, processingLabel: "Saving stock reconciliation…",
            // QA lists what is about to be committed inside the panel, so the
            // driver confirms the load itself and not just a units total.
            extra: '<div style="' + U.sty({ background: "#f8fafc", borderRadius: 10, border: "1px solid #e9eef2", overflow: "hidden", maxHeight: 150, overflowY: "auto" }) + '">' +
              loadedItems.map(function (it, i) {
                return '<div style="' + U.sty({
                  display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px",
                  borderBottom: i < loadedItems.length - 1 ? "1px solid #f1f5f9" : "none",
                }) + '">' +
                  '<span style="' + U.sty({ fontSize: 13, color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }) + '">' + U.esc(it.name) + "</span>" +
                  '<span style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#374151", flexShrink: 0 }) + '">× ' + it.qty + (it.orderingUnit ? " " + U.esc(it.orderingUnit) : "") + "</span></div>";
              }).join("") + "</div>",
          })
        : U.BtnXL({
            variant: "brand",
            label: totalUnits === 0 ? "Add stock quantities to continue" : "Confirm Stock ✓",
            actName: "stock-confirm", disabled: totalUnits === 0,
          });

    // The banner tracks whether the quantities came pre-filled from today's
    // proxy orders (LoadStock.jsx bannerFor) — a green "adjust if needed" when
    // they did, a blue "enter the quantity" when the driver starts from zero.
    const prefilled = (S.stockProducts || []).some(function (prod, i) { return (Number(S.stockQtys[i]) || 0) > 0; });
    const banner = prefilled
      ? { type: "green", icon: "📦", text: "Quantities auto-filled from today's proxy orders. Adjust if needed." }
      : { type: "blue",  icon: "✏️", text: "Enter the quantity for each product you are loading today." };

    return U.MobileHeader({ title: "Load Stock", subtitle: routeSubtitle(route.name, route.beatArea), backLabel: routeBackLabel(route.name), backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: confirming ? 0.35 : 1, pointerEvents: confirming ? "none" : "auto" }) + '">' +
        U.Banner({ type: banner.type, icon: banner.icon, text: banner.text, style: { marginTop: 10 } }) +
        '<div style="padding:0 12px 8px">' + U.SearchInput({ value: S.stockSearch || "", model: "stock-search", placeholder: "Search products…", clearAct: "stock-search-clear" }) + "</div>" +
        list + totals +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  window.RD.action("stock-inc", function (i) { const S = window.RD.state.scratch; S.stockQtys[i] = (Number(S.stockQtys[i]) || 0) + 1; window.RD.render(); });
  window.RD.action("stock-dec", function (i) { const S = window.RD.state.scratch; S.stockQtys[i] = Math.max(0, (Number(S.stockQtys[i]) || 0) - 1); window.RD.render(); });
  // Typing a quantity beats tapping + twelve times. Wildcard handler, see the
  // onInput note in delivery-core.
  window.RD.action("model:stock-qty#", function (value, idx) {
    const S = window.RD.state.scratch;
    S.stockQtys[Number(idx)] = Number(String(value).replace(/\D/g, "")) || 0;
    window.RD.render();
    const el = document.querySelector('[data-model="stock-qty-' + idx + '"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });

  window.RD.action("stock-search-clear", function () { window.RD.state.scratch.stockSearch = ""; window.RD.render(); });
  window.RD.action("model:stock-search", function (v) {
    window.RD.state.scratch.stockSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="stock-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("stock-confirm", function () { window.RD.state.scratch.stockConfirming = true; window.RD.render(); });
  window.RD.action("confirm-cancel", function () {
    const S = window.RD.state.scratch;
    S.stockConfirming = false; S.cashConfirming = false; S.payConfirming = false;
    S.countConfirming = false; S.handoverConfirming = false;
    window.RD.render();
  });

  window.RD.action("stock-commit", function (routeId) {
    window.RD.commit(function () {
      const S = window.RD.state.scratch;
      const items = S.stockProducts.map(function (prod, i) {
        return { productId: prod.productId, name: prod.name, unitPrice: prod.price, loadedQty: Number(S.stockQtys[i]) || 0 };
      }).filter(function (it) { return it.loadedQty > 0; });
      SDK.routeDelivery.confirmStockLoad({ routeId: routeId, products: items });
      S.stockConfirming = false;
      window.RD.go("/opening-cash/" + routeId);
    });
  });

  // LoadStock.jsx routeBackLabel/routeSubtitle. The back link drops any date
  // baked into the route name, and the subtitle omits the beat area when the
  // route name already contains it.
  function routeBackLabel(name) {
    const clean = String(name || "").replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, "").replace(/\s+/g, " ").trim();
    return clean || "Route Summary";
  }

  function routeSubtitle(routeName, beatArea) {
    const name = String(routeName || "").trim();
    const area = String(beatArea || "").trim();
    if (!name) return area || "Load stock for today";
    if (!area || name.toLowerCase().indexOf(area.toLowerCase()) !== -1) return name;
    return name + " · " + area;
  }

  /* ══ Opening Cash ══════════════════════════════════════════════════════ */

  const OPENING_CASH_QUICK = [200, 500, 1000, 2000];

  window.RD.screen("openingCash", function (p) {
    const route = routeOr404(p.routeId);
    const S = window.RD.state.scratch;
    if (S.cashAmount === undefined) { S.cashAmount = "500"; S.cashPrefilled = true; }
    const display = M.formatPaymentDisplay ? M.formatPaymentDisplay(S.cashAmount) : S.cashAmount;
    const confirming = !!S.cashConfirming;

    const quick = '<div style="' + U.sty({ display: "flex", gap: 8, padding: "0 16px", flexWrap: "wrap", marginBottom: 8, flexShrink: 0 }) + '">' +
      OPENING_CASH_QUICK.map(function (q) {
        const on = S.cashAmount === String(q);
        return '<button type="button" class="rd-chip"' + U.act("cash-preset", q) + ' style="' + U.sty({
          padding: "10px 10px", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer",
          flex: "1 1 calc(25% - 8px)", textAlign: "center",
          border: "2px solid " + (on ? U.BRAND : "#e5e7eb"),
          background: on ? "#e8f5f7" : "white", color: on ? U.BRAND : "#111",
        }) + '">₹' + q.toLocaleString("en-IN") + "</button>";
      }).join("") + "</div>";

    const footer = confirming
      ? U.ConfirmPanel({
          action: "Opening Cash Float", amount: "₹" + display,
          context: "for giving change on this route",
          backLabel: "Change Amount", commitLabel: "Confirm Float",
          commitAct: "cash-commit", arg: p.routeId,
          processing: !!S.committing, processingLabel: "Saving opening cash float…",
        })
      : U.BtnXL({ variant: "brand", label: "Confirm ₹" + display + " →", actName: "cash-confirm" });

    return U.MobileHeader({ title: "Cash for Change", subtitle: "How much cash are you taking for giving change?", backLabel: "Load Stock", backAct: "back" }) +
      '<div style="' + U.sty({ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: U.BG, opacity: confirming ? 0.35 : 1, pointerEvents: confirming ? "none" : "auto" }) + '">' +
        '<div style="' + U.sty({ textAlign: "center", padding: "12px 16px 8px", flexShrink: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 13, color: "#888", fontWeight: 600, marginBottom: 4 }) + '">Amount from register</div>' +
          '<div style="' + U.sty({ fontSize: 44, fontWeight: 800, color: "#111", lineHeight: 1 }) + '">' +
            '<span style="' + U.sty({ fontSize: 22, color: "#888", verticalAlign: "super" }) + '">₹</span>' + U.esc(display) + "</div></div>" +
        U.SectionHeader("Quick Select") + quick +
        '<div style="' + U.sty({ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingBottom: 8 }) + '">' +
          U.NumPad("cash-key", { flex: 1, minHeight: 0 }) + "</div>" +
        (S.cashError
          ? '<div style="' + U.sty({ padding: "4px 16px", color: "#ef4444", fontSize: 13, textAlign: "center", flexShrink: 0 }) + '">' + U.esc(S.cashError) + "</div>"
          : "") +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  window.RD.action("cash-key", function (k) {
    const S = window.RD.state.scratch;
    S.cashAmount = M.applyNumpadKey(S.cashAmount || "", k, S.cashPrefilled);
    S.cashPrefilled = false;
    S.cashError = null;
    window.RD.render();
  });
  window.RD.action("cash-preset", function (q) {
    const S = window.RD.state.scratch;
    // A preset re-arms the prefill flag, so the next key typed replaces the
    // preset rather than appending to it (useOpeningCashController.handlePreset).
    S.cashAmount = String(q); S.cashPrefilled = true;
    window.RD.render();
  });
  window.RD.action("cash-confirm", function () {
    const S = window.RD.state.scratch;
    const check = V.validateOpeningCash({ amount: Number(S.cashAmount) });
    if (!check.valid) { S.cashError = check.errors.amount || "Enter a valid amount"; window.RD.render(); return; }
    S.cashError = null; S.cashConfirming = true; window.RD.render();
  });
  window.RD.action("cash-commit", function (routeId) {
    window.RD.commit(function () {
      const S = window.RD.state.scratch;
      SDK.routeDelivery.recordOpeningCash({ routeId: routeId, amount: Number(S.cashAmount) });
      S.cashConfirming = false;
      window.RD.go("/sign-off/" + routeId);
    });
  });

  /* ══ Staff Sign-Off ════════════════════════════════════════════════════ */

  window.RD.screen("signOff", function (p) {
    const route = routeOr404(p.routeId);
    // A route already running has nothing left to sign off; upstream's PhaseGate
    // sends it on to the queue rather than showing a second confirmation.
    if (route.status === "IN_PROGRESS") { window.RD.go("/queue/" + p.routeId); return ""; }

    const cl = route.checklist || {};
    const startTime = M.formatRouteTime();

    // Back goes to whichever step actually precedes this one
    // (useStaffSignOffController: '← Opening Cash' when it was required).
    const cashRequired = !(cl.openingCash && cl.openingCash.required === false);
    return U.MobileHeader({ title: "Ready to Start", subtitle: route.name + " · " + fmtRouteDate(route.scheduledDate), backLabel: cashRequired ? "Opening Cash" : "Pre-Start", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        U.Spacer() +
        U.Card(
          U.CardTitle("Confirmed") +
          U.SettleRow("📦 Stock Loaded", ((cl.stockLoad && cl.stockLoad.totalUnits) || 0) + " units ✓", "#16a34a") +
          U.SettleRow("💵 Opening Cash", rawInr((cl.openingCash && cl.openingCash.amount) || 0) + " ✓", "#16a34a") +
          U.SettleRow("👥 Customers", route.totalStops + " stops") +
          U.SettleRow("🗺️ Beat Area", route.beatArea || "—") +
          U.SettleRow("⏰ Start Time", startTime, null, true)
        ) +
        U.Banner({ type: "green", icon: "✅", text: "By tapping Start you confirm the above and take responsibility for the stock and cash." }) +
        U.Spacer() +
      "</div>" +
      U.ActionBar('<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
        U.BtnXL({ variant: "outline", label: "Start Later", style: { flex: 1, fontSize: 15, padding: 15 }, actName: "home" }) +
        U.BtnXL({ variant: "green", label: "🚀  Start Route Now", style: { flex: 2, fontSize: 16, padding: 15 }, actName: "signoff-start", arg: p.routeId }) +
      "</div>");
  });

  window.RD.action("signoff-start", function (routeId) {
    SDK.routeDelivery.startRoute({ routeId: routeId, confirmedByDriver: true });
    window.RD.go("/queue/" + routeId);
  });
})();

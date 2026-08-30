/* ==========================================================================
   DELIVERY MANAGEMENT — the delivery loop

   Where the day is actually spent: the queue of customers, and everything that
   can happen at one of them.

     Queue          pages/CustomerQueue.jsx
     At Customer    pages/AtCustomer.jsx
     Payment        pages/PaymentCollection.jsx
     Payment Done   pages/PaymentSuccess.jsx
     Skip Stop      pages/SkipStop.jsx
     New Customer   pages/AddNewCustomer.jsx
     Stop Summary   pages/StopSummary.jsx

   Two behaviours here matter more than the pixels and are preserved exactly:

   1. Money is never committed on one tap. Collect swaps the footer for a
      two-card confirm — escape on the left, commit on the right — so the
      irreversible choice is never under the finger that just tapped.
   2. A stop's quantity can never exceed what is still on the van. The stepper
      caps at the booking stock, because a driver promising goods they are not
      carrying is the failure this screen exists to prevent.
   ========================================================================== */

(function () {
  "use strict";

  const U = window.RD_UI, D = window.RD_DB, SDK = window.RD_SDK,
        M = window.RD_MODELS, V = window.RD_VALID;

  // Line totals and stock values keep natural precision; only the four
  // aggregate amounts go through the rounded display.
  function rawInr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

  const AV = {
    green:  { background: "#43A047", color: "white" },
    blue:   { background: "#dbeafe", color: "#1d4ed8" },
    orange: { background: "#fff7ed", color: "#c2410c" },
    grey:   { background: "#e5e7eb", color: "#6b7280" },
    brand:  { background: "#1B6272", color: "white" },
  };

  function Avatar(letters, scheme, size) {
    return '<div style="' + U.sty(U.mix({
      width: 46, height: 46, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, fontSize: size || 12,
    }, AV[scheme] || AV.green)) + '">' + U.esc(letters) + "</div>";
  }

  function Row(inner, o) {
    o = o || {};
    const base = {
      display: "flex", alignItems: "center", padding: "12px 16px",
      background: o.active ? "#e4f2f5" : "white",
      borderBottom: "1px solid #f0f0f0", gap: 12,
      opacity: o.opacity !== undefined ? o.opacity : (o.done ? 0.6 : 1),
    };
    if (o.actName) {
      return '<button type="button" class="rd-row"' + U.act(o.actName, o.arg) +
        (o.status ? ' data-status="' + o.status + '"' : "") +
        ' style="' + U.sty({ width: "100%", display: "block", padding: 0, border: "none", background: "none", textAlign: "left", fontFamily: "inherit", cursor: "pointer" }) + '">' +
        '<div class="rd-row" style="' + U.sty(base) + '">' + inner + "</div></button>";
    }
    return '<div class="rd-row" style="' + U.sty(base) + '">' + inner + "</div>";
  }

  function routeOr404(routeId) {
    const r = D.db.routeDetails[routeId];
    if (!r) throw new Error("Route " + routeId + " not found");
    return r;
  }

  function collectedFor(routeId) {
    return D.getStops(routeId).reduce(function (a, s) { return a + (s.collectedAmount || 0); }, 0);
  }

  /* ══ Customer Queue ════════════════════════════════════════════════════ */

  function StopRow(stop, depleted) {
    const initials = M.customerInitials(stop.customerName);
    const skipped = stop.status === "SKIPPED";
    const done = stop.status === "DELIVERED" || skipped;
    const returnOnly = !!stop.isReturnOnly;

    // ── Completed (delivered, returned or skipped) ──
    if (done) {
      // CustomerQueue renders the model's displaySubtitle here — "₹520 · Collected",
      // "₹0 · Over Payment", "₹120 · Partial payment" — not the payment method.
      const sub = skipped ? "Skipped" : returnOnly ? "Return received" : M.buildStopSubtitle(stop);
      return Row(
        // The avatar carries the outcome, not the customer's initials: a tick
        // for a delivery, ↩ for a return, − for a skip.
        Avatar(skipped ? "−" : returnOnly ? "↩" : "✓", skipped ? "grey" : returnOnly ? "orange" : "green", 12) +
        '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(stop.customerName) + "</div>" +
          '<div style="' + U.sty({ fontSize: 13, color: skipped ? "#ef4444" : returnOnly ? "#c2410c" : "#888", marginTop: 1 }) + '">' + U.esc(sub) + "</div>" +
        "</div>" +
        '<div style="' + U.sty({ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }) + '">' +
          '<span style="' + U.sty({ fontSize: 17, color: stop.outstandingAmount > 0 ? "#f97316" : "#43A047" }) + '">' + (skipped ? "" : stop.outstandingAmount > 0 ? "✓" : "✓✓") + "</span>" +
          (stop.completedAt ? '<span style="' + U.sty({ fontSize: 11, color: "#aaa" }) + '">' + U.esc(M.formatRouteTime(stop.completedAt, { hour12: false })) + "</span>" : "") +
        "</div>",
        { done: true, opacity: skipped ? 0.45 : 0.7, actName: "queue-view-done", arg: stop.id, status: skipped ? "skipped" : returnOnly ? "return-done" : "done" }
      );
    }

    // ── Depleted: the van is empty, so no stop can be opened ──
    if (depleted) {
      return Row(
        Avatar(initials, "grey") +
        '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 600, color: "#888" }) + '">' + U.esc(stop.customerName) + "</div>" +
          '<div style="' + U.sty({ fontSize: 13, color: "#d97706", marginTop: 1, fontWeight: 500 }) + '">Stock depleted</div>' +
        "</div>",
        { done: true, opacity: 0.4, status: "depleted" }
      );
    }

    // ── The current stop ──
    if (stop.status === "CURRENT") {
      if (returnOnly) {
        return Row(
          Avatar("↩", "orange", 12) +
          '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
            '<div style="' + U.sty({ fontSize: 15, fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(stop.customerName) + "</div>" +
            '<div style="' + U.sty({ fontSize: 13, marginTop: 1, color: "#c2410c", fontWeight: 600 }) + '">Return received</div>' +
          "</div>" +
          '<div style="' + U.sty({ width: 8, height: 8, background: "#d1d5db", borderRadius: "50%", flexShrink: 0 }) + '"></div>',
          { actName: "queue-view-done", arg: stop.id, status: "return-current" }
        );
      }
      return Row(
        Avatar(initials, "brand", 13) +
        '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 700, color: U.BRAND, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(stop.customerName) + "</div>" +
          '<div style="' + U.sty({ fontSize: 13, marginTop: 1, color: stop.outstandingAmount > 0 ? "#f97316" : "#888", fontWeight: stop.outstandingAmount > 0 ? 600 : 400 }) + '">' +
            (stop.outstandingAmount > 0 ? "⚠️ " + U.inr(stop.outstandingAmount) + " outstanding" : "Current stop") + "</div>" +
        "</div>" +
        '<div style="' + U.sty({ width: 24, height: 24, background: "#43A047", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "white", fontWeight: 700, flexShrink: 0 }) + '">→</div>',
        { active: true, actName: "queue-select", arg: stop.id, status: "current" }
      );
    }

    // ── Pending ──
    const sub = returnOnly
      ? "Return received"
      : stop.outstandingAmount > 0
        ? "⚠️ " + U.inr(stop.outstandingAmount) + " outstanding"
        : stop.advanceAmount > 0
          ? U.inr(stop.advanceAmount) + " Over Paid"
          : (M.buildStopSubtitle(stop) || "—");
    return Row(
      Avatar(returnOnly ? "↩" : initials, returnOnly ? "orange" : stop.outstandingAmount > 0 ? "orange" : stop.advanceAmount > 0 ? "green" : "blue") +
      '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
        '<div style="' + U.sty({ fontSize: 15, fontWeight: 600, color: "#111" }) + '">' + U.esc(stop.customerName) + "</div>" +
        '<div style="' + U.sty({ fontSize: 13, color: returnOnly ? "#c2410c" : "#888", marginTop: 1, fontWeight: returnOnly ? 600 : 400 }) + '">' + U.esc(sub) + "</div>" +
      "</div>" +
      '<div style="' + U.sty({ width: 8, height: 8, background: "#d1d5db", borderRadius: "50%", flexShrink: 0 }) + '"></div>',
      { actName: returnOnly ? "queue-view-done" : "queue-select", arg: stop.id, status: returnOnly ? "return-pending" : "pending" }
    );
  }

  // CustomerQueue.jsx QueueActionsMenu — the ⋮ button and its anchored card.
  // It is the screen's rightAction, so the card hangs off the button's own
  // wrapper (top 39, right 0), not off the header.
  const MENU_ITEM = {
    width: "100%", display: "flex", alignItems: "center", gap: 11,
    padding: "11px 16px", border: "none", background: "white", color: "#202124",
    fontFamily: "inherit", fontSize: 14, fontWeight: 600, textAlign: "left", cursor: "pointer",
  };
  const MENU_ICON = { width: 18, display: "inline-flex", justifyContent: "center", color: "#111", fontSize: 15, fontWeight: 700 };

  function QueueActionsMenu(open, routeId) {
    function item(icon, label, actName) {
      return '<button type="button" role="menuitem"' + U.act(actName, routeId) + ' style="' + U.sty(MENU_ITEM) + '">' +
        '<span aria-hidden="true" style="' + U.sty(MENU_ICON) + '">' + icon + "</span>" + U.esc(label) + "</button>";
    }
    return '<div style="' + U.sty({ position: "relative" }) + '">' +
      '<button type="button" aria-label="Route actions" aria-haspopup="menu" aria-expanded="' + (open ? "true" : "false") + '"' + U.act("queue-menu") + ' style="' + U.sty({
        width: 32, height: 32, display: "inline-flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 3,
        border: "1px solid rgba(255,255,255,0.30)", borderRadius: 9,
        background: open ? "rgba(255,255,255,0.12)" : "transparent",
        color: "white", cursor: "pointer", opacity: 1,
      }) + '">' +
        [0, 1, 2].map(function () {
          return '<span aria-hidden="true" style="' + U.sty({ width: 13, height: 1.5, borderRadius: 2, background: "currentColor" }) + '"></span>';
        }).join("") +
      "</button>" +
      (open
        ? '<div role="menu" aria-label="Route actions" style="' + U.sty({
            position: "absolute", zIndex: 100, top: 39, right: 0, width: 220,
            padding: "7px 0", background: "white", borderRadius: 14,
            boxShadow: "0 10px 28px rgba(15,23,42,0.18)", border: "1px solid #eef0f2", overflow: "hidden",
          }) + '">' + item("↻", "Restock", "queue-restock") + item("₹", "Return & Settle", "queue-settle") + "</div>"
        : "") +
      "</div>";
  }

  window.RD.screen("queue", function (p) {
    const route = routeOr404(p.routeId);
    const S = window.RD.state.scratch;
    const all = D.getStops(p.routeId);
    const search = (S.queueSearch || "").trim().toLowerCase();
    const shown = search
      ? all.filter(function (s) { return s.customerName.toLowerCase().indexOf(search) !== -1; })
      : all;

    const done = all.filter(function (s) { return s.status === "DELIVERED" || s.status === "SKIPPED"; }).length;
    // isDeliveryDepleted upstream: nothing left on the van to deliver, so every
    // remaining stop is inert and Add Customer is withdrawn.
    const settling = !!S.queueSettleConfirm;
    const restocking = !!S.queueRestockConfirm;
    // Two different counts upstream: how many stops would be marked skipped by
    // settling now (none once the van is empty — they were never deliverable),
    // and how many stops are simply not done yet.
    const pendingStopsCount = all.filter(function (st) { return st.status === "PENDING" || st.status === "CURRENT"; }).length;
    // isDeliveryDepleted upstream: nothing left on the van to deliver, so every
    // remaining stop is inert, Add Customer is withdrawn and the footer says so.
    const vanStock = (SDK.routeDelivery.getBookingStock({ routeId: p.routeId }).data || []);
    const depleted = vanStock.length > 0 && vanStock.every(function (r) { return (r.availableQty || 0) <= 0; });
    const pendingSkipCount = depleted ? 0 : pendingStopsCount;

    // One flat list in route order, exactly as QA renders it. (An earlier pass
    // grouped this into Next stop / Upcoming / Completed; QA does not, and QA
    // is the reference.) Add Customer sits at the end of the list, not in the
    // footer, and is hidden while searching.
    const addRow = !search && !depleted
      ? '<button type="button" class="rd-row"' + U.act("queue-add-customer", p.routeId) + ' style="' + U.sty({
          width: "100%", display: "flex", alignItems: "center", padding: "12px 16px", gap: 12,
          background: "white", borderBottom: "1px solid #f0f0f0", border: "none",
          textAlign: "left", fontFamily: "inherit", cursor: "pointer",
        }) + '">' +
        '<div style="' + U.sty({ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0fdf4", border: "2px dashed #86efac" }) + '">' +
          '<span style="' + U.sty({ fontSize: 20, color: "#16a34a", lineHeight: 1 }) + '">+</span></div>' +
        '<div style="' + U.sty({ flex: 1 }) + '">' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 600, color: "#16a34a" }) + '">Add Customer</div>' +
          '<div style="' + U.sty({ fontSize: 13, color: "#aaa", marginTop: 1 }) + '">Add a new stop to this route</div>' +
        "</div></button>"
      : "";

    const list = (shown.length === 0 && search)
      ? '<div style="' + U.sty({ padding: "40px 24px", textAlign: "center" }) + '">' +
          '<div style="' + U.sty({ fontSize: 32, marginBottom: 10 }) + '">🔍</div>' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 600, color: "#111", marginBottom: 4 }) + '">No stops found</div>' +
          '<div style="' + U.sty({ fontSize: 13, color: "#888" }) + '">No customer matches “' + U.esc(search) + '”</div></div>'
      : shown.map(function (st) { return StopRow(st, depleted); }).join("") + addRow;

    // QA puts Restock and Return & Settle in an anchored header menu and gives
    // this screen no footer at all; the list simply ends with Add Customer.
    return U.ProgressBar({
        current: done, total: all.length,
        collected: U.inr(collectedFor(p.routeId)),
        backLabel: "Routes", backAct: "home",
        rightAction: QueueActionsMenu(!!S.queueMenu, p.routeId),
      }) +
      // CustomerQueue leaves BODY's background to the screen behind it.
      '<div class="rd-body">' +
        U.SearchInput({ value: S.queueSearch || "", model: "queue-search", placeholder: "Search by name or phone…", clearAct: "queue-search-clear", style: { margin: "8px 12px 4px" } }) +
        list +
        '<div style="height:16px"></div>' +
      "</div>" +
      // Neither menu action leaves the queue on its own: QA raises a decision
      // panel over the list first, and only its commit card navigates.
      (settling || restocking ? U.FreezeBackdrop(0.45) : "") +
      ((depleted && pendingStopsCount > 0) || settling || restocking
        ? '<div style="' + U.sty({ position: "relative", zIndex: (settling || restocking) ? 50 : "auto" }) + '">' +
          // Nothing left on the van: the footer says so rather than leaving the
          // driver to work it out from every row reading "Stock depleted".
          (depleted && pendingStopsCount > 0
            ? '<div style="' + U.sty({ background: "#fffbeb", borderTop: "1.5px solid #fde68a", padding: "8px 12px", display: "flex", alignItems: "center", gap: 7 }) + '">' +
                '<span style="' + U.sty({ fontSize: 18, flexShrink: 0 }) + '">📦</span>' +
                "<div>" +
                  '<div style="' + U.sty({ fontSize: 13, fontWeight: 600, color: "#92400e" }) + '">All stock delivered · ' + pendingStopsCount + " stop" + (pendingStopsCount !== 1 ? "s" : "") + " remaining</div>" +
                  '<div style="' + U.sty({ fontSize: 11, color: "#b45309" }) + '">Restock at warehouse to continue delivering</div>' +
                "</div></div>"
            : "") +
          (settling || restocking ? U.ActionBar(
            settling
              ? U.ConfirmPanel({
                  action: "Return & Settle",
                  amount: pendingSkipCount > 0 ? pendingSkipCount + " stop" + (pendingSkipCount !== 1 ? "s" : "") + " remaining" : "All stops complete",
                  context: pendingSkipCount > 0 ? "Remaining stops will be marked skipped" : "Route ready for settlement",
                  backLabel: "Continue Delivering", commitLabel: "Begin Settlement",
                  backAct: "queue-settle-cancel", commitAct: "queue-settle-commit", arg: p.routeId,
                  processing: !!S.committing, processingLabel: "Beginning settlement…",
                })
              : U.ConfirmPanel({
                  action: "Restock", amount: "Pause for restock",
                  context: "Drive to the warehouse and load additional stock",
                  backLabel: "Continue Delivering", commitLabel: "Begin Restock",
                  backAct: "queue-restock-cancel", commitAct: "queue-restock-commit", arg: p.routeId,
                  processing: !!S.committing, processingLabel: "Pausing route…",
                })
          ) : "") + "</div>"
        : "");
  });

  window.RD.action("queue-menu", function () {
    const S = window.RD.state.scratch;
    S.queueMenu = !S.queueMenu;
    window.RD.render();
  });
  window.RD.action("queue-search-clear", function () { window.RD.state.scratch.queueSearch = ""; window.RD.render(); });
  window.RD.action("model:queue-search", function (v) {
    window.RD.state.scratch.queueSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="queue-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("queue-select", function (stopId) { window.RD.go("/delivery/" + window.RD.state.routeId + "/" + stopId); });
  window.RD.action("queue-view-done", function (stopId) { window.RD.go("/stop-summary/" + window.RD.state.routeId + "/" + stopId); });
  window.RD.action("queue-add-customer", function (routeId) { window.RD.go("/new-customer/" + routeId); });
  window.RD.action("queue-restock", function () {
    const S = window.RD.state.scratch;
    S.queueMenu = false; S.queueRestockConfirm = true; S.queueSettleConfirm = false;
    window.RD.render();
  });
  window.RD.action("queue-settle", function () {
    const S = window.RD.state.scratch;
    S.queueMenu = false; S.queueSettleConfirm = true; S.queueRestockConfirm = false;
    window.RD.render();
  });
  window.RD.action("queue-settle-cancel", function () { window.RD.state.scratch.queueSettleConfirm = false; window.RD.render(); });
  window.RD.action("queue-restock-cancel", function () { window.RD.state.scratch.queueRestockConfirm = false; window.RD.render(); });
  window.RD.action("queue-settle-commit", function (routeId) {
    window.RD.commit(function () { window.RD.go("/settlement/" + routeId); });
  });
  window.RD.action("queue-restock-commit", function (routeId) {
    window.RD.commit(function () {
      if (SDK.routeDelivery.pauseForRestock) SDK.routeDelivery.pauseForRestock({ routeId: routeId });
      window.RD.go("/restock/" + routeId);
    });
  });

  /* ══ At Customer ═══════════════════════════════════════════════════════ */

  function stopOr404(routeId, stopId) {
    const detail = D.resolveStopDetail(routeId, stopId);
    if (!detail) throw new Error("Stop " + stopId + " not found");
    return detail;
  }

  // What is still on the van, per product — the ceiling for every stepper here.
  function bookingStockMap(routeId) {
    const list = SDK.routeDelivery.getBookingStock({ routeId: routeId }).data || [];
    const map = {};
    list.forEach(function (r) { map[r.productId] = r.availableQty; });
    return map;
  }

  /* ── At Customer, Book Order mode (AtCustomer.jsx bookingMode) ─────────
     A stop with nothing booked is not a delivery — there is no order to hand
     over yet — so QA swaps the whole screen for a catalogue the driver books
     from: an indigo BOOK ORDER hero, the van's stock as rows with an editable
     price, and a CTA that carries the running order total. */
  function bookingScreen(p, stop) {
    const S = window.RD.state.scratch;
    if (!S.bookItems) S.bookItems = {};
    if (!S.bookPrices) S.bookPrices = {};
    const stockMap = bookingStockMap(p.routeId);
    const advance = stop.advanceAmount || 0;
    const load = D.db.stockLoads[p.routeId];
    // Nothing is filtered out for being sold out: QA keeps a zero-stock product
    // in the catalogue and lets its row carry the "Max 0 — no more in vehicle"
    // warning, which is the only reason that warning branch exists at all.
    const products = ((load && load.products) || []);
    const search = (S.bookSearch || "").trim().toLowerCase();
    const shown = products.filter(function (pr) { return !search || pr.name.toLowerCase().indexOf(search) !== -1; });

    const selected = products.filter(function (pr) { return (S.bookItems[pr.productId] || 0) > 0; });
    const catalogTotal = selected.reduce(function (a, pr) { return a + pr.unitPrice * S.bookItems[pr.productId]; }, 0);
    const baseTotal = selected.reduce(function (a, pr) {
      const price = S.bookPrices[pr.productId] !== undefined ? S.bookPrices[pr.productId] : pr.unitPrice;
      return a + price * S.bookItems[pr.productId];
    }, 0);
    const discountType = S.bookDiscountType || "percent";
    const discountInput = S.bookDiscountInput || "";
    const raw = parseFloat(discountInput) || 0;
    const discountAmount = raw <= 0 ? 0
      : discountType === "cash" ? Math.min(baseTotal, raw)
      : Math.round(baseTotal * Math.min(100, raw)) / 100;
    const discountPct = baseTotal > 0 && discountAmount > 0 ? (discountAmount / baseTotal) * 100 : 0;
    const orderTotal = Math.max(0, Math.round((baseTotal - discountAmount) * 100) / 100);
    const itemsWithOfferPrices = selected.filter(function (pr) { return S.bookPrices[pr.productId] !== undefined; }).length;
    const itemOfferSavings = Math.max(0, Math.round((catalogTotal - baseTotal) * 100) / 100);
    const totalSavings = Math.max(0, Math.round((catalogTotal - orderTotal) * 100) / 100);

    const rows = shown.map(function (pr, i) {
      const qty = S.bookItems[pr.productId] || 0;
      const avail = stockMap[pr.productId] || 0;
      const custom = S.bookPrices[pr.productId];
      const atMax = qty >= avail;
      return '<div style="' + U.sty({
        display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
        borderBottom: i < shown.length - 1 ? "1px solid #f0f0f0" : "none",
      }) + '">' +
        '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 14, fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(pr.name) + "</div>" +
          // "₹price ✎ / unit · N loaded", and once the van is emptied of a line
          // the tail turns into QA's amber max warning.
          '<div style="' + U.sty({ fontSize: 12, marginTop: 2, color: atMax ? "#f97316" : "#888", fontWeight: atMax ? 600 : 400 }) + '">' +
            U.EditablePrice({ productId: pr.productId, catalogPrice: pr.unitPrice, customPrice: custom === undefined ? null : custom, openAct: "book-offer-open", resetAct: "book-offer-reset" }) +
            " / " + U.esc(pr.orderingUnit || "unit") +
            '<span style="' + U.sty({ marginLeft: 6 }) + '">' +
              (atMax ? "⚠️ Max " + avail + " — no more in vehicle" : "· " + avail + " loaded") + "</span>" +
          "</div>" +
        "</div>" +
        U.StepperInput({ value: qty, small: true, max: avail, arg: pr.productId, decAct: "book-dec", incAct: "book-inc", model: "book-" + pr.productId }) +
        "</div>";
    }).join("");

    const offerPid = S.bookOfferSheet;
    const offerProduct = offerPid ? products.filter(function (pr) { return pr.productId === offerPid; })[0] : null;

    return U.ProgressBar({ collected: U.inr(collectedFor(p.routeId)), backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        '<div style="' + U.sty({ margin: 12, background: "white", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }) + '">' +
          '<div style="' + U.sty({ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }) + '">Book Order</div>' +
          '<div style="' + U.sty({ fontSize: 24, fontWeight: 800, color: "#111", lineHeight: 1.2 }) + '">' + U.esc(stop.customerName) + "</div>" +
          // A carried advance is stated under the name: how much of the order it
          // covers, or simply that it is there when nothing is on the order yet.
          (advance > 0 && baseTotal > 0
            ? '<div style="' + U.sty({ fontSize: 12, color: "#16a34a", marginTop: 3 }) + '">' +
                U.inr(Math.min(advance, baseTotal)) + " of " + U.inr(baseTotal) + " order paid using advance" +
                (advance - Math.min(advance, baseTotal) > 0 ? " · " + U.inr(advance - Math.min(advance, baseTotal)) + " advance balance remaining" : "") + "</div>"
            : advance > 0
              ? '<div style="' + U.sty({ fontSize: 12, color: "#16a34a", marginTop: 3 }) + '">' + U.inr(advance) + " advance balance available</div>"
              : "") +
        "</div>" +
        U.SearchInput({ value: S.bookSearch || "", model: "book-search", placeholder: "Search products…", clearAct: "book-search-clear", style: { margin: "0 12px 8px" } }) +
        '<div style="' + U.sty({ background: "white", borderRadius: 14, padding: "8px 0", margin: "0 12px 10px" }) + '">' +
          (rows || '<div style="padding:24px;text-align:center;color:#888;font-size:14px">No stock available to order</div>') + "</div>" +
      "</div>" +
      (S.bookConfirming ? U.FreezeBackdrop(0.45) : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: S.bookConfirming ? 50 : "auto" }) + '">' + U.ActionBar(
        S.bookConfirming
          ? U.ConfirmPanel({
              action: "Confirming Order", amount: U.inr(orderTotal),
              context: "for " + (stop.customerName || "Customer") + " · " + selected.length + " item" + (selected.length !== 1 ? "s" : "") +
                (discountPct > 0 ? (discountType === "cash" ? " · ₹" + discountInput + " off" : " · " + discountInput + "% off") : ""),
              backLabel: "Edit Order", commitLabel: "Place Order",
              backAct: "book-confirm-cancel", commitAct: "book-commit", arg: stop.id,
              processing: !!S.committing, processingLabel: "Placing order…",
              extra: '<div style="' + U.sty({ background: "#f8fafc", borderRadius: 10, border: "1px solid #e9eef2", overflow: "hidden", maxHeight: 140, overflowY: "auto" }) + '">' +
                selected.map(function (pr, i) {
                  const hasOffer = S.bookPrices[pr.productId] !== undefined;
                  const price = hasOffer ? S.bookPrices[pr.productId] : pr.unitPrice;
                  return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: i < selected.length - 1 ? "1px solid #f1f5f9" : "none" }) + '">' +
                    '<span style="' + U.sty({ fontSize: 13, color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }) + '">' + U.esc(pr.name) +
                      (hasOffer ? '<span style="' + U.sty({ display: "inline-block", fontSize: 10, color: "#6366f1", fontWeight: 700, background: "#ede9fe", borderRadius: 3, padding: "1px 4px", marginLeft: 5 }) + '">Offer</span>' : "") + "</span>" +
                    '<span style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#374151", flexShrink: 0 }) + '">× ' + S.bookItems[pr.productId] + "&nbsp; ₹" + Number(price).toLocaleString("en-IN") + "</span></div>";
                }).join("") + "</div>",
            })
          : U.DiscountStrip({
              discountPct: discountPct, discountType: discountType, discountInput: discountInput,
              savings: discountAmount, totalSavings: totalSavings,
              itemsWithOfferPrices: itemsWithOfferPrices, itemOfferSavings: itemOfferSavings,
              disabled: selected.length === 0, openAct: "book-discount-open", clearAct: "book-discount-clear",
            }) +
            U.BtnXL({
              variant: "green",
              label: selected.length === 0 ? "Select items to place order" : "Confirm Order · " + U.inr(orderTotal),
              disabled: selected.length === 0,
              style: { opacity: selected.length === 0 ? 0.5 : 1, background: selected.length === 0 ? "#f3f4f6" : undefined, color: selected.length === 0 ? "#6b7280" : undefined },
              actName: "book-confirm", arg: stop.id,
            }) +
            U.BtnXL({
              variant: "outline", label: "More Actions",
              style: { fontSize: 15, padding: "13px 18px", marginTop: 8 },
              actName: "stop-actions-open",
            })
      ) + "</div>" +
      U.DiscountSheet({
        open: !!S.bookDiscountSheet, closeAct: "book-discount-close",
        discountType: discountType, discountInput: discountInput,
        subtotal: baseTotal, discountAmount: discountAmount, discountPct: discountPct,
        typeAct: "book-discount-type", chipAct: "book-discount-chip", clearAct: "book-discount-clear",
        model: "book-discount",
      }) +
      U.OfferPriceSheet({
        open: !!offerProduct, closeAct: "book-offer-close",
        productId: offerPid, productName: offerProduct ? offerProduct.name : "",
        catalogPrice: offerProduct ? offerProduct.unitPrice : 0, taxRate: offerProduct ? (offerProduct.tax || 0) : 0,
        qty: offerPid ? (S.bookItems[offerPid] || 0) : 0,
        maxQty: offerPid ? (stockMap[offerPid] || 0) : null,
        input: S.bookOfferInput || "",
        hasCustomPrice: offerPid ? S.bookPrices[offerPid] !== undefined : false,
        decAct: "book-dec", incAct: "book-inc", chipAct: "book-offer-chip",
        resetAct: "book-offer-reset", confirmAct: "book-offer-confirm", model: "book-offer",
      }) +
      U.ActionsSheet({
        open: !!S.stopActions, closeAct: "stop-actions-close",
        groups: [
          { label: "Financial", actions: [{ icon: "💰",
            label: (stop.outstandingAmount || 0) > 0 ? "Collect Outstanding · " + U.inr(stop.outstandingAmount) : "Collect Payment",
            act: "goto-outstanding", arg: stop.id }] },
          { label: "Returns",   actions: [{ icon: "📦", label: "Product Return", act: "goto-returns", arg: p.routeId }] },
          { label: "Assets",    actions: [{ icon: "🗂️", label: "Manage Assets", act: "goto-assets", arg: stop.customerId }] },
        ],
      });
  }

  window.RD.action("stop-actions-open", function () { window.RD.state.scratch.stopActions = true; window.RD.render(); });
  window.RD.action("stop-actions-close", function () { window.RD.state.scratch.stopActions = false; window.RD.render(); });

  window.RD.screen("atCustomer", function (p) {
    const route = routeOr404(p.routeId);
    const stop = D.getStops(p.routeId).find(function (s) { return s.id === p.stopId; });
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const detail = stopOr404(p.routeId, p.stopId);
    // Nothing booked: QA books an order instead of delivering one.
    if (!(detail.orderItems || []).length && stop.status !== "DELIVERED" && stop.status !== "SKIPPED") return bookingScreen(p, stop);
    const S = window.RD.state.scratch;
    const editing = !!S.editing;
    const canCollect = stop.status !== "DELIVERED" && stop.status !== "SKIPPED";

    if (!S.items) {
      // orderItems / orderTotal / outstandingAmount are the stop model's real
      // field names (see makeStopDetail). Reading `items`/`previousOutstanding`
      // silently yields an empty order and a ₹0 total due on every stop.
      S.items = (detail.orderItems || []).map(function (it) {
        return { productId: it.productId, productName: it.productName || it.name, qty: it.qty, unitPrice: it.unitPrice };
      });
    }
    const stockMap = bookingStockMap(p.routeId);
    // The order total is the sum of the lines the customer can see, because that
    // is what their receipt prints and what they are being asked to pay. The
    // stop's seeded todayOrderAmount can round a few rupees away from it; the
    // payment screen uses this same sum so the two screens never disagree.
    const orderTotal = S.items.reduce(function (a, it) { return a + it.qty * (it.unitPrice || 0); }, 0);
    const outstanding = stop.outstandingAmount || 0;
    // An advance (over-payment carried from a previous visit) pays down today's
    // order before anything is due, which is why Total Due can be ₹0 while an
    // order exists — the state QA shows on customers with credit.
    const advance = stop.advanceAmount || 0;
    const appliedAdvance = Math.min(advance, orderTotal);
    const remainingAdvance = Math.max(0, advance - appliedAdvance);
    const totalDue = Math.max(0, outstanding + orderTotal - appliedAdvance);

    const card =
      '<div style="' + U.sty({ margin: 12, background: "white", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)", marginTop: 12 }) + '">' +
        '<div style="' + U.sty({ fontSize: 11, fontWeight: 700, color: "#43A047", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }) + '">● Current Stop</div>' +
        '<div style="' + U.sty({ fontSize: 24, fontWeight: 800, color: "#111", lineHeight: 1.2 }) + '">' + U.esc(stop.customerName) + "</div>" +
        (detail.customer && detail.customer.address
          ? '<div style="' + U.sty({ fontSize: 13, color: "#888", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }) + '">📍 ' + U.esc(detail.customer.address) + "</div>" : "") +
        '<div style="' + U.sty({ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0" }) + '">' +
          '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }) + '">' +
            "<div>" +
              '<div style="' + U.sty({ fontSize: 12, color: "#888", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.3px" }) + '">Total Due</div>' +
              '<div style="' + U.sty({ fontSize: 36, fontWeight: 800, color: "#ef4444", lineHeight: 1 }) + '">' + U.inr(totalDue) + "</div>" +
              // QA's four notes under Total Due, in its order: outstanding+order,
              // outstanding alone, advance applied to today's order, and an
              // advance balance with nothing ordered.
              (outstanding > 0 && orderTotal > 0
                ? '<div style="' + U.sty({ fontSize: 12, color: "#f97316", marginTop: 3 }) + '">' + U.inr(outstanding) + " outstanding + " + U.inr(orderTotal) + " today's order</div>"
                : outstanding > 0
                  ? '<div style="' + U.sty({ fontSize: 12, color: "#f97316", marginTop: 3 }) + '">' + U.inr(outstanding) + " outstanding</div>"
                  : (advance > 0 && orderTotal > 0
                    ? '<div style="' + U.sty({ fontSize: 12, color: "#16a34a", marginTop: 3 }) + '">' + U.inr(appliedAdvance) + " of " + U.inr(orderTotal) + " today's order paid using advance" +
                        (remainingAdvance > 0 ? " · " + U.inr(remainingAdvance) + " advance balance remaining" : "") + "</div>"
                    : advance > 0
                      ? '<div style="' + U.sty({ fontSize: 12, color: "#16a34a", marginTop: 3 }) + '">' + U.inr(advance) + " advance balance available</div>"
                      : "")) +
            "</div>" +
            (detail.customer && detail.customer.phone
              ? '<a href="tel:' + U.esc(detail.customer.phone) + '" class="rd-pressable" style="' + U.sty({ padding: "10px 14px", background: "#f0f2f5", borderRadius: 12, fontSize: 22, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }) + '">📞</a>' : "") +
          "</div></div></div>";

    // Edit mode shows every product still on the van, ordered items first.
    let orderBody;
    if (editing) {
      const search = (S.editSearch || "").trim().toLowerCase();
      const ordered = S.items.slice();
      const orderedIds = {};
      ordered.forEach(function (i) { orderedIds[i.productId] = true; });
      const load = D.db.stockLoads[p.routeId];
      const rest = ((load && load.products) || []).filter(function (pr) { return !orderedIds[pr.productId]; })
        .map(function (pr) { return { productId: pr.productId, productName: pr.name, qty: 0, unitPrice: pr.unitPrice }; });
      const merged = ordered.concat(rest).filter(function (it) {
        return !search || String(it.productName).toLowerCase().indexOf(search) !== -1;
      });
      orderBody = merged.length === 0
        ? '<div style="' + U.sty({ padding: "24px 16px", textAlign: "center", color: "#888", fontSize: 14 }) + '">' + (search ? "No products match your search" : "No products available") + "</div>"
        : merged.map(function (it) {
            const avail = stockMap[it.productId] === undefined ? 0 : stockMap[it.productId];
            const atMax = avail > 0 && it.qty >= avail;
            const out = avail === 0 && it.qty === 0;
            const isOrdered = it.qty > 0;
            // QA tints an ordered row mint and bolds its name, and its subtitle
            // is "₹price / unit · N loaded" at 12/18 — with the whole line
            // turning amber at max and red when the van is out.
            return '<div style="' + U.sty({
                display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                borderTop: "1px solid #f5f5f5", opacity: out ? 0.42 : 1,
                background: isOrdered ? "#f8fffe" : "white",
              }) + '">' +
              '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
                '<div style="' + U.sty({ fontSize: 14, fontWeight: isOrdered ? 700 : 600, color: isOrdered ? "#111" : "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(it.productName) + "</div>" +
                '<div style="' + U.sty({ fontSize: 12, marginTop: 2, color: out ? "#ef4444" : atMax ? "#f97316" : "#888", fontWeight: atMax ? 600 : 400 }) + '">' +
                  "<span>₹" + (it.unitPrice || 0) + "</span> / " + U.esc(it.orderingUnit || "unit") +
                  (avail > 0 && !atMax ? '<span style="margin-left:6px">· ' + avail + " loaded</span>" : "") +
                  (atMax ? '<span style="margin-left:6px">⚠️ Max ' + avail + "</span>" : "") +
                  (out ? '<span style="margin-left:6px;color:#ef4444">· Out of stock</span>' : "") + "</div>" +
              "</div>" +
              U.StepperInput({ value: it.qty, small: true, max: avail, arg: it.productId, decAct: "item-dec", incAct: "item-inc", model: "item-" + it.productId }) +
              "</div>";
          }).join("");
    } else {
      orderBody = '<div style="padding:0 16px">' +
        S.items.map(function (it, i) {
          return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14, marginBottom: i < S.items.length - 1 ? 8 : 0 }) + '">' +
            '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
              '<div style="' + U.sty({ color: "#555", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(it.productName) + " × " + it.qty + "</div></div>" +
            '<span style="' + U.sty({ fontWeight: 700 }) + '">' + rawInr(it.qty * (it.unitPrice || 0)) + "</span></div>";
        }).join("") + "</div>";
    }

    // Nothing ordered and nothing owed is a real state at a stop the driver is
    // just visiting. Saying so beats an empty screen with a "Collect ₹0" button.
    const emptyOrder = !S.items.length && !editing
      ? U.Card(
          '<div style="' + U.sty({ textAlign: "center", padding: "8px 4px" }) + '">' +
            '<div style="' + U.sty({ fontSize: 30, marginBottom: 8 }) + '">🧾</div>' +
            '<div style="' + U.sty({ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 4 }) + '">No order today</div>' +
            '<div style="' + U.sty({ fontSize: 13, color: "#888" }) + '">' +
              (outstanding > 0 ? "Collect the outstanding, or add an order with Edit." : "Add an order with Edit, or skip this stop.") +
            "</div></div>"
        )
      : "";

    const orderCard = S.items.length || editing
      ? '<div style="' + U.sty({ margin: "0 12px 10px", background: "white", borderRadius: 14, overflow: "hidden" }) + '">' +
          '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 16px 10px" }) + '">' +
            '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#888" }) + '">Today\'s Order</div>' +
            (editing ? '<div style="' + U.sty({ fontSize: 12, color: "#43A047", fontWeight: 700 }) + '">Editing</div>' : "") +
          "</div>" + orderBody +
          '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 16px 13px", borderTop: "1px dashed #e5e7eb", marginTop: 8 }) + '">' +
            '<span style="font-weight:700">Order Total</span>' +
            '<span style="' + U.sty({ fontWeight: 800, color: "#111" }) + '">' + U.inr(orderTotal) + "</span></div></div>"
      : "";

    // "Done Editing" does not save: QA confirms the edited order first, listing
    // every surviving line, and only then writes it (AtCustomer confirmEditing).
    const editConfirming = !!S.editConfirming;
    const updatedItems = (S.items || []).filter(function (i) { return i.qty > 0; });
    const updatedTotal = updatedItems.reduce(function (a, i) { return a + i.qty * (i.unitPrice || 0); }, 0);
    const editDue = Math.max(0, outstanding + updatedTotal - Math.min(advance, updatedTotal));

    const footer = editConfirming
      ? U.ConfirmPanel({
          action: "Save Order Changes",
          amount: U.inr(updatedTotal),
          context: updatedItems.length + " item" + (updatedItems.length !== 1 ? "s" : "") + " · Total Due " + U.inr(editDue),
          backLabel: "Keep Editing", commitLabel: "Save Changes",
          backAct: "edit-confirm-cancel", commitAct: "edit-commit",
          processing: !!S.committing,
          extra: '<div style="' + U.sty({ background: "#f8fafc", borderRadius: 10, border: "1px solid #e9eef2", overflow: "hidden", maxHeight: 140, overflowY: "auto" }) + '">' +
            updatedItems.map(function (it, i) {
              return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: i < updatedItems.length - 1 ? "1px solid #f1f5f9" : "none" }) + '">' +
                '<span style="' + U.sty({ fontSize: 13, color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }) + '">' + U.esc(it.productName) + "</span>" +
                '<span style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#374151", flexShrink: 0 }) + '">× ' + it.qty + "&nbsp; " + rawInr(it.qty * (it.unitPrice || 0)) + "</span></div>";
            }).join("") + "</div>",
        })
      : !canCollect
      ? '<div style="' + U.sty({ padding: "14px 16px", background: "#f0fdf4", borderRadius: 16, textAlign: "center", fontWeight: 700, color: "#16a34a", fontSize: 15, marginBottom: 10 }) + '">✓ Payment already collected</div>' +
        '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
          U.BtnSm({ variant: "grey", label: "↩ Return", actName: "goto-returns", arg: p.routeId }) +
          U.BtnSm({ variant: "grey", label: "📦 Assets", actName: "goto-assets", arg: stop.customerId }) + "</div>"
      : (editing ? "" : U.BtnXL({ variant: "green", label: "💰 Collect " + U.inr(totalDue), style: { marginBottom: 10 }, actName: "goto-payment", arg: p.stopId })) +
        '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
          U.BtnSm({ variant: editing ? "brand" : "green", label: editing ? "✓ Done Editing" : "✏️ Edit Order", actName: "toggle-edit" }) +
          (editing ? "" : U.BtnSm({ variant: "red", label: "Skip Stop →", actName: "goto-skip", arg: p.stopId })) +
        "</div>";

    return U.ProgressBar({ collected: U.inr(collectedFor(p.routeId)), backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        card +
        (editing ? U.SearchInput({ value: S.editSearch || "", model: "edit-search", placeholder: "Search products…", clearAct: "edit-search-clear", style: { margin: "0 12px 8px" } }) : "") +
        orderCard + emptyOrder +
      "</div>" +
      (editConfirming ? U.FreezeBackdrop(0.45) : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: editConfirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  window.RD.action("toggle-edit", function () {
    const S = window.RD.state.scratch;
    if (S.editing) { S.editConfirming = true; } else { S.editing = true; }
    window.RD.render();
  });
  window.RD.action("edit-confirm-cancel", function () {
    window.RD.state.scratch.editConfirming = false; window.RD.render();
  });
  window.RD.action("edit-commit", function () {
    const S = window.RD.state.scratch;
    window.RD.commit(function () {
      // Persist through the service so the change survives navigation, exactly
      // as saveOrderEdits does upstream.
      SDK.routeDelivery.updateStopItems({
        routeId: window.RD.state.routeId, stopId: window.RD.state.stopId,
        items: (S.items || []).filter(function (i) { return i.qty > 0; }),
      });
      S.items = null; S.editing = false; S.editConfirming = false;
      // Nothing navigates here, so this commit paints its own result.
      window.RD.render();
    });
  });
  window.RD.action("item-inc", function (pid) {
    const S = window.RD.state.scratch;
    const stockMap = bookingStockMap(window.RD.state.routeId);
    let it = S.items.find(function (i) { return i.productId === pid; });
    if (!it) {
      const load = D.db.stockLoads[window.RD.state.routeId];
      const pr = ((load && load.products) || []).find(function (x) { return x.productId === pid; });
      if (!pr) return;
      it = { productId: pid, productName: pr.name, qty: 0, unitPrice: pr.unitPrice };
      S.items.push(it);
    }
    const max = stockMap[pid] === undefined ? 0 : stockMap[pid];
    if (max > 0 && it.qty >= max) return;   // never promise stock not on the van
    it.qty += 1;
    window.RD.render();
  });
  window.RD.action("item-dec", function (pid) {
    const S = window.RD.state.scratch;
    const it = S.items.find(function (i) { return i.productId === pid; });
    if (!it) return;
    it.qty = Math.max(0, it.qty - 1);
    window.RD.render();
  });
  window.RD.action("model:item#", function (value, pid) {
    const S = window.RD.state.scratch;
    const max = bookingStockMap(window.RD.state.routeId)[pid] || 0;
    let qty = Number(String(value).replace(/\D/g, "")) || 0;
    if (max > 0 && qty > max) qty = max;   // same van-stock ceiling as the stepper
    const it = S.items.find(function (i) { return i.productId === pid; });
    if (it) it.qty = qty;
    window.RD.render();
  });

  window.RD.action("edit-search-clear", function () { window.RD.state.scratch.editSearch = ""; window.RD.render(); });
  window.RD.action("model:edit-search", function (v) {
    window.RD.state.scratch.editSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="edit-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("goto-payment", function (stopId) {
    window.RD.state.payOutstanding = false;
    window.RD.go("/payment/" + window.RD.state.routeId + "/" + stopId);
  });
  // QA's "Collect Outstanding" (More Actions on a booking stop, and on a
  // finished Stop Summary) is a standalone collection: it settles the
  // customer's carried balance, never today's order, and never delivers a stop.
  window.RD.action("goto-outstanding", function (stopId) {
    window.RD.state.payOutstanding = true;
    window.RD.go("/payment/" + window.RD.state.routeId + "/" + stopId);
  });
  window.RD.action("goto-skip", function (stopId) { window.RD.go("/skip-stop/" + window.RD.state.routeId + "/" + stopId); });
  window.RD.action("goto-returns", function (routeId) {
    // Remember which stop raised the return: QA scopes the return to that
    // customer, and a customer with nothing booked becomes a return-only stop.
    window.RD.state.returnStopId = window.RD.state.stopId || null;
    window.RD.go("/return-acceptance/" + routeId);
  });
  window.RD.action("goto-assets", function (orgId) {
    window.RD.state.scratch.assetOrgId = orgId;
    window.RD.go("/manage-assets/" + window.RD.state.routeId + "/" + window.RD.state.stopId);
  });

  /* ══ Payment Collection ════════════════════════════════════════════════ */

  window.RD.screen("payment", function (p) {
    const stop = D.getStops(p.routeId).find(function (s) { return s.id === p.stopId; });
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const detail = stopOr404(p.routeId, p.stopId);
    const S = window.RD.state.scratch;
    // Same figure the driver was just shown at the stop: outstanding plus the
    // itemised order, not the seeded aggregate. Using todayOrderAmount here made
    // "Collect ₹1,255" lead to a screen asking for ₹1,200.
    const orderSum = (detail.orderItems || []).reduce(function (a, it) { return a + (it.lineTotal != null ? it.lineTotal : it.qty * (it.unitPrice || 0)); }, 0);
    // Standalone collection settles only the carried balance; the ordinary
    // stop payment settles that balance plus today's order.
    const outstandingMode = !!window.RD.state.payOutstanding;
    const totalDue = outstandingMode
      ? Math.max(0, M.roundMoney(stop.outstandingAmount || 0))
      : M.roundMoney((stop.outstandingAmount || 0) + orderSum);
    // Nothing owed and nothing ordered: QA opens the pad at ₹0 with round-figure
    // presets instead of pre-filling an amount.
    const openAmount = outstandingMode && !totalDue;

    if (S.payAmount === undefined) {
      S.payAmount = openAmount ? "0" : String(totalDue);
      S.payPrefilled = !openAmount; S.payMethod = "CASH";
    }
    const display = M.formatPaymentDisplay(S.payAmount);
    const method = S.payMethod || "CASH";
    const methodLabel = method === "CASH" ? "Cash" : "UPI";
    const confirming = !!S.payConfirming;
    const presets = openAmount ? [500, 2000, 5000] : M.buildPaymentPresets(totalDue);

    const methods = '<div style="' + U.sty({ display: "flex", gap: 8, padding: "0 16px", marginBottom: 2, flexShrink: 0 }) + '">' +
      M.PAYMENT_METHOD_OPTIONS.map(function (m) {
        const on = method === m.key;
        return '<button type="button" class="rd-chip"' + U.act("pay-method", m.key) + ' style="' + U.sty({
          flex: 1, padding: "10px 8px", textAlign: "center", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
          border: "2px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#e8f5f7" : "white", color: on ? U.BRAND : "#555",
        }) + '">' + m.label + "</button>";
      }).join("") + "</div>";

    const presetRow = '<div style="' + U.sty({ display: "flex", gap: 8, padding: "6px 16px 6px", overflowX: "auto", flexShrink: 0 }) + '">' +
      presets.map(function (q) {
        const on = S.payAmount === String(q);
        return '<button type="button" class="rd-chip"' + U.act("pay-preset", q) + ' style="' + U.sty({
          padding: "8px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer",
          border: "2px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#e8f5f7" : "white", color: on ? U.BRAND : "#111",
        }) + '">₹' + U.formatAmountValue(q) + (q === totalDue ? " Full" : "") + "</button>";
      }).join("") + "</div>";

    const footer = confirming
      ? U.ConfirmPanel({
          action: "Collecting " + methodLabel, amount: "₹" + display,
          context: "from " + stop.customerName,
          backLabel: "Change Amount", commitLabel: "Collect Payment",
          commitAct: "pay-commit", arg: p.stopId,
          processing: !!S.committing, processingLabel: "Recording payment collection…",
        })
      : U.BtnXL({ variant: "green", label: "✅ Collect ₹" + display + " " + methodLabel, actName: "pay-confirm" });

    // usePaymentCollectionController: only for a genuine short payment.
    const amountNum = Number(String(S.payAmount || "").replace(/[^0-9.]/g, "")) || 0;
    const showWriteoff = totalDue > 0 && amountNum > 0 && amountNum < totalDue;
    const writeoffAmount = showWriteoff ? Math.round((totalDue - amountNum) * 100) / 100 : 0;

    return U.MobileHeader({ showHome: false, title: "Collect Payment", subtitle: stop.customerName,
      backLabel: outstandingMode ? "Delivery Stops" : "Customer",
      backAct: outstandingMode ? "pay-back-queue" : "back" }) +
      '<div style="' + U.sty({ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: U.BG, opacity: confirming ? 0.35 : 1, pointerEvents: confirming ? "none" : "auto" }) + '">' +
        '<div style="' + U.sty({ padding: "8px 16px 4px", textAlign: "center", flexShrink: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 13, color: "#888", marginBottom: 2 }) + '">Total Due</div>' +
          '<div style="' + U.sty({ fontSize: 38, fontWeight: 800, color: "#111", lineHeight: 1.1 }) + '">' +
            '<span style="' + U.sty({ fontSize: 20, fontWeight: 700, color: "#888", verticalAlign: "super" }) + '">₹</span>' + U.esc(display) + "</div></div>" +
        U.SectionHeader("Payment Method") + methods + presetRow +
        '<div style="' + U.sty({ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingBottom: 8 }) + '">' +
          U.NumPad("pay-key", { flex: 1, minHeight: 0 }) + "</div>" +
        (S.payError
          ? '<div style="' + U.sty({ padding: "4px 16px", color: "#ef4444", fontSize: 13, textAlign: "center", flexShrink: 0 }) + '">' + U.esc(S.payError) + "</div>"
          : "") +
        // Short payment: QA offers to write the shortfall off as an offer
        // rather than leaving it outstanding, and says what each choice means.
        (showWriteoff
          ? '<label style="' + U.sty({
              display: "flex", alignItems: "flex-start", gap: 10, margin: "0 16px 8px",
              padding: 12, borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0",
              flexShrink: 0, cursor: "pointer",
            }) + '">' +
              '<input type="checkbox" data-model="pay-writeoff"' + (S.payWriteoff ? " checked" : "") + ' style="' + U.sty({ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: "#16a34a" }) + '" />' +
              "<div>" +
                '<div style="' + U.sty({ fontSize: 14, fontWeight: 700, color: "#16a34a" }) + '">' + U.inr(writeoffAmount) + " will be adjusted as offer.</div>" +
                '<div style="' + U.sty({ fontSize: 13, color: "#666" }) + '">Customer outstanding will remain ₹0.</div>' +
              "</div></label>"
          : "") +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  // The exact-match model handler is called as (value, element).
  window.RD.action("model:pay-writeoff", function (_v, el) {
    window.RD.state.scratch.payWriteoff = !!(el && el.checked);
    window.RD.render();
  });

  window.RD.action("pay-key", function (k) {
    const S = window.RD.state.scratch;
    S.payAmount = M.applyNumpadKey(S.payAmount || "", k, S.payPrefilled);
    S.payPrefilled = false;
    S.payWriteoff = false;
    S.payError = null;
    window.RD.render();
  });
  window.RD.action("pay-preset", function (q) {
    const S = window.RD.state.scratch;
    S.payAmount = String(q); S.payPrefilled = false; window.RD.render();
  });
  window.RD.action("pay-method", function (m) {
    const S = window.RD.state.scratch;
    S.payMethod = m; S.payConfirming = false; window.RD.render();
  });
  window.RD.action("pay-back-queue", function () {
    window.RD.state.payOutstanding = false;
    window.RD.go("/queue/" + window.RD.state.routeId);
  });
  // QA validates on the confirm panel's commit, not on the first CTA: the panel
  // always opens, and a rejected amount closes it again with an inline error
  // (PaymentCollection.jsx useEffect on `error`).
  window.RD.action("pay-confirm", function () {
    const S = window.RD.state.scratch;
    S.payConfirming = true; window.RD.render();
  });
  window.RD.action("pay-commit", function (stopId) {
    const Sv = window.RD.state.scratch;
    const stv = D.getStops(window.RD.state.routeId).find(function (s) { return s.id === stopId; });
    const detv = D.resolveStopDetail(window.RD.state.routeId, stopId) || {};
    const orderSumV = (detv.orderItems || []).reduce(function (a, it) { return a + (it.lineTotal != null ? it.lineTotal : it.qty * (it.unitPrice || 0)); }, 0);
    const outstandingModeV = !!window.RD.state.payOutstanding;
    const totalDueV = outstandingModeV
      ? Math.max(0, M.roundMoney((stv && stv.outstandingAmount) || 0))
      : M.roundMoney(((stv && stv.outstandingAmount) || 0) + orderSumV);
    // Over-payment is allowed everywhere (it becomes an advance); a standalone
    // collection additionally must not be ₹0.
    const check = V.validatePayment({
      amount: Number(Sv.payAmount), totalDue: totalDueV, method: Sv.payMethod || "CASH",
      allowOverpayment: true, requirePositive: outstandingModeV,
    });
    if (!check.valid) {
      Sv.payError = check.errors.amount || check.errors.method || "Check the amount";
      Sv.payConfirming = false;
      window.RD.render();
      return;
    }
    window.RD.commit(function () {
      const S = window.RD.state.scratch;
      const routeId = window.RD.state.routeId;
      // Recomputed here rather than closed over: the action runs long after the
      // render that built the screen.
      const st = D.getStops(routeId).filter(function (x) { return x.id === stopId; })[0] || {};
      const det = D.resolveStopDetail(routeId, stopId) || {};
      const orderSum = (det.orderItems || []).reduce(function (a, it) { return a + it.qty * (it.unitPrice || 0); }, 0);
      if (window.RD.state.payOutstanding) {
        const due = Math.max(0, M.roundMoney(st.outstandingAmount || 0));
        const paid = Number(S.payAmount) || 0;
        const written = S.payWriteoff ? Math.max(0, M.roundMoney(due - paid)) : 0;
        SDK.routeDelivery.recordRoutePayment({
          routeId: routeId, customerId: st.customerId,
          paymentAmount: paid, paymentMethod: S.payMethod || "CASH",
        });
        if (written > 0) {
          SDK.routeDelivery.recordRoutePayment({
            routeId: routeId, customerId: st.customerId,
            paymentAmount: written, isWriteoff: true,
          });
        }
        // The success screen has no delivered stop to read from — carry the
        // figures across the same way QA carries them in navigation state.
        window.RD.state.outstandingPayment = {
          customerName: st.customerName, amountCollected: paid,
          method: S.payMethod || "CASH", writeoffAmount: written, totalDue: due,
        };
        S.payConfirming = false;
        window.RD.go("/payment-success/" + routeId + "/" + stopId);
        return;
      }
      const totalDue = M.roundMoney((st.outstandingAmount || 0) + orderSum);
      SDK.routeDelivery.collectPayment({
        routeId: routeId, stopId: stopId,
        amount: Number(S.payAmount), method: S.payMethod || "CASH", sendInvoice: false,
        // A ticked short-payment box writes the shortfall off as an offer
        // instead of leaving it on the customer's outstanding.
        writeoffAmount: S.payWriteoff ? Math.max(0, M.roundMoney(totalDue - (Number(S.payAmount) || 0))) : 0,
      });
      S.payConfirming = false;
      window.RD.go("/payment-success/" + routeId + "/" + stopId);
    });
  });

  /* ══ Payment Success ═══════════════════════════════════════════════════ */

  window.RD.screen("paymentSuccess", function (p) {
    const stop = D.getStops(p.routeId).find(function (s) { return s.id === p.stopId; });
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const S = window.RD.state.scratch;
    // A standalone collection leaves no delivered stop behind, so the figures
    // come from what the payment screen carried over (QA reads its nav state).
    const om = window.RD.state.payOutstanding ? (window.RD.state.outstandingPayment || null) : null;
    // QA's standalone path carries the raw method key into the success screen
    // ("CASH"), while a stop payment goes through paymentMethodLabel ("Cash").
    const methodLabel = om ? String(om.method || "CASH") : (stop.paymentMethod === "UPI" ? "UPI" : "Cash");
    const receipt = PrintSheet(p, stop);

    // Not a normal screen: QA fills the whole viewport with green and centres
    // the confirmation in it, with the CTA inside that column rather than in a
    // sticky bar, and a home-indicator strip pinned under it.
    const outstanding = om
      ? Math.max(0, M.roundMoney((om.totalDue || 0) - (om.amountCollected || 0) - (om.writeoffAmount || 0)))
      : Math.max(0, Math.round(Number(stop.outstandingAmount || 0) * 100) / 100);
    const title = outstanding > 0 ? "Partial Payment Collected!" : "Payment Collected!";
    const collected = om ? om.amountCollected : stop.collectedAmount;
    const custName = om ? om.customerName : stop.customerName;

    // The frame this sits in already caps at 480 and centres, so this takes the
    // full width of it rather than repeating maxWidth/auto margins (which would
    // shrink-wrap it to its content inside a flex column).
    return '<div style="' + U.sty({ display: "flex", flexDirection: "column", flex: 1, width: "100%", minHeight: 0, overflow: "hidden", background: U.GREEN }) + '">' +
        '<div style="' + U.sty({
          flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "32px 24px", paddingTop: "calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 32px)",
          textAlign: "center", overflowY: "auto",
        }) + '">' +
          '<div style="' + U.sty({ fontSize: 72, marginBottom: 16 }) + '">✅</div>' +
          '<div style="' + U.sty({ fontSize: 28, fontWeight: 800, color: "white", marginBottom: 8 }) + '">' + title + "</div>" +
          '<div style="' + U.sty({ fontSize: 42, fontWeight: 800, color: "white", marginBottom: 4 }) + '">' + U.inr(collected) + "</div>" +
          '<div style="' + U.sty({ fontSize: 16, color: "rgba(255,255,255,0.85)", marginBottom: 32 }) + '">' +
            "<span>" + methodLabel + "</span> · <span>" + U.esc(custName) + "</span>" +
            (outstanding > 0 ? "<br /><span>" + U.inr(outstanding) + " outstanding remaining</span>" : "") +
          "</div>" +
          '<div style="' + U.sty({ background: "rgba(255,255,255,0.2)", borderRadius: 14, padding: 14, width: "100%", marginBottom: 24, textAlign: "left" }) + '">' +
            '<div style="' + U.sty({ fontSize: 13, color: "white", fontWeight: 600, marginBottom: 10 }) + '">Share receipt with customer?</div>' +
            '<div style="' + U.sty({ display: "flex", gap: 8 }) + '">' +
              (om ? "" : '<button type="button" class="rd-btn-sm"' + U.act("share-whatsapp") + ' style="' + U.sty({ flex: 1, padding: 11, background: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: U.BRAND, cursor: "pointer" }) + '">📲 WhatsApp</button>') +
              '<button type="button" class="rd-btn-sm"' + U.act("print-open") + ' style="' + U.sty({ flex: 1, padding: 11, background: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, color: U.BRAND, cursor: "pointer" }) + '">🖨 Print Receipt</button>' +
            "</div>" +
          "</div>" +
          '<button type="button" class="rd-btn"' + U.act("back-to-queue", p.routeId) + ' style="' + U.sty({
            background: "white", color: U.BRAND, padding: "18px 32px", borderRadius: 16,
            fontSize: 17, fontWeight: 700, border: "none", cursor: "pointer", width: "100%",
          }) + '">Move to Delivery Stops →</button>' +
        "</div>" +
        '<div style="' + U.sty({ height: 24, background: U.GREEN, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }) + '">' +
          '<div style="' + U.sty({ width: 120, height: 4, background: "white", borderRadius: 2, opacity: 0.3 }) + '"></div>' +
        "</div>" +
      "</div>" + receipt;
  });

  // Print sheet, matched to QA: printer type, a PRINTER DEVICE block with a
  // connect action, paper size, and a monospace receipt preview whose width
  // follows the selected paper. QA's receipt carries a header block (date, bill
  // number, payment method) above the item table, reproduced here.
  function PrintSheet(p, stop) {
    const S = window.RD.state.scratch;
    const size = S.paper || "58mm";
    const type = S.printerType || "USB";
    const detail = stopOr404(p.routeId, p.stopId);
    const now = new Date();
    const billNo = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + String(stop.id).replace(/\D/g, "").slice(-8);
    const INDIGO = "#4f46e5";

    const label = function (text) {
      return '<div style="' + U.sty({ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 10 }) + '">' + text + "</div>";
    };
    const pair = function (opts, current, actName) {
      return '<div style="' + U.sty({ display: "flex", gap: 8, marginBottom: 20 }) + '">' +
        opts.map(function (o) {
          const on = current === o[0];
          return '<button type="button"' + U.act(actName, o[0]) + ' style="' + U.sty({
            flex: 1, padding: "11px 0", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer",
            border: "2px solid " + (on ? INDIGO : "#e5e7eb"),
            background: on ? "#eef2ff" : "white", color: on ? INDIGO : "#374151", fontFamily: "inherit",
          }) + '">' + o[1] + "</button>";
        }).join("") + "</div>";
    };

    // The receipt is a fixed-width character grid: 32 columns on 58mm paper and
    // 48 on 80mm, with the item table on its own wider grid (42/48) printed in
    // the printer's smaller Font B. This is PrintReceiptSheet.jsx's line list,
    // rebuilt line for line so the preview wraps exactly where paper does.
    const cols = size === "80mm" ? 48 : 32;
    const dash = "-".repeat(cols);
    const smallFont = size !== "80mm";
    const tableCols = smallFont ? 42 : 48;
    const QTY_W = smallFont ? 3 : 4;
    const RATE_W = 8;
    const AMT_W = smallFont ? 8 : 9;
    const NAME_W = tableCols - QTY_W - RATE_W - AMT_W - 3;
    const tableDash = "-".repeat(tableCols);

    const center = function (str) {
      str = String(str);
      return " ".repeat(Math.max(0, Math.floor((cols - str.length) / 2))) + str;
    };
    const justify = function (l, r) {
      l = String(l); r = String(r);
      return l + " ".repeat(Math.max(1, cols - l.length - r.length)) + r;
    };
    // Item amounts print at exact precision; the aggregates go through the
    // grouped/rounded display format the rest of the app uses.
    const fmt = function (n) { return "Rs" + Number(n || 0).toFixed(2); };
    const fmtRate = function (n) { return Number(n || 0).toFixed(2); };
    const fmtGated = function (n) { return "Rs" + U.formatAmountValue(n); };

    // A standalone collection has no order behind it: QA prints a "Payment
    // Receipt" with no bill number and no item table (buildPaymentReceiptDto),
    // where a delivered stop prints the full "Invoice" (mapRouteStopToReceiptDto).
    const om = window.RD.state.payOutstanding ? (window.RD.state.outstandingPayment || null) : null;
    const items = om ? [] : (detail.orderItems || []);
    const subTotal = items.reduce(function (a, it) { return a + (it.lineTotal != null ? it.lineTotal : it.qty * (it.unitPrice || 0)); }, 0);
    const custName = om ? om.customerName : stop.customerName;
    const payMode = (om ? om.method : stop.paymentMethod) === "UPI" ? "UPI" : "Cash";
    const oldBalance = om ? Number(om.totalDue || 0) : Number(stop.outstandingAmount || 0);
    const writeoff = om ? Number(om.writeoffAmount || 0) : 0;
    const received = om ? Number(om.amountCollected || 0) : Number(stop.collectedAmount || 0);

    const L = [];
    const push = function (text, opts) { L.push({ text: text, bold: !!(opts && opts.bold), small: !!(opts && opts.small) }); };
    push("");
    push(center(om ? "Payment Receipt" : "Invoice"), { bold: true });
    push(dash);
    // QA stamps the receipt with en-IN date-time, i.e. "30/8/2026, 12:15:18".
    push("Date    : " + now.toLocaleString("en-IN", { hour12: false }));
    push("Customer: " + custName);
    if (!om) push("Bill No : " + billNo);
    push("Payment : " + payMode);
    push(dash);
    if (items.length) {
      push("Item".padEnd(NAME_W) + " " + "Qty".padStart(QTY_W) + " " + "Rate".padStart(RATE_W) + " " + "Amt".padStart(AMT_W), { bold: true, small: smallFont });
      push(tableDash, { small: smallFont });
      items.forEach(function (it) {
        const amtNum = it.lineTotal != null ? it.lineTotal : it.qty * (it.unitPrice || 0);
        const right = String(it.qty).padStart(QTY_W) + " " + fmtRate(it.unitPrice || 0).padStart(RATE_W) + " " + fmt(amtNum).padStart(AMT_W);
        const maxLen = tableCols - right.length - 1;
        const name = String(it.productName || it.name || "Item");
        if (name.length <= maxLen) {
          push(name.padEnd(maxLen) + " " + right, { small: smallFont });
        } else {
          push(name.slice(0, maxLen) + " " + right, { small: smallFont });
          let rest = name.slice(maxLen);
          while (rest.length > 0) { push("  " + rest.slice(0, tableCols - 2), { small: smallFont }); rest = rest.slice(tableCols - 2); }
        }
      });
      push(dash);
      push(justify("Sub Total", fmt(subTotal)));
    }
    push(justify("Discount", fmt(0)));
    push(justify("Total Amount", fmtGated(Math.max(0, subTotal))));
    // With no item table there is no divider yet above the totals block.
    if (!items.length) push(dash);
    if (oldBalance > 0) push(justify("Old Balance", fmtGated(oldBalance)));
    if (writeoff > 0) push(justify("Write Off", fmtGated(writeoff)));
    push(justify("Total Received", fmtGated(received)), { bold: true });

    const receiptText = L.map(function (l) {
      const st = l.small ? ' style="font-size:8px"' : "";
      const tag = l.bold ? "strong" : "span";
      return "<" + tag + st + ">" + U.esc(l.text) + "\n</" + tag + ">";
    }).join("");

    // Always mounted, like QA's: it slides in and out on a transform rather
    // than appearing, and its backdrop fades.
    const open = !!S.printOpen;
    return '<div' + U.act("print-close") + ' style="' + U.sty({
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)",
      WebkitBackdropFilter: "blur(2px)", zIndex: 60, opacity: open ? 1 : 0,
      pointerEvents: open ? "auto" : "none", transition: "opacity 0.25s",
    }) + '"></div>' +
    '<div style="' + U.sty({
      position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto",
      background: "white", borderRadius: "20px 20px 0 0", boxShadow: "0 -4px 32px rgba(0,0,0,0.14)",
      zIndex: 61, display: "flex", flexDirection: "column", maxHeight: "92dvh",
      transform: open ? "translateY(0)" : "translateY(100%)",
      pointerEvents: open ? "auto" : "none",
      transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
    }) + '">' +
      '<div style="' + U.sty({ padding: "12px 20px 0", flexShrink: 0 }) + '">' +
        '<div style="' + U.sty({ width: 40, height: 4, background: "#e0e0e0", borderRadius: 2, margin: "0 auto 16px" }) + '"></div>' +
        '<div style="' + U.sty({ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }) + '">' +
          '<div style="' + U.sty({ fontSize: 17, fontWeight: 800, color: "#111" }) + '">🖨 Print Receipt</div>' +
        "</div>" +
      "</div>" +
      '<div style="' + U.sty({ flex: 1, padding: "0 20px 8px", overflowY: "auto" }) + '">' +
        label("Printer Type") +
        pair([["USB", "🖥 USB"], ["Bluetooth", "📶 Bluetooth"]], type, "printer-type") +
        label("Printer Device") +
        '<div style="' + U.sty({ fontSize: 13, color: "#9ca3af", marginBottom: 10 }) + '">No printer connected</div>' +
        '<button type="button"' + U.act("printer-connect") + ' style="' + U.sty({
          width: "100%", padding: "11px 0", borderRadius: 12, fontSize: 14, fontWeight: 700,
          color: INDIGO, background: "#eef2ff", border: "1.5px solid #c7d2fe",
          cursor: "pointer", fontFamily: "inherit", marginBottom: 4,
        }) + '">Connect ' + type + " Printer</button>" +
        '<div style="' + U.sty({ height: 1, background: "#f3f4f6", margin: "20px 0" }) + '"></div>' +
        label("Paper Size") +
        pair([["58mm", "58mm (2 inch)"], ["80mm", "80mm (3.2 inch)"]], size, "paper-size") +
        '<div style="' + U.sty({ background: "#fffef7", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.09), 0 1px 3px rgba(0,0,0,0.05)", overflow: "hidden" }) + '">' +
          '<div style="' + U.sty({ padding: "10px 14px 9px", borderBottom: "1px dashed #d1d5db", display: "flex", alignItems: "center", justifyContent: "space-between" }) + '">' +
            '<span style="' + U.sty({ fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", color: "#9ca3af", textTransform: "uppercase" }) + '">Receipt Preview</span>' +
            '<span style="' + U.sty({ fontSize: 10, fontWeight: 700, letterSpacing: "0.3px", color: INDIGO, background: "#eef2ff", borderRadius: 4, padding: "2px 7px" }) + '">' + size.replace("mm", " mm") + "</span>" +
          "</div>" +
          '<div style="' + U.sty({ maxHeight: 224, overflowY: "auto", overflowX: "auto", padding: "10px 14px 6px" }) + '">' +
            '<pre style="' + U.sty({ fontFamily: "'Courier New', Courier, monospace", fontSize: 10.5, lineHeight: 1.65, margin: 0, whiteSpace: "pre", color: "#1a1a1a" }) + '">' + receiptText + "</pre>" +
          "</div>" +
          '<div style="' + U.sty({ borderTop: "1px dashed #d1d5db", margin: "6px 0 0" }) + '"></div>' +
        "</div>" +
        '<div style="' + U.sty({ height: 8 }) + '"></div>' +
      "</div>" +
      '<div style="' + U.sty({ background: "white", borderTop: "1px solid #f0f0f0", padding: "10px 20px 14px", flexShrink: 0 }) + '">' +
        '<div style="' + U.sty({ fontSize: 12, color: "#b0b7c3", textAlign: "center", marginBottom: 8 }) + '">Connect a printer above to enable printing</div>' +
        '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
          U.BtnSm({ variant: "grey", label: "Cancel", actName: "print-close" }) +
          U.BtnXL({ variant: "grey", label: "🖨 Print", disabled: true, style: { flex: 1 } }) +
        "</div>" +
      "</div>" +
    "</div>";
  }

  window.RD.action("print-open", function () { window.RD.state.scratch.printOpen = true; window.RD.render(); });
  window.RD.action("print-close", function () { window.RD.state.scratch.printOpen = false; window.RD.render(); });
  window.RD.action("printer-type", function (t) { window.RD.state.scratch.printerType = t; window.RD.render(); });
  window.RD.action("printer-connect", function () {
    // No hardware in a browser; QA shows the same "not connected" state.
  });
  window.RD.action("print-do", function () {});
  window.RD.action("paper-size", function (t) { window.RD.state.scratch.paper = t; window.RD.render(); });
  // The one toast QA raises in this app (PaymentSuccess notifySuccess).
  window.RD.action("share-whatsapp", function () { window.RD.toast("Invoice sent to customer"); });

  window.RD.action("back-to-queue", function (routeId) {
    window.RD.state.payOutstanding = false;
    window.RD.state.outstandingPayment = null;
    window.RD.go("/queue/" + routeId);
  });

  /* ══ Skip Stop ═════════════════════════════════════════════════════════ */

  const SKIP_REASONS = [
    { key: "SHOP_CLOSED",      icon: "🔒", label: "Shop Closed" },
    { key: "OWNER_AWAY",       icon: "🚶", label: "Owner Away" },
    { key: "FULLY_STOCKED",    icon: "📦", label: "Fully Stocked" },
    { key: "REFUSED",          icon: "🙅", label: "Refused" },
    { key: "WILL_ORDER_LATER", icon: "⏰", label: "Will Order Later" },
    { key: "OTHER",            icon: "❓", label: "Other" },
  ];

  window.RD.screen("skipStop", function (p) {
    const stop = D.getStops(p.routeId).find(function (s) { return s.id === p.stopId; });
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const S = window.RD.state.scratch;
    // A reason is always selected: QA starts on the first option rather than on
    // a disabled CTA (useSkipStopController: useState(SKIP_REASON_OPTIONS[0])).
    if (!S.skipReason) S.skipReason = SKIP_REASONS[0].key;
    const confirming = !!S.skipConfirming;
    const outstanding = Number(stop.outstandingAmount || 0);
    const chosen = SKIP_REASONS.filter(function (r) { return r.key === S.skipReason; })[0] || SKIP_REASONS[0];
    const chosenLabel = chosen.icon + " " + chosen.label;

    // Chips wrap in a flex row at half width each, so a long label grows its
    // own row taller rather than every chip growing with it.
    const grid = '<div style="' + U.sty({ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px" }) + '">' +
      SKIP_REASONS.map(function (r) {
        const on = S.skipReason === r.key;
        return '<button type="button" class="rd-chip"' + U.act("skip-reason", r.key) + ' style="' + U.sty({
          padding: "12px 16px", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: "pointer",
          flex: "1 1 calc(50% - 8px)", textAlign: "center",
          border: "2px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#e8f5f7" : "white",
          color: on ? U.BRAND : "#555",
        }) + '">' + r.icon + " " + r.label + "</button>";
      }).join("") + "</div>";

    return U.MobileHeader({ title: "Why no delivery?", backLabel: stop.customerName, backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: confirming ? 0.38 : 1, pointerEvents: confirming ? "none" : "auto", transition: "opacity 0.2s" }) + '">' +
        U.Spacer() +
        U.SectionHeader("Select Reason") + grid +
        U.Spacer() +
        (outstanding > 0
          ? U.Banner({ type: "orange", icon: "⚠️", text: stop.customerName + " has " + U.inr(outstanding) + " outstanding. This will be added to follow-up list.", style: { marginTop: 4 } })
          : "") +
        '<div style="' + U.sty({ padding: "0 12px", marginTop: 8 }) + '">' +
          '<label style="' + U.sty({ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6, display: "block" }) + '">Note (optional)</label>' +
          '<input data-model="skip-note" value="' + U.esc(S.skipNote || "") + '" placeholder="Add a note..." style="' + U.sty({
            width: "100%", padding: "14px 16px", border: "2px solid #e5e7eb", borderRadius: 14,
            fontSize: 15, fontWeight: 500, color: "#111", background: "#fafafa", outline: "none",
            boxSizing: "border-box", fontFamily: "inherit",
          }) + '" /></div>' +
        U.Spacer() +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(
        confirming
          ? U.ConfirmPanel({
              action: "Skip Confirmation", amount: chosenLabel,
              context: outstanding > 0
                ? "⚠ " + U.inr(outstanding) + " outstanding will be tracked"
                : "No delivery for " + stop.customerName + " today",
              backLabel: "Change Reason", commitLabel: "Skip Stop",
              backAct: "skip-confirm-cancel", commitAct: "skip-commit", arg: p.stopId,
              processing: !!S.committing, processingLabel: "Syncing delivery attempt…",
              extra: (S.skipNote || "").trim()
                ? '<div style="' + U.sty({ background: "#f8fafc", borderRadius: 10, border: "1px solid #e9eef2", padding: "9px 14px", fontSize: 13, color: "#555", fontStyle: "italic" }) + '">"' + U.esc(S.skipNote.trim()) + '"</div>'
                : "",
            })
          : U.BtnXL({ variant: "brand", label: "Skip This Stop", disabled: !S.skipReason, actName: "skip-confirm" })
      ) + "</div>";
  });

  window.RD.action("skip-reason", function (r) { window.RD.state.scratch.skipReason = r; window.RD.render(); });
  window.RD.action("model:skip-note", function (v) { window.RD.state.scratch.skipNote = v; });
  window.RD.action("skip-confirm", function () { window.RD.state.scratch.skipConfirming = true; window.RD.render(); });
  window.RD.action("skip-confirm-cancel", function () { window.RD.state.scratch.skipConfirming = false; window.RD.render(); });
  window.RD.action("skip-commit", function (stopId) {
    const S = window.RD.state.scratch;
    const check = V.validateSkipStop({ reason: S.skipReason, note: S.skipNote });
    if (!check.valid) return;
    window.RD.commit(function () {
      const routeId = window.RD.state.routeId;
      SDK.routeDelivery.skipStop({ routeId: routeId, stopId: stopId, reason: S.skipReason, note: S.skipNote });
      S.skipConfirming = false;
      window.RD.go("/queue/" + routeId);
    });
  });

  /* ══ Add New Customer ══════════════════════════════════════════════════ */

  window.RD.screen("newCustomer", function (p) {
    const S = window.RD.state.scratch;
    if (!S.newItems) S.newItems = {};
    if (!S.newPrices) S.newPrices = {};
    const stockMap = bookingStockMap(p.routeId);
    const load = D.db.stockLoads[p.routeId];
    // As in Book Order, sold-out products stay listed — dimmed, with a red
    // "Out of stock" line in place of the price.
    const products = ((load && load.products) || []);
    const search = (S.newSearch || "").trim().toLowerCase();
    const shown = products.filter(function (pr) { return !search || pr.name.toLowerCase().indexOf(search) !== -1; });

    // Two totals: what the catalog would charge, and what the offer prices and
    // the order discount actually come to. The strip above the CTA reports the
    // difference, which is why both are kept.
    const selected = products.filter(function (pr) { return (S.newItems[pr.productId] || 0) > 0; });
    const catalogTotal = selected.reduce(function (a, pr) { return a + pr.unitPrice * S.newItems[pr.productId]; }, 0);
    const baseTotal = selected.reduce(function (a, pr) {
      const price = S.newPrices[pr.productId] !== undefined ? S.newPrices[pr.productId] : pr.unitPrice;
      return a + price * S.newItems[pr.productId];
    }, 0);
    const discountType = S.newDiscountType || "percent";
    const discountInput = S.newDiscountInput || "";
    const discountRaw = parseFloat(discountInput) || 0;
    const discountAmount = discountRaw <= 0 ? 0
      : discountType === "cash" ? Math.min(baseTotal, discountRaw)
      : Math.round(baseTotal * Math.min(100, discountRaw)) / 100;
    const discountPct = baseTotal > 0 && discountAmount > 0 ? (discountAmount / baseTotal) * 100 : 0;
    const orderTotal = Math.max(0, Math.round((baseTotal - discountAmount) * 100) / 100);
    const itemsWithOfferPrices = selected.filter(function (pr) { return S.newPrices[pr.productId] !== undefined; }).length;
    const itemOfferSavings = Math.max(0, Math.round((catalogTotal - baseTotal) * 100) / 100);
    const totalSavings = Math.max(0, Math.round((catalogTotal - orderTotal) * 100) / 100);

    const rows = shown.map(function (pr, i) {
      const qty = S.newItems[pr.productId] || 0;
      const avail = stockMap[pr.productId] || 0;
      const custom = S.newPrices[pr.productId];
      const soldOut = avail <= 0;
      return '<div style="' + U.sty({
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: i < shown.length - 1 ? "1px solid #f5f5f5" : "none",
        opacity: soldOut ? 0.5 : 1,
      }) + '">' +
        '<div style="' + U.sty({ flex: 1, minWidth: 0, marginRight: 12 }) + '">' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 600, color: "#111" }) + '">' + U.esc(pr.name) + "</div>" +
          '<div style="' + U.sty({ fontSize: 12, color: soldOut ? "#ef4444" : "#9ca3af", marginTop: 2 }) + '">' +
            (soldOut
              ? "Out of stock"
              : U.EditablePrice({ productId: pr.productId, catalogPrice: pr.unitPrice, customPrice: custom === undefined ? null : custom, openAct: "new-offer-open", resetAct: "new-offer-reset" }) +
                '<span style="' + U.sty({ marginLeft: 6 }) + '">' + avail + " available</span>") +
          "</div>" +
        "</div>" +
        U.StepperInput({ value: qty, small: true, tight: true, max: avail, arg: pr.productId, decAct: "new-dec", incAct: "new-inc", model: "new-" + pr.productId }) +
        "</div>";
    }).join("");

    const offerPid = S.newOfferSheet;
    const offerProduct = offerPid ? products.filter(function (pr) { return pr.productId === offerPid; })[0] : null;

    return U.MobileHeader({ title: "New Customer", subtitle: "Discovered on route · Auto-added to beat", backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        U.Spacer(16) +
        // QA's form is not a card: two labelled fields on the page background,
        // with inputs sized for a thumb (57.5 tall, 17/700).
        '<div style="' + U.sty({ padding: "0 12px" }) + '">' +
          [{ label: "Shop Name *", model: "new-shop", value: S.newShop || "", ph: "e.g. Ravi General Store", mode: "", last: false, errKey: "shopName" },
           { label: "Owner Phone *", model: "new-phone", value: S.newPhone || "", ph: "10-digit mobile number", mode: "numeric", last: true, errKey: "phone" }].map(function (f) {
            const err = (S.newErrors || {})[f.errKey];
            return '<div style="' + U.sty({ marginBottom: f.last ? 0 : (err ? 6 : 14) }) + '">' +
              '<label style="' + U.sty({ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }) + '">' + f.label + "</label>" +
              '<input data-model="' + f.model + '"' + (f.mode ? ' inputmode="' + f.mode + '"' : "") + ' value="' + U.esc(f.value) + '" placeholder="' + f.ph + '" style="' + U.sty({
                width: "100%", padding: "14px 16px", fontSize: 17, fontWeight: 700,
                border: "2px solid " + (err ? "#ef4444" : "#e5e7eb"), borderRadius: 14, outline: "none",
                background: "#fafafa", color: "#111", boxSizing: "border-box", fontFamily: "inherit",
              }) + '" />' +
              (err ? '<div style="' + U.sty({ color: "#ef4444", fontSize: 12, marginTop: 4, fontWeight: 500 }) + '">' + U.esc(err) + "</div>" : "") +
            "</div>";
          }).join("") +
        "</div>" +
        U.Divider({ marginTop: 14 }) +
        U.SectionHeader("Quick Order") +
        U.SearchInput({ value: S.newSearch || "", model: "new-search", placeholder: "Search products…", clearAct: "new-search-clear", style: { margin: "0 12px 8px" } }) +
        (rows
          ? U.Card(rows, { padding: 0, style: { overflow: "hidden" } })
          : U.Card('<div style="padding:24px;text-align:center;color:#888;font-size:14px">No stock available to order</div>', { padding: 0 })) +
        U.Spacer(16) +
      "</div>" +
      (S.newConfirming ? U.FreezeBackdrop(0.45) : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: S.newConfirming ? 50 : "auto" }) + '">' + U.ActionBar(
        S.newConfirming
          ? U.ConfirmPanel({
              action: "New Customer Order", amount: U.inr(orderTotal),
              context: (S.newShop || "New Customer") + " · " + selected.length + " item" + (selected.length !== 1 ? "s" : "") +
                (discountPct > 0 ? (discountType === "cash" ? " · ₹" + discountInput + " off" : " · " + discountInput + "% off") : ""),
              backLabel: "Edit Order", commitLabel: "Add Customer →",
              backAct: "new-confirm-cancel", commitAct: "new-commit", arg: p.routeId,
              processing: !!S.committing, processingLabel: "Adding customer…",
              extra: ((S.newShop || S.newPhone)
                  ? '<div style="' + U.sty({ padding: "7px 14px", background: "#f0fdf4", borderRadius: 8, marginBottom: 6, fontSize: 12, color: "#16a34a", fontWeight: 600 }) + '">' +
                      U.esc(S.newShop || "—") + (S.newPhone ? " · " + U.esc(S.newPhone) : "") + "</div>"
                  : "") +
                '<div style="' + U.sty({ background: "#f8fafc", borderRadius: 10, border: "1px solid #e9eef2", overflow: "hidden", maxHeight: 140, overflowY: "auto" }) + '">' +
                  selected.map(function (pr, idx) {
                    const hasOffer = S.newPrices[pr.productId] !== undefined;
                    const price = hasOffer ? S.newPrices[pr.productId] : pr.unitPrice;
                    return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: idx < selected.length - 1 ? "1px solid #f1f5f9" : "none" }) + '">' +
                      '<span style="' + U.sty({ fontSize: 13, color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }) + '">' + U.esc(pr.name) +
                        (hasOffer ? '<span style="' + U.sty({ display: "inline-block", fontSize: 10, color: "#6366f1", fontWeight: 700, background: "#ede9fe", borderRadius: 3, padding: "1px 4px", marginLeft: 5 }) + '">Offer</span>' : "") + "</span>" +
                      '<span style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#374151", flexShrink: 0 }) + '">× ' + S.newItems[pr.productId] + "&nbsp; ₹" + Number(price * S.newItems[pr.productId]).toLocaleString("en-IN") + "</span></div>";
                  }).join("") +
                "</div>" +
                (itemsWithOfferPrices > 0
                  ? '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", padding: "7px 14px", borderTop: "1px solid #e9eef2", fontSize: 12, color: "#6366f1", fontWeight: 600 }) + '">' +
                      "<span>" + itemsWithOfferPrices + " offer price" + (itemsWithOfferPrices !== 1 ? "s" : "") + "</span><span>-₹" + itemOfferSavings.toLocaleString("en-IN") + "</span></div>"
                  : "") +
                (discountPct > 0
                  ? '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", padding: "7px 14px", borderTop: "1px solid #e9eef2", fontSize: 12, color: "#16a34a", fontWeight: 600 }) + '">' +
                      "<span>" + (discountType === "cash" ? "₹" + U.esc(discountInput) + " discount" : U.esc(discountInput) + "% discount") + "</span><span>-₹" + discountAmount.toLocaleString("en-IN") + "</span></div>"
                  : "") +
                (itemsWithOfferPrices > 0 && discountPct > 0
                  ? '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", padding: "7px 14px", borderTop: "1px solid #d1fae5", fontSize: 12, color: "#16a34a", fontWeight: 700, background: "#f0fdf4", borderRadius: "0 0 10px 10px" }) + '">' +
                      "<span>Total savings</span><span>-₹" + totalSavings.toLocaleString("en-IN") + "</span></div>"
                  : ""),
            })
          : U.DiscountStrip({
              discountPct: discountPct, discountType: discountType, discountInput: discountInput,
              savings: discountAmount, totalSavings: totalSavings,
              itemsWithOfferPrices: itemsWithOfferPrices, itemOfferSavings: itemOfferSavings,
              // AddNewCustomer does not pass `disabled`: its strip stays live even
              // with nothing selected (unlike At Customer's booking strip).
              openAct: "new-discount-open", clearAct: "new-discount-clear",
            }) +
            U.BtnXL({
              variant: "green",
              label: selected.length === 0 ? "Add at least one product to continue" : "Add & Collect " + U.inr(orderTotal) + " →",
              disabled: selected.length === 0,
              style: { opacity: selected.length === 0 ? 0.6 : 1 },
              actName: "new-confirm", arg: p.routeId,
            })
      ) + "</div>" +
      U.DiscountSheet({
        open: !!S.newDiscountSheet, closeAct: "new-discount-close",
        discountType: discountType, discountInput: discountInput,
        subtotal: baseTotal, discountAmount: discountAmount, discountPct: discountPct,
        typeAct: "new-discount-type", chipAct: "new-discount-chip", clearAct: "new-discount-clear",
        model: "new-discount",
      }) +
      U.OfferPriceSheet({
        open: !!offerProduct, closeAct: "new-offer-close",
        productId: offerPid, productName: offerProduct ? offerProduct.name : "",
        catalogPrice: offerProduct ? offerProduct.unitPrice : 0, taxRate: offerProduct ? (offerProduct.tax || 0) : 0,
        qty: offerPid ? (S.newItems[offerPid] || 0) : 0,
        maxQty: offerPid ? (stockMap[offerPid] || 0) : null,
        input: S.newOfferInput || "",
        hasCustomPrice: offerPid ? S.newPrices[offerPid] !== undefined : false,
        decAct: "new-dec", incAct: "new-inc", chipAct: "new-offer-chip",
        resetAct: "new-offer-reset", confirmAct: "new-offer-confirm", model: "new-offer",
      });
  });

  /* ── Book Order: quantities, offer prices and the order discount ─────── */
  window.RD.action("book-inc", function (pid) {
    const S = window.RD.state.scratch;
    const max = bookingStockMap(window.RD.state.routeId)[pid] || 0;
    const next = (S.bookItems[pid] || 0) + 1;
    if (max > 0 && next > max) return;
    S.bookItems[pid] = next;
    window.RD.render();
  });
  window.RD.action("book-dec", function (pid) {
    const S = window.RD.state.scratch;
    const next = (S.bookItems[pid] || 0) - 1;
    if (next > 0) S.bookItems[pid] = next; else delete S.bookItems[pid];
    window.RD.render();
  });
  window.RD.action("model:book#", function (value, pid) {
    const S = window.RD.state.scratch;
    const max = bookingStockMap(window.RD.state.routeId)[pid] || 0;
    let qty = Number(String(value).replace(/\D/g, "")) || 0;
    if (max > 0 && qty > max) qty = max;
    if (qty > 0) S.bookItems[pid] = qty; else delete S.bookItems[pid];
    window.RD.render();
  });
  window.RD.action("book-search-clear", function () { window.RD.state.scratch.bookSearch = ""; window.RD.render(); });
  window.RD.action("model:book-search", function (v) {
    window.RD.state.scratch.bookSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="book-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("book-offer-open", function (pid) {
    const S = window.RD.state.scratch;
    S.bookOfferSheet = pid;
    S.bookOfferInput = S.bookPrices[pid] !== undefined ? String(S.bookPrices[pid]) : "";
    window.RD.render();
  });
  window.RD.action("book-offer-close", function () { window.RD.state.scratch.bookOfferSheet = null; window.RD.render(); });
  window.RD.action("model:book-offer", function (v) {
    const S = window.RD.state.scratch;
    if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) S.bookOfferInput = v;
    window.RD.render();
    const el = document.querySelector('[data-model="book-offer"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("book-offer-chip", function (pct) {
    const S = window.RD.state.scratch;
    const load = D.db.stockLoads[window.RD.state.routeId];
    const pr = ((load && load.products) || []).filter(function (x) { return x.productId === S.bookOfferSheet; })[0];
    if (!pr) return;
    const computed = Math.round(pr.unitPrice * (1 - Number(pct) / 100) * 100) / 100;
    S.bookOfferInput = (parseFloat(S.bookOfferInput) || 0) === computed ? "" : String(computed);
    window.RD.render();
  });
  window.RD.action("book-offer-reset", function (pid) {
    const S = window.RD.state.scratch;
    delete S.bookPrices[pid]; S.bookOfferSheet = null; window.RD.render();
  });
  window.RD.action("book-offer-confirm", function (pid) {
    const S = window.RD.state.scratch;
    const val = parseFloat(S.bookOfferInput);
    const load = D.db.stockLoads[window.RD.state.routeId];
    const pr = ((load && load.products) || []).filter(function (x) { return x.productId === pid; })[0];
    if (val && val > 0 && pr && Math.abs(val - pr.unitPrice) >= 0.005) S.bookPrices[pid] = val;
    else delete S.bookPrices[pid];
    S.bookOfferSheet = null;
    window.RD.render();
  });
  window.RD.action("book-discount-open", function () { window.RD.state.scratch.bookDiscountSheet = true; window.RD.render(); });
  window.RD.action("book-discount-close", function () { window.RD.state.scratch.bookDiscountSheet = false; window.RD.render(); });
  window.RD.action("book-discount-type", function (t) {
    const S = window.RD.state.scratch;
    S.bookDiscountType = t; S.bookDiscountInput = ""; window.RD.render();
  });
  window.RD.action("book-discount-chip", function (v) {
    const S = window.RD.state.scratch;
    S.bookDiscountInput = S.bookDiscountInput === v ? "" : v; window.RD.render();
  });
  window.RD.action("book-discount-clear", function () { window.RD.state.scratch.bookDiscountInput = ""; window.RD.render(); });
  window.RD.action("model:book-discount", function (v) {
    const S = window.RD.state.scratch;
    S.bookDiscountInput = v; window.RD.render();
    const el = document.querySelector('[data-model="book-discount"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  // Booking an order turns the stop into an ordinary delivery stop, which is
  // what QA does: the order is written and the driver lands on the payment
  // screen for it.
  window.RD.action("book-confirm", function () { window.RD.state.scratch.bookConfirming = true; window.RD.render(); });
  window.RD.action("book-confirm-cancel", function () { window.RD.state.scratch.bookConfirming = false; window.RD.render(); });
  window.RD.action("book-commit", function (stopId) {
    const S = window.RD.state.scratch;
    const routeId = window.RD.state.routeId;
    const load = D.db.stockLoads[routeId];
    const products = (load && load.products) || [];
    const items = Object.keys(S.bookItems).map(function (pid) {
      const pr = products.filter(function (x) { return x.productId === pid; })[0];
      if (!pr) return null;
      return {
        productId: pid, productName: pr.name, name: pr.name,
        qty: S.bookItems[pid],
        unitPrice: S.bookPrices[pid] !== undefined ? S.bookPrices[pid] : pr.unitPrice,
      };
    }).filter(Boolean);
    if (!items.length) return;
    window.RD.commit(function () {
      const detail = D.resolveStopDetail(routeId, stopId);
      if (detail) detail.orderItems = items;
      const st = D.getStops(routeId).filter(function (x) { return x.id === stopId; })[0];
      if (st) st.todayOrderAmount = items.reduce(function (a, it) { return a + it.qty * it.unitPrice; }, 0);
      delete S.items;
      S.bookItems = {}; S.bookPrices = {}; S.bookDiscountInput = ""; S.bookConfirming = false;
      window.RD.render();
    });
  });

  /* ── New Customer: offer price and order discount ────────────────────── */
  window.RD.action("new-offer-open", function (pid) {
    const S = window.RD.state.scratch;
    S.newOfferSheet = pid;
    S.newOfferInput = S.newPrices[pid] !== undefined ? String(S.newPrices[pid]) : "";
    window.RD.render();
  });
  window.RD.action("new-offer-close", function () {
    window.RD.state.scratch.newOfferSheet = null; window.RD.render();
  });
  window.RD.action("model:new-offer", function (v) {
    const S = window.RD.state.scratch;
    if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) S.newOfferInput = v;
    window.RD.render();
    const el = document.querySelector('[data-model="new-offer"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("new-offer-chip", function (pct) {
    const S = window.RD.state.scratch;
    const pid = S.newOfferSheet;
    const load = D.db.stockLoads[window.RD.state.routeId];
    const pr = ((load && load.products) || []).filter(function (x) { return x.productId === pid; })[0];
    if (!pr) return;
    const computed = Math.round(pr.unitPrice * (1 - Number(pct) / 100) * 100) / 100;
    // A second tap on the same chip clears it, as upstream.
    S.newOfferInput = (parseFloat(S.newOfferInput) || 0) === computed ? "" : String(computed);
    window.RD.render();
  });
  window.RD.action("new-offer-reset", function (pid) {
    const S = window.RD.state.scratch;
    delete S.newPrices[pid];
    S.newOfferSheet = null;
    window.RD.render();
  });
  window.RD.action("new-offer-confirm", function (pid) {
    const S = window.RD.state.scratch;
    const val = parseFloat(S.newOfferInput);
    const load = D.db.stockLoads[window.RD.state.routeId];
    const pr = ((load && load.products) || []).filter(function (x) { return x.productId === pid; })[0];
    if (val && val > 0 && pr && Math.abs(val - pr.unitPrice) >= 0.005) S.newPrices[pid] = val;
    else delete S.newPrices[pid];
    S.newOfferSheet = null;
    window.RD.render();
  });

  window.RD.action("new-confirm", function () { window.RD.state.scratch.newConfirming = true; window.RD.render(); });
  window.RD.action("new-confirm-cancel", function () { window.RD.state.scratch.newConfirming = false; window.RD.render(); });

  window.RD.action("new-discount-open", function () { window.RD.state.scratch.newDiscountSheet = true; window.RD.render(); });
  window.RD.action("new-discount-close", function () { window.RD.state.scratch.newDiscountSheet = false; window.RD.render(); });
  window.RD.action("new-discount-type", function (t) {
    const S = window.RD.state.scratch;
    S.newDiscountType = t; S.newDiscountInput = "";
    window.RD.render();
  });
  window.RD.action("new-discount-chip", function (v) {
    const S = window.RD.state.scratch;
    S.newDiscountInput = S.newDiscountInput === v ? "" : v;
    window.RD.render();
  });
  window.RD.action("new-discount-clear", function () {
    window.RD.state.scratch.newDiscountInput = ""; window.RD.render();
  });
  window.RD.action("model:new-discount", function (v) {
    const S = window.RD.state.scratch;
    S.newDiscountInput = v; window.RD.render();
    const el = document.querySelector('[data-model="new-discount"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });

  window.RD.action("model:new-shop", function (v) { window.RD.state.scratch.newShop = v; });
  window.RD.action("model:new-phone", function (v) { window.RD.state.scratch.newPhone = v; });
  window.RD.action("model:new#", function (value, pid) {
    const S = window.RD.state.scratch;
    const max = bookingStockMap(window.RD.state.routeId)[pid] || 0;
    let qty = Number(String(value).replace(/\D/g, "")) || 0;
    if (max > 0 && qty > max) qty = max;
    if (qty > 0) S.newItems[pid] = qty; else delete S.newItems[pid];
    window.RD.render();
  });

  window.RD.action("new-search-clear", function () { window.RD.state.scratch.newSearch = ""; window.RD.render(); });
  window.RD.action("model:new-search", function (v) {
    window.RD.state.scratch.newSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="new-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("new-inc", function (pid) {
    const S = window.RD.state.scratch;
    const max = bookingStockMap(window.RD.state.routeId)[pid] || 0;
    const cur = S.newItems[pid] || 0;
    if (cur >= max) return;
    S.newItems[pid] = cur + 1; window.RD.render();
  });
  window.RD.action("new-dec", function (pid) {
    const S = window.RD.state.scratch;
    S.newItems[pid] = Math.max(0, (S.newItems[pid] || 0) - 1);
    if (!S.newItems[pid]) delete S.newItems[pid];
    window.RD.render();
  });
  window.RD.action("new-commit", function (routeId) {
    const S = window.RD.state.scratch;
    const load = D.db.stockLoads[routeId];
    const items = Object.keys(S.newItems || {}).map(function (pid) {
      const pr = ((load && load.products) || []).find(function (x) { return x.productId === pid; });
      return { productId: pid, name: pr && pr.name, qty: S.newItems[pid], unitPrice: pr ? pr.unitPrice : 0 };
    });
    const check = V.validateAddCustomer({ shopName: S.newShop || "", ownerPhone: S.newPhone || "", orderItems: items });
    if (!check.valid) {
      const first = check.errors.shopName || check.errors.phone || check.errors.orderItems;
      window.RD.state.scratch.newErrors = check.errors;
      window.RD.render();
      return;
    }
    const res = SDK.routeDelivery.addNewStop({
      routeId: routeId, shopName: S.newShop, ownerPhone: S.newPhone, orderItems: items,
    }).data;
    window.RD.go("/delivery/" + routeId + "/" + res.stop.id);
  });

  /* ══ Stop Summary ══════════════════════════════════════════════════════ */

  window.RD.screen("stopSummary", function (p) {
    const stop = D.getStops(p.routeId).find(function (s) { return s.id === p.stopId; });
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const detail = stopOr404(p.routeId, p.stopId);
    const S = window.RD.state.scratch;
    const cust = detail.customer || {};

    const isSkipped = stop.status === "SKIPPED";
    const outstanding = Math.max(0, Number(stop.outstandingAmount || 0));
    const hasOutstanding = outstanding > 0;
    const collectedAmt = Number(stop.collectedAmount || 0);
    const isPartial = !isSkipped && hasOutstanding;
    const items = (detail.orderItems || []).filter(function (it) { return (it.qty || 0) > 0; });
    const orderTotal = items.reduce(function (a, it) { return a + (it.lineTotal != null ? it.lineTotal : (it.qty || 0) * (it.unitPrice || 0)); }, 0);

    const summaryReturnOnly = !!stop.isReturnOnly;
    const statusColor = isSkipped ? "#6b7280" : summaryReturnOnly ? "#c2410c" : isPartial ? "#c2410c" : "#16a34a";
    const statusIcon  = isSkipped ? "−" : summaryReturnOnly ? "↩" : isPartial ? "✓" : "✓✓";
    const statusLabel = isSkipped ? "Skipped" : summaryReturnOnly ? "Return received" : isPartial ? "Partial payment" : "Fully collected";

    const hero = '<div style="' + U.sty({ margin: 12, background: "white", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }) + '">' +
      '<div style="' + U.sty({
        display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 6, color: statusColor,
      }) + '">' +
        "<span>" + statusIcon + "</span><span>" + statusLabel + "</span>" +
        (stop.completedAt ? '<span style="' + U.sty({ color: "#9ca3af", fontWeight: 500, marginLeft: 4 }) + '">· ' + U.esc(M.formatRouteTime(stop.completedAt, { hour12: false })) + "</span>" : "") +
      "</div>" +
      '<div style="' + U.sty({ fontSize: 26, fontWeight: 800, color: "#111", lineHeight: 1.2, marginBottom: 4 }) + '">' + U.esc(stop.customerName) + "</div>" +
      (cust.address ? '<div style="' + U.sty({ fontSize: 13, color: "#888", display: "flex", alignItems: "center", gap: 4 }) + '">📍 ' + U.esc(cust.address) + "</div>" : "") +
      '<div style="' + U.sty({ marginTop: 14, paddingTop: 14, borderTop: "1px solid #f0f0f0" }) + '">' +
        (summaryReturnOnly
          ? '<div style="' + U.sty({ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }) + '">Products returned by this customer are recorded below.</div>'
          : isSkipped
          ? "<div>" +
              '<div style="' + U.sty({ fontSize: 13, color: "#6b7280", marginBottom: 8 }) + '">Reason: <span style="' + U.sty({ fontWeight: 600, color: "#374151" }) + '">' + U.esc(M.skipLabelFor ? M.skipLabelFor(stop.skipReason) : (stop.skipReason || "—")) + "</span></div>" +
              (hasOutstanding
                ? "<div>" +
                    '<div style="' + U.sty({ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 3 }) + '">Outstanding balance</div>' +
                    '<div style="' + U.sty({ fontSize: 30, fontWeight: 800, color: "#ef4444" }) + '">' + U.inr(outstanding) + "</div></div>"
                : "") +
            "</div>"
          : '<div style="' + U.sty({ display: "flex", gap: 12, alignItems: "flex-start" }) + '">' +
              '<div style="' + U.sty({ flex: 1 }) + '">' +
                '<div style="' + U.sty({ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 3 }) + '">Collected</div>' +
                '<div style="' + U.sty({ fontSize: 34, fontWeight: 800, color: "#15803d", lineHeight: 1 }) + '">' + U.inr(collectedAmt) + "</div>" +
                (isPartial ? '<div style="' + U.sty({ fontSize: 12, color: "#f97316", marginTop: 4, fontWeight: 600 }) + '">' + U.inr(outstanding) + " outstanding</div>" : "") +
              "</div>" +
              // Unlike At Customer's, StopSummary's call link carries no press class.
              (cust.phone ? '<a href="tel:' + U.esc(cust.phone) + '" style="' + U.sty({ padding: "10px 14px", background: "#f0f2f5", borderRadius: 12, fontSize: 22, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center" }) + '">📞</a>' : "") +
            "</div>") +
      "</div></div>";

    // One card per order, headed by a Print button — QA prints a stop's
    // receipt from here, not only from the payment screen.
    const orderCard = (!isSkipped && !summaryReturnOnly && (items.length || orderTotal))
      ? '<div style="' + U.sty({ margin: "0 12px 10px", background: "white", borderRadius: 14, overflow: "hidden" }) + '">' +
          '<div style="' + U.sty({ padding: "13px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }) + '">' +
            '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#888" }) + '">Today\'s Order</div>' +
            '<button type="button"' + U.act("print-open") + ' style="' + U.sty({
              fontSize: 11, padding: "4px 10px", borderRadius: 8, border: "1px solid #e5e7eb",
              background: "#f9fafb", color: "#374151", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
            }) + '">🖨 Print</button>' +
          "</div>" +
          (items.length
            ? '<div style="' + U.sty({ padding: "0 16px" }) + '">' +
                items.map(function (it, i) {
                  const line = it.lineTotal != null ? it.lineTotal : (it.qty || 0) * (it.unitPrice || 0);
                  return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14, marginBottom: i < items.length - 1 ? 8 : 0 }) + '">' +
                    '<span style="' + U.sty({ color: "#555", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 8 }) + '">' +
                      U.esc(it.productName || it.name) + " × " + it.qty + "</span>" +
                    '<span style="' + U.sty({ fontWeight: 700, flexShrink: 0 }) + '">₹' + Number(line).toLocaleString("en-IN") + "</span></div>";
                }).join("") +
              "</div>"
            : "") +
          '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "8px 16px 13px", borderTop: "1px dashed #e5e7eb", marginTop: 8 }) + '">' +
            '<span style="' + U.sty({ fontWeight: 700 }) + '">Order Total</span>' +
            '<span style="' + U.sty({ fontWeight: 800, color: "#111" }) + '">' + U.inr(orderTotal) + "</span></div>" +
        "</div>"
      : "";

    // The primary action depends on what is still owed, everything else moves
    // into the More Actions sheet (StopSummary.jsx primaryCTA/moreActionsGroups).
    // Returns recorded against this customer, listed under a "↩ Returns" rule.
    const custReturns = ((D.db.returns && D.db.returns[p.routeId]) || []).filter(function (r) { return r.customerId === stop.customerId; });
    const returnsSection = custReturns.length
      ? '<div style="' + U.sty({ display: "flex", alignItems: "center", gap: 10, margin: "12px 25px" }) + '">' +
          '<span style="' + U.sty({ fontSize: 14, fontWeight: 700, color: "#c2410c", letterSpacing: "0.5px", textTransform: "uppercase", flexShrink: 0 }) + '">↩ Returns</span>' +
          '<div style="' + U.sty({ flex: 1, height: 1, background: "#e9ecef" }) + '"></div>' +
        "</div>" +
        custReturns.map(function (ret, idx) {
          const its = (ret.items || []).filter(function (i) { return (i.qty || 0) > 0; });
          return '<div style="' + U.sty({ margin: "0 12px 10px", background: "white", borderRadius: 14, overflow: "hidden" }) + '">' +
            '<div style="' + U.sty({ padding: "13px 16px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }) + '">' +
              '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#888" }) + '">Return ' + (idx + 1) +
                (ret.createdAt ? '<span style="' + U.sty({ fontWeight: 500, color: "#9ca3af" }) + '"> · ' + U.esc(M.formatRouteTime(ret.createdAt, { hour12: false })) + "</span>" : "") +
              "</div>" +
            "</div>" +
            (its.length
              ? '<div style="' + U.sty({ padding: "0 16px 13px" }) + '">' +
                  its.map(function (it, i) {
                    return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14, marginBottom: i < its.length - 1 ? 8 : 0 }) + '">' +
                      '<span style="' + U.sty({ color: "#555", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 8 }) + '">' + U.esc(it.productName || it.name || "") + " × " + it.qty + "</span>" +
                      '<span style="' + U.sty({ fontWeight: 600, color: "#c2410c", flexShrink: 0, fontSize: 13 }) + '">returned</span>' +
                    "</div>";
                  }).join("") + "</div>"
              : "") +
          "</div>";
        }).join("")
      : "";

    // Nothing can be booked once the van is empty (or without a customer), and
    // that gates both the primary CTA's fallback and the Delivery group.
    const vanRows = (SDK.routeDelivery.getBookingStock({ routeId: p.routeId }).data || []);
    const deliveryDepleted = vanRows.length > 0 && vanRows.every(function (r) { return (r.availableQty || 0) <= 0; });
    const canBook = !!stop.customerId && !deliveryDepleted;
    const isReturnOnly = !!stop.isReturnOnly;

    const isCollectPrimary = isPartial || (isSkipped && hasOutstanding);
    const primary = isCollectPrimary
      ? { label: "💰 Collect Outstanding · " + U.inr(outstanding), act: "goto-outstanding", arg: p.stopId }
      : canBook
        ? { label: (isSkipped || isReturnOnly) ? "Book Order" : "Deliver Extra Items →", act: "summary-book", arg: p.stopId }
        : { label: "💰 Collect Payment", act: "goto-outstanding", arg: p.stopId };

    const groups = [];
    const financial = [], delivery = [];
    if (!isCollectPrimary && canBook) financial.push({ icon: "💰", label: "Collect Payment", act: "goto-outstanding", arg: p.stopId });
    if (isPartial && canBook) delivery.push({ icon: "🚚", label: "Deliver Extra Items →", act: "summary-book", arg: p.stopId });
    if ((isSkipped || isReturnOnly) && hasOutstanding && canBook) delivery.push({ icon: "📋", label: "Book Order", act: "summary-book", arg: p.stopId });
    if (financial.length) groups.push({ label: "Financial", actions: financial });
    if (delivery.length) groups.push({ label: "Delivery", actions: delivery });
    if (stop.customerId) groups.push({ label: "Returns", actions: [{ icon: "📦", label: "Product Return", act: "goto-returns", arg: p.routeId }] });
    if (stop.customerId) groups.push({ label: "Assets", actions: [{ icon: "🗂️", label: "Manage Assets", act: "goto-assets", arg: stop.customerId }] });

    return U.ProgressBar({ collected: U.inr(collectedFor(p.routeId)), backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' + hero + orderCard + returnsSection + "</div>" +
      U.ActionBar(
        U.BtnXL({ variant: "green", label: primary.label, actName: primary.act, arg: primary.arg }) +
        U.BtnXL({ variant: "outline", label: "More Actions", style: { marginTop: 8, fontSize: 15, padding: "13px 18px" }, actName: "stop-actions-open" })
      ) +
      // QA mounts the print sheet before the actions sheet.
      PrintSheet(p, stop) +
      U.ActionsSheet({ open: !!S.stopActions, closeAct: "stop-actions-close", groups: groups });
  });

  // Delivering extra items to a stop that is already done reopens it in Book
  // Order mode, exactly as QA's handleBookOrder does.
  window.RD.action("summary-book", function (stopId) {
    const routeId = window.RD.state.routeId;
    const detail = D.resolveStopDetail(routeId, stopId);
    if (detail) detail.orderItems = [];
    const st = D.getStops(routeId).filter(function (x) { return x.id === stopId; })[0];
    if (st) { st.todayOrderAmount = 0; st.status = st.status === "SKIPPED" ? "PENDING" : st.status; }
    delete window.RD.state.scratch.items;
    window.RD.go("/delivery/" + routeId + "/" + stopId);
  });
})();

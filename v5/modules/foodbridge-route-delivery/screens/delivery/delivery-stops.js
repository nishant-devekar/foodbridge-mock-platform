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

  function StopRow(stop) {
    const initials = M.customerInitials(stop.customerName);
    const skipped = stop.status === "SKIPPED";
    const done = stop.status === "DELIVERED" || skipped;

    if (done) {
      const sub = skipped ? "Skipped" : (M.stopDisplaySubtitle ? M.stopDisplaySubtitle(stop) : "");
      return Row(
        Avatar(initials, skipped ? "grey" : "green") +
        '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 600, color: "#111" }) + '">' + U.esc(stop.customerName) + "</div>" +
          '<div style="' + U.sty({ fontSize: 13, color: skipped ? "#ef4444" : "#888", marginTop: 1 }) + '">' + U.esc(sub) + "</div>" +
        "</div>" +
        '<div style="' + U.sty({ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }) + '">' +
          '<span style="' + U.sty({ fontSize: 17, color: stop.outstandingAmount > 0 ? "#f97316" : "#43A047" }) + '">' + (skipped ? "" : stop.outstandingAmount > 0 ? "✓" : "✓✓") + "</span>" +
          (stop.completedAt ? '<span style="' + U.sty({ fontSize: 11, color: "#aaa" }) + '">' + U.esc(M.formatRouteTime(stop.completedAt, { hour12: false })) + "</span>" : "") +
        "</div>",
        { done: true, actName: "queue-view-done", arg: stop.id, status: skipped ? "skipped" : "done" }
      );
    }

    if (stop.status === "CURRENT") {
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

    // QA subtitle order: outstanding warning, then over-payment, then a dash.
    const sub = stop.outstandingAmount > 0
      ? "⚠️ " + U.inr(stop.outstandingAmount) + " outstanding"
      : (stop.advanceAmount > 0 ? U.inr(stop.advanceAmount) + " Over Paid" : "—");
    return Row(
      Avatar(initials, stop.outstandingAmount > 0 ? "orange" : stop.advanceAmount > 0 ? "green" : "blue") +
      '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
        '<div style="' + U.sty({ fontSize: 15, fontWeight: 600, color: "#111" }) + '">' + U.esc(stop.customerName) + "</div>" +
        '<div style="' + U.sty({ fontSize: 13, color: "#888", marginTop: 1 }) + '">' + U.esc(sub) + "</div>" +
      "</div>" +
      '<div style="' + U.sty({ width: 8, height: 8, background: "#d1d5db", borderRadius: "50%", flexShrink: 0 }) + '"></div>',
      { actName: "queue-select", arg: stop.id, status: "pending" }
    );
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

    // One flat list in route order, exactly as QA renders it. (An earlier pass
    // grouped this into Next stop / Upcoming / Completed; QA does not, and QA
    // is the reference.) Add Customer sits at the end of the list, not in the
    // footer, and is hidden while searching.
    const addRow = !search
      ? '<button type="button" class="rd-row"' + U.act("queue-add-customer", p.routeId) + ' style="' + U.sty({
          width: "100%", display: "flex", alignItems: "center", padding: "12px 16px", gap: 12,
          background: "white", borderBottom: "1px solid #f0f0f0", border: "none",
          textAlign: "left", fontFamily: "inherit", cursor: "pointer",
        }) + '">' +
        '<div style="' + U.sty({ width: 46, height: 46, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f0fdf4", color: "#16a34a", fontSize: 22, fontWeight: 700 }) + '">+</div>' +
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
      : shown.map(StopRow).join("") + addRow;

    return U.ProgressBar({
        current: done, total: all.length,
        collected: collectedFor(p.routeId),
        backLabel: "Routes", backAct: "home",
      }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        '<div style="margin:8px 12px 4px">' + U.SearchInput({ value: S.queueSearch || "", model: "queue-search", placeholder: "Search by name or phone…", clearAct: "queue-search-clear" }) + "</div>" +
        list +
        '<div style="height:16px"></div>' +
      "</div>" +
      U.ActionBar('<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
        U.BtnSm({ variant: "grey", label: "↻ Restock", actName: "queue-restock", arg: p.routeId }) +
        U.BtnSm({ variant: "brand", label: "₹ Return & Settle", actName: "queue-settle", arg: p.routeId }) +
      "</div>");
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
  window.RD.action("queue-restock", function (routeId) { window.RD.go("/restock/" + routeId); });
  window.RD.action("queue-settle", function (routeId) { window.RD.go("/settlement/" + routeId); });

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

  window.RD.screen("atCustomer", function (p) {
    const route = routeOr404(p.routeId);
    const stop = D.getStops(p.routeId).find(function (s) { return s.id === p.stopId; });
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const detail = stopOr404(p.routeId, p.stopId);
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
            return '<div style="' + U.sty({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderTop: "1px solid #f5f5f5" }) + '">' +
              '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
                '<div style="' + U.sty({ fontSize: 14, color: "#111", fontWeight: 600 }) + '">' + U.esc(it.productName) + "</div>" +
                '<div style="' + U.sty({ fontSize: 11, color: "#888", marginTop: 2 }) + '">₹' + (it.unitPrice || 0) +
                  (avail > 0 && !atMax ? " · " + avail + " loaded" : "") +
                  (atMax ? " ⚠️ Max " + avail : "") +
                  (out ? ' <span style="color:#ef4444">· Out of stock</span>' : "") + "</div>" +
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

    const footer = !canCollect
      ? '<div style="' + U.sty({ padding: "14px 16px", background: "#f0fdf4", borderRadius: 16, textAlign: "center", fontWeight: 700, color: "#16a34a", fontSize: 15, marginBottom: 10 }) + '">✓ Payment already collected</div>' +
        '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
          U.BtnSm({ variant: "grey", label: "↩ Return", actName: "goto-returns", arg: p.routeId }) +
          U.BtnSm({ variant: "grey", label: "📦 Assets", actName: "goto-assets", arg: stop.customerId }) + "</div>"
      : (editing ? "" : U.BtnXL({ variant: "green", label: "💰 Collect " + U.inr(totalDue), style: { marginBottom: 10 }, actName: "goto-payment", arg: p.stopId })) +
        '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
          U.BtnSm({ variant: editing ? "brand" : "green", label: editing ? "✓ Done Editing" : "✏️ Edit Order", actName: "toggle-edit" }) +
          (editing ? "" : U.BtnSm({ variant: "red", label: "Skip Stop →", actName: "goto-skip", arg: p.stopId })) +
        "</div>";

    return U.ProgressBar({ collected: collectedFor(p.routeId), backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        card +
        (editing ? '<div style="margin:0 12px 8px">' + U.SearchInput({ value: S.editSearch || "", model: "edit-search", placeholder: "Search products…", clearAct: "edit-search-clear" }) + "</div>" : "") +
        orderCard + emptyOrder + U.Spacer(8) +
      "</div>" +
      U.ActionBar(footer);
  });

  window.RD.action("toggle-edit", function () {
    const S = window.RD.state.scratch;
    if (S.editing) {
      // Persist through the service so the change survives navigation, exactly
      // as saveOrderEdits does upstream.
      SDK.routeDelivery.updateStopItems({
        routeId: window.RD.state.routeId, stopId: window.RD.state.stopId,
        items: S.items.filter(function (i) { return i.qty > 0; }),
      });
      S.items = null; S.editing = false;
      window.RD.toast("Order updated");
    } else { S.editing = true; }
    window.RD.render();
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
  window.RD.action("goto-payment", function (stopId) { window.RD.go("/payment/" + window.RD.state.routeId + "/" + stopId); });
  window.RD.action("goto-skip", function (stopId) { window.RD.go("/skip-stop/" + window.RD.state.routeId + "/" + stopId); });
  window.RD.action("goto-returns", function (routeId) { window.RD.go("/return-acceptance/" + routeId); });
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
    const totalDue = M.roundMoney((stop.outstandingAmount || 0) + orderSum);

    if (S.payAmount === undefined) { S.payAmount = String(totalDue); S.payPrefilled = true; S.payMethod = "CASH"; }
    const display = M.formatPaymentDisplay(S.payAmount);
    const method = S.payMethod || "CASH";
    const methodLabel = method === "CASH" ? "Cash" : "UPI";
    const confirming = !!S.payConfirming;
    const presets = M.buildPaymentPresets(totalDue);

    const methods = '<div style="' + U.sty({ display: "flex", gap: 8, padding: "0 16px", marginBottom: 2, flexShrink: 0 }) + '">' +
      M.PAYMENT_METHOD_OPTIONS.map(function (m) {
        const on = method === m.key;
        return '<button type="button" class="rd-chip"' + U.act("pay-method", m.key) + ' style="' + U.sty({
          flex: 1, padding: "10px 8px", textAlign: "center", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
          border: "2px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#e8f5f7" : "white", color: on ? U.BRAND : "#555",
        }) + '">' + m.label + "</button>";
      }).join("") + "</div>";

    const presetRow = '<div class="rd-noscrollbar" style="' + U.sty({ display: "flex", gap: 8, padding: "6px 16px 6px", overflowX: "auto", flexShrink: 0 }) + '">' +
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
        })
      : U.BtnXL({ variant: "green", label: "✅ Collect ₹" + display + " " + methodLabel, actName: "pay-confirm" });

    return U.MobileHeader({ title: "Collect Payment", subtitle: stop.customerName, backLabel: "Customer", backAct: "back" }) +
      '<div style="' + U.sty({ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: U.BG, opacity: confirming ? 0.35 : 1, pointerEvents: confirming ? "none" : "auto" }) + '">' +
        '<div style="' + U.sty({ padding: "8px 16px 4px", textAlign: "center", flexShrink: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 13, color: "#888", marginBottom: 2 }) + '">Total Due</div>' +
          '<div style="' + U.sty({ fontSize: 38, fontWeight: 800, color: "#111", lineHeight: 1.1 }) + '">' +
            '<span style="' + U.sty({ fontSize: 20, fontWeight: 700, color: "#888", verticalAlign: "super" }) + '">₹</span>' + U.esc(display) + "</div></div>" +
        U.SectionHeader("Payment Method") + methods + presetRow +
        '<div style="' + U.sty({ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", paddingBottom: 8 }) + '">' +
          U.NumPad("pay-key", { flex: 1, minHeight: 0 }) + "</div>" +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  window.RD.action("pay-key", function (k) {
    const S = window.RD.state.scratch;
    S.payAmount = M.applyNumpadKey(S.payAmount || "", k, S.payPrefilled);
    S.payPrefilled = false;
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
  window.RD.action("pay-confirm", function () {
    const S = window.RD.state.scratch;
    const stop = D.getStops(window.RD.state.routeId).find(function (s) { return s.id === window.RD.state.stopId; });
    const det = D.resolveStopDetail(window.RD.state.routeId, window.RD.state.stopId);
    const orderSum = (det.orderItems || []).reduce(function (a, it) { return a + (it.lineTotal != null ? it.lineTotal : it.qty * (it.unitPrice || 0)); }, 0);
    const totalDue = M.roundMoney((stop.outstandingAmount || 0) + orderSum);
    const check = V.validatePayment({ amount: Number(S.payAmount), totalDue: totalDue, method: S.payMethod || "CASH" });
    if (!check.valid) {
      window.RD.toast(check.errors.amount || check.errors.method || "Check the amount", "error");
      return;
    }
    S.payConfirming = true; window.RD.render();
  });
  window.RD.action("pay-commit", function (stopId) {
    const S = window.RD.state.scratch;
    const routeId = window.RD.state.routeId;
    SDK.routeDelivery.collectPayment({
      routeId: routeId, stopId: stopId,
      amount: Number(S.payAmount), method: S.payMethod || "CASH", sendInvoice: false,
    });
    S.payConfirming = false;
    window.RD.go("/payment-success/" + routeId + "/" + stopId);
  });

  /* ══ Payment Success ═══════════════════════════════════════════════════ */

  window.RD.screen("paymentSuccess", function (p) {
    const stop = D.getStops(p.routeId).find(function (s) { return s.id === p.stopId; });
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const S = window.RD.state.scratch;
    const methodLabel = stop.paymentMethod === "UPI" ? "UPI" : "Cash";
    const sheet = !!S.printOpen;

    const receipt = sheet ? PrintSheet(p, stop) : "";

    return '<div class="rd-body" style="' + U.sty({ background: U.BG, display: "flex", flexDirection: "column" }) + '">' +
        '<div style="' + U.sty({ padding: "40px 24px 24px", textAlign: "center" }) + '">' +
          '<div style="' + U.sty({ fontSize: 56, marginBottom: 12 }) + '">✅</div>' +
          '<div style="' + U.sty({ fontSize: 24, fontWeight: 800, color: "#111" }) + '">Payment Collected!</div>' +
          '<div style="' + U.sty({ fontSize: 17, fontWeight: 700, color: "#16a34a", marginTop: 8 }) + '">' + U.inr(stop.collectedAmount) + " " + methodLabel + " · " + U.esc(stop.customerName) + "</div>" +
        "</div>" +
        U.Card(
          '<div style="' + U.sty({ fontSize: 14, color: "#555", marginBottom: 12, textAlign: "center" }) + '">Share receipt with customer?</div>' +
          '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
            U.BtnSm({ variant: "green", label: "📲 WhatsApp", actName: "share-whatsapp" }) +
            U.BtnSm({ variant: "grey", label: "🖨 Print Receipt", actName: "print-open" }) +
          "</div>"
        ) +
        receipt +
        U.Spacer(12) +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: "brand", label: "Move to Delivery Stops →", actName: "back-to-queue", arg: p.routeId }));
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
    const dash = size === "58mm" ? "--------------------------------" : "------------------------------------------";

    const lines = (detail.orderItems || []).map(function (it) {
      const amt = it.lineTotal != null ? it.lineTotal : it.qty * (it.unitPrice || 0);
      return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", gap: 6 }) + '">' +
        '<span style="' + U.sty({ flex: 1, minWidth: 0, wordBreak: "break-word" }) + '">' + U.esc(it.productName || it.name) + "</span>" +
        "<span>" + it.qty + "</span><span>" + (it.unitPrice || 0).toFixed(2) + "</span><span>Rs" + amt.toFixed(2) + "</span></div>";
    }).join("");

    const now = new Date();
    const billNo = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + String(stop.id).replace(/\D/g, "").slice(-8);

    return U.Card(
      U.CardTitle("🖨 Print Receipt") +
      '<div style="' + U.sty({ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }) + '">Printer Type</div>' +
      '<div style="' + U.sty({ display: "flex", gap: 8, marginBottom: 12 }) + '">' +
        [["USB", "🖥 USB"], ["Bluetooth", "📶 Bluetooth"]].map(function (t) {
          const on = type === t[0];
          return '<button type="button" class="rd-chip"' + U.act("printer-type", t[0]) + ' style="' + U.sty({
            flex: 1, padding: "10px 8px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
            border: "2px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#e8f5f7" : "white", color: on ? U.BRAND : "#555",
          }) + '">' + t[1] + "</button>";
        }).join("") + "</div>" +
      '<div style="' + U.sty({ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }) + '">Printer Device</div>' +
      '<div style="' + U.sty({ padding: "12px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, fontSize: 13, color: "#6b7280", marginBottom: 8 }) + '">No printer connected</div>' +
      '<div style="margin-bottom:12px">' + U.BtnSm({ variant: "grey", label: "Connect " + type + " Printer", actName: "printer-connect" }) + "</div>" +
      '<div style="' + U.sty({ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }) + '">Paper Size</div>' +
      '<div style="' + U.sty({ display: "flex", gap: 8, marginBottom: 12 }) + '">' +
        [["58mm", "58mm (2 inch)"], ["80mm", "80mm (3.2 inch)"]].map(function (t) {
          const on = size === t[0];
          return '<button type="button" class="rd-chip"' + U.act("paper-size", t[0]) + ' style="' + U.sty({
            flex: 1, padding: "10px 8px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer",
            border: "2px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#e8f5f7" : "white", color: on ? U.BRAND : "#555",
          }) + '">' + t[1] + "</button>";
        }).join("") + "</div>" +
      '<div style="' + U.sty({ fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 6 }) + '">Receipt Preview</div>' +
      '<div style="' + U.sty({ fontSize: 11, color: "#888", marginBottom: 4 }) + '">' + size.replace("mm", " mm") + "</div>" +
      '<div style="' + U.sty({
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", background: "white",
        border: "1px dashed #cbd5e1", borderRadius: 8, padding: 12,
        maxWidth: size === "58mm" ? 232 : 300, margin: "0 auto", fontSize: 10, color: "#111",
        whiteSpace: "pre-wrap", overflowX: "auto",
      }) + '">' +
        '<div style="text-align:center;font-weight:700">Invoice</div>' + dash +
        '<div>Date : ' + now.toLocaleDateString("en-GB").replace(/\//g, "/") + ", " + now.toLocaleTimeString("en-GB") + "</div>" +
        "<div>Customer: " + U.esc(stop.customerName) + "</div>" +
        "<div>Bill No : " + billNo + "</div>" +
        "<div>Payment : " + (stop.paymentMethod === "UPI" ? "UPI" : "Cash") + "</div>" + dash +
        '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", gap: 6, fontWeight: 700 }) + '">' +
          '<span style="flex:1">Item</span><span>Qty</span><span>Rate</span><span>Amt</span></div>' + dash +
        lines + dash +
        '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", fontWeight: 700 }) + '"><span>Paid</span><span>Rs' + Number(stop.collectedAmount || 0).toFixed(2) + "</span></div>" +
      "</div>" +
      '<div style="' + U.sty({ display: "flex", gap: 10, marginTop: 12 }) + '">' +
        U.BtnSm({ variant: "grey", label: "Cancel", actName: "print-close" }) +
        U.BtnSm({ variant: "brand", label: "🖨 Print", actName: "print-do" }) +
      "</div>"
    );
  }

  window.RD.action("print-open", function () { window.RD.state.scratch.printOpen = true; window.RD.render(); });
  window.RD.action("print-close", function () { window.RD.state.scratch.printOpen = false; window.RD.render(); });
  window.RD.action("printer-type", function (t) { window.RD.state.scratch.printerType = t; window.RD.render(); });
  window.RD.action("printer-connect", function () {
    // No hardware in a browser; QA shows the same "not connected" state.
    window.RD.toast("No printer found — connect one from the device settings", "error");
  });
  window.RD.action("print-do", function () { window.RD.toast("Receipt sent to printer"); });
  window.RD.action("paper-size", function (t) { window.RD.state.scratch.paper = t; window.RD.render(); });
  window.RD.action("share-whatsapp", function () { window.RD.toast("Receipt shared on WhatsApp"); });
  window.RD.action("back-to-queue", function (routeId) { window.RD.go("/queue/" + routeId); });

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

    const grid = '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 12px" }) + '">' +
      SKIP_REASONS.map(function (r) {
        const on = S.skipReason === r.key;
        return '<button type="button" class="rd-chip"' + U.act("skip-reason", r.key) + ' style="' + U.sty({
          padding: "16px 12px", borderRadius: 14, fontSize: 14, fontWeight: 600, cursor: "pointer",
          border: "2px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#e8f5f7" : "white",
          color: on ? U.BRAND : "#111", textAlign: "center",
        }) + '"><div style="font-size:22px;margin-bottom:4px">' + r.icon + "</div>" + r.label + "</button>";
      }).join("") + "</div>";

    // No subtitle: the customer's name is already the back label, and repeating
    // it under the question reads as a stutter. Matches the reference.
    return U.MobileHeader({ title: "Why no delivery?", backLabel: stop.customerName, backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        U.SectionHeader("Select Reason") + grid + U.Spacer(12) +
        '<div style="padding:0 12px;margin-top:8px">' +
          '<label style="' + U.sty({ fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6, display: "block" }) + '">Note (optional)</label>' +
          '<textarea data-model="skip-note" placeholder="Add a note for the office…" style="' + U.sty({
            width: "100%", minHeight: 90, padding: 12, borderRadius: 12, border: "1.5px solid #e5e7eb",
            fontSize: 14, fontFamily: "inherit", color: "#111", resize: "vertical",
          }) + '">' + U.esc(S.skipNote || "") + "</textarea></div>" +
        U.Spacer(12) +
      "</div>" +
      U.ActionBar(U.BtnXL({
        variant: "red", label: "Skip This Stop",
        disabled: !S.skipReason, actName: "skip-commit", arg: p.stopId,
      }));
  });

  window.RD.action("skip-reason", function (r) { window.RD.state.scratch.skipReason = r; window.RD.render(); });
  window.RD.action("model:skip-note", function (v) { window.RD.state.scratch.skipNote = v; });
  window.RD.action("skip-commit", function (stopId) {
    const S = window.RD.state.scratch;
    const check = V.validateSkipStop({ reason: S.skipReason, note: S.skipNote });
    if (!check.valid) { window.RD.toast(check.errors.reason || "Pick a reason", "error"); return; }
    const routeId = window.RD.state.routeId;
    SDK.routeDelivery.skipStop({ routeId: routeId, stopId: stopId, reason: S.skipReason, note: S.skipNote });
    window.RD.toast("Stop skipped · follow-up created");
    window.RD.go("/queue/" + routeId);
  });

  /* ══ Add New Customer ══════════════════════════════════════════════════ */

  window.RD.screen("newCustomer", function (p) {
    const S = window.RD.state.scratch;
    if (!S.newItems) S.newItems = {};
    const stockMap = bookingStockMap(p.routeId);
    const load = D.db.stockLoads[p.routeId];
    const products = ((load && load.products) || []).filter(function (pr) { return (stockMap[pr.productId] || 0) > 0; });
    const search = (S.newSearch || "").trim().toLowerCase();
    const shown = products.filter(function (pr) { return !search || pr.name.toLowerCase().indexOf(search) !== -1; });

    const total = Object.keys(S.newItems).reduce(function (a, pid) {
      const pr = products.find(function (x) { return x.productId === pid; });
      return a + (pr ? (S.newItems[pid] || 0) * pr.unitPrice : 0);
    }, 0);

    const rows = shown.map(function (pr) {
      const qty = S.newItems[pr.productId] || 0;
      const avail = stockMap[pr.productId] || 0;
      return '<div style="' + U.sty({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 16px", borderTop: "1px solid #f5f5f5" }) + '">' +
        '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 14, color: "#111", fontWeight: 600 }) + '">' + U.esc(pr.name) + "</div>" +
          '<div style="' + U.sty({ fontSize: 11, color: "#888", marginTop: 2 }) + '">₹' + pr.unitPrice + " · " + avail + " available</div>" +
        "</div>" +
        U.StepperInput({ value: qty, small: true, max: avail, arg: pr.productId, decAct: "new-dec", incAct: "new-inc", model: "new-" + pr.productId }) +
        "</div>";
    }).join("");

    return U.MobileHeader({ title: "New Customer", subtitle: "Discovered on route · Auto-added to beat", backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        U.Card(
          '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 6 }) + '">Shop Name *</div>' +
          '<input data-model="new-shop" value="' + U.esc(S.newShop || "") + '" placeholder="e.g. Ravi General Store" style="' + U.sty({ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit", marginBottom: 12 }) + '" />' +
          '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#888", marginBottom: 6 }) + '">Owner Phone *</div>' +
          '<input data-model="new-phone" inputmode="numeric" value="' + U.esc(S.newPhone || "") + '" placeholder="10-digit mobile number" style="' + U.sty({ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e5e7eb", fontSize: 14, fontFamily: "inherit" }) + '" />'
        ) +
        U.SectionHeader("Quick Order") +
        '<div style="padding:0 12px 8px">' + U.SearchInput({ value: S.newSearch || "", model: "new-search", placeholder: "Search products…", clearAct: "new-search-clear" }) + "</div>" +
        '<div style="' + U.sty({ background: "white", borderRadius: 14, margin: "0 12px 10px", overflow: "hidden" }) + '">' + (rows || '<div style="padding:24px;text-align:center;color:#888;font-size:14px">No stock available to order</div>') + "</div>" +
        U.Card('<div style="' + U.sty({ display: "flex", justifyContent: "space-between", fontSize: 15 }) + '"><span style="font-weight:700">Order Total</span><span style="font-weight:800">' + U.inr(total) + "</span></div>") +
        U.Spacer(12) +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: "green", label: "Add Customer & Order →", actName: "new-commit", arg: p.routeId }));
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
      window.RD.toast(first, "error");
      return;
    }
    const res = SDK.routeDelivery.addNewStop({
      routeId: routeId, shopName: S.newShop, ownerPhone: S.newPhone, orderItems: items,
    }).data;
    window.RD.toast(S.newShop + " added to the route");
    window.RD.go("/delivery/" + routeId + "/" + res.stop.id);
  });

  /* ══ Stop Summary ══════════════════════════════════════════════════════ */

  window.RD.screen("stopSummary", function (p) {
    const stop = D.getStops(p.routeId).find(function (s) { return s.id === p.stopId; });
    if (!stop) throw new Error("Stop " + p.stopId + " not found");
    const detail = stopOr404(p.routeId, p.stopId);
    const skipped = stop.status === "SKIPPED";
    const fully = !skipped && (stop.outstandingAmount || 0) === 0;

    const badge = skipped
      ? '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }) + '">✕ SKIPPED · ' + U.esc(stop.skipReason || "") + "</div>"
      : '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, color: fully ? "#16a34a" : "#f97316", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }) + '">' +
        (fully ? "✓✓ FULLY COLLECTED" : "✓ PARTIAL") + (stop.completedAt ? " · " + U.esc(M.formatRouteTime(stop.completedAt, { hour12: false })) : "") + "</div>";

    const items = (detail.orderItems || []).map(function (it, i, arr) {
      return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 14, marginBottom: i < arr.length - 1 ? 8 : 0 }) + '">' +
        '<div style="' + U.sty({ color: "#555", flex: 1, minWidth: 0 }) + '">' + U.esc(it.productName || it.name) + " × " + it.qty + "</div>" +
        '<span style="font-weight:700">' + rawInr(it.qty * (it.unitPrice || 0)) + "</span></div>";
    }).join("");

    return U.ProgressBar({ collected: collectedFor(p.routeId), backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        '<div style="' + U.sty({ margin: 12, background: "white", borderRadius: 20, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }) + '">' +
          badge +
          '<div style="' + U.sty({ fontSize: 22, fontWeight: 800, color: "#111", lineHeight: 1.2 }) + '">' + U.esc(stop.customerName) + "</div>" +
          (detail.customer && detail.customer.address ? '<div style="' + U.sty({ fontSize: 13, color: "#888", marginTop: 4 }) + '">📍 ' + U.esc(detail.customer.address) + "</div>" : "") +
          (skipped ? "" :
            '<div style="' + U.sty({ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }) + '">' +
              "<div>" +
                '<div style="' + U.sty({ fontSize: 12, color: "#888", fontWeight: 600, textTransform: "uppercase" }) + '">Collected</div>' +
                '<div style="' + U.sty({ fontSize: 30, fontWeight: 800, color: "#16a34a", lineHeight: 1 }) + '">' + U.inr(stop.collectedAmount) + "</div>" +
              "</div>" +
              (detail.customer && detail.customer.phone ? '<a href="tel:' + U.esc(detail.customer.phone) + '" class="rd-pressable" style="' + U.sty({ padding: "10px 14px", background: "#f0f2f5", borderRadius: 12, fontSize: 22, textDecoration: "none" }) + '">📞</a>' : "") +
            "</div>") +
        "</div>" +
        (items ? U.Card(U.CardTitle("Today's Order") + items) : "") +
        U.Card(
          U.SettleRow("Outstanding before", U.inr((stop.outstandingAmount || 0) + (stop.collectedAmount || 0) - (stop.todayOrderAmount || 0) > 0 ? (stop.outstandingAmount || 0) + (stop.collectedAmount || 0) - (stop.todayOrderAmount || 0) : 0)) +
          U.SettleRow("Today's order", U.inr(stop.todayOrderAmount || 0)) +
          U.SettleRow("Collected", U.inr(stop.collectedAmount || 0), "#16a34a") +
          U.SettleRow("Still outstanding", U.inr(stop.outstandingAmount || 0), (stop.outstandingAmount || 0) > 0 ? "#ef4444" : "#16a34a", true)
        ) +
        U.Spacer(12) +
      "</div>" +
      U.ActionBar('<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
        U.BtnSm({ variant: "grey", label: "↩ Return", actName: "goto-returns", arg: p.routeId }) +
        U.BtnSm({ variant: "grey", label: "📦 Assets", actName: "goto-assets", arg: stop.customerId }) +
        U.BtnSm({ variant: "brand", label: "Back to Stops", actName: "back-to-queue", arg: p.routeId }) +
      "</div>");
  });
})();

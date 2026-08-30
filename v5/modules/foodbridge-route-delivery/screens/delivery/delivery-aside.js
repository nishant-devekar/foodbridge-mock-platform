/* ==========================================================================
   DELIVERY MANAGEMENT — the side flows

   Things that interrupt the delivery loop rather than following it:

     Restock In Progress  pages/RestockInProgress.jsx
     Restock Load         pages/RestockLoad.jsx
     Restock Success      pages/RestockSuccess.jsx
     Manage Assets        pages/ManageAssets.jsx
     Return Acceptance    pages/ReturnAcceptance.jsx

   Restock is a pause, not a stop: the route holds at RESTOCKING while the van
   drives back, takes on more stock, and resumes where it left off. Returns and
   assets both move goods the other way — returned product re-enters van stock,
   and crates/trays are tracked per customer as a running balance.
   ========================================================================== */

(function () {
  "use strict";

  const U = window.RD_UI, D = window.RD_DB, SDK = window.RD_SDK, M = window.RD_MODELS;

  function rawInr(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

  function routeOr404(routeId) {
    const r = D.db.routeDetails[routeId];
    if (!r) throw new Error("Route " + routeId + " not found");
    return r;
  }

  /* ══ Restock In Progress ═══════════════════════════════════════════════ */

  window.RD.screen("restock", function (p) {
    const route = routeOr404(p.routeId);
    const stops = D.getStops(p.routeId);
    const delivered = stops.filter(function (s) { return s.status === "DELIVERED"; }).length;
    const pending = stops.filter(function (s) { return s.status === "PENDING" || s.status === "CURRENT"; });
    const collected = stops.reduce(function (a, s) { return a + (s.collectedAmount || 0); }, 0);

    const stats = '<div style="' + U.sty({ display: "flex", gap: 6, margin: "8px 12px" }) + '">' +
      [
        { num: delivered, label: "Delivered", color: U.BRAND },
        { num: pending.length, label: "Pending", color: "#c2410c" },
        { num: U.inr(collected), label: "Collected", color: U.BRAND },
      ].map(function (s) {
        return '<div style="' + U.sty({ flex: 1, textAlign: "center", padding: "8px 4px", background: "white", borderRadius: 8, border: "1px solid #e5e7eb" }) + '">' +
          '<div style="' + U.sty({ fontSize: 18, fontWeight: 800, color: s.color }) + '">' + U.esc(s.num) + "</div>" +
          '<div style="' + U.sty({ fontSize: 9, color: "#9ca3af", marginTop: 1, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.04em" }) + '">' + s.label + "</div></div>";
      }).join("") + "</div>";

    // QA's Restock In Progress ends at the warehouse card: it does not list
    // the stops that are waiting. (An earlier pass added such a list.)

    return '<div style="' + U.sty({ background: U.BRAND, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }) + '">' +
        "<div>" +
          '<div style="' + U.sty({ fontSize: 17, fontWeight: 700, color: "white" }) + '">Restock In Progress</div>' +
          '<div style="' + U.sty({ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }) + '">Route: ' + U.esc(route.name) + "</div>" +
        "</div>" +
        '<div style="' + U.sty({ display: "flex", alignItems: "center", gap: 8 }) + '">' +
          '<div style="' + U.sty({ fontSize: 11, background: "rgba(255,255,255,0.18)", color: "white", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }) + '">🔄 Paused</div>' +
          U.HomeMenuButton() +
        "</div>" +
      "</div>" + U.HomeConfirm() +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        '<div style="' + U.sty({ margin: "10px 12px 4px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "7px 12px", display: "flex", alignItems: "center", gap: 7 }) + '">' +
          '<span style="' + U.sty({ width: 8, height: 8, background: "#c2410c", borderRadius: "50%", flexShrink: 0, display: "inline-block" }) + '"></span>' +
          '<span style="' + U.sty({ fontSize: 12, fontWeight: 600, color: "#c2410c" }) + '">Delivery paused · En route to warehouse</span></div>' +
        stats +
        '<div style="' + U.sty({ background: U.BRAND, borderRadius: 12, padding: 14, margin: "6px 12px", display: "flex", alignItems: "flex-start", gap: 10 }) + '">' +
          '<span style="' + U.sty({ fontSize: 24, flexShrink: 0 }) + '">🏭</span>' +
          '<div style="' + U.sty({ color: "white" }) + '">' +
            '<div style="' + U.sty({ fontSize: 14, fontWeight: 700, marginBottom: 3 }) + '">Drive to warehouse</div>' +
            '<div style="' + U.sty({ fontSize: 11, lineHeight: 1.4, opacity: 0.8 }) + '">Load additional stock to resume delivery for ' + pending.length + " remaining customer" + (pending.length !== 1 ? "s" : "") + ".</div>" +
          "</div></div>" +
        // The stops still waiting are listed under the warehouse card.
        (pending.length
          ? '<div style="' + U.sty({ padding: "6px 12px 3px", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }) + '">Stops Waiting For You</div>' +
            pending.map(function (st) {
              const initials = String(st.customerName || "?").slice(0, 2).toUpperCase();
              return '<div style="' + U.sty({ display: "flex", alignItems: "center", padding: "11px 16px", background: "white", borderBottom: "1px solid #f0f0f0", gap: 12 }) + '">' +
                '<div style="' + U.sty({ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: "#fff7ed", color: "#c2410c" }) + '">' + U.esc(initials) + "</div>" +
                '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
                  '<div style="' + U.sty({ fontSize: 14, fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(st.customerName) + "</div>" +
                  (st.outstandingAmount > 0
                    ? '<div style="' + U.sty({ fontSize: 12, color: "#c2410c", marginTop: 1, fontWeight: 500 }) + '">' + U.inr(st.outstandingAmount) + " outstanding</div>"
                    : "") +
                "</div>" +
                '<div style="' + U.sty({ width: 7, height: 7, background: "#d1d5db", borderRadius: "50%", flexShrink: 0 }) + '"></div>' +
              "</div>";
            }).join("")
          : "") +
        U.Spacer(16) +
      "</div>" +
      // QA offers one action here, not two.
      U.ActionBar(U.BtnXL({ variant: "green", label: "📦 Load Additional Stock", actName: "restock-load-go", arg: p.routeId }));
  });

  window.RD.action("restock-load-go", function (routeId) {
    // Pausing is what puts the route into RESTOCKING; the queue's Restock button
    // lands here first, so the pause happens on the way to the load screen.
    if (D.db.routeDetails[routeId].status !== "RESTOCKING") SDK.routeDelivery.pauseForRestock({ routeId: routeId });
    window.RD.go("/restock-load/" + routeId);
  });
  window.RD.action("restock-resume", function (routeId) {
    SDK.routeDelivery.resumeFromRestock({ routeId: routeId });
    window.RD.go("/queue/" + routeId);
  });

  /* ══ Restock Load ══════════════════════════════════════════════════════ */

  window.RD.screen("restockLoad", function (p) {
    const route = routeOr404(p.routeId);
    const S = window.RD.state.scratch;
    const load = D.db.stockLoads[p.routeId];
    const products = (load && load.products) || [];
    if (!S.restockQtys) S.restockQtys = products.map(function () { return 0; });

    const stops = D.getStops(p.routeId);
    const deliveredCount = stops.filter(function (s) { return s.status === "DELIVERED"; }).length;
    const pendingCount = stops.filter(function (s) { return s.status === "PENDING" || s.status === "CURRENT"; }).length;
    const addUnits = S.restockQtys.reduce(function (a, q) { return a + (Number(q) || 0); }, 0);
    const addValue = products.reduce(function (a, pr, i) { return a + (Number(S.restockQtys[i]) || 0) * pr.unitPrice; }, 0);
    const addedProducts = products.filter(function (pr, i) { return (Number(S.restockQtys[i]) || 0) > 0; });
    const search = (S.restockSearch || "").trim().toLowerCase();
    const rows = products.map(function (pr, i) { return { pr: pr, i: i }; })
      .filter(function (r) { return !search || r.pr.name.toLowerCase().indexOf(search) !== -1; });

    // QA's five columns: PRODUCT | LOADED | DELIVERED | ON TRUCK | ADD NOW.
    // The header is brand-coloured and sticks to the top, the product column
    // sticks to the left with a shadow, and ADD NOW is a plain blue field —
    // no stepper, because a restock is typed in bulk, not tapped up one by one.
    const GRID = "1fr 52px 62px 62px 64px";
    const stickyCell = function (bg, z, extra) {
      return U.mix({ position: "sticky", left: 0, zIndex: z, background: bg, boxShadow: "8px 0 8px -10px rgba(0,0,0," + (z > 5 ? "0.45" : "0.35") + ")" }, extra);
    };
    const head = '<div style="' + U.sty({ display: "grid", gridTemplateColumns: GRID, gap: 4, alignItems: "center", minWidth: 500, padding: "10px 14px", background: U.BRAND, position: "sticky", top: 0, zIndex: 5 }) + '">' +
      // "On\nTruck" is a hard line break in QA, held by white-space: pre-line —
      // the column is deliberately two lines tall, which sets the header height.
      ["Product", "Loaded", "Delivered", "On\nTruck", "Add Now"].map(function (h, i) {
        const base = {
          fontSize: 11, lineHeight: 1.2, fontWeight: 700, letterSpacing: "0.03em",
          color: i === 3 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.9)",
          textTransform: "uppercase", textAlign: i === 0 ? "left" : "center",
          whiteSpace: "pre-line",
        };
        return '<div style="' + U.sty(i === 0 ? stickyCell(U.BRAND, 7, base) : base) + '">' + h + "</div>";
      }).join("") + "</div>";

    const body = rows.map(function (r) {
      const sold = Math.round(r.pr.loadedQty * (deliveredCount / Math.max(stops.length, 1)));
      const onTruck = Math.max(0, r.pr.loadedQty - sold);
      const qty = Number(S.restockQtys[r.i]) || 0;
      return '<div style="' + U.sty({ display: "grid", gridTemplateColumns: GRID, gap: 4, alignItems: "center", minWidth: 500, padding: "13px 14px", background: "white", borderBottom: "1px solid #f5f5f5" }) + '">' +
        '<div style="' + U.sty(stickyCell("white", 2, { fontSize: 14, lineHeight: 1.25, fontWeight: 600, color: "#111" })) + '">' + U.esc(r.pr.name) + "</div>" +
        '<div style="' + U.sty({ textAlign: "center", fontSize: 14, fontWeight: 400, color: "#6b7280" }) + '">' + r.pr.loadedQty + "</div>" +
        '<div style="' + U.sty({ textAlign: "center", fontSize: 14, fontWeight: 400, color: "#6b7280" }) + '">' + sold + "</div>" +
        '<div style="' + U.sty({ textAlign: "center", fontSize: 14, fontWeight: 600, color: onTruck === 0 ? "#dc2626" : "#6b7280" }) + '">' + onTruck + "</div>" +
        '<input inputmode="numeric" data-model="restock-' + r.i + '" value="' + (qty ? qty : "") + '" style="' + U.sty({
          width: "100%", boxSizing: "border-box", padding: 8, fontSize: 15, fontWeight: 700, textAlign: "center",
          color: "#1d4ed8", background: "#eff6ff", border: "2px solid #93c5fd", borderRadius: 10, outline: "none", fontFamily: "inherit",
        }) + '" /></div>';
    }).join("");

    const confirming = !!S.restockConfirming;
    const footer = confirming
      ? U.ConfirmPanel({
          action: "Restock #" + ((load && load.restockCount ? load.restockCount : 0) + 1),
          amount: addUnits + " units",
          context: U.inr(addValue) + " estimated value · " + addedProducts.length + " product" + (addedProducts.length === 1 ? "" : "s"),
          backLabel: "Edit Quantities", commitLabel: "Confirm Load",
          commitAct: "restock-commit", arg: p.routeId,
          processing: !!S.committing, processingLabel: "Loading additional stock…",
          extra: '<div style="' + U.sty({ background: "#f8fafc", borderRadius: 10, border: "1px solid #e9eef2", overflow: "hidden", maxHeight: 140, overflowY: "auto", marginBottom: 12 }) + '">' +
            addedProducts.map(function (pr, i) {
              const qty = S.restockQtys[products.indexOf(pr)] || 0;
              return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: i < addedProducts.length - 1 ? "1px solid #f1f5f9" : "none" }) + '">' +
                '<span style="' + U.sty({ fontSize: 13, color: "#374151", flex: 1, minWidth: 0 }) + '">' + U.esc(pr.name) + "</span>" +
                '<span style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#374151" }) + '">× ' + qty + "</span></div>";
            }).join("") + "</div>" +
            '<div style="' + U.sty({ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#6b7280", marginTop: 10 }) + '">' +
              "<span>" + pendingCount + " stops waiting</span><span>" +
              (products.reduce(function (t, pr, i) {
                const sold = Math.round(pr.loadedQty * (deliveredCount / Math.max(stops.length, 1)));
                return t + Math.max(0, pr.loadedQty - sold) + (Number(S.restockQtys[i]) || 0);
              }, 0)) + " units available after load</span></div>",
        })
      : U.BtnXL({ variant: addUnits === 0 ? "grey" : "brand", label: addUnits === 0 ? "Confirm Restock" : "Confirm Restock · " + addUnits + " Unit" + (addUnits === 1 ? "" : "s"), disabled: addUnits === 0, style: { opacity: addUnits === 0 ? 0.5 : 1 }, actName: "restock-confirm" });

    const restockNo = (load && load.restockCount ? load.restockCount : 0) + 1;
    // Not the shared MobileHeader: this screen has QA's own 56px bar with the
    // title and a "Restock #n" pill on one line.
    return '<div style="' + U.sty({ background: U.BRAND, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }) + '">' +
        '<button type="button"' + U.act("back") + ' style="' + U.sty({ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 16, lineHeight: 1, color: "rgba(255,255,255,0.75)", fontFamily: "inherit" }) + '">←</button>' +
        // The title takes the slack in the row, which is what puts the pill
        // hard against the home button rather than against the title.
        '<span style="' + U.sty({ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 700, color: "white" }) + '">Load Additional Stock</span>' +
        '<span style="' + U.sty({ fontSize: 11, fontWeight: 600, color: "white", background: "rgba(255,255,255,0.18)", borderRadius: 12, padding: "3px 10px" }) + '">Restock #' + restockNo + "</span>" +
        U.HomeMenuButton() +
      "</div>" + U.HomeConfirm() +
      '<div class="rd-body" style="' + U.sty({ background: "#f9fafb", opacity: confirming ? 0.4 : 1, pointerEvents: confirming ? "none" : "auto" }) + '">' +
        '<div style="padding:10px 14px 8px">' + U.SearchInput({ value: S.restockSearch || "", model: "restock-search", placeholder: "Search products…", clearAct: "restock-search-clear" }) + "</div>" +
        '<div style="' + U.sty({ background: "white", overflowX: "auto", WebkitOverflowScrolling: "touch" }) + '">' +
          '<div style="' + U.sty({ minWidth: 500 }) + '">' + head + body + "</div></div>" +
        // A green strip, not a line of text: QA totals the restock in place.
        '<div style="' + U.sty({ background: "#dcfce7", borderTop: "1.5px solid #86efac", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }) + '">' +
          '<span style="' + U.sty({ fontSize: 13, fontWeight: 600, color: U.GREEN }) + '">Total additional units:</span>' +
          '<span style="' + U.sty({ fontSize: 16, fontWeight: 800, color: U.GREEN }) + '">+' + addUnits + " units</span>" +
        "</div>" +
        U.Spacer(16) +
      "</div>" +
      (confirming ? U.FreezeBackdrop() : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  window.RD.action("restock-confirm", function () { window.RD.state.scratch.restockConfirming = true; window.RD.render(); });

  window.RD.action("restock-inc", function (i) { const S = window.RD.state.scratch; S.restockQtys[i] = (Number(S.restockQtys[i]) || 0) + 1; window.RD.render(); });
  window.RD.action("restock-dec", function (i) { const S = window.RD.state.scratch; S.restockQtys[i] = Math.max(0, (Number(S.restockQtys[i]) || 0) - 1); window.RD.render(); });
  window.RD.action("model:restock#", function (value, idx) {
    const S = window.RD.state.scratch;
    S.restockQtys[Number(idx)] = Number(String(value).replace(/\D/g, "")) || 0;
    window.RD.render();
    const el = document.querySelector('[data-model="restock-' + idx + '"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });

  window.RD.action("restock-search-clear", function () { window.RD.state.scratch.restockSearch = ""; window.RD.render(); });
  window.RD.action("model:restock-search", function (v) {
    window.RD.state.scratch.restockSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="restock-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("restock-commit", function (routeId) {
    window.RD.commit(function () {
      const S = window.RD.state.scratch;
      S.restockConfirming = false;
      const load = D.db.stockLoads[routeId];
      const products = (load && load.products) || [];
      const items = products.map(function (pr, i) {
        return { productId: pr.productId, name: pr.name, unitPrice: pr.unitPrice, loadedQty: pr.loadedQty + (Number(S.restockQtys[i]) || 0) };
      });
      const added = S.restockQtys.reduce(function (a, q) { return a + (Number(q) || 0); }, 0);
      SDK.routeDelivery.updateStockLoad({ routeId: routeId, items: items });
      window.RD.go("/restock-success/" + routeId);
      // Set after navigating: the router clears scratch on a route change.
      window.RD.state.scratch.restockAdded = added;
      window.RD.render();
    });
  });

  /* ══ Restock Success ═══════════════════════════════════════════════════ */

  window.RD.screen("restockSuccess", function (p) {
    const S = window.RD.state.scratch;
    const added = S.restockAdded || 0;
    const load = D.db.stockLoads[p.routeId];
    const available = ((load && load.products) || []).reduce(function (a, pr) { return a + pr.loadedQty; }, 0);
    const restockNo = (load && load.restockCount) || 1;
    const waitingCount = D.getStops(p.routeId).filter(function (st) { return st.status === "PENDING" || st.status === "CURRENT"; }).length;

    // QA's confirmation is a white full-height column with a soft-green disc,
    // an 18px headline and a bordered detail list — not a card on the grey app
    // background. The header is a bare title bar with the home button.
    const row = function (label, value, color, last) {
      return '<div style="' + U.sty({
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 16px", borderBottom: last ? "none" : "1px solid #f3f4f6",
      }) + '">' +
        '<span style="' + U.sty({ fontSize: 13, fontWeight: 400, color: "#6b7280" }) + '">' + label + "</span>" +
        '<span style="' + U.sty({ fontSize: 14, fontWeight: 700, color: color || "#111827" }) + '">' + value + "</span></div>";
    };

    return U.MobileHeader({ title: "Stock Loaded", onBack: false }) +
      '<div class="rd-body" style="' + U.sty({ background: "white", padding: "28px 20px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }) + '">' +
        '<div style="' + U.sty({ width: 64, height: 64, borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 6 }) + '">✅</div>' +
        '<div style="' + U.sty({ fontSize: 18, fontWeight: 800, color: "#111827", textAlign: "center" }) + '">Stock loaded successfully</div>' +
        '<div style="' + U.sty({ fontSize: 14, color: "#6b7280", textAlign: "center" }) + '">Restock #' + restockNo + ' confirmed. Your route is ready to continue.</div>' +
        // How many stops are still waiting, stated as a pill under the headline.
        (waitingCount > 0
          ? '<div style="' + U.sty({ background: "#d5e8f0", border: "1px solid #93c4d2", borderRadius: 20, padding: "6px 16px", fontSize: 13, fontWeight: 600, color: U.BRAND, marginTop: 4 }) + '">' +
              waitingCount + " stop" + (waitingCount !== 1 ? "s" : "") + " waiting · Resuming delivery</div>"
          : "") +
        '<div style="' + U.sty({ width: "100%", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, marginTop: 8, overflow: "hidden" }) + '">' +
          row("Restock event", "#" + restockNo, U.BRAND) +
          row("Units added", "+" + added + " units", U.GREEN) +
          row("Available now", available + " units", U.GREEN) +
          row("Time", M.formatRouteTime(), "#111827", true) +
        "</div>" +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: "green", label: "Go to Queue", actName: "restock-resume", arg: p.routeId }));
  });

  /* ══ Manage Assets ═════════════════════════════════════════════════════ */
  // Crates, trays and other returnable packaging, tracked as a running balance
  // per customer. Giving adds to what they hold, taking subtracts.

  const ASSETS = [
    { _id: "AST-CRATE-L", name: "Crate — Large (24 bottle)" },
    { _id: "AST-CRATE-S", name: "Crate — Small (12 bottle)" },
    { _id: "AST-TRAY",    name: "Bread Tray" },
    { _id: "AST-ICEBOX",  name: "Insulated Ice Box" },
    { _id: "AST-PALLET",  name: "Plastic Pallet" },
  ];

  // What each customer already holds. Mutated by recordBatchTransactions so a
  // second visit shows the new position — the point of the arithmetic on screen.
  const HELD = {
    "CST-1001": { "AST-CRATE-L": 6, "AST-TRAY": 2 },
    "CST-1002": { "AST-CRATE-S": 3 },
    "CST-1004": { "AST-CRATE-L": 12, "AST-PALLET": 1 },
    "CST-1008": { "AST-ICEBOX": 1 },
  };

  window.RD.screen("manageAssets", function (p) {
    const S = window.RD.state.scratch;
    const stop = p.stopId ? D.getStops(p.routeId).find(function (s) { return s.id === p.stopId; }) : null;
    const orgId = S.assetOrgId || (stop && stop.customerId) || null;
    const held = (orgId && HELD[orgId]) || {};
    if (!S.giving) { S.giving = {}; S.taking = {}; }

    const holdsText = Object.keys(held).filter(function (k) { return held[k] > 0; })
      .map(function (k) {
        const a = ASSETS.find(function (x) { return x._id === k; });
        return held[k] + " " + (a ? a.name.toLowerCase() : k);
      }).join(", ");

    // QA's note is a quiet slate panel, not one of the coloured Banners.
    const banner = '<div style="' + U.sty({
      background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12,
      padding: "13px 14px", marginBottom: 20,
    }) + '"><p style="' + U.sty({ fontSize: 13, color: "#64748b", margin: 0 }) + '">' +
      (holdsText ? "Customer currently holds " + U.esc(holdsText) + "." : "No assets on record for this customer yet.") + "</p></div>";

    // QA's grid: 99px name / 46px held / 70px giving / 70px taking, with the
    // two number fields 58 wide inside their tracks. A field with nothing in it
    // is dimmed to 0.35, and TAKING dims whenever the customer holds nothing.
    const AGRID = "1fr 46px 70px 70px";
    const numField = function (model, value, dim) {
      return '<div style="' + U.sty({ display: "flex", justifyContent: "center" }) + '">' +
        '<input inputmode="numeric" data-model="' + model + '" value="' + (value || "") + '" placeholder="0" style="' + U.sty({
          width: 58, height: 44, boxSizing: "border-box", textAlign: "center", fontSize: 17, fontWeight: 700,
          color: value ? "#111827" : "#c0c7d0", background: "white", border: "2px solid #dde1e7",
          borderRadius: 10, outline: "none", fontFamily: "inherit", opacity: dim ? 0.35 : 1,
        }) + '" /></div>';
    };
    const rows = ASSETS.map(function (a, ai) {
      const h = held[a._id] || 0;
      const give = S.giving[a._id] || 0;
      const take = S.taking[a._id] || 0;
      return '<div style="' + U.sty({ display: "grid", gridTemplateColumns: AGRID, gap: 8, alignItems: "center", padding: "14px 16px", borderBottom: ai === ASSETS.length - 1 ? "none" : "1px solid #f1f5f9" }) + '">' +
        '<div><p style="' + U.sty({ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0, lineHeight: 1.3 }) + '">' + U.esc(a.name) + "</p></div>" +
        '<div style="' + U.sty({ textAlign: "center" }) + '"><span style="' + U.sty({ fontSize: 17, fontWeight: 700, color: "#111827" }) + '">' + h + "</span></div>" +
        numField("give-" + a._id, give, false) +
        numField("take-" + a._id, take, h <= 0) +
        "</div>";
    }).join("");

    // QA states the outcome as one sentence in a green panel, not as a table:
    // "After this visit — updated balance: Crate: 6 + 2 = 8 · Tray: 2".
    const previewLines = ASSETS.map(function (a) {
      const h = held[a._id] || 0, give = S.giving[a._id] || 0, take = S.taking[a._id] || 0;
      if (!give && !take) return null;
      const updated = h + give - take;
      let expr;
      if (h > 0) {
        let lhs = String(h);
        if (give > 0) lhs += " + " + give;
        if (take > 0) lhs += " − " + take;
        expr = lhs + " = " + updated;
      } else {
        expr = String(updated);
      }
      return { name: a.name, expr: expr };
    }).filter(Boolean);

    const preview = previewLines.length
      ? '<div style="' + U.sty({ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }) + '">' +
          '<div style="' + U.sty({ display: "flex", alignItems: "flex-start", gap: 10 }) + '">' +
            '<div style="' + U.sty({ width: 20, height: 20, borderRadius: 5, background: "#16a34a", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }) + '">' +
              '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="2,6 5,9 10,3" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></polyline></svg>' +
            "</div>" +
            "<div>" +
              '<p style="' + U.sty({ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#15803d" }) + '">After this visit — updated balance:</p>' +
              '<p style="' + U.sty({ margin: 0, fontSize: 13, color: "#166534", lineHeight: 1.6 }) + '">' +
                previewLines.map(function (l, i) {
                  return "<span>" + (i > 0 ? '<span style="' + U.sty({ margin: "0 4px", color: "#4ade80" }) + '">·</span>' : "") +
                    "<strong>" + U.esc(l.name) + "</strong>: " + l.expr + "</span>";
                }).join("") +
              "</p>" +
            "</div>" +
          "</div>" +
        "</div>"
      : "";

    const anyMovement = previewLines.length > 0;
    // QA confirms an asset movement before writing it, listing every give/take
    // line with its resulting balance (ManageAssets.jsx ConfirmPanel).
    const entries = [];
    ASSETS.forEach(function (a) { const g = S.giving[a._id] || 0; if (g > 0) entries.push({ type: "give", productId: a._id, productName: a.name, quantity: g }); });
    ASSETS.forEach(function (a) { const t = S.taking[a._id] || 0; if (t > 0) entries.push({ type: "take", productId: a._id, productName: a.name, quantity: t }); });
    const movedUnits = entries.reduce(function (n, e) { return n + e.quantity; }, 0);
    const customerName = (stop && stop.customerName) || (S.assetCustomerName || "Customer");
    const confirming = !!S.assetConfirming;

    const headCell = function (text, align, color) {
      return '<span style="' + U.sty({ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: color || "#94a3b8", textTransform: "uppercase", textAlign: align || "start" }) + '">' + text + "</span>";
    };

    // QA puts the customer's own name in the back label here, not "Customer".
    return U.MobileHeader({ title: "Manage Assets", subtitle: "Crates, trays & returnable packaging", backLabel: customerName, backAct: "back" }) +
      // The body carries the padding here, so the card and the label sit on the
      // page rather than in QA's usual 12px gutter.
      '<div class="rd-body" style="' + U.sty({ padding: "16px 16px 100px" }) + '">' +
        banner +
        '<p style="' + U.sty({ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#94a3b8", textTransform: "uppercase", margin: "0 0 8px 2px" }) + '">Asset movement</p>' +
        '<div style="' + U.sty({ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, marginBottom: 16, overflow: "hidden" }) + '">' +
          '<div style="' + U.sty({ display: "grid", gridTemplateColumns: AGRID, gap: 8, alignItems: "center", padding: "9px 16px", background: "#fafafa", borderBottom: "1px solid #f1f5f9" }) + '">' +
            headCell("Asset") + headCell("Held", "center") + headCell("+Giving", "center", "#16a34a") + headCell("−Taking", "center", "#dc2626") +
          "</div>" + rows + "</div>" +
        preview +
      "</div>" +
      (confirming ? U.FreezeBackdrop(0.45) : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' +
        U.ActionBar(confirming
          ? U.ConfirmPanel({
              action: "Asset Update",
              amount: movedUnits + " Unit" + (movedUnits !== 1 ? "s" : "") + " Moved",
              context: entries.length + " asset" + (entries.length !== 1 ? "s" : "") + " · " + (customerName || "Customer"),
              backLabel: "Edit", commitLabel: "Confirm",
              backAct: "asset-confirm-cancel", commitAct: "asset-commit", arg: orgId,
              processing: !!S.committing,
              extra: '<div style="' + U.sty({ background: "#f8fafc", borderRadius: 10, border: "1px solid #e9eef2", overflow: "hidden", maxHeight: 140, overflowY: "auto" }) + '">' +
                entries.map(function (e, i) {
                  const isGive = e.type === "give";
                  const color = isGive ? "#3b82f6" : "#16a34a";
                  const h = held[e.productId] || 0;
                  const updated = isGive ? h + e.quantity : h - e.quantity;
                  return '<div style="' + U.sty({
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "9px 14px", borderBottom: i < entries.length - 1 ? "1px solid #f1f5f9" : "none",
                  }) + '">' +
                    '<span style="' + U.sty({ fontSize: 14, color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }) + '">' +
                      U.esc(e.productName) +
                      '<span style="' + U.sty({ display: "inline-block", fontSize: 11, fontWeight: 700, background: isGive ? "#dbeafe" : "#dcfce7", color: color, borderRadius: 3, padding: "1px 5px", marginLeft: 6 }) + '">' +
                        (isGive ? "Give" : "Take") + "</span></span>" +
                    '<span style="' + U.sty({ fontSize: 13, fontWeight: 700, color: color, flexShrink: 0 }) + '">' +
                      (isGive ? "+" : "−") + e.quantity + " → " + updated + "</span>" +
                  "</div>";
                }).join("") + "</div>",
            })
          : (S.assetError
              ? '<div style="' + U.sty({ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", marginBottom: 8 }) + '">' +
                  '<p style="' + U.sty({ margin: 0, fontSize: 13, color: "#dc2626" }) + '">' + U.esc(S.assetError) + "</p></div>"
              : "") +
            U.BtnXL({
              variant: anyMovement ? "brand" : "grey", label: "Save Asset Update →",
              disabled: !anyMovement, style: { opacity: anyMovement ? 1 : 0.5 },
              actName: "asset-confirm",
            })) +
      "</div>";
  });

  window.RD.action("asset-confirm", function () {
    const S = window.RD.state.scratch;
    S.assetError = null; S.assetConfirming = true; window.RD.render();
  });
  window.RD.action("asset-confirm-cancel", function () { window.RD.state.scratch.assetConfirming = false; window.RD.render(); });

  window.RD.action("asset-give-inc", function (id) { const S = window.RD.state.scratch; S.giving[id] = (S.giving[id] || 0) + 1; window.RD.render(); });
  window.RD.action("asset-give-dec", function (id) { const S = window.RD.state.scratch; S.giving[id] = Math.max(0, (S.giving[id] || 0) - 1); window.RD.render(); });
  window.RD.action("asset-take-inc", function (id) { const S = window.RD.state.scratch; S.taking[id] = (S.taking[id] || 0) + 1; window.RD.render(); });
  window.RD.action("asset-take-dec", function (id) { const S = window.RD.state.scratch; S.taking[id] = Math.max(0, (S.taking[id] || 0) - 1); window.RD.render(); });
  window.RD.action("model:give#", function (value, id) {
    const S = window.RD.state.scratch;
    S.giving[id] = Number(String(value).replace(/\D/g, "")) || 0;
    window.RD.render();
  });
  window.RD.action("model:take#", function (value, id) {
    const S = window.RD.state.scratch;
    S.taking[id] = Number(String(value).replace(/\D/g, "")) || 0;
    window.RD.render();
  });

  window.RD.action("asset-commit", function (orgId) {
    const S = window.RD.state.scratch;
    // Reached by URL without a stop: QA drops out of the confirm panel and
    // explains why it cannot write the movement.
    if (!orgId) {
      S.assetConfirming = false;
      S.assetError = "Missing customer for this action — go back and reopen it from the queue.";
      window.RD.render();
      return;
    }
    const movements = [];
    ASSETS.forEach(function (a) {
      const give = S.giving[a._id] || 0, take = S.taking[a._id] || 0;
      if (!give && !take) return;
      movements.push({ productId: a._id, productName: a.name, given: give, taken: take });
      if (orgId) {
        if (!HELD[orgId]) HELD[orgId] = {};
        HELD[orgId][a._id] = Math.max(0, (HELD[orgId][a._id] || 0) + give - take);
      }
    });
    // QA's panel swaps to the processing block for the length of the write.
    window.RD.commit(function () {
      SDK.routeDelivery.recordAssetMovement({ routeId: window.RD.state.routeId, customerOrgId: orgId, movements: movements });
      S.giving = {}; S.taking = {};
      S.assetConfirming = false;
      window.RD.back();
    });
  });

  /* ══ Return Acceptance ═════════════════════════════════════════════════ */

  // QA's return flow is two steps: pick the items, then pick a reason in a
  // footer panel. The reasons and their icons are QA's, and the primary button
  // narrates what is still needed at each stage.
  const RETURN_REASONS = [
    { key: "DAMAGED",       icon: "🔴", label: "Damaged" },
    { key: "EXPIRED",       icon: "⏰", label: "Expired" },
    { key: "UNSOLD",        icon: "📦", label: "Unsold" },
    { key: "WRONG_PRODUCT", icon: "❌", label: "Wrong Product" },
  ];

  window.RD.screen("returnAcceptance", function (p) {
    const S = window.RD.state.scratch;
    const load = D.db.stockLoads[p.routeId];
    const products = (load && load.products) || [];
    if (!S.returnQtys) S.returnQtys = {};
    const search = (S.returnSearch || "").trim().toLowerCase();
    const shown = products.filter(function (pr) { return !search || pr.name.toLowerCase().indexOf(search) !== -1; });

    const totalQty = Object.keys(S.returnQtys).reduce(function (a, k) { return a + (S.returnQtys[k] || 0); }, 0);
    const totalValue = products.reduce(function (a, pr) { return a + (S.returnQtys[pr.productId] || 0) * pr.unitPrice; }, 0);
    const choosing = !!S.returnChoosing;

    const rows = shown.map(function (pr) {
      const qty = S.returnQtys[pr.productId] || 0;
      // QA's rows are taller than the other product lists (p=14 16, 15/22.5
      // names) and use the full-size stepper, not the small one.
      return '<div style="' + U.sty({ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "white", borderBottom: "1px solid #f5f5f5" }) + '">' +
        '<div style="' + U.sty({ flex: 1, minWidth: 0, paddingRight: 12 }) + '">' +
          '<div style="' + U.sty({ fontSize: 15, fontWeight: 700, color: "#111" }) + '">' + U.esc(pr.name) + "</div>" +
          // QA keeps the subtitle grey once something is selected — only the
          // weight changes — and spells it "↩ N units returned · ₹X".
          '<div style="' + U.sty({ fontSize: 12, color: "#9ca3af", marginTop: 2, fontWeight: qty > 0 ? 600 : 400 }) + '">' +
            (qty > 0 ? "↩ " + qty + " unit" + (qty === 1 ? "" : "s") + " returned · " + rawInr(qty * pr.unitPrice) : "Not returned") + "</div>" +
        "</div>" +
        U.StepperInput({ value: qty, arg: pr.productId, decAct: "return-dec", incAct: "return-inc", model: "return-" + pr.productId }) +
        "</div>";
    }).join("");

    const reasonPanel = '<div style="' + U.sty({ padding: "2px 0 0" }) + '">' +
      '<div style="' + U.sty({ marginBottom: 14 }) + '">' +
        '<div style="' + U.sty({ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }) + '">Return Reason</div>' +
        '<div style="' + U.sty({ fontSize: 13, color: "#6b7280", fontWeight: 500 }) + '">Why is the customer returning these items?</div>' +
      "</div>" +
      '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }) + '">' +
        RETURN_REASONS.map(function (r) {
          const on = S.returnReason === r.key;
          // No .rd-chip here: QA's reason buttons centre their icon and label
          // and have no press-scale.
          return '<button type="button"' + U.act("return-reason", r.key) + ' style="' + U.sty({
            padding: "11px 10px", borderRadius: 12,
            border: "2px solid " + (on ? U.BRAND : "#e5e7eb"),
            background: on ? "#e8f4f8" : "white",
            color: on ? U.BRAND : "#374151",
            fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            WebkitTapHighlightColor: "transparent",
            transition: "border-color 0.15s, background 0.15s, color 0.15s",
          }) + '"><span>' + r.icon + "</span><span>" + r.label + "</span></button>";
        }).join("") + "</div>" +
      // QA takes an optional note with the reason.
      '<textarea data-model="return-note" rows="2" placeholder="Add a note about this return (optional)" style="' + U.sty({
        width: "100%", padding: "10px 14px", borderRadius: 12, border: "1.5px solid #e5e7eb",
        fontSize: 13, fontFamily: "inherit", color: "#111", background: "white", resize: "none",
        outline: "none", boxSizing: "border-box", marginBottom: 12, transition: "border-color 0.15s",
      }) + '">' + U.esc(S.returnNote || "") + "</textarea>" +
      '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
        '<button type="button"' + U.act("return-cancel") + ' style="' + U.sty({
          flex: 1, padding: "14px 16px", background: "white", border: "2px solid " + U.BRAND,
          borderRadius: 16, cursor: "pointer", fontFamily: "inherit", minHeight: 56,
          display: "flex", alignItems: "center", justifyContent: "center", WebkitTapHighlightColor: "transparent",
        }) + '"><span style="' + U.sty({ fontSize: 15, fontWeight: 700, color: U.BRAND }) + '">← Cancel</span></button>' +
        '<button type="button"' + (S.returnReason ? U.act("return-reason-confirm") : " disabled") + ' style="' + U.sty({
          flex: 1, padding: "14px 16px", background: S.returnReason ? "#f97316" : "#9ca3af",
          border: "none", borderRadius: 16, cursor: S.returnReason ? "pointer" : "default",
          opacity: S.returnReason ? 1 : 0.6, fontFamily: "inherit", minHeight: 56,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.15s, opacity 0.15s", WebkitTapHighlightColor: "transparent",
        }) + '"><span style="' + U.sty({ fontSize: 15, fontWeight: 700, color: "white" }) + '">' +
          (S.returnReason ? "Confirm Reason →" : "Select a reason above") + "</span></button>" +
      "</div></div>";

    // Step 2: the same ConfirmPanel every other commit uses, in orange.
    const reasonLabel = (RETURN_REASONS.filter(function (r) { return r.key === S.returnReason; })[0] || {}).label || "";
    const returnItems = products.filter(function (pr) { return (S.returnQtys[pr.productId] || 0) > 0; });
    const reasonIcon = (RETURN_REASONS.filter(function (r) { return r.key === S.returnReason; })[0] || {}).icon || "";
    const confirmPanel = U.ConfirmPanel({
      action: "Product Return",
      amount: totalQty + " Unit" + (totalQty !== 1 ? "s" : "") + " · " + U.inr(totalValue),
      context: returnItems.length + " product" + (returnItems.length !== 1 ? "s" : "") + " · " + reasonLabel,
      backLabel: "Edit items", commitLabel: "↩ Record Return",
      backAct: "return-confirm-cancel-items", commitAct: "return-commit", arg: p.routeId,
      processing: !!S.committing, processingLabel: "Recording return…",
      // QA lists what is going back on the van and repeats the chosen reason in
      // an amber strip that can be edited without leaving the panel.
      extra: '<div style="' + U.sty({ background: "#f8fafc", borderRadius: 10, border: "1px solid #e9eef2", overflow: "hidden", maxHeight: 140, overflowY: "auto", marginBottom: 8 }) + '">' +
          returnItems.map(function (pr, i) {
            const qty = S.returnQtys[pr.productId] || 0;
            return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 14px", borderBottom: i < returnItems.length - 1 ? "1px solid #f1f5f9" : "none" }) + '">' +
              '<span style="' + U.sty({ fontSize: 13, color: "#374151", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }) + '">' + U.esc(pr.name) + "</span>" +
              '<span style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#374151", flexShrink: 0 }) + '">× ' + qty + " · " + rawInr(qty * pr.unitPrice) + "</span></div>";
          }).join("") +
        "</div>" +
        '<div style="' + U.sty({ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 12px", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }) + '">' +
          '<span style="' + U.sty({ fontSize: 18, lineHeight: 1 }) + '">' + reasonIcon + "</span>" +
          '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
            '<span style="' + U.sty({ fontSize: 13, fontWeight: 700, color: "#c2410c" }) + '">' + reasonLabel + "</span>" +
          "</div>" +
          '<button type="button"' + U.act("return-confirm-cancel") + ' style="' + U.sty({
            background: "none", border: "none", padding: 0, cursor: "pointer",
            fontSize: 12, fontWeight: 600, color: "#c2410c", fontFamily: "inherit",
          }) + '">Edit</button>' +
        "</div>",
    });

    const footer = S.returnConfirming
      ? confirmPanel
      : choosing
      ? reasonPanel
      : U.BtnXL({
          variant: totalQty === 0 ? "grey" : "orange",
          style: { opacity: totalQty === 0 ? 0.5 : 1 },
          label: totalQty === 0 ? "Select items being returned"
               : "Select Return Reason · " + totalQty + " unit" + (totalQty === 1 ? "" : "s") + " · " + U.inr(totalValue) + " →",
          disabled: totalQty === 0, actName: "return-choose",
        });

    // The back link names the customer the return belongs to, as QA's does.
    const returnCustomer = (function () {
      const sid = window.RD.state.returnStopId;
      const st = sid ? D.getStops(p.routeId).find(function (x) { return x.id === sid; }) : null;
      return (st && st.customerName) || "Customer";
    })();
    return U.MobileHeader({ title: "Product Return", subtitle: "Items returned by the customer re-enter your vehicle stock", backLabel: returnCustomer, backAct: "back" }) +
      '<div class="rd-body" style="' + U.sty({ background: U.BG, opacity: choosing ? 0.4 : 1, pointerEvents: choosing ? "none" : "auto" }) + '">' +
        '<div style="padding:10px 12px 6px">' + U.SearchInput({ value: S.returnSearch || "", model: "return-search", placeholder: "Search products…", clearAct: "return-search-clear" }) + "</div>" +
        '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' +
          (rows || '<div style="padding:24px;text-align:center;color:#888;font-size:14px">No products match your search.</div>') + "</div>" +
      "</div>" +
      (choosing ? U.FreezeBackdrop(0.45) : "") +
      '<div style="' + U.sty({ position: "relative", zIndex: choosing ? 50 : "auto" }) + '">' + U.ActionBar(footer) + "</div>";
  });

  window.RD.action("return-choose", function () { window.RD.state.scratch.returnChoosing = true; window.RD.render(); });
  window.RD.action("return-cancel", function () {
    window.RD.state.scratch.returnConfirming = false;
    const S = window.RD.state.scratch;
    S.returnChoosing = false; S.returnReason = null;
    window.RD.render();
  });

  window.RD.action("return-inc", function (pid) { const S = window.RD.state.scratch; S.returnQtys[pid] = (S.returnQtys[pid] || 0) + 1; window.RD.render(); });
  window.RD.action("return-dec", function (pid) { const S = window.RD.state.scratch; S.returnQtys[pid] = Math.max(0, (S.returnQtys[pid] || 0) - 1); window.RD.render(); });
  window.RD.action("model:return#", function (value, pid) {
    const S = window.RD.state.scratch;
    S.returnQtys[pid] = Number(String(value).replace(/\D/g, "")) || 0;
    window.RD.render();
  });

  window.RD.action("return-reason-confirm", function () {
    const S = window.RD.state.scratch;
    S.returnChoosing = false; S.returnConfirming = true;
    window.RD.render();
  });
  window.RD.action("return-confirm-cancel-items", function () {
    const S = window.RD.state.scratch;
    S.returnConfirming = false; S.returnChoosing = false;
    window.RD.render();
  });
  window.RD.action("return-confirm-cancel", function () {
    const S = window.RD.state.scratch;
    S.returnConfirming = false; S.returnChoosing = true;
    window.RD.render();
  });
  window.RD.action("model:return-note", function (v) { window.RD.state.scratch.returnNote = v; });
  window.RD.action("return-reason", function (r) { window.RD.state.scratch.returnReason = r; window.RD.render(); });

  window.RD.action("return-search-clear", function () { window.RD.state.scratch.returnSearch = ""; window.RD.render(); });
  window.RD.action("model:return-search", function (v) {
    window.RD.state.scratch.returnSearch = v; window.RD.render();
    const el = document.querySelector('[data-model="return-search"]');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
  window.RD.action("return-commit", function (routeId) {
    const S = window.RD.state.scratch;
    const load = D.db.stockLoads[routeId];
    const products = (load && load.products) || [];
    const items = Object.keys(S.returnQtys).filter(function (k) { return S.returnQtys[k] > 0; }).map(function (pid) {
      const pr = products.find(function (x) { return x.productId === pid; });
      return { productId: pid, qty: S.returnQtys[pid], unitPrice: pr ? pr.unitPrice : 0 };
    });
    window.RD.commit(function () {
      const fromStopId = window.RD.state.returnStopId;
      const fromStop = fromStopId ? D.getStops(routeId).filter(function (x) { return x.id === fromStopId; })[0] : null;
      const fromDetail = fromStopId ? D.resolveStopDetail(routeId, fromStopId) : null;
      SDK.routeDelivery.createRouteReturn({
        routeId: routeId, orgId: fromStop ? fromStop.customerId : null,
        items: items, reason: S.returnReason || "Damaged", note: S.returnNote || "",
      });
      // A customer who had nothing booked is now a return-only stop, exactly as
      // QA's node types resolve it (RETURN_DISPATCH and nothing else).
      if (fromStop && fromDetail && !(fromDetail.orderItems || []).length) fromStop.isReturnOnly = true;
      window.RD.state.returnStopId = null;
      // Returned goods go back on the van, so they can be sold at a later stop.
      items.forEach(function (it) {
        const pr = products.find(function (x) { return x.productId === it.productId; });
        if (pr) pr.loadedQty += it.qty;
      });
      S.returnQtys = {}; S.returnChoosing = false; S.returnConfirming = false;
      S.returnReason = null; S.returnNote = "";
      // QA lands on the queue after recording a return, not back on the stop.
      window.RD.go("/queue/" + routeId);
    });
  });
})();

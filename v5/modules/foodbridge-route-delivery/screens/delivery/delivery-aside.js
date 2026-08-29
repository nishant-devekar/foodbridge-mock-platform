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

    const waiting = pending.length
      ? '<div style="' + U.sty({ padding: "6px 12px 3px", fontSize: 10, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }) + '">Stops Waiting For You</div>' +
        pending.map(function (stop) {
          return '<div style="' + U.sty({ display: "flex", alignItems: "center", padding: "11px 16px", background: "white", borderBottom: "1px solid #f0f0f0", gap: 12 }) + '">' +
            '<div style="' + U.sty({ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12, background: "#fff7ed", color: "#c2410c" }) + '">' +
              U.esc((stop.customerName || "?").slice(0, 2).toUpperCase()) + "</div>" +
            '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
              '<div style="' + U.sty({ fontSize: 14, fontWeight: 600, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(stop.customerName) + "</div>" +
              '<div style="' + U.sty({ fontSize: 12, color: "#888", marginTop: 1 }) + '">' + U.inr(stop.totalDue || 0) + " due</div>" +
            "</div></div>";
        }).join("")
      : "";

    return '<div style="' + U.sty({ background: U.BRAND, padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }) + '">' +
        "<div>" +
          '<div style="' + U.sty({ fontSize: 17, fontWeight: 700, color: "white" }) + '">Restock In Progress</div>' +
          '<div style="' + U.sty({ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 2 }) + '">Route: ' + U.esc(route.name) + "</div>" +
        "</div>" +
        '<div style="' + U.sty({ fontSize: 11, background: "rgba(255,255,255,0.18)", color: "white", padding: "3px 10px", borderRadius: 20, fontWeight: 600 }) + '">🔄 Paused</div>' +
      "</div>" +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        '<div style="' + U.sty({ margin: "10px 12px 4px", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "7px 12px", display: "flex", alignItems: "center", gap: 7 }) + '">' +
          '<span style="' + U.sty({ width: 8, height: 8, background: "#c2410c", borderRadius: "50%", flexShrink: 0, display: "inline-block", animation: "pulse 1.5s infinite" }) + '"></span>' +
          '<span style="' + U.sty({ fontSize: 12, fontWeight: 600, color: "#c2410c" }) + '">Delivery paused · En route to warehouse</span></div>' +
        stats +
        U.Card(
          '<div style="' + U.sty({ display: "flex", gap: 12, alignItems: "flex-start" }) + '">' +
            '<div style="font-size:26px">🏭</div>' +
            "<div>" +
              '<div style="' + U.sty({ fontSize: 14, fontWeight: 700, marginBottom: 3 }) + '">Drive to warehouse</div>' +
              '<div style="' + U.sty({ fontSize: 11, opacity: 0.8, lineHeight: 1.4 }) + '">Load additional stock to resume delivery for ' + pending.length + " remaining customer" + (pending.length !== 1 ? "s" : "") + ".</div>" +
            "</div></div>"
        ) +
        waiting + U.Spacer(12) +
      "</div>" +
      U.ActionBar('<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
        U.BtnSm({ variant: "grey", label: "Resume Without Stock", actName: "restock-resume", arg: p.routeId }) +
        U.BtnSm({ variant: "brand", label: "Load Stock →", actName: "restock-load-go", arg: p.routeId }) +
      "</div>");
  });

  window.RD.action("restock-load-go", function (routeId) {
    // Pausing is what puts the route into RESTOCKING; the queue's Restock button
    // lands here first, so the pause happens on the way to the load screen.
    if (D.db.routeDetails[routeId].status !== "RESTOCKING") SDK.routeDelivery.pauseForRestock({ routeId: routeId });
    window.RD.go("/restock-load/" + routeId);
  });
  window.RD.action("restock-resume", function (routeId) {
    SDK.routeDelivery.resumeFromRestock({ routeId: routeId });
    window.RD.toast("Delivery resumed");
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
    const delivered = stops.filter(function (s) { return s.status === "DELIVERED"; }).length;
    const addUnits = S.restockQtys.reduce(function (a, q) { return a + (Number(q) || 0); }, 0);
    const addValue = products.reduce(function (a, pr, i) { return a + (Number(S.restockQtys[i]) || 0) * pr.unitPrice; }, 0);
    const search = (S.restockSearch || "").trim().toLowerCase();
    const rows = products.map(function (pr, i) { return { pr: pr, i: i }; })
      .filter(function (r) { return !search || r.pr.name.toLowerCase().indexOf(search) !== -1; });

    const head = '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 62px 74px minmax(100px,1fr)", columnGap: 8, padding: "10px 12px", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", background: "white", borderBottom: "2px solid #e5e7eb" }) + '">' +
      '<div>Product</div><div style="text-align:right">Loaded</div><div style="text-align:right">Delivered</div><div style="text-align:center">Add now</div></div>';

    const body = rows.map(function (r) {
      const sold = Math.round(r.pr.loadedQty * (delivered / Math.max(stops.length, 1)));
      const onTruck = Math.max(0, r.pr.loadedQty - sold);
      return '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 62px 74px minmax(100px,1fr)", columnGap: 8, alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #f5f5f5" }) + '">' +
        '<div style="' + U.sty({ fontSize: 14, fontWeight: 600, color: "#111" }) + '">' + U.esc(r.pr.name) + "</div>" +
        '<div style="' + U.sty({ textAlign: "right", fontSize: 14, color: "#555" }) + '">' + r.pr.loadedQty + "</div>" +
        '<div style="' + U.sty({ textAlign: "right", fontSize: 14, color: "#555" }) + '">' + sold + "</div>" +
        '<div style="' + U.sty({ display: "flex", justifyContent: "center" }) + '">' +
          U.StepperInput({ value: S.restockQtys[r.i] || 0, small: true, arg: r.i, decAct: "restock-dec", incAct: "restock-inc", model: "restock-" + r.i }) + "</div></div>";
    }).join("");

    return U.MobileHeader({ title: "Load Additional Stock", subtitle: route.name, backLabel: "Restock", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        '<div style="padding:10px 12px 8px">' + U.SearchInput({ value: S.restockSearch || "", model: "restock-search", placeholder: "Search products…", clearAct: "restock-search-clear" }) + "</div>" +
        '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' + head + body + "</div>" +
        '<div style="' + U.sty({ display: "flex", gap: 10, padding: "0 12px 12px" }) + '">' +
          '<div style="' + U.sty({ flex: 1, background: "white", borderRadius: 14, padding: 13, textAlign: "center" }) + '">' +
            '<div style="' + U.sty({ fontSize: 22, fontWeight: 800, color: U.BRAND }) + '">+' + addUnits + "</div>" +
            '<div style="' + U.sty({ fontSize: 11, color: "#888", fontWeight: 600, marginTop: 2 }) + '">Units Added</div></div>' +
          '<div style="' + U.sty({ flex: 1, background: "white", borderRadius: 14, padding: 13, textAlign: "center" }) + '">' +
            '<div style="' + U.sty({ fontSize: 22, fontWeight: 800, color: "#16a34a" }) + '">' + U.inr(addValue) + "</div>" +
            '<div style="' + U.sty({ fontSize: 11, color: "#888", fontWeight: 600, marginTop: 2 }) + '">Added Value</div></div></div>' +
        U.Spacer(8) +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: "brand", label: "Confirm Restock (+" + addUnits + " units) →", disabled: addUnits === 0, actName: "restock-commit", arg: p.routeId }));
  });

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
    const S = window.RD.state.scratch;
    const load = D.db.stockLoads[routeId];
    const products = (load && load.products) || [];
    const items = products.map(function (pr, i) {
      return { productId: pr.productId, name: pr.name, unitPrice: pr.unitPrice, loadedQty: pr.loadedQty + (Number(S.restockQtys[i]) || 0) };
    });
    S.restockAdded = S.restockQtys.reduce(function (a, q) { return a + (Number(q) || 0); }, 0);
    SDK.routeDelivery.updateStockLoad({ routeId: routeId, items: items });
    window.RD.go("/restock-success/" + routeId);
  });

  /* ══ Restock Success ═══════════════════════════════════════════════════ */

  window.RD.screen("restockSuccess", function (p) {
    const S = window.RD.state.scratch;
    const added = S.restockAdded || 0;
    const load = D.db.stockLoads[p.routeId];
    const available = ((load && load.products) || []).reduce(function (a, pr) { return a + pr.loadedQty; }, 0);

    return '<div class="rd-body" style="background:' + U.BG + '">' +
        '<div style="' + U.sty({ padding: "48px 24px 24px", textAlign: "center" }) + '">' +
          '<div style="' + U.sty({ fontSize: 56, marginBottom: 12 }) + '">✅</div>' +
          '<div style="' + U.sty({ fontSize: 24, fontWeight: 800, color: "#111" }) + '">Stock Loaded</div>' +
          '<div style="' + U.sty({ fontSize: 15, color: "#555", marginTop: 8 }) + '">Restock confirmed. Your route is ready to continue.</div>' +
        "</div>" +
        U.Card(
          U.SettleRow("Units added", "+" + added + " units", "#16a34a") +
          U.SettleRow("Available on van now", available + " units", null, true)
        ) +
        U.Spacer(12) +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: "green", label: "Resume Delivery →", actName: "restock-resume", arg: p.routeId }));
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

    const banner = holdsText
      ? U.Banner({ type: "orange", icon: "📦", text: "Customer currently holds " + holdsText + "." })
      : U.Banner({ type: "blue", icon: "📦", text: "No assets on record for this customer yet." });

    const rows = ASSETS.map(function (a) {
      const h = held[a._id] || 0;
      const give = S.giving[a._id] || 0;
      const take = S.taking[a._id] || 0;
      return '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 52px 92px 92px", columnGap: 8, alignItems: "center", padding: "12px", borderBottom: "1px solid #f5f5f5" }) + '">' +
        '<div style="' + U.sty({ fontSize: 14, fontWeight: 600, color: "#111" }) + '">' + U.esc(a.name) + "</div>" +
        '<div style="' + U.sty({ textAlign: "center", fontSize: 15, fontWeight: 700, color: h > 0 ? "#c2410c" : "#9ca3af" }) + '">' + h + "</div>" +
        '<div>' + U.StepperInput({ value: give, small: true, arg: a._id, decAct: "asset-give-dec", incAct: "asset-give-inc", model: "give-" + a._id }) + "</div>" +
        '<div>' + U.StepperInput({ value: take, small: true, max: h + give, arg: a._id, decAct: "asset-take-dec", incAct: "asset-take-inc", model: "take-" + a._id }) + "</div>" +
        "</div>";
    }).join("");

    const preview = ASSETS.map(function (a) {
      const h = held[a._id] || 0, give = S.giving[a._id] || 0, take = S.taking[a._id] || 0;
      if (!give && !take) return "";
      const updated = h + give - take;
      let lhs = String(h);
      if (give > 0) lhs += " + " + give;
      if (take > 0) lhs += " − " + take;
      return '<div style="' + U.sty({ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }) + '">' +
        "<span>" + U.esc(a.name) + "</span><span style=\"font-weight:700\">" + (h > 0 ? lhs + " = " + updated : String(updated)) + "</span></div>";
    }).join("");

    const anyMovement = !!preview;

    return U.MobileHeader({ title: "Manage Assets", subtitle: "Crates, trays & returnable packaging", backLabel: "Customer", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        banner +
        U.SectionHeader("Asset movement") +
        '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", overflow: "hidden" }) + '">' +
          '<div style="' + U.sty({ display: "grid", gridTemplateColumns: "1fr 52px 92px 92px", columnGap: 8, padding: "10px 12px", fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", borderBottom: "2px solid #e5e7eb" }) + '">' +
            "<div>Asset</div><div style=\"text-align:center\">Held</div><div style=\"text-align:center\">+ Giving</div><div style=\"text-align:center\">− Taking</div></div>" +
          rows + "</div>" +
        (anyMovement ? U.Card(U.CardTitle("After this visit") + preview) : "") +
        U.Spacer(12) +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: "brand", label: "Record Movement →", disabled: !anyMovement, actName: "asset-commit", arg: orgId }));
  });

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
    const movements = [];
    ASSETS.forEach(function (a) {
      const give = S.giving[a._id] || 0, take = S.taking[a._id] || 0;
      if (!give && !take) return;
      movements.push({ productId: a._id, given: give, taken: take });
      if (orgId) {
        if (!HELD[orgId]) HELD[orgId] = {};
        HELD[orgId][a._id] = Math.max(0, (HELD[orgId][a._id] || 0) + give - take);
      }
    });
    SDK.routeDelivery.recordAssetMovement({ routeId: window.RD.state.routeId, customerOrgId: orgId, movements: movements });
    S.giving = {}; S.taking = {};
    window.RD.toast("Asset movement recorded");
    window.RD.back();
  });

  /* ══ Return Acceptance ═════════════════════════════════════════════════ */

  window.RD.screen("returnAcceptance", function (p) {
    const S = window.RD.state.scratch;
    const load = D.db.stockLoads[p.routeId];
    const products = (load && load.products) || [];
    if (!S.returnQtys) S.returnQtys = {};
    const search = (S.returnSearch || "").trim().toLowerCase();
    const shown = products.filter(function (pr) { return !search || pr.name.toLowerCase().indexOf(search) !== -1; });

    const totalQty = Object.keys(S.returnQtys).reduce(function (a, k) { return a + (S.returnQtys[k] || 0); }, 0);
    const totalValue = products.reduce(function (a, pr) { return a + (S.returnQtys[pr.productId] || 0) * pr.unitPrice; }, 0);

    const rows = shown.map(function (pr) {
      const qty = S.returnQtys[pr.productId] || 0;
      return '<div style="' + U.sty({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 16px", borderBottom: "1px solid #f5f5f5" }) + '">' +
        '<div style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
          '<div style="' + U.sty({ fontSize: 14, fontWeight: 600, color: "#111" }) + '">' + U.esc(pr.name) + "</div>" +
          '<div style="' + U.sty({ fontSize: 11, color: qty > 0 ? "#16a34a" : "#888", marginTop: 2, fontWeight: qty > 0 ? 600 : 400 }) + '">' +
            (qty > 0 ? qty + " returned · " + rawInr(qty * pr.unitPrice) : "Not returned") + "</div>" +
        "</div>" +
        U.StepperInput({ value: qty, small: true, arg: pr.productId, decAct: "return-dec", incAct: "return-inc", model: "return-" + pr.productId }) +
        "</div>";
    }).join("");

    const reasons = ["Damaged", "Expired", "Wrong item", "Excess stock"];
    const chosen = S.returnReason || "Damaged";

    return U.MobileHeader({ title: "Product Return", subtitle: "Items returned by the customer re-enter your vehicle stock", backLabel: "Customer", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' +
        '<div style="padding:10px 12px 8px">' + U.SearchInput({ value: S.returnSearch || "", model: "return-search", placeholder: "Search products…", clearAct: "return-search-clear" }) + "</div>" +
        '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", overflow: "hidden" }) + '">' + (rows || '<div style="padding:24px;text-align:center;color:#888;font-size:14px">No products match your search.</div>') + "</div>" +
        U.SectionHeader("Reason") +
        '<div class="rd-noscrollbar" style="' + U.sty({ display: "flex", gap: 7, overflowX: "auto", padding: "0 12px 10px" }) + '">' +
          reasons.map(function (r) { return U.StatusChip({ active: chosen === r, label: r, actName: "return-reason", arg: r }); }).join("") + "</div>" +
        U.Card('<div style="' + U.sty({ display: "flex", justifyContent: "space-between", fontSize: 15 }) + '"><span style="font-weight:700">Return Value</span><span style="font-weight:800;color:#16a34a">' + U.inr(totalValue) + "</span></div>") +
        U.Spacer(12) +
      "</div>" +
      U.ActionBar(U.BtnXL({ variant: "brand", label: "Accept " + totalQty + " Item" + (totalQty === 1 ? "" : "s") + " →", disabled: totalQty === 0, actName: "return-commit", arg: p.routeId }));
  });

  window.RD.action("return-inc", function (pid) { const S = window.RD.state.scratch; S.returnQtys[pid] = (S.returnQtys[pid] || 0) + 1; window.RD.render(); });
  window.RD.action("return-dec", function (pid) { const S = window.RD.state.scratch; S.returnQtys[pid] = Math.max(0, (S.returnQtys[pid] || 0) - 1); window.RD.render(); });
  window.RD.action("model:return#", function (value, pid) {
    const S = window.RD.state.scratch;
    S.returnQtys[pid] = Number(String(value).replace(/\D/g, "")) || 0;
    window.RD.render();
  });

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
    SDK.routeDelivery.createRouteReturn({ routeId: routeId, orgId: null, items: items, reason: S.returnReason || "Damaged" });
    // Returned goods go back on the van, so they can be sold at a later stop.
    items.forEach(function (it) {
      const pr = products.find(function (x) { return x.productId === it.productId; });
      if (pr) pr.loadedQty += it.qty;
    });
    S.returnQtys = {};
    window.RD.toast("Return accepted · stock returned to van");
    window.RD.back();
  });
})();

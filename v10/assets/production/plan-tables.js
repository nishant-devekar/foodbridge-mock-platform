/* ==========================================================================
   THE PLAN'S FOUR TABLES — Orders · Finished Goods · Semi Finished Goods ·
   Purchase, the owner's "Todays Production and Purchase Plan" (3 Oct 2026).

   One model, two readers: the Production board draws the tables, and the
   Control Tower's Production lever reads where each line stands — so a
   figure on the tower is always the figure on the board.

   build(api): api is FB_PRODUCTION (or anything with its read(fn)).
   Pure over the store: no DOM, no storage of its own. Runs under node.
   ========================================================================== */
(function (root) {
  "use strict";

  var n = function (v) { return Math.round(v).toLocaleString("en-IN"); };
  function packLabel(s) { return s.perCarton > 1 ? s.name + " / " + n(s.perCarton * s.grams / 1000) + " kg pack" : s.name; }

  function build(api) {
    /* a line's need, the sheet's: Ordered − InStock + MSQ. It drives the chain (Finished →
       Semi Finished → Purchase). On Purchase it is the Approved Purchase; MSQ Deviation is
       where stock ends up against MSQ once the approved quantity is in: InStock + Approved −
       Ordered − MSQ */
    var line = function (key, msq, ordered, stock) {
      var need = Math.max(0, ordered - stock + msq);
      return { key: key, msq: msq, ordered: ordered, stock: stock, short: stock - ordered, need: need, approved: need, dev: stock + need - ordered - msq };
    };
    return api.read(function (D, d) {
      /* what the batches already made from the plan still have to make (owner, 3 Oct 2026:
         "approved for production is how many in batches, to produce how much is not
         allotted to batches"). Batch Management's states: Waiting to Start (planned) and
         In Progress (started, or on hold). What a batch has packed (packs) or bagged (a
         cut's kg) is in stock already, so only the rest counts; a completed batch is in
         InStock and counts no more. */
      var allot = {};
      var whenOf = function (b) { return b.when ? D.slotName(b.when.slot) + " shift, " + new Date(b.when.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "not on a shift yet"; };
      var put = function (key, b, qty) {
        if (!(qty > 0.5)) return;
        var a = allot[key] = allot[key] || { wait: 0, run: 0, list: [] }, waiting = b.stateId === "planned";
        if (waiting) a.wait += qty; else a.run += qty;
        a.list.push({ id: b.id, no: b.batchNumber, waiting: waiting, state: waiting ? "waiting to start" : b.stateId === "on-hold" ? "on hold" : "in progress", qty: qty, when: whenOf(b) });
      };
      d.batches.filter(function (b) { return ["planned", "in-progress", "on-hold"].indexOf(b.stateId) !== -1; }).forEach(function (b) {
        if (b.kind === "packing") { put("fg:" + b.skuId, b, (b.packets || 0) - (b.packedPackets || 0)); return; }
        if (b.kind !== "production") return;
        var bk0 = D.book(b.recipeId);
        if (bk0 && bk0.kind === "semi") {
          var bagged = d.bags.filter(function (g) { return g.batchId === b.id; }).reduce(function (t, g) { return t + g.kg; }, 0);
          put("sf:" + b.recipeId, b, b.batchSize - bagged);
          return;
        }
        (b.packagingLines || []).forEach(function (l) {
          var got = (b.packedLines || []).filter(function (x) { return x.skuId === l.packagingConfigId; })[0];
          put("fg:" + l.packagingConfigId, b, (l.plannedUnits || 0) - (got ? got.packets : 0));
        });
      });
      /* Finished and Semi Finished (owner, 3 Oct 2026: "approved for production is how many
         in batches; to produce, how much is not allotted to batches"): Approved Production
         is what is in open batches — approving for production is making the batch — and To
         produce is the need no batch covers yet */
      var allotted = function (l) {
        var a = allot[l.key] || { wait: 0, run: 0, list: [] };
        l.wait = Math.round(a.wait); l.run = Math.round(a.run); l.batches = a.list;
        l.approved = l.wait + l.run;
        l.toProduce = Math.max(0, Math.round(l.need) - l.approved);
        /* against the need as To produce counts it (whole units), plus any stock already above MSQ */
        l.dev = l.approved - Math.round(l.need) + (l.stock - l.ordered - l.msq + l.need);
        return l;
      };
      var plan = D.plan();
      var rowOf = {};
      plan.skus.forEach(function (r) { rowOf[r.skuId] = r; });
      /* Orders and Finished Goods: a row per pack under its finished product */
      var orders = [], fg = [];
      d.recipeOrder.forEach(function (rid) {
        var bk = D.book(rid), packs = D.packs(rid);
        var oRows = packs.map(function (s) { var r = rowOf[s.id] || { open: 0 }; return { id: s.id, name: packLabel(s), perCarton: s.perCarton, cartons: r.open / (s.perCarton || 1), qty: r.open }; });
        var sumO = function (k) { return oRows.reduce(function (t, x) { return t + x[k]; }, 0); };
        orders.push({ recipeId: rid, name: bk.name, rows: oRows, total: { perCarton: sumO("perCarton"), cartons: sumO("cartons"), qty: sumO("qty") } });
        var fRows = packs.map(function (s) {
          var r = rowOf[s.id] || { open: 0, free: 0 };
          var l = line("fg:" + s.id, s.msq || 0, r.open, r.free);
          l.name = packLabel(s); l.kg = s.grams / 1000; l.skuId = s.id;
          return allotted(l);
        });
        var sum = function (k) { return fRows.reduce(function (t, x) { return t + x[k]; }, 0); };
        fg.push({ recipeId: rid, name: bk.name, version: bk.label, packs: fRows,
          needKg: fRows.reduce(function (t, x) { return t + x.need * x.kg; }, 0),
          total: { msq: sum("msq"), ordered: sum("ordered"), stock: sum("stock"), short: sum("short"), approved: sum("approved"), wait: sum("wait"), run: sum("run"), toProduce: sum("toProduce"), dev: sum("dev") } });
      });
      /* The business flow (owner, 3 Oct 2026): customers order → Finished Goods is checked
         against them → a finished batch approved for production raises the demand for its
         semi-finished goods → a semi-finished batch approved (with the finished batches)
         raises the demand for raw material and packaging → purchase brings it in → the cuts
         are made → the finished goods are made → dispatch. So Semi Finished's Ordered is what
         approved finished batches still need from the cold store, and Purchase's is what
         approved batches still need from the store (D.demand: open batches, less what their
         steps have already taken). */
      var shares = {};
      fg.forEach(function (g) {
        var bk = D.book(g.recipeId), comps = bk.ingredients.filter(function (i) { return i.sfId; }), tot = comps.reduce(function (t, i) { return t + i.qty; }, 0);
        comps.forEach(function (i) {
          (shares[i.sfId] = shares[i.sfId] || []).push({ pct: i.qty / tot * 100, of: bk.name, rid: g.recipeId, single: comps.length === 1 });
        });
      });
      var semi = (d.semiOrder || []).map(function (sid) {
        var bk = D.book(sid), dm = D.demand(sid);
        var l = line("sf:" + sid, bk.msq || 0, dm.qty, D.inFreezer(sid));
        l.id = sid; l.name = bk.name; l.cut = bk.label; l.shares = shares[sid] || []; l.demand = dm.list;
        return allotted(l);
      });
      /* Purchase: the recipes' raw materials always (the sheet's rows), and any packaging
         approved batches need; Required is what approved batches still need from the store */
      var buy = {}, order = [];
      var add = function (rmId, waste, cut) {
        if (!buy[rmId]) { buy[rmId] = { waste: waste }; order.push(rmId); }
        if (cut) { buy[rmId].cut = true; buy[rmId].waste = waste; }
      };
      (d.semiOrder || []).forEach(function (sid) {
        D.book(sid).ingredients.forEach(function (i) { if (i.rmId) add(i.rmId, i.wastage != null ? i.wastage : Math.max(0, 100 - (i.yield || 100)), true); });
      });
      d.recipeOrder.forEach(function (rid) { D.book(rid).ingredients.forEach(function (i) { if (i.rmId) add(i.rmId, 0); }); });
      d.materials.forEach(function (m) { if (m.kind === "packaging" && D.demand(m.id).qty > 0) add(m.id, 0); });
      /* where each material stands with its suppliers (3 Oct 2026, owner: show what is
         staged for a purchase request and what is in flight): Requested is on purchase
         requests waiting for approval; On the way is approved and not at the gate yet. */
      var live = (d.purchaseOrders || []).filter(function (po) { return ["Pending Approval", "InProgress", "Pending", "Partial Delivered"].indexOf(po.status) !== -1; });
      var purchase = order.map(function (id) {
        var m = D.material(id), dm = D.demand(id);
        /* InStock is what is in the store: what approved batches will take is Required, not netted off twice */
        var l = line("pu:" + id, m.threshold || 0, dm.qty, D.onHand(id));
        l.demand = dm.list;
        l.id = id; l.name = m.name; l.unit = m.unit; l.grade = m.grade || "—"; l.waste = buy[id].waste; l.wasteEdit = !!buy[id].cut;
        l.supplierId = m.supplierId; l.price = m.price; l.store = m.store; l.kind = m.kind;
        l.pos = live.map(function (po) {
          var q = D.openOnPO(po, id);
          if (!(q > 0)) return null;
          var ln = po.lines.filter(function (x) { return x.materialId === id; })[0], sup = D.supplier(po.supplierId);
          return { id: po.id, no: po.number, status: po.status, waiting: po.status === "Pending Approval", qty: q, ordered: ln.qty, received: ln.received, supplier: sup ? sup.name : "",
            expectedAt: po.expectedAt, createdAt: po.createdAt, by: po.by, cancellable: !po.receipts.length };
        }).filter(Boolean);
        /* the same reading as Approved Production (owner, 3 Oct 2026: "Approved Purchase —
           sent to the supplier? Requested — internally requested?"): Approved Purchase is
           what is approved and with the supplier, not at the gate yet; Awaiting approval is
           raised and waiting for someone to approve it; To order is the need (the sheet's
           Ordered − InStock + MSQ) that neither covers. Goods in at the gate are InStock. */
        l.requested = l.pos.filter(function (x) { return x.waiting; }).reduce(function (t, x) { return t + x.qty; }, 0);
        l.onWay = l.pos.filter(function (x) { return !x.waiting; }).reduce(function (t, x) { return t + x.qty; }, 0);
        l.approved = l.onWay;
        l.toOrder = Math.max(0, Math.round(l.need) - l.requested - l.onWay);
        l.dev = l.approved - Math.round(l.need) + (l.stock - l.ordered - l.msq + l.need);
        return l;
      }).filter(function (l) { return l.kind !== "packaging" || l.toOrder > 0; });   /* packaging only when there is some to order */
      return { orders: orders, fg: fg, semi: semi, purchase: purchase, cartonKg: D.cartonKg() };
    });
  }

  var API = { build: build, packLabel: packLabel };
  root.FBPlanTables = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

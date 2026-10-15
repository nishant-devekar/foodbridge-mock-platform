/* The business flow the plan is wired to (owner, 3 Oct 2026):
   customers order → Finished Goods is checked → a finished batch is approved for
   production, which raises the demand for its semi-finished goods → a semi-finished
   batch is approved, which raises the demand for raw material → purchase brings it in
   → the cut is made → the finished goods are made from it → dispatch fulfils the order.
   Each step moves the next table's figures. Run from v7/:  node --test assets/production/test/ */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../production-api.js");

const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.05, (msg || "") + ": " + a + " ≠ " + b);

test("one order, all the way: sales → finished → semi-finished → purchase → cut → make → dispatch", () => {
  const d = A.seed(new Date(), () => {}), D = A.Domain(d, () => new Date(), () => {});
  const run = (b, inputs) => {
    D.startOnFloor(b.id, { slot: "morning", crew: d.workers.filter((w) => w.role !== "admin").map((w) => w._id) });
    d.tasks.filter((t) => t.batch === b.id).sort((x, y) => x.stepOrder - y.stepOrder).forEach((t) => {
      /* whoever is free: this morning's floor has someone mid-step */
      const w = d.workers.find((x) => x.role !== "admin" && !d.tasks.some((y) => y.assignedTo === x._id && y.status === "in_progress"));
      D.claim(t, w); D.complete(t, w, inputs(t));
    });
  };
  const sku = "fg-p08";                                               // Green Peas 1KG, 30 to a carton

  /* 1 · the customer orders: Orders, and Finished Goods' need */
  const before = { open: D.demandOf(sku).open, free: D.availableToSell(sku) };
  const so = D.placeOrder({ customerId: "cus-patiala-frozen", items: [{ skuId: sku, qty: 3000 }] });
  assert.equal(D.demandOf(sku).open, before.open + 3000, "Orders: +100 cartons = 3,000 pouches");
  const row = () => D.plan().skus.find((r) => r.skuId === sku);
  assert.equal(row().shortPackets, before.open + 3000 + D.sku(sku).msq - before.free, "Finished Goods need: Ordered − InStock + MSQ");

  /* 2 · approved for production: a finished batch, and the cold store's demand */
  const sfBefore = D.demand("sf-peas").qty;
  const fg = D.createProductionOrder({ recipeId: "green-peas", batchSize: 3040, packs: [{ skuId: sku, qty: 3000 }], actor: "Owner", where: "Production Plan" }).batch;
  near(D.demand("sf-peas").qty, sfBefore + 3040, "Semi Finished Ordered: the batch's Green Peas 50 Kg");
  assert.ok(D.demand("sf-peas").list.some((x) => x.id === fg.id && x.state === "waiting to start"));
  assert.equal(D.plan().semis.find((x) => x.recipeId === "sf-peas").needKg, D.demand("sf-peas").qty, "the engine's plan reads the same demand");

  /* 3 · the cut approved: raw material and big bags become Purchase's demand */
  const rawBefore = D.demand("rm-p01").qty, bagsBefore = D.demand("rm-p08").qty;
  const sf = D.createProductionOrder({ recipeId: "sf-peas", batchSize: 3100, actor: "Owner", where: "Production Plan" }).batch;
  near(D.demand("rm-p01").qty, rawBefore + 4030, "Purchase Required: 3,100 kg × (1 + 30% wastage)");
  assert.equal(D.demand("rm-p08").qty, bagsBefore + 62, "62 big bags of 50 kg");
  assert.equal(D.plan().materials.find((m) => m.id === "rm-p01").need, D.demand("rm-p01").qty);

  /* 4 · purchase: raised (awaiting approval) → approved (with the supplier) → at the gate (InStock) */
  const onHand0 = D.onHand("rm-p01"), ordered0 = D.ordered("rm-p01");
  const po = D.raisePO({ supplierId: "sup-garg", lines: [{ materialId: "rm-p01", qty: 4100 }], status: "Pending Approval", by: "Owner" });
  assert.equal(D.ordered("rm-p01"), ordered0 + 4100, "awaiting approval counts as on order");
  D.setPOStatus(po.id, "InProgress", "Owner");
  D.receivePO(po.id, { by: "Store · Mohan" });
  near(D.onHand("rm-p01"), onHand0 + 4100, "received at the gate: InStock");
  assert.equal(D.ordered("rm-p01"), ordered0);

  /* 5 · the cut is made: the raw store is used, the cold store fills, the raw demand is met */
  const cold0 = D.inFreezer("sf-peas");
  run(sf, (t) => t.weigh ? { kgIn: 4030, kgOut: 3100 } : t.bags ? { kgOut: 3100 } : {});
  assert.equal(sf.stateId, "completed");
  near(D.inFreezer("sf-peas"), cold0 + 3100, "Semi Finished InStock");
  near(D.demand("rm-p01").qty, rawBefore, "Purchase Required back to what other batches need");
  near(D.onHand("rm-p01"), onHand0 + 4100 - 4030);

  /* 6 · the finished goods are made from it: the cold store's demand is met, packets in */
  const free0 = D.availableToSell(sku);
  run(fg, (t) => t.weigh ? { kgIn: 3040, kgOut: 3030 } : {});
  assert.equal(fg.stateId, "completed");
  near(D.demand("sf-peas").qty, sfBefore, "Semi Finished Ordered back to what other batches need");
  near(D.inFreezer("sf-peas"), cold0 + 3100 - 3040);
  assert.equal(D.availableToSell(sku), free0 + 3000, "Finished Goods InStock +3,000");

  /* 7 · dispatch fulfils the order */
  const x = D.dispatch(so.id, { by: "Chanchal Sachdeva" });
  assert.equal(x.items.find((i) => i.skuId === sku).qty, 3000);
  D.deliver(x.id, { by: "Driver" });
  assert.equal(D.isOpen(so), false);
  assert.equal(D.demandOf(sku).open, before.open, "Orders back to what other customers wait for");
});

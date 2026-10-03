/* The production store's rules. Run from v7/:  node --test assets/production/test/ */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../production-api.js");

function server() {
  let st = null; const log = [];
  const s = A.createServer({ load: () => st, save: (d) => { st = JSON.parse(JSON.stringify(d)); }, log: (e) => log.push(e) });
  const h = (m, p, q, b, t) => s.handle(m, p, q || {}, b, t);
  const login = (name, pin) => "Bearer " + h("POST", "/api/auth/worker-login", {}, { name, pin }).data.accessToken;
  const D = () => A.Domain(s.snapshot(), () => new Date(), () => {});
  return { s, h, login, log, D, db: () => s.snapshot() };
}

test("the seeded month balances: every lot, bag and packet adds up", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  for (const l of d.lots) assert.ok(l.remaining >= 0 && l.remaining <= l.qty, "lot " + l.lotNo);
  for (const g of d.bags) assert.ok(g.remaining >= 0, "bag " + g.bagNo);
  /* every kg taken from the store is on some batch's ingredient ledger, or the night count's */
  d.materials.forEach((m) => {
    const received = d.lots.filter((l) => l.materialId === m.id && l.qc === "accepted").reduce((s, l) => s + l.qty, 0);
    const issued = d.batches.reduce((s, b) => s + (b.ingredientSummary || []).filter((r) => r.ingredientId === m.id).reduce((a, r) => a + r.issuedQty, 0), 0);
    const counted = d.ledger.filter((e) => e.kind === "rm" && e.item === m.id && e.what === "stock count").reduce((s, e) => s + e.qty, 0);
    assert.ok(Math.abs(received - issued + counted - D.onHand(m.id)) < 0.05, m.name + ": received " + received + " − issued " + issued + " + counted " + counted + " = on hand " + D.onHand(m.id));
  });
  /* today: two semi-finished batches cutting on the floor; the evening's Mix Veg, three
     finished batches across the coming days, and two requests from Sales */
  const open = d.batches.filter((b) => b.stateId !== "closed" && b.stateId !== "completed").map((b) => b.stateId).sort();
  assert.deepEqual(open, ["in-progress", "in-progress", "planned", "planned", "planned", "planned", "planned", "planned"]);
});

test("this morning is the owner's sheet: orders in hand, free stock, the cold store and the raw store", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  const cartons = { "fg-p01": 1200, "fg-p02": 1100, "fg-p03": 900, "fg-p04": 700, "fg-p05": 60, "fg-p06": 1800, "fg-p07": 1500, "fg-p08": 1200, "fg-p09": 900, "fg-p10": 500, "fg-p11": 200 };
  const free = { "fg-p01": 1100, "fg-p02": 950, "fg-p03": 1100, "fg-p04": 700, "fg-p05": 60, "fg-p06": 1500, "fg-p07": 1200, "fg-p08": 1000, "fg-p09": 700, "fg-p10": 400, "fg-p11": 450 };
  d.skus.forEach((s) => {
    assert.equal(D.demandOf(s.id).open, cartons[s.id] * s.perCarton, s.name + " ordered");
    assert.equal(D.availableToSell(s.id), free[s.id], s.name + " in stock");
  });
  assert.deepEqual(d.semiOrder.map((id) => D.inFreezer(id)), [50, 20, 10, 30, 30, 0]);
  assert.deepEqual(["rm-p03", "rm-p10", "rm-p02", "rm-p04", "rm-p01"].map((id) => D.onHand(id) - D.reserved(id)), [50, 100, 25, 100, 200]);
  /* the plan, as the sheet works it: Mixed Veg 200G is 1,80,000 ordered − 1,100 + 500 MSQ */
  assert.equal(D.plan().skus.find((r) => r.skuId === "fg-p01").shortPackets, 179400);
  /* and today's vans are out on every route with yesterday's orders */
  const today = new Date(); today.setHours(0, 0, 0, 0);
  assert.equal(d.deliveries.filter((v) => v.createdAt >= today.toISOString()).length, 3);
});

test("the floor moves the batch: Cut Carrots blanched, frozen and into 50 kg bags in the cold store", () => {
  const { h, login, db } = server();
  const meena = login("Meena", "3333"), farida = login("farida", "5555");
  const live = h("GET", "/api/shifts", { status: "live" }, null, meena).data.shifts[0];
  const avail = (tok) => h("GET", "/api/tasks", { shift: live._id, status: "available", open: "1" }, null, tok).data.tasks;
  const run = (tok, pick, input) => { const t = avail(tok).find(pick); assert.ok(t, "a task to run"); assert.equal(h("POST", "/api/tasks/" + t._id + "/claim", {}, null, tok).status, 200); const r = h("POST", "/api/tasks/" + t._id + "/complete", {}, input || {}, tok); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.task; };
  const carrots = db().batches.find((b) => b.recipeId === "sf-carrots" && b.stateId === "in-progress");
  const bagsBefore = A.Domain(db(), () => new Date(), () => {}).onHand("rm-p08");
  run(farida, (t) => t.batch._id === carrots.id && t.stepName === "Blanch");
  run(farida, (t) => t.batch._id === carrots.id && t.stepName === "IQF freeze");
  const bag = run(meena, (t) => t.batch._id === carrots.id && t.bags, { kgOut: 9900 });
  assert.deepEqual(bag.bagsMade.map((g) => g.kg), [9900], "one lot of bags for the fill");
  const b = db().batches.find((x) => x.id === carrots.id), D = A.Domain(db(), () => new Date(), () => {});
  assert.equal(db().bags.find((g) => g.batchId === b.id).count, 198, "9,900 kg is 198 bags of 50 kg");
  assert.equal(D.onHand("rm-p08"), bagsBefore - 198, "one big bag a bag");
  assert.equal(D.inFreezer("sf-carrots"), 9910);
  assert.equal(b.stateId, "completed");
  assert.equal(b.actualOutcome.actualSemiFinishedKg, 9900);
  assert.deepEqual(b.statusHistory.map((x) => x.toStatusLabel), ["Planned", "In Progress", "Completed"]);
});

/* a finished batch small enough for this morning's cold store: 20 kg of Green Peas */
function peasBatch(D, d, packs) {
  const b = D.createProductionOrder({ recipeId: "green-peas", batchSize: 20, packs: packs || [{ skuId: "fg-p06", qty: 50 }, { skuId: "fg-p10", qty: 2 }], actor: "test" }).batch;
  D.startOnFloor(b.id, { slot: "morning", crew: d.workers.filter((w) => w.role !== "admin").map((w) => w._id) });
  return b;
}
const stepsOf = (d, b) => d.tasks.filter((t) => t.batch === b.id).sort((x, y) => x.stepOrder - y.stepOrder);
const W = (d, name) => d.workers.find((w) => w.name === name);

test("a finished batch mixes from the oldest bags by its recipe and packs its packs in the run", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  const before = D.bagsFIFO("sf-peas").map((g) => g.bagNo), pouch = D.onHand("rm-k06"), cartons = D.onHand("rm-k11");
  const b = peasBatch(D, d);
  const [mix, pack] = stepsOf(d, b);
  assert.deepEqual(stepsOf(d, b).map((t) => t.stepName), ["Take bags from the cold store · check", "Pack the planned packs"]);
  D.claim(mix, W(d, "Meena")); const m = D.complete(mix, W(d, "Meena"), { kgIn: 20, kgOut: 20 });
  assert.equal(m.bagsTaken[0].bagNo, before[0], "the oldest bag goes first");
  assert.equal(D.inFreezer("sf-peas"), 10, "20 of the 30 kg");
  assert.equal(b.ingredientSummary.find((r) => r.ingredientId === "sf-peas").usedQty, 20);
  D.claim(pack, W(d, "Meena")); D.complete(pack, W(d, "Meena"), {});
  assert.equal(D.packetsOf("fg-p06"), 1500 + 50 + d.dispatches.filter((x) => x.status === "Dispatch Created").reduce((t, x) => t + x.items.filter((i) => i.skuId === "fg-p06").reduce((a, i) => a + i.qty, 0), 0));
  assert.equal(D.onHand("rm-k06"), pouch - 50, "one pouch a packet");
  assert.equal(D.onHand("rm-k11"), cartons - 2, "whole 30 kg master cartons: 1 for 50 × 200G, 1 for 2 × 5KG");
  assert.equal(b.stateId, "completed");
});

test("a batch confirmed on the plan can be withdrawn while nothing has happened to it", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  const b = D.createProductionOrder({ recipeId: "sf-cauliflower", batchSize: 23581, where: "Production Plan", actor: "Owner" }).batch;
  const n = d.batches.length;
  D.withdrawBatch(b.id, "Owner");
  assert.equal(d.batches.length, n - 1);
  assert.ok(!D.batch(b.id));
  /* one on the floor stays: it is Batches' to change */
  const running = d.batches.find((x) => x.stateId === "in-progress");
  assert.throws(() => D.withdrawBatch(running.id, "Owner"), (e) => /change it in Batches/.test(e.body.error));
  /* one the store has issued to stays too */
  const c = D.createProductionOrder({ recipeId: "sf-broccoli", batchSize: 50, actor: "Owner" }).batch;
  D.issueFromStore(c.id, "rm-p10", 20, "Mohan");
  assert.throws(() => D.withdrawBatch(c.id, "Owner"), (e) => /issued material/.test(e.body.error));
});

test("a step that can't be covered changes nothing", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  const b = D.createProductionOrder({ recipeId: "mix-veg", batchSize: 1000, actor: "test" }).batch;
  D.startOnFloor(b.id, { slot: "morning", crew: [W(d, "Meena")._id] });
  const [mix] = stepsOf(d, b);
  D.claim(mix, W(d, "Meena"));
  const bagsBefore = JSON.stringify(d.bags);
  assert.throws(() => D.complete(mix, W(d, "Meena"), { kgIn: 1000, kgOut: 995 }), (e) => /in the cold store/.test(e.body.error));
  assert.equal(JSON.stringify(d.bags), bagsBefore);
  assert.equal(mix.status, "in_progress");
});

test("weighing records the loss and flags it over the recipe's limit", () => {
  const { h, login, log } = server();
  const alerts = h("GET", "/api/alerts", {}, null, login("Asha", "1111")).data.alerts;
  /* this morning's carrots: 11,500 kg in, 9,960 out — 13.4% against the 13% their 15% wastage allows */
  assert.ok(alerts.some((a) => a.type === "weight_loss" && /13\.4%/.test(a.message)));
  assert.ok(log.some((e) => e.type === "production.weight.loss"));
  /* the business's own record: the floor, and since 29 Sep the trade around it */
  assert.ok(!log.some((e) => !/^(production|sales|purchase|finance)\./.test(String(e.type))), "only the business's events, never the Control Tower's stream");
});

test("a held batch pauses its steps on the floor", () => {
  const { s, h, login, db } = server();
  const d = db(); const b = d.batches.find((x) => x.stateId === "in-progress" && x.recipeId === "sf-carrots");
  b.stateId = "on-hold"; b.statusLabel = "On Hold";
  s.handle("GET", "/__noop"); // no-op; write the change back through a fresh server over it
  let st = d; const s2 = A.createServer({ load: () => st, save: (x) => { st = x; }, log: () => {} });
  const tok = "Bearer " + s2.handle("POST", "/api/auth/worker-login", {}, { name: "Farida", pin: "5555" }).data.accessToken;
  const t = st.tasks.find((x) => x.batch === b.id && x.status === "available");
  const r = s2.handle("POST", "/api/tasks/" + t._id + "/claim", {}, null, tok);
  assert.equal(r.status, 409);
  assert.match(r.data.error, /on hold/);
  const pool = s2.handle("GET", "/api/tasks", { status: "available", open: "1" }, null, tok).data.tasks;
  assert.ok(!pool.some((x) => x.batch._id === b.id));
});

test("the plan follows the business flow: orders drive Finished Goods, approved batches drive the rest", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  const p = D.plan(), r2 = (n) => Math.round(n * 100) / 100;
  /* Finished Goods: the sheet's need, Ordered − InStock + MSQ */
  p.skus.forEach((r) => assert.equal(r.shortPackets, Math.max(0, r.open + r.msq - r.free), r.name));
  /* Semi Finished: what approved finished batches still need from the cold store, + MSQ − the cold store */
  p.semis.forEach((x) => {
    assert.equal(x.needKg, D.demand(x.recipeId).qty, x.name);
    assert.equal(x.toMakeKg, r2(Math.max(0, x.needKg + x.msq - x.freezerKg)), x.name);
  });
  /* this evening's Mix Veg (10,000 kg) is approved: it needs 2,000 kg of Cut Cauliflower */
  const eve = d.batches.find((b) => b.recipeId === "mix-veg" && b.batchSize === 10000 && b.stateId === "planned");
  assert.ok(D.demand("sf-cauliflower").list.some((x) => x.id === eve.id && x.qty === 2000));
  /* Purchase: what approved batches still need from the store, + MSQ − the store − on order */
  p.materials.forEach((m) => {
    assert.equal(m.need, D.demand(m.id).qty, m.name);
    assert.equal(m.buy, r2(Math.max(0, m.need + D.material(m.id).threshold - m.onHand - m.ordered)), m.name);
  });
});

test("receiving: an accepted lot is stock, a sent-back truck is not", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  const before = D.onHand("rm-p02");
  D.receive({ materialId: "rm-p02", qty: 50, gateQty: 51, qc: "accepted" });
  D.receive({ materialId: "rm-p02", qty: 40, gateQty: 40, qc: "returned" });
  assert.equal(D.onHand("rm-p02"), Math.round((before + 50) * 100) / 100);
  assert.equal(d.lots.slice(-2)[0].gateQty, 51);
});

test("stickers: one per bin, sack or box of a lot, the last one holds what is left", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  const peas = D.receive({ materialId: "rm-p01", qty: 3300, gateQty: 3320, by: "Store · Mohan" });
  const st = D.stickers(peas.lotNo);
  assert.equal(st.length, 4);
  assert.deepEqual([st[0].n, st[0].of, st[0].packName, st[0].qty], [1, 4, "bin", 1000]);
  assert.equal(st[3].qty, 300);
  assert.equal(st.reduce((n, x) => n + x.qty, 0), 3300);
  assert.ok(st.every((x) => x.lotNo === peas.lotNo && x.store === "Cold room" && x.useBy === peas.useBy && x.by === "Store · Mohan"));
  const flour = D.receive({ materialId: "rm-p05", qty: 100 });
  assert.deepEqual(D.stickers(flour.lotNo).map((x) => [x.packName, x.qty]), [["sack", 50], ["sack", 50]]);
  /* a truck sent back at the gate never goes in the store: no stickers */
  const back = D.receive({ materialId: "rm-p03", qty: 40, qc: "returned" });
  assert.deepEqual(D.stickers(back.lotNo), []);
  /* the seeded lots have them too */
  assert.ok(d.lots.filter((l) => l.qc === "accepted").every((l) => D.stickers(l.lotNo).length === l.packs));
});

test("month end: real cost per kg and loss by step and by worker", () => {
  const { db } = server(), me = A.Domain(db(), () => new Date(), () => {}).monthEnd();
  assert.ok(me.batches > 0);
  me.cost.forEach((c) => { assert.ok(c.recipeCostPerKg > 0); if (c.kgMade) assert.ok(c.actualCostPerKg > 0); });
  assert.ok(me.steps.every((s) => s.pct >= 0 && s.kgIn > 0));
  assert.ok(me.workers.some((w) => w.name === "Asha"));
});

test("sign in as: the floor roster, and straight in without a PIN", () => {
  const { h } = server();
  const roster = h("GET", "/api/auth/workers").data.workers;
  assert.ok(roster.length > 0 && roster.every((w) => w.role !== "admin" && !("pin" in w)));
  assert.ok(roster.some((w) => w.onShift));
  const r = h("POST", "/api/auth/worker-login-as", {}, { worker: roster[0]._id });
  assert.equal(r.data.worker.name, roster[0].name);
  assert.equal(h("GET", "/api/auth/me", {}, null, "Bearer " + r.data.accessToken).data.worker._id, roster[0]._id);
  assert.equal(h("POST", "/api/auth/worker-login-as", {}, { worker: "nope" }).status, 404);
});

test("worker app signs in by phone number + PIN, any formatting of the number", () => {
  const { h } = server();
  const ok = h("POST", "/api/auth/worker-login", {}, { phone: "+91 55505 10001", pin: "1111" });
  assert.equal(ok.data.worker.name, "Asha");
  assert.equal(ok.data.worker.phone, "5550510001");
  assert.equal(h("POST", "/api/auth/worker-login", {}, { phone: "5550510001", pin: "9999" }).status, 401);
  assert.equal(h("POST", "/api/auth/worker-login", {}, { phone: "5550510009", pin: "1111" }).status, 401);
  assert.equal(h("POST", "/api/auth/worker-login", {}, { phone: "123", pin: "1111" }).status, 400);
});


/* Recipes › Packaging: the packs are kept once and every screen reads them.
   Run from v7/:  node --test assets/production/test/ */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../production-api.js");

function server() {
  const box = { st: null };
  const s = A.createServer({ load: () => box.st, save: (d) => { box.st = JSON.parse(JSON.stringify(d)); }, log: () => {} });
  const h = (m, p, q, b, t) => s.handle(m, p, q || {}, b, t);
  const login = (name, pin) => "Bearer " + h("POST", "/api/auth/worker-login", {}, { name, pin }).data.accessToken;
  return { s, h, login, box, D: () => A.Domain(box.st, () => new Date(), () => {}) };
}
const fresh = () => { const d = server().s.snapshot(); return { d, D: A.Domain(d, () => new Date(), () => {}) }; };
/* the store's errors carry their words in body.error, as its routes answer */
const refuses = (fn, re) => assert.throws(fn, (e) => re.test(e.body && e.body.error));
const splits = (D, rid) => D.packs(rid).reduce((t, s) => t + s.split, 0);

test("every pack has a pouch in the store, and each product's split adds up to 100", () => {
  const { d, D } = fresh();
  d.skus.forEach((s) => {
    assert.equal(D.material(s.pouchId).kind, "packaging", s.name);
    assert.ok(D.onHand(s.pouchId) > 0, s.name + " has pouches");
  });
  d.recipeOrder.forEach((rid) => assert.equal(splits(D, rid), 100, rid));
  /* a packet costs its product, its pouch and its share of a master carton (60 × 500 g = 30 kg) */
  const c = D.packCost(D.sku("fg-p02"));
  assert.deepEqual([c.product, c.pouch, c.carton, c.total, c.marginPct], [27.42, 2.6, 0.63, 30.65, 64]);
});

test("a new pack is on every screen that lists packs, with its own pouch", () => {
  const { D } = fresh();
  const s = D.savePack({ recipeId: "mixed-veg", grams: 250, perCarton: 120, price: 52, split: 20, newPouchPrice: 2.1 });
  assert.equal(s.id, "fg-p16");
  assert.equal(s.name, "Frozen Mixed Vegetables 250 g");
  assert.equal(s.article, "FG-4016");
  assert.equal(D.material(s.pouchId).name, "Pouch 250 g · Frozen Mixed Vegetables");
  assert.deepEqual(D.packs("mixed-veg").map((x) => x.split), [12, 20, 36, 24, 8], "the others make room, in proportion");
  assert.ok(D.plan().skus.some((r) => r.skuId === s.id), "Production Plan");
  assert.ok(D.packagingLines("mixed-veg").some((l) => l.id === s.id), "Batch Management's pack options");
  refuses(() => D.savePack({ recipeId: "mixed-veg", grams: 250, perCarton: 120, price: 52 }), /already a 250 g pack/);
});

test("a pack that has been made keeps its size; everything else can change", () => {
  const { D } = fresh();
  refuses(() => D.savePack({ id: "fg-p05", grams: 450 }), /its size stays/);
  const s = D.savePack({ id: "fg-p05", price: 85, perCarton: 20 });
  assert.equal(s.price, 85);
  assert.equal(s.perCarton, 20);
  /* a new pack not made yet can still change size */
  const n = D.savePack({ recipeId: "soya-chaap", grams: 200, perCarton: 175, price: 45 });
  assert.equal(D.savePack({ id: n.id, grams: 300 }).name, "Soya Chaap Stick (Normal) 300 g");
});

test("retiring takes a pack off every list and gives its split to the rest", () => {
  const { D } = fresh();
  D.retirePack("fg-p06");
  assert.deepEqual(D.packs("mixed-veg").map((x) => [x.id, x.split]), [["fg-p11", 21], ["fg-p05", 65], ["fg-p12", 14]]);
  assert.ok(!D.plan().skus.some((r) => r.skuId === "fg-p06"));
  assert.ok(!D.packagingLines("mixed-veg").some((l) => l.id === "fg-p06"));
  D.retirePack("fg-p11"); D.retirePack("fg-p12");
  assert.deepEqual(D.packs("mixed-veg").map((x) => [x.id, x.split]), [["fg-p05", 100]]);
  refuses(() => D.retirePack("fg-p05"), /one pack on sale/);
  /* and back on sale */
  D.savePack({ id: "fg-p06", retired: false, split: 40 });
  assert.equal(splits(D, "mixed-veg"), 100);
});

test("packing takes the pack's pouches and whole cartons; the order keeps its carton size", () => {
  const { h, login, box, D } = server();
  const meena = login("Meena", "3333");
  const pouch = D().sku("fg-p05").pouchId;
  const before = { pouches: D().onHand(pouch), cartons: D().onHand("rm-k11") };
  const pk = h("GET", "/api/tasks", { status: "available", open: "1" }, null, meena).data.tasks.find((t) => t.pack);
  const detail = h("GET", "/api/tasks/" + pk._id, {}, null, meena).data.task;
  assert.ok(detail.store.some((m) => m.materialId === pouch), "the worker app shows the pouches to take");
  h("POST", "/api/tasks/" + pk._id + "/claim", {}, null, meena);
  h("POST", "/api/tasks/" + pk._id + "/complete", {}, { packets: 48 }, meena);
  assert.equal(D().onHand(pouch), before.pouches - 48);
  /* the carton size changes after the order was made: the order keeps 60 (a 30 kg master) */
  box.st.skus.find((s) => s.id === "fg-p05").perCarton = 10;
  const ct = h("GET", "/api/tasks", { status: "available" }, null, meena).data.tasks.find((t) => t.cartons);
  h("POST", "/api/tasks/" + ct._id + "/claim", {}, null, meena);
  const done = h("POST", "/api/tasks/" + ct._id + "/complete", {}, {}, meena).data.task;
  assert.equal(done.cartonsPacked, 1);
  assert.equal(D().onHand("rm-k11"), before.cartons - 1);
});

test("the plan buys pouches for short packets and cartons to hold them", () => {
  const { D } = fresh();
  const p = D.plan();
  const short = p.skus.filter((r) => r.shortPackets);
  const pouchNeed = p.materials.find((m) => m.id === D.sku(short[0].skuId).pouchId).need;
  assert.equal(pouchNeed, short.filter((r) => D.sku(r.skuId).pouchId === D.sku(short[0].skuId).pouchId).reduce((t, r) => t + r.shortPackets, 0));
  assert.equal(p.materials.find((m) => m.id === "rm-k11").need, short.reduce((t, r) => t + Math.ceil(r.shortPackets / D.sku(r.skuId).perCarton), 0));
});

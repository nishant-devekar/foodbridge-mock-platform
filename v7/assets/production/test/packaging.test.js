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
  /* a packet costs its product (its semi-finished goods at their own recipe cost, plus the mix),
     its pouch and its share of a 30 kg master carton (60 × 500G) */
  const c = D.packCost(D.sku("fg-p02")), r2 = (n) => Math.round(n * 100) / 100;
  assert.equal(c.product, r2(D.costPerKg("mix-veg") * 0.5));
  assert.deepEqual([c.pouch, c.carton], [2.7, 0.63]);
  assert.equal(c.total, r2(c.product + c.pouch + c.carton));
  /* the chaap's 20 kg bag is its own outer: no carton */
  assert.equal(D.packCost(D.sku("fg-p11")).carton, 0);
  /* Mix Veg's cost is its semi-finished goods by the recipe's %, each at its own recipe's cost */
  const mix = D.book("mix-veg"), parts = mix.ingredients.reduce((t, i) => t + D.costPerKg(i.sfId) * i.qty, 0) + mix.making.reduce((t, m) => t + m.amount, 0);
  assert.ok(Math.abs(D.costPerKg("mix-veg") - parts / 100) < 0.001);
});

test("a new pack is on every screen that lists packs, with its own pouch", () => {
  const { D } = fresh();
  const s = D.savePack({ recipeId: "mix-veg", grams: 300, perCarton: 100, price: 62, split: 20, newPouchPrice: 2.1 });
  assert.equal(s.id, "fg-p12");
  assert.equal(s.name, "Mix Veg 300 g");
  assert.equal(s.article, "FG-4012");
  assert.equal(s.sameRun, true, "packed in the finished batch's run");
  assert.equal(D.material(s.pouchId).name, "Pouch 300 g · Mix Veg");
  assert.equal(splits(D, "mix-veg"), 100, "the others make room");
  assert.equal(D.sku(s.id).split, 20);
  assert.ok(D.plan().skus.some((r) => r.skuId === s.id), "Production Plan");
  assert.ok(D.packagingLines("mix-veg").some((l) => l.id === s.id), "Batch Management's pack options");
  refuses(() => D.savePack({ recipeId: "mix-veg", grams: 300, perCarton: 100, price: 62 }), /already a 300 g pack/);
  /* a semi-finished good is never packed */
  refuses(() => D.savePack({ recipeId: "sf-carrots", grams: 1000, perCarton: 30, price: 50 }), /semi-finished/);
});

test("a pack that has been made keeps its size; everything else can change", () => {
  const { D } = fresh();
  refuses(() => D.savePack({ id: "fg-p02", grams: 450 }), /its size stays/);
  const s = D.savePack({ id: "fg-p02", price: 95, perCarton: 60 });
  assert.equal(s.price, 95);
  /* a new pack not made yet can still change size */
  const n = D.savePack({ recipeId: "soya-chaap", grams: 10000, perCarton: 1, price: 2300 });
  assert.equal(D.savePack({ id: n.id, grams: 15000 }).name, "Soya Chaap 15 kg");
});

test("retiring takes a pack off every list and gives its split to the rest", () => {
  const { D } = fresh();
  D.retirePack("fg-p07");
  assert.equal(splits(D, "green-peas"), 100);
  assert.ok(!D.plan().skus.some((r) => r.skuId === "fg-p07"));
  assert.ok(!D.packagingLines("green-peas").some((l) => l.id === "fg-p07"));
  ["fg-p06", "fg-p08", "fg-p09"].forEach((id) => D.retirePack(id));
  assert.deepEqual(D.packs("green-peas").map((x) => [x.id, x.split]), [["fg-p10", 100]]);
  refuses(() => D.retirePack("fg-p10"), /one pack on sale/);
  /* and back on sale */
  D.savePack({ id: "fg-p07", retired: false, split: 40 });
  assert.equal(splits(D, "green-peas"), 100);
});

test("a finished batch packs in the run: its pouches and whole master cartons", () => {
  const { d, D: Dm } = fresh();
  const before = { pouches: Dm.onHand("rm-k06"), cartons: Dm.onHand("rm-k11") };
  const b = Dm.createProductionOrder({ recipeId: "green-peas", batchSize: 20, packs: [{ skuId: "fg-p06", qty: 90 }], actor: "test" }).batch;
  Dm.startOnFloor(b.id, { slot: "morning", crew: d.workers.filter((w) => w.role !== "admin").map((w) => w._id) });
  const [mix, pack] = d.tasks.filter((t) => t.batch === b.id).sort((x, y) => x.stepOrder - y.stepOrder), meena = d.workers.find((w) => w.name === "Meena");
  Dm.claim(mix, meena); Dm.complete(mix, meena, { kgIn: 20, kgOut: 19.9 });
  Dm.claim(pack, meena); Dm.complete(pack, meena, {});
  assert.equal(Dm.onHand("rm-k06"), before.pouches - 90);
  assert.equal(Dm.onHand("rm-k11"), before.cartons - 1, "90 × 200G is less than a 150-pouch carton: one carton");
});

test("approving a finished batch makes its pouches and master cartons Purchase's demand", () => {
  const { D } = fresh();
  const pouch = D.sku("fg-p02").pouchId, need0 = D.plan().materials.find((m) => m.id === pouch).need, cartons0 = D.demand("rm-k11").qty;
  D.createProductionOrder({ recipeId: "mix-veg", batchSize: 1000, packs: [{ skuId: "fg-p02", qty: 1500 }], actor: "Owner" });
  assert.equal(D.plan().materials.find((m) => m.id === pouch).need, need0 + 1500, "a pouch a packet");
  assert.equal(D.demand("rm-k11").qty, cartons0 + 25, "1,500 × 500G is 25 master cartons of 30 kg");
});

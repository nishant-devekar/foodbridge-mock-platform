/* Recipes as a bill of materials (v9, 3 Oct 2026): a recipe makes a finished
   or a semi-finished good, and any product made here — semi-finished or
   finished — can go into another recipe, at any depth, never in a loop. */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../production-api.js");
const P = require("../plan-tables.js");

function store() {
  const d = A.seed(new Date(), () => {}), D = A.Domain(d, () => new Date(), () => {});
  const run = (b, inputs) => {
    D.startOnFloor(b.id, { slot: "morning", crew: d.workers.filter((w) => w.role !== "admin").map((w) => w._id) });
    d.tasks.filter((t) => t.batch === b.id).sort((x, y) => x.stepOrder - y.stepOrder).forEach((t) => {
      const w = d.workers.find((x) => x.role !== "admin" && !d.tasks.some((y) => y.assignedTo === x._id && y.status === "in_progress"));
      D.claim(t, w); D.complete(t, w, inputs(t));
    });
  };
  return { d, D, run, tables: () => P.build({ read: (fn) => fn(D, d) }) };
}
const says = (re) => (e) => re.test((e.body && e.body.error) || e.message);
const wf = (d, id) => d.workflows.find((w) => w.recipeId === id).steps.slice().sort((a, b) => a.order - b.order);

test("a new semi-finished recipe made from another semi-finished good (two levels of cut)", () => {
  const { d, D, run, tables } = store();
  const bk = D.createRecipe({ name: "Peas Mash", kind: "semi", sizes: [10, 50], bagKg: 10 });
  assert.equal(bk.id, "sf-peas-mash");
  assert.ok(d.semiOrder.includes(bk.id), "listed with the semi-finished goods");
  D.saveIngredient(bk.id, { sfId: "sf-peas", qty: 98 });                         // the cut peas, from their bags
  D.saveIngredient(bk.id, { rmId: "rm-p11", qty: 2, unit: "kg" });               // a binder, from the store
  const steps = wf(d, bk.id);
  assert.ok(steps[0].mixes, "its weighed step now takes the cut peas from the cold store");
  assert.deepEqual(steps[0].takes, ["rm-p11"], "and the binder from the store");
  assert.deepEqual(D.usedIn("sf-peas").map((x) => x.id).sort(), ["green-peas", "mix-veg", "sf-peas-mash"]);

  /* make it: the peas come out of their bags, the binder out of the store */
  const peas = D.inFreezer("sf-peas"), binder = D.onHand("rm-p11");
  const b = D.createProductionOrder({ recipeId: bk.id, batchSize: 20, actor: "Owner" }).batch;
  assert.equal(b.ingredientSummary.find((r) => r.ingredientId === "sf-peas").recommendedQty, 19.6);
  assert.equal(D.demand("sf-peas").list.some((x) => x.id === b.id), true, "approving it raises demand for the cut peas");
  assert.ok(tables().semi.find((l) => l.id === bk.id), "it has its own Semi Finished row");
  run(b, (t) => (t.weigh ? { kgIn: 20, kgOut: 19.5 } : t.bags ? { kgOut: 19.5 } : {}));
  assert.ok(Math.abs(D.inFreezer("sf-peas") - (peas - 19.6)) < 0.05, "19.6 kg of cut peas taken: " + D.inFreezer("sf-peas"));
  assert.ok(Math.abs(D.onHand("rm-p11") - (binder - 0.4)) < 0.05, "0.4 kg of binder taken");
  assert.equal(D.inFreezer(bk.id), 19.5, "19.5 kg of mash bagged");
});

test("a finished good goes into another finished good, from its bulk", () => {
  const { d, D, run, tables } = store();
  const combo = D.createRecipe({ name: "Veg Pulao Mix", kind: "finished" });
  D.saveIngredient(combo.id, { sfId: "green-peas", qty: 70 });                   // the finished Green Peas, as an ingredient
  D.saveIngredient(combo.id, { sfId: "sf-beans", qty: 30 });
  assert.ok(wf(d, "green-peas").some((st) => st.bags), "Green Peas' process now bags what a run does not pack");
  assert.ok(tables().semi.find((l) => l.id === "green-peas" && l.bulk), "Green Peas (bulk) shows on Semi Finished Goods");

  /* a Green Peas run packs part and bags the rest; the combo takes the bags */
  const gp = D.createProductionOrder({ recipeId: "green-peas", batchSize: 30, actor: "Owner", packs: [{ skuId: "fg-p08", qty: 10 }] }).batch;  // 10 × 1 kg packed, 20 kg bulk
  assert.equal(gp.semiFinishedKg, 20);
  assert.ok(tables().semi.find((l) => l.id === "green-peas").batches.some((x) => x.id === gp.id && x.qty === 20), "its 20 kg bulk counts as approved");
  const bulk0 = D.inFreezer("green-peas");
  run(gp, (t) => (t.weigh ? { kgIn: 30, kgOut: 30 } : t.packRun ? {} : t.bags ? { kgOut: 20 } : {}));
  assert.equal(D.inFreezer("green-peas"), bulk0 + 20, "20 kg of Green Peas bulk in bags");
  const c = D.createProductionOrder({ recipeId: combo.id, batchSize: 20, actor: "Owner" }).batch;
  assert.ok(D.demand("green-peas").list.some((x) => x.id === c.id), "approving the combo raises demand for the bulk");
  run(c, (t) => (t.weigh ? { kgIn: 20, kgOut: 19.9 } : {}));
  assert.equal(D.inFreezer("green-peas"), bulk0 + 6, "14 kg of the bulk went into the combo");
});

test("a recipe never takes itself, directly or through another", () => {
  const { D } = store();
  assert.throws(() => D.saveIngredient("mix-veg", { sfId: "mix-veg", qty: 5 }), says(/can't go into itself/));
  assert.throws(() => D.saveIngredient("sf-peas", { sfId: "mix-veg", qty: 5 }), says(/Mix Veg is already made from Green Peas 50 Kg/));
  const pieces = D.createRecipe({ name: "Chaap Pieces", kind: "semi" });
  D.saveIngredient(pieces.id, { sfId: "sf-chaap-dough", qty: 100 });
  assert.throws(() => D.saveIngredient("sf-chaap-dough", { sfId: pieces.id, qty: 1 }), says(/Chaap Pieces is already made from Soya Chaap Dough/));
  assert.ok(D.wouldLoop("sf-chaap-dough", pieces.id));
  assert.equal(D.wouldLoop("soya-chaap", pieces.id), null, "a sibling is fine");
});

test("ingredients change, the floor follows; names are unique; removing frees the floor", () => {
  const { d, D } = store();
  assert.throws(() => D.createRecipe({ name: "mix veg", kind: "finished" }), says(/already a recipe called/));
  assert.throws(() => D.saveIngredient("mix-veg", { sfId: "sf-beans", qty: 0 }), says(/above 0/));
  D.saveIngredient("mix-veg", { sfId: "sf-beans", qty: 15 });                    // change an existing one
  assert.equal(d.book["mix-veg"].ingredients.find((i) => i.sfId === "sf-beans").qty, 15);
  assert.equal(d.book["mix-veg"].ingredients.filter((i) => i.sfId === "sf-beans").length, 1, "changed, not added twice");
  D.saveIngredient("sf-carrots", { rmId: "rm-p11", qty: 1, unit: "kg" });
  assert.ok(wf(d, "sf-carrots").some((st) => st.takes.includes("rm-p11")), "a new stocked material is taken by the weighed step");
  D.removeIngredient("sf-carrots", "rm:rm-p11");
  assert.ok(!wf(d, "sf-carrots").some((st) => st.takes.includes("rm-p11")), "and let go when removed");
  D.saveIngredient("sf-carrots", { name: "Water", qty: 20, unit: "litre" });
  assert.equal(d.book["sf-carrots"].ingredients.find((i) => i.name === "Water").rmId, null, "a plain input is not stocked");
});

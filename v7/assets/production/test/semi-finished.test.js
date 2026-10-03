/* Inventory › Semi-Finished Inventory: stock made but not packed yet.
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
  const admin = () => "Bearer " + h("POST", "/api/auth/admin-login", {}, { email: "admin@jobflow.local", password: "admin1234" }).data.accessToken;
  return { s, h, login, admin, box, D: () => A.Domain(box.st, () => new Date(), () => {}) };
}
const fresh = () => { const d = server().s.snapshot(); return { d, D: A.Domain(d, () => new Date(), () => {}) }; };
const r2 = (n) => Math.round(n * 100) / 100;

test("per semi-finished good: total, reserved for finished batches, available, and what the plan still needs", () => {
  const { d, D } = fresh();
  const plan = D.plan();
  assert.deepEqual(D.semiFinished().map((x) => x.name), ["Cut Cauliflower 50 Kg", "Cut Broccoli 50 Kg", "Cut Carrots 50 Kg", "Cut Beans 50 Kg", "Green Peas 50 Kg", "Soya Chaap Dough"]);
  D.semiFinished().forEach((x) => {
    assert.equal(x.totalKg, D.inFreezer(x.recipeId), x.name + " total is what its containers hold");
    const held = d.batches.filter((b) => b.kind === "production" && ["planned", "in-progress"].includes(b.stateId))
      .reduce((t, b) => t + (b.ingredientSummary || []).filter((r) => r.ingredientId === x.recipeId).reduce((a, r) => a + Math.max(0, r.recommendedQty - (r.usedQty || 0)), 0), 0);
    assert.equal(x.reservedKg, r2(Math.min(x.totalKg, held)), x.name + " reserved");
    assert.equal(x.availableKg, r2(x.totalKg - x.reservedKg));
    const need = plan.semis.find((p) => p.recipeId === x.recipeId).needKg;
    assert.equal(x.shortfallKg, r2(Math.max(0, need - x.totalKg)), x.name + " shortfall");
    assert.equal(x.msq, D.book(x.recipeId).msq);
  });
  /* cut vegetables in 50 kg big bags in the cold store; the dough in tubs in the chiller */
  const cut = D.semiFinished().find((x) => x.recipeId === "sf-carrots"), dough = D.semiFinished().find((x) => x.recipeId === "sf-chaap-dough");
  assert.deepEqual([cut.container, cut.size, cut.store], ["Big bags", 50, "Cold store"]);
  assert.deepEqual([dough.container, dough.store], ["Tubs", "Chiller"]);
  assert.ok(D.semiFinished().find((x) => x.recipeId === "sf-peas").reservedKg > 0, "this evening's Mix Veg holds some Green Peas 50 Kg");
});

test("the fill step says what it fills and where; the bags it fills carry it", () => {
  const { h, admin, box, D } = server();
  const tok = admin();
  /* drums of 25 kg in the dry store, for the chaap dough */
  const wf = h("GET", "/api/workflows", {}, null, tok).data.workflows.find((w) => w.recipeId === "sf-chaap-dough");
  const fill = wf.steps.find((st) => st.bags);
  const saved = h("PUT", "/api/workflows/" + wf._id + "/steps/" + fill._id, {}, { bags: 25, container: "Drums", unit: "kg", store: "Dry store" }, tok);
  assert.equal(saved.status, 200);
  const x = D().semiFinished().find((y) => y.recipeId === "sf-chaap-dough");
  assert.deepEqual([x.container, x.size, x.store], ["Drums", 25, "Dry store"]);
  /* an old step with none of these reads as big bags in kg in the freezer */
  assert.deepEqual(D().fillOf({ bags: 30 }), { size: 30, container: "Big bags", unit: "kg", store: "Freezer" });
  /* a finished recipe's mix step carries its flag through the steps editor */
  const mv = h("GET", "/api/workflows", {}, null, tok).data.workflows.find((w) => w.recipeId === "mix-veg");
  assert.equal(mv.steps[0].mixes, true);
  assert.equal(h("PUT", "/api/workflows/" + mv._id + "/steps/" + mv.steps[0]._id, {}, { mixes: false }, tok).data.workflow.steps[0].mixes, false);
});

test("every bag's history: the batch that filled it and the finished batches that mixed from it", () => {
  const { d, D } = fresh();
  const hist = D.bagHistory();
  assert.equal(hist.length, d.bags.length);
  const taken = hist.filter((g) => g.takenBy.length);
  assert.ok(taken.length > 0, "the seeded fortnight mixed from bags");
  taken.forEach((g) => {
    const kg = g.takenBy.reduce((t, x) => t + x.kg, 0);
    const counted = d.ledger.filter((e) => e.kind === "sf" && e.ref === g.bagNo && e.what === "stock count").reduce((t, e) => t + e.qty, 0);
    assert.ok(Math.abs(g.kg - g.remaining - (g.expiredKg || 0) - kg + counted) < 0.05, "bag " + g.bagNo + ": taken " + kg + " = filled " + g.kg + " − left " + g.remaining + " + counted " + counted);
  });
});

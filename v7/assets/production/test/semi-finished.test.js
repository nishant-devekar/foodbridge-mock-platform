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

test("per product: total, reserved for packing orders, available, and what the short packets still need", () => {
  const { d, D } = fresh();
  const plan = D.plan();
  D.semiFinished().forEach((x) => {
    assert.equal(x.totalKg, D.inFreezer(x.recipeId), x.name + " total is what its containers hold");
    const held = d.batches.filter((b) => b.kind === "packing" && b.recipeId === x.recipeId && ["planned", "in-progress"].includes(b.stateId) && !b.packedPackets)
      .reduce((t, b) => t + b.batchSize, 0);
    assert.equal(x.reservedKg, r2(Math.min(x.totalKg, held)), x.name + " reserved");
    assert.equal(x.availableKg, r2(x.totalKg - x.reservedKg));
    const need = plan.products.find((p) => p.recipeId === x.recipeId).needKg;
    assert.equal(x.shortfallKg, r2(Math.max(0, need - x.availableKg)), x.name + " shortfall");
    /* today's store: big bags in the freezer */
    assert.deepEqual([x.container, x.unit, x.store], ["Big bags", "kg", "Freezer"]);
  });
  const mv = D.semiFinished().find((x) => x.recipeId === "mixed-veg");
  assert.ok(mv.reservedKg > 0, "the seeded packing order holds some Mixed Vegetables");
});

test("a recipe packed in the same run (no fill step, no bags) holds nothing here", () => {
  const { d, D } = fresh();
  d.bags = d.bags.filter((g) => g.recipeId !== "soya-chaap");
  const wf = d.workflows.find((w) => w.recipeId === "soya-chaap");
  wf.steps = wf.steps.filter((st) => !st.bags);
  assert.ok(!D.semiFinished().some((x) => x.recipeId === "soya-chaap"));
});

test("the fill step says what it fills and where; the bags it fills carry it", () => {
  const { h, admin, login, box, D } = server();
  const tok = admin();
  /* drums of 25 kg in the dry store, for soya chaap */
  const wf = h("GET", "/api/workflows", {}, null, tok).data.workflows.find((w) => w.recipeId === "soya-chaap");
  const fill = wf.steps.find((st) => st.bags);
  const saved = h("PUT", "/api/workflows/" + wf._id + "/steps/" + fill._id, {}, { bags: 25, container: "Drums", unit: "kg", store: "Dry store" }, tok);
  assert.equal(saved.status, 200);
  const x = D().semiFinished().find((y) => y.recipeId === "soya-chaap");
  assert.deepEqual([x.container, x.size, x.store], ["Drums", 25, "Dry store"]);
  /* a fill task put on a shift from now copies it, and so do the containers it fills */
  const d = box.st, b = d.batches.find((y) => y.kind === "production" && y.recipeId === "soya-chaap" && y.stateId === "planned");
  if (b) {
    const shift = h("POST", "/api/shifts", {}, { name: "Test", startTime: new Date().toISOString(), batches: [b.id], workers: [] }, tok).data.shift;
    h("POST", "/api/shifts/" + shift._id + "/publish", {}, null, tok);
    const t = box.st.tasks.find((y) => y.batch === b.id && y.bags);
    assert.deepEqual([t.container, t.store, t.bags], ["Drums", "Dry store", 25]);
  }
  /* an old step with none of these reads as big bags in kg in the freezer */
  assert.deepEqual(D().fillOf({ bags: 30 }), { size: 30, container: "Big bags", unit: "kg", store: "Freezer" });
});

test("every bag's history: the batch that filled it and the packing orders that took from it", () => {
  const { d, D } = fresh();
  const hist = D.bagHistory();
  assert.equal(hist.length, d.bags.length);
  const taken = hist.filter((g) => g.takenBy.length);
  assert.ok(taken.length > 0, "the seeded month packed from bags");
  taken.forEach((g) => {
    const kg = g.takenBy.reduce((t, x) => t + x.kg, 0);
    /* a bag past its use-by (mixed vegetables keep 3 days) had the rest written off */
    assert.ok(Math.abs(g.kg - g.remaining - g.expiredKg - kg) < 0.05, "bag " + g.bagNo + ": taken " + kg + " = filled " + g.kg + " − left " + g.remaining + " − expired " + g.expiredKg);
  });
});

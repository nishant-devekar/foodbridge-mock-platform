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
  for (const g of d.bags) assert.ok(g.remaining >= 0 && g.remaining <= g.kg, "bag " + g.bagNo);
  /* every kg taken from the store is on some batch's ingredient ledger */
  d.materials.forEach((m) => {
    const received = d.lots.filter((l) => l.materialId === m.id && l.qc === "accepted").reduce((s, l) => s + l.qty, 0);
    const issued = d.batches.reduce((s, b) => s + (b.ingredientSummary || []).filter((r) => r.ingredientId === m.id).reduce((a, r) => a + r.issuedQty, 0), 0);
    assert.ok(Math.abs(received - issued - D.onHand(m.id)) < 0.05, m.name + ": received " + received + " = issued " + issued + " + on hand " + D.onHand(m.id));
  });
  /* today: two batches on the floor, a packing order, one planned */
  const open = d.batches.filter((b) => b.stateId !== "closed" && b.stateId !== "completed").map((b) => b.stateId).sort();
  assert.deepEqual(open, ["in-progress", "in-progress", "planned", "planned"]);
});

test("the floor moves the batch: first step starts it, the last completes it and bags it", () => {
  const { h, login, db } = server();
  const meena = login("Meena", "3333"), farida = login("farida", "5555");
  const live = h("GET", "/api/shifts", { status: "live" }, null, meena).data.shifts[0];
  const avail = (tok) => h("GET", "/api/tasks", { shift: live._id, status: "available", open: "1" }, null, tok).data.tasks;
  const run = (tok, pick, input) => { const t = avail(tok).find(pick); assert.ok(t, "a task to run"); assert.equal(h("POST", "/api/tasks/" + t._id + "/claim", {}, null, tok).status, 200); const r = h("POST", "/api/tasks/" + t._id + "/complete", {}, input || {}, tok); assert.equal(r.status, 200, JSON.stringify(r.data)); return r.data.task; };
  run(farida, (t) => t.stepName === "Boil (blanch)");
  run(farida, (t) => t.stepName === "Freeze");
  const bag = run(meena, (t) => t.bags, { kgOut: 103.2 });
  assert.deepEqual(bag.bagsMade.map((g) => g.kg), [30, 30, 30, 13.2]);
  const b = db().batches.find((x) => x.id === bag.batch._id);
  assert.equal(b.stateId, "completed");
  assert.equal(b.actualOutcome.actualSemiFinishedKg, 103.2);
  assert.deepEqual(b.statusHistory.map((x) => x.toStatusLabel), ["Planned", "In Progress", "Completed"]);
});

test("packing takes the oldest bags first and posts the packets", () => {
  const { h, login, db } = server();
  const meena = login("Meena", "3333");
  const before = A.Domain(db(), () => new Date(), () => {}).bagsFIFO("mixed-veg").map((g) => g.bagNo);
  const pk = h("GET", "/api/tasks", { status: "available", open: "1" }, null, meena).data.tasks.find((t) => t.pack);
  h("POST", "/api/tasks/" + pk._id + "/claim", {}, null, meena);
  const done = h("POST", "/api/tasks/" + pk._id + "/complete", {}, { packets: 48 }, meena).data.task;
  assert.equal(done.bagsTaken[0].bagNo, before[0], "the oldest bag goes first");
  assert.equal(Math.round(done.bagsTaken.reduce((s, g) => s + g.kg, 0) * 10) / 10, 24);
  const packetsBefore = A.Domain(db(), () => new Date(), () => {}).packetsOf("fg-p05");
  const ct = h("GET", "/api/tasks", { status: "available" }, null, meena).data.tasks.find((t) => t.cartons);
  h("POST", "/api/tasks/" + ct._id + "/claim", {}, null, meena);
  h("POST", "/api/tasks/" + ct._id + "/complete", {}, {}, meena);
  assert.equal(A.Domain(db(), () => new Date(), () => {}).packetsOf("fg-p05"), packetsBefore + 48);
});

test("a step that can't be covered changes nothing", () => {
  const { h, login, db } = server();
  const meena = login("Meena", "3333");
  const pk = h("GET", "/api/tasks", { status: "available", open: "1" }, null, meena).data.tasks.find((t) => t.pack);
  h("POST", "/api/tasks/" + pk._id + "/claim", {}, null, meena);
  const bagsBefore = JSON.stringify(db().bags);
  const r = h("POST", "/api/tasks/" + pk._id + "/complete", {}, { packets: 5000 }, meena);
  assert.equal(r.status, 409);
  assert.match(r.data.error, /in the freezer/);
  assert.equal(JSON.stringify(db().bags), bagsBefore);
  assert.equal(db().tasks.find((t) => t._id === pk._id).status, "in_progress");
});

test("weighing records the loss and flags it over the recipe's limit", () => {
  const { h, login, log } = server();
  const alerts = h("GET", "/api/alerts", {}, null, login("Asha", "1111")).data.alerts;
  assert.ok(alerts.some((a) => a.type === "weight_loss" && /12\.9%/.test(a.message)));
  assert.ok(log.some((e) => e.type === "production.weight.loss"));
  assert.ok(!log.some((e) => !String(e.type).startsWith("production.")), "only production events, never the Control Tower's stream");
});

test("a held batch pauses its steps on the floor", () => {
  const { s, h, login, db } = server();
  const d = db(); const b = d.batches.find((x) => x.stateId === "in-progress" && x.recipeId === "mixed-veg");
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

test("the plan: orders + forecast − packets − freezer − planned, in the recipe's batch sizes", () => {
  const { db } = server(), D = A.Domain(db(), () => new Date(), () => {});
  const p = D.plan();
  p.products.forEach((x) => {
    const sizes = D.book(x.recipeId).sizes;
    x.batches.forEach((z) => assert.ok(sizes.includes(z)));
    assert.ok(x.batches.reduce((a, b) => a + b, 0) >= x.toMakeKg - 0.001);
    assert.equal(x.toMakeKg, Math.max(0, Math.round((x.needKg - x.freezerKg - x.plannedKg) * 100) / 100));
  });
  p.materials.forEach((m) => assert.equal(m.buy, Math.max(0, Math.round((m.need - (m.onHand - m.reserved) - m.ordered) * 100) / 100)));
});

test("receiving: an accepted lot is stock, a sent-back truck is not", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  const before = D.onHand("rm-p02");
  D.receive({ materialId: "rm-p02", qty: 50, gateQty: 51, qc: "accepted" });
  D.receive({ materialId: "rm-p02", qty: 40, gateQty: 40, qc: "returned" });
  assert.equal(D.onHand("rm-p02"), Math.round((before + 50) * 100) / 100);
  assert.equal(d.lots.slice(-2)[0].gateQty, 51);
});

test("stickers: one per sack, crate or box of a lot, the last one holds what is left", () => {
  const { db } = server(), d = db(), D = A.Domain(d, () => new Date(), () => {});
  const peas = D.receive({ materialId: "rm-p01", qty: 330, gateQty: 333, by: "Store · Mohan" });
  const st = D.stickers(peas.lotNo);
  assert.equal(st.length, 17);
  assert.deepEqual([st[0].n, st[0].of, st[0].packName, st[0].qty], [1, 17, "crate", 20]);
  assert.equal(st[16].qty, 10);
  assert.equal(st.reduce((n, x) => n + x.qty, 0), 330);
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

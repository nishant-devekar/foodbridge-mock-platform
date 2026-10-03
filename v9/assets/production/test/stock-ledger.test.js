/* The locked production flow, wired to stock (29 Sep 2026).
   Every fact is recorded once — by the Worker App or by the office — and
   moves the same stock through one ledger. Run from v7/:
     node --test assets/production/test/ */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../production-api.js");

function world() {
  let st = null;
  const s = A.createServer({ load: () => st, save: (d) => { st = JSON.parse(JSON.stringify(d)); }, log: () => {} });
  const h = (m, p, q, b, t) => s.handle(m, p, q || {}, b, t);
  const d = s.snapshot(), D = A.Domain(d, () => new Date(), () => {});
  const W = (name) => d.workers.find((w) => w.name === name);
  /* two batches for the tests, small enough for this morning's stock (3 Oct 2026):
     100 kg of Cut Beans from the raw store, and 20 kg of Green Peas from the cold store */
  const beans = () => D.createProductionOrder({ recipeId: "sf-beans", batchSize: 100, actor: "test" }).batch;
  const peas = () => D.createProductionOrder({ recipeId: "green-peas", batchSize: 20, packs: [{ skuId: "fg-p06", qty: 50 }, { skuId: "fg-p10", qty: 2 }], actor: "test" }).batch;
  const tasks = (b) => d.tasks.filter((t) => t.batch === b.id).sort((x, y) => x.stepOrder - y.stepOrder);
  const run = (t, w, input) => { D.claim(t, w, input); return D.complete(t, w, input); };
  const lotsOf = (id) => d.lots.filter((l) => l.materialId === id).reduce((t, l) => t + l.remaining, 0);
  const push = () => { st = JSON.parse(JSON.stringify(d)); };   /* the server reads this copy next */
  return { s, h, d, D, W, beans, peas, tasks, run, lotsOf, push };
}
const near = (a, b) => Math.abs(a - b) < 0.01;

test("the two levels on the phones: beans cut into Cut Beans; Green Peas mixed from the cold store and packed in the run", () => {
  const { d, D, W, beans, peas, tasks, run, lotsOf } = world();
  /* raw → semi-finished: 100 kg of Cut Beans takes 105 kg of beans (5% wastage) */
  const b = beans(), beansBefore = lotsOf("rm-p04"), bagsBefore = lotsOf("rm-p08"), sfBefore = D.inFreezer("sf-beans");
  D.issueFromStore(b.id, "rm-p04", 100, "Mohan");
  assert.ok(near(lotsOf("rm-p04"), beansBefore - 100));
  D.receive({ materialId: "rm-p04", qty: 20, by: "Store · Mohan" });
  D.releaseToFloor(b.id, "admin", "app");
  const [sort, cut, blanch, iqf, fill] = tasks(b);
  assert.deepEqual(tasks(b).map((t) => t.stepName), ["Sort · grade", "Trim · cut 20 mm · wash", "Blanch", "IQF freeze", "Fill 50 kg bags · into cold store"]);
  run(sort, W("Asha"));
  run(cut, W("Asha"), { kgIn: 105, kgOut: 100 });
  assert.ok(near(lotsOf("rm-p04"), beansBefore + 20 - 105), "the 100 issued first, 5 more from the store");
  run(blanch, W("Farida")); run(iqf, W("Farida"));
  run(fill, W("Meena"), { kgOut: 100 });
  assert.ok(near(D.inFreezer("sf-beans"), sfBefore + 100), "semi-finished +100 kg");
  assert.ok(near(lotsOf("rm-p08"), bagsBefore - 2), "two 50 kg big bags");
  assert.equal(b.stateId, "completed");
  /* semi-finished → finished: 20 kg of Green Peas 50 Kg, packed in the run */
  const f = peas(), pouchBefore = lotsOf("rm-k06"), cartonBefore = lotsOf("rm-k11"), fgBefore = D.packetsOf("fg-p06"), peasBefore = D.inFreezer("sf-peas");
  D.releaseToFloor(f.id, "admin", "app");
  const [mix, pack] = tasks(f);
  assert.equal(pack.packRun, true);
  run(mix, W("Meena"), { kgIn: 20, kgOut: 20 });
  assert.ok(near(D.inFreezer("sf-peas"), peasBefore - 20), "cold store −20 kg");
  run(pack, W("Meena"), {});
  assert.equal(D.packetsOf("fg-p06"), fgBefore + 50, "finished goods +50");
  assert.ok(near(lotsOf("rm-k06"), pouchBefore - 50), "one pouch a packet");
  assert.ok(near(lotsOf("rm-k11"), cartonBefore - 2), "whole 30 kg master cartons");
  assert.equal(f.stateId, "completed");
  assert.equal(D.balance(f).packedKg, 20);
  /* one ledger line per movement, all tied to the batch */
  const mv = D.movementsOfBatch(b.id).concat(D.movementsOfBatch(f.id));
  assert.ok(mv.some((e) => e.kind === "rm" && e.what === "issued" && e.via === "store"));
  assert.ok(mv.some((e) => e.kind === "rm" && e.what === "used" && e.step === "Trim · cut 20 mm · wash" && e.by === "Asha"));
  assert.ok(mv.some((e) => e.kind === "sf" && e.qty === 100 && e.what === "bagged"));
  assert.ok(mv.some((e) => e.kind === "sf" && e.qty === -20 && e.what === "mixed"));
  assert.ok(mv.some((e) => e.kind === "fg" && e.qty === 50 && e.step === "Pack the planned packs"));
});

test("the same batch recorded in the office: same stock, and never on the phones", () => {
  const { h, d, D, W, peas, tasks, push } = world();
  const b = peas(), fgBefore = D.packetsOf("fg-p06"), sfBefore = D.inFreezer("sf-peas");
  D.releaseToFloor(b.id, "admin", "office");
  assert.equal(b.recording, "office");
  push();
  /* the Worker App can't see or claim its steps */
  const tok = "Bearer " + h("POST", "/api/auth/worker-login", {}, { name: "Meena", pin: "3333" }).data.accessToken;
  const shift = d.shifts.find((sh) => sh.batches.includes(b.id) && sh.status === "live");
  const seen = h("GET", "/api/tasks", { shift: shift._id, status: "available", open: "1" }, null, tok).data.tasks;
  assert.ok(!seen.some((t) => t.batch && t.batch._id === b.id));
  assert.equal(h("POST", "/api/tasks/" + tasks(b)[0]._id + "/claim", {}, {}, tok).status, 409);
  /* record all at once, with the same numbers */
  const [mix, pack] = tasks(b);
  D.recordAll(b.id, { workerId: W("Meena")._id, actor: "Priya", steps: { [mix._id]: { kgIn: 20, kgOut: 20 }, [pack._id]: {} } });
  assert.equal(b.stateId, "completed");
  assert.equal(D.packetsOf("fg-p06"), fgBefore + 50);
  assert.ok(near(D.inFreezer("sf-peas"), sfBefore - 20));
  assert.ok(tasks(b).every((t) => t.enteredVia === "office"));
  assert.ok(D.movementsOfBatch(b.id).every((e) => e.via === "office" || e.via === "store"));
});

test("the floor differs: fewer packs than planned; too few pouches blocks before anything moves", () => {
  const { d, D, W, peas, tasks, run } = world();
  const b = peas();
  D.releaseToFloor(b.id, "admin", "app");
  const [mix, pack] = tasks(b);
  run(mix, W("Meena"), { kgIn: 20, kgOut: 20 });
  /* not enough pouches: nothing moves */
  const lot = d.lots.filter((l) => l.materialId === "rm-k06"); const keep = lot.map((l) => l.remaining);
  lot.forEach((l) => { l.remaining = 0; }); lot[0].remaining = 5;
  const fg = D.packetsOf("fg-p06");
  D.claim(pack, W("Meena"));
  assert.throws(() => D.complete(pack, W("Meena"), { packs: { "fg-p06": 50 } }), (e) => /Only 5/.test(e.body.error));
  assert.equal(D.packetsOf("fg-p06"), fg);
  lot.forEach((l, i) => { l.remaining = keep[i]; });
  D.complete(pack, W("Meena"), { packs: { "fg-p06": 40, "fg-p10": 2 } });
  assert.equal(D.balance(b).packedKg, 18);
  assert.equal(b.actualOutcome.lines.find((l) => l.packagingConfigId === "fg-p06").actualUnits, 40);
  assert.equal(b.actualOutcome.settlementRequired, true, "40 of 50 planned: the office settles it");
});

test("return, correction and quarantine keep every store honest", () => {
  const { d, D, W, beans, tasks, run, lotsOf } = world();
  D.receive({ materialId: "rm-p04", qty: 100, by: "Store · Mohan" });
  const b = beans(), beansBefore = lotsOf("rm-p04");
  D.issueFromStore(b.id, "rm-p04", 120, "Mohan");
  D.releaseToFloor(b.id, "admin", "app");
  const [sort, cut, blanch, iqf, fill] = tasks(b);
  run(sort, W("Asha"));
  run(cut, W("Asha"), { kgIn: 160, kgOut: 100 });                 /* typed wrong */
  assert.ok(near(lotsOf("rm-p04"), beansBefore - 160));
  D.correctStep(cut._id, { input: { kgIn: 105, kgOut: 100 }, reason: "160 was a typo", actor: "Priya" });
  assert.ok(near(lotsOf("rm-p04"), beansBefore - 120), "the 40 kg taken beyond the issue went back");
  assert.ok(D.movementsOfBatch(b.id).some((e) => e.what === "corrected"));
  /* 15 kg issued and not used goes back to its lot */
  assert.ok(near(D.unusedIssued(b, "rm-p04"), 15));
  D.returnToStore(b.id, "rm-p04", 15, "Mohan");
  assert.ok(near(lotsOf("rm-p04"), beansBefore - 105));
  assert.throws(() => D.returnToStore(b.id, "rm-p04", 1), (e) => /issued and not used/.test(e.body.error));
  run(blanch, W("Farida")); run(iqf, W("Farida")); run(fill, W("Meena"), { kgOut: 100 });
  /* QC rejects: its bags are held, not mixed */
  const sf = D.inFreezer("sf-beans");
  D.move(b, "rejected", "reject", "QC"); const held = D.quarantine(b, "QC");
  assert.equal(held.kg, 100);
  assert.ok(near(D.inFreezer("sf-beans"), sf - 100));
  D.releaseQuarantine(b.id, "scrap", "QC");
  assert.ok(near(D.inFreezer("sf-beans"), sf - 100), "scrapped stays out");
  assert.ok(D.movements("sf", "sf-beans").some((e) => e.what === "scrapped" && e.qty === -100));
  /* after all of it: received = issued (net of returns) − the night count + on hand, every material */
  d.materials.forEach((m) => {
    const received = d.lots.filter((l) => l.materialId === m.id && l.qc === "accepted").reduce((s, l) => s + l.qty, 0);
    const net = d.batches.reduce((s, x) => s + (x.ingredientSummary || []).filter((r) => r.ingredientId === m.id).reduce((a, r) => a + r.issuedQty - r.returnedQty, 0), 0);
    const counted = d.ledger.filter((e) => e.kind === "rm" && e.item === m.id && e.what === "stock count").reduce((t, e) => t + e.qty, 0);
    assert.ok(Math.abs(received - net + counted - D.onHand(m.id)) < 0.05, m.name);
  });
});

test("slots: schedule, stop and resume, cancel a day, hand over to the next slot", () => {
  const { d, D, W } = world();
  const req = D.notScheduled()[0];
  const nk = D.nextSlot(new Date().toISOString().slice(0, 10), "evening");
  const sh = D.schedule(req.id, nk.date, "morning", "Priya");
  assert.deepEqual(req.when, { date: nk.date, slot: "morning" });
  assert.ok(!D.notScheduled().some((x) => x.id === req.id));
  D.cancelSlot(sh._id, "Holiday", "Priya");
  assert.ok(D.notScheduled().some((x) => x.id === req.id), "back to Not scheduled");
  assert.deepEqual(req.wasScheduled, { date: nk.date, slot: "morning" });
  /* the running morning: stop holds its running batches, resume brings them back */
  const morning = d.shifts.find((x) => x.status === "live");
  const running = morning.batches.map(D.batch).filter((b) => b.stateId === "in-progress");
  D.stopSlot(morning._id, "Power cut", "Priya");
  assert.ok(running.every((b) => b.stateId === "on-hold"));
  D.resumeSlot(morning._id, "Priya");
  assert.ok(running.every((b) => b.stateId === "in-progress"));
  /* hand over: the open steps move to the evening, with the note */
  const veg = running[0];
  const r = D.handOver(morning._id, { note: "Veg washed, blanch next", actor: "Priya" });
  assert.equal(morning.status, "ended");
  assert.equal(r.to.slot, "evening");
  assert.ok(d.tasks.filter((t) => t.batch === veg.id && t.status !== "done").every((t) => t.shift === r.to._id));
  assert.equal(veg.operatorHandoverHistory.slice(-1)[0].toOperator, r.to.inCharge);
  assert.equal(r.to.takeover.note, "Veg washed, blanch next");
  D.takeOver(r.to._id, "Suresh");
  assert.ok(r.to.takeover.takenAt);
});

test("a batch recorded in the office: a late step asks the office to record it, not the floor", () => {
  const { D, W, beans, tasks } = world();
  const b = beans();
  D.releaseToFloor(b.id, "admin", "office");
  const first = tasks(b)[0];
  first.availableAt = new Date(Date.now() - 45 * 60000).toISOString();
  const mine = D.alerts().filter((a) => a.batch === b.id);
  assert.deepEqual(mine.map((a) => a.type), ["to_record"], "one line for the batch, no 'nobody started it'");
  assert.equal(mine[0].step, first.stepName);
  D.recordStep(first._id, { workerId: W("Suresh")._id, input: {}, actor: "admin" });
  assert.equal(D.alerts().filter((a) => a.batch === b.id && a.step === first.stepName).length, 0);
});

test("shift settings: add a Night shift, it chains after Evening; overlaps and busy removals are refused; a batch's supervisor is its shift's in-charge", () => {
  const { d, D, W } = world();
  assert.deepEqual(D.slotList().map((x) => x.name), ["Morning", "Evening"]);
  assert.throws(() => D.saveShiftType({ name: "Late", start: 20, end: 4, inCharge: "Suresh Kumar" }), (e) => /overlaps the Evening/.test(e.body.error));
  const night = D.saveShiftType({ name: "Night", start: 23, end: 7, inCharge: "Dharmendar Ji", crew: [W("Kiran")._id] });
  assert.equal(night.id, "night");
  assert.equal(D.shiftHours(night), 8);
  assert.deepEqual(D.nextSlot("2026-09-29", "evening"), { date: "2026-09-29", slot: "night" });
  assert.equal(D.nextSlot("2026-09-29", "night").slot, "morning");
  /* at 2 am the Night shift that's running is the one that started yesterday */
  const late = A.Domain(d, () => new Date(2026, 8, 30, 2, 0), () => {});
  assert.deepEqual(late.currentKey(), { date: "2026-09-29", slot: "night" });
  const sh = D.ensureSlot("2026-09-29", "night");
  assert.equal(new Date(sh.endTime).getDate(), 30, "ends the next morning");

  /* the supervisor follows the shift, on All batches too */
  const b = D.notScheduled()[0];
  D.schedule(b.id, "2026-09-29", "night", "admin");
  assert.equal(b.operator, "Dharmendar Ji");
  D.setCrew(sh._id, { inCharge: "Priya Sharma" });
  assert.equal(b.operator, "Priya Sharma");
  assert.throws(() => D.removeShiftType("night"), (e) => /Move them first/.test(e.body.error));
  D.unschedule(b.id);
  D.removeShiftType("night");
  assert.deepEqual(D.slotList().map((x) => x.id), ["morning", "evening"]);
  assert.throws(() => D.setWorkingDays([]), (e) => /at least one/.test(e.body.error));
});

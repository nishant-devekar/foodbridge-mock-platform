/* The Production board (28 Sep 2026): one page for plan, floor and crew.
   Run from v7/:  node --test assets/production/test/ */
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../production-api.js");

function server() {
  let st = null;
  const s = A.createServer({ load: () => st, save: (d) => { st = JSON.parse(JSON.stringify(d)); }, log: () => {} });
  const h = (m, p, q, b, t) => s.handle(m, p, q || {}, b, t);
  const D = (d) => A.Domain(d, () => new Date(), () => {});
  return { s, h, D };
}

test("put on the floor: joins today's evening shift, adds the crew, makes the tasks", () => {
  const { s, D } = server(), d = s.snapshot(), dom = D(d);
  const planned = d.batches.filter((b) => b.stateId === "planned" && b.kind === "production")[0];
  const kiran = d.workers.find((w) => w.name === "Kiran");
  const before = d.shifts.length;
  const r = dom.startOnFloor(planned.id, { slot: "evening", crew: [kiran._id] });
  assert.equal(d.shifts.length, before, "the seeded evening shift is joined, not duplicated");
  assert.equal(r.shift.status, "live");
  assert.ok(r.shift.workers.includes(kiran._id));
  assert.ok(r.shift.batches.includes(planned.id));
  const tasks = d.tasks.filter((t) => t.batch === planned.id && t.shift === r.shift._id);
  assert.ok(tasks.length > 0 && tasks.some((t) => t.status === "available"));
  /* again: no second set of tasks */
  dom.startOnFloor(planned.id, { slot: "evening", crew: [kiran._id] });
  assert.equal(d.tasks.filter((t) => t.batch === planned.id && t.shift === r.shift._id).length, tasks.length);
});

test("put on the floor: needs a crew, and only a planned or running batch", () => {
  const { s, D } = server(), d = s.snapshot(), dom = D(d);
  const planned = d.batches.filter((b) => b.stateId === "planned")[0];
  assert.throws(() => dom.startOnFloor(planned.id, { slot: "morning", crew: [] }), (e) => /crew/.test(e.body.error));
  const closed = d.batches.filter((b) => b.stateId === "closed" || b.stateId === "completed")[0];
  assert.throws(() => dom.startOnFloor(closed.id, { slot: "morning", crew: [d.workers[0]._id] }), (e) => /floor/.test(e.body.error));
});

test("needs you says who to call: the worker, the batch's supervisor, the purchase person", () => {
  const { s, D } = server(), d = s.snapshot(), dom = D(d);
  const t = d.tasks.find((x) => x.status === "in_progress");
  d.updates.push({ _id: "u1", task: t._id, worker: t.assignedTo, quickSelect: "need_materials", createdAt: new Date().toISOString() });
  const help = dom.alerts().find((a) => a.type === "help");
  const w = d.workers.find((x) => x._id === t.assignedTo);
  assert.equal(help.call.name, w.name);
  assert.equal(help.call.contact, w.phone);
  const loss = dom.alerts().find((a) => a.type === "weight_loss");
  assert.ok(loss.call && loss.call.contact, "the worker who weighed it");
  const idle = dom.alerts().find((a) => a.type === "waiting");
  if (idle) assert.ok(idle.call && idle.call.role === "Supervisor");
  assert.equal(dom.purchase().role, "Purchase");
  /* sorted: the call clears itself */
  d.updates.push({ _id: "u2", task: t._id, worker: t.assignedTo, quickSelect: "sorted", createdAt: new Date(Date.now() + 1000).toISOString() });
  assert.equal(dom.alerts().filter((a) => a.type === "help").length, 0);
});

test("Start in Batch Management puts the batch on today's floor, with who's in", () => {
  const { s, D } = server(), d = s.snapshot(), dom = D(d);
  const b = d.batches.find((x) => x.stateId === "planned" && x.kind === "production");
  dom.move(b, "in-progress", "start", "admin");
  const r = dom.releaseToFloor(b.id, "admin");
  assert.equal(r.shift.status, "live");
  const online = d.workers.filter((w) => w.role !== "admin" && w.isOnline).map((w) => w._id);
  online.forEach((id) => assert.ok(r.shift.workers.includes(id)));
  assert.ok(d.tasks.some((t) => t.batch === b.id && t.status === "available"));
});

test("a shift that has ended hands its planned and running batches to the next shift on its own", () => {
  const { s, D } = server(), d = s.snapshot();
  const clock = { t: Date.now() };
  const dom = A.Domain(d, () => new Date(clock.t), () => {});
  const b = d.batches.filter((x) => x.stateId === "planned" && x.kind === "production" && !x.when)[0];
  const today = new Date(clock.t), key = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const sh = dom.ensureSlot(key, "evening");
  if (sh.status === "cancelled") sh.status = "scheduled";
  dom.schedule(b.id, key, "evening", "test");
  clock.t = new Date(sh.endTime).getTime() + 60000;            // the evening shift is over
  const moved = dom.rollOver();
  assert.ok(moved >= 1);
  assert.equal(sh.status, "ended");
  assert.ok(sh.handover && sh.handover.batches.some((x) => x.batchId === b.id));
  const next = dom.nextSlot(key, "evening");
  assert.deepEqual(b.when, next, "the planned batch is now on the next shift");
  assert.equal(dom.rollOver(), 0, "nothing moves twice");
});

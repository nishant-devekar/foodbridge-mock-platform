/* Control Tower · the live demo business, headless. Run from v7/:
     node --test test/control-tower/*.test.js
   Owner, 22 Sep 2026: no lever "not connected"; a realtime tower. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");
const S = require("../../assets/ct/signals.js");
window.CTSignals = S;
const L = require("../../assets/ct/levers.js");
window.CTLevers = L;
window.FB_DATASET = F.dataset;
const D = require("../../assets/ct/demo.js");

const AFTERNOON = new Date("2026-09-22T09:30:00Z").getTime();     // 3 pm in India
function day(now) {
  const w = F.world({ dataReady: D.dataReady(now), now });
  D.ensureDay(w.store, w.tower.pass(), now);
  const v = w.tower.pass();
  return { w, v, m: L.build(v, { demand: S._detectors.demand(v.state) }) };
}

test("the demo business is dated to today: its last order was yesterday", () => {
  const { v, m } = day(AFTERNOON);
  assert.equal(v.state.dataEnd, "2026-09-21");
  assert.equal(m.stale, false, "no 'as of' line");
});

test("no lever is ever 'not connected' in the demo", () => {
  const { m } = day(AFTERNOON);
  for (const lv of m.levers) assert.notEqual(lv.status, "preview", lv.id);
  assert.ok(m.overview.rows.every((r) => r.status !== "preview"));
});

test("today's route: stops whose time has passed are recorded, the rest are to deliver", () => {
  const { v, m } = day(AFTERNOON);
  const d = m.levers.find((x) => x.id === "deliveries");
  const route = v.records.route;
  assert.ok(route.stops.length >= 12);
  const passed = route.stops.filter((s) => new Date(s.slot).getTime() <= AFTERNOON).length;
  assert.equal(d.tiles.good.count + d.tiles.ugly.rows.filter((r) => r.note === "Shop closed" || /Payment|Refused/.test(r.note)).length >= 1, true);
  assert.ok(d.tiles.bad.count <= route.stops.length - passed + 1, "only what is still ahead is to deliver");
  assert.ok(d.facts[0].value !== "₹0", "money collected at the door");
});

test("the same day plays the same way on every reload", () => {
  const a = day(AFTERNOON).m.levers.map((x) => x.headline.value);
  const b = day(AFTERNOON).m.levers.map((x) => x.headline.value);
  assert.deepEqual(a, b);
});

test("the live clock moves the business: a delivery or a payment every tick", () => {
  const { w } = day(AFTERNOON);
  const events = [];
  for (let i = 1; i <= 6; i++) { const ev = D.tick(w.store, w.tower.pass(), AFTERNOON + i * 20000); if (ev) events.push(ev); }
  assert.ok(events.length >= 4, "something happens on most ticks");
  assert.ok(events.every((e) => e.text && ["deliveries", "collections"].includes(e.lever)));
});

test("a working business: some levers Good, not all red", () => {
  const { m } = day(AFTERNOON);
  assert.ok(m.levers.some((x) => x.status === "good"), "something to feel good about");
  assert.ok(m.levers.some((x) => x.status !== "good"), "something to act on");
});

/* Owner, 22 Sep 2026: the demo stays in balance however long it is left open.
   Door cash pays for the drop; the counter stops at a floor of the overdue
   the business opened with. */
const overdueOf = (v, now) => v.state.ledger.invoices
  .filter((i) => i.balance > 0 && i.dueDate && new Date(i.dueDate + "T00:00:00Z").getTime() < now)
  .reduce((t, i) => t + i.balance, 0);
const counterPaid = (v) => v.records.payments.filter((p) => p.source === "demo-counter").reduce((t, p) => t + p.amount, 0);
function run(w, from, ticks) {
  const events = [];
  for (let i = 1; i <= ticks; i++) { const ev = D.tick(w.store, w.tower.pass(), from + i * 20000); if (ev) events.push(ev.text); }
  return events;
}
const collections = (v) => L.build(v, { demand: S._detectors.demand(v.state) }).levers.find((x) => x.id === "collections");

test("cash at the door pays for that drop, not the customer's old invoices", () => {
  const { v } = day(AFTERNOON);
  const door = v.records.payments.filter((p) => p.via);
  assert.ok(door.length > 0, "the route collected money");
  assert.ok(door.every((p) => p.forDrop));
  const untouched = F.world({ dataReady: D.dataReady(AFTERNOON), now: AFTERNOON }).tower.pass();
  assert.deepEqual(v.state.ledger.invoices.map((i) => i.balance), untouched.state.ledger.invoices.map((i) => i.balance));
});

test("a page left open for hours keeps the business in balance", () => {
  const { w, v } = day(AFTERNOON);
  const opening = overdueOf(v, AFTERNOON);
  const before = collections(v);
  run(w, AFTERNOON, 3 * 180);                                             // three hours, past the last stop
  const after = w.tower.pass();
  const c = collections(after);
  const now = AFTERNOON + 3 * 180 * 20000;
  assert.equal(opening, D._openingOverdue(AFTERNOON), "door cash left the old invoices alone");
  assert.ok(overdueOf(after, now) >= D.FLOOR * D._openingOverdue(now), "never paid down below the floor");
  assert.ok(overdueOf(after, now) < opening, "customers did pay at the counter");
  assert.notEqual(c.headline.value, "₹0 overdue");
  assert.ok([c.tiles.good, c.tiles.bad, c.tiles.ugly].some((t) => t.value !== "₹0") && c.tiles.ugly.value !== "₹0");
  assert.equal(c.status, before.status, "the dot does not move on its own");
});

test("the next day opens fresh, and the floor still holds", () => {
  const storage = F.CTStore.memory();
  const w1 = F.world({ dataReady: D.dataReady(AFTERNOON), now: AFTERNOON, storage });
  D.ensureDay(w1.store, w1.tower.pass(), AFTERNOON);
  run(w1, AFTERNOON, 540);
  const NEXT = AFTERNOON + 86400000;
  const w2 = F.world({ dataReady: D.dataReady(NEXT), now: NEXT, storage });
  D.ensureDay(w2.store, w2.tower.pass(), NEXT);
  const paidBefore = counterPaid(w2.tower.pass());
  run(w2, NEXT, 540);
  const v = w2.tower.pass();
  const od = overdueOf(v, NEXT + 540 * 20000);
  assert.ok(counterPaid(v) > paidBefore, "customers pay on the second day as well");
  assert.ok(od >= D.FLOOR * D._openingOverdue(NEXT + 540 * 20000), "not drained across days");
});

test("a long session still plays the same way on every reload", () => {
  const a = day(AFTERNOON), b = day(AFTERNOON);
  assert.deepEqual(run(a.w, AFTERNOON, 300), run(b.w, AFTERNOON, 300));
  assert.equal(collections(a.w.tower.pass()).headline.value, collections(b.w.tower.pass()).headline.value);
});

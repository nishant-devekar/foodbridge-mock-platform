/* Control Tower · Deliveries, on time and in full. Run from v7/:
     node --test test/control-tower/*.test.js
   Owner, 22 Sep 2026: "How do I fulfil every committed order on time with
   limited people, vehicles and inventory?" */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");
const S = require("../../assets/ct/signals.js");
window.CTSignals = S;
const L = require("../../assets/ct/levers.js");
window.CTLevers = L;
window.FB_DATASET = F.dataset;
const D = require("../../assets/ct/demo.js");

const at = (hIST) => Date.UTC(2026, 8, 22) + (hIST - 5.5) * 3600e3;
function day(now) {
  const w = F.world({ dataReady: D.dataReady(now), now });
  D.ensureDay(w.store, w.tower.pass(), now);
  const v = w.tower.pass();
  return { w, v, d: L.build(v, { demand: S._detectors.demand(v.state) }).levers.find((x) => x.id === "deliveries") };
}
const notes = (d) => d.tiles.ugly.rows.map((r) => r.note);
/* An item's incident tag, on any row of any tile (owner, 23 Sep 2026). */
const tagged = (d, type) => [].concat(d.tiles.good.rows, d.tiles.bad.rows, d.tiles.ugly.rows).filter((r) => r.tag && r.tag.type === type);

test("the demo day: two vans, two rounds each, a load per round", () => {
  const { v } = day(at(13.5));
  const r = v.records.route;
  assert.deepEqual([...new Set(r.stops.map((s) => s.van))].sort(), ["Van 1", "Van 2"]);
  assert.deepEqual([...new Set(r.stops.map((s) => s.round))].sort(), [1, 2]);
  assert.ok(r.vanCases > 0);
});

test("the demo day: a late first trip carries down its van's route, and the other van waits at the dock", () => {
  const { v } = day(at(13.5));
  const s = v.records.route.stops;
  const late = s.filter((x) => x.delayWhy === "Loading ran late");
  assert.ok(late.length && late.every((x) => x.delayMin >= 30), "the late van's first round");
  assert.ok(s.some((x) => x.delayWhy === "First trip ran late"), "its second round inherits it");
  const vanOf = late[0].van;
  const r1 = s.filter((x) => x.van === vanOf && x.round === 1).map((x) => x.delayMin);
  const r2 = s.filter((x) => x.van === vanOf && x.round === 2).map((x) => x.delayMin);
  assert.ok(Math.min(...r2) > Math.min(...r1), "the second round leaves later still");
  assert.ok(s.some((x) => x.delayWhy === "Waited at the dock"), "one loading crew");
});

test("the demo day: the afternoon round is booked past the van's load; what doesn't fit is missed when the van leaves", () => {
  const { v, d } = day(at(16));
  const s = v.records.route.stops;
  const over = s.filter((x) => x.overbooked);
  assert.ok(over.length >= 1, "overbooked");
  const van = over[0].van;
  const load = s.filter((x) => x.van === van && x.round === 2).reduce((n, x) => n + x.cases, 0);
  assert.ok(load > v.records.route.vanCases, "booked past the load");
  assert.ok(notes(d).includes("Van full"), "shows under Missed");
});

test("Deliveries in the demo is Urgent: late, short and missed drops fail on time and in full", () => {
  for (const h of [11, 13.5, 16]) {
    const { d } = day(at(h));
    assert.equal(d.status, "ugly", h + ":00 IST");
    assert.ok(d.health.value < 0.5 && /on time and in full/.test(d.health.what));
  }
  const { d } = day(at(16));
  assert.ok(tagged(d, "late").some((r) => /^Late \d/.test(r.note)), "late drops tagged Late");
  assert.ok(tagged(d, "short").length, "short drops tagged Short");
  assert.ok(tagged(d, "missed").every((r) => r.tag.action && r.next === r.tag.action), "every tag has its step, and the row says it");
  assert.match(d.headline.context, /\d+ late/);
});

test("a stop past its slot and still on the road is late already: flagged in progress, and it counts against on time", () => {
  const { d } = day(at(13.5));
  const running = d.tiles.bad.rows.filter((r) => /^Running .* late/.test(r.note));
  assert.ok(running.length, "the customer is waiting");
  assert.ok(d.tiles.bad.rows[0].running, "running late leads To deliver");
  assert.ok(!d.tiles.ugly.rows.some((r) => /^Running/.test(r.note)), "in one tile, not two");
  assert.equal(d.runningCount, running.length, "and it is due, so on time counts it");
});

test("a real delivery with no lateness or shortage recorded counts as on time and in full", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addDeliveries(cust.slice(0, 4).map((c) => ({ customerId: c.id, status: "delivered" }))
    .concat([{ customerId: cust[4].id, status: "delivered", lateMin: 45 }]));
  const v = w.tower.pass();
  const d = L.build(v, { demand: S._detectors.demand(v.state) }).levers.find((x) => x.id === "deliveries");
  assert.equal(d.health.value, 0.8, "4 of 5 on time and in full");
  assert.ok(tagged(d, "late").some((r) => r.note === "Late 45 min"), "tagged Late, still delivered");
  assert.ok(d.tiles.good.rows.some((r) => r.note === "Late 45 min"), "under On track");
});

test("a missed stop rescheduled for another day leaves today's route; rescheduled for today, it is back on it", () => {
  const now = at(16);
  const { w, v } = day(now);
  const miss = v.records.deliveries.find((d) => d.status === "missed" && d.orderNo);
  assert.ok(miss, "the demo day has a missed stop");
  const todayIso = new Date(now).toISOString().slice(0, 10);
  const later = new Date(now + 2 * 86400e3).toISOString().slice(0, 10);
  const build = () => { const x = w.tower.pass(); return L.build(x, { demand: S._detectors.demand(x.state) }).levers.find((l) => l.id === "deliveries"); };

  w.store.rescheduleDeliveries([miss.no], later, { rescheduledWindow: "evening" });
  let d = build();
  assert.ok(!d.tiles.bad.rows.some((r) => r.id === miss.orderNo), "not due today");
  assert.ok(d.tiles.bad.rows.some((r) => r.id === miss.customerId && /^Rescheduled · .* · Evening$/.test(r.note)), "listed as rescheduled, with its window");
  assert.ok(!d.tiles.ugly.rows.some((r) => r.id === miss.no), "no longer missed");

  w.store.rescheduleDeliveries([miss.no], todayIso);
  d = build();
  assert.ok(d.tiles.bad.rows.some((r) => r.id === miss.orderNo), "back on today's route");
  assert.ok(!d.tiles.bad.rows.some((r) => r.id === miss.customerId && /^Rescheduled/.test(r.note) && r.kind === "customer"), "and not twice");
});

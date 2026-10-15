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
/* An item's incident tag, by its catalogue type (owner, 24 Sep 2026). */
const rows = (d) => [].concat(d.tiles.good.rows, d.tiles.bad.rows, d.tiles.ugly.rows);
const tagged = (d, type) => rows(d).filter((r) => r.tag && r.tag.type === type);

test("the demo day: two vans, two rounds each, a load per round, and a spare at the dock", () => {
  const { v } = day(at(13.5));
  const r = v.records.route;
  assert.deepEqual([...new Set(r.stops.map((s) => s.van))].sort(), ["Van 1", "Van 2"]);
  assert.deepEqual([...new Set(r.stops.map((s) => s.round))].sort(), [1, 2]);
  assert.ok(r.vanCases > 0);
  assert.deepEqual(r.spares.map((x) => x.van), ["Van 3"]);
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

test("the demo day: the afternoon round is booked past the van's load; what doesn't fit is Missed as Van full", () => {
  const { v, d } = day(at(16));
  const s = v.records.route.stops;
  const over = s.filter((x) => x.overbooked);
  assert.ok(over.length >= 1, "overbooked");
  const van = over[0].van;
  const load = s.filter((x) => x.van === van && x.round === 2).reduce((n, x) => n + x.cases, 0);
  assert.ok(load > v.records.route.vanCases, "booked past the load");
  assert.ok(d.tiles.ugly.rows.some((r) => r.tag && r.tag.type === "van-full"), "shows under Missed");
});

test("Deliveries in the demo is Urgent while anything needs the owner, and says what is at risk", () => {
  for (const h of [11, 13.5, 16]) {
    const { d } = day(at(h));
    assert.equal(d.status, "ugly", h + ":00 IST");
    assert.ok(d.tiles.ugly.count >= 1);
  }
  const { d } = day(at(16));
  assert.ok(tagged(d, "window-missed").some((r) => r.tag.state === "resolved" && /min late$/.test(r.note)), "late drops delivered: Late, fixed");
  assert.ok(tagged(d, "short-quantity").length, "short drops tagged Short");
  assert.ok(d.tiles.ugly.rows.every((r) => r.tag && (r.next || r.tag.state !== "open")), "every open row under Missed says its one step");
  assert.match(d.headline.context, /₹[\d,]+ at risk/);
});

test("a stop past its slot and still on the road is Missed; a van with several is one row that holds them", () => {
  const { d } = day(at(15));
  const late = d.incidents.incidents.filter((i) => i.type === "window-missed" && i.state === "open");
  assert.ok(late.length, "the customer is waiting");
  assert.ok(late.every((i) => i.standing === "ugly"));
  const van = d.incidents.roots.find((r) => r.type === "driver-delayed");
  if (late.length >= 2) {
    assert.ok(van, "the late van");
    assert.ok(d.tiles.ugly.rows.some((r) => r.kind === "van" && r.id === van.id));
    assert.ok(!d.tiles.ugly.rows.some((r) => van.children.includes(r.id)), "in one row, not one each");
  }
});

test("a real delivery with no lateness or shortage recorded counts as on time and in full", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addDeliveries(cust.slice(0, 4).map((c) => ({ customerId: c.id, status: "delivered" }))
    .concat([{ customerId: cust[4].id, status: "delivered", lateMin: 45 }]));
  const v = w.tower.pass();
  const d = L.build(v, { demand: S._detectors.demand(v.state) }).levers.find((x) => x.id === "deliveries");
  assert.equal(d.health.value, 0.8, "4 of 5 on time and in full");
  const late = tagged(d, "window-missed")[0];
  assert.ok(late && /45 min late$/.test(late.note) && late.tag.state === "resolved", "Late, and delivered: fixed");
  assert.ok(d.tiles.good.rows.includes(late), "under On track");
  assert.equal(d.status, "good", "nothing open: all green");
});

test("a missed stop rescheduled for another day is Pending, being fixed; rescheduled for today it is back on the route", () => {
  const now = at(16);
  const { w, v } = day(now);
  const miss = v.records.deliveries.find((d) => d.status === "missed" && d.orderNo && d.reason !== "Van full" && d.reason !== "Owner away");
  assert.ok(miss, "the demo day has a missed stop");
  const todayIso = new Date(now).toISOString().slice(0, 10);
  const later = new Date(now + 2 * 86400e3).toISOString().slice(0, 10);
  const build = () => { const x = w.tower.pass(); return L.build(x, { demand: S._detectors.demand(x.state) }).levers.find((l) => l.id === "deliveries"); };

  w.store.rescheduleDeliveries([miss.no], later, { rescheduledWindow: "evening" });
  let d = build();
  const r = d.tiles.bad.rows.find((x) => x.id === miss.orderNo);
  assert.ok(r && /^Rescheduled · .* evening$/.test(r.note), "Pending, with its day and window");
  assert.ok(!d.tiles.ugly.rows.some((x) => x.id === miss.orderNo), "no longer Missed");

  w.store.rescheduleDeliveries([miss.no], todayIso, { rescheduledWindow: "evening" });
  d = build();
  assert.ok(d.tiles.bad.rows.some((x) => x.id === miss.orderNo && /^Rescheduled · Today evening$/.test(x.note)), "back on today's route");
  assert.equal(d.tiles.bad.rows.filter((x) => x.id === miss.orderNo).length, 1, "and not twice");
});

test("every row says where it stands, so a row with nothing wrong reads like the others", () => {
  for (const h of [11, 13.5, 16]) {
    const { d } = day(at(h));
    const want = { good: "delivered", bad: "pending", ugly: "missed" };
    for (const k of ["good", "bad", "ugly"]) {
      assert.ok(d.tiles[k].rows.every((r) => r.stand === want[k]), h + ":00 IST · " + k + " rows stand " + want[k]);
    }
    const clean = d.tiles.good.rows.filter((r) => !r.tag);
    assert.ok(clean.every((r) => /^(Paid ₹.* at the door|On credit)$/.test(r.note)), "a clean drop says how it was paid");
  }
});

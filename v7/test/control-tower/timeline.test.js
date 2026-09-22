/* Control Tower · Updates, the business's news. Run from v7/:
     node --test test/control-tower/*.test.js
   Owner, 22 Sep 2026: "business timeline activity like the user's business
   news bulletins … the way we had Wins, but aligned with a timeline." */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");
const S = require("../../assets/ct/signals.js");
window.CTSignals = S;
const L = require("../../assets/ct/levers.js");
window.CTLevers = L;
window.FB_DATASET = F.dataset;
const D = require("../../assets/ct/demo.js");
const TL = require("../../assets/ct/timeline.js");

const at = (hIST) => Date.UTC(2026, 8, 22) + (hIST - 5.5) * 3600e3;
const model = (v) => L.build(v, { demand: S._detectors.demand(v.state) });
function demoDay(h, ticks) {
  const now = at(h);
  const w = F.world({ dataReady: D.dataReady(now), now });
  D.ensureDay(w.store, w.tower.pass(), now);
  for (let i = 1; i <= (ticks || 0); i++) { w.clock.advance(20000); D.tick(w.store, w.tower.pass(), now + i * 20000); }
  const v = w.tower.pass();
  return { w, v, m: model(v), now: now + (ticks || 0) * 20000 };
}
const all = (tl) => tl.days.flatMap((d) => d.items);
const texts = (tl) => all(tl).map((i) => i.text);

test("news, newest first, a day at a time; every line says one thing with its figure in it", () => {
  const { v, m, now } = demoDay(16, 20);
  const tl = TL.build(v, m, { now });
  assert.equal(tl.days[0].label, "Today");
  const items = all(tl);
  assert.ok(items.length > 5);
  assert.ok(items.every((x, i, a) => !i || a[i - 1].at >= x.at), "newest first");
  for (const x of items) {
    assert.ok(["deliveries", "collections", "purchase", "inventory", "order"].includes(x.lever), x.text);
    assert.ok(["good", "bad", "info"].includes(x.tone));
    assert.ok(!/\n/.test(x.text) && x.text.length < 120, "one line: " + x.text);
  }
  assert.ok(items.filter((x) => x.time).every((x) => /^\d{1,2}:\d\d (am|pm)$/.test(x.time)), "times in the trade's clock");
});

test("deliveries are news by the trip: late and why, what didn't fit, and the trip done with its cash", () => {
  const { v, m, now } = demoDay(16);
  const tl = TL.build(v, m, { now });
  const t = texts(tl);
  assert.ok(t.some((x) => /^Van \d's (first|second) trip running .* late · (loading ran late|waited at the dock|first trip ran late)$/.test(x)), "a late trip, with why");
  assert.ok(t.some((x) => /^\d+ orders? didn't fit Van \d · left for the next trip$/.test(x)), "overbooked");
  const done = all(tl).filter((x) => /trip done/.test(x.text));
  assert.ok(done.length >= 2, "trips closed");
  /* The cash on a trip's line is exactly the door cash of its drops. */
  const d0 = done.find((x) => /first trip/.test(x.text));
  const van = d0.text.slice(0, 5), cash = v.records.deliveries.filter((d) => d.van === van && d.round === 1).reduce((n, d) => n + (Number(d.collected) || 0), 0);
  assert.ok(d0.text.endsWith(L.rupees(cash) + " collected"), d0.text);
  assert.ok(!t.some((x) => /^Delivered to /.test(x)), "no line per drop on a planned route");
});

test("a problem is its own line and opens where it is fixed", () => {
  const { v, m, now } = demoDay(16);
  const bad = all(TL.build(v, m, { now })).filter((x) => /^(Missed at|Short \d|.* returned \d)/.test(x.text));
  assert.ok(bad.length, "missed, short or returned drops");
  assert.ok(bad.every((x) => x.tone === "bad" && x.lever === "deliveries" && x.tile === "ugly"));
});

test("money stuck for months is its own line, a win, and says so once per customer", () => {
  const { v, m, now } = demoDay(16, 60);
  const pays = all(TL.build(v, m, { now })).filter((x) => x.lever === "collections" && / received from /.test(x.text));
  const stuck = pays.filter((x) => x.win);
  assert.ok(stuck.length, "the demo's counter collects old money");
  assert.ok(stuck.every((x) => / after \d+ days$/.test(x.text) && x.tone === "good" && x.tile === "good"));
  const names = stuck.map((x) => x.text.replace(/^.* received from (.*) after.*$/, "$1"));
  assert.equal(new Set(names).size, names.length, "\"after N days\" once per customer");
  const door = new Set(v.records.payments.filter((p) => p.forDrop).map((p) => "pay:" + p.no));
  assert.ok(!pays.some((x) => door.has(x.key)), "door cash is in its trip's line");
});

test("money in reads like the register: an hour's payments in one line, a lone one on its own", () => {
  const w = F.world({ dataReady: F.sampleDataReady(F.NOW) });
  const v0 = w.tower.pass();
  const col = model(v0).levers.find((x) => x.id === "collections");
  const owing = new Set([].concat(col.tiles.ugly.rows, col.tiles.bad.rows).map((r) => r.id));
  const onTime = v0.state.customers.filter((c) => !owing.has(c.id)).slice(0, 4);
  const hour = F.NOW - 2 * 3600e3;                                     // 12:30 pm in India, the day of NOW
  onTime.slice(0, 3).forEach((c, i) => w.store.addPayment({ customerId: c.id, amount: 1000 * (i + 1), mode: "UPI", at: new Date(hour + i * 60000).toISOString() }));
  w.store.addPayment({ customerId: onTime[3].id, amount: 700, mode: "Cash", at: new Date(hour - 3 * 3600e3).toISOString() });
  const v = w.tower.pass();
  const pays = all(TL.build(v, model(v), { now: F.NOW })).filter((x) => x.time && / received from /.test(x.text));
  assert.ok(pays.some((x) => x.text === "₹6,000 received from 3 customers"), "one line for the hour, with its total");
  assert.ok(pays.some((x) => x.text === "₹700 received from " + v.state.customerById[onTime[3].id]), "a lone payment names who paid");
  assert.equal(pays.length, 2);
});

test("only what happened: nothing dated after now, nothing older than 7 days", () => {
  const { v, m, now } = demoDay(16);
  const tl = TL.build(v, m, { now });
  const first = new Date(new Date(now + 5.5 * 3600e3).toISOString().slice(0, 10) + "T00:00:00Z").getTime() - 5.5 * 3600e3 - 6 * 864e5;
  assert.ok(all(tl).every((x) => x.at <= now && x.at >= first));
  const future = v.state.ledger.payments.filter((p) => !p.own && new Date(p.date).getTime() > now);
  assert.ok(future.length, "the sample ledger has payments dated ahead");
  assert.ok(!all(tl).some((x) => future.some((p) => x.key === "lpay:" + p.id)), "and they are not news");
  assert.ok(tl.days.length <= 7);
});

test("what the owner did is news: reminders, purchase orders, orders, supply stopped, stock counted", () => {
  const w = F.world({ dataReady: F.sampleDataReady(F.NOW) });
  const run = (pv) => assert.equal(w.tower.actions.execute(pv, { confirmed: true, actor: "owner" }).ok, true);
  run(w.tower.actions.prepare("overdue"));
  run(w.tower.actions.prepare("stockout"));
  run(w.tower.actions.prepare("reorder-due"));
  const v0 = w.tower.pass();
  w.store.setHold(v0.state.customers[0].id, true);
  w.store.addStockCounts([{ productId: v0.state.products[0].id, qty: 10 }, { productId: v0.state.products[1].id, qty: 4 }]);
  const v = w.tower.pass();
  const t = texts(TL.build(v, model(v), { now: F.NOW + 1000 }));
  assert.ok(t.some((x) => /^\d+ payment reminders? sent$/.test(x)), "reminders");
  assert.ok(t.some((x) => /^Purchase order \S+ raised · \d+ products?/.test(x)), "purchase order");
  assert.ok(t.some((x) => /^\d+ orders? created for the next trips$/.test(x)), "orders");
  assert.ok(t.some((x) => /^Supply stopped for /.test(x)), "supply stopped");
  assert.ok(t.includes("2 products counted"), "stock count");
});

test("a lever changing where it stands is news; turning green is a win", () => {
  const { v, m, now } = demoDay(16);
  const log = [{ at: now - 60000, lever: "purchase", from: "bad", to: "good" }, { at: now - 120000, lever: "deliveries", from: "bad", to: "ugly" },
    { at: now - 180000, lever: "order", from: "good", to: "bad" }];
  const items = all(TL.build(v, m, { now, statusLog: log }));
  const g = items.find((x) => x.text === "Purchase is on track now");
  assert.ok(g && g.win && g.tone === "good" && g.tile === "good");
  assert.ok(items.find((x) => x.text === "Deliveries turned Urgent" && x.tone === "bad" && x.tile === "ugly"));
  assert.ok(items.find((x) => x.text === "Order needs work now" && x.tile === "bad"));
});

test("a delivery recorded by hand, with no trip, is its own line", () => {
  const w = F.world();
  const c = w.tower.pass().state.customers;
  w.store.addDeliveries([{ customerId: c[0].id, status: "delivered", collected: 4200 }, { customerId: c[1].id, status: "delivered", lateMin: 45 }]);
  const v = w.tower.pass();
  const t = texts(TL.build(v, model(v), { now: F.NOW + 1000 }));
  assert.ok(t.includes("Delivered to " + v.state.customerById[c[0].id] + " · ₹4,200 collected"));
  assert.ok(t.includes("Late 45 min at " + v.state.customerById[c[1].id]));
});

test("the same records tell the same news", () => {
  const a = demoDay(16, 10), b = demoDay(16, 10);
  assert.deepEqual(texts(TL.build(a.v, a.m, { now: a.now })), texts(TL.build(b.v, b.m, { now: b.now })));
});

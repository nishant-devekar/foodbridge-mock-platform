/* Control Tower · Deliveries, run on incidents (owner, 24 Sep 2026).
   Run from v7/:  node --test test/control-tower/*.test.js
   Spec: context/control-tower/CONTROL_TOWER_INCIDENTS.md

   incident → tag → lead action → lead impact → standing → back to green */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");
const S = require("../../assets/ct/signals.js");
window.CTSignals = S;
const IN = require("../../assets/ct/incidents.js");
const LA = require("../../assets/ct/incident-actions.js");
const L = require("../../assets/ct/levers.js");
window.CTLevers = L;
window.FB_DATASET = F.dataset;
const D = require("../../assets/ct/demo.js");

const DAY = Date.UTC(2026, 8, 24);
const at = (hIST) => DAY + (hIST - 5.5) * 3600e3;
function world(h) {
  const now = at(h);
  const w = F.world({ dataReady: D.dataReady(now), now });
  D.ensureDay(w.store, w.tower.pass(), now);
  return w;
}
const dl = (w) => { const v = w.tower.pass(); return L.build(v, { demand: S._detectors.demand(v.state) }).levers.find((x) => x.id === "deliveries"); };
const all = (d) => [].concat(d.tiles.ugly.rows, d.tiles.bad.rows, d.tiles.good.rows);
/* The context an action pane fills itself from, the way the card builds it. */
function ctx(w, inc) {
  const v = w.tower.pass(), d = dl(w), X = d.incidents;
  const s = inc.subject ? X.byKey[inc.subject] : null;
  const held = inc.kind === "van" ? inc.children.map((k) => X.byKey[k]).filter((x) => x && x.status === "pending") : [];
  return { inc, subj: s, X, name: s ? s.title : inc.title, customerId: s ? s.customerId : null, van: s ? s.van : inc.van, driver: s ? s.driver : inc.driver,
    value: s ? s.value : inc.impact.rupees, cases: s ? s.cases : null, now: v.state.now, held, vanStops: [], routeEnd: v.state.now + 3 * 3600e3,
    vans: [{ van: "Van 3", driver: "Suresh", room: 999, off: false }], lines: [{ name: "Amla Pickle", qty: 4, unit: "jar", price: 90 }], items: null, owed: 3100, paid: true };
}
function run(w, inc, id, hint, tweak) {
  const x = ctx(w, inc), spec = LA.A[id];
  const s = spec.init(x, hint || {});
  if (tweak) tweak(s, x);
  assert.equal(typeof spec.html(x, s, LA.H), "string", id + " draws");
  assert.equal(spec.ready ? spec.ready(x, s) : null, null, id + " is ready with its defaults");
  const c = spec.confirm(x, s);
  assert.ok(c.main && c.main.length > 8, id + " says what will happen");
  const out = spec.commit(x, s);
  assert.ok(out.events.length >= 1 && out.events.every((e) => e.type && e.subject && e.subject.incident === inc.id || e.type === "stops.moved"), id + " writes facts about the incident");
  w.store.addEvents(out.events);
  const done = spec.done(x, s);
  assert.ok(done.title && done.pill, id + " has a done card");
  return dl(w).incidents.byId[inc.id];
}
const find = (w, type) => dl(w).incidents.incidents.find((i) => i.type === type && i.state === "open");

test("every one of the 54 incidents, and crates, is in the catalogue with two buttons at most and its clock", () => {
  const C = IN.CATALOG;
  assert.equal(Object.keys(C).length, 55);
  assert.ok(!C["order-not-found"], "No order was removed (owner, 24 Sep 2026)");
  for (const id of Object.keys(C)) {
    const c = C[id];
    assert.ok(["ugly", "bad", "good"].includes(c.starts), id);
    assert.ok(c.buttons.length >= 1 && c.buttons.length <= 2, id + " has one or two buttons");
    for (const b of c.buttons) assert.ok(b.id === "call" || LA.A[b.id], id + " → " + b.label + " is a built action");
    assert.ok(c.rec && c.label && c.family, id);
  }
});

test("the demo day raises incidents from the door, the road and the system, each with a standing", () => {
  const w = world(15);
  const d = dl(w), X = d.incidents;
  const types = new Set(X.incidents.map((i) => i.type));
  for (const t of ["van-full", "short-quantity", "window-missed"]) assert.ok(types.has(t), t);
  assert.ok(X.roots.some((r) => ["puncture", "breakdown"].includes(r.type)), "a van problem holds its stops");
  assert.ok(X.incidents.every((i) => ["ugly", "bad", "good"].includes(i.standing)));
  assert.equal(d.byIncidents, true);
  assert.equal(d.status, "ugly", "Urgent while anything needs you");
  assert.equal(d.tiles.ugly.count + d.tiles.bad.count + d.tiles.good.count, X.subjects.filter((s) => s.kind !== "count" || s.incidents.length).length, "every delivery in one tile");
});

test("a van problem is one row that holds its stops; moving them fixes it, one fact either way", () => {
  const w = world(13.5);
  let root = dl(w).incidents.roots.find((r) => r.type === "puncture" || r.type === "breakdown");
  assert.ok(root && root.children.length >= 1);
  const rows = all(dl(w));
  assert.ok(rows.some((r) => r.kind === "van" && r.id === root.id), "the van's own row");
  assert.ok(!rows.some((r) => root.children.includes(r.id)), "its stops are not rows of their own");
  root = run(w, root, "move", {}, (s) => { root.children.forEach((k) => { s.stops[k] = 1; }); s.to = "Van 3"; });
  assert.equal(root.state, "resolved", "every held stop moved");
  assert.match(root.proof.text, /moved to Van 3/);
  const moved = dl(w).incidents.subjects.filter((s) => s.van === "Van 3");
  assert.ok(moved.length >= 1 && moved.every((s) => !s.parent && s.standing !== "good"), "moved stops are the spare's own deliveries, no longer held");
});

test("Missed → Pending → On track: reschedule for today, then the van delivers it", () => {
  const w = world(12.5);
  const inc = dl(w).incidents.incidents.find((i) => i.record && i.record.status === "missed" && i.cat.starts === "ugly" && i.type !== "van-full");
  assert.ok(inc, "a missed stop");
  assert.equal(inc.standing, "ugly");
  const after = run(w, inc, "reschedule", { day: 0 }, (s) => { s.day = 0; s.win = "evening"; });
  assert.equal(after.state, "acting");
  assert.equal(after.standing, "bad", "being fixed is Pending");
  assert.match(after.note, /^Rescheduled · today evening/);
  /* The van goes back: the demo writes the proof when the window opens. */
  const later = at(16.5);
  w.clock.advance(later - at(12.5));
  D._proofs(w.store, w.tower.pass(), later);
  const fixed = dl(w).incidents.byId[inc.id];
  assert.equal(fixed.state, "resolved", "delivered on the new time");
  assert.equal(fixed.standing, "good");
  assert.match(fixed.proof.text, /^Delivered .* · fixed$/);
  assert.ok(dl(w).chase.fixed >= 1, "counted in the chase to green");
});

test("the clock: Pending turns Missed when its time runs out", () => {
  const w = world(13.5);
  const s = dl(w).incidents.subjects.find((x) => x.status === "pending" && x.slot && new Date(x.slot).getTime() > at(13.6));
  w.clock.advance(new Date(s.slot).getTime() + 45 * 60000 - at(13.5));
  const inc = dl(w).incidents.incidents.find((i) => i.subject === s.key && i.type === "window-missed");
  assert.ok(inc, "past its window");
  assert.equal(inc.standing, "ugly");
});

test("telling the customers moves their window: late stops go from Missed to Pending", () => {
  const w = world(15);
  const late = dl(w).incidents.incidents.find((i) => i.type === "window-missed" && i.state === "open");
  assert.ok(late);
  const root = late.parent ? dl(w).incidents.byId[late.parent] : late;
  run(w, root, "tell");
  const after = dl(w).incidents.byId[late.id];
  assert.equal(after.state, "acting");
  assert.equal(after.standing, "bad");
});

test("each lead action moves its incident the way the spec says", () => {
  const w = world(19);
  const X = () => dl(w).incidents;
  const cases = [
    ["short-quantity", "send", "acting"],
    ["van-full", "move", "acting"],
    ["window-missed", "tell", "acting"],
  ];
  for (const [type, id, want] of cases) {
    const inc = X().incidents.find((i) => i.type === type && i.state === "open");
    if (!inc) continue;
    assert.equal(run(w, inc, id).state, want, type + " · " + id);
  }
  /* The settlement count: ask, the driver answers, close it as explained. */
  const ex = X().incidents.find((i) => i.type === "excess-quantity");
  assert.ok(ex, "the settlement count raised an excess");
  assert.equal(run(w, ex, "ask").state, "acting");
  w.clock.advance(60000);
  D._proofs(w.store, w.tower.pass(), at(19) + 60000);
  const answered = X().byId[ex.id];
  assert.ok(answered.answered && answered.answer.text, "the driver's answer is on it");
  assert.equal(run(w, answered, "close", { how: "explained" }).state, "resolved");
  const miss = X().incidents.find((i) => i.type === "missing-item");
  assert.equal(run(w, miss, "writeOff").state, "resolved", "written off, closed");
});

test("money actions close at once; talk-only ones close on what the owner heard", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  const [a, b, c] = w.store.addDeliveries([
    { customerId: cust[0].id, status: "delivered", value: 5200, collected: 4700, dispute: { kind: "price", billed: 5200, paid: 4700, gap: 500, why: "Scheme rate" } },
    { customerId: cust[1].id, status: "missed", reason: "Payment not ready", value: 2780 },
    { customerId: cust[2].id, status: "delivered", value: 1400, returnedCases: 1, returnReason: "Expired", returnValue: 336 },
  ]);
  const X = () => dl(w).incidents;
  const price = X().incidents.find((i) => i.type === "price-dispute");
  assert.equal(price.standing, "ugly", "₹500 is at the line: Missed");
  assert.equal(run(w, price, "adjust").state, "resolved");
  const cash = X().incidents.find((i) => i.type === "cash-unavailable");
  assert.equal(cash.standing, "ugly", "not delivered: needs you");
  assert.equal(run(w, cash, "collectLater").state, "resolved", "handed to Collections");
  const exp = X().incidents.find((i) => i.type === "expired-product");
  assert.equal(run(w, exp, "creditNote").state, "resolved");
});

test("cancel takes a delivery out of today's count; fix customer details leads into reschedule", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addDeliveries([{ customerId: cust[0].id, status: "missed", reason: "Refused", value: 3960 },
                         { customerId: cust[1].id, status: "missed", reason: "Wrong address", value: 4300 },
                         { customerId: cust[2].id, status: "delivered", value: 1000 }]);
  const X = () => dl(w).incidents;
  const before = dl(w).headline.value;
  const ref = X().incidents.find((i) => i.type === "customer-refused");
  assert.equal(run(w, ref, "cancel").state, "resolved");
  assert.notEqual(dl(w).headline.value, before, "one fewer to deliver");
  assert.match(all(dl(w)).find((r) => r.id === ref.subject).note, /^Cancelled/);
  const wa = X().incidents.find((i) => i.type === "wrong-address");
  const x = ctx(w, wa), spec = LA.A.fixCustomer, s = spec.init(x);
  s.address = "Shop 14, 2nd Cross";
  const out = spec.commit(x, s);
  assert.equal(out.next, "reschedule", "saving opens Reschedule, filled in");
  w.store.addEvents(out.events);
  assert.equal(X().byId[wa.id].standing, "ugly", "still Missed until it's rescheduled");
});

test("the delivery app's facts arrive through the event stream and become incidents", () => {
  const w = F.world();
  w.store.addEvents([
    { type: "stop.skipped", by: "Kumar", where: "Delivery app", how: "driver", subject: { customer: "Sharma Kirana", van: "Van 2" }, data: { reason: "WRONG_ADDRESS", label: "Wrong address", value: 1640 } },
    { type: "return.recorded", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: "Cake Corner" }, data: { reason: "DAMAGED", detail: "LEAKING", items: [{ name: "Cake 60g", qty: 6 }], value: 540 } },
    { type: "problem.reported", by: "Kumar", where: "Delivery app", how: "driver", subject: { van: "Van 2" }, data: { kind: "breakdown" } },
    { type: "dispute.raised", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: "Gupta Stores" }, data: { kind: "price", why: "Scheme rate", gap: 300 } },
  ]);
  const X = dl(w).incidents;
  const types = X.incidents.map((i) => i.type).sort();
  assert.deepEqual(types, ["breakdown", "leaking", "price-dispute", "wrong-address"]);
  assert.equal(X.incidents.find((i) => i.type === "wrong-address").standing, "ugly");
  assert.equal(X.incidents.find((i) => i.type === "leaking").standing, "bad", "under the ₹2,000 line");
  assert.ok(all(dl(w)).some((r) => r.title === "Sharma Kirana"), "a customer from the app gets a row");
});

test("the demo's clock writes the proof: the driver answers, the customer accepts, the van moves", () => {
  const w = world(14);
  const X = () => dl(w).incidents;
  const pod = X().incidents.find((i) => i.type === "pod-disputed");
  if (pod) {
    run(w, pod, "proof");
    w.clock.advance(90000);
    D._proofs(w.store, w.tower.pass(), at(14) + 90000);
    assert.equal(X().byId[pod.id].state, "resolved", "accepted the proof");
  }
  const root = X().roots.find((r) => r.type === "puncture" || r.type === "breakdown");
  const until = new Date(root.facts.until).getTime();
  w.clock.advance(until + 60000 - (at(14) + (pod ? 90000 : 0)));
  D._proofs(w.store, w.tower.pass(), until + 60000);
  assert.equal(X().byId[root.id].state, "resolved", "moving again");
});

test("every pane asks only what the owner decides: no checkboxes, no empty questions, and any hour works", () => {
  for (const h of [9, 13, 18, 21]) {
    const now = at(h);
    for (const id of Object.keys(LA.A)) {
      const spec = LA.A[id];
      const inc = { id: "i", type: id === "adjust" ? "price-dispute" : id === "credit" ? "credit-limit" : "short-quantity", cat: IN.CATALOG["short-quantity"],
        facts: { cases: 2, owed: 24000, limit: 20000, gap: 500, billed: 5200, paid: 4700 }, impact: { rupees: 500 } };
      const x = { inc, subj: { key: "s", title: "Shop", status: "missed", slot: new Date(now + 3600e3).toISOString(), cases: 3, value: 2000 }, name: "Shop", van: "Van 1", driver: "Ajay",
        value: 2000, now, routeEnd: at(18), vanStops: [], held: [], vans: [{ van: "Van 3", driver: "Suresh", room: 40, off: false }],
        lines: [{ name: "Amla Pickle", qty: 2, unit: "jar", price: 90 }], owed: 3100, paid: true };
      if (spec.available && !spec.available(x)) continue;
      const s = spec.init(x, {});
      const html = spec.html(x, s, LA.H);
      assert.ok(!/type="checkbox"/.test(html), id + " asks no yes/no questions");
      assert.ok(!/<div class="ct-ap-(checks|opts)"[^>]*><\/div>/.test(html), id + " never shows an empty question");
      assert.doesNotThrow(() => spec.confirm(x, s), id + " at " + h + ":00 IST");
    }
  }
});

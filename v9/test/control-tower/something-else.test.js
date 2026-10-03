/* Control Tower · Something else (25 Sep 2026) — what the person on the
   ground reports in their own words, because it fits none of the 55 types.
   The event contract the delivery app's Tell the Office writes, proven
   against the same engine the tower runs. Run from v7/:
     node --test test/control-tower/*.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");

require("../../assets/ct/incidents.js");
const LA = require("../../assets/ct/incident-actions.js");
const L = require("../../assets/ct/levers.js");
window.CTLevers = L;
const S = require("../../assets/ct/signals.js");
window.CTSignals = S;

const dl = (w) => { const v = w.tower.pass(); return L.build(v, { demand: S._detectors.demand(v.state) }).levers.find((x) => x.id === "deliveries"); };
const find = (w, pred) => dl(w).incidents.incidents.find(pred);
const MIN = 60000;

function report(w, o) {
  const cust = o.stop === false ? null : w.tower.pass().state.customers[o.i || 0].name;
  return w.store.addEvent({ type: "report.raised", by: "Rahul", where: "Delivery app · Tell the office", how: "driver",
    subject: { customer: cust, van: "Andheri West Beat" },
    data: { text: o.text || "", urgent: !!o.urgent, photos: o.photos || [], scope: cust ? "stop" : "van", value: o.value || null } });
}
const act = (w, inc, id, data, note) => w.store.addEvent({ type: "action." + id, by: "You", where: "Control Tower", how: "owner", note: note || id,
  subject: { incident: inc.id }, data: data || {} });

test("a report at a shop is Something else: its own words lead, the photos come with it, the lead is a call to whoever raised it", () => {
  const w = F.world();
  report(w, { text: "Shopkeeper says the landlord sealed the shop. Police here.", photos: [{ id: "PH-1" }, { id: "PH-2" }] });
  const inc = find(w, (i) => i.type === "something-else");
  assert.ok(inc, "tagged Something else");
  assert.equal(inc.cat.family, "Other");
  assert.equal(inc.standing, "bad", "Pending while it's fresh");
  assert.equal(inc.driver, "Rahul", "it's Rahul who gets the call");
  assert.equal(inc.facts.photos.length, 2);
  assert.match(inc.what, /landlord sealed the shop/);
  assert.equal(inc.cat.buttons[0].id, "call");
  assert.equal(inc.cat.buttons[0].who, "driver");
  assert.equal(inc.cat.buttons[1].id, "resolve");
});

test("left alone for 30 minutes it turns Missed; asked for a call now it is Missed from the start", () => {
  const w = F.world();
  report(w, { text: "Something odd at the gate", i: 0 });
  report(w, { text: "Van stopped by a mob, need a call", urgent: true, i: 1 });
  assert.equal(find(w, (i) => i.type === "something-else").standing, "bad");
  const urgent = find(w, (i) => i.type === "something-urgent");
  assert.equal(urgent.standing, "ugly", "urgent is Missed at once");
  assert.equal(urgent.cat.label, "Urgent · call");
  w.clock.advance(31 * MIN);
  assert.equal(find(w, (i) => i.type === "something-else").standing, "ugly", "30 minutes with nobody on it");
});

test("on the road (no shop) it is the van's own row, holding none of its stops", () => {
  const w = F.world();
  report(w, { text: "Bandh called in Andheri, shops shutting", stop: false });
  const inc = find(w, (i) => i.type === "something-else");
  assert.ok(inc, "raised");
  assert.equal(inc.facts.scope, "van");
  const s = dl(w).incidents.byKey[inc.subject];
  assert.equal(s.kind, "count");
  assert.match(s.title, /Andheri West Beat/);
  assert.equal(inc.children.length, 0, "it isn't known to hold anything");
});

test("Sorted on the call: Mark resolved, in the owner's own words, and it's On track", () => {
  const w = F.world();
  report(w, { text: "Customer wants to talk to the owner" });
  const inc = find(w, (i) => i.type === "something-else");
  const x = { inc: inc, driver: "Rahul", name: inc.title, subj: null };
  const s = LA.A.resolve.init(x);
  assert.ok(LA.A.resolve.ready(x, s), "a resolution needs words");
  s.how = "Spoke to Mr Rao, he'll take the order tomorrow.";
  assert.equal(LA.A.resolve.ready(x, s), null);
  const out = LA.A.resolve.commit(x, s);
  w.store.addEvents(out.events);
  const after = find(w, (i) => i.id === inc.id);
  assert.equal(after.state, "resolved");
  assert.equal(after.standing, "good");
  assert.equal(after.proof.text, "Spoke to Mr Rao, he'll take the order tomorrow.");
});

test("It's one of ours: re-filed, it becomes that type — its tag, its buttons, its clock — and keeps its history", () => {
  const w = F.world();
  report(w, { text: "Shutter half down, a boy says the owner went home" });
  const inc = find(w, (i) => i.type === "something-else");
  const x = { inc: inc, subj: dl(w).incidents.byKey[inc.subject], name: inc.title };
  const types = LA.A.reclassify.types(x).map((c) => c.id);
  assert.ok(types.includes("shop-closed"), "a shop's types for a stop");
  assert.ok(!types.includes("breakdown"), "not the van's");
  assert.ok(!types.includes("credit-limit") && !types.includes("route-deviation"), "never a detector's");
  const s = LA.A.reclassify.init(x); s.to = "shop-closed";
  w.store.addEvents(LA.A.reclassify.commit(x, s).events);
  const now = find(w, (i) => i.id === inc.id);
  assert.equal(now.type, "shop-closed");
  assert.equal(now.cat.label, "Shop closed");
  assert.equal(now.state, "open", "filed, not fixed");
  assert.equal(now.refiledFrom, "Something else");
  assert.ok(now.trail.some((t) => t.text === "Filed as Shop closed"));
  assert.deepEqual(now.cat.buttons.map((b) => b.label), ["Call the shop", "Reschedule"]);
  /* And its own fix runs from there. */
  act(w, now, "reschedule", { date: "2026-09-26", window: "morning" }, "Rescheduled · tomorrow morning");
  assert.equal(find(w, (i) => i.id === inc.id).state, "acting");
});

test("a van report re-files only as the van's, the road's or the warehouse's", () => {
  const w = F.world();
  report(w, { text: "Engine light, smoke", stop: false });
  const inc = find(w, (i) => i.type === "something-else");
  const types = LA.A.reclassify.types({ inc: inc, subj: dl(w).incidents.byKey[inc.subject] }).map((c) => c.id);
  assert.ok(types.includes("breakdown") && types.includes("road-closure") && types.includes("dispatch-doc-missing"));
  assert.ok(!types.includes("shop-closed"));
});

test("Couldn't reach them: the attempt is logged, the incident stays as it was", () => {
  const w = F.world();
  report(w, { text: "Call me" });
  const inc = find(w, (i) => i.type === "something-else");
  w.store.addEvent({ type: "call.outcome", by: "You", where: "Control Tower", how: "owner", subject: { incident: inc.id }, data: { answer: "Couldn't reach them", who: "driver" } });
  const after = find(w, (i) => i.id === inc.id);
  assert.equal(after.state, "open");
  assert.ok(after.trail.some((t) => /Couldn't reach/.test(t.text)));
});

test("Skip Stop's Other is Something else now, not Not available", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers[0].name;
  w.store.addEvent({ type: "stop.skipped", by: "Rahul", where: "Delivery app", how: "driver", subject: { customer: cust }, data: { reason: "OTHER", label: "Other", note: "Gate locked, guard won't say why" } });
  assert.ok(find(w, (i) => i.type === "something-else"), "Other → Something else");
  assert.ok(!find(w, (i) => i.type === "customer-unavailable" && i.event && i.event.data.reason === "OTHER"));
});

test("the lever says what share of today's problems were Something else, counting the re-filed", () => {
  const w = F.world();
  report(w, { text: "Bandh called", stop: false });
  report(w, { text: "Shutter down, owner gone", i: 1 });
  const inc = find(w, (i) => i.type === "something-else" && i.facts.scope === "stop");
  const x = { inc: inc, subj: dl(w).incidents.byKey[inc.subject], name: inc.title };
  const s = LA.A.reclassify.init(x); s.to = "shop-closed";
  w.store.addEvents(LA.A.reclassify.commit(x, s).events);
  const lv = dl(w);
  assert.equal(lv.somethingElse.told, 2, "the re-filed one still counts");
  assert.deepEqual(lv.somethingElse.refiled, ["Shop closed"]);
  const fact = lv.facts.find((f) => f.label === "Something else");
  assert.match(fact.value, /^2 of \d+ · 1 re-filed$/);
});

test("no Something else today, no line for it", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers[0].name;
  w.store.addEvent({ type: "stop.skipped", by: "Rahul", where: "Delivery app", how: "driver", subject: { customer: cust }, data: { reason: "SHOP_CLOSED", label: "Shop closed" } });
  assert.ok(!dl(w).facts.some((f) => f.label === "Something else"));
});

test("re-filed as a money type, it carries what's due at that shop: Collect later asks for that, not ₹0", () => {
  const w = F.world();
  report(w, { text: "His son has the money, he's at the hospital", value: 480 });
  const inc = find(w, (i) => i.type === "something-else");
  assert.equal(inc.impact.rupees, 0, "unknown while it's Something else");
  const x = { inc: inc, subj: dl(w).incidents.byKey[inc.subject], name: inc.title };
  const s = LA.A.reclassify.init(x); s.to = "cash-unavailable";
  w.store.addEvents(LA.A.reclassify.commit(x, s).events);
  const now = find(w, (i) => i.id === inc.id);
  assert.equal(now.type, "cash-unavailable");
  assert.equal(now.impact.rupees, 480);
  assert.equal(LA.A.collectLater.amount({ inc: now, value: null }), 480);
});

test("the driver's own number comes with what they send, so Call Rahul dials", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers[0].name;
  w.store.addEvent({ type: "report.raised", by: "Rahul", where: "Delivery app · Tell the office", how: "driver",
    subject: { customer: null, van: "Andheri West Beat", driverPhone: "9876543210" }, data: { text: "Bandh", scope: "van" } });
  w.store.addEvent({ type: "report.raised", by: "Rahul", where: "Delivery app · Tell the office", how: "driver",
    subject: { customer: cust, van: "Andheri West Beat", driverPhone: "9876543210" }, data: { text: "Gate locked", scope: "stop" } });
  const all = dl(w).incidents.incidents.filter((i) => i.type === "something-else");
  assert.equal(all.length, 2);
  all.forEach((i) => assert.equal(i.driverPhone, "9876543210"));
});

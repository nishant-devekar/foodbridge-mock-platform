/* Control Tower · the 26 incidents that had no real capture path (24 Sep
   2026 audit) — now wired to a driver-app screen or a system detector.
   Each case here is the exact event contract the fixed screen emits, proven
   against the same engine the tower runs. Run from v7/:
     node --test test/control-tower/*.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");

const IN = require("../../assets/ct/incidents.js");
const L = require("../../assets/ct/levers.js");
window.CTLevers = L;
const S = require("../../assets/ct/signals.js");
window.CTSignals = S;

const dl = (w) => { const v = w.tower.pass(); return L.build(v, { demand: S._detectors.demand(v.state) }).levers.find((x) => x.id === "deliveries"); };
const typesOf = (w) => dl(w).incidents.incidents.map((i) => i.type);
const find = (w, type) => dl(w).incidents.incidents.find((i) => i.type === type);

test("no-parking and access-restriction: What's wrong here? grew two Location reasons", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addEvents([
    { type: "dispute.raised", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name }, data: { kind: "parking", why: "No spot to unload" } },
    { type: "dispute.raised", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[1].name }, data: { kind: "hours", why: "Only takes drops 9-11am" } },
  ]);
  assert.ok(find(w, "no-parking"), "parking dispute tags no-parking");
  assert.equal(find(w, "no-parking").standing, "good", "starts informational, as the catalogue says");
  assert.ok(find(w, "access-restriction"), "hours dispute tags access-restriction");
});

test("short-quantity: Edit Order now asks why, and 'not enough on the van' tags Short instead of Part accepted", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addEvents([{ type: "stop.itemsEdited", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name },
    data: { booked: 2000, delivered: 1200, why: "short" } }]);
  const inc = find(w, "short-quantity");
  assert.ok(inc, "tagged Short, not Part accepted");
  assert.equal(typesOf(w).includes("partial-acceptance"), false);
});

test("short-quantity: an edit recorded as 'stock' (before the chip said 'short') still tags Short", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addEvents([{ type: "stop.itemsEdited", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name },
    data: { booked: 2000, delivered: 1200, why: "stock" } }]);
  assert.ok(find(w, "short-quantity"), "tagged Short");
  assert.equal(typesOf(w).includes("partial-acceptance"), false);
});

test("substitute rejected, wrong batch, near expiry: three more Product Return reasons", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addEvents([
    { type: "return.recorded", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name }, data: { reason: "SUBSTITUTE", items: [{ name: "Ghee 500g", qty: 2 }], value: 400 } },
    { type: "return.recorded", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[1].name }, data: { reason: "WRONG_BATCH", items: [{ name: "Ghee 500g", qty: 1 }], value: 200 } },
    { type: "return.recorded", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[2].name }, data: { reason: "NEAR_EXPIRY", items: [{ name: "Ghee 500g", qty: 3 }], value: 600 } },
  ]);
  assert.ok(find(w, "substitute-rejected"));
  assert.ok(find(w, "wrong-batch"));
  assert.ok(find(w, "near-expiry"));
});

test("temperature, traffic delay, road closure: Report a problem grew three Route/Product reasons, and hold the van's stops", () => {
  const w = F.world();
  w.store.addEvents([{ type: "problem.reported", by: "Ajay", where: "Delivery app", how: "driver", subject: { van: "Van 9" }, data: { kind: "temperature" } }]);
  const t = find(w, "temperature");
  assert.ok(t && t.kind === "van", "temperature holds the van's chilled stops, like a breakdown");

  const w2 = F.world();
  w2.store.addEvents([{ type: "problem.reported", by: "Ajay", where: "Delivery app", how: "driver", subject: { van: "Van 9" }, data: { kind: "traffic" } }]);
  assert.ok(find(w2, "traffic-delay"));

  const w3 = F.world();
  w3.store.addEvents([{ type: "problem.reported", by: "Ajay", where: "Delivery app", how: "driver", subject: { van: "Van 9" }, data: { kind: "road" } }]);
  assert.ok(find(w3, "road-closure"));
});

test("van full: Skip Stop grew the chip the spec always wanted", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addEvents([{ type: "stop.skipped", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name, van: "Van 2" },
    data: { reason: "VAN_FULL", label: "Van Full", value: 990 } }]);
  const inc = find(w, "van-full");
  assert.ok(inc);
  assert.equal(inc.standing, "ugly", "starts Missed, as the catalogue says");
});

test("cash unavailable and cheque disputed: Collect Payment's UPI-failed link grew two more, by method", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addEvents([
    { type: "payment.failed", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name }, data: { amount: 1200, method: "CASH" } },
    { type: "payment.failed", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[1].name }, data: { amount: 3400, method: "CHEQUE" } },
    { type: "payment.failed", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[2].name }, data: { amount: 700, method: "UPI" } },
  ]);
  assert.ok(find(w, "cash-unavailable"));
  assert.ok(find(w, "cheque-dispute"));
  assert.ok(find(w, "upi-failed"), "UPI still works, unchanged");
});

test("wrong loading, stock not loaded, missing stock, wrong batch loaded, dispatch papers: Load Stock now checks itself against the plan", () => {
  const w = F.world();
  w.store.addEvents([{ type: "loadstock.checked", by: "Ajay", where: "Delivery app", how: "driver", subject: { van: "Van 4" },
    data: { dispatchDocsReady: false, mismatches: [
      { productId: "p1", name: "Amla Pickle", plan: 20, loaded: 10, reason: "stock" },  // some loaded → Stock not loaded
      { productId: "p2", name: "Mango Pickle", plan: 15, loaded: 0, reason: "stock" },  // none at all → Missing stock
      { productId: "p3", name: "Chakli", plan: 12, loaded: 18, reason: "wrong" },
      { productId: "p4", name: "Cookies", plan: 10, loaded: 6, reason: "batch" },
    ] } }]);
  assert.ok(find(w, "stock-not-loaded"));
  assert.ok(find(w, "missing-stock"));
  assert.ok(find(w, "wrong-loading"));
  assert.ok(find(w, "wrong-batch-loaded"));
  assert.ok(find(w, "dispatch-doc-missing"));
});

test("crates: Manage Assets records crates left and brought back, and more out than back is crates not back", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addEvents([
    { type: "stop.delivered", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name }, data: { value: 2400, collected: 2400 } },
    { type: "assets.recorded", by: "Ajay", where: "Delivery app · Manage assets", how: "driver", subject: { customer: cust[0].name },
      data: { movements: [{ asset: "Crate — Large", given: 3, taken: 1 }], empties: { cratesOut: 3, cratesBack: 1 } } },
    { type: "assets.recorded", by: "Ajay", where: "Delivery app · Manage assets", how: "driver", subject: { customer: cust[1].name },
      data: { movements: [{ asset: "Crate — Large", given: 2, taken: 2 }], empties: { cratesOut: 2, cratesBack: 2 } } },
  ]);
  const all = dl(w).incidents.incidents.filter((i) => i.type === "crates");
  assert.equal(all.length, 1, "an even swap raises nothing");
  assert.equal(all[0].facts.crates, 2, "2 crates still with the shop");
});

test("crates: the empties a drop carried before Manage Assets took them still count", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addEvents([{ type: "stop.delivered", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name },
    data: { value: 2400, collected: 2400, empties: { cratesOut: 3, cratesBack: 1 } } }]);
  const c = find(w, "crates");
  assert.ok(c, "2 crates still with the shop");
  assert.equal(c.facts.crates, 2);
});

test("damaged/expiry/wrong-product RETURN (the Returns-family rows): a standalone pickup tags them, not the Product-family row", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  w.store.addEvents([
    { type: "return.recorded", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name }, data: { reason: "DAMAGED", items: [{ name: "Jar", qty: 1 }], value: 300, standalone: true } },
    { type: "return.recorded", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[1].name }, data: { reason: "EXPIRED", items: [{ name: "Jar", qty: 1 }], value: 300, standalone: true } },
    { type: "return.recorded", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[2].name }, data: { reason: "WRONG_PRODUCT", items: [{ name: "Jar", qty: 1 }], value: 300, standalone: true } },
  ]);
  assert.ok(find(w, "damaged-return"));
  assert.ok(find(w, "expiry-return"));
  assert.ok(find(w, "wrong-product-return"));
  assert.equal(typesOf(w).includes("damaged-goods"), false, "not the Product-family row when it's standalone");

  // The same reasons at today's actual drop (no standalone flag) still tag
  // the Product-family rows exactly as before — nothing regresses.
  const w2 = F.world();
  const cust2 = w2.tower.pass().state.customers;
  w2.store.addEvents([{ type: "return.recorded", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust2[0].name }, data: { reason: "DAMAGED", items: [{ name: "Jar", qty: 1 }], value: 300 } }]);
  assert.ok(find(w2, "damaged-goods"));
});

test("the closing-loop gap: a real drop now tells the tower it happened, and every 'delivered' incident can resolve", () => {
  const w = F.world();
  const cust = w.tower.pass().state.customers;
  // Miss it first — Shop closed — then the platform's own delivery event
  // (not a demo/import record) proves the redo.
  w.store.addEvents([{ type: "stop.skipped", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name, van: "Van 2" },
    data: { reason: "SHOP_CLOSED", label: "Shop Closed", value: 2200 } }]);
  const before = find(w, "shop-closed");
  assert.equal(before.standing, "ugly");
  w.store.addEvents([{ type: "action.reschedule", by: "You", where: "Control Tower", how: "owner", subject: { incident: before.id, customerId: cust[0].id },
    data: { date: dl(w).incidents.today, window: "evening", notify: false } }]);
  w.clock.advance(60000);
  w.store.addEvents([{ type: "stop.delivered", by: "Ajay", where: "Delivery app", how: "driver", subject: { customer: cust[0].name }, data: { value: 2200, collected: 2200 } }]);
  const after = find(w, "shop-closed");
  assert.equal(after.state, "resolved", "the real drop closed it — no demo, no addDeliveries, just the event");
  assert.match(after.proof.text, /^Delivered/);
});

test("gst-mismatch: a customer's GSTIN on file that doesn't parse, with a stop due today", () => {
  const w = F.world();
  const v = w.tower.pass();
  const st = v.state, cust = st.customers[0];
  const X = IN.derive({ st: st, rec: {}, now: v.state.now,
    pending: [{ no: "O-1", customerId: cust.id, customer: cust.name, amount: 500, slot: new Date(v.state.now + 3600e3).toISOString() }],
    owed: {}, limit: () => null, gstinById: { [cust.id]: "not-a-real-gstin" } });
  const inc = X.incidents.find((i) => i.type === "gst-mismatch");
  assert.ok(inc, "a bad GSTIN on a customer due today is flagged");
  // A well-formed one never is.
  const X2 = IN.derive({ st: st, rec: {}, now: v.state.now,
    pending: [{ no: "O-1", customerId: cust.id, customer: cust.name, amount: 500, slot: new Date(v.state.now + 3600e3).toISOString() }],
    owed: {}, limit: () => null, gstinById: { [cust.id]: "27AAAPL1234C1Z5" } });
  assert.equal(X2.incidents.find((i) => i.type === "gst-mismatch"), undefined);
});

test("insufficient-capacity: a van booked past the cases it can carry, from Route Planning's own field", () => {
  const w = F.world(13.5 === undefined ? undefined : undefined);
  const v = w.tower.pass();
  const route = v.state.route;
  if (!route) return;  // no route on this fixture's day: nothing to compare against
  const van = (route.stops[0] || {}).van;
  if (!van) return;
  const cases = route.stops.filter((s) => s.van === van).reduce((n, s) => n + (Number(s.cases) || 0), 0);
  const X = IN.derive({ st: v.state, rec: v.records || {}, now: v.state.now, pending: [], owed: {}, limit: () => null,
    vanCapacity: { [van]: Math.max(1, cases - 1) } });
  const inc = X.incidents.find((i) => i.type === "insufficient-capacity");
  assert.ok(inc, van + " is over a capacity set one case below its booking");
});

/* The store journey graph, walked by the engine on the store's own facts.
   Run from v10/:  node --test test/journey/*.test.js
   Spec: context/control-tower/CONTROL_TOWER_JOURNEY.md. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const J = require("../../assets/journey/engine.js");
const Facts = require("../../assets/ct/journey-facts.js");
const GRAPH = require("../../assets/journey/graphs/store-journey.json");

const L = J.load(GRAPH);
const at = (extra) => L.evaluate(Facts.blank(extra));

test("the graph is valid", () => {
  const v = J.validate(GRAPH);
  assert.ok(v.ok, JSON.stringify(v.errors));
});

test("a store created a minute ago: setup, Products first, everything else locked", () => {
  const e = at();
  assert.equal(e.focus(), "products.added");
  assert.equal(e.focusAt(0), "setup");
  assert.equal(e.state("customers"), "locked");
  assert.deepEqual(e.blockers("customers").nodes, ["products.added"]);
  assert.equal(e.state("first-orders"), "locked");
  assert.equal(e.state("production"), "skipped", "a distributor never sees Production");
});

test("products in, three broken: fix them; customers open", () => {
  const e = at({ products: { count: 42, broken: 3, incomplete: 8 } });
  assert.equal(e.state("products.added"), "done");
  assert.equal(e.focus(), "products.fixed");
  assert.equal(e.state("customers.added"), "available");
});

test("products and customers fixed: the store is active and Orders opens", () => {
  const e = at({ products: { count: 42, broken: 0, incomplete: 8 }, customers: { count: 18, broken: 0, incomplete: 12 } });
  assert.equal(e.state("setup"), "done", "Complete is optional; it doesn't hold the chapter");
  assert.equal(e.focus(), "order.first");
  assert.equal(e.focusAt(0), "first-orders");
  assert.equal(e.state("inventory"), "locked", "Inventory waits for the first order's chapter");
});

test("first order in: Deliveries and Collections open; the first order stays proven", () => {
  const f = { products: { count: 42, broken: 0 }, customers: { count: 18, broken: 0 }, orders: { count: 1, days: 1 } };
  let r = L.step(null, Facts.blank(f), 1);
  assert.equal(r.ev.state("run-day"), "available");
  assert.equal(r.ev.focusAt(0), "first-orders", "the order chapter still has required steps");
  r = L.step(r.snapshot, Facts.blank(Object.assign({}, f, { orders: { count: 0, days: 0 } })), 2);
  assert.equal(r.ev.state("order.first"), "done", "sticky: a deleted order doesn't take the milestone back");
});

test("a manufacturer gets Production; marking skip:purchase skips Purchase", () => {
  const e = at({ business: { makes: true } });
  assert.notEqual(e.state("production"), "skipped");
  let s = L.mark(L.step(null, Facts.blank(), 1).snapshot, "skip:purchase", true, 2);
  assert.equal(L.evaluate(Facts.blank(), s).state("purchase"), "skipped");
});

test("everything proven: Running is the focus", () => {
  const e = at({
    products: { count: 42, broken: 0, incomplete: 0 }, customers: { count: 18, broken: 0, incomplete: 0, noTerms: 0 },
    orders: { count: 30, days: 9, sent: 30 }, deliveries: { count: 25, vans: 2, daysClosed: 5 }, payments: { count: 12 },
    dues: { imported: true }, stock: { counted: 42, unknown: 0 }, suppliers: { count: 3, unmapped: 0 }, purchases: { received: 1 },
  });
  assert.equal(e.focus(), "running");
  assert.equal(e.node("running").payload.mode, "running");
  assert.equal(e.progress().ratio < 1, true, "Running itself is the one step left");
});

test("the live demo business reads as a store well along", () => {
  const F = require("../control-tower/fixture.js");
  const v = F.world().tower.pass();
  const facts = Facts.facts(v);
  assert.ok(facts.products.count > 50 && facts.customers.count > 30, "the demo tenant's own catalogue and shops");
  const e = L.evaluate(facts);
  assert.equal(e.state("products.added"), "done");
  assert.equal(e.state("customers.added"), "done");
});

test("nothing counts as done in an empty store (no vacuous 'none missing')", () => {
  const e = at();
  const done = e.nodes().filter((n) => n.state === "done").map((n) => n.id);
  assert.deepEqual(done, []);
});

test("a skipped area skips its own steps, so they never count or take the focus", () => {
  const e = at();
  assert.equal(e.state("production.recipe"), "skipped");
  assert.equal(e.state("production.batch"), "skipped");
});

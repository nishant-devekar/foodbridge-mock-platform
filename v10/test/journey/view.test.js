/* What the Control Tower draws from a journey, headless.
   Run from v10/:  node --test test/journey/*.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
global.window = globalThis;
const J = require("../../assets/journey/engine.js");
const Facts = require("../../assets/ct/journey-facts.js");
const V = require("../../assets/ct/journey-view.js");
const GRAPH = require("../../assets/journey/graphs/store-journey.json");

const L = J.load(GRAPH);
const home = (extra) => { const f = Facts.blank(extra); return V.home(L.evaluate(f), f); };

test("a new store's home: chapter line, Products the focus card, the rest locked with why", () => {
  const h = home();
  assert.equal(h.mode, "journey");
  assert.equal(h.chapter.line, "Let's get your store ready");
  assert.deepEqual(h.cards.map((c) => c.area + ":" + c.tone), ["products:focus"]);
  assert.equal(h.cards[0].line, "Add your products");
  assert.deepEqual(h.pins, ["products", "customers"]);
  const lk = Object.fromEntries(h.locked.map((x) => [x.area, x.line]));
  assert.equal(lk.customers, "Opens after your first product");
  assert.equal(lk.order, "Opens when your store is ready");
  assert.ok(!("production" in lk), "a skipped area isn't listed");
  assert.equal(h.trail[0].now, true);
});

test("the focus card's line carries the counted fact", () => {
  const h = home({ products: { count: 42, broken: 3, incomplete: 8 } });
  assert.equal(h.cards[0].area, "products");
  assert.equal(h.cards[0].line, "3 would break an order");
  assert.equal(h.cards[1].area, "customers");
  assert.equal(h.cards[1].tone, "todo");
});

test("store active: Orders leads, optional work stays offered, the footer re-pins", () => {
  const h = home({ products: { count: 42, broken: 0, incomplete: 8 }, customers: { count: 18, broken: 0, incomplete: 12 } });
  assert.equal(h.chapter.line, "Your store is ready · take your first order");
  assert.equal(h.cards[0].area, "order");
  assert.equal(h.cards[0].tone, "focus");
  assert.deepEqual(h.cards.filter((c) => c.tone === "optional").map((c) => c.line), ["8 have no MRP", "12 have no delivery pin"]);
  assert.deepEqual(h.pins, ["order", "customers"]);
});

test("everything proven: running mode, today's pins", () => {
  const h = home({ products: { count: 1, broken: 0, incomplete: 0 }, customers: { count: 1, broken: 0, incomplete: 0, noTerms: 0 },
    orders: { count: 9, days: 9, sent: 9 }, deliveries: { count: 2, vans: 1, daysClosed: 2 }, payments: { count: 2 }, dues: { imported: true },
    stock: { counted: 1, unknown: 0 }, suppliers: { count: 1, unmapped: 0 }, purchases: { received: 1 } });
  assert.equal(h.mode, "running");
  assert.deepEqual(h.pins, ["deliveries", "collections"]);
});

test("an area's step sheet: its steps, the next one, its screen and demo", () => {
  const f = Facts.blank({ products: { count: 42, broken: 3, incomplete: 8 } });
  const a = V.area(L.evaluate(f), f, "products");
  assert.deepEqual(a.steps.map((s) => s.label + ":" + s.state), ["Added:done", "Fixed:available", "Complete:locked"]);
  assert.equal(a.next.ask, "Fix the products that would break an order");
  assert.equal(a.next.say, "3 would break an order");
  assert.equal(a.next.screen.route, "#/product-master/finished-goods");
  assert.deepEqual(a.next.demo.facts, { products: { broken: 0 } });
});

test("a moment: the highest announce wins, rewards add up", () => {
  let r = L.step(null, Facts.blank({ products: { count: 42, broken: 3, incomplete: 8 }, customers: { count: 18, broken: 2, incomplete: 12 } }), 1);
  r = L.step(r.snapshot, Facts.blank({ products: { count: 42, broken: 0, incomplete: 8 }, customers: { count: 18, broken: 0, incomplete: 12 } }), 2);
  const m = V.moment(r.events, r.ev);
  assert.equal(m.announce.title, "Your store is ready");
  assert.equal(m.announce.open, "order");
  assert.equal(m.freeDays, 2);
  assert.deepEqual(m.done, ["Products · fixed", "Customers · fixed"]);
  assert.equal(V.earned(r.ev), 2);
});

test("a graph with other names still draws: the view reads payloads, never ids", () => {
  const g = { schema: "fb.journey/1", id: "other", nodes: [
    { id: "c1", type: "phase", payload: { line: "Start here", pins: ["x", "y"] } },
    { id: "n1", type: "box", parent: "c1", payload: { area: "x" } },
    { id: "n1a", type: "do", parent: "n1", payload: { ask: "Do the x thing" }, done: { fact: "x", gte: 1 } },
    { id: "n2", type: "box", parent: "c1", requires: ["n1"], payload: { area: "y", locked: "after x" } },
    { id: "n2a", type: "do", parent: "n2", done: { fact: "y", gte: 1 } },
  ] };
  const ev = J.load(g).evaluate({});
  const h = V.home(ev, {});
  assert.equal(h.chapter.line, "Start here");
  assert.equal(h.cards[0].line, "Do the x thing");
  assert.equal(h.locked[0].line, "Opens after x");
  assert.deepEqual(h.pins, ["x", "y"]);
});

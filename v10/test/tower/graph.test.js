/* The tower graph: one JSON drives the whole Control Tower (17 Oct 2026).
   Run from v10/:  node --test test/tower/*.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const J = require("../../assets/journey/engine.js");
const R = require("../../assets/tower/runtime.js");
const JF = require("../../assets/ct/journey-facts.js");
const GRAPH = require("../../assets/tower/graphs/control-tower.json");

const E = J.load(GRAPH);
const walk = (facts) => { const ev = E.evaluate(facts, null); return { ev, m: R.read(ev) }; };
const newStore = (extra) => JF.blank(Object.assign({ store: { new: true } }, extra || {}));
const keys = (areas) => areas.map((a) => a.key);

test("the graph is valid for the engine", () => {
  const v = J.validate(GRAPH);
  assert.ok(v.ok, JSON.stringify(v.errors));
});

test("the footer is the graph's tabs: four, in its sequence, one home", () => {
  const { m } = walk(newStore());
  assert.deepEqual(m.tabs.map((t) => t.label), ["Now", "Business", "Wallet", "More"]);
  assert.deepEqual(m.tabs.map((t) => t.view), ["feed", "board", "wallet", "menu"]);
  assert.equal(m.tabs.filter((t) => t.home).length, 1);
});

test("every area carries what the screen draws: word, icon, colours, rank, source", () => {
  const { m } = walk(newStore());
  assert.ok(m.areas.length >= 8);
  for (const a of m.areas) {
    assert.ok(a.word && a.icon && a.source, a.key);
    assert.ok(a.colour && a.colour.deep && a.colour.bright && a.colour.tint, a.key);
    assert.equal(typeof a.rank, "number", a.key);
  }
  assert.equal(new Set(m.areas.map((a) => a.rank)).size, m.areas.length, "no two areas share a rank");
});

test("a new store: Products open, every other area waits, the first step is the focus", () => {
  const { ev, m } = walk(newStore());
  assert.deepEqual(keys(m.open), ["products"]);
  assert.equal(ev.focus(), "products.added");
});

test("products and customers in: the store is ready and Orders opens on its first order", () => {
  const { ev, m } = walk(newStore({ products: { count: 47, broken: 0, incomplete: 0 }, customers: { count: 18, broken: 0, incomplete: 0, noTerms: 18 } }));
  assert.equal(ev.state("store-ready"), "done");
  assert.ok(keys(m.open).includes("order"));
  assert.equal(ev.focus(), "order.first");
});

test("a trading business stands where it trades: its areas open on proof, setup areas are not its", () => {
  const facts = JF.blank({ store: { new: false }, products: { count: 86, broken: 0, incomplete: 23 }, customers: { count: 40, broken: 1, incomplete: 3, noTerms: 10 },
    orders: { count: 176, days: 95, sent: 0 }, deliveries: { count: 23, vans: 2, daysClosed: 1 }, payments: { count: 189 }, stock: { counted: 86, unknown: 0 },
    suppliers: { count: 6, unmapped: 0 }, purchases: { received: 54 }, business: { makes: true } });
  const { m } = walk(facts);
  assert.deepEqual(keys(m.open).sort(), ["collections", "deliveries", "inventory", "order", "production", "purchase"]);
  assert.equal(m.area("products").state, "skipped");
  assert.equal(m.area("order").state !== "locked", true, "one customer to fix doesn't lock a store with 176 orders");
});

test("a business that makes nothing has no Production", () => {
  const { m } = walk(JF.blank({ store: { new: false }, orders: { count: 3, days: 2, sent: 1 }, business: { makes: false } }));
  assert.equal(m.area("production").state, "skipped");
  assert.ok(!keys(m.open).includes("production"));
});

test("change the graph, change the tower: words, sequence, tabs and areas follow", () => {
  const g = JSON.parse(JSON.stringify(GRAPH));
  const col = g.nodes.find((n) => n.payload && n.payload.area === "collections");
  col.payload.word = "Money in"; col.payload.rank = -1;
  g.nodes.find((n) => n.id === "now").label = "Today";
  g.nodes.find((n) => n.payload && n.payload.area === "production").skip = true;
  const m = R.read(J.load(g).evaluate(JF.blank({ store: { new: false }, orders: { count: 3, days: 2, sent: 1 }, business: { makes: true } }), null));
  assert.equal(m.tabs[0].label, "Today");
  assert.equal(m.area("collections").word, "Money in");
  assert.equal(R.stackOpts(m).areas.collections.rank, -1);
  assert.ok(!keys(m.open).includes("production"));
});

test("a graph with a new area draws it: the runtime has no list of its own", () => {
  const g = JSON.parse(JSON.stringify(GRAPH));
  g.nodes.push({ id: "returns", type: "area", parent: "areas", label: "Returns", requires: ["order.first"],
    payload: { area: "returns", word: "Returns", icon: "box", colour: { deep: "#333", bright: "#666", tint: "#eee" }, rank: 9, source: "lever:returns", feed: { noun: ["return", "returns"] } } });
  assert.ok(J.validate(g).ok);
  const m = R.read(J.load(g).evaluate(JF.blank({ store: { new: false }, orders: { count: 1, days: 1, sent: 0 } }), null));
  assert.equal(m.area("returns").word, "Returns");
  assert.ok(keys(m.open).includes("returns"));
});

test("templates fill from values: {n}, {n|word}, {owed}", () => {
  assert.equal(R.fill("{n|product} at risk", { n: 1 }), "1 product at risk");
  assert.equal(R.fill("{n|batch} on the floor", { n: 2 }), "2 batches on the floor");
  assert.equal(R.fill("**{owed}** outstanding", { owed: "₹5" }), "**₹5** outstanding");
  assert.equal(R.fill("#/board?tab={tab}", { tab: "fg" }), "#/board?tab=fg");
});

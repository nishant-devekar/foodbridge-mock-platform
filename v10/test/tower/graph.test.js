/* The tower on a flow (fb.journey/2, 17 Oct 2026): the store journey, the
   writer that adds a store's live work as nodes, and the runtime that reads
   the walk for the screen.  Run from v10/:  node --test test/tower/*.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
global.window = globalThis;
const F = require("../../assets/journey/flow.js");
const R = require("../../assets/tower/runtime.js");
const W = require("../../assets/tower/writer.js");
const JF = require("../../assets/ct/journey-facts.js");
const V = require("../../assets/ct/journey-view.js");
const FLOW = require("../../assets/tower/graphs/store-journey.json");
const RULES = require("../../assets/tower/store-rules.json");
const TABS = [{ id: "now", label: "Now", view: "feed", home: true }];

const walk = (graph, facts) => { const ev = F.load(graph).evaluate(facts); return { ev, m: R.read(ev, RULES, TABS) }; };
const keys = (areas) => areas.map((a) => a.key);
const trading = () => JF.blank({ store: { new: false }, products: { count: 86, broken: 0, incomplete: 23 }, customers: { count: 40, broken: 1, incomplete: 3, noTerms: 10 },
  orders: { count: 176, days: 95, sent: 3 }, deliveries: { count: 23, vans: 2 }, payments: { count: 189 }, dues: { imported: true },
  stock: { counted: 86, unknown: 0 }, suppliers: { count: 6 }, purchases: { received: 54 }, business: { makes: true }, production: { recipes: 1, batches: 1 } });

test("the flow is a flat list of things to do: no app, tab, milestone or container nodes", () => {
  assert.ok(F.validate(FLOW).ok, JSON.stringify(F.validate(FLOW).errors));
  for (const n of FLOW.nodes) {
    assert.ok(n.area, n.id + " names its area");
    assert.ok(n.card && (n.card.title || n.card.ask), n.id + " says what to do");
    assert.equal(n.type, undefined, n.id + " has no type");
    assert.equal(n.parent, undefined, n.id + " has no parent");
  }
});

test("a new store: one card, add products; the rings show only Products", () => {
  const { ev, m } = walk(FLOW, JF.blank({ store: { new: true } }));
  assert.deepEqual(ev.open(), ["add-products"]);
  assert.deepEqual(keys(m.open), ["products"]);
  assert.equal(m.area("customers").state, "locked");
});

test("five products right: fix products goes optional and customers open; five customers right: the first order", () => {
  let { ev } = walk(FLOW, JF.blank({ products: { count: 7, broken: 2 } }));
  assert.equal(ev.state("fix-products"), "enough");
  assert.equal(ev.state("add-customers"), "open");
  ({ ev } = walk(FLOW, JF.blank({ products: { count: 7, broken: 2 }, customers: { count: 6, broken: 1 } })));
  assert.equal(ev.focus(), "first-order");
});

test("a trading business: the journey stands where its records say; its live work is nodes in the same flow", () => {
  const cards = [
    { key: "d:1", area: "deliveries", tone: "ugly", title: "Shahi Caterers", kicker: "Shop closed" },
    { key: "c:2", area: "collections", tone: "bad", title: "12 customers owe" },
  ];
  const w = W.write(FLOW, cards);
  assert.ok(F.validate(w.graph).ok, JSON.stringify(F.validate(w.graph).errors));
  const facts = Object.assign(trading(), w.facts);
  const { ev } = walk(w.graph, facts);
  const open = ev.open();
  assert.equal(open[0], "live-d_1", "urgent live work comes first");
  assert.ok(open.indexOf("create-purchase") !== -1 && open.indexOf("create-purchase") < open.indexOf("live-c_2"), "then the journey's to-dos, then the rest");
  assert.equal(ev.state("tidy-products"), "enough", "optional journey work stays offered");
  assert.equal(ev.state("first-order"), "done");
  assert.equal(w.cards["live-d_1"].title, "Shahi Caterers", "the tower draws a live node with its record's card");
  /* The record is dealt with: its fact goes, its node is done. */
  const gone = Object.assign(trading(), { live: { "live-c_2": true } });
  assert.equal(walk(w.graph, gone).ev.state("live-d_1"), "done");
});

test("live work waits for its area: a new store's deliveries can't open before its first order", () => {
  const w = W.write(FLOW, [{ key: "x", area: "deliveries", tone: "ugly", title: "A drop" }]);
  const { ev } = walk(w.graph, Object.assign(JF.blank(), w.facts));
  assert.equal(ev.state("live-x"), "locked");
});

test("change the flow, change the tower: a new area and node draw with no code change", () => {
  const g = JSON.parse(JSON.stringify(FLOW));
  g.areas.returns = { label: "Returns", word: "Returns", icon: "box", colour: { deep: "#333", bright: "#666", tint: "#eee" } };
  g.nodes.push({ id: "take-return", area: "returns", after: ["first-order"], done: { fact: "returns.count", gte: 1 }, card: { title: "Take a return", coins: 50 } });
  const { ev, m } = walk(g, trading());
  assert.equal(ev.state("take-return"), "open");
  assert.equal(m.area("returns").word, "Returns");
  assert.ok(keys(m.open).includes("returns"));
  g.areas.collections.word = "Money in";
  assert.equal(walk(g, trading()).m.area("collections").word, "Money in");
});

test("the view: a node's line and title carry its counted fact; a journey area reads as the tower's lever", () => {
  const f = JF.blank({ products: { count: 3, broken: 1, incomplete: 2 } });
  const { ev } = walk(FLOW, f);
  assert.equal(V.line(ev.node("fix-products"), f), "2 ready to sell");
  assert.equal(V.title(ev.node("add-products"), f), "Add products");
  const lv = V.lever(ev, f, "products");
  assert.equal(lv.action.step, "fix-products");
  assert.deepEqual(lv.tiles.bad.rows.map((r) => r.jstep), ["add-products", "fix-products"]);
  assert.equal(V.lever(ev, f, "customers").locked, true);
  assert.equal(V.home(ev, f).now.id, "fix-products");
});

test("a moment: done nodes pay their coins, an announce speaks once", () => {
  const E = F.load(FLOW);
  const a = E.step(null, JF.blank(), 1);
  const b = E.step(a.snapshot, JF.blank({ products: { count: 5, broken: 0 }, customers: { count: 5 }, orders: { count: 1 } }), 2);
  const m = V.moment(b.events, b.ev);
  assert.ok(m.coins >= 50 + 100 + 50 + 100 + 200, "products, customers and the first order paid");
  assert.equal(m.announce.title, "Your first order is in");
  assert.ok(V.earned(b.ev) >= m.coins);
});

test("zero context: the writer and the view name no node of the journey", () => {
  for (const f of ["../../assets/tower/writer.js", "../../assets/ct/journey-view.js", "../../assets/tower/runtime.js"]) {
    const src = fs.readFileSync(path.join(__dirname, f), "utf8");
    for (const n of FLOW.nodes) assert.ok(src.indexOf('"' + n.id + '"') === -1, f + " names " + n.id);
  }
});

test("templates fill from values: {n}, {n|word}, {owed}", () => {
  assert.equal(R.fill("{n|product} at risk", { n: 1 }), "1 product at risk");
  assert.equal(R.fill("{n|batch} on the floor", { n: 2 }), "2 batches on the floor");
  assert.equal(R.fill("**{owed}** outstanding", { owed: "₹5" }), "**₹5** outstanding");
});

/* The flow engine, fb.journey/2 (17 Oct 2026).
   Run from v10/:  node --test test/journey/flow.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const F = require("../../assets/journey/flow.js");
const STORE = require("../../assets/tower/graphs/store-journey.json");

const g = (nodes, extra) => Object.assign({ schema: "fb.journey/2", id: "t", nodes: nodes }, extra || {});
const states = (graph, facts) => { const ev = F.load(graph).evaluate(facts || {}); const o = {}; graph.nodes.forEach((n) => { o[n.id] = ev.state(n.id); }); return o; };

test("the engine names nothing it walks: no business word in flow.js", () => {
  const src = fs.readFileSync(path.join(__dirname, "../../assets/journey/flow.js"), "utf8").toLowerCase();
  for (const w of ["product", "customer", "order", "deliver", "invoice", "stock", "store", "payment", "supplier", "rupee", "tower", "products"]) {
    assert.ok(src.indexOf(w) === -1, "flow.js mentions " + w);
  }
});

test("validate names every problem with its path: unknown edge, loop, bad condition, repeat", () => {
  const v = F.validate(g([{ id: "a", after: ["zz"] }, { id: "b", done: { fact: "x" } }, { id: "b" }]));
  assert.equal(v.ok, false);
  const msgs = v.errors.map((e) => e.path + " " + e.message).join("\n");
  assert.match(msgs, /\$\.nodes\[0\]\.after\[0\] names no node: zz/);
  assert.match(msgs, /\$\.nodes\[1\]\.done a fact needs an operator/);
  assert.match(msgs, /\$\.nodes\[2\]\.id repeats b/);
  const loop = F.validate(g([{ id: "a", after: ["b"] }, { id: "b", after: ["a"] }]));
  assert.match(loop.errors[0].message, /edges loop/);
  assert.equal(F.validate({ schema: "fb.journey/1", id: "x", nodes: [{ id: "a" }] }).ok, false);
});

test("a node opens when every node it comes after is enough, done or skipped", () => {
  const flow = g([
    { id: "a", enough: { fact: "n", gte: 1 }, done: { fact: "n", gte: 5 } },
    { id: "b", after: ["a"], done: { fact: "m", gte: 1 } },
  ]);
  assert.deepEqual(states(flow, { n: 0 }), { a: "open", b: "locked" });
  assert.deepEqual(states(flow, { n: 2 }), { a: "enough", b: "open" }, "enough keeps a open, as optional, and opens b");
  assert.deepEqual(states(flow, { n: 5 }), { a: "done", b: "open" });
  assert.deepEqual(states(flow, { n: 5, m: 1 }), { a: "done", b: "done" });
});

test("join any needs one edge; when is an extra gate; skip passes its edges", () => {
  const flow = g([
    { id: "a", done: { fact: "a", truthy: true } }, { id: "b", done: { fact: "b", truthy: true } },
    { id: "c", after: ["a", "b"], join: "any", when: { fact: "ok", eq: true } },
    { id: "d", skip: true }, { id: "e", after: ["d"] },
  ]);
  assert.equal(states(flow, { a: true, ok: false }).c, "locked");
  assert.equal(states(flow, { a: true, ok: true }).c, "open");
  assert.equal(states(flow, {}).e, "open");
  assert.deepEqual(F.load(flow).evaluate({ ok: true }).blockers("c"), { nodes: ["a", "b"], gate: false });
});

test("proof beats order: a done condition holds even before its edges pass", () => {
  const flow = g([{ id: "a" }, { id: "b", after: ["a"], done: { fact: "x", eq: 1 } }]);
  assert.equal(states(flow, { x: 1 }).b, "done");
});

test("open lists what to do now first, then the optional, each in the graph's order", () => {
  const flow = g([{ id: "a", enough: true }, { id: "b" }, { id: "c", enough: true }, { id: "d" }]);
  const ev = F.load(flow).evaluate({});
  assert.deepEqual(ev.open(), ["b", "d", "a", "c"]);
  assert.equal(ev.focus(), "b");
});

test("step reports what changed and keeps sticky nodes done", () => {
  const flow = g([{ id: "a", sticky: true, done: { fact: "x", gte: 1 } }, { id: "b", after: ["a"] }]);
  const E = F.load(flow);
  const s1 = E.step(null, { x: 0 }, 1);
  assert.equal(s1.events.length, 0, "the first look is not news");
  const s2 = E.step(s1.snapshot, { x: 1 }, 2);
  assert.deepEqual(s2.events.map((e) => e.type + ":" + e.node), ["node.done:a", "node.open:b"]);
  assert.equal(s2.snapshot.doneAt.a, 2);
  const s3 = E.step(s2.snapshot, { x: 0 }, 3);
  assert.equal(s3.ev.state("a"), "done", "sticky: the proof was seen once");
});

test("areas() groups by a field the engine doesn't interpret", () => {
  const flow = g([{ id: "a", area: "p" }, { id: "b", area: "q", after: ["a"] }, { id: "c", area: "p", enough: true }], { areas: { q: {}, p: {} } });
  const a = F.load(flow).evaluate({}).areas();
  assert.deepEqual(a.map((x) => x.key), ["q", "p"], "in the graph's areas order");
  assert.deepEqual(a[1].count, { locked: 0, open: 1, enough: 1, done: 0, skipped: 0 });
});

/* The store's journey, as the owner described it (17 Oct 2026). */
const blank = (x) => {
  const f = { products: { count: 0, broken: 0, incomplete: 0, correct: 0 }, customers: { count: 0, broken: 0, incomplete: 0, correct: 0, noTerms: 0 },
    orders: { count: 0, days: 0, sent: 0 }, deliveries: { count: 0, vans: 0 }, payments: { count: 0 }, dues: { imported: false },
    stock: { counted: 0, unknown: 0 }, suppliers: { count: 0 }, purchases: { received: 0 }, production: { recipes: 0, batches: 0 }, business: { makes: false } };
  Object.keys(x || {}).forEach((k) => { f[k] = Object.assign({}, f[k], x[k]); });
  return f;
};
test("store journey: the store starts on add products; nothing else is open", () => {
  assert.ok(F.validate(STORE).ok, JSON.stringify(F.validate(STORE).errors));
  const ev = F.load(STORE).evaluate(blank());
  assert.deepEqual(ev.open(), ["add-products"]);
});
test("store journey: products in, fix products opens; five right, it goes optional and customers open beside it", () => {
  let ev = F.load(STORE).evaluate(blank({ products: { count: 3, correct: 1, broken: 2 } }));
  assert.equal(ev.state("fix-products"), "open");
  assert.equal(ev.state("add-customers"), "locked");
  ev = F.load(STORE).evaluate(blank({ products: { count: 8, correct: 5, broken: 3 } }));
  assert.equal(ev.state("fix-products"), "enough");
  assert.equal(ev.state("add-customers"), "open");
  assert.ok(ev.open().indexOf("fix-products") > ev.open().indexOf("add-customers"), "the optional comes after what's required");
});
test("store journey: five reachable customers open the first order", () => {
  const ev = F.load(STORE).evaluate(blank({ products: { count: 8, correct: 6, broken: 2 }, customers: { count: 7, correct: 5, broken: 2 } }));
  assert.equal(ev.state("fix-customers"), "enough");
  assert.equal(ev.focus(), "first-order");
});
test("store journey: after the first order, orders and a delivery; then the invoice and a payment; then stock; then a purchase order", () => {
  const E = F.load(STORE), base = { products: { count: 8, correct: 8 }, customers: { count: 7, correct: 7 } };
  let ev = E.evaluate(blank(Object.assign({ orders: { count: 1, days: 1 } }, base)));
  assert.deepEqual(ev.open().filter((id) => ev.state(id) === "open"), ["keep-ordering", "first-delivery"]);
  ev = E.evaluate(blank(Object.assign({ orders: { count: 1, days: 1 }, deliveries: { count: 1 } }, base)));
  assert.deepEqual(ev.open().filter((id) => ev.state(id) === "open"), ["keep-ordering", "send-invoice", "first-payment"]);
  ev = E.evaluate(blank(Object.assign({ orders: { count: 1, days: 1, sent: 1 }, deliveries: { count: 1 }, payments: { count: 1 } }, base)));
  assert.equal(ev.state("count-stock"), "open");
  assert.equal(ev.state("create-purchase"), "locked");
  ev = E.evaluate(blank(Object.assign({ orders: { count: 1, days: 1, sent: 1 }, deliveries: { count: 1 }, payments: { count: 1 }, stock: { counted: 40, unknown: 0 } }, base)));
  assert.equal(ev.state("create-purchase"), "open");
  assert.ok(!STORE.nodes.some((n) => n.area === "production"), "no manufacturing steps in the journey");
});

/* Journey engine, headless. Run from v10/:
     node --test test/journey/*.test.js
   Contract: assets/journey/README.md. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const J = require("../../assets/journey/engine.js");

const ENGINE = path.join(__dirname, "../../assets/journey/engine.js");

/* A tiny graph with no business in it at all. */
function g(extra) {
  return Object.assign({
    schema: "fb.journey/1", id: "t", version: "1",
    nodes: [
      { id: "a", type: "group" },
      { id: "a1", type: "step", parent: "a", done: { fact: "x", gte: 1 } },
      { id: "a2", type: "step", parent: "a", requires: ["a1"], done: { fact: "y", eq: true } },
      { id: "a3", type: "step", parent: "a", requires: ["a2"], optional: true, done: { fact: "z", truthy: true } },
      { id: "b", type: "group", requires: ["a"] },
      { id: "b1", type: "step", parent: "b", done: { fact: "w", gte: 2 } },
      { id: "end", type: "goal", requires: ["b"] },
    ],
  }, extra || {});
}

test("zero context: the engine names no business", () => {
  const src = fs.readFileSync(ENGINE, "utf8").toLowerCase();
  for (const w of ["product", "customer", "order", "deliver", "collect", "invoice", "stock", "lever", "store", "rupee", "₹"]) {
    assert.ok(!src.includes(w), "engine.js mentions \"" + w + "\"");
  }
});

test("validate lists every error with its JSON path", () => {
  const bad = { schema: "x", id: "", nodes: [
    { id: "a", type: "s" }, { id: "a", type: "s" }, { id: "b" },
    { id: "c", type: "s", parent: "nope", requires: ["ghost"], done: { fact: "q", bogus: 1 } },
    { id: "d", type: "s", available: { node: "zz", is: "finished" } },
  ], edges: [{ from: "a", to: "missing", kind: "sideways" }] };
  const v = J.validate(bad);
  assert.equal(v.ok, false);
  const paths = v.errors.map((e) => e.path);
  for (const p of ["$.schema", "$.id", "$.nodes[1].id", "$.nodes[2].type", "$.nodes[3].parent", "$.nodes[3].requires[0]",
                   "$.nodes[3].done.bogus", "$.nodes[4].available.node", "$.nodes[4].available.is", "$.edges[0].to", "$.edges[0].kind"]) {
    assert.ok(paths.includes(p), "missing error at " + p + " — got " + paths.join(", "));
  }
  assert.throws(() => J.load(bad), (e) => e.name === "JourneyError" && e.errors.length === v.errors.length);
});

test("a requires loop is refused; a next loop is allowed (a daily round, a rotation)", () => {
  const loop = g({ edges: [{ from: "b1", to: "a1" }] });
  const v = J.validate(loop);
  assert.equal(v.ok, false);
  assert.match(v.errors[0].message, /loop/);
  assert.ok(J.validate(g({ edges: [{ from: "b1", to: "a1", kind: "next" }] })).ok);
});

test("conditions: all, any, not, ops, fact operands, node states, marks", () => {
  const ctx = { facts: { n: 5, s: "abc", list: [1, 2], o: { k: null }, lim: 4 }, marks: { m: 1 }, state: (id) => (id === "q" ? "done" : "locked") };
  const t = (c) => J.evalCond(c, ctx);
  assert.equal(t({ fact: "n", gte: 5, lt: 6 }), true);
  assert.equal(t({ fact: "n", gt: { fact: "lim" } }), true);
  assert.equal(t({ fact: "list.length", eq: 2 }), true);
  assert.equal(t({ fact: "list", contains: 2 }), true);
  assert.equal(t({ fact: "s", in: ["abc", "d"] }), true);
  assert.equal(t({ fact: "o.k", exists: false }), true);
  assert.equal(t({ fact: "missing.deep.path", exists: false }), true);
  assert.equal(t({ fact: "missing", gte: 0 }), false, "an unknown number never passes a comparison");
  assert.equal(t({ all: [{ mark: "m" }, { node: "q", is: ["done", "skipped"] }] }), true);
  assert.equal(t({ any: [{ mark: "nope" }, { not: { node: "q", is: "done" } }] }), false);
});

test("states: start locked except the first open step; facts open the path", () => {
  const L = J.load(g());
  let e = L.evaluate({});
  assert.equal(e.state("a"), "available");
  assert.equal(e.state("a1"), "available");
  assert.equal(e.state("a2"), "locked");
  assert.equal(e.state("b"), "locked");
  assert.equal(e.state("b1"), "locked", "a child of a locked parent is locked");
  assert.equal(e.focus(), "a1");

  e = L.evaluate({ x: 1, y: true });
  assert.equal(e.state("a2"), "done");
  assert.equal(e.state("a"), "done", "the optional step doesn't hold its parent");
  assert.equal(e.state("a3"), "available");
  assert.equal(e.state("b1"), "available");
  assert.equal(e.focus(), "b1", "required work comes before optional work");
  assert.deepEqual(e.frontier(), ["a3", "b1"]);
});

test("records already there count at once (an existing store jumps ahead)", () => {
  const e = J.load(g()).evaluate({ x: 3, y: true, w: 2 });
  assert.equal(e.state("b"), "done");
  assert.equal(e.state("end"), "available");
  assert.equal(e.focus(), "end");
  const strict = J.load(g({ settings: { doneNeedsOpen: true } })).evaluate({ w: 2 });
  assert.equal(strict.state("b1"), "locked", "doneNeedsOpen: nothing counts before it opens");
});

test("blockers say what holds a node back", () => {
  const e = J.load(g()).evaluate({ x: 1 });
  assert.deepEqual(e.blockers("a3"), { nodes: ["a2"], gate: false, parent: null });
  assert.deepEqual(e.blockers("b1"), { nodes: [], gate: false, parent: "b" });
  assert.deepEqual(e.blockers("b"), { nodes: ["a"], gate: false, parent: null });
  const gated = J.load(g({ nodes: g().nodes.map((n) => (n.id === "a1" ? Object.assign({}, n, { available: { mark: "go" } }) : n)) })).evaluate({});
  assert.equal(gated.blockers("a1").gate, true);
});

test("skip: a node that doesn't apply counts as passed for what it gates", () => {
  const nodes = g().nodes.map((n) => (n.id === "b1" ? Object.assign({}, n, { skip: { fact: "noB", truthy: true } }) : n));
  const e = J.load(g({ nodes })).evaluate({ x: 1, y: true, noB: true });
  assert.equal(e.state("b1"), "skipped");
  assert.equal(e.state("b"), "done");
  assert.equal(e.state("end"), "available");
});

test("join any: one source is enough", () => {
  const nodes = g().nodes.concat([{ id: "either", type: "step", requires: ["a1", "b1"], join: "any" }]);
  const e = J.load(g({ nodes })).evaluate({ x: 1 });
  assert.equal(e.state("either"), "available");
});

test("next and prev: gates, next-edges, else siblings", () => {
  const e = J.load(g({ edges: [{ from: "end", to: "a1", kind: "next" }] })).evaluate({});
  assert.deepEqual(e.next("a1"), ["a2"]);
  assert.deepEqual(e.prev("a2"), ["a1"]);
  assert.deepEqual(e.next("a"), ["b"]);
  assert.deepEqual(e.next("end"), ["a1"]);
  assert.deepEqual(e.path("a2"), ["a"]);
  assert.deepEqual(e.progress(), { done: 0, total: 4, ratio: 0 }, "optional leaves don't count");
});

test("step emits what changed — nothing on the first read", () => {
  const L = J.load(g());
  let r = L.step(null, { x: 1 }, 100);
  assert.deepEqual(r.events, [], "loading is not news");
  assert.equal(r.snapshot.cursor, "a2", "the cursor starts on the focus");
  r = L.step(r.snapshot, { x: 1, y: true }, 200);
  const types = r.events.map((e) => e.node + ":" + e.type);
  for (const x of ["a2:node.done", "a:node.done", "a3:node.available", "b:node.available", "b1:node.available"]) assert.ok(types.includes(x), "missing " + x + " in " + types);
  assert.equal(r.snapshot.doneAt.a2, 200);
  r = L.step(r.snapshot, { x: 1, y: false }, 300);
  assert.ok(r.events.some((e) => e.node === "a2" && e.type === "node.reopened"), "undone work reopens");
});

test("sticky: once proven, done stays done", () => {
  const nodes = g().nodes.map((n) => (n.id === "a1" ? Object.assign({}, n, { sticky: true }) : n));
  const L = J.load(g({ nodes }));
  let r = L.step(null, { x: 1 }, 1);
  r = L.step(r.snapshot, { x: 0 }, 2);
  assert.equal(r.ev.state("a1"), "done");
});

test("marks: a leaf with no rule is done when marked; marks gate and skip", () => {
  const L = J.load(g());
  let s = L.step(null, { x: 1, y: true, w: 2 }, 1).snapshot;
  assert.equal(L.evaluate({ x: 1, y: true, w: 2 }, s).state("end"), "available");
  s = L.mark(s, "end", true, 5);
  assert.equal(L.evaluate({ x: 1, y: true, w: 2 }, s).state("end"), "done");
  s = L.mark(s, "end", false);
  assert.equal(L.evaluate({ x: 1, y: true, w: 2 }, s).state("end"), "available");
});

test("goto, back and where: the user's position", () => {
  const L = J.load(g());
  let s = L.step(null, { x: 1 }, 1).snapshot;
  s = L.goto(s, "b1");
  s = L.goto(s, "a3");
  let w = L.where(s, { x: 1 });
  assert.equal(w.at.id, "a3");
  assert.equal(w.at.type, "step");
  assert.equal(w.at.state, "locked");
  assert.deepEqual(w.at.blockers.nodes, ["a2"]);
  assert.equal(w.from.id, "b1");
  assert.deepEqual(w.path.map((x) => x.id), ["a"]);
  assert.equal(w.focus.id, "a2");
  s = L.back(s);
  assert.equal(L.where(s, { x: 1 }).at.id, "b1");
  assert.throws(() => L.goto(s, "ghost"), /names no node/);
});

test("a new graph takes over an old snapshot: marks kept, dead cursor dropped (rotation)", () => {
  const A = J.load(g());
  let s = A.mark(A.goto(A.step(null, {}, 1).snapshot, "b1"), "keep", true, 9);
  const B = J.load({ schema: "fb.journey/1", id: "t2", version: "2", nodes: [{ id: "a1", type: "x", done: { mark: "keep" } }] });
  const r = B.step(s, {}, 10);
  assert.equal(r.snapshot.graph, "t2");
  assert.equal(r.snapshot.marks.keep, 9);
  assert.equal(r.ev.state("a1"), "done");
  assert.equal(B.where(r.snapshot, {}).at.id, "a1", "b1 is gone from this graph, so the cursor falls back");
});

test("payloads and types pass through untouched; nodes() filters on them", () => {
  const nodes = g().nodes.map((n) => (n.id === "b1" ? Object.assign({}, n, { payload: { view: "board", tone: 3 } }) : n));
  const src = g({ nodes });
  const L = J.load(src);
  const e = L.evaluate({});
  assert.deepEqual(e.node("b1").payload, { view: "board", tone: 3 });
  assert.deepEqual(e.nodes({ type: "group" }).map((n) => n.id), ["a", "b"]);
  assert.deepEqual(e.nodes({ payload: { view: "board" } }).map((n) => n.id), ["b1"]);
  src.nodes[0].type = "changed";
  assert.equal(L.evaluate({}).node("a").type, "group", "the engine holds its own copy");
});

test("the cursor follows the focus until the user steps somewhere, and again after follow()", () => {
  const L = J.load(g());
  let s = L.step(null, {}, 1).snapshot;
  assert.equal(s.cursor, "a1");
  s = L.step(s, { x: 1 }, 2).snapshot;
  assert.equal(s.cursor, "a2", "followed the focus");
  s = L.goto(s, "a1");
  s = L.step(s, { x: 1, y: true }, 3).snapshot;
  assert.equal(s.cursor, "a1", "stays where the user put it");
  s = L.step(L.follow(s), { x: 1, y: true }, 4).snapshot;
  assert.equal(s.cursor, "b1");
});

/* Control Tower · Now, the day as one stack of cards (Ek kaam, 16 Oct 2026).
   Run from v10/:  node --test test/control-tower/*.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");
const S = require("../../assets/ct/signals.js");
window.CTSignals = S;
const L = require("../../assets/ct/levers.js");
window.CTLevers = L;
window.FB_DATASET = F.dataset;
const D = require("../../assets/ct/demo.js");
const K = require("../../assets/ct/stack.js");
const J = require("../../assets/journey/engine.js");
const R = require("../../assets/tower/runtime.js");
const GRAPH = require("../../assets/tower/graphs/control-tower.json");

/* The stack's rules come from the tower graph: here every area the graph
   has, as if all were open, so each test can use any of them. */
const MODEL = R.read(J.load(GRAPH).evaluate({}, null));
const RULES = R.stackOpts(Object.assign({}, MODEL, { open: MODEL.areas }));
const RANK = Object.fromEntries(MODEL.areas.map((a) => [a.key, a.rank]));
const opts = (extra) => Object.assign({}, RULES, extra || {});
const TEXT = MODEL.text;

const MORNING = new Date("2026-10-16T05:30:00Z").getTime();      // 11 am in India
function demoStack() {
  const w = F.world({ dataReady: D.dataReady(MORNING), now: MORNING });
  D.ensureDay(w.store, w.tower.pass(), MORNING);
  const v = w.tower.pass();
  const m = L.build(v, { demand: S._detectors.demand(v.state) });
  return { m, st: K.build(m.levers, opts({ money: L.rupees })) };
}
const lv = (id, ugly, bad) => ({ id, label: id, tiles: { ugly: { rows: ugly || [] }, bad: { rows: bad || [] }, good: { rows: [] } } });

test("every area in one stack, Urgent before Needs work, the clock's order inside", () => {
  const { st } = demoStack();
  assert.ok(st.cards.length > 3);
  const tones = st.cards.map((c) => c.tone);
  assert.deepEqual(tones, tones.slice().sort((a, b) => (a === b ? 0 : a === "ugly" ? -1 : 1)), "no Needs work card above an Urgent one");
  const urgent = st.cards.filter((c) => c.tone === "ugly").map((c) => RANK[c.area]);
  assert.deepEqual(urgent, urgent.slice().sort((a, b) => a - b));
});

test("a busy morning is a short stack: alike rows come as one card", () => {
  const { m, st } = demoStack();
  const rows = m.levers.reduce((n, x) => n + x.tiles.ugly.rows.length + x.tiles.bad.rows.length, 0);
  assert.ok(st.cards.length < rows / 3, st.cards.length + " cards for " + rows + " rows");
  const g = st.cards.find((c) => c.kind === "group");
  assert.ok(g && g.rows.length >= 2 && /^See all \d+$/.test(g.action));
  assert.equal(g.items.length, g.rows.length);
});

test("one product, one card: what Buying lists is not also a Stock card", () => {
  const { st } = demoStack();
  const ids = (area) => [].concat(...st.cards.filter((c) => c.area === area).map((c) => c.rows.map((r) => r.id)));
  const buy = ids("purchase");
  assert.ok(buy.length);
  assert.ok(ids("inventory").every((id) => !buy.includes(id)));
});

test("the same customer with two problems is two cards", () => {
  const st = K.build([lv("collections", [{ id: "c1", kind: "customer", title: "Gupta Mart", value: 12400, next: "Call to collect" }]),
                      lv("order", [{ id: "c1", kind: "customer", title: "Gupta Mart", next: "Call to find out why" }])], opts());
  assert.equal(st.cards.length, 2);
});

test("the strip counts each area in the clock's order", () => {
  const { st } = demoStack();
  assert.deepEqual(st.areas.map((a) => a.id), st.areas.map((a) => a.id).slice().sort((a, b) => RANK[a] - RANK[b]));
  for (const a of st.areas) {
    const n = st.cards.filter((c) => c.area === a.id).reduce((s, c) => s + c.rows.length, 0);
    assert.equal(a.count, n, a.id);
    assert.equal(a.tone === "good", n === 0, a.id);
  }
});

test("money is the tower's own: crores, not a long figure", () => {
  const st = K.build([lv("collections", [{ id: "a", kind: "customer", title: "A", value: 2e8, next: "Call to collect" }, { id: "b", kind: "customer", title: "B", value: 1e8, next: "Call to collect" }])],
    opts({ money: L.rupees }));
  assert.match(st.cards[0].title, /₹30 Cr/);
});

test("waiting leaves the stack; fixed and on-track rows are no card", () => {
  const st = K.build([lv("deliveries", [
    { id: "s1", kind: "delivery", title: "Sharma Stores", tag: { type: "shop-closed", label: "Shop closed", tone: "ugly", state: "acting" } },
    { id: "s2", kind: "delivery", title: "Gupta Mart", tag: { type: "shop-closed", label: "✓ Shop closed", tone: "good", state: "resolved" } },
    { id: "s3", kind: "delivery", title: "New Bharat", tag: { type: "refused", label: "Refused", tone: "ugly", state: "open" }, next: "Call the shop" },
  ], [{ id: "s4", kind: "delivery", title: "Dimpa", stand: "pending", next: "Nothing to do yet" }])], opts());
  assert.deepEqual(st.cards.map((c) => c.title), ["New Bharat"]);
  assert.deepEqual(st.waiting.map((w) => w.row.title), ["Sharma Stores"]);
  assert.equal(st.total, 1);
});

test("day one: a setup row is the stack's card, and products group by the page's problem", () => {
  const st = K.build([
    lv("products", [{ id: "p1", kind: "jproduct", title: "Cola", tag: { type: "noUnit", label: "No unit", tone: "ugly" } },
                    { id: "p2", kind: "jproduct", title: "Soda", tag: { type: "noUnit", label: "No unit", tone: "ugly" } }]),
    lv("customers", [{ title: "No customers yet", jstep: "customers.added", now: true, next: "Add customers", tag: { type: "setup", label: "Not set up", tone: "ugly" } }]),
  ], opts());
  assert.deepEqual(st.cards.map((c) => c.title), ["2 products are hidden from customers", "No customers yet"]);
  assert.equal(st.cards[1].action, "Add customers");
  assert.deepEqual(st.areas.map((a) => a.label), ["Products", "Customers"], "each area's word comes from the graph");
});

test("Production: order rows group by tab, the floor's alerts by alert", () => {
  const P = (r) => Object.assign({ kind: "production", tab: "or", tabLabel: "Orders" }, r);
  const st = K.build([lv("production", [P({ id: "prod:or:0", tone: "ugly", title: "Peas 1KG" }), P({ id: "prod:or:1", tone: "ugly", title: "Peas 2KG" })],
    [P({ id: "prod:fg:0", tab: "fg", tone: "bad", title: "Soya · B-1", alert: "qc-hold" }), P({ id: "prod:fg:1", tab: "fg", tone: "bad", title: "Soya · B-2", alert: "qc-hold" })])], opts());
  assert.deepEqual(st.cards.map((c) => c.title), ["2 products short for orders", "2 batches need you on the floor"]);
});

test("pure: the same levers give the same stack", () => {
  const a = demoStack().st, b = demoStack().st;
  assert.deepEqual(a.cards.map((c) => c.key), b.cards.map((c) => c.key));
});

test("the card's words: names as people write them, no codes, no figure twice", () => {
  assert.equal(K.nice("MAA KAMAKHYA RETAILS", TEXT), "Maa Kamakhya Retails");
  assert.equal(K.nice("KING CHILLI PICKLE (100 gm) (OLD MRP 100), NEW MRP 95", TEXT), "King Chilli Pickle (100 gm)");
  assert.equal(K.nice("SBI EMPLOYEES CONSUMER", TEXT), "SBI Employees Consumer");
  assert.equal(K.nice("Patiala Frozen Foods", TEXT), "Patiala Frozen Foods", "a name already written stays");
  const money = (n) => "₹" + n.toLocaleString("en-IN");
  assert.deepEqual(K.facts("1:00 pm · Van 2 · PB-11-BZ-7735 · ₹2,290", 2290, money, null, TEXT), ["1:00 pm", "Van 2"]);
  assert.deepEqual(K.facts("Delivered · ST-261015-04 · DL-0004", 0, money, null, TEXT), ["Delivered"]);
  assert.equal(K.nice("Van 1 · PB-11-CX-4412", TEXT), "Van 1");
});

test("every card says what happened once: a kicker, unless its line already says it", () => {
  const { st } = demoStack();
  for (const c of st.cards) {
    if (c.kicker) assert.ok(!c.title.toLowerCase().includes(c.kicker.toLowerCase()), c.title);
    assert.ok(!/[A-Z]{2}-\d{2}-[A-Z]{1,3}-\d{3,4}/.test((c.facts || []).join(" ")), "no vehicle numbers: " + c.facts);
    assert.ok(c.title === c.title.trim() && !/OLD MRP/i.test(c.title), c.title);
  }
});

test("a product moving to its next hidden problem stays the same card", () => {
  const P = (id, type, label) => ({ id, kind: "jproduct", title: id, tag: { type, label, tone: "ugly" } });
  const before = K.build([lv("products", [P("a", "noUnit", "No unit"), P("b", "noUnit", "No unit")])], opts());
  const after = K.build([lv("products", [P("a", "noCategory", "No category"), P("b", "noUnit", "No unit")])], opts());
  assert.equal(after.cards.length, before.cards.length);
  assert.equal(after.cards[0].key, before.cards[0].key);
  assert.deepEqual(after.cards[0].list.map((x) => x.what), ["No category", "No unit"], "each thing says its own problem");
});

/* The stack and the runtime know no business: every word with meaning is
   in the graph. The same check as the engine's (test/journey/engine.test.js). */
test("zero context: the stack and the runtime name no area and no business", () => {
  const fs = require("node:fs"), path = require("node:path");
  const WORDS = /\b(deliver\w*|collection\w*|product\w*|customer\w*|orders?|stock|invoice\w*|purchase\w*|production|inventory|supplier\w*|shop\w*|van|rupee\w*|MRP|GST|HSN|lever\w*)\b|₹/i;
  for (const f of ["../../assets/ct/stack.js", "../../assets/tower/runtime.js"]) {
    const src = fs.readFileSync(path.join(__dirname, f), "utf8");
    const hit = src.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => WORDS.test(l));
    assert.deepEqual(hit, [], f + " names: " + hit.map(([i, l]) => i + ": " + l.trim()).join(" | "));
  }
});

test("the graph is the tower: change a word in it and the stack says the new word", () => {
  const g = JSON.parse(JSON.stringify(GRAPH));
  g.nodes.find((n) => n.payload && n.payload.area === "collections").payload.word = "Money in";
  const m = R.read(J.load(g).evaluate({}, null));
  const st = K.build([lv("collections", [{ id: "a", kind: "customer", title: "A", value: 5, next: "Call to collect" }])], R.stackOpts(Object.assign({}, m, { open: m.areas })));
  assert.equal(st.areas[0].label, "Money in");
  assert.equal(st.cards[0].areaName, "Money in");
});

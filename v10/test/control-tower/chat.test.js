/* Control Tower · the assistant's answers. Run from v7/:
     node --test test/control-tower/*.test.js
   Owner, 22 Sep 2026: a floating assistant over the tower, a chat that looks
   and works like a WhatsApp Business bot. It answers from the records the
   levers show, and never changes anything itself. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");
const S = require("../../assets/ct/signals.js");
window.CTSignals = S;
const L = require("../../assets/ct/levers.js");
window.CTLevers = L;
window.FB_DATASET = F.dataset;
const D = require("../../assets/ct/demo.js");
const TL = require("../../assets/ct/timeline.js");
const C = require("../../assets/ct/chat.js");

const at = (hIST) => Date.UTC(2026, 8, 22) + (hIST - 5.5) * 3600e3;
function ctx(h) {
  const now = at(h || 15);
  const w = F.world({ dataReady: D.dataReady(now), now });
  D.ensureDay(w.store, w.tower.pass(), now);
  const v = w.tower.pass();
  const model = L.build(v, { demand: S._detectors.demand(v.state) });
  return { model, timeline: TL.build(v, model, { now }) };
}
const lever = (c, id) => c.model.levers.find((x) => x.id === id);
const btns = (msgs) => msgs.flatMap((m) => m.buttons || []);

test("it understands the owner's words: English, the trade's Hinglish, and menu numbers", () => {
  const cases = {
    "what needs me today?": "needs", "aaj kya karna hai": "needs",
    "who owes me money": "collections", "kitna paisa baaki hai": "collections", "udhaar list": "collections",
    "what should I buy": "purchase", "raise a purchase order": "purchase",
    "maal khatam": "inventory", "dead stock": "inventory",
    "which van is late": "deliveries", "gaadi kab aayegi": "deliveries",
    "customers late to reorder": "order", "show orders": "order",
    "what happened today": "news", "aaj kya hua": "news",
    "hi": "greet", "Namaste": "greet", "thanks": "thanks", "menu": "menu",
    "1": "needs", "3": "collections", "7": "news", "0": "menu",
  };
  for (const [q, want] of Object.entries(cases)) assert.equal(C.understand(q), want, q);
  assert.equal(C.understand("9"), null, "no such menu item");
  assert.equal(C.understand("asdf qwerty"), null);
  assert.equal(C.understand("hello, who owes me the most?"), "collections", "a greeting with a question is the question");
});

test("the menu is WhatsApp's: numbered lines, and a list sheet with the same seven rows", () => {
  const [m] = C.reply({ intent: "menu" }, ctx());
  assert.ok(m.list && m.list.button === "Menu" && m.list.rows.length === 7);
  m.list.rows.forEach((r, i) => assert.ok(m.text.includes(r.n + "  " + r.label), "line " + (i + 1)));
  assert.deepEqual(m.list.rows.map((r) => r.n), [1, 2, 3, 4, 5, 6, 7]);
});

test("a lever's answer is the lever's own numbers: its status, headline and top items", () => {
  const c = ctx();
  for (const id of ["deliveries", "collections", "purchase", "inventory", "order"]) {
    const lv = lever(c, id);
    const out = C.reply({ intent: id }, c);
    const text = out.map((m) => m.text || "").join("\n");
    assert.ok(text.includes("*" + lv.label + " · "), id + " names itself");
    assert.ok(text.includes(lv.headline.value), id + " says its headline");
    const b = btns(out);
    assert.ok(b.length <= 3, "at most three reply buttons");
    assert.ok(b.some((x) => x.id.startsWith("open:" + id)), id + " can be opened");
  }
});

test("the prepared action is offered only where the lever has one, and only on a problem", () => {
  const c = ctx();
  for (const lv of c.model.levers) {
    const b = btns(C.reply({ intent: lv.id }, c));
    const act = b.find((x) => x.id === "act:" + lv.id);
    const k = { good: "good", bad: "bad", ugly: "ugly" }[lv.status];
    const onGood = k === "good" && lv.tiles.good.count;
    if (lv.action && !onGood) assert.equal(act && act.label, lv.action.label, lv.id + ": the lever's own words");
    if (!lv.action) assert.ok(!act, lv.id + ": nothing to act on");
  }
});

test("what needs me: every lever once, worst first, and where to start", () => {
  const c = ctx();
  const [m] = C.reply({ intent: "needs" }, c);
  const lines = m.text.split("\n").filter((l) => /^[🔴🟠🟢⚪]/u.test(l));
  assert.equal(lines.length, 5);
  const rank = { "🔴": 0, "🟠": 1, "🟢": 2, "⚪": 3 };
  const r = lines.map((l) => rank[[...l][0]]);
  assert.deepEqual(r, r.slice().sort((a, b) => a - b), "worst first");
  const worst = c.model.levers.filter((x) => x.status === "ugly")[0];
  if (worst) assert.ok(m.text.includes("Start with *" + worst.label + "*"));
  assert.ok(!/Deliveries\* — \d+ problems/.test(m.text), "Deliveries by its headline, not a count of problems");
});

test("today's news comes from the Business Timeline, newest first", () => {
  const c = ctx(16);
  const [m] = C.reply({ intent: "news" }, c);
  const first = c.timeline.days[0].items[0];
  assert.ok(m.text.includes(first.text), "the newest line leads");
  assert.ok(btns([m]).some((b) => b.id === "open:timeline"));
});

test("it never pretends: an unclear message gets the menu, not a guess", () => {
  const out = C.reply({ text: "asdf qwerty" }, ctx());
  assert.equal(out[0].kind, "sticker");
  assert.ok(out[1].list, "the menu to choose from");
  assert.match(out[1].text, /didn't get that/);
});

test("the welcome: the assistant introduces itself, then the menu with two quick replies", () => {
  const w = C.welcome();
  assert.equal(w[0].kind, "image");
  assert.match(w[0].text, /FoodBridge Assistant/);
  assert.ok(w[1].list);
  assert.deepEqual(w[1].buttons.map((b) => b.id), ["intent:needs", "intent:news"]);
});

test("every button is one the chat knows how to follow", () => {
  const c = ctx();
  const ids = ["menu", "needs", "news", "deliveries", "collections", "purchase", "inventory", "order", "greet", "thanks"]
    .flatMap((i) => btns(C.reply({ intent: i }, c))).map((b) => b.id);
  assert.ok(ids.length);
  assert.ok(ids.every((id) => /^(menu|intent:(needs|news|deliveries|collections|purchase|inventory|order)|open:(timeline|(deliveries|collections|purchase|inventory|order)(:(good|bad|ugly))?)|act:(deliveries|collections|purchase|inventory|order))$/.test(id)), ids.join(" "));
});

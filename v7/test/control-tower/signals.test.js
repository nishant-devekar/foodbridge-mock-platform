/* Control Tower · signal engine, headless. Run from v7/:
     node --test test/control-tower/
   Real records throughout: the tenant's own export, and onboarding's own
   sample import for the money path. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");
const S = F.CTSignals;

const byId = (list) => Object.fromEntries(list.map((s) => [s.id, s]));
const clone = (x) => JSON.parse(JSON.stringify(x));

test("the tenant export yields its signals, each with a reason, an impact and rows", () => {
  const d = S.detect(F.state());
  assert.deepEqual(d.errors, []);
  const ids = d.signals.map((s) => s.id);
  assert.ok(ids.includes("stockout") && ids.includes("reorder-due"), "stock and cadence are what this evidence supports");
  for (const s of d.signals) {
    assert.ok(s.title && s.summary, s.id + " says what happened");
    assert.ok(Array.isArray(s.why) && s.why.length, s.id + " says why");
    assert.ok(s.impact && s.impact.calc, s.id + " says how its impact is worked out");
    assert.ok(s.rows.length, s.id + " names the rows it rests on");
    assert.ok(s.priority.reasons.length, s.id + " explains its rank");
    assert.ok(["critical", "high", "medium", "opportunity"].includes(s.severity));
  }
});

test("no money signal and no ₹0 without invoices (D-015)", () => {
  const st = F.state();
  const d = S.detect(st);
  assert.equal(byId(d.signals).overdue, undefined, "no invoices, no overdue signal");
  const cash = S.pulse(st, d).find((p) => p.id === "cash");
  assert.equal(cash.available, false);
  assert.equal(cash.value, null, "absent is null, never ₹0");
  const un = S.unavailable(st).map((u) => u.id);
  assert.deepEqual(un.sort(), ["cash", "delivery", "expiry", "supplier-delay"]);
  for (const s of d.signals) {
    if (s.impact.value !== null) assert.ok(s.impact.value > 0, s.id + ": a figure shown is a real, positive figure");
    assert.doesNotMatch(s.impact.description, /₹0\b/);
  }
});

test("with the sample ledger, overdue money appears, labelled sample, and is the sum of real balances", () => {
  const st = F.state({ dataReady: F.sampleDataReady() });
  assert.equal(st.source.sample, true);
  const d = S.detect(st);
  const od = byId(d.signals).overdue;
  assert.ok(od, "invoices past due with balances → a signal");
  const late = st.ledger.invoices.filter((i) => i.balance > 0 && new Date(i.dueDate + "T00:00:00Z").getTime() < st.now);
  assert.equal(od.impact.value, Math.round(late.reduce((n, i) => n + i.balance, 0)));
  assert.equal(od.affected.customers, new Set(late.map((i) => i.customerId)).size);
  assert.equal(S.freshness(st).headline, "Sample data", "sample data is never called up to date");
});

test("an impact with no price says so rather than inventing one", () => {
  const seed = clone(F.SEED);
  seed.products.forEach((p) => { p.name = p.name.replace(/MRP\s*[0-9.]+/gi, ""); });
  const d = S.detect(F.state({ seed }));
  const so = byId(d.signals).stockout;
  assert.equal(so.impact.value, null);
  assert.equal(so.impact.description, "Impact not yet quantified");
});

test("stockout: a product that sells and drops below two weeks of stock is detected; severity follows demand", () => {
  const seed = clone(F.SEED);
  const before = byId(S.detect(F.state({ seed })).signals).stockout;
  const st = F.state({ seed });
  const dem = S._detectors.demand(st).filter((x) => x.available > 0 && x.daily > 0 && x.cover >= 14)
    .sort((a, b) => b.buyers.length - a.buyers.length)[0];
  assert.ok(dem, "a well-stocked selling product exists");
  const p = seed.products.find((x) => x.id === dem.product.id);
  p.systemStock = 0;                                           // the inventory event
  const after = byId(S.detect(F.state({ seed })).signals).stockout;
  assert.ok(after.members.includes(p.id), "the product joins the signal");
  assert.equal(after.members.length, before.members.length + 1);
  assert.notEqual(after.fingerprint, before.fingerprint, "membership change changes the fingerprint");
  const row = after.rows.find((r) => r.id === p.id);
  assert.equal(row.cells[0], "Out of stock");
  if (dem.buyers.length >= 3) assert.equal(after.severity, "critical", "out of stock with 3+ buyers is critical");
});

test("missing stock counts are not treated as healthy stock", () => {
  const seed = clone(F.SEED);
  seed.products.forEach((p) => { delete p.systemStock; });
  const st = F.state({ seed });
  const d = S.detect(st);
  assert.equal(byId(d.signals).stockout, undefined, "no counts, no stockout claim");
  const stock = S.pulse(st, d).find((p) => p.id === "stock");
  assert.equal(stock.available, false);
  assert.equal(stock.value, null, "not 100% healthy — unknown");
});

test("signals are grouped and deduplicated: one per kind, stable id and fingerprint across passes", () => {
  const a = S.detect(F.state()).signals, b = S.detect(F.state()).signals;
  assert.equal(new Set(a.map((s) => s.id)).size, a.length, "one signal per kind");
  assert.deepEqual(a.map((s) => s.id + ":" + s.fingerprint), b.map((s) => s.id + ":" + s.fingerprint));
});

test("ranking is severity first, then explained parts — never an unexplained score", () => {
  const d = S.detect(F.state({ dataReady: F.sampleDataReady() }));
  const scores = d.signals.map((s) => s.priority.score);
  assert.deepEqual(scores, scores.slice().sort((x, y) => y - x), "sorted by score");
  for (const s of d.signals) {
    const p = s.priority.parts;
    assert.equal(s.priority.score, p.severity + p.impact + p.urgency + p.customers + p.confidence, "the score is the sum of its named parts");
    assert.equal(p.severity, S.SEVERITY[s.severity]);
  }
  const sev = d.signals.map((s) => S.SEVERITY[s.severity]);
  for (let i = 1; i < sev.length; i++) assert.ok(sev[i - 1] >= sev[i] || d.signals[i - 1].priority.score >= d.signals[i].priority.score);
  assert.ok(d.signals.findIndex((s) => s.severity === "opportunity") > d.signals.findIndex((s) => s.severity === "critical"));
});

test("stale records are flagged, not presented as live", () => {
  const f = S.freshness(F.state());
  assert.equal(f.delayed, true);
  assert.equal(f.headline, "Data delayed");
  assert.equal(f.age, 25, "imported 27 Aug, read 21 Sep");
  assert.ok(f.sources.find((s) => s.id === "delivery").state === "unavailable");
});

test("windows anchor on the last record, not on today", () => {
  const st = F.state();
  assert.equal(st.dataEnd, "2026-08-24");
  const sales = S.pulse(st, S.detect(st)).find((p) => p.id === "sales");
  assert.ok(sales.available && sales.value !== "₹0", "an import gap does not read as zero sales");
  assert.match(sales.period, /to 24 Aug/);
});

test("a detector that throws is reported, and the rest still run", () => {
  const broken = F.state();
  broken.missed = null;                // the cadence input is gone
  broken.cadence = null;
  const d2 = S.detect(broken);
  assert.ok(d2.errors.length >= 1, "the failure is visible");
  assert.ok(d2.signals.some((s) => s.id === "stockout"), "the stock signal still stands");
});

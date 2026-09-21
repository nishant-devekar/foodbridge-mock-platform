/* Control Tower · the loop, headless: event → signal → recommendation →
   action → outcome → signal re-evaluated. Run from v7/:
     node --test test/control-tower/
   Each scenario is the requirements' §42.3 scenario, on real records. */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");

const clone = (x) => JSON.parse(JSON.stringify(x));
const sig = (v, id) => v.signals.find((s) => s.id === id) || null;
const MIN = 60000, DAY = 86400000;

/* ── Scenario 1 · Stockout ─────────────────────────────────────────────── */
test("stockout: inventory drops → signal → purchase request prepared → confirmed → PR created → signal to monitoring", () => {
  const seed = clone(F.SEED);
  const w = F.world({ seed });
  const before = sig(w.tower.pass(), "stockout");
  assert.ok(before, "stock risk exists on the real records");

  /* The inventory event: a selling product runs down to 1. */
  const st = w.tower.last().state;
  const selling = F.CTSignals._detectors.demand(st).filter((d) => d.cover >= 14 && d.daily > 0).sort((a, b) => b.daily - a.daily)[0];
  seed.products.find((p) => p.id === selling.product.id).systemStock = 1;
  const s1 = sig(w.tower.pass(), "stockout");
  assert.ok(s1.members.includes(selling.product.id), "the product is now at risk");
  assert.equal(s1.status, "new");

  /* Recommendation → preview. */
  const pv = w.tower.actions.prepare("stockout");
  assert.equal(pv.ok, true);
  assert.equal(pv.cls, "C");
  assert.equal(pv.needsConfirmation, true);
  const line = pv.lines.find((l) => l.productId === selling.product.id);
  assert.ok(line.qty >= Math.ceil(selling.daily * 37) - 1, "30 days of demand plus a week's safety, less stock");

  /* Not confirmed → refused, and the refusal is audited. */
  assert.throws(() => w.tower.actions.execute(pv, { confirmed: false }), { name: "AuthorizationError" });
  assert.equal(w.store.read().purchaseRequests.length, 0, "nothing was created");
  assert.ok(w.store.read().audit.some((a) => a.outcome && a.outcome.startsWith("Refused")));

  /* Confirmed → created. */
  const r = w.tower.actions.execute(pv, { confirmed: true });
  assert.equal(r.ok, true, r.error && r.error.message);
  const pr = w.store.read().purchaseRequests;
  assert.equal(pr.length, 1);
  assert.equal(pr[0].no, "PR-0001");
  assert.equal(pr[0].lines.length, pv.lines.length);

  /* Outcome → signal updated: every short product is on order. */
  const after = sig(w.tower.pass(), "stockout");
  assert.equal(after.phase, "monitoring");
  assert.equal(after.status, "in_progress");
  assert.equal(after.recommendation, null, "nothing left to do until stock arrives");
  assert.match(after.title, /on order/);
  const audit = w.store.read().audit.filter((a) => a.signalId === "stockout");
  const act = audit.find((a) => a.action === "create_purchase_request" && a.kind === "action" && a.ref);
  assert.ok(act, "the action is audited");
  assert.equal(act.actor, "owner");
  assert.equal(act.aiAssisted, false);
  assert.equal(act.approval, "confirmed by the owner");
  assert.equal(act.ref, "PR-0001");
  assert.ok(act.before && act.after && act.at && act.reason && act.outcome);
});

/* ── Scenario · Customers past their cycle ─────────────────────────────── */
test("reorder: orders prepared from suggestions → confirmed → written to fb.v7.orders → those shops leave the signal", () => {
  const w = F.world();
  const s0 = sig(w.tower.pass(), "reorder-due");
  const pv = w.tower.actions.prepare("reorder-due");
  assert.equal(pv.actionType, "create_orders");
  const pick = pv.shops.slice(0, 3);
  pv.shops.forEach((s, i) => { s.include = i < 3; });
  pick[0].lines[0].qty = pick[0].lines[0].suggestedQty + 2;       // the owner edits a line
  const r = w.tower.actions.execute(pv, { confirmed: true });
  assert.equal(r.ok, true, r.error && r.error.message);

  const orders = w.store.read().orders;
  assert.equal(orders.length, 3);
  assert.deepEqual(Object.keys(orders[0]).sort(),
    ["amount", "business", "customer", "customerId", "date", "items", "lines", "no", "source"].sort(),
    "the record shape onboarding's createOrder() writes, plus its source");
  assert.equal(orders[0].lines[0].qty, pick[0].lines[0].suggestedQty + 2, "the owner's edit is what was created");

  const s1 = sig(w.tower.pass(), "reorder-due");
  for (const p of pick) assert.ok(!s1.members.includes(p.customerId), p.name + " is back on cycle");
  assert.equal(s1.members.length, s0.members.length - 3);
});

test("reorder: once every suggested shop has an order, what's left is a call list for the quiet ones", () => {
  const w = F.world();
  w.tower.pass();
  const pv = w.tower.actions.prepare("reorder-due");
  assert.equal(w.tower.actions.execute(pv, { confirmed: true }).ok, true);
  const s = sig(w.tower.pass(), "reorder-due");
  if (s) {
    assert.equal(s.recommendation.actionType, "create_followup", "no suggestion left — call them");
    assert.ok(s.rows.every((r) => r.note === "No recent history — call"));
  }
});

/* ── Scenario 3 · Payment overdue ──────────────────────────────────────── */
test("overdue: ledger → customers aggregated → reminders prepared → approved → queued → audited → monitoring", () => {
  const w = F.world({ dataReady: F.sampleDataReady() });
  const s0 = sig(w.tower.pass(), "overdue");
  assert.ok(s0);
  const pv = w.tower.actions.prepare("overdue");
  assert.equal(pv.actionType, "send_reminders");
  assert.ok(pv.messages.length >= 1 && pv.messages.length <= 5);
  for (const m of pv.messages) {
    assert.match(m.body, /₹[\d,]+ is due on/);
    assert.match(m.body, /Test Traders/);
  }
  const r = w.tower.actions.execute(pv, { confirmed: true });
  assert.equal(r.ok, true);
  const out = w.store.read().outbox;
  assert.equal(out.length, pv.messages.length);
  assert.ok(out.every((m) => m.status === "queued"), "no sender connected: queued, and said so");
  const s1 = sig(w.tower.pass(), "overdue");
  assert.equal(s1.phase, "monitoring");
  assert.equal(s1.status, "in_progress");
  assert.ok(s1.rows.filter((r) => r.note && r.note.startsWith("Reminded")).length === pv.messages.length);
  assert.ok(w.store.read().audit.some((a) => a.action === "send_reminders" && a.approval === "confirmed by the owner"));

  /* A week later the reminders are stale: it needs the owner again. */
  w.clock.advance(8 * DAY);
  const s2 = sig(w.tower.pass(), "overdue");
  assert.ok(s2.recommendation, "time to remind again");
});

/* ── Order risk, from an order made in FoodBridge ──────────────────────── */
test("order risk: an order for stock you don't have → critical → the shortfall ordered → monitoring", () => {
  const w = F.world();
  const st = w.tower.pass().state;
  const out = st.products.find((p) => p.stock === 0);
  const cust = st.customers[0];
  w.store.addOrders([{ customerId: cust.id, customer: cust.name, amount: null,
                       lines: [{ productId: out.id, name: out.name, qty: 4, price: out.mrp, unit: out.unit }] }], "Test Traders");
  const s = sig(w.tower.pass(), "order-risk");
  assert.ok(s, "the new order is at risk");
  assert.equal(s.severity, "critical");
  assert.ok(w.tower.last().signals.slice(0, 2).some((x) => x.id === "order-risk"), "critical: in the top two, ranked by its named parts");
  const pv = w.tower.actions.prepare("order-risk");
  assert.deepEqual(pv.lines.map((l) => [l.productId, l.qty]), [[out.id, 4]], "exactly the shortfall");
  assert.equal(w.tower.actions.execute(pv, { confirmed: true }).ok, true);
  const s2 = sig(w.tower.pass(), "order-risk");
  assert.equal(s2.phase, "monitoring");
});

/* ── Lifecycle ─────────────────────────────────────────────────────────── */
test("lifecycle: detected → acknowledged → dismissed (with reason) → hidden; reopens only on escalation or new members", () => {
  const seed = clone(F.SEED);
  const w = F.world({ seed });
  let v = w.tower.pass();
  const s = sig(v, "slow-stock");
  w.store.acknowledge("slow-stock");
  assert.equal(sig(w.tower.pass(), "slow-stock").status, "acknowledged");
  w.store.dismiss("slow-stock", "Already handled", "sold to a wholesaler", s);
  v = w.tower.pass();
  assert.equal(sig(v, "slow-stock"), null, "dismissed signals leave Needs Attention");
  assert.ok(v.dismissed.find((d) => d.id === "slow-stock").dismissReason === "Already handled");
  const d = w.store.read().audit.find((a) => a.action === "dismissed");
  assert.equal(d.reason, "Already handled", "dismissal is recorded as feedback");

  /* Same members → stays dismissed. */
  assert.equal(sig(w.tower.pass(), "slow-stock"), null);

  /* A new product stops selling → the signal comes back. */
  const st = w.tower.last().state;
  const selling = F.CTSignals._detectors.demand(st).find((x) => x.available > 0 && x.units90 > 0);
  const hist = clone(F.HISTORY);
  Object.values(hist).forEach((h) => h.orders.forEach((o) => { o.lines = o.lines.filter((l) => l.productId !== selling.product.id); }));
  const w2 = F.world({ seed, history: hist, storage: w.storage });
  const back = sig(w2.tower.pass(), "slow-stock");
  assert.ok(back, "new members reopen a dismissed signal");
  assert.equal(back.status, "new");
});

test("lifecycle: a dismissed signal that becomes critical is shown again", () => {
  const seed = clone(F.SEED);
  seed.products.forEach((p) => { if (p.systemStock === 0) p.systemStock = 3; });   // nothing out: not critical
  const w = F.world({ seed });
  const s = sig(w.tower.pass(), "stockout");
  assert.notEqual(s.severity, "critical");
  w.store.dismiss("stockout", "Not relevant", null, s);
  assert.equal(sig(w.tower.pass(), "stockout"), null);
  const st = w.tower.last().state;
  const hot = F.CTSignals._detectors.demand(st).filter((d) => d.buyers.length >= 3).sort((a, b) => b.daily - a.daily)[0];
  seed.products.find((p) => p.id === hot.product.id).systemStock = 0;
  const s2 = sig(w.tower.pass(), "stockout");
  assert.ok(s2 && s2.severity === "critical", "a critical risk is never silenced by an earlier dismissal");
  assert.ok(w.store.read().audit.some((a) => a.action === "reopened"));
});

test("lifecycle: what the engine stops finding is resolved, and a return is recorded as recurred", () => {
  const seed = clone(F.SEED);
  const w = F.world({ seed });
  assert.ok(sig(w.tower.pass(), "stockout"));
  const low = seed.products.filter((p) => typeof p.systemStock === "number");
  low.forEach((p) => { p.systemStock = 100000; });                 // stock arrives
  let v = w.tower.pass();
  assert.equal(sig(v, "stockout"), null);
  assert.ok(v.resolved.find((r) => r.id === "stockout"), "resolved, with the outcome observed");
  assert.ok(w.store.read().audit.some((a) => a.signalId === "stockout" && a.action === "resolved"));
  low.forEach((p) => { p.systemStock = 0; });
  v = w.tower.pass();
  assert.equal(sig(v, "stockout").status, "new");
  assert.ok(w.store.read().audit.some((a) => a.signalId === "stockout" && a.action === "recurred"));
});

test("duplicate events are idempotent: repeated passes add no signals and no audit noise", () => {
  const w = F.world();
  w.tower.pass();
  const n = w.store.read().audit.length;
  for (let i = 0; i < 5; i++) w.tower.pass();
  assert.equal(w.store.read().audit.length, n);
  assert.equal(new Set(w.tower.last().signals.map((s) => s.id)).size, w.tower.last().signals.length);
});

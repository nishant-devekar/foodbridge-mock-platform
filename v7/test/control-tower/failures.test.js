/* Control Tower · failure paths (requirements §42.4). Run from v7/:
     node --test test/control-tower/*.test.js */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const F = require("./fixture.js");

const sig = (v, id) => v.signals.find((s) => s.id === id) || null;

test("action API failure: a store that cannot write → visible failure, nothing changed, failure audited", () => {
  const storage = F.CTStore.memory();
  const w = F.world({ storage });
  w.tower.pass();
  const pv = w.tower.actions.prepare("stockout");
  const realSet = storage.setItem;
  storage.setItem = (k, v) => { if (k === "fb.v7.ct.purchaseRequests") throw Object.assign(new Error("full"), { name: "QuotaExceededError" }); return realSet(k, v); };
  const r = w.tower.actions.execute(pv, { confirmed: true });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "storage");
  assert.match(r.error.message, /Nothing was changed\.$/, "the owner is told nothing changed");
  assert.equal(w.store.read().purchaseRequests.length, 0);
  assert.notEqual(sig(w.tower.pass(), "stockout").status, "in_progress", "the signal did not move");
  assert.ok(w.store.read().audit.some((a) => a.outcome && a.outcome.startsWith("Failed")));
});

test("partial action: orders for several shops are all-or-nothing — one write", () => {
  const storage = F.CTStore.memory();
  const w = F.world({ storage });
  w.tower.pass();
  const pv = w.tower.actions.prepare("reorder-due");
  const realSet = storage.setItem;
  storage.setItem = (k, v) => { if (k === "fb.v7.orders") throw new Error("blocked"); return realSet(k, v); };
  const r = w.tower.actions.execute(pv, { confirmed: true });
  assert.equal(r.ok, false);
  assert.equal(w.store.read().orders.length, 0, "no half-created batch");
});

test("an action on a signal that has since gone is refused as stale", () => {
  const seed = JSON.parse(JSON.stringify(F.SEED));
  const w = F.world({ seed });
  w.tower.pass();
  const pv = w.tower.actions.prepare("stockout");
  seed.products.forEach((p) => { if (typeof p.systemStock === "number") p.systemStock = 100000; });   // stock arrived meanwhile
  const r = w.tower.actions.execute(pv, { confirmed: true });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "stale");
  assert.equal(w.store.read().purchaseRequests.length, 0);
});

test("the assistant cannot bypass confirmation, even when it says 'confirmed'", () => {
  const w = F.world();
  w.tower.pass();
  const pv = w.tower.actions.prepare("stockout");
  assert.throws(() => w.tower.actions.execute(pv, { confirmed: true, actor: "assistant" }), { name: "AuthorizationError" });
  assert.equal(w.store.read().purchaseRequests.length, 0);
  const ref = w.store.read().audit.find((a) => a.actor === "assistant");
  assert.ok(ref && ref.aiAssisted === true && /Refused/.test(ref.outcome), "the attempt is audited as AI");
});

test("an AI-assisted action confirmed by the owner is marked AI-assisted in the audit", () => {
  const w = F.world();
  w.tower.pass();
  const pv = w.tower.actions.prepare("stockout");
  const r = w.tower.actions.execute(pv, { confirmed: true, actor: "owner", aiAssisted: true });
  assert.equal(r.ok, true);
  const a = w.store.read().audit.find((x) => x.action === "create_purchase_request" && x.ref);
  assert.equal(a.aiAssisted, true);
  assert.equal(a.actor, "owner");
  assert.equal(w.store.read().purchaseRequests[0].aiAssisted, true);
});

test("an empty preview (every quantity zeroed) does nothing and says so", () => {
  const w = F.world();
  w.tower.pass();
  const pv = w.tower.actions.prepare("stockout");
  pv.lines.forEach((l) => { l.qty = 0; });
  const r = w.tower.actions.execute(pv, { confirmed: true });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "empty");
});

test("AI unavailable: the assistant says so, and the tower still works", () => {
  const w = F.world();
  const v = w.tower.pass();
  const broken = F.CTAssistant.create({ getContext: () => { throw new Error("model down"); } });
  const a = broken.ask("What needs my attention?");
  assert.equal(a.error, true);
  assert.match(a.blocks[0].text, /won't guess/);
  assert.ok(v.signals.length, "the signals do not depend on the assistant");
});

test("missing inventory data: no stock claims, and the rest of the tower stands", () => {
  const seed = JSON.parse(JSON.stringify(F.SEED));
  seed.products.forEach((p) => { delete p.systemStock; });
  const w = F.world({ seed });
  const v = w.tower.pass();
  assert.equal(sig(v, "stockout"), null);
  assert.equal(sig(v, "slow-stock"), null);
  assert.ok(sig(v, "reorder-due"), "cadence does not need stock");
  assert.equal(v.pulse.find((p) => p.id === "stock").available, false);
  assert.equal(v.now.inventory.available, false);
});

test("delayed sync: an import 25 days old is marked delayed everywhere it is shown", () => {
  const v = F.world().tower.pass();
  assert.equal(v.freshness.delayed, true);
  assert.equal(v.freshness.sources.find((s) => s.id === "orders").state, "delayed");
  const aged = F.world({ now: new Date("2026-08-28T09:00:00Z").getTime() }).tower.pass();
  assert.equal(aged.freshness.delayed, false, "a day after the import it is current");
});

test("private window / blocked storage: reads fall back to empty, the tower still renders", () => {
  const storage = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); }, removeItem() {} };
  const store = F.CTStore.create(storage);
  assert.deepEqual(store.read().orders, []);
  assert.throws(() => store.addOrders([{ customerId: "c01", customer: "x", lines: [{ qty: 1 }], amount: null }]), { name: "StoreError" });
});

test("two businesses on one device keep separate records: no tab resolves what the other detected", () => {
  const storage = F.CTStore.memory();
  const plain = F.world({ storage });
  const sample = F.world({ storage, dataReady: F.sampleDataReady() });
  plain.tower.pass(); sample.tower.pass();
  const n = () => [...storage._map.keys()].filter((k) => k.includes(".audit")).map((k) => JSON.parse(storage._map.get(k)).length).reduce((a, b) => a + b, 0);
  const settled = n();
  for (let i = 0; i < 5; i++) { plain.tower.pass(); sample.tower.pass(); }
  assert.equal(n(), settled, "alternating passes add nothing — no flip-flop");
  assert.ok(sample.tower.last().signals.some((s) => s.id === "overdue"));
  assert.equal(plain.tower.last().signals.some((s) => s.id === "overdue"), false);
  assert.ok([...storage._map.keys()].some((k) => k.startsWith("fb.v7.ct.sample:sample.")), "the sample business has its own keys");
  assert.ok(storage._map.has("fb.v7.ct.lifecycle"), "the export keeps the plain keys");
});

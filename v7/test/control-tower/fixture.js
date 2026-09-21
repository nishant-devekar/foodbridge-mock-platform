/* Real records for the Control Tower suites: the demonstration tenant's own
   export, the engines that already read it, and -- for the ledger path -- the
   onboarding's own sample import, built the way onboarding builds it. */
const path = require("node:path");
global.window = globalThis;
const V7 = path.join(__dirname, "..", "..");
const C = path.join(V7, "modules/foodbridge-customer-mockup/v3/screens/customers");
const OB = path.join(V7, "modules/foodbridge-onboarding/screens");
require(path.join(C, "order-history.js"));
require(path.join(C, "seed.inline.js"));
require(path.join(C, "predictive-order.js"));
require(path.join(OB, "sample-business.js"));
const evidence = require(path.join(OB, "evidence.js"));
const dataset = require(path.join(OB, "dataset.js"));
const CTState = require(path.join(V7, "assets/ct/state.js"));
const CTSignals = require(path.join(V7, "assets/ct/signals.js"));
const CTStore = require(path.join(V7, "assets/ct/store.js"));
const CTActions = require(path.join(V7, "assets/ct/actions.js"));
const CTAssistant = require(path.join(V7, "assets/ct/assistant.js"));
const CTTower = require(path.join(V7, "assets/ct/tower.js"));

const SEED = JSON.parse(JSON.stringify(window.SEED));
const HISTORY = JSON.parse(JSON.stringify(window.FB_ORDER_HISTORY));
const NOW = new Date("2026-09-21T09:00:00Z").getTime();
const api = { evidence, predict: window.FB_PREDICT, dataset, mrpOf: window.FB_SAMPLE.mrpOf };

/* Onboarding's sampleRaw(), step for step (onboarding.js). */
function sampleDataReady(now) {
  const seed = SEED, hist = HISTORY;
  const nameOf = (c) => (c.name && (c.name.en || c.name)) || c._id;
  const customers = seed.b2b.map((c) => ({ id: c._id, name: nameOf(c) }));
  const products = seed.products.map((p) => {
    const r = { id: p.id, name: p.name, sku: p.artNo, unit: p.unit };
    if (typeof p.systemStock === "number") r.stockOnHand = p.systemStock;
    return r;
  });
  const byName = {}; customers.forEach((c) => { byName[c.id] = c.name; });
  const from = new Date((now || NOW) - 240 * 864e5).toISOString().slice(0, 10);
  const orders = [];
  for (const cid of Object.keys(hist)) (hist[cid].orders || []).forEach((occ, i) => {
    if (occ.at < from) return;
    orders.push({ id: cid + "-" + i, customerId: cid, customerName: byName[cid] || cid, date: occ.at,
      lines: occ.lines.map((l) => ({ itemId: l.productId, qty: l.qty, unit: "pcs" })) });
  });
  const modules = window.FB_SAMPLE.build(seed, orders, new Date(now || NOW).toISOString().slice(0, 10));
  const raw = { app: "sample", org: { id: "sample", name: "Sample Distributors" }, customers, products, orders, modules };
  const dr = dataset.fromApp(raw);
  dr.readAt = new Date(now || NOW).toISOString();
  return dr;
}

function state(over) {
  const o = over || {};
  return CTState.build(Object.assign({
    now: NOW, seed: o.seed || SEED, history: o.history || HISTORY,
    exportMeta: { importedAt: "2026-08-27", label: "Your Zoho sales orders" },
    api, createdOrders: [], purchaseRequests: [], outbox: [],
  }, o));
}

/* A whole Control Tower over memory storage and a clock the test moves. */
function world(o) {
  const opts = o || {};
  const storage = opts.storage || CTStore.memory();
  let t = opts.now || NOW;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const store = CTStore.create(storage, clock.now);
  const raw = () => ({
    seed: opts.seed || SEED, history: opts.history || HISTORY,
    exportMeta: { importedAt: "2026-08-27", label: "Your Zoho sales orders" },
    dataReady: opts.dataReady || null, api,
  });
  const tower = CTTower.create({ store, readRaw: raw, clock: clock.now, business: () => "Test Traders" });
  return { tower, store, storage, clock };
}

module.exports = { world, CTStore, CTActions, CTAssistant, CTTower, V7, SEED, HISTORY, NOW, api, state, sampleDataReady, CTState, CTSignals, evidence, dataset };

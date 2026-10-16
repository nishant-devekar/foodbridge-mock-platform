/* ==========================================================================
   CONTROL TOWER · JOURNEY FACTS — the store's records as plain numbers.
   (15 Oct 2026)

   The journey engine (assets/journey/engine.js) knows no business. This is
   the one place that does: it reads one pass of the tower (tower.pass())
   and states what the store holds, as a flat facts object any journey graph
   can test with `{ "fact": "products.broken", "eq": 0 }`.

   A graph written elsewhere (by a person, or by Claude from the store's
   database) may bring its own facts instead; these names are a convention,
   not a contract the engine enforces. Absent evidence is absent: a figure
   nobody can count is left undefined, so `exists` can tell "none" from
   "unknown" (D-015).

     facts(view, extra) → { products: {…}, customers: {…}, orders: {…}, … }
     blank(extra)       → the facts of a store created a minute ago

   Pure: no DOM, no storage, no clock. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const day = function (s) { return String(s || "").slice(0, 10); };
  const distinct = function (xs) { const o = {}; xs.forEach(function (x) { if (x) o[x] = 1; }); return Object.keys(o); };
  const dupCount = function (xs) {
    const seen = {}; let n = 0;
    xs.forEach(function (x) { if (!x) return; const k = String(x).toLowerCase().replace(/\s+/g, " ").trim(); if (seen[k]) n++; else seen[k] = 1; });
    return n;
  };
  const digits = function (s) { return String(s || "").replace(/\D/g, ""); };

  function blank(extra) {
    return merge({
      products: { count: 0, broken: 0, incomplete: 0 },
      customers: { count: 0, broken: 0, incomplete: 0, noTerms: 0 },
      orders: { count: 0, days: 0, sent: 0 },
      deliveries: { count: 0, vans: 0, daysClosed: 0 },
      payments: { count: 0 },
      dues: { imported: false },
      stock: { counted: 0, unknown: 0 },
      suppliers: { count: 0, unmapped: 0 },
      purchases: { count: 0, received: 0 },
      production: { recipes: 0, batches: 0 },
      business: { makes: false },
    }, extra);
  }

  function facts(view, extra) {
    const st = (view && view.state) || {};
    const rec = (view && view.records) || {};
    const products = st.products || [];
    const customers = st.customers || [];
    const phones = st.phoneById || {};
    const address = st.addressById || {};
    const ledger = st.ledger || null;

    /* Products: broken = would break an order or an invoice (no name, no
       unit, listed twice); incomplete = no MRP, which Inventory values by. */
    const pBroken = products.filter(function (p) { return !String(p.name || "").trim() || !String(p.unit || "").trim(); }).length +
      dupCount(products.map(function (p) { return p.name; }));
    /* Customers: broken = no phone that dials, or a phone used twice;
       incomplete = no address the van can go to. */
    const custPhones = customers.map(function (c) { return digits(phones[c.id]); });
    const cBroken = custPhones.filter(function (p) { return p.length < 10; }).length +
      dupCount(custPhones.filter(function (p) { return p.length >= 10; }));

    const orders = (st.orders || []).concat(st.made || []);
    const orderDays = distinct(orders.map(function (o) { return day(o.date || o.at); }));
    const deliveries = rec.deliveries || [];
    const route = rec.route && rec.route.stops ? rec.route.stops : [];
    const vans = distinct(deliveries.map(function (d) { return d.van; }).concat(route.map(function (s) { return s.van; })));
    const payments = ((ledger && ledger.payments) || []).length + (rec.payments || []).length;
    const counted = (rec.stockCounts || []).length + products.filter(function (p) { return typeof p.stock === "number"; }).length;

    /* Customers who owe, with no credit limit on file: Collections can't colour them. */
    const owing = {};
    ((ledger && ledger.invoices) || []).forEach(function (i) { if (i.balance > 0) owing[i.customerId] = 1; });
    const limits = st.creditLimitById || {};
    const noTerms = Object.keys(owing).filter(function (id) { return typeof limits[id] !== "number"; }).length;

    const suppliers = st.suppliers || [];
    const pos = (ledger && ledger.purchaseOrders) || [];

    return merge({
      products: { count: products.length, broken: pBroken, incomplete: products.filter(function (p) { return !p.mrp; }).length },
      customers: { count: customers.length, broken: cBroken, incomplete: customers.filter(function (c) { return !address[c.id]; }).length, noTerms: noTerms },
      orders: { count: orders.length, days: orderDays.length, sent: (rec.outbox || []).length + (st.made || []).length },
      deliveries: { count: deliveries.length, vans: vans.length, daysClosed: distinct(deliveries.map(function (d) { return day(d.at); })).length },
      payments: { count: payments },
      dues: { imported: !!(ledger && ledger.invoices && ledger.invoices.length) },
      stock: { counted: counted, unknown: products.filter(function (p) { return typeof p.stock !== "number"; }).length },
      suppliers: { count: suppliers.length, unmapped: suppliers.length ? 0 : products.length },
      purchases: { count: pos.length, received: pos.filter(function (p) { return /receiv|closed|billed/i.test(String(p.status || "")); }).length },
      production: { recipes: 0, batches: 0 },
      business: { makes: false },
    }, extra);
  }

  /* Deep merge: `extra` wins, key by key. */
  function merge(base, extra) {
    if (!extra) return base;
    Object.keys(extra).forEach(function (k) {
      const v = extra[k];
      if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object") merge(base[k], v);
      else base[k] = v;
    });
    return base;
  }

  /* What a flow counts as right: the products and customers with nothing
     broken (no name, unit, phone; not listed twice; for Finished Goods,
     not hidden from customers). */
  function derive(f) {
    ["products", "customers"].forEach(function (k) {
      const x = f[k]; if (x) x.correct = Math.max(0, (x.count || 0) - (x.broken || 0));
    });
    return f;
  }

  const API = { facts: function (view, extra) { return derive(facts(view, extra)); }, blank: function (extra) { return derive(blank(extra)); }, merge: merge, derive: derive };
  root.CTJourneyFacts = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

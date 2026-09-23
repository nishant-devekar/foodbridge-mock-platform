/* ==========================================================================
   CONTROL TOWER · STATE — the one plain object every detector reads.

   A READER, NOT A SOURCE. Nothing here holds business truth of its own. It
   takes what already exists and puts it in one shape:

     the business      the session's Dataset when one was imported (the user's
                       Zoho, Xero, files, or the labelled sample), through
                       FB_DATASET.toEngine() -- the ONE place the engines'
                       shape is made. Otherwise the demonstration tenant's
                       own export (SEED + FB_ORDER_HISTORY), as before.
     orders made here  fb.v7.orders -- written by onboarding's Create Order and
                       by the Control Tower's own actions, one record shape.
                       Merged in as buying occasions, so acting on a signal
                       changes what the engines see on the next pass.
     cadence           FB_EVIDENCE.orderingStatusFor / missedOrders (D-016's
                       one rule), handed the merged history.
     money             only what the Dataset proves (D-015). No ledger means
                       `ledger: null`, never zeros.

   Pure: no DOM, no storage, no clock of its own. `raw.now` is the clock.
   Runs unchanged under node, which is how the tests drive it.
   ========================================================================== */

(function (root) {
  "use strict";

  const DAY = 86400000;
  const iso = function (t) { return new Date(t).toISOString().slice(0, 10); };
  const dayOf = function (s) { return new Date(String(s).slice(0, 10) + "T00:00:00Z").getTime(); };

  function recs(c) { return (c && c.present && Array.isArray(c.records)) ? c.records : null; }

  /* The ledger collections the Control Tower can use, or null when the
     session proves none of them. Each stays null on its own when absent. */
  function ledgerOf(ds) {
    if (!ds) return null;
    const l = {
      invoices: recs(ds.invoices),
      payments: recs(ds.payments),
      bills: recs(ds.bills),
      purchaseOrders: recs(ds.purchaseOrders),
      suppliers: recs(ds.vendors) || recs(ds.suppliers),
    };
    return (l.invoices || l.payments || l.bills || l.purchaseOrders || l.suppliers) ? l : null;
  }

  function build(raw) {
    const r = raw || {};
    const api = r.api || {};
    const now = typeof r.now === "number" ? r.now : new Date(r.now || Date.now()).getTime();
    const dr = r.dataReady && r.dataReady.dataset ? r.dataReady : null;

    let seed, history, source, ledger = null, dsProducts = null;
    if (dr && api.dataset) {
      const eng = api.dataset.toEngine(dr.dataset, now);
      seed = eng.seed; history = eng.history;
      const p = dr.provenance || {};
      source = { kind: p.kind || "files", label: p.label || "Your records", readAt: dr.readAt || null,
                 sample: p.kind === "sample" };
      ledger = ledgerOf(dr.dataset);
      dsProducts = recs(dr.dataset.products);
    } else {
      seed = r.seed || {};
      history = r.history || {};
      source = { kind: "export", label: (r.exportMeta && r.exportMeta.label) || "Your imported orders",
                 importedAt: (r.exportMeta && r.exportMeta.importedAt) || null, sample: false };
    }

    /* Product category: the record's own, or -- for a record that came from
       the tenant's catalogue by another route -- the catalogue's, by the id
       the record was read from. Used only to name a likely supplier. */
    const tenantCat = {};
    ((r.seed && r.seed.products) || []).forEach(function (p) { tenantCat[p.id] = p.category || null; });
    const extOf = {};
    (dsProducts || []).forEach(function (p) { if (p.from && p.from.externalId) extOf[p.id] = p.from.externalId; });

    const customers = (seed.b2b || []).map(function (c) {
      return { id: c._id, name: (c.name && (c.name.en || c.name)) || c._id };
    });
    const nameById = {};
    customers.forEach(function (c) { nameById[c.id] = c.name; });

    /* The shop's own phone, from the tenant's customer list. The one thing
       the owner needs the moment a stop goes wrong, so the Control Tower can
       offer the call instead of a reference number. An imported business
       renumbers its customers, so a record is matched by its id or, failing
       that, by the shop's name. No number on file, no call offered. */
    const phoneById = {};
    const idByName = {};
    customers.forEach(function (c) { idByName[String(c.name).toLowerCase()] = c.id; });
    ((r.seed && r.seed.b2b) || []).forEach(function (c) {
      const ph = c && (c.phone || c.mobile);
      if (!ph) return;
      const nm = (c.name && (c.name.en || c.name)) || "";
      const id = nameById[c._id] ? c._id : idByName[String(nm).toLowerCase()];
      if (id) phoneById[id] = String(ph);
    });

    const mrpOf = api.mrpOf || function () { return null; };
    const products = (seed.products || []).map(function (p) {
      const mrp = mrpOf(p.name);
      return {
        id: p.id, name: p.name, sku: p.artNo || "", unit: p.unit || "",
        category: p.category || tenantCat[extOf[p.id]] || tenantCat[p.id] || null,
        stock: typeof p.systemStock === "number" ? p.systemStock : null,
        mrp: typeof mrp === "number" && mrp > 0 ? mrp : null,
      };
    });
    const productById = {};
    products.forEach(function (p) { productById[p.id] = p; });

    /* ── orders made in FoodBridge, merged in as occasions ─────────────── */
    const made = (r.createdOrders || []).filter(function (o) { return o && nameById[o.customerId]; });
    const merged = {};
    Object.keys(history).forEach(function (id) {
      merged[id] = { avgCycleDays: history[id].avgCycleDays, orders: (history[id].orders || []).slice() };
    });
    made.forEach(function (o) {
      const h = merged[o.customerId] || (merged[o.customerId] = { avgCycleDays: 30, orders: [] });
      h.orders.push({
        at: iso(new Date(o.date).getTime()),
        value: typeof o.amount === "number" ? o.amount : null,
        lines: (o.lines || []).filter(function (l) { return Number(l.qty) > 0; })
          .map(function (l) { return { productId: l.productId, qty: Number(l.qty) }; }),
        source: "foodbridge", no: o.no,
      });
      h.orders.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    });

    /* Flat order list, newest first. */
    const orders = [];
    Object.keys(merged).forEach(function (cid) {
      merged[cid].orders.forEach(function (occ) {
        orders.push({ customerId: cid, customer: nameById[cid] || cid, date: occ.at,
                      value: typeof occ.value === "number" ? occ.value : null,
                      lines: occ.lines || [], source: occ.source || "import", no: occ.no || null });
      });
    });
    orders.sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    /* Where the records END. Windows (sales, velocity) anchor here, not on
       today: an import from August is not a business that stopped trading. */
    const imported = orders.filter(function (o) { return o.source === "import"; });
    const dataEnd = imported.length ? imported[0].date : null;

    /* Committed stock: what FoodBridge orders still have to ship. The stock
       figure is as of the import, so every order made since is a claim on it. */
    const committed = {};
    made.forEach(function (o) {
      (o.lines || []).forEach(function (l) {
        if (Number(l.qty) > 0) committed[l.productId] = (committed[l.productId] || 0) + Number(l.qty);
      });
    });

    /* ── cadence, from the one rule ─────────────────────────────────────── */
    let cadence = [], missed = { shops: [] };
    if (api.evidence) {
      cadence = Object.keys(merged).map(function (id) {
        const st = api.evidence.orderingStatusFor(id, merged, now) || {};
        /* The average over VALUED orders only. evidence.js counts a missing
           value as 0, which for a Dataset with no order values would read as
           a shop worth ₹0 -- a claim, not an absence (D-015). */
        const valued = (st.orders || []).filter(function (o) { return typeof o.value === "number"; });
        return { id: id, name: nameById[id] || id, bucket: st.bucket, daysOverdue: st.daysOverdue || 0,
                 cycleDays: st.avgCycleDays || null, lastOrderAt: st.lastOrderAt || null,
                 avgValue: valued.length ? Math.round(valued.reduce(function (n, o) { return n + o.value; }, 0) / valued.length) : null,
                 orderCount: (st.orders || []).length };
      });
      missed = api.evidence.missedOrders({ seed: seed, history: merged, predict: api.predict, now: now }) || { shops: [] };
    }

    /* Suppliers, by the category they serve -- only when the ledger names
       them. No supplier on file is said, never guessed. */
    const suppliers = ledger && ledger.suppliers ? ledger.suppliers.map(function (v) {
      const cat = (v.raw && v.raw.category) || v.category || null;
      return { id: v.id, name: v.name, category: cat };
    }) : [];

    return {
      now: now,
      source: source,
      dataEnd: dataEnd,
      customers: customers,
      customerById: nameById,
      phoneById: phoneById,
      products: products,
      productById: productById,
      orders: orders,
      history: merged,
      made: made,
      committed: committed,
      cadence: cadence,
      missed: missed,
      ledger: ledger,
      suppliers: suppliers,
      purchaseRequests: (r.purchaseRequests || []).filter(function (p) { return p.status !== "cancelled"; }),
      outbox: r.outbox || [],
    };
  }

  const API = { build: build, DAY: DAY, iso: iso, dayOf: dayOf };
  root.CTState = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

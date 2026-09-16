/* ==========================================================================
   ONBOARDING — the evidence layer.

   v5 implements O-001's locked UX (lock e14f20ea96ee5c51). This file is
   STEP 1 of that implementation and has no UI at all: it answers, from the
   data this tenant actually has, the three questions the locked Flow Map
   puts on S03 and S04 —

     what does FoodBridge have · what can it honestly compute · what would
     more evidence unlock

   Deliberately UI-free and dependency-free, in the same spirit as
   predictive-order.js: plain data in, plain data out, no DOM, no storage,
   no clock of its own beyond the one it is handed. That is what lets it be
   checked headlessly under node without a browser or a test framework.

   ── WHAT IT READS, AND NOTHING ELSE ──────────────────────────────────────
     window.SEED               products (86) and b2b customers (40) — Miha's
                               real catalogue and shops
     window.FB_ORDER_HISTORY   the tenant's REAL Zoho export: 39 of 40
                               customers, 532 orders, 3,931 lines,
                               2024-08-28 → 2026-08-24
     window.FB_PREDICT         the existing, back-tested reorder engine

   It invents nothing. There are no invoices, no payments and no cost price
   anywhere in this repository for this tenant, so receivables, collections,
   capital-tied-in-rupees and margin are reported as BLOCKED and are never
   estimated, zeroed or borrowed from another tenant's seed. That refusal is
   the whole point — see L-005, and D-015.

   ── THE CADENCE RULE IS REPRODUCED, NOT IMPORTED (D-016) ─────────────────
   stock-audit.js is wrapped in an IIFE exporting only `window.SAH`, so its
   orderingStatusFor() at :1061 is closure-private and cannot be called from
   this page. The rule below is reproduced from it verbatim — same
   thresholds, same fields, same honest "unknown" for a customer with no
   signal. ONE RULE, TWO IMPLEMENTATIONS: if either changes the other is
   wrong, and the two screens would disagree about the same shop on the same
   day.

   ── THE CLOCK IS LIVE ────────────────────────────────────────────────────
   stock-audit.js uses `const now = () => new Date()`. This file matches it:
   `now` is an injected argument defaulting to the real clock, so the two
   pages agree, and a headless check can pin a date without the figures
   being fixtures. Every count here moves with the calendar, exactly as the
   field tool's does.
   ========================================================================== */

(function () {
  "use strict";

  const DAY = 86400000;                          // matches stock-audit.js:54

  /* ---------------------------------------------------------- the rule ---
     Reproduced from stock-audit.js:1061 under D-016. Overdue is more than
     five days past the expected date, Slipping is one to five, On Track is
     anything not yet due — measured against each customer's OWN median
     cycle, which the real export recorded per customer.

     A customer with no signal is "unknown", never a guessed "on track":
     c40 has no orders in the export at all, and saying nothing about them
     is the honest answer. */
  function orderingStatusFor(customerId, signals, nowTime) {
    const sig = signals && signals[customerId];
    const orders = (sig && sig.orders) || [];
    if (!sig || !orders.length) return { bucket: "unknown", label: "Unknown", orders: [] };

    const last = orders[0];
    const expected = new Date(last.at).getTime() + sig.avgCycleDays * DAY;
    const days = Math.round((nowTime - expected) / DAY);

    let bucket, label;
    if (days > 5) { bucket = "overdue"; label = "Overdue"; }
    else if (days > 0) { bucket = "slipping"; label = "Slipping"; }
    else { bucket = "on_track"; label = "On Track"; }

    let observedCycle = null;
    if (orders.length > 1) {
      const spans = orders.slice(0, -1).map((o, i) => (new Date(o.at) - new Date(orders[i + 1].at)) / DAY);
      observedCycle = Math.round(spans.reduce((a, b) => a + b, 0) / spans.length);
    }
    const avgValue = Math.round(orders.reduce((n, o) => n + (o.value || 0), 0) / orders.length);

    return {
      bucket, label, orders,
      lastOrderAt: last.at, lastOrderValue: last.value,
      avgCycleDays: sig.avgCycleDays, observedCycle, avgValue,
      expectedAt: expected, daysOverdue: days,
    };
  }

  /* ------------------------------------------------------- what we hold ---
     Presence, and how we know. `context` describes the business; `evidence`
     proves what happened in it. They are two axes and never one list — the
     distinction D-015 turns on, because a missing context row reduces
     richness while a missing evidence row removes whole signals. */
  function takeInventory(seed, history) {
    const products  = (seed && seed.products) || [];
    const customers = (seed && seed.b2b) || [];
    const withOrders = Object.keys(history || {}).filter(function (id) {
      const h = history[id];
      return h && h.orders && h.orders.length;
    });

    return {
      context: {
        products:  { present: products.length > 0,  count: products.length },
        customers: { present: customers.length > 0, count: customers.length },
        // Real for THIS tenant only. Other demo stores carry suppliers and
        // staff; D-013 refuses to borrow them, so here they are simply
        // absent — and under D-015 that does not block anything.
        suppliers: { present: false, count: 0 },
        staff:     { present: false, count: 0 },
      },
      evidence: {
        sales:    { present: withOrders.length > 0, customers: withOrders.length,
                    orders: withOrders.reduce(function (n, id) { return n + history[id].orders.length; }, 0) },
        invoices: { present: false, note: "no invoice dataset exists for any tenant" },
        payments: { present: false, note: "the only payments data belongs to another tenant" },
      },
      // Quantities we have; cost we do not. That single absence is what
      // makes every rupee figure in the Control Tower reference impossible
      // here, and it is recorded rather than worked around.
      stock: { quantities: true, cost: false },
    };
  }

  /* ------------------------------------------------------ the floor -------
     From the locked Flow Map, and explicitly an UNVALIDATED HYPOTHESIS: at
     least one entity master AND at least one transactional series over
     time. Masters alone are a directory; transactions alone cannot be
     attributed to anyone. No customer has been watched hitting this. */
  function floorStatus(inv) {
    const master = inv.context.products.present || inv.context.customers.present;
    const series = inv.evidence.sales.present || inv.evidence.invoices.present ||
                   inv.evidence.payments.present;
    return {
      met: master && series,
      hasMaster: master,
      hasSeries: series,
      hypothesis: "UNVALIDATED — reasoned from the Control Tower reference and this repository; no customer has been watched hitting it",
    };
  }

  /* --------------------------------------------------- what we can say ----
     Capability, derived from evidence rather than declared. A signal is
     computable only when everything it needs is present; otherwise it is
     BLOCKED and the UI must render nothing at all for it — not a zero, not
     a greyed card, not a promise. */
  function capabilities(inv) {
    const sales = inv.evidence.sales.present;
    const qty   = inv.stock.quantities;
    const cost  = inv.stock.cost;
    const money = inv.evidence.invoices.present && inv.evidence.payments.present;

    const all = [
      { id: "order_cadence",       needs: ["sales"],                ok: sales },
      { id: "stock_position",      needs: ["stock quantities"],     ok: qty },
      { id: "reorder_prediction",  needs: ["sales", "products"],    ok: sales && inv.context.products.present },
      { id: "slow_stock_count",    needs: ["sales", "stock quantities"], ok: sales && qty },
      { id: "receivables",         needs: ["invoices", "payments"], ok: money },
      { id: "collections",         needs: ["invoices", "payments"], ok: money },
      { id: "overdue_value",       needs: ["invoices", "payments"], ok: money },
      { id: "capital_tied",        needs: ["stock quantities", "cost"], ok: qty && cost },
      { id: "slow_stock_value",    needs: ["stock quantities", "cost"], ok: qty && cost },
      { id: "margin",              needs: ["cost"],                 ok: cost },
      { id: "purchase_exposure",   needs: ["purchase orders"],      ok: false },
    ];
    return {
      computable: all.filter(function (s) { return s.ok; }).map(function (s) { return s.id; }),
      blocked:    all.filter(function (s) { return !s.ok; })
                     .map(function (s) { return { id: s.id, needs: s.needs }; }),
    };
  }

  /* ------------------------------------------------------- the unlocks ----
     Every gap the UI is allowed to show must name what it BUYS. A field
     existing in the backend is not a reason to ask for it — which is why
     suppliers and staff never appear here: their absence unlocks nothing
     nameable. This is what keeps S03 an offer rather than a checklist. */
  function unlocks(caps) {
    const blocked = {};
    caps.blocked.forEach(function (b) { blocked[b.id] = true; });
    const out = [];
    if (blocked.receivables || blocked.collections) {
      out.push({ evidence: "invoices_and_payments", label: "Invoices & payments",
                 unlocks: ["receivables", "collections", "overdue_value"],
                 say: "See who owes you, and what to collect.",
                 short: "receivables and collections" });
    }
    if (blocked.capital_tied || blocked.margin) {
      out.push({ evidence: "cost_price", label: "Cost price",
                 unlocks: ["capital_tied", "slow_stock_value", "margin"],
                 say: "See what your stock is worth, and where margin goes.",
                 short: "what your stock is worth" });
    }
    return out;
  }

  /* ---------------------------------------------------------- signals -----
     The truthful figures, computed only where capability allows. Nothing
     below is drawn unless its evidence exists. */
  function signals(seed, history, caps, nowTime) {
    const can = {};
    caps.computable.forEach(function (id) { can[id] = true; });
    const out = {};

    if (can.order_cadence) {
      const ids = Object.keys(history || {});
      const buckets = { overdue: [], slipping: [], on_track: [], unknown: [] };
      ids.forEach(function (id) {
        const st = orderingStatusFor(id, history, nowTime);
        (buckets[st.bucket] || buckets.unknown).push({ customerId: id, daysOverdue: st.daysOverdue });
      });
      out.order_cadence = {
        overdue: buckets.overdue.length,
        slipping: buckets.slipping.length,
        onTrack: buckets.on_track.length,
        // Scope travels WITH the number. "9 shops overdue" across 40 when
        // only 39 have any history is true and misleading at once.
        scope: { withHistory: ids.length, totalCustomers: (seed.b2b || []).length },
      };
    }

    if (can.stock_position) {
      const products = seed.products || [];
      const out_of = products.filter(function (p) { return Number(p.systemStock) === 0; });
      out.stock_position = { outOfStock: out_of.length, catalogue: products.length };
    }

    return out;
  }

  /* Reorder readiness leans on the EXISTING back-tested engine rather than a
     second opinion. Two refusals matter:
       · latestCompletedAudit is null — onboarding has no audits, and
         stockFromAudit(null) returns {} by contract. We never fabricate one.
       · ok === true is not enough. context.historyIsStale marks a customer
         whose pattern is real but not current; counting them as "ready"
         would present an old pattern as a live one. Five of the 39 sit in
         exactly that state. */
  function reorderReady(seed, history, nowTime, predict) {
    if (!predict || typeof predict.generatePredictiveOrder !== "function") return null;
    const products = seed.products || [];
    const ready = [];
    const stale = [];
    const none = [];
    Object.keys(history || {}).forEach(function (id) {
      const res = predict.generatePredictiveOrder({
        customerId: id,
        latestCompletedAudit: null,            // contract: yields {} stock
        orders: (history[id] || {}).orders || [],
        products: products,
        now: new Date(nowTime),
      });
      const ctx = (res && res.context) || {};
      if (res && res.ok && !ctx.historyIsStale) ready.push(id);
      else if (res && res.ok && ctx.historyIsStale) stale.push(id);
      else none.push(id);
    });
    return { ready: ready.length, staleHistory: stale.length, noRecommendation: none.length,
             scope: { withHistory: Object.keys(history || {}).length } };
  }

  /** The whole model, in one call. `now` is injected so this page and the
      field tool agree, and so a headless check can pin a date. */
  function build(opts) {
    const o = opts || {};
    const seed    = o.seed    || (typeof window !== "undefined" ? window.SEED : null) || {};
    const history = o.history || (typeof window !== "undefined" ? window.FB_ORDER_HISTORY : null) || {};
    const predict = o.predict || (typeof window !== "undefined" ? window.FB_PREDICT : null);
    const nowTime = o.now ? new Date(o.now).getTime() : Date.now();

    const inventory = takeInventory(seed, history);
    const floor     = floorStatus(inventory);
    const caps      = capabilities(inventory);
    const sig       = signals(seed, history, caps, nowTime);

    const reorder = caps.computable.indexOf("reorder_prediction") !== -1
      ? reorderReady(seed, history, nowTime, predict) : null;
    if (reorder) sig.reorder_prediction = reorder;

    return {
      generatedAt: new Date(nowTime).toISOString(),
      context: inventory.context,
      evidence: inventory.evidence,
      stock: inventory.stock,
      floor: floor,
      computable: caps.computable,
      blocked: caps.blocked,
      unlocks: unlocks(caps),
      signals: sig,
      // Coverage is a DISCLOSURE, never a score to fill in: words the
      // customer can check, not a percentage that invites completion.
      coverageSentence: coverage(inventory, sig),
    };
  }

  function coverage(inv, sig) {
    if (!inv.evidence.sales.present) return "";
    const s = sig.order_cadence && sig.order_cadence.scope;
    if (!s) return "";
    return "From " + inv.evidence.sales.orders + " orders across " +
           s.withHistory + " of your " + s.totalCustomers + " shops.";
  }

  /* ------------------------------------------------- the opportunity -----
     S05 opens ONE opportunity narrowly, and this is where the reasoning for
     it happens — not in the view. For every shop that has gone past its own
     cycle: why it was picked, what it factually buys, and a proposed reorder
     ONLY where the engine's own contract allows one.

     THE CONSTRAINT THAT SHAPES THIS (D-017). A shop is overdue *because* it
     stopped ordering, and that is exactly what makes its history stale. So
     FB_PREDICT returns historyIsStale on the very shops the opportunity is
     most about — the three furthest past due among Miha's are all stale. For
     those, `suggestion` is null and the screen shows what they USED to buy.
     Presenting a stale pattern as a current proposal would be the trust
     failure L-005 records, wearing the costume of helpfulness. */
  function missedOrders(opts) {
    const o = opts || {};
    const seed = o.seed || (typeof window !== "undefined" ? window.SEED : null) || {};
    const history = o.history || (typeof window !== "undefined" ? window.FB_ORDER_HISTORY : null) || {};
    const predict = o.predict || (typeof window !== "undefined" ? window.FB_PREDICT : null);
    const nowTime = o.now ? new Date(o.now).getTime() : Date.now();

    const nameById = {};
    (seed.b2b || []).forEach(function (c) {
      nameById[c._id] = (c.name && (c.name.en || c.name)) || c._id;
    });
    const productName = {};
    (seed.products || []).forEach(function (p) { productName[p.id] = p.name; });

    const shops = [];
    Object.keys(history).forEach(function (id) {
      const st = orderingStatusFor(id, history, nowTime);
      if (st.bucket !== "overdue") return;

      // What this shop actually buys, by how often it appears in its own
      // orders. Factual — no model, no estimate.
      const freq = {};
      (st.orders || []).forEach(function (ord) {
        (ord.lines || []).forEach(function (l) {
          if (l && l.productId) freq[l.productId] = (freq[l.productId] || 0) + 1;
        });
      });
      const usual = Object.keys(freq)
        .sort(function (a, b) { return freq[b] - freq[a]; })
        .slice(0, 3)
        .map(function (pid) { return productName[pid] || pid; });

      let suggestion = null;
      if (predict && typeof predict.generatePredictiveOrder === "function") {
        const r = predict.generatePredictiveOrder({
          customerId: id,
          latestCompletedAudit: null,        // contract: yields {} stock
          orders: st.orders,
          products: seed.products || [],
          now: new Date(nowTime),
        });
        const ctx = (r && r.context) || {};
        if (r && r.ok && !ctx.historyIsStale) {
          // The draft's ACTUAL lines, not a count. A draft the user is asked
          // to review has to be reviewable, and `suggestedQty` is carried
          // separately from `qty` so editing one never destroys the record of
          // what FoodBridge proposed (D-018, the draft contract).
          suggestion = {
            count: r.lines.length,
            lines: r.lines.map(function (l) {
              return {
                productId: l.productId,
                name: productName[l.productId] || l.productId,
                suggestedQty: l.recommendedQty,
                boughtOn: l.boughtOn,
                ofOrders: l.ofOrders,
              };
            }),
          };
        }
      }

      // What this shop last actually ordered. A FACT, offered to the seven
      // shops whose history is too stale to predict from — never called a
      // recommendation, and never counted among the sixteen.
      const lastOrd = (st.orders || [])[0] || null;
      const lastOrder = lastOrd ? {
        at: lastOrd.at,
        lines: (lastOrd.lines || []).map(function (l) {
          return { productId: l.productId, name: productName[l.productId] || l.productId, qty: l.qty };
        }),
      } : null;

      shops.push({
        id: id,
        name: nameById[id] || id,
        cycleDays: st.avgCycleDays,
        daysOverdue: st.daysOverdue,
        lastOrderAt: st.lastOrderAt,
        orderCount: (st.orders || []).length,
        usualProducts: usual,
        suggestion: suggestion,
        lastOrder: lastOrder,
      });
    });

    shops.sort(function (a, b) { return b.daysOverdue - a.daysOverdue; });
    return {
      id: "missed_orders",
      shops: shops,
      total: shops.length,
      withSuggestion: shops.filter(function (s) { return !!s.suggestion; }).length,
      scope: { withHistory: Object.keys(history).length,
               totalCustomers: (seed.b2b || []).length },
    };
  }

  /* A handful of REAL records behind a figure on S03, for the inspect sheet.
     The point is that the user can check us: not a browser, not a report, just
     enough rows to recognise their own business. Nothing is summarised into a
     number the records cannot support. */
  function sampleRecords(opts) {
    const o = opts || {};
    const seed = o.seed || (typeof window !== "undefined" ? window.SEED : null) || {};
    const history = o.history || (typeof window !== "undefined" ? window.FB_ORDER_HISTORY : null) || {};
    const limit = o.limit || 5;

    if (o.kind === "products") {
      const rows = (seed.products || []).slice(0, limit).map(function (p) {
        return { a: p.name, b: p.category || "" };
      });
      return { rows: rows, total: (seed.products || []).length, unit: "products" };
    }

    if (o.kind === "customers") {
      const rows = (seed.b2b || []).slice(0, limit).map(function (c) {
        const nm = (c.name && (c.name.en || c.name)) || c._id;
        const has = Object.prototype.hasOwnProperty.call(history, c._id);
        return { a: nm, b: has ? "has order history" : "no orders yet" };
      });
      return { rows: rows, total: (seed.b2b || []).length, unit: "customers" };
    }

    // Orders: the most recent across every shop, newest first, so the sheet
    // opens on what the user remembers rather than on the oldest thing we hold.
    const all = [];
    Object.keys(history).forEach(function (id) {
      (history[id].orders || []).forEach(function (ord) {
        all.push({ at: ord.at, lines: (ord.lines || []).length });
      });
    });
    all.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    const rows = all.slice(0, limit).map(function (r) {
      return { a: fmtDate(r.at), b: r.lines + (r.lines === 1 ? " line" : " lines") };
    });
    return { rows: rows, total: all.length, unit: "orders" };
  }

  /* The window the records actually span, and how much of the book they
     touch. Provenance for the inspect sheet \u2014 said from the records, never
     from a claim about the source. */
  function provenance(opts) {
    const o = opts || {};
    const seed = o.seed || (typeof window !== "undefined" ? window.SEED : null) || {};
    const history = o.history || (typeof window !== "undefined" ? window.FB_ORDER_HISTORY : null) || {};
    let lo = null, hi = null;
    Object.keys(history).forEach(function (id) {
      (history[id].orders || []).forEach(function (ord) {
        if (!lo || String(ord.at) < lo) lo = String(ord.at);
        if (!hi || String(ord.at) > hi) hi = String(ord.at);
      });
    });
    return {
      from: lo ? fmtDate(lo) : null,
      to: hi ? fmtDate(hi) : null,
      shopsWithHistory: Object.keys(history).length,
      totalCustomers: (seed.b2b || []).length,
    };
  }

  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return ("0" + d.getDate()).slice(-2) + " " + MON[d.getMonth()] + " " + d.getFullYear();
  }

  const API = { build, orderingStatusFor, takeInventory, floorStatus, capabilities, unlocks,
                missedOrders, sampleRecords, provenance, fmtDate };

  if (typeof module !== "undefined" && module.exports) module.exports = API;   // headless check
  if (typeof window !== "undefined") window.FB_EVIDENCE = API;
})();

/* ==========================================================================
   CONTEXT — one read model over the tenant, for every screen that needs one.

   WHY THIS EXISTS, and what it is careful NOT to be:

   It is a READER, not a second business layer. Every rule it returns already
   existed somewhere in this cut; this file finds the one implementation and
   hands it out, so two screens can never disagree about the same shop.

   D-016 records that `orderingStatusFor()` has two implementations — the
   field tool's (stock-audit.js:1061, closure-private) and the evidence
   layer's (evidence.js:62, exported). They agree today, and the decision says
   that if one changes the other is wrong. This file does not add a third.
   It delegates to `FB_EVIDENCE`, which is the exported one.

   THE CLOCK IS LIVE. `FB_EVIDENCE` takes an injected `now` defaulting to the
   real clock; nothing here pins a date. Every figure moves with the calendar,
   which is the property that makes the demo's numbers real rather than
   fixtures — come back next week and the overdue list is different.

   WHAT IT WILL NOT DO: invent a figure for a collection this tenant has no
   evidence for. Receivables, payments and margin return `null`, never `0`.
   D-015 is the decision; `snapshot().receivables === null` is how it is kept.
   ========================================================================== */

(function () {
  "use strict";

  var DAY = 86400000;

  /* Where the records live. Relative to this file (v7/assets/), which is the
     only place that has to know — every caller asks FBContext instead. */
  var M = "../modules/foodbridge-customer-mockup/v3/screens/customers/";
  var OB = "../modules/foodbridge-onboarding/screens/";

  var SCRIPTS = [
    M + "order-history.js",      // window.FB_ORDER_HISTORY — the real 532 orders
    M + "seed.inline.js",        // window.SEED — 86 products, 40 shops
    M + "predictive-order.js",   // window.FB_PREDICT — the back-tested reorder engine
    OB + "evidence.js",          // window.FB_EVIDENCE — cadence, and the ONE status rule
  ];

  var loading = null;

  function loadOne(src) {
    return new Promise(function (res, rej) {
      var el = document.createElement("script");
      el.src = new URL(src, baseHref()).toString();
      el.onload = res;
      el.onerror = function () { rej(new Error("context: could not load " + src)); };
      document.head.appendChild(el);
    });
  }

  /* This file may be loaded from v7/screens/*.html or from a module folder, so
     resolve against THIS script's own URL rather than the page's. */
  function baseHref() {
    var self = document.querySelector('script[src*="assets/context.js"]');
    return self ? self.src : location.href;
  }

  function ready() {
    if (window.SEED && window.FB_ORDER_HISTORY && window.FB_EVIDENCE && window.FB_PREDICT) {
      return Promise.resolve(API);
    }
    if (loading) return loading;
    /* Sequential, not parallel: seed.inline.js and order-history.js are plain
       assignments, but evidence.js reads FB_PREDICT at call time and the
       predictor is the slowest of the four. Order is cheap insurance. */
    loading = SCRIPTS.reduce(function (p, src) {
      return p.then(function () { return loadOne(src); });
    }, Promise.resolve()).then(function () { return API; });
    return loading;
  }

  /* ── the records, in one shape ─────────────────────────────────────────── */

  function seed() { return window.SEED || {}; }
  function history() { return window.FB_ORDER_HISTORY || {}; }
  function nowTime() { return Date.now(); }

  function nameOf(c) { return (c.name && (c.name.en || c.name)) || c._id; }

  function customers() {
    return (seed().b2b || []).map(function (c) {
      return { id: c._id, name: nameOf(c) };
    });
  }

  function products() {
    return (seed().products || []).map(function (p) {
      return {
        id: p.id, name: p.name, sku: p.artNo, unit: p.unit,
        stockOnHand: typeof p.systemStock === "number" ? p.systemStock : null,
      };
    });
  }

  function customerName(id) {
    var c = (seed().b2b || []).filter(function (x) { return x._id === id; })[0];
    return c ? nameOf(c) : id;
  }

  /* THE single status rule. Not reimplemented — delegated. */
  function orderingStatusFor(customerId) {
    if (!window.FB_EVIDENCE) return { bucket: "unknown", label: "Unknown", orders: [] };
    return window.FB_EVIDENCE.orderingStatusFor(customerId, history(), nowTime());
  }

  /* Every shop the export knows, with its own cycle and where it sits in it. */
  function cadence() {
    return Object.keys(history()).map(function (id) {
      var st = orderingStatusFor(id);
      return {
        id: id, name: customerName(id),
        bucket: st.bucket, label: st.label,
        daysOverdue: st.daysOverdue,
        avgCycleDays: st.avgCycleDays,
        observedCycle: st.observedCycle,
        lastOrderAt: st.lastOrderAt,
        lastOrderValue: st.lastOrderValue,
        avgValue: st.avgValue,
        orderCount: (st.orders || []).length,
      };
    });
  }

  /* The shops past their own cycle, longest overdue first, each carrying what
     it would take to act — a suggested order where the history supports one,
     and what it used to buy where it does not.

     The stale ones are the MOST overdue, because a shop goes quiet before it
     goes cold (D-017). They are never counted among the suggestable ones and
     never shown a quantity. */
  function offCadence() {
    if (!window.FB_EVIDENCE) return { shops: [], suggestable: 0, stale: 0 };
    var r = window.FB_EVIDENCE.missedOrders({
      seed: seed(), history: history(),
      predict: window.FB_PREDICT, now: nowTime(),
    }) || {};
    var shops = r.shops || r.customers || [];
    var suggestable = shops.filter(function (s) { return s.suggestion && s.suggestion.count; }).length;
    return { shops: shops, suggestable: suggestable, stale: shops.length - suggestable, raw: r };
  }

  /* Products the tenant holds a stock figure for, and which of them are thin.
     `low` is deliberately conservative: only SKUs with a real number. */
  function stock() {
    var withCount = products().filter(function (p) { return typeof p.stockOnHand === "number"; });
    /* Thin and out are DISJOINT. Counting a zero as "thin" as well as "out"
       makes two nudges about the same 25 products, which reads as twice the
       problem and halves the trust in both. */
    var out = withCount.filter(function (p) { return p.stockOnHand === 0; });
    var low = withCount.filter(function (p) { return p.stockOnHand > 0 && p.stockOnHand <= 5; });
    return { counted: withCount.length, low: low, outOfStock: out, all: withCount };
  }

  /* ── the snapshot the tower renders ────────────────────────────────────── */
  /* Anything this tenant has no evidence for comes back null — NOT zero. A
     zero is a claim; null is the truth, and the tower draws nothing for it. */
  function snapshot() {
    var cad = cadence();
    var off = offCadence();
    var st = stock();
    var byBucket = function (b) { return cad.filter(function (c) { return c.bucket === b; }).length; };

    return {
      customers: customers().length,
      products: products().length,
      ordersKnown: cad.reduce(function (n, c) { return n + c.orderCount; }, 0),

      offCadence: off.shops.length,
      suggestable: off.suggestable,
      stale: off.stale,

      overdue: byBucket("overdue"),
      slipping: byBucket("slipping"),
      onTrack: byBucket("on_track"),
      unknown: byBucket("unknown"),

      stockCounted: st.counted,
      lowStock: st.low.length,
      outOfStock: st.outOfStock.length,

      /* D-015 — no invoice or payment evidence exists for this tenant. */
      receivables: null,
      overdueValue: null,
      capitalTied: null,
      margin: null,

      asOf: new Date(nowTime()).toISOString(),
    };
  }

  var API = {
    ready: ready,
    customers: customers,
    products: products,
    customerName: customerName,
    orderingStatusFor: orderingStatusFor,
    cadence: cadence,
    offCadence: offCadence,
    stock: stock,
    snapshot: snapshot,
    DAY: DAY,
  };

  window.FBContext = API;
})();

/* ==========================================================================
   CONTEXT — one reader over the business, for the Control Tower.

   A READER, NOT A SECOND BUSINESS LAYER. It loads the scripts that already
   hold the truth and hands them over, untouched, as CTState's raw input:

     the tenant's export       SEED + FB_ORDER_HISTORY (Zoho sales orders,
                               imported 27 Aug 2026 -- see order-history.js)
     the session's Dataset     sessionStorage fb.v7.flow → dataReady, when the
                               user imported their own records (or the labelled
                               sample) in onboarding. It wins when present:
                               the business on screen is the one they brought.
     the engines               FB_EVIDENCE (the ONE cadence rule, D-016),
                               FB_PREDICT (reorder drafts), FB_DATASET
                               (toEngine, the ONE engine shape), FB_SAMPLE.mrpOf

   What actions have written since (orders, purchase requests, reminders) is
   read by CTTower from its own store, not here.

   WHAT IT WILL NOT DO: invent a figure for a collection the business has no
   evidence for (D-015). Without a ledger there is no ledger -- CTState keeps
   it null, and the tower says what would unlock it.
   ========================================================================== */

(function () {
  "use strict";

  /* Relative to this file (v7/assets/). The only place that has to know. */
  var M = "../modules/foodbridge-customer-mockup/v3/screens/customers/";
  var OB = "../modules/foodbridge-onboarding/screens/";

  var SCRIPTS = [
    M + "order-history.js",      // window.FB_ORDER_HISTORY — the real 532 orders
    M + "seed.inline.js",        // window.SEED — 86 products, 40 shops
    M + "predictive-order.js",   // window.FB_PREDICT — the back-tested reorder engine
    OB + "evidence.js",          // window.FB_EVIDENCE — cadence, and the ONE status rule
    OB + "dataset.js",           // window.FB_DATASET — the Dataset contract, toEngine()
    OB + "sample-business.js",   // window.FB_SAMPLE — mrpOf(): the MRP printed in a name
  ];

  /* The export's own header states its import date; this is that date. */
  var EXPORT = { importedAt: "2026-08-27", label: "Your Zoho sales orders" };

  var loading = null;

  function loadOne(src, q) {
    return new Promise(function (res, rej) {
      var el = document.createElement("script");
      el.src = new URL(src + q, baseHref()).toString();
      el.onload = res;
      el.onerror = function () { rej(new Error("Could not load " + src.split("/").pop() + ".")); };
      document.head.appendChild(el);
    });
  }

  /* Resolve against THIS script's URL, and carry its cache-busting token. */
  function self() { return document.querySelector('script[src*="assets/context.js"]'); }
  function baseHref() { var s = self(); return s ? s.src : location.href; }
  function token() { var s = self(); return s && s.src.indexOf("?") !== -1 ? s.src.slice(s.src.indexOf("?")) : ""; }

  function ready() {
    if (window.SEED && window.FB_ORDER_HISTORY && window.FB_EVIDENCE && window.FB_PREDICT && window.FB_DATASET && window.FB_SAMPLE) {
      return Promise.resolve(API);
    }
    if (loading) return loading;
    var q = token();
    /* Sequential: evidence.js reads FB_PREDICT at call time, and a failed
       load should name the one file that failed. */
    loading = SCRIPTS.reduce(function (p, src) {
      return p.then(function () { return loadOne(src, q); });
    }, Promise.resolve()).then(function () { return API; }, function (e) { loading = null; throw e; });
    return loading;
  }

  function sessionDataReady() {
    try {
      var v = JSON.parse(sessionStorage.getItem("fb.v7.flow") || "null");
      return v && v.dataReady && v.dataReady.dataset ? v.dataReady : null;
    } catch (e) { return null; }
  }

  /* Who is looking: the account onboarding wrote, or a guest in this tab. */
  function account() {
    var raw = null;
    try { raw = sessionStorage.getItem("fb.v7.guest") || localStorage.getItem("fb.v7.account"); } catch (e) { /* storage off */ }
    try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  function raw() {
    return {
      seed: window.SEED || {},
      history: window.FB_ORDER_HISTORY || {},
      exportMeta: EXPORT,
      dataReady: sessionDataReady(),
      api: {
        evidence: window.FB_EVIDENCE,
        predict: window.FB_PREDICT,
        dataset: window.FB_DATASET,
        mrpOf: window.FB_SAMPLE && window.FB_SAMPLE.mrpOf,
      },
    };
  }

  var API = { ready: ready, raw: raw, account: account, sessionDataReady: sessionDataReady };
  window.FBContext = API;
})();

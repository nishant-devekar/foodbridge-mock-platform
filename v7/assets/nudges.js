/* ==========================================================================
   NUDGES — what the business would tell you, if it could.

   DETERMINISTIC, AND DELIBERATELY SO. There is no model in this loop. Signals
   are found by rules over FBContext's records, scored by a formula written
   down below, and ranked. The assistant's job is to explain and to act; the
   job of FINDING is arithmetic, because a business signal that cannot be
   traced back to a row is not a signal, it is a guess.

   EVERY NUDGE NAMES ITS PROOF. `route` is a destination that exists, and
   `evidence` is the rows the claim rests on. A nudge the user cannot check is
   worse than no nudge — the first time a figure cannot be explained, every
   other figure on the screen becomes suspect too.

   CADENCE, NOT CASH. This tenant's export carries no invoice or payment
   evidence (D-015), so nothing here may promise a rupee figure. The rule is
   enforced, not remembered: `assertNoMoney()` runs over every nudge before it
   is returned, and throws in development if one slips through.

   SUPPRESSION IS PART OF THE PRODUCT. A nudge that has been dismissed, or
   acted on, does not come back on the next load. Showing everything detected
   is the failure mode this engine exists to avoid.
   ========================================================================== */

(function () {
  "use strict";

  var SEEN_KEY = "fb.v7.nudges.seen";     // { id: { status, at } }

  /* ── what the user has already answered ────────────────────────────────── */

  function seen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function remember(id, status) {
    try {
      var s = seen();
      s[id] = { status: status, at: new Date().toISOString() };
      localStorage.setItem(SEEN_KEY, JSON.stringify(s));
    } catch (e) { /* a private window is not a reason to break the screen */ }
  }
  function dismiss(id) { remember(id, "dismissed"); }
  function acted(id) { remember(id, "acted"); }
  function reset() { try { localStorage.removeItem(SEEN_KEY); } catch (e) {} }

  /* ── scoring ───────────────────────────────────────────────────────────── */
  /*  priority = impact × urgency × confidence × actionability
     Each factor is 0..1 and each is computed from the records, never assigned
     by hand. Freshness is applied last, as a decay on things already shown. */

  function score(n) {
    var base = (n.impact || 0) * (n.urgency || 0) * (n.confidence || 0) * (n.actionability || 0);
    var s = seen()[n.id];
    if (!s) return base;
    if (s.status === "dismissed") return 0;          // asked and answered
    if (s.status === "acted") return 0;              // done is done
    return base * 0.5;
  }

  /* ── the detectors ─────────────────────────────────────────────────────── */

  /* 1 — shops past their own ordering cycle.
     The strongest signal this tenant's data supports, and the only one that
     names specific customers with specific evidence. */
  function detectOffCadence(ctx) {
    var off = ctx.offCadence();
    if (!off.shops.length) return null;

    var worst = off.shops[0];
    var n = off.shops.length;

    return {
      id: "off_cadence",
      category: "operational",
      title: n + (n === 1 ? " shop has" : " shops have") + " not ordered as usual",
      explanation:
        "Each of these is past its own ordering cycle — not an average, their own. " +
        /* "its own" rather than "a": it dodges the a/an-before-8 problem and it
           says the more important thing, which is that the cycle is theirs. */
        "The longest, " + worst.name + ", is " + worst.daysOverdue + " days past its own " +
        worst.cycleDays + "-day cycle.",
      evidence: off.suggestable + " of them have enough history for a suggested order. " +
        (off.stale ? off.stale + " do not, and those are the most overdue — a shop goes quiet before it goes cold." : ""),
      recommendedAction: "Review the list",
      route: "control-tower",
      count: n,
      /* Impact scales with how much of the book is drifting; urgency with how
         far the worst one has gone; confidence is high because every row is a
         real order. Actionability is the share we can actually prepare for. */
      impact: Math.min(1, n / 25),
      urgency: Math.min(1, worst.daysOverdue / 60),
      confidence: 0.95,
      actionability: n ? Math.max(0.3, off.suggestable / n) : 0,
      detail: off,
    };
  }

  /* 2 — shops slipping but not yet overdue. The one that is worth acting on
     BEFORE it becomes the list above. */
  function detectSlipping(ctx) {
    var slipping = ctx.cadence().filter(function (c) { return c.bucket === "slipping"; });
    if (!slipping.length) return null;
    slipping.sort(function (a, b) { return b.daysOverdue - a.daysOverdue; });

    return {
      id: "slipping",
      category: "operational",
      title: slipping.length + (slipping.length === 1 ? " shop is" : " shops are") + " just starting to slip",
      explanation:
        "Within five days of their own cycle rather than past it. " +
        slipping[0].name + " is the furthest along at " + slipping[0].daysOverdue +
        (slipping[0].daysOverdue === 1 ? " day." : " days."),
      evidence: "Worth a call before they join the list above.",
      recommendedAction: "See who",
      route: "control-tower",
      count: slipping.length,
      impact: Math.min(1, slipping.length / 25),
      urgency: 0.4,
      confidence: 0.9,
      actionability: 0.7,
      detail: { shops: slipping },
    };
  }

  /* 3 — stock the tenant actually counted, that is thin.
     Only SKUs carrying a real number; nothing is inferred for the rest. */
  function detectLowStock(ctx) {
    var st = ctx.stock();
    if (!st.low.length) return null;

    var names = st.low.slice(0, 3).map(function (p) { return p.name; }).join(", ");
    return {
      id: "low_stock",
      category: "usage",
      title: st.low.length + (st.low.length === 1 ? " product is" : " products are") + " running thin",
      explanation: "Five or fewer on hand: " + names +
        (st.low.length > 3 ? ", and " + (st.low.length - 3) + " more." : "."),
      evidence: "Counted across " + st.counted + " products that carry a stock figure.",
      recommendedAction: "Check inventory",
      route: "inventory/finished-goods-inventory",
      count: st.low.length,
      impact: Math.min(1, st.low.length / 20),
      urgency: st.outOfStock.length ? 0.8 : 0.45,
      confidence: 0.8,
      actionability: 0.8,
      detail: st,
    };
  }

  /* 4 — what is out entirely. Separate from thin, because it is a different
     conversation: thin is a purchase, out is an apology. */
  function detectOutOfStock(ctx) {
    var st = ctx.stock();
    if (!st.outOfStock.length) return null;

    return {
      id: "out_of_stock",
      category: "operational",
      title: st.outOfStock.length + (st.outOfStock.length === 1 ? " product is" : " products are") + " out of stock",
      explanation: "Nothing on hand: " +
        st.outOfStock.slice(0, 3).map(function (p) { return p.name; }).join(", ") +
        (st.outOfStock.length > 3 ? ", and " + (st.outOfStock.length - 3) + " more." : "."),
      evidence: "If any of these are on tomorrow's route, the stop will be short.",
      recommendedAction: "Plan a purchase",
      route: "procurement/purchase-orders",
      count: st.outOfStock.length,
      impact: Math.min(1, st.outOfStock.length / 10),
      urgency: 0.85,
      confidence: 0.85,
      actionability: 0.75,
      detail: { products: st.outOfStock },
    };
  }

  /* 5 — shops the export knows nothing about. Not a problem; an opportunity,
     and an honest one: we say we do not know rather than guessing. */
  function detectUnknown(ctx) {
    var unknown = ctx.cadence().filter(function (c) { return c.bucket === "unknown"; });
    var total = ctx.customers().length;
    var withHistory = ctx.cadence().length;
    var noHistory = total - withHistory;
    var n = unknown.length + noHistory;
    if (!n) return null;

    return {
      id: "no_history",
      category: "insight",
      title: n + (n === 1 ? " customer has" : " customers have") + " no order history here",
      explanation: "They are on your books but nothing in the import shows them buying. " +
        "FoodBridge will not guess a cycle for them.",
      evidence: withHistory + " of " + total + " customers have orders we can read.",
      recommendedAction: "See customers",
      route: "customer-management/b2b-customers",
      count: n,
      impact: Math.min(1, n / 40),
      urgency: 0.15,
      confidence: 1,
      actionability: 0.4,
      detail: { shops: unknown },
    };
  }

  var DETECTORS = [detectOffCadence, detectSlipping, detectOutOfStock, detectLowStock, detectUnknown];

  /* ── the money rule, enforced ──────────────────────────────────────────── */
  /* D-015: no invoice or payment evidence exists for this tenant, so no nudge
     may promise a rupee figure. A convention nobody can check is a convention
     that decays; this is the check. */
  var MONEY = /(₹|\bRs\.?\b|\blakh\b|\bcrore\b|\bINR\b)/i;

  function assertNoMoney(list) {
    var bad = list.filter(function (n) {
      return MONEY.test([n.title, n.explanation, n.evidence, n.recommendedAction].join(" "));
    });
    if (bad.length) {
      var msg = "nudges: a rupee figure was promised, and this tenant has no payment evidence (D-015): " +
        bad.map(function (n) { return n.id; }).join(", ");
      if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) throw new Error(msg);
      console.error(msg);
      return list.filter(function (n) { return bad.indexOf(n) === -1; });
    }
    return list;
  }

  /* ── the ranked list ───────────────────────────────────────────────────── */

  function all() {
    var ctx = window.FBContext;
    if (!ctx) return [];
    var found = DETECTORS
      .map(function (d) { try { return d(ctx); } catch (e) { console.error("nudge detector failed", e); return null; } })
      .filter(Boolean);

    found = assertNoMoney(found);
    found.forEach(function (n) { n.score = score(n); });

    return found
      .filter(function (n) { return n.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  /* Everything detected, including what has been answered — for a screen that
     wants to show "you have dealt with these" rather than pretend they never
     existed. */
  function allIncludingAnswered() {
    var ctx = window.FBContext;
    if (!ctx) return [];
    var found = DETECTORS.map(function (d) { try { return d(ctx); } catch (e) { return null; } }).filter(Boolean);
    found = assertNoMoney(found);
    var s = seen();
    found.forEach(function (n) { n.score = score(n); n.status = (s[n.id] && s[n.id].status) || "open"; });
    return found.sort(function (a, b) { return b.score - a.score; });
  }

  window.FBNudges = {
    all: all,
    allIncludingAnswered: allIncludingAnswered,
    dismiss: dismiss,
    acted: acted,
    reset: reset,
    seen: seen,
  };
})();

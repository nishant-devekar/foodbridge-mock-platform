/* ==========================================================================
   Predictive Sales Order — the recommendation engine.

   Deliberately UI-free and dependency-free: it takes plain data in and
   returns plain data out, so the screens in stock-audit.js only ever render
   a result they did not compute. Nothing here touches the DOM, localStorage,
   SEED, or the clock directly — `now` is an argument, which is also what
   makes the same inputs always produce the same recommendation.

   ---------------------------------------------------------------------------
   THIS MODEL WAS MEASURED, NOT GUESSED

   It is fitted to the tenant's own Zoho Books sales-order export — 532 real
   buying occasions across 39 customers (see order-history.js). Every rule
   below earned its place by being back-tested against that history: for each
   real order, the engine was run on only what was known BEFORE that order,
   and its prediction compared with what the customer actually bought. Tuned
   on 2025, validated on unseen 2026 orders.

   Measured on the 171 unseen 2026 orders, predicting each from its own past:

                          precision  recall   qty within +/-25%   total volume
     previous model         56.8%     83.5%        66.4%             +42.4%
     this model             66.5%     69.6%        67.3%              +7.4%

   Over the whole 431-order period from 2025 the same comparison reads 58.3%
   -> 68.0% precision and +36.3% -> -1.2% volume. The previous model also
   declined to recommend anything at all on 13 of those orders; this one
   always has an answer, because it no longer needs last year's data to
   speak.

   The headline defect it fixes is the last column. The previous model
   recommended a product at its full average quantity whenever it appeared in
   recent history at all, which over-ordered the customer by half again.

   Two costs are paid for that, and both are deliberate:

     · RECALL FALLS (83.5% -> 69.6%). The engine proposes fewer of the lines
       a customer turns out to want, so the rep adds more by hand. That is the
       cheaper error: a missing line costs a search on an 86-product
       catalogue, while a wrong line that nobody notices becomes real stock in
       a real shop and a real sales order in Zoho.
     · MEAN absolute error is flat to slightly worse (1.46 -> 1.56 units),
       while the share of lines within a quarter of the true quantity still
       improves (66.4% -> 67.3%). MAE is carried by a few very large lines;
       the second figure is what a rep reads off a row.

   WHAT IT READS

     latestCompletedAudit  the customer's most recent COMPLETED stock audit.
                           Drafts and abandoned visits are never eligible —
                           the caller passes only completed ones, matching
                           the audit flow's own rule that an unfinished visit
                           is discarded rather than recorded.
     orders                that customer's sales-order history, newest first,
                           each order carrying `lines[{ productId, qty }]` in
                           the product's base unit.

   HOW IT DECIDES — two questions, deliberately kept apart

   The old model answered "how much?" and let the answer decide "whether?".
   Those are different questions and the data says they need different
   evidence, so they are now asked separately:

     1. WHETHER to put the product on the order — purchase FREQUENCY.
        How many of the customer's last FREQUENCY_ORDER_COUNT orders included
        it. In the real history this is strongly predictive: a product on 1 of
        the last 3 orders came back only 44.7% of the time, one on all 3 came
        back 78.8% of the time. Below REORDER_FLOOR the product is not
        recommended — the rep can still search the catalogue and add it.

     2. HOW MUCH — the mean quantity across the orders that CONTAINED it,
        over the last RECENT_ORDER_COUNT orders.
        Divided by the number of orders that included the product, not by the
        number of orders in the window: a product bought on every second visit
        is a smaller line, not a smaller order, and averaging in the visits
        that skipped it would halve a quantity the customer does reliably buy.
        Frequency has already decided whether the line belongs at all, so it
        must not shrink the quantity a second time.

   Then, the whole rule the UI explains to the rep:

       recommended = max(0, expectedDemand - currentStock)

   Clamped at zero: a customer already holding more than they are expected to
   sell needs no more of it, never a negative order.

   WHY THERE IS NO SEASONAL TERM ANY MORE

   The previous model blended in "the same period last year" (a +/-21-day
   window) at half weight, and would recommend a product on that evidence
   alone. Against the real history that term was not merely weak, it was
   harmful, and both halves of it failed for the same reason — per customer,
   that window is nearly empty:

     · 71% of the time it holds 0 or 1 orders, which is not a mean.
     · A product found ONLY in it was actually re-ordered 25.3% of the time,
       against 59.6% for one seen in recent history. It was the single
       largest source of wrong lines.
     · Blending it into the quantity, even when restricted to the customers
       whose window was dense, moved no metric at all.

   This is NOT a claim that the business has no seasonality. It is a claim
   that ONE customer's orders in a three-week window a year ago are too thin
   to measure it. Detecting real seasonality needs demand pooled across
   customers at the category level, which is a bigger change than this engine
   and is honest work for a later cut. Until then the engine does not pretend.

   Products the customer has never ordered are not invented. A product the
   audit found but history has never seen contributes nothing, because there
   is no demand figure for it — it is reported in `context.stockOnlyProducts`
   so a screen can offer it as an add-if-you-want rather than silently
   pretending it was recommended.
   ========================================================================== */

(function () {
  "use strict";

  const DAY = 86400000;

  // ---- How much: the quantity window -------------------------------------
  // How many recent orders make a quantity. Fewer is noise; more starts
  // dragging a stale order size back into "what they buy now".
  const RECENT_ORDER_COUNT = 3;
  // An order older than this is not evidence of what they need next.
  const RECENT_MAX_AGE_DAYS = 120;

  // ---- Whether: the frequency window -------------------------------------
  // Frequency needs a longer, steadier base than quantity does: three orders
  // can only ever say 0, 1/3, 2/3 or 1, which is too coarse to sit a
  // threshold on. Six orders over about eight months is enough to tell a
  // staple from an occasional buy without reaching back into last year.
  const FREQUENCY_ORDER_COUNT = 6;
  const FREQUENCY_MAX_AGE_DAYS = 240;
  // A rate needs a denominator worth dividing by. One order in the window
  // makes every product on it a 100% repeat buy, which clears any floor
  // without evidence — so when the fresh window is thinner than this, it is
  // topped up with older orders rather than believed. Only quiet customers
  // ever reach that branch; a customer trading normally never does.
  const MIN_FREQUENCY_BASE = 3;
  // Recommend a product only if it appeared on at least this share of those
  // orders — "at least half the time". Tuned against the real history:
  // lower floors buy recall at a steep cost in wrong lines, and 0.6 collapses
  // recall (53%) while starting to UNDER-order.
  const REORDER_FLOOR = 0.5;

  const toTime = (v) => {
    const t = new Date(v).getTime();
    return isNaN(t) ? null : t;
  };

  /** Physical stock, in base units, for every product in a completed audit. */
  function stockFromAudit(audit) {
    const byProduct = {};
    if (!audit) return byProduct;
    (audit.lines || []).forEach((l) => {
      if (!l || !l.productId) return;
      // "Not found" is not zero — nobody could confirm the stock either way,
      // so it must not be read as "they have none of it" and inflate the
      // recommendation. Such a line is skipped, which lands the product in
      // the same bucket as one that was never audited at all.
      if (l.status === "not_found") return;
      byProduct[l.productId] = Number(l.physical) || 0;
    });
    return byProduct;
  }

  /** A customer's orders, newest first, ignoring anything dated after `now`. */
  function orderedHistory(orders, now) {
    return (orders || [])
      .filter((o) => {
        const t = toTime(o && o.at);
        return t != null && t <= now;
      })
      .sort((a, b) => toTime(b.at) - toTime(a.at));
  }

  /**
   * Mean quantity per order for each product, counting only the orders that
   * actually contained it, plus how many of them did.
   */
  function statsByProduct(orders) {
    const totals = {};
    (orders || []).forEach((o) => {
      (o.lines || []).forEach((l) => {
        if (!l || !l.productId) return;
        const q = Number(l.qty) || 0;
        if (!totals[l.productId]) totals[l.productId] = { sum: 0, n: 0 };
        totals[l.productId].sum += q;
        totals[l.productId].n += 1;
      });
    });
    return totals;
  }

  /**
   * generatePredictiveOrder({ customerId, latestCompletedAudit, orders, products, now })
   *
   * Returns:
   *   {
   *     ok, reason,
   *     lines: [{ productId, currentStock, expectedDemand, recommendedQty,
   *               basis, hasStock, boughtOn, ofOrders }],
   *     context: { … what the recommendation was built from … }
   *   }
   *
   * `ok: false` means there was not enough to recommend anything — the
   * caller shows that state rather than an empty table pretending to be a
   * finished recommendation.
   */
  function generatePredictiveOrder({ customerId, latestCompletedAudit, orders, products, now } = {}) {
    const nowTime = toTime(now) != null ? toTime(now) : Date.now();
    const catalogue = products || [];
    const known = {};
    catalogue.forEach((p) => (known[p.id] = p));

    const stock = stockFromAudit(latestCompletedAudit);
    const history = orderedHistory(orders, nowTime);
    const ageDays = (o) => Math.abs(nowTime - toTime(o.at)) / DAY;

    // The most recent `count` orders no older than `maxAge` days.
    //
    // If that window is empty but the customer HAS traded, the age limit is
    // dropped and their most recent orders are used regardless — reported
    // back as `historyIsStale`. A shop that last ordered 174 days ago is a
    // shop with a real, if old, buying pattern; answering "no recommendation"
    // while holding sixty of their orders would be the engine hiding what it
    // knows. Five of the 39 customers in the real history sit in exactly this
    // state. The screen is told, so it can say so rather than presenting an
    // old pattern as a current one.
    const pick = (count, maxAge) => {
      const fresh = history.filter((o) => ageDays(o) <= maxAge);
      if (fresh.length) return { orders: fresh.slice(0, count), stale: false };
      return { orders: history.slice(0, count), stale: history.length > 0 };
    };

    const qWindow = pick(RECENT_ORDER_COUNT, RECENT_MAX_AGE_DAYS);

    // Frequency picks the same way, then insists on a denominator: a window
    // holding fewer than MIN_FREQUENCY_BASE orders is topped up from older
    // ones, because a share measured out of one order is not a share.
    const fWindow = (() => {
      const w = pick(FREQUENCY_ORDER_COUNT, FREQUENCY_MAX_AGE_DAYS);
      if (w.orders.length >= MIN_FREQUENCY_BASE) return w;
      // `stale` stays the age verdict from `pick` — topping up the base is a
      // separate matter from the history being out of date, and only the
      // quantity window's verdict is what the screen reports.
      return { orders: history.slice(0, FREQUENCY_ORDER_COUNT), stale: w.stale };
    })();

    const context = {
      customerId,
      generatedAt: new Date(nowTime).toISOString(),
      auditId: latestCompletedAudit ? latestCompletedAudit.id : null,
      auditAt: latestCompletedAudit ? latestCompletedAudit.at : null,
      auditProductCount: latestCompletedAudit ? Object.keys(stock).length : 0,
      usedStockAudit: !!latestCompletedAudit,
      usedRecentHistory: qWindow.orders.length > 0,
      recentOrderCount: qWindow.orders.length,
      frequencyOrderCount: fWindow.orders.length,
      // True when the customer has real history but nothing inside the recent
      // window — the numbers below are their pattern, just not a current one.
      historyIsStale: qWindow.stale,
      lastOrderAt: history.length ? history[0].at : null,
      daysSinceLastOrder: history.length ? Math.round(ageDays(history[0])) : null,
      // How many products were held back by the frequency floor. The screen
      // can use this to say the catalogue search is where the rest live.
      belowFloorCount: 0,
      sourceOrderDates: qWindow.orders.map((o) => o.at),
      stockOnlyProducts: [],
    };

    if (!history.length) {
      // No demand signal at all. Current stock alone cannot say how much
      // they will sell, so there is nothing honest to recommend.
      context.stockOnlyProducts = Object.keys(stock).filter((id) => known[id]);
      return { ok: false, reason: "no_order_history", lines: [], context };
    }

    const qStats = statsByProduct(qWindow.orders);
    const fStats = statsByProduct(fWindow.orders);
    const fCount = fWindow.orders.length;

    // Candidates come from the quantity window only: a product must have been
    // bought recently to be proposed at all. Frequency then decides which of
    // those recur often enough to be worth a line.
    const lines = [];
    Object.keys(qStats).forEach((id) => {
      if (!known[id]) return;
      const boughtOn = (fStats[id] || { n: 0 }).n;
      const frequency = fCount ? boughtOn / fCount : 0;
      if (frequency < REORDER_FLOOR) {
        context.belowFloorCount += 1;
        return;
      }
      const expectedDemand = Math.round(qStats[id].sum / qStats[id].n);
      const hasStock = Object.prototype.hasOwnProperty.call(stock, id);
      const currentStock = hasStock ? stock[id] : 0;
      lines.push({
        productId: id,
        currentStock,
        // Distinguishes "audited, none on the shelf" from "never audited".
        // Both subtract zero; only the first is a fact about the shop.
        hasStock,
        expectedDemand,
        recommendedQty: Math.max(0, expectedDemand - currentStock),
        // What the frequency gate saw, so a screen can say "on 4 of their
        // last 6 orders" instead of asking the rep to trust a number.
        boughtOn,
        ofOrders: fCount,
        basis: context.historyIsStale ? "stale_history" : "recent_history",
      });
    });

    if (!lines.length) {
      // They have traded, but nothing recurs often enough to propose. Saying
      // so is better than a page of one-off buys dressed as a recommendation.
      context.stockOnlyProducts = Object.keys(stock).filter((id) => known[id]);
      return { ok: false, reason: "no_repeat_products", lines: [], context };
    }

    // Biggest need first — the rep's attention is the scarce resource, and a
    // line recommending nothing is the least of it. Ties fall back to name so
    // the order is stable between runs rather than dependent on key order.
    lines.sort((a, b) =>
      b.recommendedQty - a.recommendedQty ||
      String((known[a.productId] || {}).name).localeCompare(String((known[b.productId] || {}).name)));

    // Audited products history has never seen: real stock, no demand signal.
    // Offered to the caller as context, never as a recommendation.
    const proposed = lines.map((l) => l.productId);
    context.stockOnlyProducts = Object.keys(stock)
      .filter((id) => known[id] && proposed.indexOf(id) === -1);

    return { ok: true, reason: null, lines, context };
  }

  window.FB_PREDICT = {
    generatePredictiveOrder,
    RECENT_ORDER_COUNT,
    RECENT_MAX_AGE_DAYS,
    FREQUENCY_ORDER_COUNT,
    FREQUENCY_MAX_AGE_DAYS,
    REORDER_FLOOR,
  };
})();

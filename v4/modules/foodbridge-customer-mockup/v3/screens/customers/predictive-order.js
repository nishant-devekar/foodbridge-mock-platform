/* ==========================================================================
   Predictive Sales Order — the recommendation engine.

   Deliberately UI-free and dependency-free: it takes plain data in and
   returns plain data out, so the screens in stock-audit.js only ever render
   a result they did not compute. Nothing here touches the DOM, localStorage,
   SEED, or the clock directly — `now` is an argument, which is also what
   makes the same inputs always produce the same recommendation.

   WHAT IT READS

     latestCompletedAudit  the customer's most recent COMPLETED stock audit.
                           Drafts and abandoned visits are never eligible —
                           the caller passes only completed ones, matching
                           the audit flow's own rule that an unfinished visit
                           is discarded rather than recorded.
     orders                that customer's sales-order history, newest first,
                           each order carrying `lines[{ productId, qty }]` in
                           the product's base unit (SEED.orderingSignals).

   HOW IT DECIDES

   Expected demand per product blends two honest signals, because either one
   alone misleads:

     • the SAME PERIOD LAST YEAR (a ±LOOKBACK_WINDOW_DAYS window around
       today's date, one year back) — the seasonal baseline. On its own it
       ignores a customer who has since grown or shrunk.
     • the RECENT TREND (mean qty per order across the last
       RECENT_ORDER_COUNT orders) — what they buy now. On its own it has no
       idea that a festival month is coming.

   Where both exist, they are blended (SEASONAL_WEIGHT / the rest); where
   only one exists, that one is used and the result says so per line. The
   recommendation is then simply

       recommended = max(0, round(expectedDemand) - currentStock)

   which is the whole rule the UI explains to the rep. Clamped at zero: a
   customer already holding more than they are expected to sell needs no
   more of it, never a negative order.

   Products the customer has never ordered are not invented. A product the
   audit found but history has never seen contributes nothing, because there
   is no demand figure for it — it is reported in `context.stockOnlyProducts`
   so a screen can offer it as an add-if-you-want rather than silently
   pretending it was recommended.
   ========================================================================== */

(function () {
  "use strict";

  const DAY = 86400000;
  // How far either side of "this date, last year" still counts as the same
  // trading period. Three weeks is wide enough to catch an order that landed
  // a fortnight early and narrow enough that a different season never does.
  const LOOKBACK_WINDOW_DAYS = 21;
  // How many recent orders make a trend. Fewer is noise; more starts
  // dragging last season back into "recent".
  const RECENT_ORDER_COUNT = 3;
  // An order older than this is neither "recent" nor "same period last year".
  const RECENT_MAX_AGE_DAYS = 120;
  // How much of expected demand comes from last year's same period when both
  // signals are available. The recent trend carries the remainder.
  const SEASONAL_WEIGHT = 0.5;

  const toTime = (v) => {
    const t = new Date(v).getTime();
    return isNaN(t) ? null : t;
  };
  const daysBetween = (a, b) => Math.abs(a - b) / DAY;

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

  /**
   * Split a customer's order history into the two windows the blend needs.
   * Orders are matched on their own dates — never "the Nth order back" —
   * so a customer who skipped a season doesn't get an unrelated order
   * promoted into the seasonal slot.
   */
  function partitionOrders(orders, now) {
    const lastYear = new Date(now);
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    const lastYearTime = lastYear.getTime();

    const samePeriod = [];
    const recent = [];
    (orders || []).forEach((o) => {
      const t = toTime(o && o.at);
      if (t == null) return;
      if (daysBetween(t, lastYearTime) <= LOOKBACK_WINDOW_DAYS) samePeriod.push(o);
      else if (t <= now && daysBetween(t, now) <= RECENT_MAX_AGE_DAYS) recent.push(o);
    });
    recent.sort((a, b) => toTime(b.at) - toTime(a.at));
    return { samePeriod, recent: recent.slice(0, RECENT_ORDER_COUNT) };
  }

  /** Mean quantity per order for each product across a set of orders. */
  function meanQtyByProduct(orders) {
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
    const mean = {};
    // Divided by the number of orders that INCLUDED the product, not by the
    // number of orders in the window: a product bought on every second visit
    // is a smaller line, not a smaller order, and averaging in the visits
    // that skipped it would halve a quantity the customer does reliably buy.
    Object.keys(totals).forEach((id) => { mean[id] = totals[id].sum / totals[id].n; });
    return mean;
  }

  /**
   * generatePredictiveOrder({ customerId, latestCompletedAudit, orders, products, now })
   *
   * Returns:
   *   {
   *     ok, reason,
   *     lines: [{ productId, currentStock, expectedDemand, recommendedQty,
   *               basis, hasStock }],
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
    const { samePeriod, recent } = partitionOrders(orders, nowTime);

    const context = {
      customerId,
      generatedAt: new Date(nowTime).toISOString(),
      auditId: latestCompletedAudit ? latestCompletedAudit.id : null,
      auditAt: latestCompletedAudit ? latestCompletedAudit.at : null,
      auditProductCount: latestCompletedAudit ? Object.keys(stock).length : 0,
      usedStockAudit: !!latestCompletedAudit,
      usedSamePeriodLastYear: samePeriod.length > 0,
      usedRecentHistory: recent.length > 0,
      samePeriodOrderCount: samePeriod.length,
      recentOrderCount: recent.length,
      sourceOrderDates: samePeriod.concat(recent).map((o) => o.at),
      stockOnlyProducts: [],
    };

    if (!samePeriod.length && !recent.length) {
      // No demand signal at all. Current stock alone cannot say how much
      // they will sell, so there is nothing honest to recommend.
      context.stockOnlyProducts = Object.keys(stock).filter((id) => known[id]);
      return { ok: false, reason: "no_order_history", lines: [], context };
    }

    const seasonalMean = meanQtyByProduct(samePeriod);
    const recentMean = meanQtyByProduct(recent);

    const productIds = Object.keys(seasonalMean)
      .concat(Object.keys(recentMean))
      .filter((id, i, all) => all.indexOf(id) === i && known[id]);

    const lines = productIds.map((id) => {
      const s = seasonalMean[id];
      const r = recentMean[id];
      let expected;
      let basis;
      if (s != null && r != null) {
        expected = s * SEASONAL_WEIGHT + r * (1 - SEASONAL_WEIGHT);
        basis = "seasonal_and_recent";
      } else if (s != null) {
        expected = s;
        basis = "seasonal_only";
      } else {
        expected = r;
        basis = "recent_only";
      }
      const hasStock = Object.prototype.hasOwnProperty.call(stock, id);
      const currentStock = hasStock ? stock[id] : 0;
      const expectedDemand = Math.round(expected);
      return {
        productId: id,
        currentStock,
        // Distinguishes "audited, none on the shelf" from "never audited".
        // Both subtract zero; only the first is a fact about the shop.
        hasStock,
        expectedDemand,
        recommendedQty: Math.max(0, expectedDemand - currentStock),
        basis,
      };
    });

    // Biggest need first — the rep's attention is the scarce resource, and a
    // line recommending nothing is the least of it. Ties fall back to name so
    // the order is stable between runs rather than dependent on key order.
    lines.sort((a, b) =>
      b.recommendedQty - a.recommendedQty ||
      String((known[a.productId] || {}).name).localeCompare(String((known[b.productId] || {}).name)));

    // Audited products history has never seen: real stock, no demand signal.
    // Offered to the caller as context, never as a recommendation.
    context.stockOnlyProducts = Object.keys(stock)
      .filter((id) => known[id] && productIds.indexOf(id) === -1);

    return { ok: true, reason: null, lines, context };
  }

  window.FB_PREDICT = { generatePredictiveOrder, LOOKBACK_WINDOW_DAYS, SEASONAL_WEIGHT };
})();

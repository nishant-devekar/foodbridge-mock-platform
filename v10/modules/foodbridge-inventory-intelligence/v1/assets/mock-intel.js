/* ============================================================================
   mock-intel.js — the Inventory Intelligence experience (addendum-004)

   Implements the frozen model in addendum-003. Reads seed-intelligence.json,
   which keeps real figures and mock ones apart; every number this file puts on
   screen carries its basis, because the two foundations of the model — dated
   demand and run rate — have no source today (model §9).

   One app, six views. Overview is the workspace; the rest are drill-downs
   reached from it. The horizon is page state: change it and every derived
   figure recomputes. Nothing here paginates the attention queue.

   Vanilla JS, Tailwind classes only, no build step. window.prompt is unusable
   because these screens are iframed by the mock platform, so anything that
   would need one uses an inline control instead.
   ============================================================================ */
(function () {
  "use strict";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const icon = (n, cls) => (window.MockIcons && window.MockIcons.has(n)
    ? window.MockIcons.get(n, cls) : "");

  /* ---- money. Indian grouping, and lakhs once it stops being readable ---- */
  const rs = (n) => "₹" + Math.round(n).toLocaleString("en-IN");
  const rsShort = (n) => {
    const v = Math.abs(n);
    if (v >= 1e5) return "₹" + (n / 1e5).toFixed(v >= 1e6 ? 0 : 2).replace(/\.00$/, "") + " L";
    if (v >= 1e3) return "₹" + (n / 1e3).toFixed(v >= 1e4 ? 0 : 1).replace(/\.0$/, "") + "K";
    return rs(n);
  };
  const qty = (n) => Number(n || 0).toLocaleString("en-IN");
  const signed = (n) => (n > 0 ? "+" : "") + qty(n);

  /* ================= state ================= */
  const S = {
    seed: null,
    horizon: 1,            // days. Tomorrow — the horizon an operator actually acts on
    view: "today",
    filter: null,          // class key, or an overlay key
    search: "",
    page: 1,
    open: null,            // SKU id whose drawer is open
    // demand signals live in signalRepo, not here — they are a business entity
    capture: null,         // { productId } while capturing a signal
    candidate: null,       // opportunity key being handed to Purchase
    openOpp: null,         // opportunity key whose evidence is expanded
    groupBy: "category",   // capital concentration lens: category|brand|supplier|sku
    openGroup: null,       // expanded capital group
    lookup: "products",    // reference mode: products | batches
    buyState: "excess",    // which buying decision is expanded
    problem: null,         // which problem group is shown
    toast: null,
    loading: true,
  };
  const PAGE = 12;

  /* ================= the model ================= */

  /* Sellable(Dn) counts only batch-traced stock whose expiry supports the
     horizon (model §2.2). Untraced stock is NOT counted here and is NOT thereby
     unavailable — it is carried separately as `unverified` and shown beside every
     figure this feeds (addendum-005 D-INT-4). */
  const sellable = (p, dn) => p.batches.reduce((a, b) => a + (b.expiryInDays >= dn ? b.qty : 0), 0);
  const expiringBefore = (p, dn) =>
    p.batches.reduce((a, b) => a + (b.expiryInDays >= 0 && b.expiryInDays < dn ? b.qty : 0), 0);
  const expiredQty = (p) => p.batches.reduce((a, b) => a + (b.expiryInDays < 0 ? b.qty : 0), 0);
  const valueOf = (p, pred) =>
    p.batches.reduce((a, b) => a + ((pred ? pred(b) : true) ? b.qty * b.cost : 0), 0);

  /* Demand is the sum of open order lines by promised delivery date — derived,
     never invented per SKU. */
  const demand = (p, dn) => p.demandByDay.slice(0, dn + 1).reduce((a, b) => a + b, 0);
  /* Incoming stock has a shelf life too. A 4-day bread arriving D+1 expires on
     D+5 and cannot answer demand at D+7, so counting it there would make the
     projection optimistic exactly where freshness matters most. Eligible means
     it has LANDED by the horizon and has not expired by it (addendum-014).
     Receipt-dated shelf life is the best available assumption — the PO carries
     no batch expiry, and the alternative is to assume it never expires. */
  const incomingLot = (p, i, dn) =>
    i.etaInDays <= dn && i.etaInDays + (p.shelfLifeDays || Infinity) >= dn;
  const incomingBy = (p, dn) =>
    (p.incoming || []).reduce((a, i) => a + (incomingLot(p, i, dn) ? i.qty : 0), 0);

  const DIM = {
    availability: {
      short:    { label: "Short",            tone: "red" },
      pending:  { label: "Short until PO",   tone: "amber" },
      covered:  { label: "Covered",          tone: "green" },
    },
    velocity: {
      growing:   { label: "Velocity growing",   tone: "green" },
      stable:    { label: "Stable",             tone: "slate" },
      declining: { label: "Velocity declining", tone: "violet" },
      none:      { label: "No movement",        tone: "slate" },
    },
    position: {
      understock: { label: "Understocked", tone: "amber" },
      healthy:    { label: "Healthy",      tone: "green" },
      overstock:  { label: "Overstock",    tone: "violet" },
    },
  };
  const TONE = {
    red:    { chip: "bg-red-50 text-red-700 ring-red-200",             dot: "bg-red-500",     text: "text-red-600",     bar: "border-l-red-400" },
    amber:  { chip: "bg-amber-50 text-amber-700 ring-amber-200",       dot: "bg-amber-500",   text: "text-amber-600",   bar: "border-l-amber-300" },
    violet: { chip: "bg-violet-50 text-violet-700 ring-violet-200",    dot: "bg-violet-500",  text: "text-violet-600",  bar: "border-l-violet-300" },
    slate:  { chip: "bg-gray-100 text-gray-600 ring-gray-200",         dot: "bg-gray-400",    text: "text-gray-500",    bar: "border-l-gray-300" },
    green:  { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", text: "text-emerald-600", bar: "border-l-emerald-400" },
  };
  /* Risk and uncertainty are different things and must not share a bucket or a
     colour (addendum-007 §5). The first four are RISK — something is wrong and
     the amount is known. `unverified` is UNCERTAINTY — nothing is known to be
     wrong; there is not enough evidence to say either way. */
  const CAPITAL = {
    expired:    { label: "Expired, awaiting disposition", tone: "red",    risk: true },
    expiring:   { label: "Expiring inside horizon",       tone: "amber",  risk: true },
    overstock:  { label: "Above target",                  tone: "violet", risk: true },
    declining:  { label: "Declining velocity",            tone: "slate",  risk: true },
    healthy:    { label: "Working stock",                 tone: "green",  risk: false },
    unverified: { label: "Unverified",                    tone: "slate",  risk: false, uncertain: true },
  };

  function derive(p, dn) {
    const verified = sellable(p, dn);
    const unverified = p.untraced;
    const dem = demand(p, dn);
    const incoming = incomingBy(p, dn);
    const shortBefore = Math.max(0, dem - verified);
    const shortAfter = Math.max(0, dem - verified - incoming);

    const rr30 = p.sales.d30, rr90 = p.sales.d90, rr7 = p.sales.d7;
    const doh = rr30 > 0 ? verified / rr30 : null;
    const value = valueOf(p);
    const unverifiedValue = p.unitCost == null ? null : unverified * p.unitCost;
    const expiring = expiringBefore(p, dn);
    const expired = expiredQty(p);

    /* availability — after any confirmed receipt landing inside the horizon */
    const availability = shortAfter > 0 ? "short" : shortBefore > 0 ? "pending" : "covered";

    /* velocity TREND only. Whether a SKU is inherently low-velocity needs a
       category benchmark that does not exist, so nothing here claims it
       (addendum-006 D-INT-6). "Declining" is a statement about this SKU against
       its own 90-day normal, which is all the data supports. */
    let velocity = "stable";
    if (rr30 === 0 && p.physical > 0) velocity = "none";
    else if (rr90 > 0) {
      const r = rr30 / rr90;
      velocity = r < 0.92 ? "declining" : r > 1.08 ? "growing" : "stable";
    }

    /* stock position against the prototype target policy — no invented threshold */
    const ratio = p.targetStock > 0 ? verified / p.targetStock : null;
    const position = ratio == null ? "healthy"
      : ratio > S.seed.policy.overstockAt ? "overstock"
      : ratio < S.seed.policy.understockAt ? "understock" : "healthy";

    const overlays = [];
    if (p.isKVI) overlays.push("kvi");
    if (expired > 0) overlays.push("expired");
    else if (expiring > 0) overlays.push("nearexpiry");

    let failDay = null;
    if (shortBefore > 0) {
      for (let d = 0; d <= dn; d++) {
        if (demand(p, d) > sellable(p, d) + incomingBy(p, d)) { failDay = d; break; }
      }
      if (failDay == null) for (let d = 0; d <= dn; d++) {
        if (demand(p, d) > sellable(p, d)) { failDay = d; break; }
      }
    }

    /* which regular customers are exposed inside the horizon */
    const customers = [...new Set((p.demandOrders || [])
      .filter((o) => o.promisedInDays <= dn).map((o) => o.customer))];

    /* capital, exclusive by unit, in a fixed precedence so it totals once */
    const cap = { expired: 0, expiring: 0, unverified: 0, overstock: 0, declining: 0, healthy: 0 };
    cap.expired = valueOf(p, (b) => b.expiryInDays < 0);
    cap.expiring = valueOf(p, (b) => b.expiryInDays >= 0 && b.expiryInDays < dn);
    cap.unverified = unverifiedValue || 0;
    let rest = value - cap.expired - cap.expiring;
    const excessUnits = Math.max(0, verified - p.targetStock);
    if (position === "overstock" && p.unitCost != null) {
      cap.overstock = Math.min(rest, excessUnits * p.unitCost);
      rest -= cap.overstock;
    }
    if (velocity === "declining" || velocity === "none") { cap.declining = rest; rest = 0; }
    cap.healthy = rest;

    const severity =
      (availability === "short" && p.isKVI) ? 1 :
      availability === "short" ? 2 :
      availability === "pending" ? 3 :
      expired > 0 || expiring > 0 ? 4 :
      position === "understock" ? 5 :
      (position === "overstock" && velocity === "declining") ? 6 :
      position === "overstock" ? 7 :
      velocity === "declining" || velocity === "none" ? 8 : 9;

    /* ---- capital productivity (addendum-013) --------------------------------
       Two DIFFERENT questions that must never be collapsed into one number:

         marginPct  = (sell − cost) / sell      → ₹ earned per ₹100 of SALES
         perHundred = monthlyMargin / capital   → ₹ earned per ₹100 of STOCK, per month

       A thin-margin line that turns over fast can be far more productive than a
       fat-margin line that sits. Both are shown, never averaged.

       Denominator is capital held TODAY, not average inventory over a period —
       no inventory history exists (addendum-012 §E), so "average" would be a
       fiction. Stated on screen as "of stock held today" for that reason, which
       is also why this is not called GMROI.

       Everything here is horizon-invariant by construction: cost, sell and the
       30-day rate do not move when the demand horizon changes. */
    /* ---- future position (addendum-014) -------------------------------------
       What the shelf looks like AFTER everything already in motion has landed
       and expected demand has been served:

         projected = verified sellable + eligible incoming − expected demand

       Both sides are kept, never netted. A book that is ₹2.4 L above target and
       ₹0.8 L short somewhere else is not "balanced" — it is two problems, and
       netting them to zero is how an over-buy hides behind a shortage. */
    const incomingValue = (p.incoming || [])
      .reduce((a, i) => a + (incomingLot(p, i, dn) ? i.qty * (p.cost || 0) : 0), 0);
    const incomingLater = (p.incoming || []).filter((i) => i.etaInDays > dn);
    const projected = verified + incoming - dem;
    const aboveNow = verified - p.targetStock;
    const aboveAfter = projected - p.targetStock;

    /* Incoming is NOT automatically bad, and this is the whole point of the
       classification: it is only a concern when the position is already above
       target AND stays there once demand has taken its share. */
    let incomingState = "none";
    if (incoming > 0) {
      incomingState = (aboveNow > 0 && aboveAfter > 0) ? "excess"
        : aboveAfter < 0 ? "insufficient" : "healthy";
    }

    const capital = value + (unverifiedValue || 0);
    const excessCapitalAfter = p.unitCost == null ? null
      : Math.max(0, aboveAfter) * p.unitCost;
    /* Sales exposure: committed demand this SKU cannot serve, at this SKU's own
       selling price. The one concept Today needed that the engine did not have
       (addendum-015 §26) — added here rather than computed in a view, so it
       reconciles and is testable like everything else. It is a REVENUE figure,
       deliberately not netted against capital figures anywhere. */
    const exposureValue = p.sell == null ? null : shortAfter * p.sell;
    const unitMargin = p.sell == null || p.cost == null ? null : p.sell - p.cost;
    const marginPct = unitMargin == null || !p.sell ? null : unitMargin / p.sell;
    const monthlyMargin = unitMargin == null ? null : rr30 * 30 * unitMargin;
    /* No cost basis means no denominator. That — not an arbitrary threshold — is
       why a SKU is excluded: the earlier GMROI of 420 came from dividing by a
       stock value of ~zero, and a floor picked to hide it would be arbitrary. */
    const perHundred = (monthlyMargin == null || capital <= 0 || p.unitCost == null)
      ? null : (monthlyMargin / capital) * 100;

    return {
      p, verified, unverified, unverifiedValue, physical: p.physical, dem, incoming,
      capital, unitMargin, marginPct, monthlyMargin, perHundred,
      incomingValue, incomingLater, projected, aboveNow, aboveAfter,
      incomingState, excessCapitalAfter, exposureValue,
      short: shortAfter, shortBefore, atp: verified - dem, doh, ratio, value,
      expiring, expired, failDay, availability, velocity, position, overlays,
      customers, cap, severity, excessUnits,
      isCritical: availability === "short" && p.isKVI,
      atRiskValue: cap.expired + cap.expiring,
      expiredValue: cap.expired,
    };
  }

  /* The row's own sentence. Only what the data supports — never an invented cause. */
  function reason(d) {
    const p = d.p, u = p.unit, h = horizonLabel().toLowerCase();
    const bits = [];
    if (d.availability === "short") {
      bits.push(`${qty(d.short)} ${u} short ${h}`);
      if (d.incoming > 0) bits.push(`even after ${qty(d.incoming)} ${u} incoming`);
      if (d.failDay != null) bits.push(d.failDay === 0 ? "fails today" : `fails on D+${d.failDay}`);
    } else if (d.availability === "pending") {
      const po = (p.incoming || [])[0];
      bits.push(`${qty(d.shortBefore)} ${u} short before ${po ? `PO ${po.poNumber} lands on D+${po.etaInDays}` : "the next receipt"}`);
    } else if (d.position === "overstock") {
      bits.push(`${qty(d.excessUnits)} ${u} above a ${qty(p.targetStock)} target`);
      const po = (p.incoming || [])[0];
      if (po) bits.push(`${qty(po.qty)} more arriving D+${po.etaInDays}`);
    } else if (d.position === "understock") {
      bits.push(`${qty(d.verified)} ${u} against a ${qty(p.targetStock)} target`);
    } else if (d.expiring > 0) {
      bits.push(`${qty(d.expiring)} ${u} expires inside the horizon`);
    }
    if (d.velocity === "declining")
      bits.push(`selling ${Math.round((1 - p.sales.d30 / p.sales.d90) * 100)}% below its 90-day rate`);
    else if (d.velocity === "none") bits.push("no movement");
    if (d.expired > 0) bits.push(`${qty(d.expired)} ${u} already expired`);
    if (!bits.length) bits.push(`Covers demand ${h}`);
    return bits.join(" · ");
  }

  /* The chips a row shows. Multiple dimensions can be true at once; the most
     urgent two or three are shown and the drawer carries the rest. */
  function stateChips(d) {
    const out = [];
    if (d.isCritical) out.push(["Critical shortfall", "red"]);
    else if (d.availability === "short") out.push(["Short", "red"]);
    if (d.position === "overstock") out.push([DIM.position.overstock.label, "violet"]);
    else if (d.position === "understock" && d.availability !== "short")
      out.push([DIM.position.understock.label, "amber"]);
    if (d.velocity === "declining" || d.velocity === "none")
      out.push([DIM.velocity[d.velocity].label, DIM.velocity[d.velocity].tone]);
    if (d.availability === "pending") out.push([DIM.availability.pending.label, "amber"]);
    if (!out.length) out.push(["Healthy", "green"]);
    return out;
  }

  const horizonLabel = () =>
    (S.seed.horizons.find((h) => h.days === S.horizon) || {}).label || `D+${S.horizon}`;

  function all() { return S.seed.products.map((p) => derive(p, S.horizon)); }

  /* Portfolio roll-up. The capital split uses the primary class only, so it
     totals once; expiry risk sits beside it as an overlay (model §6). */
  function totals(rows) {
    const value = rows.reduce((a, d) => a + d.value, 0);
    const unverifiedValue = rows.reduce((a, d) => a + (d.unverifiedValue || 0), 0);
    const required = rows.reduce((a, d) => a + (d.p.targetStock * (d.p.unitCost || 0)), 0);
    const rr = rows.reduce((a, d) => a + d.p.sales.d30 * (d.p.unitCost || 0), 0);

    /* One bucket per unit, so this totals the portfolio exactly once. */
    /* Keys must match derive()'s buckets exactly — a stale key here silently
       drops a bucket from the split and turns the total into NaN. */
    const cap = { expired: 0, expiring: 0, unverified: 0, overstock: 0, declining: 0, healthy: 0 };
    rows.forEach((d) => Object.keys(cap).forEach((k) => { cap[k] += d.cap[k] || 0; }));
    /* Unverified is NOT risk. Folding it in would say something is wrong with
       stock that may be perfectly fine — we simply cannot evidence it. */
    const atRisk = cap.expired + cap.expiring + cap.overstock + cap.declining;
    const uncertain = cap.unverified;

    const kvi = rows.filter((d) => d.p.isKVI);
    const kviShort = kvi.filter((d) => d.availability === "short").length;
    const kviExpiry = kvi.filter((d) => d.availability !== "short" && (d.expiring > 0 || d.expired > 0)).length;

    const traced = rows.reduce((a, d) => a + d.p.traced, 0);
    const physical = rows.reduce((a, d) => a + d.physical, 0);
    const noCostBasis = rows.filter((d) => d.p.unitCost == null && d.unverified > 0).length;

    return {
      value, unverifiedValue, required, excess: Math.max(0, value - required),
      atRisk, uncertain, cap, traced, physical, noCostBasis,
      doh: rr > 0 ? value / rr : null,
      kviShort, kviExpiry,
      counts: {
        short: rows.filter((d) => d.availability === "short").length,
        overstock: rows.filter((d) => d.position === "overstock").length,
        nearexpiry: rows.filter((d) => d.expiring > 0 || d.expired > 0).length,
        kvirisk: kviShort + kviExpiry,
        declining: rows.filter((d) => d.velocity === "declining" || d.velocity === "none").length,
        unverified: rows.filter((d) => d.unverified > 0).length,
      },
    };
  }

  /* ---- capital concentration, one grouping for four questions --------------
     "Where is my money sitting?" is the same question whether it is asked of a
     category, a brand, a supplier or a SKU, so it is one control rather than
     four reports (addendum-013 §7).

     A group's return is computed from the SUMS — total margin over total capital
     — never by averaging its members' ratios, which would let a ₹9 K SKU
     returning ₹459 outvote a ₹13.58 L SKU returning ₹5. SKUs with no cost basis
     are excluded from BOTH sides and counted separately, exactly as the capital
     split already excludes them. */
  const GROUPS = { category: "Category", brand: "Brand", supplier: "Supplier", sku: "SKU" };

  function grouped(rows, by) {
    const m = new Map();
    rows.forEach((d) => {
      const k = by === "sku" ? d.p.name : (d.p[by] || "Unassigned");
      if (!m.has(k)) m.set(k, {
        key: k, capital: 0, margin: 0, unverified: 0, skus: 0, noCost: 0,
        incomingValue: 0, aboveTarget: 0, atRisk: 0, rows: [],
      });
      const g = m.get(k);
      g.skus += 1;
      g.rows.push(d);
      g.incomingValue += d.incomingValue;
      g.aboveTarget += d.cap.overstock;
      g.atRisk += d.atRiskValue;
      if (d.p.unitCost == null) { g.noCost += 1; return; }
      g.capital += d.capital;
      /* the ratio's denominator is part estimate; carry how much so it can say so */
      g.unverified += d.unverifiedValue || 0;
      g.margin += d.monthlyMargin || 0;
    });
    const total = [...m.values()].reduce((a, g) => a + g.capital, 0);
    return [...m.values()].map((g) => ({
      ...g,
      share: total > 0 ? g.capital / total : 0,
      perHundred: g.capital > 0 ? (g.margin / g.capital) * 100 : null,
      unverifiedShare: g.capital > 0 ? g.unverified / g.capital : 0,
    })).sort((a, b) => b.capital - a.capital);
  }

  /* The portfolio sentence: which groups hold the money, and whether they earn
     it. Stated only when the gap is real — a book where capital and margin track
     each other has nothing to report, and saying it anyway would be noise. */
  function concentration(gs) {
    const capTotal = gs.reduce((a, g) => a + g.capital, 0);
    const marTotal = gs.reduce((a, g) => a + g.margin, 0);
    if (capTotal <= 0 || marTotal <= 0 || gs.length < 3) return null;
    /* NOT the two largest by capital — the two that consume most disproportionately.
       Taking the largest would have picked Oils + Dairy here, and Dairy is one of
       the most productive groups in the book: a true sentence about the wrong two
       groups. Ranking by the gap between capital share and margin share finds the
       groups actually holding money they do not earn. */
    const top = gs
      .map((g) => ({ g, gap: g.capital / capTotal - g.margin / marTotal }))
      .filter((x) => x.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 2)
      .map((x) => x.g);
    if (top.length < 2) return null;
    const capShare = top.reduce((a, g) => a + g.capital, 0) / capTotal;
    const marShare = top.reduce((a, g) => a + g.margin, 0) / marTotal;
    if (capShare - marShare < 0.12) return null;
    return { names: top.map((g) => g.key), capShare, marShare };
  }

  /* ================= opportunity =================

     ORDERS tell Inventory what the business has committed to.
     DEMAND SIGNALS tell Inventory what the market is asking for.

     Those are two different flows and must never merge (addendum-009). A signal
     affects opportunity quantity, customer count, potential demand, evidence and
     purchase consideration. It affects nothing in the stock ladder — not stock,
     ATP, committed demand, DOH, shortfall or inventory value.

         Market → Demand signal → Opportunity → Purchase candidate → Buyer
         Customer order → Committed demand → Inventory ATP

     A DemandSignal is a business entity, not UI state. It is stored here in an
     in-memory repository behind the same interface a backend would expose, so
     connecting one is a swap of `signalRepo` rather than a rewrite of the views. */

  const SIGNAL_FIELDS = ["id", "createdAt", "productRef", "unlistedProduct", "quantity",
    "unit", "reason", "customerRef", "customerName", "frequency", "expectedPrice",
    "notes", "status", "source"];

  const signalRepo = {
    _rows: [],
    load(rows) { this._rows = (rows || []).map((r) => ({ ...r })); },
    list() { return this._rows.filter((s) => s.status !== "dismissed"); },
    all() { return this._rows; },
    add(rec) {
      const row = {};
      SIGNAL_FIELDS.forEach((f) => { row[f] = rec[f] === undefined ? null : rec[f]; });
      this._rows.unshift(row);
      return row;
    },
    setStatus(key, status) {
      this._rows.forEach((s) => { if (sigKey(s) === key) s.status = status; });
    },
  };

  const sigKey = (s) => s.productRef || ("new:" + s.unlistedProduct.name.toLowerCase());
  const daysAgo = (iso) => Math.max(0, Math.round(
    (new Date(S.seed.asOf + "T00:00:00") - new Date(iso + "T00:00:00")) / 86400000));
  const agoLabel = (n) => (n === 0 ? "today" : n === 1 ? "yesterday" : `${n}d ago`);

  function opportunities() {
    const groups = new Map();
    signalRepo.list().forEach((s) => {
      const k = sigKey(s);
      if (!groups.has(k)) {
        const prod = s.productRef ? S.seed.products.find((x) => x.id === s.productRef) : null;
        groups.set(k, {
          key: k, product: prod, listed: !!prod,
          name: prod ? prod.name : s.unlistedProduct.name,
          meta: prod ? `${prod.brand} · ${prod.pack}` : "",
          signals: [], qty: 0, value: 0, qtyWithoutPrice: 0,
          customers: new Set(), unit: s.unit, lastSeen: 99, lostSales: 0,
        });
      }
      const g = groups.get(k);
      /* Metadata is merged from whichever signal carries it: fields are optional
         at capture, so no single record can be assumed complete. */
      if (!g.listed && !g.meta && s.unlistedProduct) {
        const bits = [s.unlistedProduct.brand, s.unlistedProduct.pack].filter((x) => x && x !== "—");
        if (bits.length) g.meta = bits.join(" · ");
      }
      g.signals.push(s);
      g.qty += s.quantity;
      /* Value needs a price basis. A listed SKU has its selling price; an
         unlisted one only has what the rep entered. Without one the quantity is
         counted and the money is NOT invented. */
      const price = g.product ? g.product.sell : s.expectedPrice;
      if (price) g.value += s.quantity * price;
      else g.qtyWithoutPrice += s.quantity;
      if (s.customerRef || s.customerName) g.customers.add(s.customerName || s.customerRef);
      g.lastSeen = Math.min(g.lastSeen, daysAgo(s.createdAt));
      if (s.reason === "lost-sale") g.lostSales += 1;
      if (s.status === "reviewed") g.reviewed = true;
    });

    return [...groups.values()]
      .map((g) => {
        const d = g.product ? derive(g.product, S.horizon) : null;
        /* Repeat requests are the strongest quality signal there is, and they
           are counted, not scored: a customer who has asked more than once. */
        const perCustomer = {};
        g.signals.forEach((s) => {
          const c = s.customerName || s.customerRef;
          if (c) perCustomer[c] = (perCustomer[c] || 0) + 1;
        });
        const repeats = Object.values(perCustomer).filter((n) => n > 1).length;
        const sellable = d ? d.verified : 0;
        return {
          ...g, customerCount: g.customers.size, repeats,
          stock: g.product ? g.product.physical : 0,
          committed: d ? d.dem : 0, sellable,
          /* What Purchase would be handed, not what Purchase should buy. */
          suggestedQty: Math.max(0, g.qty - sellable),
          /* Where the price came from, stated rather than implied. A listed SKU
             is valued at its own selling price; an unlisted one at the price the
             rep entered when capturing. Neither is an estimate, and nothing is
             valued at a comparable or a median. */
          basis: g.product ? "at current selling price" : "at expected price",
        };
      })
      .sort((a, b) => b.value - a.value || b.qty - a.qty);
  }

  const REASON = (k) =>
    ((S.seed.signalReasons || []).find((r) => r.key === k) || { label: k }).label;

  /* ================= small view pieces ================= */

  const CARD = "bg-white rounded-lg border border-gray-200 shadow-sm";
  const TH = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap";
  const TD = "px-3 py-3 align-middle";

  function info(text) {
    return `<span class="relative inline-flex group ml-1 align-middle">
      <span class="text-gray-300 hover:text-gray-500 cursor-help">${icon("info", "w-3.5 h-3.5")}</span>
      <span class="pointer-events-none absolute left-1/2 bottom-full z-50 mb-1.5 hidden w-56 -translate-x-1/2
                   rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white
                   shadow-lg group-hover:block">${esc(text)}</span></span>`;
  }

  function chip(label, tone, extra) {
    const t = TONE[tone] || TONE.slate;
    return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium
      ring-1 ring-inset whitespace-nowrap ${t.chip} ${extra || ""}">
      <span class="w-1.5 h-1.5 rounded-full ${t.dot}"></span>${esc(label)}</span>`;
  }

  function overlayChips(d) {
    return d.overlays.map((o) => {
      if (o === "kvi") return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold
        tracking-wide bg-gray-900 text-white">KVI</span>`;
      if (o === "expired") return chip("Expired", "red");
      if (o === "nearexpiry") return chip("Near expiry", "amber");
      return `<span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium
        bg-gray-100 text-gray-500 ring-1 ring-inset ring-gray-200"
        title="Stock with no batch record — excluded from Sellable">Unverified</span>`;
    }).join(" ");
  }

  /* DOH never appears without its target, and never as a fabricated number. */
  function dohCell(d) {
    if (d.doh == null)
      return `<span class="text-[11px] text-gray-400">Unavailable</span>`;
    const cover = d.p.replenishmentDays + d.p.safetyDays;
    const t = d.doh < cover * 0.75 ? TONE.red : d.doh > cover * 1.25 ? TONE.violet : TONE.green;
    return `<div class="leading-tight">
      <div class="text-sm font-semibold ${t.text} tabular-nums">${d.doh.toFixed(1)}d</div>
      <div class="text-[11px] text-gray-400 tabular-nums">target ${cover}d</div></div>`;
  }

  /* Provenance is carried in the ⓘ note beside a figure rather than stamped as a
     badge on it. When a real feed lands, the word "illustrative" drops out of the
     sentence and nothing else changes (addendum-006 §13). */
  const MOCK_TAG = "";

  /* ================= views ================= */



  function horizonBar() {
    return `<div class="${CARD} p-2.5 sm:p-3">
      <div class="flex flex-col sm:flex-row sm:items-center gap-2.5">
        <div class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 shrink-0">
          ${icon("calendar", "w-3.5 h-3.5")} Demand horizon
          ${info("Every figure on this page is recalculated for this horizon. Demand dating is mock; the per-SKU totals are the real committed quantities.")}
        </div>
        <div class="flex-1 -mx-1 px-1 overflow-x-auto scrollbar-hide">
          <div class="inline-flex gap-1.5 min-w-full">
            ${S.seed.horizons.map((h) => `
              <button data-horizon="${h.days}" class="px-3 h-9 rounded-md text-xs font-medium whitespace-nowrap transition-colors
                ${h.days === S.horizon ? "bg-emerald-600 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"}">
                ${esc(h.label)}</button>`).join("")}
          </div>
        </div>
        <div class="relative sm:w-56 shrink-0">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">${icon("search", "w-3.5 h-3.5")}</span>
          <input data-search value="${esc(S.search)}" placeholder="Search product…"
            class="w-full h-9 pl-8 pr-2.5 rounded-md border border-gray-200 text-xs text-gray-700
                   focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none" />
        </div>
      </div></div>`;
  }

  /* ---- the queue. Not paginated: exceptions are an operational list. ---- */
  function queue(rows) {
    if (!rows.length) return emptyState();
    const desktop = `<div class="hidden md:block ${CARD} overflow-hidden">
      <table class="w-full"><thead class="bg-gray-50 border-b border-gray-200"><tr>
        ${["Product", "On hand", "Demand", "Sellable", "Available", "DOH", "Value", "Status"]
          .map((h, i) => `<th class="${TH} ${i >= 1 && i <= 6 ? "text-right" : ""}">${h}</th>`).join("")}
      </tr></thead><tbody class="divide-y divide-gray-100">
        ${rows.map((d) => rowDesktop(d)).join("")}
      </tbody></table></div>`;
    const mobile = `<div class="md:hidden space-y-2">${rows.map((d) => rowMobile(d)).join("")}</div>`;
    return desktop + mobile;
  }

  function rowDesktop(d) {
    return `<tr data-sku="${d.p.id}" class="cursor-pointer hover:bg-gray-50/70 border-l-2 ${
      d.severity <= 2 ? "border-l-red-400" : d.severity === 3 ? "border-l-amber-300"
      : d.severity <= 6 ? "border-l-violet-300" : "border-l-transparent"}">
      <td class="${TD}">
        <div class="flex items-start gap-2">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-sm font-medium text-gray-800">${esc(d.p.name)}</span>
              ${overlayChips(d)}
            </div>
            <div class="mt-0.5 text-[11px] text-gray-500">${esc(reason(d))}</div>
          </div>
        </div></td>
      <td class="${TD} text-right"><div class="text-sm text-gray-700 tabular-nums">${qty(d.p.physical)}</div>
        ${d.p.untraced ? `<div class="text-[11px] text-gray-400 tabular-nums">${qty(d.p.untraced)} unverified</div>` : ""}</td>
      <td class="${TD} text-right"><div class="text-sm text-gray-700 tabular-nums">${qty(d.dem)}</div>
        <div class="text-[11px] text-gray-400">${esc(horizonLabel().toLowerCase())}</div></td>
      <td class="${TD} text-right"><div class="text-sm font-medium text-gray-800 tabular-nums">${qty(d.verified)}</div>
        ${d.expiring ? `<div class="text-[11px] text-amber-600 tabular-nums">−${qty(d.expiring)} expiring</div>` : ""}</td>
      <td class="${TD} text-right"><span class="text-sm font-semibold tabular-nums ${d.atp < 0 ? "text-red-600" : "text-gray-800"}">${signed(d.atp)}</span></td>
      <td class="${TD} text-right">${dohCell(d)}</td>
      <td class="${TD} text-right"><span class="text-sm text-gray-700 tabular-nums">${rsShort(d.value)}</span></td>
      <td class="${TD}"><div class="flex flex-wrap gap-1">${stateChips(d).map(([l, tn]) => chip(l, tn)).join("")}</div></td></tr>`;
  }

  function rowMobile(d) {
    return `<div data-sku="${d.p.id}" class="${CARD} p-3.5 border-l-4 ${
      d.severity <= 2 ? "border-l-red-400" : d.severity === 3 ? "border-l-amber-300"
      : d.severity <= 6 ? "border-l-violet-300" : "border-l-gray-200"}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold text-gray-800 leading-snug">${esc(d.p.name)}</div>
          <div class="mt-1 flex flex-wrap items-center gap-1">${stateChips(d).map(([l, tn]) => chip(l, tn)).join("")}${overlayChips(d)}</div>
        </div>
        <div class="text-right shrink-0">
          <div class="text-base font-bold text-gray-800 tabular-nums leading-none">${rsShort(d.value)}</div>
          <div class="mt-1 text-[11px] text-gray-400">inventory value</div>
        </div>
      </div>
      <div class="mt-3 grid grid-cols-3 gap-2 text-center">
        ${[["Sellable", qty(d.verified), ""], ["Demand", qty(d.dem), ""],
           ["Available", signed(d.atp), d.atp < 0 ? "text-red-600" : "text-gray-800"]]
          .map(([k, v, cls]) => `<div class="rounded-md bg-gray-50 py-1.5">
            <div class="text-[10px] uppercase tracking-wide text-gray-400">${k}</div>
            <div class="text-sm font-semibold tabular-nums ${cls || "text-gray-800"}">${v}</div></div>`).join("")}
      </div>
      <div class="mt-2.5 flex items-center justify-between gap-2">
        <div class="text-[11px] text-gray-500 leading-snug flex-1">${esc(reason(d))}</div>
        <div class="shrink-0 text-right">${dohCell(d)}</div>
      </div>
      <button class="mt-2.5 w-full h-10 rounded-md border border-gray-200 text-xs font-semibold text-gray-700
        hover:bg-gray-50">View details</button></div>`;
  }

  function emptyState() {
    const f = S.filter || S.search;
    return `<div class="${CARD} px-6 py-14 text-center">
      <div class="mx-auto w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
        ${icon("checkCircle", "w-5 h-5")}</div>
      <p class="mt-3 text-sm font-semibold text-gray-800">
        ${f ? "Nothing matches these filters" : "No stock shortages for " + esc(horizonLabel().toLowerCase())}</p>
      <p class="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
        ${f ? "Clear the filter or widen the horizon to see more."
            : "Every tracked SKU can cover its expected demand at this horizon."}</p>
      ${f ? `<button data-clear class="mt-4 h-9 px-3.5 rounded-md border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">Clear filters</button>` : ""}
    </div>`;
  }

  /* ===================== TODAY — the briefing =====================

     Not a dashboard. A dashboard shows twelve metrics; a briefing says the six
     things worth knowing, in the order they cost money.

     EVERY figure below comes from the engine. Nothing is computed here
     (addendum-015 §26) — a view that does its own arithmetic is a second source
     of truth, and this module already has enough of those to keep honest.

     Ordering is by money at stake, and the money is printed next to the item,
     so the ranking is inspectable rather than a score nobody can argue with. */
  function briefing() {
    const rows = all();
    const items = [];
    const add = (o) => { if (o.skus.length) items.push(o); };

    const short = rows.filter((d) => d.availability === "short");
    add({
      key: "short", tone: "red", skus: short,
      amount: short.reduce((a, d) => a + (d.exposureValue || 0), 0),
      amountLabel: "demand exposed",
      title: `${short.length} SKU${short.length === 1 ? "" : "s"} cannot cover committed demand `
           + `${esc(horizonLabel().toLowerCase())}`,
      why: (() => {
        const kvi = short.filter((d) => d.p.isKVI).length;
        const cust = new Set(short.flatMap((d) => d.customers)).size;
        return [kvi ? `${kvi} key value item${kvi === 1 ? "" : "s"}` : null,
                cust ? `${cust} regular customer${cust === 1 ? "" : "s"} affected` : null]
          .filter(Boolean).join(" · ");
      })(),
      goto: "buy",
    });

    const excess = rows.filter((d) => d.incomingState === "excess");
    add({
      key: "overbuy", tone: "amber", skus: excess,
      amount: excess.reduce((a, d) => a + d.incomingValue, 0),
      amountLabel: "arriving into excess",
      title: `Purchase arriving into stock already above target`,
      why: excess.length
        ? `${excess.length} SKU${excess.length === 1 ? "" : "s"} · biggest ${
            rsShort(Math.max(...excess.map((d) => d.incomingValue)))}` : "",
      goto: "buy",
    });

    const over = rows.filter((d) => d.cap.overstock > 0);
    add({
      key: "abovetarget", tone: "amber", skus: over,
      amount: over.reduce((a, d) => a + d.cap.overstock, 0),
      amountLabel: "above target",
      title: "Capital sitting above target position",
      why: `${over.length} SKU${over.length === 1 ? "" : "s"}`,
      goto: "money",
    });

    const risk = rows.filter((d) => d.atRiskValue > 0);
    add({
      key: "freshness", tone: "red", skus: risk,
      amount: risk.reduce((a, d) => a + d.atRiskValue, 0),
      amountLabel: "expired or expiring",
      title: "Stock losing its shelf life",
      why: (() => {
        const gone = rows.reduce((a, d) => a + d.expiredValue, 0);
        return gone > 0 ? `${rsShort(gone)} already expired and awaiting disposition` : "";
      })(),
      goto: "notworking",
    });

    const dec = rows.filter((d) => d.cap.declining > 0);
    add({
      key: "declining", tone: "violet", skus: dec,
      amount: dec.reduce((a, d) => a + d.cap.declining, 0),
      amountLabel: "in declining lines",
      title: "Capital in SKUs selling below their own rate",
      why: `${dec.length} SKU${dec.length === 1 ? "" : "s"} against their 90-day rate`,
      goto: "notworking",
    });

    const unv = rows.filter((d) => d.unverified > 0);
    add({
      key: "unverified", tone: "slate", skus: unv,
      amount: unv.reduce((a, d) => a + (d.unverifiedValue || 0), 0),
      amountLabel: "unverified",
      title: "Stock with no batch evidence",
      why: `${unv.length} SKU${unv.length === 1 ? "" : "s"} · Stock Audit Settlement resolves this`,
      goto: "notworking",
    });

    /* Ranking by money alone put ₹9.67 L of UNVERIFIED stock above a shortage
       costing sales tomorrow — because those are not the same kind of money and
       one axis cannot order them. Addendum-007 already settled this distinction
       for capital; the briefing applies it:

         costs you sales   — revenue you do not get back
         costs you capital — money tied up, still recoverable
         not yet known     — uncertainty, which addendum-007 says is not risk

       Bands first, money inside each band. Both parts are inspectable, and no
       score is invented to blend them. */
    const BAND = {
      short: 0, freshness: 0,
      overbuy: 1, abovetarget: 1, declining: 1,
      unverified: 2,
    };
    return items.sort((a, b) => BAND[a.key] - BAND[b.key] || b.amount - a.amount);
  }

  const BAND_LABEL = ["Costs you sales", "Ties up your money", "Not yet known"];
  const bandOf = (key) => ({ short: 0, freshness: 0, overbuy: 1, abovetarget: 1,
    declining: 1, unverified: 2 }[key]);

  function viewToday() {
    const t = totals(all());
    const items = briefing();
    const rows = all();
    const later = rows.reduce((a, d) => a + d.incomingLater.length, 0);
    const laterValue = rows.reduce((a, d) =>
      a + d.incomingLater.reduce((b, i) => b + i.qty * (d.p.cost || 0), 0), 0);
    const worst = rows.filter((d) => d.perHundred != null && d.capital > 0)
      .sort((a, b) => a.perHundred - b.perHundred)[0];
    const bookCapital = rows.reduce((a, d) => a + d.capital, 0);

    return [
      horizonBar(),
      `<div class="${CARD} p-4 sm:p-5">
        <p class="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          ${esc(new Date(S.seed.asOf + "T00:00:00").toLocaleDateString("en-IN",
            { weekday: "long", day: "numeric", month: "long" }))}</p>
        <h2 class="mt-1 text-lg font-bold text-gray-900">Here's what needs your attention.</h2>
        <p class="mt-1 text-xs text-gray-500">
          ${rsShort(bookCapital)} of stock · ${items.length} thing${items.length === 1 ? "" : "s"} worth
          looking at ${info(`Grouped by what the money does — sales you lose, capital you tie up, or stock
            nobody has verified — then ordered by amount inside each group. Revenue and capital are not
            added together, and uncertainty is not counted as risk. Every amount is printed, so the
            ordering can be checked rather than trusted.`)}</p>
      </div>`,
      `<div class="space-y-2">${items.map((it, i) => {
        const head = i === 0 || bandOf(items[i - 1].key) !== bandOf(it.key)
          ? `<p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 pt-1 pb-0.5">
              ${BAND_LABEL[bandOf(it.key)]}</p>` : "";
        return head + briefItem(it);
      }).join("")}</div>`,
      /* Silence is not an answer. When the over-buy check finds nothing at this
         horizon it is because the purchase orders land later, and the briefing
         has to say so — otherwise "no item" reads as "no problem"
         (addendum-018 F4, the most dangerous of the horizon defaults). */
      later ? `<button data-view="buy" class="${CARD} w-full p-3 sm:p-4 text-left hover:bg-gray-50/70
        border-l-4 border-l-gray-300">
        <div class="flex items-start justify-between gap-3">
          <p class="text-xs text-gray-600 leading-relaxed">
            ${items.some((i) => i.key === "overbuy")
              ? `A further <strong class="font-semibold text-gray-800">${rsShort(laterValue)}</strong>
                 of purchase arrives after ${esc(horizonLabel().toLowerCase())}`
              : `<strong class="font-semibold text-gray-800">No purchase lands inside
                 ${esc(horizonLabel().toLowerCase())}</strong>, so nothing above has been judged against
                 target yet — but <strong class="font-semibold text-gray-800">${rsShort(laterValue)}</strong>
                 is on the way`}
            across ${later} PO${later === 1 ? "" : "s"}, and ${later === 1 ? "it is" : "they are"} not
            counted in anything above.
            <span class="block mt-1 text-gray-500">Widen the horizon to see what
              ${later === 1 ? "it does" : "they do"} to the position.</span>
            ${info(`Purchase orders are only assessed once they land inside the selected horizon. Kept
              out of every figure here rather than mixed in.`)}</p>
          <span class="shrink-0 text-[11px] font-semibold text-gray-500">Review in Buy →</span>
        </div>
      </button>` : "",
      worst && bookCapital > 0 && worst.capital / bookCapital >= 0.05
        ? `<button data-view="money" class="${CARD} w-full p-3 sm:p-4 text-left hover:bg-gray-50/70
          flex items-center justify-between gap-3">
          <p class="text-xs text-gray-600 leading-relaxed">
            <strong class="font-semibold text-gray-800">${esc(worst.p.name)}</strong> holds
            ${((worst.capital / bookCapital) * 100).toFixed(0)}% of your inventory capital and earns
            ₹${worst.perHundred.toFixed(0)} per ₹100 a month — the lowest return in the book.</p>
          <span class="shrink-0 text-[11px] font-semibold text-gray-500">View money →</span>
        </button>` : "",
    ].filter(Boolean).join('<div class="h-2 sm:h-3"></div>');
  }

  /* What · why · impact · where to act — the four things a briefing line owes
     the reader, and no more. */
  function briefItem(it) {
    const top = it.skus.slice().sort((a, b) =>
      (b.exposureValue || b.incomingValue || b.cap.overstock || b.atRiskValue || b.capital)
      - (a.exposureValue || a.incomingValue || a.cap.overstock || a.atRiskValue || a.capital))[0];
    return `<button data-view="${it.goto}" data-brief="${it.key}"
      class="${CARD} w-full text-left p-3.5 sm:p-4 border-l-4 ${TONE[it.tone].bar} hover:bg-gray-50/70">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="text-sm font-semibold text-gray-800">${it.title}</h3>
          ${it.why ? `<p class="mt-0.5 text-[11px] text-gray-500">${it.why}</p>` : ""}
          ${top ? `<p class="mt-1.5 text-xs text-gray-600 leading-relaxed">
            Largest: <strong class="font-semibold text-gray-800">${esc(top.p.name)}</strong> —
            ${esc(reason(top))}</p>` : ""}
        </div>
        <div class="shrink-0 text-right">
          <div class="text-lg font-bold tabular-nums leading-none ${TONE[it.tone].text}">${rsShort(it.amount)}</div>
          <div class="mt-1 text-[11px] text-gray-400">${it.amountLabel}</div>
        </div>
      </div></button>`;
  }

  /* ---- Overview ---- */

  /* One line on the workspace, not a second dashboard. It exists so the owner
     who never opens Money still learns the single most consequential thing about
     his capital — and it stays silent when the book has nothing to report. */

  /* The horizon governs what counts, which means at D+1 a PO landing D+3 is
     correctly excluded — and the biggest purchasing problem in the book would
     silently vanish from the screen the owner actually opens. So when nothing
     qualifies inside the horizon but purchase orders exist beyond it, say that
     instead of saying nothing. Never mix the two. */

  /* A compact strip, not a second dashboard: the top few things the market is
     asking for that inventory does not currently answer (brief §41). */

  /* ---- Stock: the whole universe. A dataset, so it paginates. ---- */

  /* ---- Expiry: a risk dimension, not a report ---- */

  /* ---- Batches: the traceability layer ---- */
  function viewBatches() {
    const lines = [];
    S.seed.products.forEach((p) => p.batches.forEach((b) =>
      lines.push({ p, b, value: b.qty * b.cost })));
    const q = S.search.trim().toLowerCase();
    const shown = lines
      .filter((l) => !q || (l.p.name + " " + l.b.batchNumber).toLowerCase().includes(q))
      .sort((a, b) => a.b.expiryInDays - b.b.expiryInDays);
    return [
      horizonBar(),
      `<div class="flex items-baseline justify-between gap-3">
        <h3 class="text-sm font-semibold text-gray-800">All batches</h3>
        <span class="text-[11px] text-gray-400">${shown.length} lines · earliest expiry first</span></div>`,
      batchTable(shown, false),
    ].join('<div class="h-2 sm:h-3"></div>');
  }

  function batchTable(lines, riskOnly) {
    if (!lines.length) return emptyState();
    const head = ["Product", "Batch", "Qty", "Expiry", "Value", ""];
    return `<div class="hidden md:block ${CARD} overflow-hidden">
      <table class="w-full"><thead class="bg-gray-50 border-b border-gray-200"><tr>
        ${head.map((h, i) => `<th class="${TH} ${i >= 2 && i <= 4 ? "text-right" : ""}">${h}</th>`).join("")}
      </tr></thead><tbody class="divide-y divide-gray-100">
      ${lines.map((l) => {
        const d = l.b.expiryInDays;
        const tone = d < 0 ? "red" : d < S.horizon ? "red" : d < 7 ? "amber" : "slate";
        return `<tr data-sku="${l.p.id}" class="cursor-pointer hover:bg-gray-50/70">
          <td class="${TD}"><div class="text-sm text-gray-800">${esc(l.p.name)}</div>
            <div class="text-[11px] text-gray-400">${esc(l.p.articleNumber)}</div></td>
          <td class="${TD}"><div class="text-xs font-mono text-gray-600">${esc(l.b.batchNumber)}</div>
            <div class="mt-0.5"><span class="text-[10px] text-gray-400">${esc(l.b.batchId)}</span></div></td>
          <td class="${TD} text-right text-sm text-gray-700 tabular-nums">${qty(l.b.qty)}</td>
          <td class="${TD} text-right">${chip(d < 0 ? `${Math.abs(d)}d ago` : `${d}d left`, tone)}</td>
          <td class="${TD} text-right text-sm text-gray-700 tabular-nums">${rsShort(l.value)}</td>
          <td class="${TD} text-right"><span class="text-[11px] text-gray-400">${esc(l.b.supplier || "")}</span></td>
        </tr>`;
      }).join("")}</tbody></table></div>
      <div class="md:hidden space-y-2">${lines.map((l) => {
        const d = l.b.expiryInDays;
        const tone = d < 0 ? "red" : d < S.horizon ? "red" : d < 7 ? "amber" : "slate";
        return `<div data-sku="${l.p.id}" class="${CARD} p-3.5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0"><div class="text-sm font-medium text-gray-800">${esc(l.p.name)}</div>
              <div class="text-[11px] font-mono text-gray-400 mt-0.5">${esc(l.b.batchNumber)}</div></div>
            <div class="shrink-0 text-right"><div class="text-sm font-semibold tabular-nums text-gray-800">${rsShort(l.value)}</div>
              <div class="mt-1">${chip(d < 0 ? `${Math.abs(d)}d ago` : `${d}d left`, tone)}</div></div>
          </div>
          <div class="mt-2 text-[11px] text-gray-500">${qty(l.b.qty)} ${esc(l.p.unit)} · ${esc(l.b.supplier || "—")}</div>
        </div>`;
      }).join("")}</div>`;
  }

  /* ---- Working capital ---- */
  /* ===================== MONEY — one story, in one order ====================

     Was: four unrelated headline cards, a composition that repeated two of them,
     the productivity table, then a list that duplicated Not working. Four screens
     stacked (Q30).

     Now it reads in the order the question is actually asked:

       how much money  →  where is it  →  is it working  →  what drives it

     No new metric. The capital split, the productivity table, the grouping
     control and the concentration sentence are all the existing engines. */
  function viewCapital() {
    const rows = all(), t = totals(rows);
    const capital = t.value + t.unverifiedValue;
    const split = Object.entries(t.cap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const max = split.length ? split[0][1] : 1;

    return [
      /* 1 — how much. ONE number, with confidence beneath it rather than beside
             it: verified and unverified are parts of this figure, not peers of
             it, and target position is context, not a fifth headline. */
      `<div class="${CARD} p-4 sm:p-5">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div class="text-[11px] font-medium uppercase tracking-wide text-gray-500">Inventory capital</div>
            <div class="mt-1 text-3xl sm:text-4xl font-bold text-gray-900 tabular-nums leading-none">${rsShort(capital)}</div>
            <p class="mt-2 text-xs text-gray-500">
              ${rsShort(t.value)} against batch records · ${rsShort(t.unverifiedValue)} without
              ${info(`Unverified stock is valued at this SKU's batch cost. It is not counted as risk —
                nothing is known to be wrong with it, only unevidenced.`)}</p>
          </div>
          <div class="text-right">
            <div class="text-[11px] text-gray-400">Target position</div>
            <div class="text-lg font-semibold text-gray-700 tabular-nums">${rsShort(t.required)}</div>
            <!-- No signed delta here. capital − target nets SKUs that are over
                 against SKUs that are under, and this book is ₹11 L above on some
                 and ₹14.8 L below on others: the net ₹6.9 L describes neither, and
                 would sit directly above the un-netted "Above target" bucket
                 contradicting it. Addendum-006 fixed exactly this once already. -->
            <div class="text-[11px] text-gray-400">prototype policy · not netted against
              the split below</div>
          </div>
        </div>
      </div>`,

      /* 2 — where is it */
      `<div class="${CARD} p-3 sm:p-4">
        <h3 class="text-sm font-semibold text-gray-800">Where it is sitting</h3>
        <p class="mt-0.5 text-[11px] text-gray-500">Every rupee in exactly one bucket, split by unit rather
          than by SKU — a SKU that is both overstocked and declining shows in both operational states, but
          its capital is counted once.</p>
        <div class="mt-3 space-y-2">${split.map(([k, v]) => `
          <button data-filter="${k}" data-goto="notworking" class="w-full flex items-center gap-3 text-left group">
            <span class="w-28 sm:w-36 shrink-0 text-xs text-gray-600 group-hover:text-gray-900">${CAPITAL[k].label}</span>
            <span class="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <span class="block h-full rounded-full ${TONE[CAPITAL[k].tone].dot}" style="width:${(v / max) * 100}%"></span></span>
            <span class="w-16 text-right text-xs font-semibold text-gray-800 tabular-nums">${rsShort(v)}</span>
          </button>`).join("")}</div>
        ${t.uncertain > 0 ? `<div class="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <p class="text-[11px] text-gray-500 max-w-lg">
            <strong class="font-semibold text-gray-700">${rsShort(t.uncertain)}</strong> has no batch evidence,
            so it cannot be assessed with the same confidence as the rest. That is uncertainty, not a loss —
            and resolving it is Stock Audit Settlement's, not Inventory's.</p>
          <button data-dead="audit" class="h-9 px-3 rounded-md border border-gray-200 text-[11px] font-semibold
            text-gray-700 hover:bg-gray-50 shrink-0">Resolve in Stock Audit</button>
        </div>` : ""}
        ${t.noCostBasis ? `<p class="mt-2 text-[11px] text-gray-400">${t.noCostBasis}
          SKU${t.noCostBasis === 1 ? " has" : "s have"} no batch at all, so no cost basis exists and their
          stock is excluded from every rupee figure here.</p>` : ""}
      </div>`,

      /* 3 + 4 — is it working, and what drives it (grouping lives inside) */
      capitalProductivity(rows),
    ].join('<div class="h-2 sm:h-3"></div>');
  }

  /* Capital productivity. Not a score — the drivers, side by side, so the reader
     can disagree with the reading (addendum-013 §10). */
  function capitalProductivity(rows) {
    const gs = grouped(rows, S.groupBy);
    const con = concentration(gs);
    const maxCap = gs.length ? gs[0].capital : 1;
    const open = S.openGroup;
    return `<div class="${CARD} overflow-hidden">
      <div class="px-3 sm:px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-gray-800">Capital productivity</h3>
          <p class="mt-0.5 text-[11px] text-gray-500">What each rupee of stock earns in a month
            ${info(`Gross margin for a month at the 30-day rate, over the capital held today.
              Not GMROI: average inventory needs a history this system does not keep, so the
              denominator is today's stock and is labelled as such.`)}</p>
          <!-- The caveat has to be READ BEFORE the numbers, not found afterwards in a
               drawer. A user who lands here and never opens a SKU was previously
               looking at invented economics presented as fact (addendum-018 F1). -->
          <p class="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 bg-amber-50 text-[11px]
            text-amber-800 ring-1 ring-amber-200">
            ${icon("alertTriangle", "w-3 h-3 shrink-0")}
            Margin and return use <strong class="font-semibold">illustrative selling prices</strong></p>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[11px] text-gray-500">By</span>
          <div class="flex rounded-md border border-gray-200 overflow-hidden">
            ${Object.entries(GROUPS).map(([k, label]) => `<button data-groupby="${k}"
              class="h-9 px-2.5 text-[11px] font-medium ${S.groupBy === k
                ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}">${label}</button>`).join("")}
          </div>
        </div>
      </div>
      ${con ? `<div class="px-3 sm:px-4 py-2.5 bg-amber-50/60 border-b border-amber-100">
        <p class="text-xs text-gray-700 leading-relaxed">
          <strong class="font-semibold">${esc(con.names.join(" + "))}</strong> hold
          <strong class="font-semibold">${(con.capShare * 100).toFixed(0)}%</strong> of inventory capital
          and generate <strong class="font-semibold">${(con.marShare * 100).toFixed(0)}%</strong> of gross margin.</p>
      </div>` : ""}
      <div class="divide-y divide-gray-100">
        ${gs.map((g) => {
          const isOpen = open === g.key;
          return `<div>
            <button data-group="${esc(g.key)}" class="w-full px-3 sm:px-4 py-3 text-left hover:bg-gray-50/70">
              <div class="flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-medium text-gray-800">${esc(g.key)}</div>
                  <div class="mt-1 flex items-center gap-2">
                    <span class="h-1.5 flex-1 max-w-[140px] rounded-full bg-gray-100 overflow-hidden">
                      <span class="block h-full rounded-full bg-gray-400"
                        style="width:${(g.capital / maxCap) * 100}%"></span></span>
                    <span class="text-[11px] text-gray-400 tabular-nums">${(g.share * 100).toFixed(0)}% of capital</span>
                  </div>
                </div>
                <div class="shrink-0 text-right w-20">
                  <div class="text-sm font-semibold text-gray-800 tabular-nums">${rsShort(g.capital)}</div>
                  <div class="text-[11px] text-gray-400">${g.skus} SKU${g.skus === 1 ? "" : "s"}</div>
                </div>
                <div class="shrink-0 text-right w-24">
                  <div class="text-sm font-semibold tabular-nums ${
                    g.perHundred == null ? "text-gray-400"
                    : g.perHundred < 12 ? "text-red-600"
                    : g.perHundred < 25 ? "text-amber-600" : "text-emerald-700"}">${
                    g.perHundred == null ? "—" : "₹" + g.perHundred.toFixed(0)}</div>
                  <div class="text-[11px] text-gray-400">per ₹100/mo</div>
                  ${g.unverifiedShare > 0.25 ? `<div class="text-[10px] text-amber-600 leading-tight">${
                    Math.round(g.unverifiedShare * 100)}% of capital unverified</div>` : ""}
                </div>
              </div>
            </button>
            ${isOpen ? `<div class="px-3 sm:px-4 pb-3 bg-gray-50/60">
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 py-2.5">
                ${[["Capital", rsShort(g.capital)],
                   ["Gross margin", g.margin > 0 ? rsShort(g.margin) + "/mo" : "—"],
                   ["Above target", g.aboveTarget > 0 ? rsShort(g.aboveTarget) : "—"],
                   /* "—" answered "kitna maal aa raha hai?" with silence while a PO
                      landed two days later. Empty because of the horizon is not the
                      same as empty (addendum-018 F4). */
                   ["Arriving", (() => {
                     if (g.incomingValue > 0) return rsShort(g.incomingValue);
                     const later = g.rows.reduce((a, d) =>
                       a + d.incomingLater.reduce((b, i) => b + i.qty * (d.p.cost || 0), 0), 0);
                     return later > 0
                       ? `<span class="text-gray-400">none yet</span>`
                       : "—";
                   })(), (() => {
                     const later = g.rows.reduce((a, d) =>
                       a + d.incomingLater.reduce((b, i) => b + i.qty * (d.p.cost || 0), 0), 0);
                     return later > 0 ? `${rsShort(later)} after this horizon` : "";
                   })()]]
                  .map(([k, v, sub]) => `<div class="rounded-md bg-white border border-gray-200 px-2.5 py-2">
                    <div class="text-[10px] uppercase tracking-wide text-gray-400">${k}</div>
                    <div class="mt-0.5 text-sm font-semibold text-gray-800 tabular-nums">${v}</div>
                    ${sub ? `<div class="text-[10px] text-gray-400 leading-tight">${sub}</div>` : ""}</div>`).join("")}
              </div>
              <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mt-1">Top capital consumers</p>
              <div class="mt-1.5 space-y-1">
                ${g.rows.slice().sort((a, b) => b.capital - a.capital).slice(0, 5).map((d) => `
                  <div data-sku="${d.p.id}" class="flex items-center gap-3 rounded-md bg-white border border-gray-200
                    px-2.5 py-2 cursor-pointer hover:bg-gray-50">
                    <span class="min-w-0 flex-1 text-xs text-gray-700 truncate">${esc(d.p.name)}</span>
                    <span class="shrink-0 text-xs font-semibold text-gray-800 tabular-nums">${rsShort(d.capital)}</span>
                    <span class="shrink-0 w-14 text-right text-xs tabular-nums ${
                      d.perHundred == null ? "text-gray-400" : "text-gray-600"}">${
                      d.perHundred == null ? "—" : "₹" + d.perHundred.toFixed(0)}</span>
                  </div>`).join("")}
              </div>
              ${g.noCost ? `<p class="mt-2 text-[11px] text-gray-400">${g.noCost} SKU${g.noCost === 1 ? "" : "s"}
                with no cost basis excluded from both capital and margin.</p>` : ""}
            </div>` : ""}
          </div>`;
        }).join("")}
      </div></div>`;
  }

  /* The SKU's capital story. Every clause is emitted only if the data proves it,
     and they are assembled in the order a distributor would say them: how much
     money, is that a lot, what does it earn, is more coming.

     §14 of the brief matters most here. Margin alone must never drive an
     inventory decision: a thin-margin KVI that moves fast is doing its job, and
     a fast-moving line the whole book depends on is not a candidate for cutting
     just because its percentage is small. So the reading below never says
     "reduce" — it states the position and names what protects it. */
  /* ===================== cause → impact → owner → handoff ==================
     Addendum-012 V1 item 6, the last unbuilt one. The module could already state
     every fact in the chain and never drew the line between them, so a
     distributor with a purchase manager rang the wrong person (addendum-018).

     Ownership is NOT a generic "Warehouse" stamp. It is derived from the actual
     cause, and every module named here is one of the eleven that really exist in
     `storefrontMenus` (addendum-012 §A). Where the owning module has no
     actionable workflow yet, this says "review there" rather than pretending a
     handoff works.

     No new intelligence: every input below is already on the derive row. */
  const CAUSES = [
    {
      key: "expiry-shortage",
      /* the strongest case in the book: the shortage would not exist if the
         expired units were still good */
      when: (d) => d.availability !== "covered" && d.expired > 0
                   && d.verified + d.expired >= d.dem,
      cause: (d) => `${qty(d.expired)} ${d.p.unit} of physical stock has expired`,
      impact: (d) => `only ${qty(d.verified)} of ${qty(d.physical)} ${d.p.unit} can be sold, against `
                   + `${qty(d.dem)} committed — ${qty(d.short)} short`,
      note: "Had that stock been good, there would be no shortage. This is a disposition problem "
          + "surfacing as an availability problem.",
      owner: "Stock Audit Settlement",
      action: "Review the expired stock there",
    },
    {
      key: "expiry-only",
      when: (d) => d.expired > 0,
      cause: (d) => `${qty(d.expired)} ${d.p.unit} (${rsShort(d.expiredValue)}) passed expiry`,
      impact: () => "still counted in physical stock and recorded value, and cannot serve any demand",
      note: "Inventory reports it; it does not write the disposal record.",
      owner: "Stock Audit Settlement",
      action: "Review the expired stock there",
    },
    {
      key: "po-into-excess",
      when: (d) => d.incomingState === "excess",
      cause: (d) => `${rsShort(d.incomingValue)} is arriving on stock already `
                  + `${qty(d.aboveNow)} ${d.p.unit} above target`,
      impact: (d) => `projected ${qty(d.aboveAfter)} ${d.p.unit} above target after expected demand`,
      note: "The buying decision belongs to Procurement — nothing here changes a purchase order.",
      owner: "Procurement",
      action: "Review the purchase order there",
    },
    {
      key: "short-no-cover",
      when: (d) => d.availability === "short",
      cause: (d) => d.incoming > 0
        ? `${qty(d.incoming)} ${d.p.unit} is arriving and still does not cover demand`
        : `nothing is on the way`,
      impact: (d) => `${qty(d.short)} ${d.p.unit} of committed demand cannot be served`,
      note: "Replenishment is Procurement's decision; Inventory states the requirement.",
      owner: "Procurement",
      action: "Raise it as a purchase candidate",
    },
    {
      key: "unverified",
      when: (d) => d.unverified > 0 && d.unverified / Math.max(1, d.physical) > 0.25,
      cause: (d) => `${qty(d.unverified)} of ${qty(d.physical)} ${d.p.unit} carry no batch record`,
      impact: (d) => `${rsShort(d.unverifiedValue || 0)} of capital cannot be evidenced, and those units `
                   + `cannot be guaranteed against this horizon`,
      note: "Uncertainty, not a loss — counting and settling the variance is Stock Audit Settlement's.",
      owner: "Stock Audit Settlement",
      action: "Reconcile the count there",
    },
    {
      key: "declining-excess",
      when: (d) => d.position === "overstock"
                   && (d.velocity === "declining" || d.velocity === "none"),
      cause: (d) => `selling below its own 90-day rate while ${qty(d.excessUnits)} ${d.p.unit} sit above target`,
      impact: (d) => `${rsShort(d.cap.overstock + d.cap.declining)} of capital tied to a line that is slowing`,
      /* The position is Inventory's to report; the next ACTION -- stop re-ordering
         a slowing line -- is Procurement's. A compound owner sends the reader to
         two places and is the fuzziness this chain exists to remove. */
      note: "Inventory reports the position; the next buying cycle is Procurement's to change.",
      owner: "Procurement",
      action: "Reduce the next replenishment cycle",
    },
  ];

  const causeOf = (d) => CAUSES.find((c) => c.when(d)) || null;

  /* The chain, rendered where the problem is being read. */
  function causeBlock(d) {
    const c = causeOf(d);
    if (!c) return "";
    const step = (label, text, tone) => `<div class="flex gap-2">
      <span class="w-14 shrink-0 text-[10px] uppercase tracking-wide text-gray-400 pt-px">${label}</span>
      <span class="min-w-0 flex-1 text-xs ${tone || "text-gray-700"} leading-relaxed">${text}</span></div>`;
    return `<div class="rounded-md border border-gray-200 bg-gray-50/70 p-2.5">
      <div class="space-y-1.5">
        ${step("Cause", esc(c.cause(d)))}
        ${step("Impact", esc(c.impact(d)))}
        ${step("Owner", `<strong class="font-semibold text-gray-900">${esc(c.owner)}</strong>`)}
      </div>
      <p class="mt-2 pt-2 border-t border-gray-200 text-[11px] text-gray-500 leading-snug">${esc(c.note)}</p>
      <button data-dead="owner|${esc(c.key)}" class="mt-2 h-9 px-3 rounded-md border border-gray-200
        bg-white text-[11px] font-semibold text-gray-700 hover:bg-gray-50">${esc(c.action)}</button>
    </div>`;
  }

  /* Who a shortage actually lands on. `derive()` has computed this since
     addendum-004 and no view ever rendered it (addendum-012 §C) — the Sales
     context was being calculated and thrown away, which is why the sales
     manager's journey was the only one of five that could not finish.

     Customer NAMES come from the order book Inventory already holds. Customer
     PRIORITY does not, and is not invented here — Customer Management owns it. */
  function customersBlock(d) {
    if (!d.customers.length) return "";
    const risk = d.availability !== "covered";
    return `<div>
      <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        Customers expecting this ${esc(horizonLabel().toLowerCase())}</h3>
      <div class="mt-1.5 flex flex-wrap gap-1.5">
        ${d.customers.map((c) => chip(esc(c), risk ? "red" : "slate")).join("")}
      </div>
      <p class="mt-1.5 text-[11px] ${risk ? "text-red-600" : "text-gray-400"} leading-snug">
        ${risk
          ? `${d.customers.length} regular customer${d.customers.length === 1 ? "" : "s"} ${
              d.customers.length === 1 ? "has" : "have"} orders promised inside this horizon, and
             ${qty(d.short)} ${esc(d.p.unit)} cannot be served.`
          : "From promised delivery dates on open orders. Nothing here is at risk at this horizon."}</p>
    </div>`;
  }

  function capitalBlock(d) {
    if (d.p.unitCost == null) {
      return `<div>
        <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Capital productivity</h3>
        <p class="mt-1.5 text-xs text-gray-500">This SKU has no batch, so it has no cost basis. Capital
          and margin cannot be computed for it, and it is excluded from every rupee figure in this module.</p>
      </div>`;
    }
    const rows = all();
    const bookCapital = rows.reduce((a, x) => a + x.capital, 0);
    const share = bookCapital > 0 ? d.capital / bookCapital : 0;
    const ranked = rows.map((x) => x.perHundred).filter((v) => v != null).sort((a, b) => a - b);
    const median = ranked.length ? ranked[Math.floor(ranked.length / 2)] : null;

    const stat = (k, v, sub) => `<div class="rounded-md bg-gray-50 px-2.5 py-2">
      <div class="text-[10px] uppercase tracking-wide text-gray-400">${k}</div>
      <div class="mt-0.5 text-sm font-semibold text-gray-800 tabular-nums">${v}</div>
      ${sub ? `<div class="text-[10px] text-gray-400">${sub}</div>` : ""}</div>`;

    /* the sentence, clause by clause, only where proven */
    const bits = [];
    bits.push(`<strong class="font-semibold text-gray-900">${rsShort(d.capital)}</strong> is tied up here`);
    if (share >= 0.05) bits.push(`<strong class="font-semibold text-gray-900">${(share * 100).toFixed(0)}%</strong> of all inventory capital`);
    if (d.perHundred != null && median != null) {
      const mine = d.perHundred.toFixed(0), mid = median.toFixed(0);
      /* Compare the ROUNDED figures, or a SKU that is itself the median reads
         "₹24, above the book median of ₹24". */
      const where = mine === mid ? "in line with the book median of ₹" + mid
        : Number(mine) < Number(mid) ? "against a book median of ₹" + mid
        : "above the book median of ₹" + mid;
      bits.push(`earning <strong class="font-semibold text-gray-900">₹${mine}</strong> per ₹100 a month, ${where}`);
    }
    if (d.position === "overstock") bits.push("on stock already above target");
    else if (d.position === "understock") bits.push("on stock below target");
    if (d.incomingValue > 0) bits.push(`with <strong class="font-semibold text-gray-900">${rsShort(d.incomingValue)}</strong> more arriving`);

    /* what argues against acting on the money alone */
    const guards = [];
    if (d.p.isKVI) guards.push("a key value item customers judge you on");
    if (d.velocity === "growing") guards.push("selling faster than its own 90-day rate");
    if (d.availability !== "covered") guards.push("already short inside the horizon");
    const unverifiedShare = d.capital > 0 ? (d.unverifiedValue || 0) / d.capital : 0;

    return `<div>
      <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Capital productivity</h3>
      <div class="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${stat("Capital", rsShort(d.capital), `${(share * 100).toFixed(1)}% of book`)}
        ${stat("Margin", d.marginPct == null ? "—" : (d.marginPct * 100).toFixed(1) + "%", "of sales")}
        ${stat("Gross margin", d.monthlyMargin == null ? "—" : rsShort(d.monthlyMargin), "per month")}
        ${stat("Per ₹100 stock", d.perHundred == null ? "—" : "₹" + d.perHundred.toFixed(0), "per month")}
      </div>
      <p class="mt-2 text-xs text-gray-600 leading-relaxed">${bits.join(" · ")}.</p>
      ${guards.length ? `<p class="mt-1.5 text-xs text-gray-600 leading-relaxed">
        <strong class="font-semibold text-gray-800">Do not read that as "carry less".</strong>
        This SKU is ${guards.join(", and ")} — margin alone cannot settle an inventory decision.</p>` : ""}
      ${unverifiedShare > 0.25 ? `<p class="mt-1.5 text-[11px] text-gray-400 leading-snug">
        ${rsShort(d.unverifiedValue)} of that capital — ${(unverifiedShare * 100).toFixed(0)}% — sits on units with
        no batch evidence, and is valued at this SKU's batch cost rather than measured.</p>` : ""}
      <p class="mt-1.5 text-[11px] text-gray-400 leading-snug">Margin is ${rs(d.p.sell)} selling price less
        ${rs(d.p.cost)} landed cost, both ex-tax, on illustrative pricing. Return is a month of gross margin at
        the 30-day rate over the capital held today — not an average-inventory GMROI, because no inventory
        history exists to average.</p>
    </div>`;
  }

  /* ===================== Incoming: the future position =====================

     PURCHASE CANDIDATE says "we may need to buy this".
     INCOMING RISK says "we may already have too much coming".
     They are opposites and must never be merged (addendum-014).

     Inventory answers one question here: if this PO lands, what happens to my
     stock and my capital? It never cancels, reschedules, re-prices or approves
     a PO — Procurement owns all of that (addendum-012 §B). */


  function section(title, rows, kind) {
    return `<div class="${CARD} overflow-hidden">
      <div class="px-3 sm:px-4 py-3 border-b border-gray-100 flex items-baseline justify-between gap-3">
        <h3 class="text-sm font-semibold text-gray-800">${title}</h3>
        <span class="text-[11px] text-gray-400">${rows.length} SKU${rows.length === 1 ? "" : "s"}${
          kind === "excess" ? " · by capital arriving" : ""}</span>
      </div>
      <div class="divide-y divide-gray-100">${rows.map((d) => incomingRow(d, kind)).join("")}</div></div>`;
  }

  /* Each row states the decision without being opened. */
  function incomingRow(d, kind) {
    const pos = (n) => (n > 0 ? "+" : "") + qty(n);
    const lots = (d.p.incoming || []).filter((i) => i.etaInDays <= S.horizon);
    const eta = lots.length ? Math.min(...lots.map((i) => i.etaInDays)) : null;
    const poNames = lots.map((i) => i.poNumber).join(", ");

    /* the sentence — built only from what the position proves */
    let line;
    if (kind === "excess") {
      line = `<strong class="font-semibold text-gray-900">${rsShort(d.incomingValue)}</strong> arriving
        ${eta === 0 ? "today" : eta === 1 ? "tomorrow" : "D+" + eta} while already
        <strong class="font-semibold text-gray-900">${qty(d.aboveNow)} ${esc(d.p.unit)}</strong> above target
        · <strong class="font-semibold text-gray-900">${qty(d.aboveAfter)}</strong> still above target after
        expected demand`;
    } else if (kind === "insufficient") {
      line = `<strong class="font-semibold text-gray-900">${rsShort(d.incomingValue)}</strong> arriving
        ${eta === 0 ? "today" : eta === 1 ? "tomorrow" : "D+" + eta}, and stock is still projected
        <strong class="font-semibold text-gray-900">${qty(Math.abs(d.aboveAfter))} ${esc(d.p.unit)}</strong>
        below target`;
    } else {
      line = `<strong class="font-semibold text-gray-900">${rsShort(d.incomingValue)}</strong> arriving
        ${eta === 0 ? "today" : eta === 1 ? "tomorrow" : "D+" + eta}, bringing stock to
        <strong class="font-semibold text-gray-900">${qty(d.projected)}</strong> against a
        ${qty(d.p.targetStock)} target`;
    }

    /* context that changes the reading rather than repeating it */
    const ctx = [];
    if (d.velocity === "declining") ctx.push(`selling ${Math.round((1 - d.p.sales.d30 / d.p.sales.d90) * 100)}% below its 90-day rate`);
    if (d.velocity === "growing") ctx.push("selling above its 90-day rate");
    if (d.perHundred != null) ctx.push(`₹${d.perHundred.toFixed(0)} per ₹100 of stock a month`);
    if (d.expiring > 0) ctx.push(`${qty(d.expiring)} ${d.p.unit} of current stock expires first`);
    if (d.p.supplier) ctx.push(esc(d.p.supplier));

    /* A KVI above target is never "buy less" on capital alone. A KVI BELOW target
       is the opposite argument, and pasting the same sentence onto both would
       tell a buyer not to reduce a line they need more of. */
    let guard = null;
    if (kind === "excess" && d.p.isKVI) {
      guard = "High capital exposure, but this is a key value item — availability may justify it. "
            + "Review rather than reduce.";
    } else if (kind === "insufficient" && d.p.isKVI) {
      guard = "A key value item projected below target — the shortfall lands on customers who judge "
            + "you on having it.";
    } else if (kind === "excess" && d.expiring > 0) {
      guard = "Incoming stock may overlap with inventory already near expiry.";
    }

    return `<div class="px-3 sm:px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span data-sku="${d.p.id}" class="text-sm font-medium text-gray-800 cursor-pointer hover:underline">${esc(d.p.name)}</span>
            ${d.p.isKVI ? chip("KVI", "violet") : ""}
            ${kind === "excess" ? chip("Above target", "amber") : ""}
          </div>
          <p class="mt-1 text-xs text-gray-600 leading-relaxed">${line}.</p>
          ${ctx.length ? `<p class="mt-1 text-[11px] text-gray-400">${ctx.join(" · ")}</p>` : ""}
          ${guard ? `<p class="mt-1 text-[11px] text-gray-500">${guard}</p>` : ""}
        </div>
        <div class="shrink-0 text-right">
          <div class="text-sm font-semibold text-gray-800 tabular-nums">${rsShort(d.capital)}</div>
          <div class="text-[11px] text-gray-400">already invested</div>
        </div>
      </div>
      <div class="mt-2.5 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        ${[["Sellable", qty(d.verified)], ["Incoming", "+" + qty(d.incoming)],
           ["Demand", "−" + qty(d.dem)], ["Projected", qty(d.projected)],
           ["Target", qty(d.p.targetStock)]]
          .map(([k, v], i) => `<div class="rounded-md ${i === 3 ? "bg-gray-900 text-white" : "bg-gray-50"} px-2 py-1.5">
            <div class="text-[10px] uppercase tracking-wide ${i === 3 ? "text-gray-300" : "text-gray-400"}">${k}</div>
            <div class="text-xs font-semibold tabular-nums">${v}</div></div>`).join("")}
      </div>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span class="text-[11px] text-gray-400">${esc(poNames)}</span>
        <button data-dead="po" class="h-9 px-3 rounded-md border border-gray-200 text-[11px] font-semibold
          text-gray-700 hover:bg-gray-50">Review in Procurement</button>
      </div></div>`;
  }

  /* ===================== BUY — one purchasing decision =====================

     A distributor does not think "incoming risk" and "purchase candidate" and
     "shortfall" and "opportunity". He thinks "kya mangwana hai aur kya nahi".
     Four states of one decision, kept separate because they are genuinely
     different (addendum-015 §11), on one screen because the question is one. */
  const BUY_STATES = [
    /* Today counts SKUs that cannot cover COMMITTED DEMAND. These count SKUs
       BELOW TARGET. Different questions, and linking them as if identical is why
       "2" became "12" with no explanation (addendum-018 F5). The labels now say
       which question each answers. */
    ["need", "Below target, nothing on the way", "red", "Target position not met and no PO placed"],
    ["insufficient", "Ordered, still below target", "red", "A PO exists and the position stays under"],
    ["excess", "Possible over-buy", "amber", "Arriving into stock already above target"],
    ["healthy", "Healthy replenishment", "green", "Arriving, and it lands inside target"],
  ];

  function buyBuckets() {
    const rows = all();
    return {
      need: rows.filter((d) => d.aboveAfter < 0 && d.incoming === 0),
      insufficient: rows.filter((d) => d.incomingState === "insufficient"),
      excess: rows.filter((d) => d.incomingState === "excess")
        .sort((a, b) => b.incomingValue - a.incomingValue),
      healthy: rows.filter((d) => d.incomingState === "healthy"),
    };
  }

  const buyAmount = {
    need: (ds) => ds.reduce((a, d) => a + (d.exposureValue || 0), 0),
    insufficient: (ds) => ds.reduce((a, d) => a + (d.exposureValue || 0), 0),
    excess: (ds) => ds.reduce((a, d) => a + d.incomingValue, 0),
    healthy: (ds) => ds.reduce((a, d) => a + d.incomingValue, 0),
  };
  const buyAmountLabel = {
    need: "demand exposed", insufficient: "demand exposed",
    excess: "arriving", healthy: "arriving",
  };

  function viewBuy() {
    const b = buyBuckets();
    const rows = all();
    const later = rows.reduce((a, d) => a + d.incomingLater.length, 0);
    const laterValue = rows.reduce((a, d) =>
      a + d.incomingLater.reduce((x, i) => x + i.qty * (d.p.cost || 0), 0), 0);
    const opps = opportunities();
    const active = S.buyState;

    const queueCard = `<div class="${CARD} overflow-hidden">
      <div class="px-3 sm:px-4 py-3 border-b border-gray-100">
        <h3 class="text-sm font-semibold text-gray-800">Buying decisions</h3>
        <p class="mt-0.5 text-[11px] text-gray-500">Position after everything landing inside
          ${esc(horizonLabel().toLowerCase())}, once expected demand is served</p>
        ${(() => {
          const below = b.need.length + b.insufficient.length;
          const exposed = [...b.need, ...b.insufficient].filter((d) => d.availability === "short").length;
          return below ? `<p class="mt-1.5 text-[11px] text-gray-600 leading-relaxed">
            <strong class="font-semibold text-gray-800">${below}</strong> SKU${below === 1 ? " is" : "s are"}
            below target. Of those, <strong class="font-semibold text-gray-800">${exposed}</strong>
            cannot cover committed demand ${esc(horizonLabel().toLowerCase())} — the rest are thin on
            cover without an immediate shortfall
            ${info(`Today counts only the ${exposed} with committed-demand exposure. This list is the
              wider set: below the target position, whether or not a customer is waiting.`)}</p>` : "";
        })()}
      </div>
      <div class="divide-y divide-gray-100">
        ${BUY_STATES.map(([k, label, tone, sub]) => {
          const ds = b[k];
          return `<button data-buystate="${k}" class="w-full px-3 sm:px-4 py-3 text-left
            hover:bg-gray-50/70 ${active === k ? "bg-gray-50" : ""} flex items-center gap-3">
            <span class="w-1.5 h-8 rounded-full ${ds.length ? TONE[tone].dot : "bg-gray-200"} shrink-0"></span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-medium text-gray-800">${label}</span>
              <span class="block text-[11px] text-gray-500">${sub}</span>
            </span>
            <span class="shrink-0 text-right">
              <span class="block text-sm font-semibold text-gray-800 tabular-nums">${
                ds.length && buyAmount[k](ds) > 0 ? rsShort(buyAmount[k](ds))
                : ds.length ? "—"
                : (k === "excess" || k === "healthy") && later ? `<span class="text-gray-400 text-xs">none yet</span>`
                : "—"}</span>
              <span class="block text-[11px] text-gray-400">${
                !ds.length && (k === "excess" || k === "healthy") && later
                  ? `none inside ${esc(horizonLabel().toLowerCase())}`
                  : `${ds.length} SKU${ds.length === 1 ? "" : "s"}`}${
                /* "₹0 demand exposed" reads as nothing at stake. Below target and
                   short against demand are different things, and a SKU can be the
                   first without being the second. */
                ds.length ? " · " + (buyAmount[k](ds) > 0 ? buyAmountLabel[k] : "below target only") : ""}</span>
            </span>
          </button>`;
        }).join("")}
        <button data-buystate="opportunity" class="w-full px-3 sm:px-4 py-3 text-left hover:bg-gray-50/70
          ${active === "opportunity" ? "bg-gray-50" : ""} flex items-center gap-3">
          <span class="w-1.5 h-8 rounded-full ${opps.length ? "bg-sky-400" : "bg-gray-200"} shrink-0"></span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-medium text-gray-800">Market demand</span>
            <span class="block text-[11px] text-gray-500">Customers asking for things that are not orders</span>
          </span>
          <span class="shrink-0 text-right">
            <span class="block text-sm font-semibold text-gray-800 tabular-nums">${
              rsShort(opps.reduce((a, o) => a + o.value, 0))}</span>
            <span class="block text-[11px] text-gray-400">${opps.length} product${opps.length === 1 ? "" : "s"} · potential</span>
          </span>
        </button>
      </div>
      ${later ? `<div class="px-3 sm:px-4 py-2.5 border-t border-gray-100 bg-gray-50/60">
        <p class="text-[11px] text-gray-500"><strong class="font-semibold text-gray-700">${rsShort(laterValue)}</strong>
          across ${later} PO${later === 1 ? "" : "s"} arrives after ${esc(horizonLabel().toLowerCase())} and is not
          counted above. Widen the horizon to include ${later === 1 ? "it" : "them"}.</p></div>` : ""}
    </div>`;

    let detail = "";
    if (active === "opportunity") {
      detail = viewOpportunity();
    } else if (active) {
      const ds = b[active];
      const meta = BUY_STATES.find(([k]) => k === active);
      detail = ds.length
        ? section(meta[1], ds, active === "need" ? "insufficient" : active)
        : `<div class="${CARD} px-6 py-10 text-center">
            <p class="text-sm font-semibold text-gray-800">Nothing in ${meta[1].toLowerCase()}</p>
            <p class="mt-1 text-xs text-gray-500">${meta[3]}.</p></div>`;
    }

    return [horizonBar(), queueCard, detail].filter(Boolean).join('<div class="h-2 sm:h-3"></div>');
  }

  /* ===================== NOT WORKING — problems, grouped by kind ============ */
  /* Bands match Today's, word for word. Two surfaces reading the same engine
     should not describe the same money in two vocabularies. */
  const PROBLEM_BAND = { availability: 0, freshness: 0, efficiency: 1, confidence: 2 };
  const PROBLEM_BAND_LABEL = ["Costs you sales", "Ties up your money", "Not yet known"];

  const PROBLEMS = [
    ["availability", "Availability", "red",
     (d) => d.availability !== "covered",
     (ds) => ds.reduce((a, d) => a + (d.exposureValue || 0), 0), "demand exposed"],
    ["freshness", "Freshness", "amber",
     (d) => d.expiring > 0 || d.expired > 0,
     (ds) => ds.reduce((a, d) => a + d.atRiskValue, 0), "at risk"],
    ["efficiency", "Efficiency", "violet",
     (d) => d.position === "overstock" || d.velocity === "declining" || d.velocity === "none",
     (ds) => ds.reduce((a, d) => a + d.cap.overstock + d.cap.declining, 0), "tied up"],
    ["confidence", "Data confidence", "slate",
     (d) => d.unverified > 0 || d.p.unitCost == null,
     (ds) => ds.reduce((a, d) => a + (d.unverifiedValue || 0), 0), "unverified"],
  ];

  function viewNotWorking() {
    const rows = all();
    const groups = PROBLEMS.map(([k, label, tone, test, amount, unit]) => {
      const ds = rows.filter(test).sort((a, b) => a.severity - b.severity);
      return { k, label, tone, ds, amount: amount(ds), unit };
    });
    /* Q31: issues and SKUs are different counts and were being reported as one.
       `total` is issue instances; `affected` is unique SKUs; `multi` is the SKUs
       carrying several problems, which is a property worth showing rather than
       an inconsistency worth hiding. */
    const total = groups.reduce((a, g) => a + g.ds.length, 0);
    const per = new Map();
    groups.forEach((g) => g.ds.forEach((d) => per.set(d.p.id, (per.get(d.p.id) || 0) + 1)));
    const affected = per.size;
    const multi = [...per.entries()].filter(([, n]) => n > 1)
      .map(([id, n]) => ({ d: rows.find((x) => x.p.id === id), n }))
      .sort((a, b) => b.n - a.n);
    const active = S.problem || groups.filter((g) => g.ds.length)[0]?.k;
    const shown = groups.find((g) => g.k === active);

    return [
      horizonBar(),
      `<div class="${CARD} p-3 sm:p-4">
        <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 class="text-sm font-semibold text-gray-800">${affected} SKU${affected === 1 ? "" : "s"} affected</h3>
          <span class="text-sm text-gray-400">·</span>
          <span class="text-sm font-semibold text-gray-800">${total} issue${total === 1 ? "" : "s"}</span>
        </div>
        <p class="mt-0.5 text-[11px] text-gray-500">More issues than SKUs, because a SKU can be short AND
          near expiry AND declining at once. The group counts below are issues, and they do not add up to
          the SKU count ${info(`Deliberate: these are independent dimensions, not one status per product.
            Collapsing them into a single label is what the multi-dimensional model exists to avoid.`)}</p>
        <div class="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-2">
          ${groups.map((g) => `<button data-problem="${g.k}" class="rounded-lg border px-3 py-2.5 text-left
            ${active === g.k ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 hover:bg-gray-50"}">
            <div class="flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full ${TONE[g.tone].dot}"></span>
              <span class="text-[11px] font-medium ${active === g.k ? "text-gray-200" : "text-gray-500"}">${g.label}</span>
            </div>
            <div class="mt-1 text-lg font-bold tabular-nums leading-none">${g.ds.length}</div>
            <div class="text-[11px] ${active === g.k ? "text-gray-300" : "text-gray-400"}">${
              g.amount > 0 ? rsShort(g.amount) + " " + g.unit : "—"}</div>
            <div class="mt-1 text-[10px] uppercase tracking-wide ${
              active === g.k ? "text-gray-400" : "text-gray-300"}">${PROBLEM_BAND_LABEL[PROBLEM_BAND[g.k]]}</div>
          </button>`).join("")}
        </div>
        ${multi.length ? `<p class="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
          <strong class="font-semibold text-gray-700">${multi.length}</strong>
          SKU${multi.length === 1 ? " carries" : "s carry"} more than one problem at once —
          ${multi.slice(0, 3).map((m) => `${esc(m.d.p.name)} (${m.n})`).join(", ")}${
            multi.length > 3 ? ` and ${multi.length - 3} more` : ""}.</p>` : ""}
      </div>`,
      shown && shown.ds.length ? queue(shown.ds) : emptyState(),
    ].join('<div class="h-2 sm:h-3"></div>');
  }

  /* The batch register was a top-level tab. It is reference data — a warehouse
     hand looking for a batch number — so it stays available, one level down,
     rather than competing with a decision for the navigation. */
  function lookupModes() {
    return `<div class="flex rounded-md border border-gray-200 overflow-hidden w-fit">
      ${[["products", "Products"], ["batches", "Batch register"]].map(([k, label]) =>
        `<button data-lookup="${k}" class="h-9 px-3.5 text-xs font-medium ${
          S.lookup === k ? "bg-gray-900 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}">${label}</button>`).join("")}
    </div>`;
  }

  /* ===================== LOOK UP — reference, product-first ================= */
  function viewLookup() {
    if (S.lookup === "batches") return [horizonBar(), lookupModes(), viewBatches()]
      .join('<div class="h-2 sm:h-3"></div>');
    const rows = filtered(true);
    return [
      horizonBar(),
      lookupModes(),
      `<div class="${CARD} p-3 sm:p-4">
        <h3 class="text-sm font-semibold text-gray-800">Look up a product</h3>
        <p class="mt-0.5 text-[11px] text-gray-500">Stock, batches, expiry, capital and demand for any SKU.
          Open a row for the full record.</p>
        <div class="mt-3 flex flex-wrap gap-1.5">
          ${[["", "All stock"], ["nearexpiry", "Has expiry risk"], ["unverified", "Unverified"],
             ["incoming", "Has incoming"]].map(([k, label]) => `<button data-filter="${k}"
            class="h-8 px-3 rounded-md border text-[11px] font-medium ${
              (S.filter || "") === k ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"}">${label}</button>`).join("")}
        </div></div>`,
      `<div class="flex items-baseline justify-between gap-3 pt-1">
        <h3 class="text-sm font-semibold text-gray-800">${rows.length} product${rows.length === 1 ? "" : "s"}</h3>
        <span class="text-[11px] text-gray-400">Alphabetical</span></div>`,
      rows.length ? queue(rows) : emptyState(),
    ].join('<div class="h-2 sm:h-3"></div>');
  }

  /* ---- Opportunity: aggregated from captured demand signals ---- */
  function viewOpportunity() {
    const opps = opportunities();
    const totalSignals = signalRepo.list().length;
    const week = signalRepo.list().filter((s) => daysAgo(s.createdAt) <= 7).length;

    if (!opps.length) return [
      captureBar(),
      `<div class="${CARD} px-6 py-14 text-center">
        <div class="mx-auto w-9 h-9 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center">
          ${icon("sparkles", "w-5 h-5")}</div>
        <p class="mt-3 text-sm font-semibold text-gray-800">No demand signals captured yet</p>
        <p class="mt-1 text-xs text-gray-500 max-w-sm mx-auto">Capture requests from retailer calls, visits or
          sales conversations to build your opportunity pipeline. Signals are potential demand — they never
          affect stock or committed orders.</p>
        <button data-capture="new" class="mt-4 h-10 px-4 rounded-md bg-emerald-600 text-white text-xs font-semibold
          hover:bg-emerald-700">Capture demand</button></div>`,
    ].join('<div class="h-2 sm:h-3"></div>');

    return [
      captureBar(),
      `<div class="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        ${[["Potential demand", rsShort(opps.reduce((a, o) => a + o.value, 0)),
            /* The headline counts only demand that has a price behind it, and
               says how much it is leaving out rather than filling the gap in. */
            opps.some((o) => o.qtyWithoutPrice)
              ? `across ${opps.length} products · ${opps.filter((o) => o.qtyWithoutPrice).length} priced partly`
              : `across ${opps.length} products`],
           ["Demand signals", String(totalSignals), `${week} in the last 7 days`],
           ["Customers asking", String(new Set(signalRepo.list()
              .map((s) => s.customerName || s.customerRef)
              .filter(Boolean)).size), "distinct"],
           ["Not stocked at all", String(opps.filter((o) => !o.listed).length), "new assortment"]]
          .map(([k, v, s]) => `<div class="${CARD} p-3 sm:p-4">
            <div class="text-[11px] font-medium uppercase tracking-wide text-gray-500">${k}</div>
            <div class="mt-1.5 text-xl sm:text-2xl font-bold text-gray-800 tabular-nums leading-none">${v}</div>
            <div class="mt-1.5 text-[11px] text-gray-400">${s}</div></div>`).join("")}
      </div>`,
      `<div class="space-y-2">${opps.map((o) => oppCard(o)).join("")}</div>`,
    ].join('<div class="h-2 sm:h-3"></div>');
  }

  function captureBar() {
    return `<div class="${CARD} p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div class="min-w-0 flex-1">
        <h3 class="text-sm font-semibold text-gray-800">Market opportunities</h3>
        <p class="mt-0.5 text-[11px] text-gray-500">What customers are asking for that has not become an order.
          Potential demand only — it never affects stock, committed orders or available to fulfil.</p>
      </div>
      <button data-capture="new" class="h-10 px-4 shrink-0 rounded-md bg-emerald-600 text-white text-xs
        font-semibold hover:bg-emerald-700">+ Capture demand</button></div>`;
  }

  function oppCard(o) {
    const open = S.openOpp === o.key;
    return `<article class="${CARD} overflow-hidden">
      <div class="p-3.5 sm:p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h4 class="text-sm font-semibold text-gray-900">${esc(o.name)}</h4>
              ${o.listed ? "" : chip("Not stocked", "amber")}
              ${o.reviewed ? chip("Reviewed", "slate") : ""}
            </div>
            ${o.meta ? `<p class="mt-0.5 text-[11px] text-gray-500">${esc(o.meta)}</p>` : ""}
          </div>
          <div class="shrink-0 text-right">
            ${o.value > 0
              ? `<div class="text-base font-bold text-gray-900 tabular-nums leading-none">${rsShort(o.value)}</div>
                 <div class="mt-1 text-[11px] text-gray-400">potential · ${o.basis}</div>`
              : `<div class="text-xs font-medium text-gray-400 leading-tight">Value<br/>unavailable</div>`}
          </div>
        </div>
        <p class="mt-2.5 text-xs text-gray-600 leading-relaxed">
          <strong class="font-semibold text-gray-800">${qty(o.qty)} ${esc(o.unit)}</strong> requested ·
          ${o.customerCount
            ? `<strong class="font-semibold text-gray-800">${o.customerCount}</strong> customer${o.customerCount === 1 ? "" : "s"}`
            : "customer not recorded"} ·
          ${o.signals.length} signal${o.signals.length === 1 ? "" : "s"}${o.repeats ? ` · <strong class="font-semibold text-gray-800">${o.repeats}</strong> repeat request${o.repeats === 1 ? "" : "s"}` : ""}${o.lostSales ? ` · ${o.lostSales} lost sale${o.lostSales === 1 ? "" : "s"}` : ""} ·
          last ${esc(agoLabel(o.lastSeen))}
          ${info(`Aggregated from ${o.signals.length} demand signals. No score — the counts are the evidence.`)}
        </p>
        <p class="mt-1 text-xs text-gray-500">
          Current stock <strong class="font-semibold ${o.stock ? "text-gray-800" : "text-red-600"}">${qty(o.stock)}</strong>${o.listed ? ` · committed ${qty(o.committed)} · sellable ${qty(o.sellable)}` : " · not in the catalogue"}
        </p>
        ${o.qtyWithoutPrice ? `<p class="mt-1 text-[11px] text-gray-400">
          ${qty(o.qtyWithoutPrice)} ${esc(o.unit)} carry no expected price, so their value is not counted here.</p>` : ""}
        <div class="mt-3 flex flex-wrap gap-2">
          <button data-opp="${esc(o.key)}" class="h-9 px-3 rounded-md border border-gray-200 text-xs font-semibold
            text-gray-700 hover:bg-gray-50">${open ? "Hide" : "View"} evidence · ${o.signals.length}</button>
          ${o.product ? `<button data-capture="${esc(o.product.id)}" class="h-9 px-3 rounded-md border border-gray-200
            text-xs font-semibold text-gray-700 hover:bg-gray-50">+ Capture</button>` : ""}
          <button data-oppstatus="reviewed|${esc(o.key)}" class="h-9 px-3 rounded-md border border-gray-200 text-xs
            font-semibold text-gray-700 hover:bg-gray-50">Mark reviewed</button>
          <button data-candidate="${esc(o.key)}" class="h-9 px-3 rounded-md bg-gray-900 text-white text-xs
            font-semibold hover:bg-gray-800">Review purchase opportunity</button>
          <button data-oppstatus="dismissed|${esc(o.key)}" class="h-9 px-3 rounded-md text-xs font-medium
            text-gray-400 hover:text-gray-600">Dismiss</button>
        </div>
      </div>
      ${open ? `<div class="border-t border-gray-100 bg-gray-50/60 px-3.5 sm:px-4 py-3">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Evidence</p>
        <ul class="mt-2 space-y-1.5">${o.signals.slice().sort((a, b) => daysAgo(a.createdAt) - daysAgo(b.createdAt)).map((s) => `
          <li class="flex items-start gap-3 rounded-md bg-white border border-gray-200 px-3 py-2">
            <span class="w-16 shrink-0 text-[11px] text-gray-400">${agoLabel(daysAgo(s.createdAt))}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-xs font-medium text-gray-800">${esc(s.customerName || "Not attributed")}</span>
              <span class="block text-[11px] text-gray-500">${esc(REASON(s.reason))}${s.notes ? " · " + esc(s.notes) : ""}</span>
            </span>
            <span class="shrink-0 text-xs font-semibold tabular-nums text-gray-700">${qty(s.quantity)} ${esc(s.unit)}</span>
          </li>`).join("")}</ul>
        <p class="mt-2 text-[11px] text-gray-400">Opportunity is a signal, not an order. Reviewing it hands the
          decision to Purchase — nothing here creates a PO.</p>
      </div>` : ""}
    </article>`;
  }

  /* ---- capture: fast enough to do on a phone call (brief §32) ---- */
  function captureSheet() {
    if (!S.capture) return "";
    const forNew = S.capture.productId === "new";
    const prod = forNew ? null : S.seed.products.find((p) => p.id === S.capture.productId);
    const field = (label, inner, hint) => `<label class="block">
      <span class="text-[11px] font-medium text-gray-600">${label}</span>
      ${inner}${hint ? `<span class="mt-0.5 block text-[10px] text-gray-400">${hint}</span>` : ""}</label>`;
    const INPUT = "mt-1 w-full h-11 rounded-md border border-gray-200 px-3 text-sm text-gray-800 " +
      "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none";

    return `<div data-overlay class="fixed inset-0 z-[10000] bg-black/40"></div>
      <div class="fixed z-[10001] inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div class="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
          <div class="sticky top-0 bg-white px-4 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
            <div><h2 class="text-sm font-semibold text-gray-900">Capture demand</h2>
              <p class="mt-0.5 text-[11px] text-gray-500">A request that has not become an order.</p></div>
            <button data-close class="p-1.5 -m-1.5 text-gray-400 hover:text-gray-700">${icon("x", "w-4 h-4")}</button>
          </div>
          <form data-captureform class="px-4 py-3 space-y-3">
            ${prod
              ? `<div class="rounded-md bg-gray-50 px-3 py-2.5">
                   <div class="text-sm font-medium text-gray-800">${esc(prod.name)}</div>
                   <div class="text-[11px] text-gray-500">${esc(prod.brand)} · ${esc(prod.pack)} · stock ${qty(prod.physical)}</div>
                 </div><input type="hidden" name="productId" value="${esc(prod.id)}" />`
              : `${field("Product requested", `<input name="newName" required autofocus placeholder="e.g. Amul Greek Yogurt 500g" class="${INPUT}" />`,
                    "Not in your catalogue? That is the point — capture it anyway.")}
                 <div class="grid grid-cols-2 gap-3">
                   ${field("Brand", `<input name="newBrand" placeholder="Amul" class="${INPUT}" />`)}
                   ${field("Pack size", `<input name="newPack" placeholder="500 g" class="${INPUT}" />`)}
                 </div>`}
            <div class="grid grid-cols-2 gap-3">
              ${field("Quantity <span class='text-red-500'>*</span>", `<input name="qty" type="number" min="1" required value="10" class="${INPUT}" />`)}
              ${field("Unit", `<input name="unit" value="${prod ? esc(prod.unit) : "Box"}" class="${INPUT}" />`)}
            </div>
            ${prod ? "" : field("Expected selling price",
              `<div class="mt-1 flex items-center gap-2">
                 <span class="text-sm text-gray-400">₹</span>
                 <input name="expectedPrice" type="number" min="0" step="1" placeholder="180"
                   class="${INPUT} mt-0" /></div>`,
              "Optional. Without it the quantity is still captured and the value reported as unavailable.")}
            ${field("Reason <span class='text-red-500'>*</span>", `<select name="reason" required class="${INPUT}">
              ${(S.seed.signalReasons || []).map((r) => `<option value="${esc(r.key)}">${esc(r.label)}</option>`).join("")}
            </select>`)}
            ${field("Customer", `<select name="customerId" class="${INPUT}">
              <option value="">Not recorded</option>
              ${(S.seed.customers || []).map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")}
            </select>`, "Optional — capture the signal first, attribute it later.")}
            ${field("Frequency", `<select name="frequency" class="${INPUT}">
              <option value="one-off">One-off</option><option value="regular">Regular</option>
            </select>`)}
            ${field("Note", `<input name="notes" placeholder="Wants supply every Monday" class="${INPUT}" />`)}
          </form>
          <div class="sticky bottom-0 bg-white px-4 py-3 border-t border-gray-100 flex gap-2">
            <button data-close class="h-11 flex-1 rounded-md border border-gray-200 text-xs font-semibold text-gray-700">Cancel</button>
            <button data-savecapture class="h-11 flex-[2] rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">Capture</button>
          </div>
        </div></div>`;
  }

  /* The Opportunity → Purchase boundary. This produces a PURCHASE CANDIDATE:
     the evidence a buyer needs, with a suggested quantity they are free to
     ignore. It never creates a purchase order — Purchase owns that decision,
     and the module boundary is the point (addendum-009 §Q15). */
  function candidateSheet() {
    if (!S.candidate) return "";
    const o = opportunities().find((x) => x.key === S.candidate);
    if (!o) return "";
    const row = (k, v, strong) => `<div class="flex items-baseline justify-between py-1.5">
      <span class="text-xs text-gray-500">${k}</span>
      <span class="text-sm tabular-nums ${strong ? "font-semibold text-gray-900" : "text-gray-700"}">${v}</span></div>`;
    return `<div data-overlay class="fixed inset-0 z-[10000] bg-black/40"></div>
      <div class="fixed z-[10001] inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4">
        <div class="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
          <div class="px-4 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold text-gray-900">Purchase candidate</h2>
              <p class="mt-0.5 text-[11px] text-gray-500">${esc(o.name)}</p>
            </div>
            <button data-close class="p-1.5 -m-1.5 text-gray-400 hover:text-gray-700">${icon("x", "w-4 h-4")}</button>
          </div>
          <div class="px-4 py-3">
            <div class="divide-y divide-gray-100">
              ${row("Demand signals", o.signals.length)}
              ${row("Customers asking", o.customerCount || "Not recorded")}
              ${row("Repeat requests", o.repeats || "—")}
              ${row("Requested quantity", qty(o.qty) + " " + esc(o.unit), true)}
              ${row("Current stock", qty(o.stock))}
              ${o.listed ? row("Existing commitments", qty(o.committed)) : ""}
              ${row("Potential demand", o.value > 0 ? rsShort(o.value) : "Unavailable — no price captured")}
              ${row("Suggested quantity", qty(o.suggestedQty) + " " + esc(o.unit), true)}
            </div>
            <p class="mt-3 text-[11px] leading-snug text-gray-500 bg-gray-50 rounded-md p-2.5">
              Suggested quantity is requested demand less what can already be sold. It is a starting
              point for the buyer, not an instruction — Purchase owns the buying decision, and nothing
              here creates a purchase order.</p>
          </div>
          <div class="px-4 py-3 border-t border-gray-100 flex gap-2">
            <button data-close class="h-11 flex-1 rounded-md border border-gray-200 text-xs font-semibold text-gray-700">Close</button>
            <button data-dead="handoff" class="h-11 flex-[2] rounded-md bg-gray-900 text-white text-xs font-semibold">Send to Purchase</button>
          </div>
        </div></div>`;
  }

  function toast() {
    if (!S.toast) return "";
    return `<div class="fixed z-[10002] bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 text-white
      px-4 py-2.5 text-xs font-medium shadow-xl flex items-center gap-2">
      ${icon("checkCircle", "w-4 h-4")}${esc(S.toast)}</div>`;
  }

  /* ---- SKU drawer: the "why" behind a row ---- */
  const skuSignals = (pid) => signalRepo.list().filter((s) => s.productRef === pid);

  function drawer() {
    if (!S.open) return "";
    const p = S.seed.products.find((x) => x.id === S.open);
    if (!p) return "";
    const d = derive(p, S.horizon);
    const days = S.seed.horizons.map((h) => ({ h, dem: demand(p, h.days), sell: sellable(p, h.days) }));
    const line = (k, v, cls) => `<div class="flex items-baseline justify-between py-1.5">
      <span class="text-xs text-gray-500">${k}</span>
      <span class="text-sm font-medium tabular-nums ${cls || "text-gray-800"}">${v}</span></div>`;

    return `<div data-overlay class="fixed inset-0 z-[10000] bg-black/40"></div>
      <aside class="fixed inset-y-0 right-0 z-[10001] w-full sm:w-[27rem] bg-white shadow-2xl flex flex-col">
        <header class="px-4 py-3.5 border-b border-gray-200 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <h2 class="text-sm font-semibold text-gray-900">${esc(p.name)}</h2>${overlayChips(d)}</div>
            <p class="mt-0.5 text-[11px] text-gray-500">${esc(p.articleNumber)} · ${rsShort(d.value)} inventory value</p>
          </div>
          <button data-close class="p-1.5 -m-1.5 text-gray-400 hover:text-gray-700">${icon("x", "w-4 h-4")}</button>
        </header>
        <div class="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          ${causeBlock(d)}
          <div>
            <div class="flex items-center justify-between gap-2">
              <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Stock position</h3>
              <div class="flex flex-wrap gap-1 justify-end">${stateChips(d).map(([l, tn]) => chip(l, tn)).join("")}</div>
            </div>
            <div class="mt-1.5 divide-y divide-gray-100">
              ${line("Physical", qty(d.physical) + " " + p.unit, "text-gray-900 font-semibold")}
              ${line(`Verified sellable ${horizonLabel().toLowerCase()}`, qty(d.verified), "text-gray-900 font-semibold")}
              ${d.expiring ? line("— expires before the horizon", "−" + qty(d.expiring), "text-amber-600") : ""}
              ${d.expired ? line("— expired, awaiting disposition", "−" + qty(d.expired), "text-red-600") : ""}
              ${d.unverified ? line("Unverified", qty(d.unverified), "text-amber-600 font-semibold") : ""}
              ${line("Committed", "−" + qty(d.dem), "text-gray-600")}
            </div>
            <div class="mt-2 rounded-md bg-gray-50 p-2.5">
              <div class="flex items-baseline justify-between">
                <span class="text-xs font-medium text-gray-700">Available to fulfil</span>
                <span class="text-sm font-bold tabular-nums ${d.atp < 0 ? "text-red-600" : "text-emerald-600"}">
                  ${signed(d.atp)} verified</span>
              </div>
              ${d.unverified ? `<div class="mt-1 flex items-baseline justify-between">
                <span class="text-[11px] text-gray-500">plus unverified</span>
                <span class="text-xs font-medium text-amber-600 tabular-nums">+${qty(d.unverified)}</span>
              </div>` : ""}
            </div>
            ${d.expired ? `<p class="mt-2 text-[11px] leading-snug text-red-700 bg-red-50 rounded-md p-2">
              ${qty(d.expired)} ${esc(p.unit)} (${rsShort(d.expiredValue)}) passed expiry and are still on the
              books. They are excluded from sellable, available-to-promise and cover, but stay in recorded
              inventory and its value until a disposal transaction removes them. Inventory reports the
              stock; it does not write the disposal — <strong class="font-semibold">Stock Audit
              Settlement</strong> owns that record.</p>` : ""}
            ${d.unverified ? `<p class="mt-2 text-[11px] leading-snug text-amber-700 bg-amber-50 rounded-md p-2">
              ${icon("alertTriangle", "w-3 h-3 inline align-text-bottom")}
              ${qty(d.unverified)} ${esc(p.unit)} exist physically but carry no batch record, so they cannot be
              guaranteed against ${esc(horizonLabel().toLowerCase())}. They are shown separately rather than
              treated as unavailable${d.unverifiedValue != null ? `, and valued at ${rsShort(d.unverifiedValue)} using this SKU's batch cost` : " — and this SKU has no batch at all, so no value can be estimated"}.</p>` : ""}
          </div>

          <div>
            <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 flex items-center">
              Demand by horizon</h3>
            <div class="mt-1.5 space-y-1">
              ${days.map((x) => {
                const s = Math.max(0, x.dem - x.sell);
                return `<button data-horizon="${x.h.days}" class="w-full flex items-center gap-2 text-left rounded-md px-2 py-1.5
                  ${x.h.days === S.horizon ? "bg-gray-50 ring-1 ring-gray-200" : "hover:bg-gray-50"}">
                  <span class="w-24 shrink-0 text-xs text-gray-600">${esc(x.h.label)}</span>
                  <span class="flex-1 text-right text-xs tabular-nums text-gray-500">${qty(x.dem)} vs ${qty(x.sell)}</span>
                  <span class="w-16 text-right text-xs font-semibold tabular-nums ${s > 0 ? "text-red-600" : "text-emerald-600"}">
                    ${s > 0 ? "−" + qty(s) : "ok"}</span></button>`;
              }).join("")}
            </div>
            <p class="mt-1.5 text-[11px] text-gray-400 leading-snug">From promised delivery dates on open orders. The total across
              ${esc(S.seed.horizons[S.seed.horizons.length - 1].label.toLowerCase())} is the real committed quantity.</p>
          </div>

          <div>
            <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 flex items-center">
              Velocity</h3>
            <div class="mt-1.5 divide-y divide-gray-100">
              ${line("7-day rate", p.sales.d7 + " /day")}
              ${line("30-day rate", p.sales.d30 + " /day")}
              ${line("90-day rate", p.sales.d90 + " /day", "text-gray-500")}
              ${line("vs its own normal",
                p.sales.d90 ? ((p.sales.d30 / p.sales.d90 - 1) * 100).toFixed(0) + "%" : "—",
                d.velocity === "slow" ? "text-violet-600" : d.velocity === "fast" ? "text-emerald-600" : "text-gray-500")}
              ${line("Velocity", DIM.velocity[d.velocity].label,
                d.velocity === "declining" || d.velocity === "none" ? "text-violet-600" : "text-gray-700")}
              ${line("Days on hand", d.doh == null ? "Unavailable" : d.doh.toFixed(1) + "d")}
            </div>
          </div>

          <div>
            <div class="flex items-baseline justify-between gap-2">
              <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Target position</h3>
              <span class="text-[10px] uppercase tracking-wide text-gray-400 rounded px-1.5 py-0.5
                bg-gray-100">Prototype policy</span>
            </div>
            <div class="mt-1.5 divide-y divide-gray-100">
              ${line(`Replenishment demand · ${p.replenishmentDays}d`,
                     qty(Math.round(p.sales.d30 * p.replenishmentDays)), "text-gray-600")}
              ${line(`Safety stock · ${p.safetyDays}d`,
                     qty(Math.round(p.sales.d30 * p.safetyDays)), "text-gray-600")}
              ${line("Target stock", qty(p.targetStock) + " " + p.unit, "text-gray-900 font-semibold")}
              ${line("Current sellable", qty(d.verified), "text-gray-900 font-semibold")}
              ${line(d.verified >= p.targetStock ? "Above target" : "Below target",
                     signed(d.verified - p.targetStock),
                     d.verified >= p.targetStock ? "text-violet-600 font-semibold" : "text-amber-600 font-semibold")}
            </div>
            <p class="mt-1.5 text-[11px] text-gray-400 leading-snug">
              Replenishment-period demand plus safety stock, both from this SKU's 30-day rate.
              Overstock above ${S.seed.policy.overstockAt}×, understocked below ${S.seed.policy.understockAt}×.
              A prototype policy, not a rule discovered in the data.</p>
          </div>

          ${customersBlock(d)}

          ${capitalBlock(d)}

          <div>
            <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Batches</h3>
            <div class="mt-1.5 space-y-1.5">
              ${p.batches.slice().sort((a, b) => a.expiryInDays - b.expiryInDays).map((b) => {
                const t = b.expiryInDays < 0 ? "red" : b.expiryInDays < S.horizon ? "red"
                  : b.expiryInDays < 7 ? "amber" : "slate";
                return `<div class="flex items-center justify-between gap-2 rounded-md border px-2.5 py-2
                  ${b.expiryInDays < 0 ? "border-red-200 bg-red-50/40" : "border-gray-200"}">
                  <div class="min-w-0"><div class="text-[11px] font-mono text-gray-600 truncate">${esc(b.batchNumber)}</div>
                    <div class="text-[11px] text-gray-400">${qty(b.qty)} ${esc(p.unit)} · ${rs(b.cost)}/${esc(p.unit)}
                      ${b.source === "mock" ? " · mock" : ""}</div></div>
                  ${chip(b.expiryInDays < 0 ? `${Math.abs(b.expiryInDays)}d ago` : `${b.expiryInDays}d left`, t)}
                </div>`;
              }).join("")}
            </div>
          </div>
        </div>
        <div class="px-4 pb-3">
          <div class="rounded-lg border border-gray-200 p-3">
            <div class="flex items-baseline justify-between gap-2">
              <h3 class="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Market demand</h3>
              ${skuSignals(p.id).length
                ? `<span class="text-[11px] text-gray-400">${skuSignals(p.id).length} signal${skuSignals(p.id).length === 1 ? "" : "s"}</span>` : ""}
            </div>
            ${skuSignals(p.id).length ? `<p class="mt-1 text-xs text-gray-600">
                <strong class="font-semibold text-gray-800">${qty(skuSignals(p.id).reduce((a, s) => a + s.quantity, 0))} ${esc(p.unit)}</strong>
                requested by ${new Set(skuSignals(p.id).map((s) => s.customerName)).size} customers, beyond committed orders.</p>`
              : `<p class="mt-1 text-xs text-gray-400">No demand signals captured for this SKU.</p>`}
            <button data-capture="${esc(p.id)}" class="mt-2.5 h-9 w-full rounded-md border border-gray-200
              text-xs font-semibold text-gray-700 hover:bg-gray-50">+ Capture demand</button>
          </div>
        </div>
        <footer class="px-4 py-3 border-t border-gray-200 grid grid-cols-2 gap-2">
          <button data-dead="purchase" class="h-10 rounded-md bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700">
            Recommend purchase</button>
          <button data-dead="dispatch" class="h-10 rounded-md border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            Prioritise dispatch</button>
        </footer>
      </aside>`;
  }

  /* ================= filtering + ordering ================= */

  function filtered(alphabetical) {
    let rows = all();
    const q = S.search.trim().toLowerCase();
    if (q) rows = rows.filter((d) => d.p.name.toLowerCase().includes(q));
    if (S.filter === "short") rows = rows.filter((d) => d.availability === "short");
    else if (S.filter === "nearexpiry") rows = rows.filter((d) => d.expiring > 0 || d.expired > 0);
    else if (S.filter === "kvi")
      rows = rows.filter((d) => d.p.isKVI && (d.availability === "short" || d.expiring > 0 || d.expired > 0));
    else if (S.filter === "declining")
      rows = rows.filter((d) => d.velocity === "declining" || d.velocity === "none");
    else if (S.filter === "overstock") rows = rows.filter((d) => d.position === "overstock");
    else if (S.filter === "unverified") rows = rows.filter((d) => d.unverified > 0);
    else if (S.filter === "incoming") rows = rows.filter((d) => d.incoming > 0 || d.incomingLater.length);
    else if (S.filter && CAPITAL[S.filter]) rows = rows.filter((d) => d.cap[S.filter] > 0);

    if (alphabetical) return rows.sort((a, b) => a.p.name.localeCompare(b.p.name));
    /* The queue: severity, then earliest failure, then money at stake. */
    return rows.sort((a, b) =>
      a.severity - b.severity ||
      (a.failDay ?? 99) - (b.failDay ?? 99) ||
      b.value - a.value);
  }

  /* ================= shell ================= */

  /* Five decisions, not eight capabilities. Everything the module can do still
     exists; Incoming, Expiry, Batches, Working capital and Opportunities are
     dimensions OF these decisions rather than destinations beside them
     (addendum-015). The migration map lives in that addendum. */
  const VIEWS = [
    ["today", "Today"], ["buy", "Buy"], ["money", "Money"],
    ["notworking", "Not working"], ["lookup", "Look up"],
  ];

  function tabs() {
    return `<div class="-mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 border-b border-gray-200 bg-white">
      <div class="flex gap-1 overflow-x-auto scrollbar-hide">
        ${VIEWS.map(([k, label]) => `<button data-view="${k}"
          class="px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors
          ${S.view === k ? "border-emerald-600 text-emerald-700" : "border-transparent text-gray-500 hover:text-gray-700"}">
          ${label}</button>`).join("")}
      </div></div>`;
  }

  function skeleton() {
    const bar = (w) => `<div class="h-3 rounded bg-gray-100 animate-pulse" style="width:${w}"></div>`;
    return `<div class="space-y-3">
      <div class="${CARD} p-4 space-y-2">${bar("40%")}${bar("70%")}</div>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        ${Array.from({ length: 4 }, () => `<div class="${CARD} p-4 space-y-2">${bar("50%")}${bar("80%")}</div>`).join("")}</div>
      <div class="${CARD} p-4 space-y-3">${Array.from({ length: 6 }, () => bar("100%")).join("")}</div></div>`;
  }

  function render() {
    const outlet = document.querySelector("[data-page-outlet]");
    if (!outlet) return;
    if (S.loading) { outlet.innerHTML = skeleton(); return; }
    const body =
      S.view === "today" ? viewToday() :
      S.view === "buy" ? viewBuy() :
      S.view === "money" ? viewCapital() :
      S.view === "notworking" ? viewNotWorking() : viewLookup();
    outlet.innerHTML = tabs() + `<div class="pt-3 space-y-2 sm:space-y-3 pb-6">${body}</div>`
      + drawer() + captureSheet() + candidateSheet() + toast();
  }

  const DEAD = {
    owner: "Opens the owning module.\n\nPrototype: Inventory names the cause and who owns the next "
         + "step. It does not write a disposal record, raise a purchase order or settle a stock "
         + "variance — those belong to the module named, and none of them happens here.",
    po: "Opens this purchase order in Procurement.\n\nPrototype: Inventory reports what the PO does to stock and capital. Rescheduling, re-quantifying, approving or cancelling it are Procurement's — nothing here changes a purchase order.",
    wishlist: "Add to the purchase wishlist.\n\nPrototype: this hands off to Procurement, which is a separate module.",
    purchase: "Raise a purchase recommendation for this SKU.\n\nPrototype: this hands off to Procurement, which is a separate module.",
    dispatch: "Prioritise this batch on the next dispatch run.\n\nPrototype: this hands off to Distribution & Logistics, which is a separate module.",
    audit: "Opens this stock in Stock Audit Settlement.\n\nPrototype: Inventory reports how many units carry no batch evidence and what they are worth. Counting, reconciling and settling the variance belong to Stock Audit Settlement — nothing here changes a stock record.",
    handoff: "Purchase candidate sent.\n\nPrototype: Procurement receives the evidence and the suggested quantity, and the buyer decides. No purchase order is created here.",
  };

  /* Writes exactly the record the simulation writes, so every view treats a
     signal captured two seconds ago the same as one that came from the seed. */
  function saveCapture() {
    const f = document.querySelector("[data-captureform]");
    if (!f || !f.reportValidity()) return;
    const v = (n) => (f.elements[n] ? String(f.elements[n].value).trim() : "");
    const cust = (S.seed.customers || []).find((c) => c.id === v("customerId"));
    const prod = S.seed.products.find((x) => x.id === v("productId"));
    const price = Number(v("expectedPrice"));

    signalRepo.add({
      id: "sig-" + Date.now(),
      createdAt: S.seed.asOf,
      productRef: prod ? prod.id : null,
      unlistedProduct: prod ? null : {
        name: v("newName"), brand: v("newBrand") || "", category: "", pack: v("newPack") || "" },
      quantity: Math.max(1, Number(v("qty")) || 1),
      unit: v("unit") || "Box",
      reason: v("reason") || "asked",
      customerRef: cust ? cust.id : null,
      customerName: cust ? cust.name : "",
      frequency: v("frequency") || "one-off",
      /* Optional. A listed SKU already has a selling price, so this only matters
         for something not in the catalogue — and without it the opportunity
         reports its value as unavailable rather than manufacturing one. */
      expectedPrice: prod ? prod.sell : (price > 0 ? price : null),
      notes: v("notes"),
      status: "open",
      source: "captured",
    });

    S.capture = null;
    S.view = "buy";
    S.buyState = "opportunity";
    S.toast = "Demand signal captured";
    setTimeout(() => { S.toast = null; render(); }, 2200);
    render();
  }

  function wire(root) {
    root.addEventListener("click", (e) => {
      const t = (s) => e.target.closest(s);
      let el;
      if ((el = t("[data-dead]"))) {
        window.alert(DEAD[el.dataset.dead.split("|")[0]]); return;
      }
      if ((el = t("[data-savecapture]"))) return saveCapture();
      if ((el = t("[data-candidate]"))) { S.candidate = el.dataset.candidate; return render(); }
      if ((el = t("[data-capture]"))) {
        S.capture = { productId: el.dataset.capture }; S.open = null; return render();
      }
      if ((el = t("[data-brief]"))) {
        const B = {
          short:       ["buy", { buyState: "need" }],
          overbuy:     ["buy", { buyState: "excess" }],
          abovetarget: ["money", {}],
          freshness:   ["notworking", { problem: "freshness" }],
          declining:   ["notworking", { problem: "efficiency" }],
          unverified:  ["notworking", { problem: "confidence" }],
        }[el.dataset.brief];
        if (B) { S.view = B[0]; Object.assign(S, B[1]); S.page = 1; return render(); }
      }
      if ((el = t("[data-lookup]"))) { S.lookup = el.dataset.lookup; S.page = 1; return render(); }
      if ((el = t("[data-buystate]"))) { S.buyState = el.dataset.buystate; return render(); }
      if ((el = t("[data-problem]"))) { S.problem = el.dataset.problem; return render(); }
      if ((el = t("[data-groupby]"))) { S.groupBy = el.dataset.groupby; S.openGroup = null; return render(); }
      if ((el = t("[data-group]"))) {
        S.openGroup = S.openGroup === el.dataset.group ? null : el.dataset.group; return render();
      }
      if ((el = t("[data-opp]"))) {
        S.openOpp = S.openOpp === el.dataset.opp ? null : el.dataset.opp; return render();
      }
      if ((el = t("[data-oppstatus]"))) {
        const [status, key] = el.dataset.oppstatus.split("|");
        signalRepo.setStatus(key, status);
        S.toast = status === "dismissed" ? "Opportunity dismissed" : "Marked as reviewed";
        setTimeout(() => { S.toast = null; render(); }, 2200);
        return render();
      }
      if ((el = t("[data-close]")) || (el = t("[data-overlay]"))) {
        S.open = null; S.capture = null; S.candidate = null; return render();
      }
      if ((el = t("[data-horizon]"))) { S.horizon = Number(el.dataset.horizon); return render(); }
      if ((el = t("[data-view]"))) { S.view = el.dataset.view; S.page = 1; S.filter = null; return render(); }
      if ((el = t("[data-filter]"))) {
        const f = el.dataset.filter;
        S.filter = S.filter === f ? null : f;
        if (el.dataset.goto) S.view = el.dataset.goto;
        S.page = 1; return render();
      }
      if ((el = t("[data-clear]"))) { S.filter = null; S.search = ""; return render(); }
      if ((el = t("[data-page]"))) { if (!el.disabled) { S.page = Number(el.dataset.page); render(); } return; }
      if ((el = t("[data-sku]"))) { S.open = el.dataset.sku; return render(); }
    });
    root.addEventListener("input", (e) => {
      if (!e.target.matches("[data-search]")) return;
      S.search = e.target.value; S.page = 1; render();
      const again = document.querySelector("[data-search]");
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && S.open) { S.open = null; render(); }
    });
  }

  async function mount(opts) {
    const root = document.getElementById("root");
    const shellSeed = await window.MockShell.loadSeed(
      (opts && opts.shellSeed) || "../../seed-data/seed.json");
    window.MockShell.renderShell(root, shellSeed, {
      activePath: "/inventory", pageTitle: "Inventory Intelligence",
    });
    wire(root);
    render();                                   // skeleton while the seed lands
    S.seed = await window.MockShell.loadSeed(
      (opts && opts.seedPath) || "../../seed-data/seed-intelligence.json");
    /* The seed is simply the repository's initial contents. A captured signal
       and a seeded one are the same entity from here on. */
    signalRepo.load(S.seed.demandSignals);
    S.loading = false;
    render();
  }

  /* `_internals` exists for one reason: discovery/checks/check-invariants.mjs
     asserts that demand signals cannot move inventory, and it has to read the
     SAME functions the screens read or it would be proving something else. It is
     a test seam, not an API — nothing in the UI touches it, and no consumer
     should. It exposes no behaviour that the rendered views do not already. */
  window.MockIntel = {
    mount,
    _internals: { state: S, derive, all, totals, opportunities, signalRepo, grouped, GROUPS,
                 causeOf, CAUSES },
  };
})();

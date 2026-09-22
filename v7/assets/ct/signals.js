/* ==========================================================================
   CONTROL TOWER · SIGNALS — detect, weigh, explain.

   DETERMINISTIC, ALL THE WAY DOWN. Every signal here is arithmetic over the
   records in CTState. There is no model in this file and no number that
   cannot be traced to rows: each signal carries the rows it rests on, the
   calculation behind its impact, and the reasons it ranks where it does.

   THE RULES THIS FILE KEEPS
     · Evidence decides capability (D-015). A signal whose evidence is missing
       is not emitted as zero -- it is listed in unavailable() with the reason
       and what would unlock it.
     · An impact that cannot be calculated says so: value null, "Impact not
       yet quantified". A price comes only from an MRP printed in the product's
       own name, and every ₹ says which of the two it is.
     · One signal per kind, its members grouped, its id stable. Repeats are
       the same signal with a new fingerprint, never a second card.
     · Windows anchor on the last record (dataEnd), not on today. An import
       from August is not a business that stopped selling in September.
     · Severity drives rank. Rank is a sum of named parts, and the parts are
       shown to the user as sentences.

   Pure: CTState in, plain objects out. Runs under node for the tests.
   ========================================================================== */

(function (root) {
  "use strict";

  const DAY = 86400000;

  /* Every threshold, in one place, with its meaning. */
  const T = {
    VELOCITY_DAYS: 90,        // demand = units sold over the last 90 days of records
    COVER_RISK_DAYS: 14,      // less than two weeks of stock is a risk
    COVER_URGENT_DAYS: 7,     // less than one week is urgent
    REORDER_DAYS: 30,         // a purchase request covers 30 days of demand…
    SAFETY_DAYS: 7,           // …plus a week of safety stock
    SLOW_DAYS: 90,            // nothing sold in 90 days of records is slow stock
    DEMAND_WINDOW: 45,        // demand lift compares 45 days with the 45 before
    DEMAND_LIFT: 1.5,         // up by half or more
    DEMAND_MIN_UNITS: 12,
    DEMAND_MIN_BUYERS: 3,
    OVERDUE_CRITICAL_DAYS: 60,
    OVERDUE_CRITICAL_VALUE: 100000,
    REMINDER_FRESH_DAYS: 7,   // a reminder sent within a week counts as "done"
    DATA_DELAYED_DAYS: 2,     // records older than this are "delayed", not live
  };

  const SEVERITY = { critical: 400, high: 300, medium: 200, opportunity: 100 };
  const SEVERITY_LABEL = { critical: "Critical", high: "High", medium: "Medium", opportunity: "Opportunity" };

  /* ── formatting (shared with the UI, so the two can never disagree) ──── */
  function inr(n) {
    if (typeof n !== "number" || !isFinite(n)) return null;
    const a = Math.abs(n), s = n < 0 ? "−" : "";
    if (a >= 1e7) return s + "₹" + trim(a / 1e7) + "Cr";
    if (a >= 1e5) return s + "₹" + trim(a / 1e5) + "L";
    if (a >= 1e3) return s + "₹" + trim(a / 1e3) + "K";
    return s + "₹" + Math.round(a).toLocaleString("en-IN");
  }
  function trim(x) { const r = Math.round(x * 10) / 10; return r % 1 ? r.toFixed(1) : String(r); }
  function inrFull(n) { return typeof n === "number" ? "₹" + Math.round(n).toLocaleString("en-IN") : null; }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function fmtDate(s) {
    if (!s) return "";
    const d = new Date(String(s).slice(0, 10) + "T00:00:00Z");
    return d.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()] +
      (d.getUTCFullYear() !== new Date().getUTCFullYear() ? " " + d.getUTCFullYear() : "");
  }
  function daysBetween(a, b) { return Math.round((b - a) / DAY); }
  const dayOf = function (s) { return new Date(String(s).slice(0, 10) + "T00:00:00Z").getTime(); };

  /* A small stable hash, so a signal's fingerprint changes only when its
     members or its severity do. */
  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  /* ── demand, per product ─────────────────────────────────────────────── */
  function demand(state) {
    const out = {};
    const end = state.dataEnd ? dayOf(state.dataEnd) : state.now;
    const from = end - (T.VELOCITY_DAYS - 1) * DAY;
    const lastSold = {}, everBuyers = {};
    state.orders.forEach(function (o) {
      if (o.source !== "import") return;
      const t = dayOf(o.date);
      o.lines.forEach(function (l) {
        if (!lastSold[l.productId] || o.date > lastSold[l.productId]) lastSold[l.productId] = o.date;
        (everBuyers[l.productId] || (everBuyers[l.productId] = {}))[o.customerId] = 1;
        if (t < from) return;
        const d = out[l.productId] || (out[l.productId] = { units: 0, buyers: {} });
        d.units += l.qty; d.buyers[o.customerId] = 1;
      });
    });
    const onOrder = {};
    state.purchaseRequests.forEach(function (pr) {
      if (pr.status !== "raised") return;
      pr.lines.forEach(function (l) { onOrder[l.productId] = (onOrder[l.productId] || 0) + l.qty; });
    });
    return state.products.map(function (p) {
      const d = out[p.id] || { units: 0, buyers: {} };
      const daily = d.units / T.VELOCITY_DAYS;
      const committed = state.committed[p.id] || 0;
      const available = p.stock === null ? null : p.stock - committed;
      return {
        product: p, units90: d.units, daily: daily, buyers: Object.keys(d.buyers),
        everBuyers: Object.keys(everBuyers[p.id] || {}), lastSold: lastSold[p.id] || null,
        committed: committed, available: available, onOrder: onOrder[p.id] || 0,
        cover: available === null ? null : daily > 0 ? available / daily : Infinity,
      };
    });
  }

  function supplierFor(state, product) {
    if (!product.category) return null;
    return state.suppliers.filter(function (s) { return s.category === product.category; })[0] || null;
  }

  /* ── the detectors ───────────────────────────────────────────────────── */

  /* STOCKOUT_RISK — products that sell, with less than two weeks of stock.
     Products whose shortfall a raised purchase request already covers are
     kept as "on order": the signal moves to monitoring, it does not vanish,
     because the shelf is still short until the stock arrives. */
  function detectStockout(state, dem) {
    const low = dem.filter(function (d) {
      return d.available !== null && d.daily > 0 && d.available < d.daily * T.COVER_RISK_DAYS;
    }).sort(function (a, b) { return a.cover - b.cover; });
    if (!low.length) return null;

    const need = function (d) { return Math.max(1, Math.ceil(d.daily * (T.REORDER_DAYS + T.SAFETY_DAYS) - Math.max(d.available, 0))); };
    const covered = function (d) { return d.onOrder >= need(d); };
    const act = low.filter(function (d) { return !covered(d); });
    const onOrder = low.filter(covered);
    const monitoring = !act.length;
    const basis = monitoring ? low : act;

    const out = basis.filter(function (d) { return d.available <= 0; });
    const buyers = {};
    basis.forEach(function (d) { d.buyers.forEach(function (b) { buyers[b] = 1; }); });
    const nBuyers = Object.keys(buyers).length;
    const hotOut = out.filter(function (d) { return d.buyers.length >= 3; });
    const urgent = basis.filter(function (d) { return d.cover < T.COVER_URGENT_DAYS; });

    const severity = monitoring ? "medium" : hotOut.length ? "critical" : (out.length || urgent.length) ? "high" : "medium";

    /* Impact: 30 days of demand that stock cannot meet, at MRP. */
    const priced = act.filter(function (d) { return d.product.mrp; });
    const exposure = priced.reduce(function (n, d) {
      return n + Math.max(0, d.daily * T.REORDER_DAYS - Math.max(d.available, 0)) * d.product.mrp;
    }, 0);
    const impact = monitoring
      ? { type: "revenue", value: null, description: "Covered by purchase requests — waiting for stock",
          calc: "Every short product has a raised purchase request for at least 30 days of demand plus a week's safety." }
      : priced.length
      ? { type: "revenue", value: Math.round(exposure), description: inr(exposure) + " of sales at risk",
          calc: "For each product: (units sold per day over the last 90 days of records × 30 − stock you have) × the MRP in its name. " +
            priced.length + " of " + act.length + " products carry an MRP" +
            (priced.length < act.length ? "; the other " + (act.length - priced.length) + " are not counted." : ".") }
      : { type: "revenue", value: null, description: "No value in your records",
          calc: "None of these products has a price in your records." };

    const lines = act.map(function (d) {
      const sup = supplierFor(state, d.product);
      return { productId: d.product.id, name: d.product.name, qty: need(d), unit: d.product.unit,
               mrp: d.product.mrp, supplierId: sup ? sup.id : null, supplierName: sup ? sup.name : null };
    });

    const title = monitoring
      ? plural(low.length, "product is", "products are") + " on order"
      : out.length === act.length
        ? plural(act.length, "product is", "products are") + " out of stock"
        : plural(act.length, "product", "products") + " may run out in 2 weeks";

    return {
      id: "stockout", type: "STOCKOUT_RISK", domain: "inventory", severity: severity,
      title: title,
      summary: monitoring
        ? "Short until the stock arrives."
        : (out.length && out.length < act.length ? out.length + " already at zero. " : "") +
          plural(nBuyers, "customer") + " bought them in the last 90 days.",
      impact: impact,
      affected: { customers: nBuyers, products: basis.length },
      evidence: [
        { metric: "Units sold per day", value: "over the last " + T.VELOCITY_DAYS + " days of records" },
        { metric: "Stock", value: stockBasis(state) },
        { metric: "Open orders from FoodBridge", value: Object.keys(state.committed).length ? "counted against stock" : "none" },
      ],
      why: monitoring
        ? ["Stock on hand is below two weeks of demand for " + plural(low.length, "product") + ".",
           "Raised purchase requests cover all of them."]
        : ["Stock on hand is below two weeks of demand.",
           out.length === act.length ? null : out.length ? out.length + " of them have none left." : "None has run out yet.",
           onOrder.length ? onOrder.length + " more are already on order." : "No purchase request covers them yet."].filter(Boolean),
      rows: basis.map(function (d) {
        return { id: d.product.id, kind: "product", title: d.product.name,
                 cells: [d.available <= 0 ? "Out of stock" : fmtCover(d.cover),
                         plural(Math.round(d.daily * 30), "unit") + "/month",
                         plural(d.buyers.length, "customer")],
                 tone: d.available <= 0 ? "bad" : d.cover < T.COVER_URGENT_DAYS ? "warn" : "",
                 note: covered(d) ? "On order: " + d.onOrder + " " + (d.product.unit || "units") : null };
      }),
      recommendation: monitoring ? null : {
        title: "Raise a purchase request for " + plural(act.length, "product"),
        description: "Enough for 30 days of demand plus a week's safety, less what you have. " +
          (lines.some(function (l) { return l.supplierName; }) ? "Suppliers from your records." : "No supplier on file — you choose who to buy from."),
        actionType: "create_purchase_request", cta: "Review & reorder", lines: lines,
      },
      priority: {
        urgency: hotOut.length ? 40 : out.length ? 35 : urgent.length ? 30 : 15,
        confidence: 20,
        reasons: [
          out.length ? out.length + " already out of stock" : urgent.length ? urgent.length + " have under a week of stock" : null,
          nBuyers ? plural(nBuyers, "customer") + " buy these products" : null,
        ],
      },
      phase: monitoring ? "monitoring" : null,
      members: basis.map(function (d) { return d.product.id + (covered(d) ? ":oo" : ""); }),
    };
  }

  function fmtCover(c) {
    if (!isFinite(c)) return "Plenty";
    const d = Math.floor(c);
    return d < 1 ? "Under a day left" : plural(d, "day") + " left";
  }
  function stockBasis(state) {
    return state.source.kind === "export"
      ? "counted at the import" + (state.source.importedAt ? " on " + fmtDate(state.source.importedAt) : "")
      : "from " + state.source.label;
  }

  /* ORDER_RISK — orders made in FoodBridge that stock cannot fill. */
  function detectOrderRisk(state) {
    if (!state.made.length) return null;
    const left = {};
    state.products.forEach(function (p) { if (p.stock !== null) left[p.id] = p.stock; });
    const onOrder = {};
    state.purchaseRequests.forEach(function (pr) {
      if (pr.status === "raised") pr.lines.forEach(function (l) { onOrder[l.productId] = (onOrder[l.productId] || 0) + l.qty; });
    });
    const risky = [];
    state.made.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (o) {
      const short = [];
      (o.lines || []).forEach(function (l) {
        const q = Number(l.qty) || 0;
        if (q <= 0 || !(l.productId in left)) return;
        const have = left[l.productId];
        if (have < q) short.push({ productId: l.productId, name: l.name || (state.productById[l.productId] || {}).name, short: q - Math.max(have, 0) });
        left[l.productId] = have - q;
      });
      if (short.length) risky.push({ order: o, short: short });
    });
    if (!risky.length) return null;

    const shortBy = {};
    risky.forEach(function (r) { r.short.forEach(function (s) { shortBy[s.productId] = (shortBy[s.productId] || 0) + s.short; }); });
    const allOnOrder = Object.keys(shortBy).every(function (pid) { return (onOrder[pid] || 0) >= shortBy[pid]; });
    const value = risky.reduce(function (n, r) {
      if (typeof r.order.amount === "number") return n + r.order.amount;
      return n + (r.order.lines || []).reduce(function (m, l) {
        const p = state.productById[l.productId]; return m + (p && p.mrp ? p.mrp * (Number(l.qty) || 0) : 0);
      }, 0);
    }, 0);
    const custs = {};
    risky.forEach(function (r) { custs[r.order.customerId] = 1; });

    return {
      id: "order-risk", type: "ORDER_RISK", domain: "orders",
      severity: allOnOrder ? "medium" : "critical",
      title: plural(risky.length, "order") + " can't be filled from stock",
      summary: plural(Object.keys(shortBy).length, "product") + " short for " + plural(Object.keys(custs).length, "customer") + ".",
      impact: value > 0
        ? { type: "revenue", value: Math.round(value), description: inr(value) + " of orders waiting",
            calc: "The value of the affected orders: their own amount, or their lines at the MRP in each product's name." }
        : { type: "revenue", value: null, description: "No value in your records", calc: "These orders carry no amount and their products no MRP." },
      affected: { customers: Object.keys(custs).length, products: Object.keys(shortBy).length, orders: risky.length },
      evidence: [{ metric: "Stock", value: stockBasis(state) }, { metric: "Orders", value: "made in FoodBridge since the import" }],
      why: ["Stock on hand, less earlier orders, is less than these orders need.",
            allOnOrder ? "Purchase requests cover the shortfall." : "No purchase request covers the shortfall yet."],
      rows: risky.map(function (r) {
        return { id: r.order.no, kind: "order", title: r.order.no + " · " + r.order.customer,
                 cells: [r.short.map(function (s) { return s.short + " × " + short(s.name); }).join(", ")], tone: "bad" };
      }),
      recommendation: allOnOrder ? null : {
        title: "Raise a purchase request for the " + plural(Object.keys(shortBy).length, "short product"),
        description: "Exactly what these orders are short, so they can ship.",
        actionType: "create_purchase_request", cta: "Order the shortfall",
        lines: Object.keys(shortBy).filter(function (pid) { return (onOrder[pid] || 0) < shortBy[pid]; }).map(function (pid) {
          const p = state.productById[pid] || { name: pid };
          const sup = supplierFor(state, p);
          return { productId: pid, name: p.name, qty: shortBy[pid] - (onOrder[pid] || 0), unit: p.unit, mrp: p.mrp || null,
                   supplierId: sup ? sup.id : null, supplierName: sup ? sup.name : null };
        }),
      },
      priority: { urgency: 40, confidence: 20, reasons: ["a customer is waiting on " + (risky.length === 1 ? "this order" : "these orders")] },
      phase: allOnOrder ? "monitoring" : null,
      members: risky.map(function (r) { return r.order.no; }),
    };
  }
  function short(name) { const s = String(name || ""); return s.length > 28 ? s.slice(0, 26) + "…" : s; }

  /* REORDER_DUE — shops past their own ordering cycle (the evidence layer's
     rule). The most overdue are often the ones too stale to predict from; they
     are listed, never given a quantity (D-017). */
  function detectReorderDue(state) {
    const shops = (state.missed && state.missed.shops) || [];
    if (!shops.length) return null;
    const cad = {};
    state.cadence.forEach(function (c) { cad[c.id] = c; });
    const withSug = shops.filter(function (s) { return s.suggestion && s.suggestion.count; });
    const worst = shops[0];
    const missedCycle = shops.filter(function (s) { return s.cycleDays && s.daysOverdue > s.cycleDays; });
    const vals = shops.map(function (s) { return cad[s.id] && cad[s.id].avgValue; }).filter(function (v) { return typeof v === "number" && v > 0; });
    const value = vals.reduce(function (n, v) { return n + v; }, 0);

    return {
      id: "reorder-due", type: "CUSTOMER_INACTIVITY", domain: "customers",
      severity: missedCycle.length ? "high" : "medium",
      title: plural(shops.length, "customer is", "customers are") + " late to reorder",
      summary: "Most late: " + worst.name + ", " + plural(worst.daysOverdue, "day") + " late on a " + worst.cycleDays + "-day cycle.",
      impact: vals.length
        ? { type: "revenue", value: Math.round(value), description: inr(value) + " in usual orders not placed",
            calc: "One usual order from each customer: the average value of their own past orders. " +
              vals.length + " of " + shops.length + " customers have valued orders." }
        : { type: "revenue", value: null, description: "No value in your records", calc: "These orders carry no value in your records." },
      affected: { customers: shops.length },
      evidence: [{ metric: "Cycle", value: "each customer's own median gap between orders" },
                 { metric: "Suggested orders", value: "from the reorder engine, back-tested on your history" }],
      why: [plural(missedCycle.length, "customer has", "customers have") + " missed a whole cycle or more.",
            withSug.length + " have enough recent history for a suggested order.",
            shops.length - withSug.length ? (shops.length - withSug.length) + " have gone quiet too long to predict. Call them." : null].filter(Boolean),
      rows: shops.map(function (s) {
        const c = cad[s.id] || {};
        return { id: s.id, kind: "customer", title: s.name,
                 cells: [plural(s.daysOverdue, "day") + " late",
                         s.cycleDays + "-day cycle",
                         typeof c.avgValue === "number" && c.avgValue > 0 ? inr(c.avgValue) + " usual" : "—"],
                 tone: s.cycleDays && s.daysOverdue > s.cycleDays ? "warn" : "",
                 note: s.suggestion && s.suggestion.count ? plural(s.suggestion.count, "line") + " suggested" : "No recent history" };
      }),
      recommendation: withSug.length ? {
        title: "Prepare orders for " + plural(withSug.length, "customer"),
        description: "Each from what that customer usually buys. You review every line before anything is created.",
        actionType: "create_orders", cta: "Review orders",
        shops: withSug.map(function (s) { return { customerId: s.id, name: s.name, lines: s.suggestion.lines }; }),
      } : {
        title: "Call these " + plural(shops.length, "customer"),
        description: "Too long since their last order to suggest one. A call list keeps them from going cold.",
        actionType: "create_followup", cta: "Make a call list",
        customers: shops.map(function (s) { return { customerId: s.id, name: s.name }; }),
      },
      priority: { urgency: Math.min(40, Math.round(worst.daysOverdue / 3)), confidence: 15,
                  reasons: [missedCycle.length ? plural(missedCycle.length, "customer has", "customers have") + " missed a whole cycle" : null] },
      phase: null,
      members: shops.map(function (s) { return s.id; }),
    };
  }

  /* SALES_OPPORTUNITY — shops a few days past their cycle: call before they
     join the list above. */
  function detectReorderSoon(state) {
    const s = state.cadence.filter(function (c) { return c.bucket === "slipping"; })
      .sort(function (a, b) { return b.daysOverdue - a.daysOverdue; });
    if (!s.length) return null;
    const vals = s.map(function (c) { return c.avgValue; }).filter(function (v) { return typeof v === "number" && v > 0; });
    const value = vals.reduce(function (n, v) { return n + v; }, 0);
    return {
      id: "reorder-soon", type: "SALES_OPPORTUNITY", domain: "sales", severity: "opportunity",
      title: plural(s.length, "customer is", "customers are") + " due to reorder",
      summary: "Just past their usual day.",
      impact: vals.length
        ? { type: "revenue", value: Math.round(value), description: inr(value) + " in usual orders",
            calc: "One usual order from each customer, at the average value of their own past orders." }
        : { type: "revenue", value: null, description: "No value in your records", calc: "No order values in your records." },
      affected: { customers: s.length },
      evidence: [{ metric: "Cycle", value: "each customer's own median gap between orders" }],
      why: ["Up to five days past their own cycle. Not late yet."],
      rows: s.map(function (c) {
        return { id: c.id, kind: "customer", title: c.name,
                 cells: [plural(c.daysOverdue, "day") + " past", c.cycleDays + "-day cycle",
                         typeof c.avgValue === "number" && c.avgValue > 0 ? inr(c.avgValue) + " usual" : "—"] };
      }),
      recommendation: {
        title: "Add them to today's call list", description: "One list, so nobody is called twice.",
        actionType: "create_followup", cta: "Make a call list",
        customers: s.map(function (c) { return { customerId: c.id, name: c.name }; }),
      },
      priority: { urgency: 10, confidence: 15, reasons: ["cheaper to keep a customer on cycle than to win them back"] },
      phase: null,
      members: s.map(function (c) { return c.id; }),
    };
  }

  /* PAYMENT_OVERDUE — invoices past their due date with money still owed.
     Only when the session holds invoices; otherwise see unavailable(). */
  function detectOverdue(state) {
    const inv = state.ledger && state.ledger.invoices;
    if (!inv) return null;
    const today = state.now;
    const late = inv.filter(function (i) { return i.balance > 0 && i.dueDate && dayOf(i.dueDate) < today; });
    if (!late.length) return null;
    const by = {};
    late.forEach(function (i) {
      const c = by[i.customerId] || (by[i.customerId] = { customerId: i.customerId, amount: 0, invoices: [], oldest: 0 });
      c.amount += i.balance; c.invoices.push(i);
      c.oldest = Math.max(c.oldest, daysBetween(dayOf(i.dueDate), today));
    });
    const list = Object.keys(by).map(function (k) { return by[k]; }).sort(function (a, b) { return b.amount - a.amount; });
    const total = list.reduce(function (n, c) { return n + c.amount; }, 0);
    /* The fewest customers that make up 70% of it, at most five. */
    const top = []; let acc = 0;
    for (const c of list) { if (top.length >= 5 || (acc >= total * 0.7 && top.length)) break; top.push(c); acc += c.amount; }
    const share = Math.round(acc / total * 100);
    const oldest = list.reduce(function (n, c) { return Math.max(n, c.oldest); }, 0);
    const name = function (id) { return state.customerById[id] || id; };
    const recent = state.outbox.filter(function (m) { return state.now - new Date(m.createdAt).getTime() < T.REMINDER_FRESH_DAYS * DAY; });
    const reminded = {};
    recent.forEach(function (m) { reminded[m.customerId] = m.createdAt; });
    const toRemind = top.filter(function (c) { return !reminded[c.customerId]; });
    const monitoring = !toRemind.length;

    return {
      id: "overdue", type: "PAYMENT_OVERDUE", domain: "cash",
      severity: monitoring ? "medium" : oldest > T.OVERDUE_CRITICAL_DAYS && total >= T.OVERDUE_CRITICAL_VALUE ? "critical" : "high",
      title: inr(total) + " overdue from " + plural(list.length, "customer"),
      summary: (top.length > 1 ? top.length + " customers owe " + share + "% of it. " : name(top[0].customerId) + " owes " + share + "% of it. ") +
        "Oldest: " + plural(oldest, "day") + " late.",
      impact: { type: "cash", value: Math.round(total), description: inr(total) + " owed to you",
                calc: "Unpaid balances on invoices past their due date, from " + state.source.label + "." },
      affected: { customers: list.length, invoices: late.length },
      evidence: [{ metric: "Invoices", value: plural(late.length, "invoice") + " past due", sourceRef: state.source.label }],
      why: ["Due dates have passed with balances still open.",
            monitoring ? "You reminded them in the last week." : null].filter(Boolean),
      rows: list.map(function (c) {
        return { id: c.customerId, kind: "customer", title: name(c.customerId),
                 cells: [inr(c.amount), plural(c.oldest, "day") + " late", plural(c.invoices.length, "invoice")],
                 tone: c.oldest > T.OVERDUE_CRITICAL_DAYS ? "bad" : "warn",
                 note: reminded[c.customerId] ? "Reminded " + fmtDate(reminded[c.customerId]) : null };
      }),
      recommendation: monitoring ? null : {
        title: "Remind the " + plural(toRemind.length, "customer") + " who owe the most first",
        description: "A WhatsApp reminder each, with the invoices and amounts. You see every message before it goes.",
        actionType: "send_reminders", cta: "Prepare reminders",
        customers: toRemind.map(function (c) {
          return { customerId: c.customerId, name: name(c.customerId), amount: Math.round(c.amount), days: c.oldest,
                   invoices: c.invoices.map(function (i) { return i.number || i.id; }) };
        }),
      },
      priority: { urgency: oldest > T.OVERDUE_CRITICAL_DAYS ? 35 : 20, confidence: 20,
                  reasons: [oldest > 30 ? "the oldest is " + plural(oldest, "day") + " past due" : null,
                            top.length < list.length ? top.length + " customers are " + share + "% of it" : null] },
      phase: monitoring ? "monitoring" : null,
      members: list.map(function (c) { return c.customerId; }),
    };
  }

  /* DEAD_STOCK — stock on hand that has not sold in 90 days of records. */
  function detectSlowStock(state, dem) {
    const slow = dem.filter(function (d) { return d.available !== null && d.available > 0 && d.units90 === 0; })
      .sort(function (a, b) { return (b.available * (b.product.mrp || 0)) - (a.available * (a.product.mrp || 0)); });
    if (!slow.length) return null;
    const priced = slow.filter(function (d) { return d.product.mrp; });
    const value = priced.reduce(function (n, d) { return n + d.available * d.product.mrp; }, 0);
    const pastBuyers = {};
    slow.forEach(function (d) { d.everBuyers.forEach(function (b) { pastBuyers[b] = 1; }); });
    const pb = Object.keys(pastBuyers);

    return {
      id: "slow-stock", type: "DEAD_STOCK", domain: "inventory", severity: "medium",
      title: plural(slow.length, "product", "products") + " unsold for 90 days",
      summary: pb.length ? plural(pb.length, "customer has", "customers have") + " bought them before." : "No customer has bought them.",
      impact: priced.length
        ? { type: "inventory", value: Math.round(value), description: inr(value) + " of stock at MRP",
            calc: "Units on hand × the MRP in each product's name. " + priced.length + " of " + slow.length + " carry an MRP." }
        : { type: "inventory", value: null, description: "No value in your records", calc: "No price for these products in your records." },
      affected: { products: slow.length, customers: pb.length },
      evidence: [{ metric: "Sales", value: "none in the last " + T.SLOW_DAYS + " days of records" }, { metric: "Stock", value: stockBasis(state) }],
      why: ["On the shelf, and none sold in 90 days of orders."],
      rows: slow.map(function (d) {
        return { id: d.product.id, kind: "product", title: d.product.name,
                 cells: [d.available + " on hand", d.lastSold ? "Last sold " + fmtDate(d.lastSold) : "Never sold",
                         d.product.mrp ? inr(d.available * d.product.mrp) : "—"] };
      }),
      recommendation: pb.length ? {
        title: "Offer them to " + plural(pb.length, "past buyer"),
        description: "A call list of past buyers, with what each used to take.",
        actionType: "create_followup", cta: "Make a call list",
        customers: pb.map(function (id) { return { customerId: id, name: state.customerById[id] || id }; }),
      } : null,
      priority: { urgency: 5, confidence: 20, reasons: ["cash is sitting on the shelf"] },
      phase: null,
      members: slow.map(function (d) { return d.product.id; }),
    };
  }

  /* SALES_OPPORTUNITY — demand up by half or more across several shops. */
  function detectDemandUp(state) {
    if (!state.dataEnd) return null;
    const end = dayOf(state.dataEnd);
    const w = T.DEMAND_WINDOW * DAY;
    const agg = {};
    state.orders.forEach(function (o) {
      if (o.source !== "import") return;
      const t = dayOf(o.date);
      const bucket = t > end - w ? "now" : t > end - 2 * w ? "before" : null;
      if (!bucket) return;
      o.lines.forEach(function (l) {
        const a = agg[l.productId] || (agg[l.productId] = { now: 0, before: 0, buyers: {} });
        a[bucket] += l.qty;
        if (bucket === "now") a.buyers[o.customerId] = 1;
      });
    });
    const up = Object.keys(agg).map(function (pid) { return { p: state.productById[pid], a: agg[pid] }; })
      .filter(function (x) {
        return x.p && x.a.now >= T.DEMAND_MIN_UNITS && Object.keys(x.a.buyers).length >= T.DEMAND_MIN_BUYERS &&
          x.a.now >= x.a.before * T.DEMAND_LIFT;
      })
      .sort(function (a, b) { return (b.a.now - b.a.before) - (a.a.now - a.a.before); });
    if (!up.length) return null;
    const top = up[0];
    const lift = function (x) { return x.a.before ? Math.round((x.a.now / x.a.before - 1) * 100) : null; };
    const priced = up.filter(function (x) { return x.p.mrp; });
    const value = priced.reduce(function (n, x) { return n + (x.a.now - x.a.before) * x.p.mrp; }, 0);
    const buyers = {};
    up.forEach(function (x) { Object.keys(x.a.buyers).forEach(function (b) { buyers[b] = 1; }); });

    return {
      id: "demand-up", type: "SALES_OPPORTUNITY", domain: "sales", severity: "opportunity",
      title: "Demand is up for " + plural(up.length, "product"),
      summary: "Top: " + short(top.p.name) + ", " + top.a.now + " units in 45 days" +
        (lift(top) !== null ? ", up " + lift(top) + "%" : "") + ".",
      impact: priced.length
        ? { type: "revenue", value: Math.round(value), description: inr(value) + " more if it holds",
            calc: "The extra units sold in the last 45 days of records over the 45 before, at the MRP in each name — a potential, not a forecast." }
        : { type: "revenue", value: null, description: "No value in your records", calc: "No price for these products in your records." },
      affected: { products: up.length, customers: Object.keys(buyers).length },
      evidence: [{ metric: "Demand", value: "last 45 days of records against the 45 before" }],
      why: ["Units sold rose by half or more, across at least " + T.DEMAND_MIN_BUYERS + " customers."],
      rows: up.map(function (x) {
        return { id: x.p.id, kind: "product", title: x.p.name,
                 cells: [x.a.now + " units", lift(x) !== null ? "+" + lift(x) + "%" : "new", plural(Object.keys(x.a.buyers).length, "customer")] };
      }),
      recommendation: {
        title: "Offer them to customers who don't buy them yet",
        description: "A call list of your active customers not yet buying these products.",
        actionType: "create_followup", cta: "Make a call list",
        customers: state.cadence.filter(function (c) { return c.bucket === "on_track" && !buyers[c.id]; })
          .map(function (c) { return { customerId: c.id, name: c.name }; }),
      },
      priority: { urgency: 5, confidence: 10, reasons: ["demand is moving in your favour"] },
      phase: null,
      members: up.map(function (x) { return x.p.id; }),
    };
  }

  /* ── what cannot be computed, and what would unlock it ───────────────── */
  function unavailable(state) {
    const out = [];
    const l = state.ledger;
    if (!l || !l.invoices) out.push({ id: "cash", title: "Cash and receivables",
      reason: "No invoices or payments in your records.", unlock: "Connect Zoho Books or Xero, or add your invoices." });
    out.push({ id: "delivery", title: "Delivery and routes",
      reason: "No delivery or route records for this business.", unlock: "Start delivering with FoodBridge routes." });
    out.push({ id: "expiry", title: "Expiry risk",
      reason: "No batch or expiry dates in your stock records.", unlock: "Record batches and expiry dates when stock comes in." });
    out.push({ id: "supplier-delay", title: "Supplier delays",
      reason: l && l.purchaseOrders ? "Your purchase orders carry no expected delivery dates." : "No purchase orders in your records.",
      unlock: "Raise purchase orders in FoodBridge with an expected date." });
    return out;
  }

  /* ── freshness ───────────────────────────────────────────────────────── */
  function freshness(state) {
    const s = state.source;
    const when = s.readAt ? new Date(s.readAt).getTime() : s.importedAt ? dayOf(s.importedAt) : null;
    const age = when !== null ? Math.max(0, Math.floor((state.now - when) / DAY)) : null;
    const lastAge = state.dataEnd ? Math.max(0, Math.floor((state.now - dayOf(state.dataEnd)) / DAY)) : null;
    const delayed = age === null || age > T.DATA_DELAYED_DAYS;
    /* Sample data is labelled for what it is, source by source too. */
    const st = function (ok) { return !ok ? "unavailable" : s.sample ? "sample" : delayed ? "delayed" : "synced"; };
    const sources = [
      { id: "orders", label: "Orders", state: st(true),
        detail: (s.kind === "export" ? "Imported " : "Read ") + (when ? fmtDate(new Date(when).toISOString()) : "—") +
          (state.dataEnd ? " · latest " + fmtDate(state.dataEnd) : "") },
      { id: "stock", label: "Stock", state: st(true), detail: "Counted " + (s.kind === "export" ? "at the import" : "when read") },
      { id: "cash", label: "Invoices & payments", state: st(l(state)),
        detail: l(state) ? state.source.label : "Not in your records" },
      { id: "delivery", label: "Delivery", state: "unavailable", detail: "Not connected" },
      { id: "made", label: "Orders made in FoodBridge", state: "live", detail: "On this device" },
    ];
    /* Sample data is read fresh but is built from the export, so it is never
       called up to date: it is labelled for what it is, end to end. */
    return { age: age, lastRecordAge: lastAge, delayed: delayed, sample: !!s.sample, label: s.label,
             headline: s.sample ? "Sample data" : delayed ? "Data delayed" : "Up to date",
             state: s.sample ? "sample" : delayed ? "delayed" : "synced", when: when, sources: sources };
    function l(st) { return !!(st.ledger && st.ledger.invoices); }
  }

  /* ── ranking ─────────────────────────────────────────────────────────── */
  function impactPoints(v) {
    if (typeof v !== "number") return 0;
    return v >= 5e5 ? 60 : v >= 1e5 ? 45 : v >= 2.5e4 ? 30 : v >= 5e3 ? 15 : 5;
  }
  function weigh(sig) {
    const p = sig.priority || {};
    const parts = {
      severity: SEVERITY[sig.severity] || 0,
      impact: impactPoints(sig.impact && sig.impact.value),
      urgency: p.urgency || 0,
      customers: Math.min(30, 3 * ((sig.affected && sig.affected.customers) || 0)),
      confidence: p.confidence || 0,
    };
    const score = parts.severity + parts.impact + parts.urgency + parts.customers + parts.confidence;
    const reasons = [SEVERITY_LABEL[sig.severity] + (sig.severity === "opportunity" ? "" : " severity")]
      .concat(sig.impact && typeof sig.impact.value === "number" ? [sig.impact.description] : ["no value in your records"])
      .concat((p.reasons || []).filter(Boolean));
    sig.priority = { score: score, parts: parts, reasons: reasons,
                     urgency: p.urgency || 0, confidence: p.confidence || 0 };
    sig.fingerprint = hash(sig.severity + "|" + (sig.members || []).slice().sort().join(","));
    return sig;
  }
  function rank(list) {
    return list.slice().sort(function (a, b) {
      return b.priority.score - a.priority.score ||
        ((b.impact && b.impact.value) || 0) - ((a.impact && a.impact.value) || 0);
    });
  }

  /* ── the whole pass ──────────────────────────────────────────────────── */
  const DETECTORS = [
    function (s) { return detectOrderRisk(s); },
    function (s, d) { return detectStockout(s, d); },
    function (s) { return detectOverdue(s); },
    function (s) { return detectReorderDue(s); },
    function (s, d) { return detectSlowStock(s, d); },
    function (s) { return detectDemandUp(s); },
    function (s) { return detectReorderSoon(s); },
  ];

  function detect(state) {
    const dem = demand(state);
    const errors = [];
    const found = [];
    DETECTORS.forEach(function (fn, i) {
      try { const s = fn(state, dem); if (s) found.push(weigh(s)); }
      catch (e) { errors.push({ detector: i, message: String(e && e.message || e) }); }
    });
    return { signals: rank(found), errors: errors, demand: dem };
  }

  /* ── pulse ───────────────────────────────────────────────────────────── */
  function salesSeries(state) {
    /* Order values where the records carry them; invoice totals otherwise. */
    const valued = state.orders.filter(function (o) { return o.source === "import" && typeof o.value === "number"; });
    if (valued.length) return { basis: "sales orders", points: valued.map(function (o) { return { date: o.date, value: o.value }; }) };
    const inv = state.ledger && state.ledger.invoices;
    if (inv && inv.length) return { basis: "invoices", points: inv.map(function (i) { return { date: i.date, value: i.total }; }) };
    return null;
  }
  function windowSum(points, end, days, offsetDays) {
    const hi = end - (offsetDays || 0) * DAY, lo = hi - days * DAY;
    return points.reduce(function (n, p) { const t = dayOf(p.date); return t > lo && t <= hi ? n + p.value : n; }, 0);
  }

  function pulse(state, detected) {
    const sig = {};
    detected.signals.forEach(function (s) { sig[s.id] = s; });
    const end = state.dataEnd ? dayOf(state.dataEnd) : state.now;
    const period = state.dataEnd ? "30 days to " + fmtDate(state.dataEnd) : "last 30 days";
    const out = [];

    const series = salesSeries(state);
    if (series) {
      const now30 = windowSum(series.points, end, 30), prev30 = windowSum(series.points, end, 30, 30);
      const ch = prev30 ? Math.round((now30 / prev30 - 1) * 100) : null;
      out.push({ id: "sales", label: "Sales", value: inr(now30), available: true,
                 delta: ch, sub: ch === null ? "no earlier month to compare" : Math.abs(ch) + "% on the 30 days before",
                 tone: ch === null ? "" : ch >= 0 ? "good" : "bad", period: period, basis: series.basis });
    } else {
      out.push({ id: "sales", label: "Sales", available: false, value: null, sub: "No order values in your records", period: period });
    }

    const inWin = state.orders.filter(function (o) { return o.source === "import" && dayOf(o.date) > end - 30 * DAY; }).length;
    const risk = sig["order-risk"];
    out.push({ id: "orders", label: "Orders", value: String(inWin + state.made.length), available: true,
               sub: risk ? plural(risk.affected.orders, "order") + " at risk" : state.made.length ? state.made.length + " made in FoodBridge" : "none at risk",
               tone: risk ? "bad" : "", period: period + (state.made.length ? " + since" : "") });

    const dem = detected.demand.filter(function (d) { return d.available !== null && d.daily > 0; });
    const healthy = dem.filter(function (d) { return d.cover >= T.COVER_RISK_DAYS; }).length;
    const so = sig.stockout;
    out.push({ id: "stock", label: "Stock health", value: dem.length ? Math.round(healthy / dem.length * 100) + "%" : null,
               available: dem.length > 0,
               sub: so && !so.phase ? so.affected.products + (/out of stock/.test(so.title) ? " out of stock" : " at risk") : so ? so.affected.products + " on order" : "none at risk",
               tone: so && !so.phase ? (so.severity === "critical" ? "bad" : "warn") : "",
               how: healthy + " of " + dem.length + " selling products have 2+ weeks of stock" });

    const rd = sig["reorder-due"];
    out.push({ id: "customers", label: "Customers", value: String(state.customers.length), available: true,
               sub: rd ? rd.affected.customers + " late to reorder" : "all on cycle", tone: rd ? "warn" : "" });

    const inv = state.ledger && state.ledger.invoices;
    if (inv) {
      const open = inv.filter(function (i) { return i.balance > 0; });
      const recv = open.reduce(function (n, i) { return n + i.balance; }, 0);
      const od = sig.overdue;
      out.push({ id: "cash", label: "Receivables", value: inr(recv), available: true,
                 sub: od ? (inr(od.impact.value) === inr(recv) ? "all overdue" : inr(od.impact.value) + " overdue") : "nothing overdue", tone: od ? "bad" : "",
                 sample: !!state.source.sample });
    } else {
      out.push({ id: "cash", label: "Receivables", value: null, available: false, sub: "No invoices in your records" });
    }

    out.push({ id: "delivery", label: "Delivery", value: null, available: false, naLabel: "Not connected", sub: "" });
    return out;
  }

  /* ── business now, per tab ───────────────────────────────────────────── */
  function businessNow(state, detected) {
    const sig = {};
    detected.signals.forEach(function (s) { sig[s.id] = s; });
    const end = state.dataEnd ? dayOf(state.dataEnd) : state.now;
    const win = function (days, off) {
      return state.orders.filter(function (o) {
        const t = dayOf(o.date); return o.source === "import" && t > end - (days + (off || 0)) * DAY && t <= end - (off || 0) * DAY;
      });
    };
    const o30 = win(30), o30b = win(30, 30);
    const valued = o30.filter(function (o) { return typeof o.value === "number"; });
    const byCust = {};
    win(90).forEach(function (o) { if (typeof o.value === "number") byCust[o.customer] = (byCust[o.customer] || 0) + o.value; });
    const topCustomers = Object.keys(byCust).sort(function (a, b) { return byCust[b] - byCust[a]; }).slice(0, 4)
      .map(function (n) { return { name: n, value: inr(byCust[n]) }; });

    const dem = detected.demand;
    const selling = dem.filter(function (d) { return d.available !== null && d.daily > 0; });
    const stocked = dem.filter(function (d) { return d.available !== null; });
    const stockValue = stocked.reduce(function (n, d) { return n + (d.product.mrp && d.available > 0 ? d.available * d.product.mrp : 0); }, 0);

    const l = state.ledger;
    const today = state.now;
    const cash = l && l.invoices ? (function () {
      const open = l.invoices.filter(function (i) { return i.balance > 0; });
      const overdue = open.filter(function (i) { return i.dueDate && dayOf(i.dueDate) < today; });
      const soon = open.filter(function (i) { return i.dueDate && dayOf(i.dueDate) >= today && dayOf(i.dueDate) <= today + 7 * DAY; });
      const bills = (l.bills || []).filter(function (b) { return b.balance > 0; });
      const billsLate = bills.filter(function (b) { return b.dueDate && dayOf(b.dueDate) < today; });
      const sum = function (a) { return a.reduce(function (n, x) { return n + x.balance; }, 0); };
      return { available: true, sample: !!state.source.sample,
               receivables: inr(sum(open)), overdue: inr(sum(overdue)), dueSoon: inr(sum(soon)),
               payables: bills.length ? inr(sum(bills)) : null, payablesLate: billsLate.length ? inr(sum(billsLate)) : null,
               counts: { open: open.length, overdue: overdue.length, soon: soon.length, bills: bills.length } };
    })() : { available: false, reason: "No invoices or payments in your records.", unlock: "Connect Zoho Books or Xero, or add your invoices." };

    const s30 = salesSeries(state);
    const topProducts = (function () {
      const u = {};
      o30.forEach(function (o) { o.lines.forEach(function (x) { u[x.productId] = (u[x.productId] || 0) + x.qty; }); });
      return Object.keys(u).sort(function (a, b) { return u[b] - u[a]; }).slice(0, 4)
        .map(function (pid) { return { name: (state.productById[pid] || { name: pid }).name, units: u[pid] }; });
    })();
    const openPR = state.purchaseRequests.filter(function (p) { return p.status === "raised"; });
    const pos = l && l.purchaseOrders ? l.purchaseOrders.filter(function (p) { return dayOf(p.date) > end - 30 * DAY; }) : null;

    return {
      orders: { available: true, count30: o30.length, countPrev: o30b.length,
                made: state.made.length, avgValue: valued.length ? inr(valued.reduce(function (n, o) { return n + o.value; }, 0) / valued.length) : null,
                atRisk: sig["order-risk"] ? sig["order-risk"].affected.orders : 0,
                pastCycle: sig["reorder-due"] ? sig["reorder-due"].affected.customers : 0, topCustomers: topCustomers },
      inventory: { available: stocked.length > 0, counted: stocked.length, selling: selling.length,
                   healthy: selling.filter(function (d) { return d.cover >= T.COVER_RISK_DAYS; }).length,
                   atRisk: sig.stockout && !sig.stockout.phase ? sig.stockout.affected.products : 0,
                   out: stocked.filter(function (d) { return d.available <= 0; }).length,
                   slow: sig["slow-stock"] ? sig["slow-stock"].affected.products : 0,
                   stockValue: stockValue ? inr(stockValue) : null },
      procurement: { available: true, openRequests: openPR.length,
                     openUnits: openPR.reduce(function (n, p) { return n + p.lines.reduce(function (m, x) { return m + x.qty; }, 0); }, 0),
                     needReorder: sig.stockout && !sig.stockout.phase ? sig.stockout.affected.products : 0,
                     suppliers: state.suppliers.length,
                     recentPOs: pos ? pos.length : null, recentPOValue: pos ? inr(pos.reduce(function (n, p) { return n + p.total; }, 0)) : null },
      delivery: { available: false, reason: "No delivery or route records for this business.", unlock: "Start delivering with FoodBridge routes." },
      cash: cash,
      sales: { available: !!s30, basis: s30 ? s30.basis : null,
               value30: s30 ? inr(windowSum(s30.points, end, 30)) : null,
               prev30: s30 ? inr(windowSum(s30.points, end, 30, 30)) : null,
               topProducts: topProducts,
               demandUp: sig["demand-up"] ? sig["demand-up"].affected.products : 0 },
      period: state.dataEnd ? "30 days to " + fmtDate(state.dataEnd) : "last 30 days",
    };
  }

  /* Eight weeks of sales, ending at the last record. */
  function trend(state) {
    const s = salesSeries(state);
    if (!s || !state.dataEnd) return null;
    const end = dayOf(state.dataEnd);
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const hi = end - i * 7 * DAY;
      weeks.push({ end: new Date(hi).toISOString().slice(0, 10), value: windowSum(s.points, hi, 7) });
    }
    return { basis: s.basis, weeks: weeks };
  }

  const API = {
    T: T, SEVERITY: SEVERITY, SEVERITY_LABEL: SEVERITY_LABEL,
    detect: detect, pulse: pulse, businessNow: businessNow, trend: trend,
    unavailable: unavailable, freshness: freshness, rank: rank, weigh: weigh,
    fmt: { inr: inr, inrFull: inrFull, plural: plural, date: fmtDate },
    _detectors: { detectStockout: detectStockout, detectOrderRisk: detectOrderRisk, detectReorderDue: detectReorderDue,
                  detectOverdue: detectOverdue, detectSlowStock: detectSlowStock, detectDemandUp: detectDemandUp,
                  detectReorderSoon: detectReorderSoon, demand: demand },
  };
  root.CTSignals = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

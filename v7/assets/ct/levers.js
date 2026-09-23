/* ==========================================================================
   CONTROL TOWER · LEVERS — the five levers, as the owner reads them.

   Spec: context/control-tower/CONTROL_TOWER_LEVERS.md (what),
         CONTROL_TOWER_DESIGN.md (how it looks), CONTROL_TOWER_UX_FLOW.md.

   One pass of the tower (tower.js) in, five levers out, in the owner's
   order: Deliveries · Collections · Purchase · Inventory · Order. Every lever
   has the same shape, so the screen draws one template:

     { id, label, status: "ugly" | "bad" | "good" | "preview",
       headline: { value, context }, how,
       tiles: { good, bad, ugly } -- each { label, word, value, count, rows[] },
       facts[]    (Deliveries' Good: money, empties, next orders),
       colours[]  (Collections: customers by how they pay),
       tomorrow[] (Deliveries: the next trips' health),
       balance[], grow, action, preview }

   PROVEN NUMBERS ONLY (D-015). A lever without its records is a Preview: the
   same shape, with figures marked `example: true`, and a Connect action. A
   real figure never borrows from an example, and an example never feeds
   another lever.

   Pure: no DOM, no storage, no clock of its own. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const DAY = 86400000;
  const dayOf = function (s) { return new Date(String(s).slice(0, 10) + "T00:00:00Z").getTime(); };

  /* Thresholds the owner can later set; one place, shown under ⓘ. */
  const T = {
    GOOD_HEALTH: 0.75,         // a lever this healthy is Good, even with a few items to fix
    HEALTHY_DAYS: 14,          // a fast mover with 2+ weeks of stock is healthy
    DEAD_DAYS: 90,             // no sale in 90 days of records is dead stock
    LATE_MIN: 30,              // a drop this long after its slot is late
    DUE_SOON_DAYS: 7,
    COLLECTED_DAYS: 7,
    FIRE_DAYS: 120,            // overdue this long, with no payment lately
    FIRE_QUIET_DAYS: 60,
    RED_DAYS: 60,
    RED_AMOUNT: 10000,
    ORANGE_DAYS: 15,
    YELLOW_LATE_DAYS: 3,
    STUCK_DAYS: 60,            // money this late, once received, is the week's best news       // pays, but on average this many days late
    KIT_BOTTLES: 12,           // 1 crate = 12 bottles
    ROWS: 5,
  };

  /* ── Indian money, the way the trade says it ─────────────────────────── */
  function rupees(n) {
    if (typeof n !== "number" || !isFinite(n)) return null;
    const a = Math.abs(n), s = n < 0 ? "−" : "";
    const one = function (x) { const r = Math.round(x * 10) / 10; return r % 1 ? r.toFixed(1) : String(r); };
    if (a >= 1e7) return s + "₹" + one(a / 1e7) + " Cr";
    if (a >= 1e5) return s + "₹" + one(a / 1e5) + " L";
    return s + "₹" + Math.round(a).toLocaleString("en-IN");
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }
  function mins(m) { const h = Math.floor(m / 60), r = Math.round(m % 60); return h ? h + " h" + (r ? " " + r + " min" : "") : r + " min"; }
  function date(s) {
    if (!s) return "";
    const d = new Date(String(s).slice(0, 10) + "T00:00:00Z");
    return d.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  }
  function sum(a, f) { return a.reduce(function (n, x) { return n + (f ? f(x) : x); }, 0); }
  function tile(label, word, value, count, rows, extra) {
    return Object.assign({ label: label, word: word, value: value, count: count, rows: rows || [] }, extra || {});
  }
  function statusOf(t) { return t.ugly.count ? "ugly" : t.bad.count ? "bad" : "good"; }
  /* Where a lever stands, from its health: every business always has a few
     things to fix, so a lever that is mostly right is Good (owner, 22 Sep
     2026). Nothing wrong at all is always Good. */
  const GOOD = 0.75, OK = 0.5;
  function standing(lv) {
    const t = lv.tiles;
    if (!t.ugly.count && !t.bad.count) return "good";
    if (!lv.health) return statusOf(t);
    return lv.health.value >= GOOD ? "good" : lv.health.value >= OK ? "bad" : "ugly";
  }

  /* ════════════════════════════════════════════════════════════════════
     build(view, opts) — view is tower.pass(); opts.demand is the demand
     table (CTSignals._detectors.demand), passed in so this file needs no
     engine of its own.
     ════════════════════════════════════════════════════════════════════ */
  function build(view, opts) {
    const st = view.state;
    const rec = view.records || {};
    const sig = {};
    (view.all || view.signals || []).forEach(function (s) { if (s.status !== "dismissed") sig[s.id] = s; });
    const dem = (opts && opts.demand) || [];
    const today = st.now;
    const asOf = st.dataEnd;                              // where the records end
    const ctx = { st: st, rec: rec, sig: sig, dem: dem, today: today, asOf: asOf };
    ctx.colours = colours(ctx);
    ctx.pending = pendingOrders(ctx);
    ctx.empties = emptiesByCustomer(ctx);

    const levers = [deliveries(ctx), collections(ctx), purchase(ctx), inventory(ctx), order(ctx)];
    balances(ctx, levers);
    levers.forEach(function (lv) {
      lv.health = lv.status === "preview" ? null : health(ctx, lv);
      if (lv.status !== "preview") lv.status = standing(lv);
    });
    return { levers: levers, overview: overview(ctx, levers), asOf: asOf, stale: !!asOf && dayOf(asOf) < dayOf(new Date(today).toISOString()) - DAY,
             sample: !!(st.source && st.source.sample), T: T };
  }

  /* ── shared reads ─────────────────────────────────────────────────── */

  /* Customers by how they pay (notes §7; owner: Green … Fire). From each
     customer's own invoices and payments; null without invoices. */
  function colours(c) {
    const l = c.st.ledger;
    if (!l || !l.invoices) return null;
    const by = {};
    const lastPay = {};
    (l.payments || []).forEach(function (p) { if (!lastPay[p.customerId] || p.date > lastPay[p.customerId]) lastPay[p.customerId] = p.date; });
    const payOf = {};
    (l.payments || []).forEach(function (p) { if (p.invoiceId) payOf[p.invoiceId] = p; });
    l.invoices.forEach(function (i) {
      const x = by[i.customerId] || (by[i.customerId] = { id: i.customerId, outstanding: 0, overdue: 0, oldest: 0, overdueCount: 0, late: [], count: 0 });
      x.count += 1;
      if (i.balance > 0) {
        x.outstanding += i.balance;
        if (i.dueDate && dayOf(i.dueDate) < c.today) {
          x.overdue += i.balance; x.overdueCount += 1;
          x.oldest = Math.max(x.oldest, Math.round((c.today - dayOf(i.dueDate)) / DAY));
        }
      }
      const p = payOf[i.id];
      if (p && i.dueDate) x.late.push(Math.round((dayOf(p.date) - dayOf(i.dueDate)) / DAY));
    });
    const anchor = c.asOf ? dayOf(c.asOf) : c.today;
    Object.keys(by).forEach(function (id) {
      const x = by[id];
      const avgLate = x.late.length ? sum(x.late) / x.late.length : 0;
      const quiet = !lastPay[id] || anchor - dayOf(lastPay[id]) > T.FIRE_QUIET_DAYS * DAY;
      x.name = c.st.customerById[id] || id;
      x.lastPaid = lastPay[id] || null;
      x.colour = x.oldest > T.FIRE_DAYS && quiet ? "fire"
        : x.oldest > T.RED_DAYS || x.overdue >= T.RED_AMOUNT ? "red"
        : x.oldest > T.ORANGE_DAYS || x.overdueCount >= 2 ? "orange"
        : x.oldest > 0 || avgLate > T.YELLOW_LATE_DAYS ? "yellow" : "green";
    });
    return by;
  }

  /* FoodBridge orders not yet delivered: the next trips. A missed delivery
     that was rescheduled is back on the list. */
  function pendingOrders(c) {
    const done = {};
    (c.rec.deliveries || []).forEach(function (d) {
      if (d.orderNo && (d.status !== "missed" || !d.rescheduledFor)) done[d.orderNo] = d;
    });
    const route = c.rec.route && c.rec.route.day === new Date(c.today).toISOString().slice(0, 10) ? c.rec.route.stops : [];
    const stops = route.map(function (x) {
      return { no: x.no, customerId: x.customerId, customer: c.st.customerById[x.customerId] || x.customerId, amount: x.value,
               slot: x.slot, van: x.van || null, round: x.round || null, driver: x.driver || null,
               driverPhone: x.driverPhone || null, cases: x.cases || null };
    });
    return (c.st.made || []).concat(stops).filter(function (o) { return !done[o.no]; });
  }

  /* Empties with each customer: out on deliveries, less what came back.
     Crates carry bottles as a kit (1 crate = 12). */
  function emptiesByCustomer(c) {
    const by = {};
    (c.rec.deliveries || []).forEach(function (d) {
      const e = d.empties || {};
      const x = by[d.customerId] || (by[d.customerId] = { crates: 0, bottles: 0, since: d.at });
      /* A crate goes out full (a kit of 12 bottles); crates and bottles come
         back on their own counts, so a crate back with 10 bottles leaves 2
         bottles with the customer. */
      x.crates += (Number(e.cratesOut) || 0) - (Number(e.cratesBack) || 0);
      x.bottles += (Number(e.cratesOut) || 0) * T.KIT_BOTTLES - (Number(e.bottlesBack) || 0);
      if (d.at < x.since) x.since = d.at;
    });
    Object.keys(by).forEach(function (id) {
      const x = by[id];
      x.crates = Math.max(0, x.crates); x.bottles = Math.max(0, x.bottles);
    });
    return by;
  }
  function emptiesLine(e) {
    if (!e || (!e.crates && !e.bottles)) return null;
    const kit = e.crates * T.KIT_BOTTLES;
    if (e.bottles === kit) return plural(e.crates, "crate") + " (" + e.bottles + " bottles)";
    return plural(e.crates, "crate") + ", " + e.bottles + " bottles";
  }

  /* ═════ 1 · DELIVERIES ═══════════════════════════════════════════════ */
  function deliveries(c) {
    const all = c.rec.deliveries || [];
    const lever = { id: "deliveries", label: "Deliveries", period: "Today" };
    const ordersQuarter = c.st.orders.filter(function (o) { return o.source === "import" && c.asOf && dayOf(o.date) > dayOf(c.asOf) - 90 * DAY; }).length;

    if (!all.length && !c.pending.length) {
      return Object.assign(lever, {
        status: "preview",
        preview: {
          promise: ordersQuarter ? "Track all " + ordersQuarter + " orders to the door" : "Track every order to the door",
          sub: "Money, empties and next orders from every stop",
          connect: { label: "Record your first delivery", create: "delivery" },
        },
        headline: { value: "38 of 45 delivered", context: "4 on the road · 3 missed", bar: 38 / 45, example: true },
        tiles: {
          good: tile("On track", "Delivered", "38", 38, [], { example: true }),
          bad: tile("Needs work", "On the road", "4", 4, [], { example: true }),
          ugly: tile("Urgent", "Missed", "3", 3, [
            { title: "Sharma Stores", note: "Shop closed", next: "Call to reschedule" },
            { title: "Gupta Mart", note: "Returned 2 cases", next: "Take back into stock" },
            { title: "Hotel Surya", note: "Short 1 case", next: "Send on next trip" },
          ], { example: true }),
        },
        facts: [{ label: "Collected", value: "₹48,200" }, { label: "Empties back", value: "112" }, { label: "Next orders", value: "9" }],
        tomorrow: ["Collect ₹36,000 from 4 critical customers", "Collect 46 empties from 5 critical customers", "3 products short for booked orders", "5 customers to upsell"],
        balance: [], grow: null, action: null,
        how: "Every delivery recorded at the door: delivered, missed with a reason, or returned, with the money and empties collected.",
      });
    }

    const todayIso = new Date(c.today).toISOString().slice(0, 10);
    const ofToday = all.filter(function (d) { return String(d.at).slice(0, 10) === todayIso; });
    const delivered = ofToday.filter(function (d) { return d.status === "delivered" || d.status === "returned"; });
    const missed = all.filter(function (d) { return d.status === "missed" && !d.rescheduledFor; });
    const returned = ofToday.filter(function (d) { return (Number(d.returnedCases) || 0) > 0; });
    const short = ofToday.filter(function (d) { return (Number(d.shortCases) || 0) > 0; });
    const late = delivered.filter(function (d) { return (Number(d.lateMin) || 0) > T.LATE_MIN; });
    const name = function (id) { return c.st.customerById[id] || id; };
    /* A rescheduled delivery is to deliver until the customer's next
       delivery is recorded. */
    const later = function (d) { return all.some(function (x) { return x.customerId === d.customerId && x.at > d.at && x.status !== "missed"; }); };
    const rescheduled = all.filter(function (d) { return d.status === "missed" && d.rescheduledFor && !later(d); });
    /* A stop past its slot and still on the road is already late: the
       customer is waiting. It stays in progress, flagged, and it already
       counts against on time. */
    const overdueBy = function (o) { return o.slot ? (c.today - new Date(o.slot).getTime()) / 60000 : 0; };
    const running = c.pending.filter(function (o) { return overdueBy(o) > T.LATE_MIN; });
    const pending = c.pending.concat(rescheduled.map(function (d) {
      return { no: d.no, customerId: d.customerId, customer: name(d.customerId), amount: null, rescheduledFor: d.rescheduledFor };
    }));

    /* The row's note says what happened; `next` says the one thing to do
       about it, in a few words — the same split the detail sheet already
       makes (see control-tower.js, todoHtml), just short enough for a list.
       Kept a duplicate of the shop-side/Van-full split in deliverySheet's
       own todo, since levers.js runs under node and never reaches the DOM. */
    const missNext = function (reason) {
      if (["Shop closed", "Refused", "Payment not ready"].indexOf(reason) !== -1) return "Call to reschedule";
      if (reason === "Van full") return "Reschedule for tomorrow";
      return "Reschedule the trip";
    };
    const uglyRows = missed.map(function (d) { return { id: d.no, kind: "delivery", title: name(d.customerId), note: d.reason || "Missed", next: missNext(d.reason), value: null, ref: d }; })
      .concat(late.map(function (d) { return { id: d.no + ":l", kind: "delivery", title: name(d.customerId), note: "Late " + mins(Number(d.lateMin)) + (d.lateWhy ? " · " + d.lateWhy : ""), next: "Ask why it was late", ref: d }; }))
      .concat(returned.map(function (d) { return { id: d.no + ":r", kind: "delivery", title: name(d.customerId), note: "Returned " + plural(Number(d.returnedCases), "case"), next: "Take back into stock", ref: d }; }))
      .concat(short.map(function (d) { return { id: d.no + ":s", kind: "delivery", title: name(d.customerId), note: "Short " + plural(Number(d.shortCases), "case"), next: "Send on next trip", ref: d }; }))
      /* Empties not back are a problem, not a fact: each is the owner's money out. */
      .concat(ofToday.filter(function (d) { const e = d.empties || {}; return (Number(e.cratesOut) || 0) > (Number(e.cratesBack) || 0); }).map(function (d) {
        const e = d.empties; return { id: d.no + ":e", kind: "delivery", title: name(d.customerId), note: plural(e.cratesOut - e.cratesBack, "crate") + " not back", next: "Collect on next trip", ref: d };
      }));
    const badRows = pending.map(function (o) {
      const running = overdueBy(o) > T.LATE_MIN;
      return o.rescheduledFor
        ? { id: o.customerId, kind: "customer", title: o.customer, note: "Rescheduled · " + date(o.rescheduledFor), next: "Nothing to do", value: null }
        : { id: o.no, kind: "order", title: o.customer, value: typeof o.amount === "number" ? o.amount : null, running: running, ref: o,
            /* What the owner can act on, never the order number (owner, 23
               Sep 2026): which van has it, and whether it is behind. */
            note: running ? "Running " + mins(overdueBy(o)) + " late" + (o.van ? " · " + o.van : "")
              : o.van ? "On " + o.van + (o.driver ? " · " + o.driver : "") : "Not on a van yet",
            next: running ? "Call the driver" : o.van ? "Nothing to do yet" : "Goes on next trip" };
    }).sort(function (a, b) { return (b.running ? 1 : 0) - (a.running ? 1 : 0) || (b.value || 0) - (a.value || 0); });
    const goodRows = delivered.map(function (d) {
      return { id: d.no, kind: "delivery", title: name(d.customerId), note: d.status === "returned" ? "Delivered, some returned" : "Delivered",
               value: Number(d.collected) || 0, ref: d };
    }).sort(function (a, b) { return (b.value || 0) - (a.value || 0); });

    const collected = sum(delivered, function (d) { return Number(d.collected) || 0; });
    const emptiesOut = sum(ofToday, function (d) { const e = d.empties || {}; return Math.max(0, (Number(e.cratesOut) || 0) - (Number(e.cratesBack) || 0)); });
    const nextOrders = ofToday.filter(function (d) { return d.nextOrder; }).length;
    const total = delivered.length + missed.length + pending.length;

    const t = {
      good: tile("On track", "Delivered", String(delivered.length), delivered.length, goodRows),
      bad: tile("Needs work", "To deliver", String(pending.length), pending.length, badRows),
      ugly: tile("Urgent", "Problems", String(uglyRows.length), uglyRows.length, uglyRows),
    };

    /* Tomorrow's trips: only the lines that are not zero. */
    const pendCust = {};
    pending.forEach(function (o) { pendCust[o.customerId] = 1; });
    const critical = c.colours ? Object.keys(pendCust).filter(function (id) { const x = c.colours[id]; return x && (x.colour === "red" || x.colour === "fire") && x.overdue > 0; }) : [];
    const critEmpties = Object.keys(pendCust).filter(function (id) { const e = c.empties[id]; const x = c.colours && c.colours[id]; return e && e.crates > 0 && x && (x.colour === "red" || x.colour === "fire"); });
    const shortSig = c.sig["order-risk"];
    const demUp = c.sig["demand-up"];
    const notBuying = {};
    ((demUp && demUp.recommendation && demUp.recommendation.customers) || []).forEach(function (x) { notBuying[x.customerId] = 1; });
    const upsell = Object.keys(pendCust).filter(function (id) { return notBuying[id]; }).length;
    const tomorrow = [
      critical.length ? "Collect " + rupees(sum(critical, function (id) { return c.colours[id].overdue; })) + " from " + plural(critical.length, "critical customer") : null,
      critEmpties.length ? "Collect " + sum(critEmpties, function (id) { return c.empties[id].crates; }) + " crates from " + plural(critEmpties.length, "critical customer") : null,
      shortSig && !shortSig.phase ? plural(shortSig.affected.products, "product") + " short for booked orders" : null,
      upsell && demUp ? plural(upsell, "customer") + " to upsell " + plural(demUp.affected.products, "fast-selling product") : null,
    ].filter(Boolean);

    return Object.assign(lever, {
      status: statusOf(t),
      missedCount: missed.length,
      runningCount: running.length,
      headline: { value: delivered.length + " of " + total + " delivered", context: [pending.length ? pending.length + " to deliver" : null, (late.length + running.length) ? (late.length + running.length) + " late" : null, missed.length ? missed.length + " missed" : null].filter(Boolean).join(" · ") || "Today",
                  bar: total ? delivered.length / total : 0 },
      tiles: t,
      /* What the trips brought back, and what they did not: an empty not
         back is the owner's money out. Next orders live in the Grow card. */
      facts: [{ label: "Collected", value: rupees(collected) || "₹0" }]
        .concat(emptiesOut ? [] : [{ label: "Empties", value: "All back", good: true }]),
      tomorrow: tomorrow,
      balance: [],
      grow: nextOrders ? { text: plural(nextOrders, "next order") + " taken at the door today", tab: "order" } : null,
      action: missed.length ? { label: "Reschedule " + plural(missed.length, "delivery", "deliveries"), kind: "reschedule", nos: missed.map(function (d) { return d.no; }) } : null,
      how: "Today's deliveries as recorded at the door. To deliver: orders made in FoodBridge not yet delivered. Missed deliveries stay here until rescheduled. " +
        "A drop counts as on time and in full when it arrives within " + T.LATE_MIN + " minutes of its slot with nothing short; Deliveries is on track while " + Math.round(GOOD * 100) + "% of the stops due do, and urgent under " + Math.round(OK * 100) + "%.",
    });
  }

  /* ═════ 2 · COLLECTIONS ══════════════════════════════════════════════ */
  function collections(c) {
    const lever = { id: "collections", label: "Collections", period: "As of now" };
    const l = c.st.ledger;
    if (!l || !l.invoices) {
      return Object.assign(lever, {
        status: "preview",
        preview: {
          promise: "See who owes you, and how much",
          sub: c.st.customers.length ? "All " + c.st.customers.length + " customers, each with a colour for how they pay" : "Every customer, with a colour for how they pay",
          connect: { label: "Connect your invoices", route: "#/onboarding" },
        },
        headline: { value: "₹1.2 L overdue", context: "of ₹1.5 L outstanding", example: true },
        tiles: {
          good: tile("On track", "Collected", "₹32,000", 1, [], { example: true }),
          bad: tile("Needs work", "Late or due soon", "₹18,400", 1, [], { example: true }),
          ugly: tile("Urgent", "Needs chasing", "₹1.2 L", 3, [
            { title: "Customer A", value: 10600, colour: "fire", next: "Call — or stop supply" },
            { title: "Customer B", value: 8800, colour: "red", next: "Call to collect" },
            { title: "Customer C", value: 8700, colour: "red", next: "Call to collect" },
          ], { example: true }),
        },
        colours: [{ id: "green", n: 16 }, { id: "yellow", n: 9 }, { id: "orange", n: 7 }, { id: "red", n: 5 }, { id: "fire", n: 3 }].map(function (x) { return Object.assign(x, { amount: null, example: true }); }),
        balance: [], grow: null, action: null,
        how: "Your invoices and payments, read from Zoho Books, Xero or your files.",
      });
    }

    const by = c.colours;
    const list = Object.keys(by).map(function (id) { return by[id]; });
    const open = l.invoices.filter(function (i) { return i.balance > 0; });
    const outstanding = sum(open, function (i) { return i.balance; });
    const overdueInv = open.filter(function (i) { return i.dueDate && dayOf(i.dueDate) < c.today; });
    const overdue = sum(overdueInv, function (i) { return i.balance; });
    const soonInv = open.filter(function (i) { return i.dueDate && dayOf(i.dueDate) >= c.today && dayOf(i.dueDate) <= c.today + T.DUE_SOON_DAYS * DAY; });
    const dueSoon = sum(soonInv, function (i) { return i.balance; });
    /* Overdue splits the way the colours already do: Yellow pays late and
       Orange needs following up — that is work. Red and Fire are the money
       to chase, and they alone make the lever Urgent. */
    const CHASE = { red: 1, fire: 1 };
    const mild = function (id) { const x = by[id]; return !x || !CHASE[x.colour]; };
    const lateInv = overdueInv.filter(function (i) { return mild(i.customerId); });
    const chaseInv = overdueInv.filter(function (i) { return !mild(i.customerId); });
    const late = sum(lateInv, function (i) { return i.balance; });
    const chase = sum(chaseInv, function (i) { return i.balance; });
    const owing = list.filter(function (x) { return x.overdue > 0; });
    const paid7 = (l.payments || []).filter(function (p) { return dayOf(p.date) > c.today - T.COLLECTED_DAYS * DAY; });
    const collected = sum(paid7, function (p) { return Number(p.amount) || 0; });

    const row = function (x, figure) {
      return { id: x.id, kind: "customer", title: x.name, value: figure, colour: x.colour,
               note: x.oldest ? plural(x.oldest, "day") : null,
               next: x.colour === "fire" ? "Call — or stop supply" : "Call to collect" };
    };
    const soonBy = {}, soonIn = {}, lateBy = {};
    soonInv.forEach(function (i) {
      soonBy[i.customerId] = (soonBy[i.customerId] || 0) + i.balance;
      const d = Math.max(1, Math.ceil((dayOf(i.dueDate) - c.today) / DAY));
      soonIn[i.customerId] = Math.min(soonIn[i.customerId] === undefined ? d : soonIn[i.customerId], d);
    });
    lateInv.forEach(function (i) { lateBy[i.customerId] = (lateBy[i.customerId] || 0) + i.balance; });
    /* One row per customer: what they owe now and what falls due this week
       are the same conversation. */
    const needRows = Object.keys(lateBy).concat(Object.keys(soonBy).filter(function (id) { return !lateBy[id]; }))
      .map(function (id) {
        const x = by[id] || { id: id, name: c.st.customerById[id] || id, colour: null, oldest: 0 };
        const r = row(x, (lateBy[id] || 0) + (soonBy[id] || 0));
        r.note = lateBy[id] ? plural(x.oldest, "day") + " late" : "Due in " + plural(soonIn[id], "day");
        r.next = lateBy[id] ? "Ask for a payment date" : "Nothing to chase yet";
        return r;
      }).sort(function (a, b) { return b.value - a.value; });
    /* Payments this week, by customer, and how late the money was: long-stuck
       money received first, then late payments, then on time. */
    const dueOf = {};
    l.invoices.forEach(function (i) { dueOf[i.id] = i.dueDate; });
    const paidBy = {};
    paid7.forEach(function (p) {
      const late = typeof p.late === "number" ? p.late
        : p.invoiceId && dueOf[p.invoiceId] ? Math.round((dayOf(p.date) - dayOf(dueOf[p.invoiceId])) / DAY) : 0;
      const x = paidBy[p.customerId] || (paidBy[p.customerId] = { amount: 0, late: 0 });
      x.amount += Number(p.amount) || 0; x.late = Math.max(x.late, late);
    });

    const t = {
      good: tile("On track", "Collected", rupees(collected) || "₹0", paid7.length,
        Object.keys(paidBy).map(function (id) {
          const x = paidBy[id];
          const stuck = x.late >= T.STUCK_DAYS;
          return { id: id, kind: "customer", title: c.st.customerById[id] || id, value: x.amount, good: true, stuck: stuck, late: x.late,
                   note: stuck ? "Stuck " + plural(x.late, "day") + " · now paid" : x.late > 0 ? "Paid, " + plural(x.late, "day") + " late" : "Paid on time" };
        }).sort(function (a, b) { return (b.stuck ? 1 : 0) - (a.stuck ? 1 : 0) || (b.stuck ? b.late - a.late : 0) || b.value - a.value; })),
      bad: tile("Needs work", "Late or due soon", rupees(late + dueSoon) || "₹0", lateInv.length + soonInv.length, needRows),
      ugly: tile("Urgent", "Needs chasing", rupees(chase) || "₹0", chaseInv.length,
        list.filter(function (x) { return x.overdue > 0 && !mild(x.id); }).map(function (x) { return row(x, x.overdue); }).sort(function (a, b) { return b.value - a.value; })),
    };

    const order = ["green", "yellow", "orange", "red", "fire"];
    const cols = order.map(function (k) {
      const xs = list.filter(function (x) { return x.colour === k; });
      return { id: k, n: xs.length, amount: sum(xs, function (x) { return x.outstanding; }) };
    });

    /* Reminders go to those who owe the most; Fire gets a call, not a message. */
    /* The same customers the reminder sheet will hold: the overdue signal's
       prepared list (the biggest owed, not reminded this week), less Fire. */
    const od = c.sig.overdue;
    const prepared = od && od.recommendation ? od.recommendation.customers.map(function (x) { return x.customerId; }) : [];
    const remind = prepared.filter(function (id) { return by[id] && by[id].colour !== "fire"; }).map(function (id) { return { id: id }; });
    const green = cols[0];

    return Object.assign(lever, {
      status: statusOf(t),
      /* "Of ₹1.2 L outstanding" says nothing when all of it is overdue. */
      headline: { value: rupees(overdue) + " overdue",
                  context: rupees(outstanding) !== rupees(overdue) ? "of " + rupees(outstanding) + " outstanding"
                    : [plural(owing.length, "customer"), owing.length ? "oldest " + plural(Math.max.apply(null, list.map(function (x) { return x.oldest; })), "day") : null].filter(Boolean).join(" · ") },
      tiles: t,
      owed: { outstanding: outstanding, chase: chase },
      colours: cols,
      balance: [],
      grow: green.n ? { text: plural(green.n, "Green customer") + " pay on time — offer them more range", tab: "order" } : null,
      action: remind.length ? { label: "Send " + plural(remind.length, "reminder"), kind: "reminders", ids: remind.map(function (r) { return r.id; }) } : null,
      how: "Overdue: invoices past their due date with money still owed. Needs work is what Yellow and Orange customers owe late, plus what falls due in the next " + T.DUE_SOON_DAYS + " days; Urgent is the overdue money with Red and Fire customers. Collections is on track while no more than " + Math.round((1 - GOOD) * 100) + "% of what you're owed is with Red and Fire customers, and urgent past " + Math.round((1 - OK) * 100) + "%. Colours come from each customer's own invoices and payments: Green pays on time; Yellow pays late; Orange needs follow-up (over " + T.ORANGE_DAYS + " days, or 2+ invoices overdue); Red is over " + T.RED_DAYS + " days or " + rupees(T.RED_AMOUNT) + " overdue; Fire is over " + T.FIRE_DAYS + " days with no payment in " + T.FIRE_QUIET_DAYS + " days.",
    });
  }

  /* ═════ 3 · PURCHASE ═════════════════════════════════════════════════ */
  function purchase(c) {
    const lever = { id: "purchase", label: "Purchase", period: "This week" };
    const selling = c.dem.filter(function (d) { return d.available !== null && d.daily > 0; });
    if (!selling.length) return previewStock(lever, "Know what to buy, and when", "Connect your stock");

    const need = function (d) { return Math.max(1, Math.ceil(d.daily * 37 - Math.max(d.available, 0) - d.onOrder)); };
    const covered = function (d) { return d.onOrder > 0 && (Math.max(d.available, 0) + d.onOrder) / d.daily >= T.HEALTHY_DAYS; };
    const sup = function (d) { const s = c.st.suppliers.filter(function (x) { return x.category && x.category === d.product.category; })[0]; return s ? s.name : null; };
    const row = function (urgent) {
      return function (d) {
        return { id: d.product.id, kind: "product", title: d.product.name, note: plural(need(d), "unit") + (sup(d) ? " · " + sup(d) : ""),
                 next: urgent ? "Order today" : "Order this week",
                 value: d.product.mrp ? need(d) * d.product.mrp : null };
      };
    };
    const out = selling.filter(function (d) { return d.available <= 0 && !covered(d); });
    const low = selling.filter(function (d) { return d.available > 0 && d.cover < T.HEALTHY_DAYS && !covered(d); });
    const good = selling.filter(function (d) { return d.cover >= T.HEALTHY_DAYS || covered(d); });
    const byMoney = function (a, b) { return (b.value || 0) - (a.value || 0); };

    const t = {
      good: tile("On track", "Covered", String(good.length), good.length, good.map(function (d) {
        return { id: d.product.id, kind: "product", title: d.product.name,
                 note: d.onOrder ? "On order" : isFinite(d.cover) ? Math.floor(d.cover) + " days of stock" : "Plenty" };
      })),
      bad: tile("Needs work", "Buy this week", String(low.length), low.length, low.map(row(false)).sort(byMoney)),
      ugly: tile("Urgent", "Out", String(out.length), out.length, out.map(row(true)).sort(byMoney)),
    };
    const toBuy = out.concat(low);
    const suppliers = {};
    toBuy.forEach(function (d) { suppliers[sup(d) || "No supplier on file"] = 1; });
    const nSup = Object.keys(suppliers).length;

    return Object.assign(lever, {
      status: statusOf(t),
      headline: { value: plural(toBuy.length, "product") + " to buy", context: "this week" },
      tiles: t,
      balance: [],
      grow: null,
      action: toBuy.length ? { label: "Raise " + plural(nSup, "purchase order"), kind: "purchase", ids: toBuy.map(function (d) { return d.product.id; }) } : null,
      how: "Fast movers (sold in the last 90 days of records) with under 2 weeks of stock, less what is already on order. Quantities cover 30 days plus a week's safety.",
    });
  }

  /* ═════ 4 · INVENTORY ════════════════════════════════════════════════ */
  function inventory(c) {
    const lever = { id: "inventory", label: "Inventory", period: "Now" };
    const stocked = c.dem.filter(function (d) { return d.available !== null; });
    if (!stocked.length) return previewStock(lever, "See what to keep, move or clear", "Count your stock");

    const selling = stocked.filter(function (d) { return d.daily > 0; });
    const out = selling.filter(function (d) { return d.available <= 0; });
    const low = selling.filter(function (d) { return d.available > 0 && d.cover < T.HEALTHY_DAYS; });
    const healthy = selling.filter(function (d) { return d.cover >= T.HEALTHY_DAYS; });
    const dead = stocked.filter(function (d) { return d.available > 0 && d.units90 === 0; });
    const month = function (d) { return Math.round(d.daily * 30); };
    const so = c.sig.stockout;

    /* Out of stock leads: it is losing sales today. Dead stock follows. */
    const byValue = function (a, b) { return (b.value || 0) - (a.value || 0); };
    const uglyRows = out.map(function (d) {
      return { id: d.product.id, kind: "product", title: d.product.name, note: "Out · " + plural(month(d), "unit") + " a month",
               next: "Order today", value: d.product.mrp ? month(d) * d.product.mrp : null };
    }).sort(byValue).concat(dead.map(function (d) {
      return { id: d.product.id, kind: "product", title: d.product.name, note: "Dead stock", next: "Offer to past buyers", value: d.product.mrp ? d.available * d.product.mrp : null };
    }).sort(byValue));
    const deadValue = sum(dead, function (d) { return d.product.mrp ? d.available * d.product.mrp : 0; });

    const t = {
      good: tile("On track", "Healthy", String(healthy.length), healthy.length, healthy.map(function (d) {
        return { id: d.product.id, kind: "product", title: d.product.name,
                 note: isFinite(d.cover) ? Math.floor(d.cover) + " days of stock" : "Plenty" };
      })),
      bad: tile("Needs work", "Low", String(low.length), low.length, low.map(function (d) {
        return { id: d.product.id, kind: "product", title: d.product.name, next: "Reorder soon",
                 note: Math.max(0, Math.floor(d.cover)) + " days of stock" };
      })),
      ugly: tile("Urgent", "Out or dead", String(out.length + dead.length), out.length + dead.length, uglyRows),
    };
    const slow = c.sig["slow-stock"];
    const buyers = slow && slow.recommendation ? (slow.recommendation.customers || []).length : 0;

    return Object.assign(lever, {
      status: statusOf(t),
      headline: out.length
        ? { value: plural(out.length, "fast mover") + " out of stock", context: so && typeof so.impact.value === "number" ? rupees(so.impact.value) + " of sales at risk" : "with orders to fill" }
        : { value: plural(healthy.length, "fast mover") + " healthy", context: "of " + selling.length + " selling" },
      tiles: t,
      balance: [],
      grow: dead.length && buyers ? { text: "Offer " + (deadValue ? rupees(deadValue) + " of " : "") + "dead stock to " + plural(buyers, "customer") + " who bought it before", kind: "offer", signal: "slow-stock" } : null,
      action: out.length + low.length ? { label: "Reorder " + plural(out.length + low.length, "fast mover"), kind: "purchase", ids: out.concat(low).map(function (d) { return d.product.id; }) } : null,
      how: "Fast movers: sold in the last 90 days of records. Healthy: 2+ weeks of stock at their selling pace. Dead stock: on hand, no sale in 90 days, valued at the MRP in its name. Expiry isn't tracked yet: no batch dates in your records.",
    });
  }

  /* ═════ 5 · ORDER ════════════════════════════════════════════════════ */
  function order(c) {
    const lever = { id: "order", label: "Order", period: "Last 30 days" };
    if (!c.asOf && !(c.st.made || []).length) {
      return Object.assign(lever, {
        status: "preview",
        preview: { promise: "Know who should order, and what", sub: "Every customer's usual order, ready before they call", connect: { label: "Connect your orders", route: "#/onboarding" } },
        headline: { value: "₹21,600 this month", context: "↓ 12% on last month", example: true },
        tiles: { good: tile("On track", "Ordered", "17", 17, [], { example: true }), bad: tile("Needs work", "Late to reorder", "27", 27, [], { example: true }), ugly: tile("Urgent", "Short or lost", "4", 4, [], { example: true }) },
        balance: [], grow: null, action: null, how: "",
      });
    }
    const end = dayOf(c.asOf);
    const win = function (off) {
      return c.st.orders.filter(function (o) { const t = dayOf(o.date); return o.source === "import" && t > end - (30 + off) * DAY && t <= end - off * DAY; });
    };
    const o30 = win(0), prev = win(30);
    const val = function (a) { return a.every(function (o) { return typeof o.value !== "number"; }) ? null : sum(a, function (o) { return o.value || 0; }); };
    const v30 = val(o30), vPrev = val(prev);
    const ch = v30 !== null && vPrev ? Math.round((v30 / vPrev - 1) * 100) : null;

    const rd = c.sig["reorder-due"];
    const risk = c.sig["order-risk"];
    const lost = c.st.cadence.filter(function (x) { return x.bucket === "overdue" && x.cycleDays && x.daysOverdue > 2 * x.cycleDays; });
    const lostSet = {}; lost.forEach(function (x) { lostSet[x.id] = 1; });
    const late = (rd ? rd.rows : []).filter(function (r) { return !lostSet[r.id]; });
    const cad = {}; c.st.cadence.forEach(function (x) { cad[x.id] = x; });

    const uglyRows = (risk && !risk.phase ? risk.rows.map(function (r) { return { id: r.id, kind: "order", title: r.title, note: "Short of stock", next: "Check stock first" }; }) : [])
      .concat(lost.map(function (x) { return { id: x.id, kind: "customer", title: x.name, note: "No order in " + plural(x.daysOverdue + x.cycleDays, "day"), next: "Call to find out why", value: x.avgValue || null }; }))
      .sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
    const badRows = late.map(function (r) {
      const x = cad[r.id] || {};
      return { id: r.id, kind: "customer", title: r.title, note: plural(x.daysOverdue || 0, "day") + " late", next: "Call to reorder", value: x.avgValue || null };
    }).sort(function (a, b) { return (b.value || 0) - (a.value || 0); });
    const byCust = {};
    o30.forEach(function (o) { byCust[o.customerId] = (byCust[o.customerId] || 0) + (o.value || 0); });

    const t = {
      good: tile("On track", "Ordered", String(o30.length + (c.st.made || []).length), o30.length + (c.st.made || []).length,
        Object.keys(byCust).map(function (id) { return { id: id, kind: "customer", title: c.st.customerById[id] || id, value: byCust[id] || null }; })
          .sort(function (a, b) { return (b.value || 0) - (a.value || 0); })),
      bad: tile("Needs work", "Late to reorder", String(badRows.length), badRows.length, badRows),
      ugly: tile("Urgent", "Short or lost", String(uglyRows.length), uglyRows.length, uglyRows),
    };
    const withSug = rd && rd.recommendation && rd.recommendation.actionType === "create_orders" ? rd.recommendation.shops.length : 0;
    const up = c.sig["demand-up"];
    const upBuyers = up && up.recommendation ? (up.recommendation.customers || []).length : 0;

    return Object.assign(lever, {
      status: statusOf(t),
      headline: v30 !== null
        ? { value: rupees(v30) + " in orders", context: ch === null ? "last 30 days" : (ch >= 0 ? "↑ " : "↓ ") + Math.abs(ch) + "% on the 30 days before" }
        : { value: plural(o30.length, "order"), context: "last 30 days" },
      tiles: t,
      balance: [],
      grow: up && upBuyers ? { text: plural(up.affected.products, "product") + " selling fast — " + plural(upBuyers, "customer") + " don't buy them yet", kind: "offer", signal: "demand-up" } : null,
      action: withSug ? { label: "Prepare " + plural(withSug, "usual order"), kind: "orders", signal: "reorder-due" } : null,
      how: "Late to reorder: past their own usual gap between orders. Lost: no order in two of their cycles. Usual orders come from what each customer buys, back-tested on your history; a customer too quiet to predict gets a call, not a guess.",
    });
  }

  function previewStock(lever, promise, connect) {
    return Object.assign(lever, {
      status: "preview",
      preview: { promise: promise, sub: "From your stock and what sells", connect: { label: connect, create: "count" } },
      headline: { value: "9 products to buy", context: "this week", example: true },
      tiles: { good: tile("On track", "Covered", "14", 14, [], { example: true }), bad: tile("Needs work", "Low", "9", 9, [], { example: true }), ugly: tile("Urgent", "Out", "3", 3, [], { example: true }) },
      balance: [], grow: null, action: null, how: "",
    });
  }

  /* ═════ HEALTH — one proven ratio per lever, for the business shape ═══
     Each is the share of the lever that is going right, 0..1, with the
     sentence that says what it counts. Never shown for a Preview. */
  function health(c, lv) {
    const t = lv.tiles;
    const ratio = function (n, d, what) { return d > 0 ? { value: Math.max(0, Math.min(1, n / d)), what: what } : null; };
    if (lv.id === "deliveries") {
      /* On time and in full, against every stop that was due: "did I fulfil
         what I committed, on time?" (owner, 22 Sep 2026). Late and short fail
         a drop as surely as missed. Returns and empties are problems to fix,
         listed under Urgent, not failed drops. */
      const otif = t.good.rows.filter(function (r) { const d = r.ref || {}; return (Number(d.lateMin) || 0) <= T.LATE_MIN && !(Number(d.shortCases) > 0); }).length;
      return ratio(otif, t.good.count + (lv.missedCount || 0) + (lv.runningCount || 0), "of stops due, on time and in full");
    }
    if (lv.id === "collections") {
      /* The money, not the head count: 30 small payers on time don't make
         up for the ₹ sitting with Red and Fire customers (owner, 22 Sep 2026). */
      const o = lv.owed;
      return o ? ratio(o.outstanding - o.chase, o.outstanding, "of what you're owed isn't with Red or Fire customers") : null;
    }
    if (lv.id === "purchase") return ratio(t.good.count, t.good.count + t.bad.count + t.ugly.count, "of fast movers covered");
    if (lv.id === "inventory") {
      const stocked = c.dem.filter(function (d) { return d.available !== null && d.available > 0 && d.product.mrp; });
      const total = sum(stocked, function (d) { return d.available * d.product.mrp; });
      const dead = sum(stocked.filter(function (d) { return d.units90 === 0; }), function (d) { return d.available * d.product.mrp; });
      return total ? ratio(total - dead, total, "of stock value is moving") : ratio(t.good.count, t.good.count + t.bad.count + t.ugly.count, "of fast movers healthy");
    }
    if (lv.id === "order") {
      const known = c.st.cadence.filter(function (x) { return x.bucket && x.bucket !== "unknown"; });
      const off = known.filter(function (x) { return x.bucket === "overdue"; }).length;
      return ratio(known.length - off, known.length, "of customers order on their usual cycle");
    }
    return null;
  }

  /* ═════ OVERVIEW — the whole business, through the five levers ══════ */
  function overview(c, levers) {
    const rank = { ugly: 0, bad: 1, good: 2, preview: 3 };
    const need = levers.filter(function (x) { return x.status === "ugly" || x.status === "bad"; })
      .sort(function (a, b) { return rank[a.status] - rank[b.status] || (a.health ? a.health.value : 1) - (b.health ? b.health.value : 1); })
      .map(function (x) { return { id: x.id, label: x.label, status: x.status, text: problem(x) }; });
    const live = levers.filter(function (x) { return x.status !== "preview"; });
    const onTrack = levers.filter(function (x) { return x.status === "good"; });

    /* Wins: what went right, proven -- the owner's own results first, then
       what FoodBridge did for them this week. At most three. */
    const wins = [];
    const week = c.today - 7 * DAY;
    const L = {}; levers.forEach(function (x) { L[x.id] = x; });
    const paid = (c.st.ledger && c.st.ledger.payments || []).filter(function (p) { return dayOf(p.date) > week; });
    const paidSum = sum(paid, function (p) { return Number(p.amount) || 0; });
    const stuck = L.collections.status !== "preview" ? L.collections.tiles.good.rows.filter(function (r) { return r.stuck; }) : [];
    if (stuck.length) wins.push({ lever: "collections", text: rupees(stuck[0].value) + " stuck for " + plural(stuck[0].late, "day") + ", received from " + stuck[0].title });
    if (paidSum > 0) wins.push({ lever: "collections", text: rupees(paidSum) + " collected this week" });
    const deliveredToday = L.deliveries.status !== "preview" ? L.deliveries.tiles.good.count : 0;
    if (deliveredToday) wins.push({ lever: "deliveries", text: plural(deliveredToday, "delivery", "deliveries") + " done today" });
    /* No "X is on track": the green dial says it. Only the moment an area
       turns green is news (the screen adds "… is on track now"). */
    const acts = (c.rec.audit || []).filter(function (a) { return a.kind === "action" && a.ref && new Date(a.at).getTime() > week; });
    const count = function (type) { return acts.filter(function (a) { return a.action === type; }).length; };
    const orders = (c.rec.orders || []).filter(function (o) { return o.source === "control-tower" && new Date(o.date).getTime() > week; }).length;
    if (orders) wins.push({ lever: "order", text: plural(orders, "usual order") + " prepared", fb: true });
    if (count("create_purchase_request")) wins.push({ lever: "purchase", text: plural(count("create_purchase_request"), "purchase order") + " raised", fb: true });
    const sent = (c.rec.outbox || []).filter(function (m) { return new Date(m.createdAt).getTime() > week; }).length;
    if (sent) wins.push({ lever: "collections", text: plural(sent, "reminder") + " sent", fb: true });
    if (!wins.length) {
      const g = live.filter(function (x) { return x.tiles.good.count; }).sort(function (a, b) { return (b.health ? b.health.value : 0) - (a.health ? a.health.value : 0); })[0];
      if (g) wins.push({ lever: g.id, text: goodLine(g) });
    }

    const balanced = live.length === levers.length && onTrack.length === levers.length;
    /* Plain words for the owner: the areas by name, never "levers". */
    const names = need.map(function (n) { return n.label; });
    const listed = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
    /* Every area, worst first: one row each, the whole business at a glance. */
    const rows = levers.slice().sort(function (a, b) {
      return rank[a.status] - rank[b.status] || (a.health ? a.health.value : 1) - (b.health ? b.health.value : 1);
    }).map(function (x) {
      return { id: x.id, label: x.label, status: x.status,
               text: x.status === "preview" ? x.preview.promise : x.status === "good" ? goodLine(x) : problem(x),
               fill: x.health ? x.health.value : null };
    });
    return {
      rows: rows,
      headline: balanced ? "Your business is in balance"
        : !need.length ? "All connected areas are on track"
        : need.length <= 3 ? listed + (need.length === 1 ? " needs" : " need") + " you"
        : plural(need.length, "area needs", "areas need") + " you",
      context: [onTrack.length ? onTrack.length + " on track" : null, levers.length - live.length ? (levers.length - live.length) + " not connected" : null].filter(Boolean).join(" · "),
      balanced: balanced,
      need: need,
      wins: wins.slice(0, 3),
      balances: levers.reduce(function (out, x) { x.balance.forEach(function (b) { if (!out.some(function (o) { return o.id === b.id; })) out.push(b); }); return out; }, []).slice(0, 2),
    };
  }

  /* The lever's problem, in one line: its headline where the headline is the
     problem, else its worst tile. */
  function problem(x) {
    const t = x.tiles, w = t.ugly.count ? t.ugly : t.bad;
    if (x.id === "deliveries" || x.id === "order") return w.value + " " + w.word.toLowerCase();
    return x.headline.value;
  }
  function goodLine(x) {
    const g = x.tiles.good;
    return { deliveries: g.value + " delivered today", collections: g.value + " collected this week", purchase: g.value + " fast movers covered",
             inventory: g.value + " fast movers healthy", order: g.value + " orders in 30 days" }[x.id];
  }

  /* ═════ BALANCE — where one lever hurts another (spec §5) ═══════════ */
  function balances(c, levers) {
    const L = {}; levers.forEach(function (x) { L[x.id] = x; });
    const live = function (id) { return L[id].status !== "preview"; };
    const l = c.st.ledger;

    /* Cash · Collections ↔ Purchase */
    if (live("collections") && l && l.bills) {
      const billsLate = l.bills.filter(function (b) { return b.balance > 0 && b.dueDate && dayOf(b.dueDate) < c.today; });
      const owe = sum(billsLate, function (b) { return b.balance; });
      const owed = sum(l.invoices.filter(function (i) { return i.balance > 0 && i.dueDate && dayOf(i.dueDate) < c.today; }), function (i) { return i.balance; });
      /* "Collect before you buy" only means something when what customers
         owe is a real share of what the business owes its suppliers. */
      if (owe > 0 && owed > 0 && owed >= owe * 0.25) {
        const b = { id: "cash", title: "Cash", text: "You're owed " + rupees(owed) + " · you owe suppliers " + rupees(owe), move: "Collect before you buy" };
        L.collections.balance.push(Object.assign({ tab: "purchase" }, b));
        if (live("purchase")) L.purchase.balance.push(Object.assign({ tab: "collections" }, b));
      }
    }
    /* Credit · Collections ↔ Order */
    if (c.colours && c.asOf) {
      const end = dayOf(c.asOf);
      const ordered = {};
      c.st.orders.forEach(function (o) { if (dayOf(o.date) > end - 30 * DAY) ordered[o.customerId] = 1; });
      const risky = Object.keys(c.colours).filter(function (id) { const x = c.colours[id]; return (x.colour === "red" || x.colour === "fire") && ordered[id]; });
      if (risky.length) {
        const b = { id: "credit", title: "Credit", text: plural(risky.length, "overdue customer") + " ordered in the last 30 days", move: "Collect with the next order" };
        L.collections.balance.push(Object.assign({ tab: "order" }, b));
        L.order.balance.push(Object.assign({ tab: "collections" }, b));
      }
    }
    /* Stock · Inventory ↔ Purchase ↔ Order */
    const so = c.sig.stockout, slow = c.sig["slow-stock"];
    if (live("inventory") && so && !so.phase && slow && typeof so.impact.value === "number" && typeof slow.impact.value === "number") {
      const b = { id: "stock", title: "Stock", text: rupees(so.impact.value) + " of sales short · " + rupees(slow.impact.value) + " in dead stock", move: "Buy what sells, move what sits" };
      L.inventory.balance.push(Object.assign({ tab: "purchase" }, b));
    }
    /* Fulfilment · Order ↔ Inventory ↔ Deliveries */
    const risk = c.sig["order-risk"];
    if (risk && !risk.phase) {
      const b = { id: "fulfil", title: "Fulfilment", text: plural(risk.affected.orders, "order") + " can't be filled from stock", move: "Reorder the short products" };
      L.order.balance.push(Object.assign({ tab: "inventory" }, b));
      if (live("deliveries")) L.deliveries.balance.push(Object.assign({ tab: "inventory" }, b));
    }
  }

  const API = { build: build, T: T, rupees: rupees, plural: plural, date: date, mins: mins, emptiesLine: emptiesLine };
  root.CTLevers = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

/* ==========================================================================
   CONTROL TOWER · DEMO — a live demo business, so no lever is ever "not
   connected" (product owner, 22 Sep 2026: "the user should experience he is
   using a realtime control tower").

   Three parts, all labelled "Demo business" on screen:

     dataReady(now)   the onboarding sample business (orders, invoices,
                      payments, purchase orders, supplier bills, suppliers),
                      its dates shifted so the latest order was yesterday.
                      Built in memory for the tower only: onboarding's own
                      session (fb.v7.flow) and the shared order store are
                      never touched.
     ensureDay(...)   today's delivery route, planned once a day: about 30
                      stops on two vans of two rounds each, each stop with
                      its value, cases and crates. A slow first load runs
                      late down its van's route, the other van waits at the
                      dock, an afternoon round is booked past its load, and
                      some drops go short. Stops the van has reached are
                      recorded as they would have gone.
     tick(...)        the live clock: about every 20 seconds the next stop is
                      delivered, or a customer pays. Returns what happened.

   The business stays in balance however long the page is open (product
   owner, 22 Sep 2026). Nothing here raises new invoices, so:
     · cash taken at the door pays for that drop (forDrop), never the
       customer's old invoices;
     · customers pay at the counter only while overdue stays above FLOOR of
       what today's business opened with (its untouched invoices, before
       anything recorded here). Below it the clock only delivers, or stays
       quiet.
   Without this, half an hour of ticks cleared every overdue invoice and
   turned Collections green on its own.

   Deterministic by date and customer (a stable hash, not Math.random), so the
   same day plays the same way on every reload.

   Used when nothing is connected, and in place of onboarding's "Try sample
   data" (the same business, dated to its import). A business the owner
   connected (Zoho, Xero, files) is never simulated.
   ========================================================================== */

(function (root) {
  "use strict";

  const DAY = 86400000;
  const iso = function (t) { return new Date(t).toISOString().slice(0, 10); };
  const dayOf = function (s) { return new Date(String(s).slice(0, 10) + "T00:00:00Z").getTime(); };
  function rnd(key) {
    let h = 2166136261;
    const s = String(key);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 100000) / 100000;
  }
  const ORG = { id: "demo", name: "Demo business" };
  /* What the van finds at a stop it can't deliver (24 Sep 2026: the reasons
     the delivery app records, each one an incident in the tower). */
  const REASONS = ["Shop closed", "Owner away", "Refused", "Payment not ready", "Wrong address", "Order dispute", "Shop closed"];
  const RETURNS = [["Damaged", "Leaking"], ["Damaged", "Wet carton"], ["Expired", null], ["Unsold", null], ["Wrong product", null], ["Damaged", "Broken pack"]];
  const FLOOR = 0.6;                              // counter payments stop at 60% of opening overdue
  const COUNTER = "demo-counter";

  /* ── the business, dated to today ─────────────────────────────────────── */
  let cached = null;
  function dataReady(now) {
    const day = iso(now);
    if (cached && cached.day === day) return cached.dr;
    const W = root;
    if (!W.SEED || !W.FB_ORDER_HISTORY || !W.FB_SAMPLE || !W.FB_DATASET) return null;
    const seed = W.SEED, hist = W.FB_ORDER_HISTORY;
    let latest = 0;
    Object.keys(hist).forEach(function (cid) { (hist[cid].orders || []).forEach(function (o) { latest = Math.max(latest, dayOf(o.at)); }); });
    const shift = Math.max(0, Math.round((dayOf(day) - DAY - latest) / DAY));
    const nameOf = function (c) { return (c.name && (c.name.en || c.name)) || c._id; };
    const customers = seed.b2b.map(function (c) { return { id: c._id, name: nameOf(c) }; });
    const from = dayOf(day) - 240 * DAY;
    const orders = [];
    Object.keys(hist).forEach(function (cid) {
      (hist[cid].orders || []).forEach(function (o, i) {
        const at = iso(dayOf(o.at) + shift * DAY);
        if (dayOf(at) >= from) orders.push({ id: cid + "-" + i, customerId: cid, customerName: cid, date: at,
          lines: o.lines.map(function (l) { return { itemId: l.productId, qty: l.qty, unit: "pcs" }; }) });
      });
    });
    /* A distributor's stock, not a warehouse of leftovers: each fast mover
       holds 5 to 45 days of its own selling pace, so a few run low and one or
       two are out; most products that don't sell aren't stocked, and a few
       sit as dead stock. */
    const sold = {};
    orders.forEach(function (o) { if (dayOf(o.date) > dayOf(day) - 90 * DAY) o.lines.forEach(function (l) { sold[l.itemId] = (sold[l.itemId] || 0) + (Number(l.qty) || 0); }); });
    const products = seed.products.map(function (p) {
      const daily = (sold[p.id] || 0) / 90;
      const r = rnd(day + ":s:" + p.id);
      const stock = daily > 0 ? (r < 0.08 ? 0 : Math.round(daily * (5 + r * 40)))
        : (r < 0.8 ? 0 : Math.max(2, Math.round((p.systemStock || 10) * 0.2)));
      return { id: p.id, name: p.name, sku: p.artNo, unit: p.unit, stockOnHand: stock };
    });
    const modules = W.FB_SAMPLE.build(seed, orders, day);
    /* Most old invoices have been paid, the way a working business collects;
       what is left overdue is the real follow-up list. */
    const inv = modules.invoices.records, pays = modules.customerpayments.records;
    inv.forEach(function (i) {
      if (!(i.balance > 0) || !i.dueDate || dayOf(i.dueDate) > dayOf(day) - 30 * DAY) return;
      if (rnd(day + ":paid:" + i.id) < 0.72) {
        const at = iso(Math.min(dayOf(day) - DAY, dayOf(i.dueDate) + Math.floor(rnd(i.id + ":pd") * 20) * DAY));
        pays.push({ id: "dp" + i.id, customerId: i.customerId, date: at, amount: i.balance, mode: "UPI", invoiceId: i.id });
        i.balance = 0; i.status = "paid";
      }
    });
    /* Supplier bills too: most old ones are paid; a few are running late. */
    (modules.bills.records || []).forEach(function (b) {
      if (!(b.balance > 0) || !b.dueDate || dayOf(b.dueDate) > dayOf(day) - 20 * DAY) return;
      if (rnd(day + ":bill:" + b.id) < 0.8) { b.balance = 0; b.status = "paid"; }
    });
    const dr = W.FB_DATASET.fromApp({ app: "sample", org: ORG, customers: customers, products: products, orders: orders, modules: modules });
    dr.readAt = new Date(now).toISOString();
    dr.provenance = Object.assign({}, dr.provenance || {}, { kind: "sample", label: "Demo business", org: ORG });
    dr.demo = true;
    cached = { day: day, dr: dr };
    return dr;
  }
  function isDemo(raw) { return !!(raw && raw.dataReady && raw.dataReady.demo); }

  /* ── today's route ────────────────────────────────────────────────────── */
  const START = 9, END = 18;                      // the trips run 9 am to 6 pm
  /* Two vans, each with its driver: the number the owner calls when a stop
     runs late (the same crew the Tracking screen shows). */
  const VANS = [{ name: "Van 1", driver: "Ajay", phone: "9820011231" },
                { name: "Van 2", driver: "Kumar", phone: "9820011232" }];
  /* The spare at the dock: a tempo the owner can send when a van can't go
     on (24 Sep 2026: Move to another van needs somewhere to move to). */
  const SPARES = [{ name: "Van 3", driver: "Suresh", phone: "9820011233" }];
  const VAN_CASES = 40;                           // a load, in cases, per round
  const PLAN_V = 5;                               // a route planned before incidents is planned again
  function slotAt(day, i, n) {
    const span = (END - START) * 3600000;
    return dayOf(day) + START * 3600000 - 5.5 * 3600000 + Math.round(span * (i + 0.5) / n);   // IST → UTC
  }
  function plan(view, now) {
    const st = view.state;
    const day = iso(now);
    /* Who is due: customers closest to their usual order day first. */
    const cad = st.cadence.filter(function (c) { return c.orderCount > 1; })
      .sort(function (a, b) { return (Math.abs(a.daysOverdue - 0) + rnd(day + a.id) * 6) - (Math.abs(b.daysOverdue - 0) + rnd(day + b.id) * 6); });
    const n = Math.min(32, Math.max(12, cad.length));
    /* Delivery is bounded by vans, people, the dock and stock (owner, 22 Sep
       2026). Two vans, each running two rounds. One van's first round leaves
       the dock late — a helper short, loading slow — and every stop after it
       carries the delay; its second round leaves later still, after
       unloading. Bookings go by the customer's usual day, not by what fits,
       so the other van's afternoon round is booked past its load and its
       last stops don't make the trip. */
    const lateVan = rnd(day + ":lv") < 0.5 ? 0 : 1;
    const load = 60 + Math.floor(rnd(day + ":load") * 40);                       // 60–99 min at the dock
    const carry = load + 20 + Math.floor(rnd(day + ":unload") * 20);             // round 2 inherits it, and more
    const booked = {}, seq = {};
    const stops = cad.slice(0, n).map(function (c, i) {
      const r = rnd(day + ":v:" + c.id);
      const value = Math.round(((typeof c.avgValue === "number" && c.avgValue > 0 ? c.avgValue : 2500) * (0.7 + r * 0.7)) / 10) * 10;
      const van = i % 2, round = i < n / 2 ? 1 : 2, cases = 2 + Math.floor(r * 9);
      const key = van + ":" + round;
      booked[key] = (booked[key] || 0) + cases;
      const k = (seq[key] = (seq[key] || 0) + 1) - 1;                              // the stop's place in its round
      const s = { no: "ST-" + day.replace(/-/g, "").slice(2) + "-" + String(i + 1).padStart(2, "0"), customerId: c.id, value: value,
               cases: cases, cratesOut: 1 + Math.floor(rnd(day + ":c:" + c.id) * 4), slot: new Date(slotAt(day, i, n)).toISOString(),
               van: VANS[van].name, driver: VANS[van].driver, driverPhone: VANS[van].phone, round: round };
      /* A van far behind barely makes up time; one a little behind catches up
         within a few stops. */
      if (van === lateVan) { s.delayMin = (round === 1 ? load : carry) - 3 * k; s.delayWhy = round === 1 ? "Loading ran late" : "First trip ran late"; }
      /* One loading crew: the other van waits its turn at the dock. */
      else if (round === 1 && load / 2 - 10 * k > 0) { s.delayMin = Math.round(load / 2 - 10 * k); s.delayWhy = "Waited at the dock"; }
      if (van !== lateVan && round === 2 && booked[key] > VAN_CASES) s.overbooked = true;
      return s;
    });
    /* Left off the van: known when that round leaves the dock, not at the stop. */
    const leaves = {};
    stops.forEach(function (s) { const k = s.van + ":" + s.round; if (!leaves[k] || s.slot < leaves[k]) leaves[k] = s.slot; });
    stops.forEach(function (s) { if (s.overbooked) s.leftAt = leaves[s.van + ":" + s.round]; });
    /* The on-time van has a problem at midday (24 Sep 2026): a puncture or a
       breakdown, and its next stops wait for it — unless the owner moves them. */
    const okVan = VANS[1 - lateVan];
    const downAt = dayOf(day) + (12.25 + rnd(day + ":dn") * 0.75) * 3600000 - 5.5 * 3600000;
    const down = { van: okVan.name, driver: okVan.driver, kind: rnd(day + ":dk") < 0.5 ? "puncture" : "breakdown",
                   from: new Date(downAt).toISOString(), until: new Date(downAt + (45 + Math.floor(rnd(day + ":du") * 30)) * 60000).toISOString(),
                   where: "Jayanagar 4th Block" };
    /* One afternoon customer is over their credit limit; one morning drop
       will be disputed as never received. */
    const pm = stops.filter(function (s) { return s.round === 2 && !s.overbooked; });
    const credit = pm.length ? pm[Math.floor(rnd(day + ":cr") * pm.length)].no : null;
    const am = stops.filter(function (s) { return s.round === 1; });
    const pod = am.length ? am[Math.floor(rnd(day + ":pod") * am.length)].no : null;
    return { v: PLAN_V, day: day, stops: stops, vanCases: VAN_CASES, down: down, credit: credit, pod: pod,
             spares: SPARES.map(function (v) { return { van: v.name, driver: v.driver, driverPhone: v.phone }; }) };
  }
  /* How a stop went: deterministic, and like a real route. */
  function outcome(stop, day, colourOf) {
    const r = rnd(day + ":o:" + stop.customerId);
    const colour = colourOf(stop.customerId);
    const shaky = colour === "red" || colour === "fire";
    const trip = { van: stop.van || null, round: stop.round || null, driver: stop.driver || null, driverPhone: stop.driverPhone || null };
    if (stop.overbooked) return Object.assign({ status: "missed", reason: "Van full" }, trip);
    if (r < 0.09) return Object.assign({ status: "missed", reason: REASONS[Math.floor(rnd(day + ":r:" + stop.customerId) * REASONS.length)] }, trip);
    const returned = r > 0.93 ? 1 + Math.floor(rnd(day + ":rt:" + stop.customerId) * 2) : 0;
    const ret = returned ? RETURNS[Math.floor(rnd(day + ":rr:" + stop.customerId) * RETURNS.length)] : null;
    /* Now and then the shop pays less, saying the scheme rate is lower. */
    const disputed = r > 0.74 && r <= 0.78;
    const gap = disputed ? Math.max(200, Math.round(stop.value * (0.06 + rnd(day + ":g:" + stop.customerId) * 0.08) / 10) * 10) : 0;
    /* Booked without seeing the stock: about one drop in eight goes short. */
    const short = r > 0.81 && r <= 0.93 ? 1 + Math.floor(rnd(day + ":sh:" + stop.customerId) * 3) : 0;
    const pays = shaky ? rnd(day + ":p:" + stop.customerId) < 0.35 : rnd(day + ":p:" + stop.customerId) < 0.8;
    const back = Math.max(0, stop.cratesOut - (rnd(day + ":e:" + stop.customerId) < 0.25 ? 1 : 0));
    const bottles = back * 12 - (rnd(day + ":b:" + stop.customerId) < 0.15 ? 2 : 0);
    return Object.assign({ status: returned ? "returned" : "delivered", returnedCases: returned, shortCases: short,
             returnReason: ret ? ret[0] : null, returnDetail: ret ? ret[1] : null,
             returnValue: returned ? Math.round(stop.value * returned / Math.max(1, stop.cases)) : null,
             dispute: disputed ? { kind: "price", billed: stop.value, paid: stop.value - gap, gap: gap, why: "They say the scheme rate is lower" } : null,
             collected: disputed ? stop.value - gap : pays ? stop.value : 0, empties: { cratesOut: stop.cratesOut, cratesBack: back, bottlesBack: bottles },
             nextOrder: rnd(day + ":n:" + stop.customerId) < 0.3 },
             trip, stop.delayMin ? { lateMin: stop.delayMin, lateWhy: stop.delayWhy } : {});
  }
  function record(store, stop, day, colourOf, at) {
    const o = outcome(stop, day, colourOf);
    const rec = Object.assign({ customerId: stop.customerId, orderNo: stop.no, at: at,
                                value: stop.value || null, cases: stop.cases || null }, o);
    const saved = store.addDeliveries([rec])[0];
    if (o.collected > 0) store.addPayment({ customerId: stop.customerId, amount: o.collected, mode: rnd(day + stop.no) < 0.5 ? "Cash" : "UPI", via: saved.no, forDrop: true, at: at });
    return { rec: saved, stop: stop };
  }
  function model(view) {
    return root.CTLevers ? root.CTLevers.build(view, { demand: root.CTSignals._detectors.demand(view.state) }) : null;
  }
  function colours(view, m) {
    const mm = {};
    const lv = m || model(view);
    const c = lv && lv.levers.filter(function (x) { return x.id === "collections"; })[0];
    if (c && c.status !== "preview") [].concat(c.tiles.ugly.rows, c.tiles.bad.rows, c.tiles.good.rows).forEach(function (r) { if (r.colour) mm[r.id] = r.colour; });
    return function (id) { return mm[id] || "green"; };
  }
  function doneNos(view) {
    const d = {};
    (view.records.deliveries || []).forEach(function (x) { if (x.orderNo) d[x.orderNo] = 1; });
    return d;
  }
  /* Stops the owner moved to another van (the tower's Move to another van,
     or Live Tracking's Reassign): the same fact either way. */
  function movedOf(view) {
    const m = {};
    (view.records.events || []).forEach(function (e) {
      if (e.type === "stops.moved") ((e.data || {}).stops || []).forEach(function (no) { m[no] = { to: e.data.to, at: e.at }; });
    });
    return m;
  }
  const vanNamed = function (n) { return VANS.concat(SPARES).filter(function (v) { return v.name === n; })[0] || null; };
  /* When the van reaches a stop: its slot and its van's delay. A van that is
     down holds its stops until it moves; a stop moved to the other van goes
     about twenty minutes after the move. */
  function reach(s, route, moved) {
    if (s.overbooked) return { at: new Date(s.leftAt).getTime(), stop: s };
    const m = moved[s.no];
    if (m) {
      const v = vanNamed(m.to) || {};
      return { at: Math.max(new Date(s.slot).getTime(), new Date(m.at).getTime() + 20 * 60000),
               stop: Object.assign({}, s, { van: m.to, driver: v.driver || s.driver, driverPhone: v.phone || s.driverPhone, delayMin: 0, delayWhy: null }) };
    }
    let at = new Date(s.slot).getTime() + (s.delayMin || 0) * 60000;
    const d = route.down;
    if (d && s.van === d.van) {
      const from = new Date(d.from).getTime(), until = new Date(d.until).getTime();
      if (at >= from && at < until) {
        const held = route.stops.filter(function (x) { return x.van === d.van && !x.overbooked && x.slot <= s.slot; }).filter(function (x) {
          const t0 = new Date(x.slot).getTime() + (x.delayMin || 0) * 60000; return t0 >= from && t0 < until; }).length;
        const late = Math.round((until + held * 8 * 60000 - new Date(s.slot).getTime()) / 60000);
        return { at: until + held * 8 * 60000, stop: Object.assign({}, s, { delayMin: late, delayWhy: d.kind === "puncture" ? "Puncture on the way" : "Van broke down" }) };
      }
    }
    return { at: at, stop: s };
  }
  /* The demo's own facts, each written once, when its moment comes. */
  function happenings(store, view, now) {
    const route = view.records.route;
    if (!route || !route.down) return 0;
    const ev = view.records.events || [];
    const had = function (k) { return ev.some(function (e) { return e.demoKey === k; }); };
    const put = [];
    const d = route.down, v = vanNamed(d.van) || {};
    if (now >= new Date(d.from).getTime() && !had("down:" + route.day))
      put.push({ demoKey: "down:" + route.day, at: d.from, type: "problem.reported", by: v.driver, where: "Delivery app · Report a problem", how: "driver",
                 subject: { van: d.van }, data: { kind: d.kind, where: d.where, until: d.until } });
    const cs = route.credit && route.stops.filter(function (s) { return s.no === route.credit; })[0];
    const done = doneNos(view);
    if (cs && !done[cs.no] && now >= new Date(cs.slot).getTime() - 2 * 3600000 && !had("credit:" + route.day)) {
      const l = view.state.ledger;
      let owed = l && l.invoices ? l.invoices.filter(function (i) { return i.customerId === cs.customerId && i.balance > 0; }).reduce(function (n, i) { return n + i.balance; }, 0) : 0;
      if (owed < 12000) owed = Math.round((cs.value * 4.5 + 9000) / 100) * 100;
      const limit = Math.max(10000, Math.floor(owed * 0.82 / 1000) * 1000);
      put.push({ demoKey: "credit:" + route.day, at: new Date(new Date(cs.slot).getTime() - 2 * 3600000).toISOString(), type: "credit.over", by: "FoodBridge", where: "FoodBridge", how: "system",
                 subject: { stopNo: cs.no, customerId: cs.customerId }, data: { owed: owed, limit: limit, ask: Math.ceil((owed - limit) / 100) * 100 } });
    }
    const pd = route.pod && (view.records.deliveries || []).filter(function (x) { return x.orderNo === route.pod && x.status !== "missed"; })[0];
    if (pd && now >= new Date(pd.at).getTime() + 90 * 60000 && !had("pod:" + route.day))
      put.push({ demoKey: "pod:" + route.day, at: new Date(new Date(pd.at).getTime() + 90 * 60000).toISOString(), type: "dispute.raised", by: view.state.customerById[pd.customerId] || "The customer",
                 where: "WhatsApp", how: "customer", subject: { stopNo: pd.orderNo, customerId: pd.customerId }, data: { kind: "pod", why: "The shop says the delivery never came", value: pd.value } });
    /* Settlement: each van counts what came back; one is short, one over. */
    const end = dayOf(route.day) + (END - 5.5) * 3600000;
    const prods = (view.state.products || []).filter(function (p) { return p.mrp; }).slice(0, 2);
    if (now >= end + 20 * 60000 && prods.length === 2 && !had("count:" + route.day)) {
      put.push({ demoKey: "count:" + route.day, at: new Date(end + 20 * 60000).toISOString(), type: "count.submitted", by: VANS[0].driver, where: "Delivery app · Settlement", how: "driver",
                 subject: { van: VANS[0].name }, data: { mismatches: [{ name: prods[0].name, expected: 12, actual: 8, diff: -4, value: 4 * prods[0].mrp }] } });
      put.push({ demoKey: "count2:" + route.day, at: new Date(end + 25 * 60000).toISOString(), type: "count.submitted", by: VANS[1].driver, where: "Delivery app · Settlement", how: "driver",
                 subject: { van: VANS[1].name }, data: { mismatches: [{ name: prods[1].name, expected: 6, actual: 10, diff: 4, value: 4 * prods[1].mrp }] } });
    }
    if (put.length) store.addEvents(put);
    return put.length;
  }
  /* The proof for what the owner set in motion: a van back at a stop that
     was missed, the driver's answer, the customer accepting the proof. */
  function proofs(store, view, now, m) {
    const X = root.CTIncidents;
    const lv = (m || model(view));
    const dl = lv && lv.levers.filter(function (x) { return x.id === "deliveries"; })[0];
    if (!X || !dl || !dl.incidents) return 0;
    const out = X.simulate(dl.incidents, now);
    const evs = [], dls = [];
    out.forEach(function (p) {
      if (p.kind === "event") evs.push(Object.assign({ at: new Date(now).toISOString(), demo: true }, p.event));
      else if (p.kind === "deliver") {
        const s = p.subject;
        dls.push({ customerId: s.customerId || null, orderNo: s.orderNo || s.key, at: p.at, status: "delivered", value: s.value || null, cases: s.cases || null,
                   collected: s.value || 0, van: s.van || null, driver: s.driver || null, driverPhone: s.driverPhone || null, fixOf: p.incident.id,
                   empties: { cratesOut: 0, cratesBack: 0, bottlesBack: 0 } });
      }
    });
    if (evs.length) store.addEvents(evs);
    if (dls.length) store.addDeliveries(dls);
    return evs.length + dls.length;
  }

  /* Plan today once, and record every stop the van has already reached: a
     late van reaches its stops late, so they are still on the road. */
  function ensureDay(store, view, now) {
    const day = iso(now);
    const r = view.records.route;
    let fresh = 0;
    if (!r || r.day !== day || r.v !== PLAN_V) { store.setRoute(plan(view, now)); fresh = 1; }
    const route = store.read().route;
    const done = doneNos(view);
    const colourOf = colours(view);
    const moved = movedOf(view);
    let n = 0;
    route.stops.forEach(function (s) {
      const x = reach(s, route, moved);
      if (!done[s.no] && x.at <= now) { record(store, x.stop, day, colourOf, new Date(x.at).toISOString()); n += 1; }
    });
    return fresh + n + happenings(store, Object.assign({}, view, { records: store.read() }), now);
  }

  /* Overdue as today's business opened: its own invoices, before any payment
     recorded here. The tower pays copies, so these stay as built. */
  function openingOverdue(now) {
    const dr = dataReady(now);
    const inv = dr && dr.dataset && dr.dataset.invoices && dr.dataset.invoices.records || [];
    return inv.reduce(function (t, i) { return i.balance > 0 && i.dueDate && dayOf(i.dueDate) < now ? t + i.balance : t; }, 0);
  }

  /* The live clock: the next stop, or a payment at the counter. */
  function tick(store, view, now) {
    const day = iso(now);
    const route = view.records.route;
    if (!route || route.day !== day) return null;
    const name = function (id) { return view.state.customerById[id] || id; };
    const m = model(view);
    /* First what the owner's fixes brought about, then the day's own news. */
    if (proofs(store, view, now, m)) return { at: now, lever: "deliveries", text: "A fix came through" };
    if (happenings(store, view, now)) return { at: now, lever: "deliveries", text: "Something happened on the road" };
    const done = doneNos(view);
    const moved = movedOf(view);
    const beat = Math.floor(now / 20000);
    const due = route.stops.filter(function (s) { return !done[s.no]; }).map(function (s) { return reach(s, route, moved); })
      /* A van that is down holds its stops until it moves. */
      .filter(function (x) { return x.at <= now + 40 * 60000 && !(route.down && x.stop.van === route.down.van && x.at > now && now < new Date(route.down.until).getTime() + 3600000); })
      .sort(function (a, b) { return a.at - b.at; });
    const next = due[0] || null;
    if (next && rnd(day + ":t:" + beat) < 0.75) {
      const r = record(store, next.stop, day, colours(view, m), new Date(now).toISOString());
      const d = r.rec;
      return { at: now, lever: "deliveries",
        text: d.status === "missed" ? "Missed at " + name(d.customerId) + " · " + d.reason
          : "Delivered to " + name(d.customerId) + (d.collected ? " · " + root.CTLevers.rupees(d.collected) + " collected" : "") };
    }
    /* A payment from someone who owes, while overdue is above the floor. */
    const l = view.state.ledger;
    const owing = l && l.invoices ? l.invoices.filter(function (i) { return i.balance > 0 && i.dueDate && dayOf(i.dueDate) < now; }) : [];
    const overdue = owing.reduce(function (t, i) { return t + i.balance; }, 0);
    const floor = FLOOR * openingOverdue(now);
    if (owing.length) {
      const inv = owing[Math.floor(rnd(day + ":pay:" + beat) * owing.length)];
      let amt = Math.min(inv.balance, Math.round(inv.balance * (0.5 + rnd(beat + inv.id) * 0.5) / 10) * 10);
      if (inv.balance - amt < 500) amt = inv.balance;       // no dust left on an old invoice
      if (amt > 0 && overdue - amt >= floor) {
        store.addPayment({ customerId: inv.customerId, amount: amt, mode: rnd(beat) < 0.5 ? "UPI" : "Cash", source: COUNTER });
        return { at: now, lever: "collections", text: name(inv.customerId) + " paid " + root.CTLevers.rupees(amt) };
      }
    }
    return null;
  }

  const API = { dataReady: dataReady, isDemo: isDemo, ensureDay: ensureDay, tick: tick, _plan: plan, _outcome: outcome, _openingOverdue: openingOverdue, _proofs: proofs, FLOOR: FLOOR, VANS: VANS };
  root.CTDemo = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

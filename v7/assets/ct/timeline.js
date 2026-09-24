/* ==========================================================================
   CONTROL TOWER · TIMELINE — the business's news, newest first.
   (On screen "Timeline" / "Business Timeline"; "updates" in code.)

   Owner, 22 Sep 2026: "business timeline activity like the user's business
   news bulletins … the way we had Wins on the Overview, but aligned with a
   timeline." A distributor already reads the day this way: the trip
   closure, the collection register, Tally's Day Book. So this is curated
   news, never a raw log: thirty drops a day are one line per trip, not
   thirty lines.

     build(view, model, opts) → { days: [{ key, label, items }], count }

   view   tower.pass()               (records, state)
   model  CTLevers.build(view, …)    (for who paid late, and the thresholds)
   opts   { now, statusLog: [{ at, lever, from, to }], days: 7 }

   Each item is ONE line with its figure inside it (CT copy rule):
     { key, at, time, lever, tone: "good"|"bad"|"info", win, text, tile }
   `tile` is where tapping it lands in the lever. Proven records only
   (D-015): nothing dated after now, nothing without a record behind it.

   Pure: no DOM, no storage, no clock of its own. Runs under node.
   ========================================================================== */

(function (root) {
  "use strict";

  const DAY = 86400000;
  const ORD = ["first", "second", "third", "fourth"];
  const ms = function (x) { return typeof x === "number" ? x : new Date(x).getTime(); };
  /* The business keeps Indian time, wherever the page is opened. */
  const IST = 5.5 * 3600000;
  const dayKey = function (t) { return new Date(ms(t) + IST).toISOString().slice(0, 10); };
  const dayOnly = function (s) { return new Date(String(s).slice(0, 10) + "T00:00:00Z").getTime() - IST; };   // a date without a time: its IST midnight

  function time(t) {
    const d = new Date(ms(t) + IST), h = d.getUTCHours(), m = d.getUTCMinutes();
    return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + (h < 12 ? "am" : "pm");
  }
  function dayLabel(key, todayKey) {
    if (key === todayKey) return "Today";
    const y = dayKey(dayOnly(todayKey) + IST - DAY);
    if (key === y) return "Yesterday";
    const d = new Date(key + "T00:00:00Z");
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()] + " " + d.getUTCDate() + " " +
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  }

  function build(view, model, opts) {
    const L = root.CTLevers;
    const o = opts || {};
    const now = ms(o.now || view.state.now);
    const from = dayOnly(dayKey(now)) - ((o.days || 7) - 1) * DAY;      // the start of the first of the last 7 days
    const rec = view.records || {};
    const st = view.state;
    const name = function (id) { return st.customerById[id] || id; };
    const T = (model && model.T) || L.T;
    const items = [];
    const add = function (it) {
      const at = ms(it.at);
      if (!isFinite(at) || at > now || at < from) return;             // proven, and in the window
      items.push(Object.assign({ tone: "info", tile: null, win: false }, it, { at: at, time: it.dateOnly ? null : time(at) }));
    };
    const cases = function (n) { return L.plural(n, "case"); };
    /* What opens when a line is tapped (owner, 22 Sep 2026): the records
       behind it — a few facts, and the list it sums up. Proven, as the line. */
    const fact = function (label, value) { return value === null || value === undefined || value === "" ? null : [label, String(value)]; };
    const detail = function (title, facts, heading, rows) { return { title: title, facts: facts.filter(Boolean), heading: heading || null, rows: rows || [] }; };
    const tripOf = function (d) { return d.van ? d.van + " · " + ORD[(d.round || 1) - 1] + " trip" : null; };
    const money = function (n) { return Number(n) ? L.rupees(Number(n)) : null; };
    /* How one drop went, in a few words. */
    const how = function (d) {
      const w = [d.status === "missed" ? "Missed" + (d.reason ? " · " + d.reason : "") : d.status === "returned" ? "Delivered, some returned" : "Delivered"];
      if (d.status !== "missed" && Number(d.lateMin) > T.LATE_MIN) w.push("late " + L.mins(Number(d.lateMin)));
      if (Number(d.shortCases) > 0) w.push("short " + cases(Number(d.shortCases)));
      if (Number(d.returnedCases) > 0) w.push("returned " + cases(Number(d.returnedCases)));
      return w.join(" · ");
    };
    const dropRow = function (d) { return { title: name(d.customerId), note: time(d.at) + " · " + how(d), value: money(d.collected) }; };
    const dropDetail = function (title, d) {
      return detail(title, [fact("Customer", name(d.customerId)), fact("What happened", how(d)), fact("Trip", tripOf(d)),
        fact("Late by", d.status !== "missed" && Number(d.lateMin) > T.LATE_MIN ? L.mins(Number(d.lateMin)) + (d.lateWhy ? " · " + d.lateWhy.toLowerCase() : "") : null),
        fact("Collected", money(d.collected)), fact("Recorded", time(d.at))]);
    };

    /* ── Deliveries: trips as trips, problems one by one ─────────────── */
    const dl = rec.deliveries || [];
    const route = rec.route && rec.route.stops ? rec.route : null;
    const trips = {};
    dl.forEach(function (d) {
      if (d.van && d.round) (trips[dayKey(d.at) + "|" + d.van + "|" + d.round] = trips[dayKey(d.at) + "|" + d.van + "|" + d.round] || []).push(d);
    });
    Object.keys(trips).forEach(function (k) {
      const p = k.split("|"), recs = trips[k].slice().sort(function (a, b) { return ms(a.at) - ms(b.at); });
      const van = p[1], round = +p[2], which = van + "'s " + ORD[round - 1] + " trip";
      const late = recs.filter(function (d) { return d.status !== "missed" && Number(d.lateMin) > T.LATE_MIN; });
      const planned = route && route.day === p[0] ? route.stops.filter(function (s) { return s.van === van && s.round === round; }) : [];
      if (late.length) add({ key: "late:" + k, at: late[0].at, lever: "deliveries", tone: "bad", tile: "ugly",
        text: which + " running " + L.mins(Number(late[0].lateMin)) + " late" + (late[0].lateWhy ? " · " + late[0].lateWhy.toLowerCase() : ""),
        detail: detail(which + " running late", [fact("Trip", van + " · " + ORD[round - 1] + " trip"), fact("Left late by", L.mins(Number(late[0].lateMin))),
          fact("Why", late[0].lateWhy), fact("Late drops so far", late.length + (planned.length ? " of " + planned.length : ""))],
          "Late drops", late.map(function (d) { return { title: name(d.customerId), note: time(d.at) + " · late " + L.mins(Number(d.lateMin)), value: money(d.collected) }; })) });
      const full = recs.filter(function (d) { return d.status === "missed" && d.reason === "Van full"; });
      if (full.length) {
        const load = route && route.vanCases, booked = planned.reduce(function (n, s) { return n + (Number(s.cases) || 0); }, 0);
        const casesOf = {}; planned.forEach(function (s) { casesOf[s.no] = s.cases; });
        add({ key: "full:" + k, at: full[0].at, lever: "deliveries", tone: "bad", tile: "ugly",
          text: L.plural(full.length, "order") + " didn't fit " + van + " · left for the next trip",
          detail: detail("Orders that didn't fit " + van, [fact("Trip", van + " · " + ORD[round - 1] + " trip"), fact("A van's load", load ? cases(load) : null),
            fact("Booked on this trip", booked ? cases(booked) : null), fact("Left for the next trip", L.plural(full.length, "order"))],
            "Left behind", full.map(function (d) { return { title: name(d.customerId), note: casesOf[d.orderNo] ? cases(casesOf[d.orderNo]) : null, value: null }; })) });
      }
      /* Done: every stop planned for this trip has an outcome. */
      if (planned.length && recs.length >= planned.length) {
        const got = recs.filter(function (d) { return d.status !== "missed"; });
        const cash = got.reduce(function (n, d) { return n + (Number(d.collected) || 0); }, 0);
        const all = got.length === planned.length;
        add({ key: "done:" + k, at: recs[recs.length - 1].at, lever: "deliveries", tone: all ? "good" : "info", win: all, tile: "good",
          text: which + " done · " + got.length + " of " + planned.length + " delivered" + (cash ? " · " + L.rupees(cash) + " collected" : ""),
          detail: detail(which + " done", [fact("Delivered", got.length + " of " + planned.length), fact("Collected at the door", money(cash)),
            fact("Late", late.length ? L.plural(late.length, "drop") : null), fact("Missed", recs.length - got.length ? L.plural(recs.length - got.length, "drop") : null),
            fact("First drop", time(recs[0].at)), fact("Last drop", time(recs[recs.length - 1].at))], "Drops", recs.map(dropRow)) });
      }
    });
    dl.forEach(function (d) {
      const who = name(d.customerId);
      if (d.status === "missed" && d.reason !== "Van full") add({ key: "miss:" + d.no, at: d.at, lever: "deliveries", tone: "bad", tile: "ugly", text: "Missed at " + who + (d.reason ? " · " + d.reason : ""), detail: dropDetail("Missed delivery", d) });
      if (Number(d.shortCases) > 0) add({ key: "short:" + d.no, at: d.at, lever: "deliveries", tone: "bad", tile: "ugly", text: "Short " + cases(Number(d.shortCases)) + " at " + who, detail: dropDetail("Short delivery", d) });
      if (Number(d.returnedCases) > 0) add({ key: "ret:" + d.no, at: d.at, lever: "deliveries", tone: "bad", tile: "ugly", text: who + " returned " + cases(Number(d.returnedCases)), detail: dropDetail("Returned cases", d) });
      if (d.rescheduledAt && d.rescheduledFor) add({ key: "resch:" + d.no, at: d.rescheduledAt, lever: "deliveries", tile: "bad", text: who + "'s delivery moved to " + L.date(d.rescheduledFor),
        detail: detail("Delivery moved", [fact("Customer", who), fact("Missed", time(d.at) + (d.reason ? " · " + d.reason : "")), fact("Moved to", L.date(d.rescheduledFor))]) });
      /* A delivery the owner recorded by hand (no trip) is news on its own. */
      if (!d.van && d.status !== "missed") {
        add({ key: "dl:" + d.no, at: d.at, lever: "deliveries", tone: "good", tile: "good",
          text: "Delivered to " + who + (Number(d.collected) ? " · " + L.rupees(Number(d.collected)) + " collected" : ""), detail: dropDetail("Delivery", d) });
        if (Number(d.lateMin) > T.LATE_MIN) add({ key: "dlate:" + d.no, at: d.at, lever: "deliveries", tone: "bad", tile: "ugly", text: "Late " + L.mins(Number(d.lateMin)) + " at " + who, detail: dropDetail("Late delivery", d) });
      }
    });

    /* ── Incidents (24 Sep 2026): a van problem from the road, a fix made
       on the ground, and every problem fixed — the day's wins. ────────── */
    const dlv = model && model.levers.filter(function (x) { return x.id === "deliveries"; })[0];
    if (dlv && dlv.incidents) dlv.incidents.incidents.forEach(function (inc) {
      if (inc.kind === "van" && inc.event) add({ key: "van:" + inc.id, at: inc.at, lever: "deliveries", tone: "bad", tile: "ugly",
        text: inc.title + " · " + inc.cat.label.toLowerCase() + (inc.by ? ", reported by " + inc.by : ""),
        detail: detail(inc.title, [fact("What happened", inc.what), fact("Holding", inc.children.length ? L.plural(inc.children.length, "stop") : null), fact("Reported", time(inc.at))]) });
      (inc.actions || []).forEach(function (a) {
        if (!a.by || a.by === "You") return;
        add({ key: "act:" + inc.id + ":" + a.at, at: a.at, lever: "deliveries", tile: "bad", text: a.by + " · " + a.note.toLowerCase().replace(/^\w/, function (c) { return c.toUpperCase(); }) + " · " + inc.title,
          detail: detail("Fixed on the ground", [fact("Who", a.by), fact("Where", a.where), fact("What", a.note), fact("For", inc.title)]) });
      });
      if (inc.state === "resolved" && inc.actions && inc.proof) add({ key: "fix:" + inc.id, at: inc.proof.at, lever: "deliveries", tone: "good", win: true, tile: "good",
        text: inc.title + " · " + inc.cat.label.toLowerCase() + ", fixed",
        detail: detail("Fixed", [fact("What went wrong", inc.cat.label), fact("What was done", inc.actions.map(function (a) { return a.note; }).join("; ")), fact("Proof", inc.proof.text)]) });
    });

    /* ── Money in: counter and owner payments; the imported ledger's ─── */
    const col = model && model.levers.filter(function (x) { return x.id === "collections"; })[0];
    const lateOf = {};
    if (col && col.status !== "preview") col.tiles.good.rows.forEach(function (r) { lateOf[r.id] = r.late || 0; });
    /* Money in reads like the collection register: an hour's payments are
       one line; a lone payment is its own; money that was stuck for months
       is always its own line, and it is a win. */
    function payDetail(title, p, late) {
      return detail(title, [fact("Customer", name(p.customerId)), fact("Amount", money(p.amount)), fact("Paid by", p.mode), fact("Received", time(p.at)),
        fact("Stuck for", late >= T.STUCK_DAYS ? L.plural(late, "day") : null)]);
    }
    const told = {};                                                    // "after 201 days" once: the payment that ended the wait
    const hours = {};
    (rec.payments || []).slice().sort(function (a, b) { return ms(a.at) - ms(b.at); }).forEach(function (p) {
      if (p.forDrop || p.via) return;                                   // door cash is in its trip's line
      const late = lateOf[p.customerId] || 0, stuck = late >= T.STUCK_DAYS && !told[p.customerId];
      if (stuck) {
        told[p.customerId] = true;
        add({ key: "pay:" + p.no, at: p.at, lever: "collections", tone: "good", win: true, tile: "good",
          text: L.rupees(Number(p.amount) || 0) + " received from " + name(p.customerId) + " after " + L.plural(late, "day"),
          detail: payDetail("Money that was stuck, received", p, late) });
        return;
      }
      const h = new Date(ms(p.at) + IST).toISOString().slice(0, 13);
      (hours[h] = hours[h] || []).push(p);
    });
    Object.keys(hours).forEach(function (h) {
      const ps = hours[h], last = ps[ps.length - 1];
      const total = ps.reduce(function (n, p) { return n + (Number(p.amount) || 0); }, 0);
      const who = {}; ps.forEach(function (p) { who[p.customerId] = 1; });
      const n = Object.keys(who).length;
      add({ key: ps.length === 1 ? "pay:" + last.no : "payh:" + h, at: last.at, lever: "collections", tone: "good", tile: "good",
        text: L.rupees(total) + " received from " + (n === 1 ? name(last.customerId) : L.plural(n, "customer")),
        detail: ps.length === 1 ? payDetail("Payment received", last, 0) :
          detail("Payments received", [fact("Total", L.rupees(total)), fact("Customers", n), fact("Payments", ps.length), fact("Between", time(ps[0].at) + " and " + time(last.at))],
            "Payments", ps.slice().reverse().map(function (x) { return { title: name(x.customerId), note: time(x.at) + (x.mode ? " · " + x.mode : ""), value: money(x.amount) }; })) });
    });
    const ledger = st.ledger && st.ledger.payments || [];
    ledger.forEach(function (p) {
      if (p.own) return;                                                // ours, above, with its time
      add({ key: "lpay:" + (p.id || p.date + p.customerId), at: dayOnly(p.date), dateOnly: true, lever: "collections", tone: "good", tile: "good",
        text: L.rupees(Number(p.amount) || 0) + " received from " + name(p.customerId),
        detail: detail("Payment received", [fact("Customer", name(p.customerId)), fact("Amount", money(p.amount)), fact("Paid by", p.mode), fact("Date", L.date(p.date)),
          fact("From", "Your books")]) });
    });

    /* ── What the owner did, and FoodBridge prepared ─────────────────── */
    const prs = {}; (rec.purchaseRequests || []).forEach(function (r) { prs[r.no] = r; });
    const msgs = {}; (rec.outbox || []).forEach(function (m) { msgs[m.id] = m; });
    const ords = {}; (rec.orders || []).forEach(function (r) { ords[r.no] = r; });
    const fus = {}; (rec.followups || []).forEach(function (r) { fus[r.no] = r; });
    (rec.audit || []).forEach(function (a) {
      if (a.kind !== "action" || !a.ref) return;
      const refs = String(a.ref).split(","), n = refs.length;
      if (a.action === "send_reminders") {
        const ms = refs.map(function (r) { return msgs[r]; }).filter(Boolean);
        add({ key: "a:" + a.id, at: a.at, lever: "collections", tile: "ugly", text: L.plural(n, "payment reminder") + " sent",
          detail: detail("Payment reminders", [fact("Sent", L.plural(n, "reminder")), fact("Time", time(a.at)), fact("On", "WhatsApp · waiting in the outbox (no sender connected in this demo)")],
            "Reminded", ms.map(function (m) { return { title: m.name || name(m.customerId), note: null, value: money(m.amount) }; })) });
      }
      if (a.action === "create_purchase_request") {
        const pr = prs[a.ref];
        add({ key: "a:" + a.id, at: a.at, lever: "purchase", tile: "bad",
          text: "Purchase order " + a.ref + " raised" + (pr ? " · " + L.plural(pr.lines.length, "product") + (pr.valueAtMrp ? ", " + L.rupees(pr.valueAtMrp) : "") : ""),
          detail: detail("Purchase order " + a.ref, [fact("Products", pr ? pr.lines.length : null), fact("Value at MRP", pr ? money(pr.valueAtMrp) : null), fact("Raised", time(a.at)),
            fact("Next", "Place it with the supplier")], "Lines", pr ? pr.lines.map(function (l) { return { title: l.name, note: l.supplierName || null, value: l.qty + (l.unit ? " " + l.unit : "") }; }) : []) });
      }
      if (a.action === "create_orders") {
        const os = refs.map(function (r) { return ords[r]; }).filter(Boolean);
        add({ key: "a:" + a.id, at: a.at, lever: "order", tone: "good", tile: "good", text: L.plural(n, "order") + " created for the next trips",
          detail: detail("Orders created", [fact("Orders", n), fact("Created", time(a.at)), fact("Goes out", "On the next trips")],
            "Orders", os.map(function (r) { return { title: r.customer || name(r.customerId), note: r.no + (r.items ? " · " + L.plural(r.items, "item") : ""), value: money(r.amount) }; })) });
      }
      if (a.action === "create_followup") {
        const f = fus[a.ref];
        add({ key: "a:" + a.id, at: a.at, lever: "inventory", text: "Call list saved · " + (a.outcome ? a.outcome.replace(/^[^:]*:\s*/, "") : ""),
          detail: detail("Call list " + a.ref, [fact("For", f && f.title), fact("Saved", time(a.at))], "To call",
            f ? f.customers.map(function (c) { return { title: c.name || name(c.customerId), note: null, value: null }; }) : []) });
      }
    });
    Object.keys(rec.holds || {}).forEach(function (id) {
      add({ key: "hold:" + id, at: rec.holds[id].since, lever: "collections", tone: "bad", tile: "ugly", text: "Supply stopped for " + name(id),
        detail: detail("Supply stopped", [fact("Customer", name(id)), fact("Since", time(rec.holds[id].since)), fact("To restart", "Open the customer in Collections")]) });
    });
    const counts = {};
    (rec.stockCounts || []).forEach(function (c) { (counts[c.at] = counts[c.at] || []).push(c); });
    Object.keys(counts).forEach(function (at) {
      add({ key: "count:" + at, at: at, lever: "inventory", tile: "good", text: L.plural(counts[at].length, "product") + " counted",
        detail: detail("Stock counted", [fact("Products", counts[at].length), fact("Counted", time(at))], "Counted",
          counts[at].map(function (c) { const pr = st.productById && st.productById[c.productId]; return { title: pr ? pr.name : c.productId, note: null, value: String(c.qty) }; })) });
    });

    /* ── A lever changing where it stands (the screen keeps the log) ──── */
    const label = {}, now_ = {}; (model ? model.levers : []).forEach(function (x) { label[x.id] = x.label; now_[x.id] = x; });
    const WORD = { ugly: "Urgent", bad: "Needs work", good: "On track", preview: "Not connected" };
    (o.statusLog || []).forEach(function (s) {
      const nm = label[s.lever] || s.lever;
      const good = s.to === "good";
      add({ key: "st:" + s.lever + ":" + ms(s.at), at: s.at, lever: s.lever, tone: good ? "good" : s.to === "ugly" ? "bad" : "info", win: good,
        tile: s.to === "preview" ? null : s.to,
        text: good ? nm + " is on track now" : s.to === "ugly" ? nm + " turned Urgent" : nm + " needs work now",
        detail: detail(nm + " changed", [fact("Was", WORD[s.from]), fact("Became", WORD[s.to]), fact("At", time(s.at)),
          fact("Now", now_[s.lever] ? WORD[now_[s.lever].status] + " · " + now_[s.lever].headline.value : null)]) });
    });

    /* Newest first; a day's dated-only lines after its timed ones. */
    items.sort(function (a, b) { return b.at - a.at || (a.time ? 0 : 1) - (b.time ? 0 : 1); });
    const todayKey = dayKey(now);
    const days = [];
    items.slice(0, o.cap || 80).forEach(function (it) {
      const k = dayKey(it.at);
      let d = days[days.length - 1];
      if (!d || d.key !== k) { d = { key: k, label: dayLabel(k, todayKey), items: [] }; days.push(d); }
      d.items.push(it);
    });
    return { days: days, count: items.length };
  }

  const API = { build: build, _time: time, _dayKey: dayKey };
  root.CTTimeline = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);

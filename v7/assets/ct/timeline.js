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
      if (late.length) add({ key: "late:" + k, at: late[0].at, lever: "deliveries", tone: "bad", tile: "ugly",
        text: which + " running " + L.mins(Number(late[0].lateMin)) + " late" + (late[0].lateWhy ? " · " + late[0].lateWhy.toLowerCase() : "") });
      const full = recs.filter(function (d) { return d.status === "missed" && d.reason === "Van full"; });
      if (full.length) add({ key: "full:" + k, at: full[0].at, lever: "deliveries", tone: "bad", tile: "ugly",
        text: L.plural(full.length, "order") + " didn't fit " + van + " · left for the next trip" });
      /* Done: every stop planned for this trip has an outcome. */
      const planned = route && route.day === p[0] ? route.stops.filter(function (s) { return s.van === van && s.round === round; }).length : 0;
      if (planned && recs.length >= planned) {
        const got = recs.filter(function (d) { return d.status !== "missed"; });
        const cash = got.reduce(function (n, d) { return n + (Number(d.collected) || 0); }, 0);
        const all = got.length === planned;
        add({ key: "done:" + k, at: recs[recs.length - 1].at, lever: "deliveries", tone: all ? "good" : "info", win: all, tile: "good",
          text: which + " done · " + got.length + " of " + planned + " delivered" + (cash ? " · " + L.rupees(cash) + " collected" : "") });
      }
    });
    dl.forEach(function (d) {
      const who = name(d.customerId);
      if (d.status === "missed" && d.reason !== "Van full") add({ key: "miss:" + d.no, at: d.at, lever: "deliveries", tone: "bad", tile: "ugly", text: "Missed at " + who + (d.reason ? " · " + d.reason : "") });
      if (Number(d.shortCases) > 0) add({ key: "short:" + d.no, at: d.at, lever: "deliveries", tone: "bad", tile: "ugly", text: "Short " + cases(Number(d.shortCases)) + " at " + who });
      if (Number(d.returnedCases) > 0) add({ key: "ret:" + d.no, at: d.at, lever: "deliveries", tone: "bad", tile: "ugly", text: who + " returned " + cases(Number(d.returnedCases)) });
      if (d.rescheduledAt && d.rescheduledFor) add({ key: "resch:" + d.no, at: d.rescheduledAt, lever: "deliveries", tile: "bad", text: who + "'s delivery moved to " + L.date(d.rescheduledFor) });
      /* A delivery the owner recorded by hand (no trip) is news on its own. */
      if (!d.van && d.status !== "missed") {
        add({ key: "dl:" + d.no, at: d.at, lever: "deliveries", tone: "good", tile: "good",
          text: "Delivered to " + who + (Number(d.collected) ? " · " + L.rupees(Number(d.collected)) + " collected" : "") });
        if (Number(d.lateMin) > T.LATE_MIN) add({ key: "dlate:" + d.no, at: d.at, lever: "deliveries", tone: "bad", tile: "ugly", text: "Late " + L.mins(Number(d.lateMin)) + " at " + who });
      }
    });

    /* ── Money in: counter and owner payments; the imported ledger's ─── */
    const col = model && model.levers.filter(function (x) { return x.id === "collections"; })[0];
    const lateOf = {};
    if (col && col.status !== "preview") col.tiles.good.rows.forEach(function (r) { lateOf[r.id] = r.late || 0; });
    /* Money in reads like the collection register: an hour's payments are
       one line; a lone payment is its own; money that was stuck for months
       is always its own line, and it is a win. */
    const told = {};                                                    // "after 201 days" once: the payment that ended the wait
    const hours = {};
    (rec.payments || []).slice().sort(function (a, b) { return ms(a.at) - ms(b.at); }).forEach(function (p) {
      if (p.forDrop || p.via) return;                                   // door cash is in its trip's line
      const late = lateOf[p.customerId] || 0, stuck = late >= T.STUCK_DAYS && !told[p.customerId];
      if (stuck) {
        told[p.customerId] = true;
        add({ key: "pay:" + p.no, at: p.at, lever: "collections", tone: "good", win: true, tile: "good",
          text: L.rupees(Number(p.amount) || 0) + " received from " + name(p.customerId) + " after " + L.plural(late, "day") });
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
        text: L.rupees(total) + " received from " + (n === 1 ? name(last.customerId) : L.plural(n, "customer")) });
    });
    const ledger = st.ledger && st.ledger.payments || [];
    ledger.forEach(function (p) {
      if (p.own) return;                                                // ours, above, with its time
      add({ key: "lpay:" + (p.id || p.date + p.customerId), at: dayOnly(p.date), dateOnly: true, lever: "collections", tone: "good", tile: "good",
        text: L.rupees(Number(p.amount) || 0) + " received from " + name(p.customerId) });
    });

    /* ── What the owner did, and FoodBridge prepared ─────────────────── */
    const prs = {}; (rec.purchaseRequests || []).forEach(function (r) { prs[r.no] = r; });
    (rec.audit || []).forEach(function (a) {
      if (a.kind !== "action" || !a.ref) return;
      const n = String(a.ref).split(",").length;
      if (a.action === "send_reminders") add({ key: "a:" + a.id, at: a.at, lever: "collections", tile: "ugly", text: L.plural(n, "payment reminder") + " sent" });
      if (a.action === "create_purchase_request") {
        const pr = prs[a.ref];
        add({ key: "a:" + a.id, at: a.at, lever: "purchase", tile: "bad",
          text: "Purchase order " + a.ref + " raised" + (pr ? " · " + L.plural(pr.lines.length, "product") + (pr.valueAtMrp ? ", " + L.rupees(pr.valueAtMrp) : "") : "") });
      }
      if (a.action === "create_orders") add({ key: "a:" + a.id, at: a.at, lever: "order", tone: "good", tile: "good", text: L.plural(n, "order") + " created for the next trips" });
      if (a.action === "create_followup") add({ key: "a:" + a.id, at: a.at, lever: "inventory", text: "Call list saved · " + (a.outcome ? a.outcome.replace(/^[^:]*:\s*/, "") : "") });
    });
    Object.keys(rec.holds || {}).forEach(function (id) {
      add({ key: "hold:" + id, at: rec.holds[id].since, lever: "collections", tone: "bad", tile: "ugly", text: "Supply stopped for " + name(id) });
    });
    const counts = {};
    (rec.stockCounts || []).forEach(function (c) { (counts[c.at] = counts[c.at] || []).push(c); });
    Object.keys(counts).forEach(function (at) {
      add({ key: "count:" + at, at: at, lever: "inventory", tile: "good", text: L.plural(counts[at].length, "product") + " counted" });
    });

    /* ── A lever changing where it stands (the screen keeps the log) ──── */
    const label = {}; (model ? model.levers : []).forEach(function (x) { label[x.id] = x.label; });
    (o.statusLog || []).forEach(function (s) {
      const nm = label[s.lever] || s.lever;
      const good = s.to === "good";
      add({ key: "st:" + s.lever + ":" + ms(s.at), at: s.at, lever: s.lever, tone: good ? "good" : s.to === "ugly" ? "bad" : "info", win: good,
        tile: s.to === "preview" ? null : s.to,
        text: good ? nm + " is on track now" : s.to === "ugly" ? nm + " turned Urgent" : nm + " needs work now" });
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

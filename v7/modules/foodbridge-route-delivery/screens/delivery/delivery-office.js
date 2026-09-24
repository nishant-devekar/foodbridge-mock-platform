/* ==========================================================================
   DELIVERY MANAGEMENT — the office channel (24 Sep 2026)

   Not in the upstream app. The Control Tower is "the office": the owner who
   watches every van and decides what happens when something goes wrong.
   This file is the driver's whole side of that conversation.

     RD_EMIT         the one way any screen here tells the office a fact
                     (platform event stream, assets/fb-events.js)
     sync()          reads what the office did back off the same stream and
                     applies it — a skipped stop sent back today returns to
                     the queue. Runs on load, on every navigation (before the
                     screen draws) and when the tower writes (storage event);
                     never inside a render.
     Office screen   /office/:routeId — the van's open problem, questions
                     waiting for a reply, and every update for today's route
     Pieces          the queue's Office strip, the office line on a stop row,
                     the banner on a stop, the reply sheet

   How the office's answer finds its stop: an owner's action names its
   incident; an incident raised here points at the event that raised it, and
   that event names this app's stop (subject.rdStop, written by RD_EMIT).
   Anything else is matched by the customer's name, and van-level problems
   by the route's name. Only today's actions count.
   ========================================================================== */

(function () {
  "use strict";
  const KEY = "fb.v7.events", SEEN = "fb.v7.rd.officeSeen";
  const D = window.RD_DB, U = window.RD_UI;
  const IST = 5.5 * 3600000;
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* ── Writing to the office ─────────────────────────────────────────── */

  // One line to the stream, with who and where. Never breaks the screen: a
  // write that fails returns null and the screen still saves its own record.
  window.RD_EMIT = function (type, route, stop, data, where, subject, note) {
    if (!window.FB_EVENTS) return null;
    try {
      return window.FB_EVENTS.emit(type, Object.assign({
        by: driverName(route),
        where: where || "Delivery app",
        // rdStop / rdRoute: which stop of this app the fact is about, so the
        // office's answer finds its way back to it.
        subject: Object.assign({ customer: stop ? stop.customerName : null, van: route ? route.name : null,
          rdStop: stop && stop.id ? stop.id : null, rdRoute: (window.RD && window.RD.state && window.RD.state.routeId) || null }, subject || {}),
        data: data || {},
      }, note ? { note: note } : {}));
    } catch (e) { return null; }
  };
  function driverName(route) { return route && route.driver ? String(route.driver.name || "").split(" ")[0] : null; }

  /* ── Time, in the office's zone ────────────────────────────────────── */
  const norm = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  const dayIst = function (ms) { return new Date(ms + IST).toISOString().slice(0, 10); };
  const clock = function (ms) {
    const d = new Date(ms + IST);
    let h = d.getUTCHours(); const m = d.getUTCMinutes(), pm = h >= 12;
    h = h % 12 || 12;
    return h + ":" + String(m).padStart(2, "0") + " " + (pm ? "pm" : "am");
  };
  const at = function (iso) { return clock(new Date(iso).getTime()); };
  function dayWord(iso) {
    if (!iso) return "another day";
    if (iso === dayIst(Date.now())) return "today";
    if (iso === dayIst(Date.now() + 86400000)) return "tomorrow";
    return WD[new Date(iso + "T00:00:00Z").getUTCDay()];
  }
  function read() {
    try { const v = JSON.parse(window.localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  /* ── What each office action says to the driver ────────────────────── */
  // `back` puts a skipped stop back in today's queue; `route` belongs to the
  // whole van rather than one stop; `ask` wants a reply.
  function words(ev) {
    const a = ev.type.slice(7), d = ev.data || {};
    switch (a) {
      case "reschedule": return d.date === dayIst(Date.now())
        ? { text: "Go back today" + (d.window ? ", " + d.window : ""), back: true }
        : { text: "Moved to " + dayWord(d.date) + (d.window ? " " + d.window : "") + ". Not today." };
      case "retry": return { text: "Go back about " + clock(new Date(d.at).getTime()), back: true };
      case "move": return { text: (d.stops || []).length + " stop" + ((d.stops || []).length === 1 ? "" : "s") + " moved to " + d.to, route: true };
      case "tell": return { text: "Customers told their new time" };
      case "send": return { text: (d.charge === "free" ? "Replacement" : "Balance") + " goes on " + dayWord(d.date) + "'s trip: " + (d.items || "") };
      case "takeBack": return { text: "Bring it back tonight" + (d.dest === "throw" ? ", to be thrown away" : d.dest === "damaged" ? ", as damaged stock" : ", into stock") };
      case "cancel": return { text: "Delivery cancelled: " + String(d.why || "").toLowerCase() };
      case "writeOff": return { text: inr(d.value) + " written off. Nothing more to do." };
      case "fixOrder": return { text: "Order fixed to " + inr(d.now) + ". Deliver it.", back: true };
      case "fixCustomer": return { text: "Details updated" + (d.address ? ": " + d.address : "") + (d.unload ? ". Unload at " + d.unload : "") + (d.hours ? ". Delivers " + d.hours : "") };
      case "adjust": return { text: d.decision === "refuse" ? "Collect " + inr(d.gap) + " at the next visit" : "The " + inr(d.gap) + " difference is approved" };
      case "creditNote": return { text: inr(d.amount) + " credit note raised for the shop" };
      case "collectLater": return { text: "Collect " + inr(d.amount) + (d.when === "next" ? " at the next visit" : " this week") };
      case "credit": return { text: d.decision === "first" ? "Collect " + inr(d.ask) + " before unloading" : d.decision === "once" ? "Deliver this once" + (d.reason ? ": " + d.reason : "") : "Credit limit raised. Deliver as usual." };
      case "ask": return { text: d.question || "What happened here?", ask: true };
      case "proof": return { text: "Your photo and signature went to the shop" };
      case "close": return { text: "Closed by the office" };
      default: return null;
    }
  }
  function inr(n) { return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN"); }

  /* ── Matching an action to its stop ────────────────────────────────── */
  function targetOf(ev, byId) {
    const sj = ev.subject || {};
    const m = /ev:(EV-\d+)/.exec(String(sj.incident || ""));
    const orig = m ? byId[m[1]] : null;
    const os = (orig && orig.subject) || {};
    return { stopId: os.rdStop || null, routeId: os.rdRoute || null, customer: os.customer || sj.customer || null,
             van: os.van || sj.van || null, incident: sj.incident || null, origType: orig ? orig.type : null };
  }
  function routeIds() { return Object.keys(D.db.routeDetails || {}); }
  function findStop(t) {
    const all = routeIds();
    const order = t.routeId && D.db.routeDetails[t.routeId] ? [t.routeId].concat(all.filter(function (r) { return r !== t.routeId; })) : all;
    if (t.stopId) for (const rid of order) { const s = D.getStops(rid).find(function (x) { return x.id === t.stopId; }); if (s) return { rid: rid, stop: s }; }
    if (t.customer) { const n = norm(t.customer); for (const rid of order) { const s = D.getStops(rid).find(function (x) { return norm(x.customerName) === n; }); if (s) return { rid: rid, stop: s }; } }
    return null;
  }
  function findRoute(t) {
    if (t.routeId && D.db.routeDetails[t.routeId]) return t.routeId;
    const n = norm(t.van);
    return routeIds().filter(function (rid) { return norm(D.db.routeDetails[rid].name) === n; })[0] || null;
  }
  function unskip(stop) {
    if (stop.status !== "SKIPPED") return;
    stop.status = "PENDING"; stop.skipReason = null; stop.completedAt = null;
    const det = D.db.stopDetails && D.db.stopDetails[stop.id];
    if (det) { det.status = "PENDING"; det.skipReason = null; det.completedAt = null; }
  }

  // The driver's own agreement at the door (Skip Stop's "When can we come
  // back?"), in the driver's words.
  function ownWords(ev) {
    if (ev.type !== "action.reschedule") return null;
    const d = ev.data || {};
    return d.date === dayIst(Date.now())
      ? { text: "Back later today" + (d.window ? ", " + d.window : ""), back: true }
      : { text: "Back " + dayWord(d.date) + (d.window ? " " + d.window : "") };
  }

  // The office fixed the order before it was delivered: the stop's lines
  // become the office's, so what the driver hands over and collects is the
  // fixed order, not the booking. The office names lines "2 × Chakli (400g)";
  // a line it doesn't name is off the order. When the office's lines can't
  // be matched to this order at all, the booking stands and the banner says
  // what the office fixed it to.
  function orderTotal(rid, sid) {
    const det = D.resolveStopDetail(rid, sid) || {};
    return (det.orderItems || []).reduce(function (a, l) { return a + l.qty * (l.unitPrice || 0); }, 0);
  }
  function applyFixedOrder(rid, stop, d) {
    const det = D.resolveStopDetail(rid, stop.id);
    if (!det || !(det.orderItems || []).length || !d.items) return;
    const want = {};
    String(d.items).split(/,\s*/).forEach(function (bit) {
      const m = /^(\d+)\s*[×x]\s*(.+)$/.exec(bit.trim());
      if (m) want[norm(m[2])] = Number(m[1]);
    });
    const names = Object.keys(want);
    if (!names.length) return;
    const lines = det.orderItems;
    const known = names.every(function (n) { return lines.some(function (l) { return norm(l.productName || l.name) === n; }); });
    if (!known) return;
    det.orderItems = lines.map(function (l) {
      const q = want[norm(l.productName || l.name)] || 0;
      return Object.assign({}, l, { qty: q, lineTotal: q * (l.unitPrice || 0) });
    }).filter(function (l) { return l.qty > 0; });
    stop.todayOrderAmount = det.orderItems.reduce(function (a, l) { return a + l.qty * (l.unitPrice || 0); }, 0);
    stop.orderFixedByOffice = true;
    // The driver may be looking at this very order: it redraws from the fix.
    if (window.RD && window.RD.state.stopId === stop.id) delete window.RD.state.scratch.items;
  }

  // The office sent goods on today's trip (a replacement, or the balance of
  // a short drop): they join the stop's order, so the driver hands them over
  // and the receipt says so — a replacement at ₹0, a balance at the van's
  // price. Lines the van doesn't carry by that name stay on the banner only.
  function parseItems(text) {
    return String(text || "").split(/,\s*/).map(function (bit) {
      const m = /^(\d+)\s*[×x]\s*(.+)$/.exec(bit.trim());
      return m ? { qty: Number(m[1]), name: m[2] } : null;
    }).filter(Boolean);
  }
  function applySentGoods(rid, stop, d) {
    const det = D.resolveStopDetail(rid, stop.id);
    const load = D.db.stockLoads && D.db.stockLoads[rid];
    if (!det || !load || !load.products) return;
    const free = d.charge === "free";
    let added = 0;
    parseItems(d.items).forEach(function (it) {
      const pr = load.products.filter(function (x) { return norm(x.name) === norm(it.name); })[0];
      if (!pr) return;
      det.orderItems = (det.orderItems || []).concat([{ productId: pr.productId, productName: pr.name + (free ? " (replacement)" : " (balance)"),
        qty: it.qty, unitPrice: free ? 0 : pr.unitPrice, lineTotal: free ? 0 : it.qty * pr.unitPrice, fromOffice: true }]);
      added += 1;
    });
    if (!added) return;
    stop.todayOrderAmount = det.orderItems.reduce(function (a, l) { return a + l.qty * (l.unitPrice || 0); }, 0);
    stop.orderFixedByOffice = true;
    if (window.RD && window.RD.state.stopId === stop.id) delete window.RD.state.scratch.items;
  }

  /* ── What this app told the office today ───────────────────────────── */
  // Every report the driver sent, with where the office has got to on it —
  // so "the office is told" is something the driver can see, for a load
  // check or a count as much as for a skipped stop.
  const ISSUE_WORD = { order: "Disputes the order", price: "Disputes the price", scheme: "Disputes the scheme", quality: "Quality complaint",
                       pod: "Says it never came", parking: "No parking or loading", hours: "Set delivery hours" };
  const PAY_WORD = { CASH: "No cash ready", UPI: "UPI didn't go through", CHEQUE: "Cheque bounced or disputed" };
  const RETURN_WORD = { DAMAGED: "Damaged", EXPIRED: "Expired", NEAR_EXPIRY: "Near expiry", UNSOLD: "Unsold", WRONG_PRODUCT: "Wrong product",
                        WRONG_BATCH: "Wrong batch", SUBSTITUTE: "Substitute rejected" };
  const DETAIL_WORD = { LEAKING: "leaking", WET: "wet carton", BROKEN: "broken pack" };
  function summary(ev) {
    const d = ev.data || {};
    switch (ev.type) {
      case "stop.skipped": return "Skipped · " + (d.label || d.reason || "");
      case "dispute.raised": return (ISSUE_WORD[d.kind] || "Issue") + (d.gap ? " · " + inr(d.gap) : "");
      case "problem.reported": return (PROBLEM_WORD[d.kind] || "Van problem") + (d.where ? " · " + d.where : "");
      case "payment.failed": return (PAY_WORD[d.method] || "Payment problem") + (d.amount ? " · " + inr(d.amount) : "");
      case "payment.adjusted": return inr(d.gap) + " adjusted as offer";
      case "return.recorded": {
        const units = (d.items || []).reduce(function (n, x) { return n + (Number(x.qty) || 0); }, 0);
        return "Return · " + (RETURN_WORD[d.reason] || "Returned") + (d.detail ? ", " + (DETAIL_WORD[d.detail] || String(d.detail).toLowerCase()) : "") + " · " + units + " unit" + (units === 1 ? "" : "s");
      }
      case "stop.itemsEdited": return "Order " + inr(d.booked) + " → " + inr(d.delivered) + (d.why === "short" ? " · short on the van" : d.why === "customer" ? " · shop took less" : "");
      case "loadstock.checked": {
        const bits = (d.mismatches || []).map(function (m) { return m.reason === "batch" ? "a batch isn't the one ordered" : m.name + " " + m.loaded + " of " + m.plan; });
        if (d.dispatchDocsReady === false) bits.push("dispatch papers not ready");
        return "Load check · " + bits.join(", ");
      }
      case "count.submitted": { const n = (d.mismatches || []).length; return "Stock count · " + n + " discrepanc" + (n === 1 ? "y" : "ies"); }
      case "assets.recorded": { const e = d.empties || {}, k = Math.max(0, (e.cratesOut || 0) - (e.cratesBack || 0)); return k ? k + " crate" + (k === 1 ? "" : "s") + " not back" : null; }
      default: return null;
    }
  }
  function reports(evs, today) {
    const out = [];
    evs.forEach(function (ev) {
      if (!ev || !ev.at || dayIst(new Date(ev.at).getTime()) !== today) return;
      if ((ev.where || "").indexOf("Delivery app") !== 0) return;
      const text = summary(ev); if (!text) return;
      const sj = ev.subject || {};
      const hit = sj.rdStop ? findStop({ stopId: sj.rdStop, routeId: sj.rdRoute }) : null;
      const rid = hit ? hit.rid : findRoute({ routeId: sj.rdRoute, van: sj.van });
      if (!rid) return;
      // Where the office has got to: its latest action on any incident this
      // report raised (a load check or a count raises one per line).
      const ids = "ev:" + ev.id, done = evs.filter(function (x) {
        const inc = String((x.subject || {}).incident || "");
        if (!(inc === ids || inc.indexOf(ids + ":") === 0 || inc === "crates:" + ids) || x.id === ev.id) return false;
        // The office's actions, and the driver's own "we're moving" that
        // closes a van problem (a come-back agreed at the door is neither).
        return x.type === "van.moving" || (x.type.indexOf("action.") === 0 && (x.where || "").indexOf("Delivery app") !== 0);
      });
      const last = done[done.length - 1];
      const status = !last ? "Waiting for the office" : last.type === "van.moving" ? "Closed · you're moving" : "Office: " + ((words(last) || {}).text || "acted on it");
      out.push({ id: ev.id, at: ev.at, rid: rid, stopId: hit ? hit.stop.id : null, title: hit ? hit.stop.customerName : (D.db.routeDetails[rid] || {}).name, text: text, status: status, waiting: !last });
    });
    return out;
  }

  /* ── The model ─────────────────────────────────────────────────────── */
  // notes: { id, at, text, kind, incident, ask, answer, customer, rid, stopId }
  const O = { notes: [], reports: [], problems: {}, applied: {}, known: null };
  const VAN_FACTS = /^(problem\.reported|loadstock\.checked|count\.submitted)$/;
  const PROBLEM_WORD = { breakdown: "Breakdown", puncture: "Puncture", accident: "Accident", fridge: "Fridge not cooling",
                         temperature: "Temperature out of range", traffic: "Traffic jam", road: "Road closed" };

  function sync() {
    const evs = read(), byId = {};
    evs.forEach(function (e) { if (e && e.id) byId[e.id] = e; });
    const today = dayIst(Date.now());
    const notes = [], problems = {};

    // A van problem reported today stays open on the route until the van
    // moves again or the office closes it.
    evs.forEach(function (ev) {
      if (!ev || ev.type !== "problem.reported" || !ev.at || dayIst(new Date(ev.at).getTime()) !== today) return;
      const inc = "ev:" + ev.id;
      const over = evs.some(function (x) { return x.subject && x.subject.incident === inc && (x.type === "van.moving" || x.type === "action.close"); });
      if (over) return;
      const rid = findRoute({ routeId: (ev.subject || {}).rdRoute, van: (ev.subject || {}).van });
      if (rid) (problems[rid] = problems[rid] || []).push({ id: ev.id, incident: inc, kind: (ev.data || {}).kind, where: (ev.data || {}).where || null, at: ev.at });
    });

    evs.forEach(function (ev) {
      if (!ev || !ev.type || ev.type.indexOf("action.") !== 0) return;
      // Today's, or one the office set for today (the next trip, a new day).
      const forToday = ev.data && ev.data.date === today;
      if (ev.at && dayIst(new Date(ev.at).getTime()) !== today && !forToday) return;
      // A come-back the driver agreed at the door is the driver's own word,
      // not the office's: it still puts a today stop back in the queue, but
      // it never reads as a message from the office.
      const own = (ev.where || "").indexOf("Delivery app") === 0;
      const w = own ? ownWords(ev) : words(ev); if (!w) return;
      const t = targetOf(ev, byId);
      const note = { id: ev.id, at: ev.at, text: w.text, kind: ev.type.slice(7), incident: t.incident, ask: !!w.ask, own: own,
                     customer: t.customer, rid: null, stopId: null, answer: null };
      if (w.ask) note.answer = evs.filter(function (x) {
        return x.type === "question.answered" && x.subject && x.subject.incident === t.incident && x.at >= ev.at;
      }).slice(-1)[0] || null;
      const vanLevel = w.route || (t.origType && VAN_FACTS.test(t.origType));
      // "Try again" on a van problem is the road, not a shop.
      if (vanLevel && note.kind === "retry") note.text = "Try the route again about " + clock(new Date((ev.data || {}).at).getTime());
      const hit = vanLevel ? null : findStop(t);
      if (hit) {
        note.rid = hit.rid; note.stopId = hit.stop.id; note.customer = hit.stop.customerName;
        // The goods are already with the shop: fixing the order re-issues
        // its bill, it doesn't send the driver back.
        const delivered = hit.stop.status === "DELIVERED" && hit.stop.completedAt && hit.stop.completedAt < ev.at;
        if (note.kind === "fixOrder" && delivered) { note.text = "Bill re-issued for " + inr((ev.data || {}).now); w.back = false; }
        if (!O.applied[ev.id]) {
          O.applied[ev.id] = 1;
          if (note.kind === "fixOrder" && !delivered) applyFixedOrder(hit.rid, hit.stop, ev.data || {});
          if (note.kind === "send" && (ev.data || {}).date === today && hit.stop.status !== "DELIVERED") applySentGoods(hit.rid, hit.stop, ev.data || {});
          // Back in the queue; it becomes the current stop only if the van has none.
          if (w.back) { unskip(hit.stop); if (D.advanceToNextStop) D.advanceToNextStop(hit.rid); }
        }
        // A fix whose lines couldn't be matched leaves the booking; if its
        // total differs, the driver is told to bring the order into line.
        if (note.kind === "fixOrder" && !delivered && !hit.stop.orderFixedByOffice) {
          const now = Math.round(Number((ev.data || {}).now) || 0), have = Math.round(orderTotal(hit.rid, hit.stop.id));
          if (now && have && now !== have) note.text = "Order fixed to " + inr(now) + " (it says " + inr(have) + "). Edit the order to match, then deliver.";
        }
      } else {
        note.rid = findRoute(t);
        note.customer = null;
      }
      if (note.rid) notes.push(note);
    });

    O.reports = reports(evs, today);
    const fresh = O.known ? notes.filter(function (n) { return !O.known[n.id]; }) : [];
    O.known = {}; notes.forEach(function (n) { O.known[n.id] = 1; });
    O.notes = notes; O.problems = problems;
    return fresh;
  }

  /* ── Seen / needs reply ────────────────────────────────────────────── */
  function seenSet() {
    try { const v = JSON.parse(window.localStorage.getItem(SEEN) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function markSeen(pred) {
    const seen = seenSet(), have = {};
    seen.forEach(function (id) { have[id] = 1; });
    let changed = false;
    O.notes.forEach(function (n) { if (pred(n) && !have[n.id]) { seen.push(n.id); changed = true; } });
    if (!changed) return;
    try { window.localStorage.setItem(SEEN, JSON.stringify(seen.slice(-500))); } catch (e) { /* private mode: unread stays unread */ }
  }
  function isSeen(n) { return seenSet().indexOf(n.id) !== -1; }
  const needsReply = function (n) { return n.ask && !n.answer; };

  // What the office said. The driver's own come-back agreements are kept
  // with the stop but never counted as the office's word.
  function forRoute(rid) { return O.notes.filter(function (n) { return n.rid === rid && !n.own; }); }
  function forStop(sid) { return O.notes.filter(function (n) { return n.stopId === sid && !n.own; }); }
  function ownFor(sid) { return O.notes.filter(function (n) { return n.stopId === sid && n.own; }); }
  function reportsFor(rid) { return (O.reports || []).filter(function (r) { return r.rid === rid; }); }
  function latest(list) { return list.length ? list[list.length - 1] : null; }
  function openProblem(rid) { return latest(O.problems[rid] || []); }

  /* ── When it runs ──────────────────────────────────────────────────── */
  // Registered before RD.mount's own listener, so it runs first: the screen
  // about to draw already reads the office's latest word. Opening a screen
  // is what marks its notes seen.
  function onNavigate() {
    sync();
    const raw = (window.location.hash || "").replace(/^#/, "").split("/").filter(Boolean);
    if (raw[0] === "office" && raw[1]) markSeen(function (n) { return n.rid === raw[1]; });
    if ((raw[0] === "delivery" || raw[0] === "stop-summary") && raw[2]) markSeen(function (n) { return n.stopId === raw[2] && !needsReply(n); });
  }
  window.addEventListener("hashchange", onNavigate);
  onNavigate();

  // The tower writes from another tab or frame: apply it, and say so.
  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    const fresh = sync();
    if (!window.RD || !window.RD.render) return;
    const rid = window.RD.state.routeId;
    const mine = fresh.filter(function (n) { return !rid || n.rid === rid; });
    if (mine.length) {
      const n = mine[mine.length - 1];
      window.RD.toast({ title: n.ask ? "Office asks" + (n.customer ? " · " + n.customer : "") : "Office" + (n.customer ? " · " + n.customer : ""), detail: n.text }, "office");
    } else {
      window.RD.render();
    }
  });

  /* ── Pieces the screens draw ───────────────────────────────────────── */

  // The queue's one line about the office, above the search. Absent until
  // the office has said something today or the van has an open problem.
  function strip(rid) {
    const notes = forRoute(rid), prob = openProblem(rid), sent = reportsFor(rid);
    if (!notes.length && !prob && !sent.length) return "";
    const waiting = sent.filter(function (r) { return r.waiting; }).length;
    const asks = notes.filter(needsReply).length;
    const unseen = notes.filter(function (n) { return !isSeen(n); }).length;
    const urgent = !!prob || asks > 0;
    const sub = prob ? (PROBLEM_WORD[prob.kind] || "Van problem") + " · tap when you're moving"
      : asks ? asks + " question" + (asks === 1 ? "" : "s") + " waiting for your reply"
      : unseen ? unseen + " new update" + (unseen === 1 ? "" : "s")
      : waiting ? waiting + " report" + (waiting === 1 ? "" : "s") + " sent · waiting for the office"
      : notes.length ? "Latest: " + latest(notes).text
      : sent.length + " report" + (sent.length === 1 ? "" : "s") + " sent today";
    const count = prob ? "!" : asks || unseen;
    return '<button type="button" class="rd-row"' + U.act("office-open", rid) + ' style="' + U.sty({
      width: "calc(100% - 24px)", margin: "8px 12px 0", display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
      background: urgent ? "#fff7ed" : "white", border: "1.5px solid " + (urgent ? "#fed7aa" : "#e5e7eb"), borderRadius: 14,
      textAlign: "left", fontFamily: "inherit", cursor: "pointer",
    }) + '">' +
      '<span style="' + U.sty({ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: urgent ? "#ffedd5" : "#e8f5f7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }) + '">🏢</span>' +
      '<span style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
        '<span style="' + U.sty({ display: "block", fontSize: 14, fontWeight: 700, color: "#111" }) + '">Office</span>' +
        '<span style="' + U.sty({ display: "block", fontSize: 12, color: urgent ? "#c2410c" : "#888", fontWeight: urgent ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(sub) + "</span>" +
      "</span>" +
      (count ? '<span style="' + U.sty({ minWidth: 22, height: 22, padding: "0 7px", borderRadius: 11, background: urgent ? U.ORANGE : U.BRAND, color: "white", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }) + '">' + count + "</span>" : "") +
      '<span style="' + U.sty({ fontSize: 18, color: "#d1d5db", flexShrink: 0 }) + '">›</span>' +
    "</button>";
  }

  // The office's latest word on a stop, as a second line under the row's
  // own subtitle — the row keeps saying what the customer owes.
  function rowLine(stop) {
    const n = latest(forStop(stop.id));
    if (!n) {
      const mine = latest(ownFor(stop.id));
      return mine ? '<div style="' + U.sty({ fontSize: 12, marginTop: 1, fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">You agreed: ' + U.esc(mine.text) + "</div>" : "";
    }
    const ask = needsReply(n);
    const said = ask ? "Office asks: " + n.text : n.ask ? "You replied: " + ((n.answer.data && n.answer.data.text) || "") : "Office: " + n.text;
    return '<div style="' + U.sty({ fontSize: 12, marginTop: 1, fontWeight: 600, color: ask ? "#c2410c" : n.ask ? "#16a34a" : U.BRAND, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' +
      U.esc(said) + "</div>";
  }
  // The row's right-hand dot turns orange while something from the office
  // on this stop is unread or unanswered.
  function rowFlag(stop) {
    return forStop(stop.id).some(function (n) { return needsReply(n) || !isSeen(n); });
  }

  // The office's latest word on the stop the driver is standing at.
  function banner(stopId) {
    const n = latest(forStop(stopId));
    if (!n) return "";
    const head = '<div style="' + U.sty({ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }) + '">' +
      (n.ask ? "Office asks" : "Office") + ' <span style="' + U.sty({ fontWeight: 600, opacity: 0.75 }) + '">· ' + U.esc(at(n.at)) + "</span></div>";
    if (needsReply(n)) {
      return '<div style="' + U.sty({ margin: "0 12px 10px", padding: "12px 14px", borderRadius: 14, background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa" }) + '">' +
        head + '<div style="' + U.sty({ fontSize: 14, fontWeight: 700, color: "#111", marginBottom: 10 }) + '">' + U.esc(n.text) + "</div>" +
        U.BtnSm({ variant: "brand", label: "Reply to Office", actName: "office-reply-open", arg: n.id, style: { width: "100%", padding: "10px 14px", fontSize: 14 } }) +
      "</div>";
    }
    if (n.ask) {
      return U.Banner({ type: "green", icon: "✓", html: head + U.esc(n.text) + '<div style="' + U.sty({ fontWeight: 500, marginTop: 2 }) + '">You replied: ' + U.esc(n.answer.data && n.answer.data.text) + "</div>" });
    }
    return U.Banner({ type: "blue", icon: "🏢", html: head + '<div style="' + U.sty({ fontSize: 14, fontWeight: 700, color: "#111" }) + '">' + U.esc(n.text) + "</div>" });
  }

  // Answering the office: a quick reply to tap, or the driver's own words.
  const QUICK = ["Checked. It's sorted now.", "Will sort it on the next trip.", "The shop refused it.", "I'll call you."];
  function replySheet() {
    const S = window.RD.state.scratch;
    const n = S.officeReply ? O.notes.filter(function (x) { return x.id === S.officeReply; })[0] : null;
    const text = S.officeReplyText || "";
    const sending = !!S.committing && !!n;
    const body = n ? '<div style="' + U.sty({ padding: "0 20px 16px", maxHeight: "calc(92dvh - 32px)", overflowY: "auto" }) + '">' +
        '<div style="' + U.sty({ fontSize: 10, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 4 }) + '">Reply to Office' + (n.customer ? " · " + U.esc(n.customer) : "") + "</div>" +
        '<div style="' + U.sty({ fontSize: 18, fontWeight: 800, color: "#111", lineHeight: 1.3, marginBottom: 14 }) + '">' + U.esc(n.text) + "</div>" +
        U.NoteField({ model: "office-reply-text", value: text, rows: 3, placeholder: "Type or speak your answer", typePlaceholder: "Write your answer…",
          background: "white", style: { padding: 0, marginTop: 0, marginBottom: 12 } }) +
        '<div style="' + U.sty({ fontSize: 11, color: "#9ca3af", fontWeight: 600, marginBottom: 8 }) + '">Or tap a quick reply</div>' +
        '<div style="' + U.sty({ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }) + '">' +
          QUICK.map(function (q, i) {
            const on = text === q;
            return '<button type="button" class="rd-chip"' + U.act("office-quick", i) + ' style="' + U.sty({
              padding: "9px 12px", borderRadius: 10, fontSize: 13, fontWeight: on ? 700 : 600, cursor: "pointer", fontFamily: "inherit",
              border: "1.5px solid " + (on ? U.BRAND : "#e5e7eb"), background: on ? "#e8f3f6" : "white", color: on ? U.BRAND : "#374151",
            }) + '">' + U.esc(q) + "</button>";
          }).join("") + "</div>" +
        '<div style="' + U.sty({ display: "flex", gap: 10 }) + '">' +
          U.BtnSm({ variant: "grey", label: "Cancel", actName: "office-reply-close" }) +
          U.BtnXL({ variant: text.trim() ? "brand" : "grey", disabled: !text.trim() || sending, actName: "office-reply-send", arg: n.id, style: { flex: 2, padding: 14, fontSize: 15 },
            label: sending ? U.InlineSpinner(16) + " Sending…" : "Send Reply" }) +
        "</div></div>"
      : "";
    return U.Sheet({ open: !!n, zIndex: 211, closeAct: "office-reply-close", body: body });
  }

  /* ── The Office screen ─────────────────────────────────────────────── */
  function row(o) {
    const tag = o.actName ? "button" : "div";
    return "<" + tag + ' type="button"' + (o.actName ? ' class="rd-row"' + U.act(o.actName, o.arg) : "") + ' style="' + U.sty({
      width: "100%", display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", background: "white", border: "none",
      borderBottom: o.last ? "none" : "1px solid #f0f2f5", textAlign: "left", fontFamily: "inherit", cursor: o.actName ? "pointer" : "default",
    }) + '">' +
      '<span style="' + U.sty({ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: o.tint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: o.ink || U.BRAND }) + '">' + o.icon + "</span>" +
      '<span style="' + U.sty({ flex: 1, minWidth: 0 }) + '">' +
        '<span style="' + U.sty({ display: "flex", justifyContent: "space-between", gap: 8 }) + '">' +
          '<span style="' + U.sty({ fontSize: 14, fontWeight: 700, color: "#111", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) + '">' + U.esc(o.title) + "</span>" +
          '<span style="' + U.sty({ fontSize: 11, color: "#9ca3af", flexShrink: 0, marginTop: 2 }) + '">' + U.esc(o.time || "") + "</span>" +
        "</span>" +
        '<span style="' + U.sty({ display: "block", fontSize: 13, color: "#555", marginTop: 2, lineHeight: 1.4 }) + '">' + o.sub + "</span>" +
        (o.cta ? '<span style="' + U.sty({ display: "inline-block", marginTop: 6, fontSize: 13, fontWeight: 700, color: o.ctaInk || U.BRAND }) + '">' + U.esc(o.cta) + " ›</span>" : "") +
      "</span>" +
      (o.dot ? '<span style="' + U.sty({ width: 8, height: 8, borderRadius: "50%", background: U.ORANGE, flexShrink: 0, marginTop: 6 }) + '"></span>' : "") +
    "</" + tag + ">";
  }
  function card(inner) {
    return '<div style="' + U.sty({ background: "white", borderRadius: 16, margin: "0 12px 10px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }) + '">' + inner + "</div>";
  }

  window.RD.screen("office", function (p) {
    const route = D.db.routeDetails[p.routeId];
    if (!route) throw new Error("Route " + p.routeId + " not found");
    const S = window.RD.state.scratch;
    const notes = forRoute(p.routeId).slice().reverse();
    const prob = openProblem(p.routeId);
    const asks = notes.filter(needsReply);
    const rest = notes.filter(function (n) { return !needsReply(n); });
    const confirming = !!S.movingConfirm;

    const van = prob
      ? U.SectionHeader("Your Van") + card(row({
          icon: "🚚", tint: "#ffedd5", title: PROBLEM_WORD[prob.kind] || "Van problem", time: at(prob.at), last: true,
          sub: (prob.where ? "At " + U.esc(prob.where) + ". " : "") + "The office may move your stops. Tell them the moment you're moving again.",
        }))
      : "";
    const replies = asks.length
      ? U.SectionHeader("Needs Your Reply") + card(asks.map(function (n, i) {
          return row({ icon: "?", tint: "#ffedd5", ink: "#c2410c", title: n.customer || route.name, time: at(n.at), sub: U.esc(n.text),
            cta: "Reply", ctaInk: "#c2410c", actName: "office-reply-open", arg: n.id, last: i === asks.length - 1 });
        }).join(""))
      : "";
    const updates = rest.length
      ? U.SectionHeader("Today's Updates") + card(rest.map(function (n, i) {
          const sub = U.esc(n.text) + (n.ask && n.answer ? '<span style="' + U.sty({ display: "block", color: "#16a34a", fontWeight: 600, marginTop: 2 }) + '">You replied: ' + U.esc(n.answer.data && n.answer.data.text) + "</span>" : "");
          return row({ icon: n.ask ? "✓" : "🏢", tint: n.ask ? "#dcfce7" : "#e8f5f7", ink: n.ask ? "#16a34a" : U.BRAND,
            title: n.customer || "Your route", time: at(n.at), sub: sub,
            actName: n.stopId ? "office-goto-stop" : null, arg: n.stopId, last: i === rest.length - 1 });
        }).join(""))
      : "";
    // The open van problem is already at the top, under Your Van.
    const sent = reportsFor(p.routeId).filter(function (r) { return !prob || r.id !== prob.id; }).slice().reverse();
    const sentList = sent.length
      ? U.SectionHeader("Sent to Office") + card(sent.map(function (r, i) {
          return row({ icon: "↗", tint: "#f3f4f6", ink: "#6b7280", title: r.title || route.name, time: at(r.at),
            sub: U.esc(r.text) + '<span style="' + U.sty({ display: "block", marginTop: 2, fontWeight: 600, color: r.waiting ? "#b45309" : U.BRAND }) + '">' + U.esc(r.status) + "</span>",
            actName: r.stopId ? "office-goto-stop" : null, arg: r.stopId, last: i === sent.length - 1 });
        }).join(""))
      : "";
    const empty = !prob && !notes.length && !sent.length
      ? U.EmptyState("🏢", "Nothing with the office yet", "What you report from a stop or the van, and what the office decides, shows here.")
      : "";

    const footer = !prob ? ""
      : '<div style="' + U.sty({ position: "relative", zIndex: confirming ? 50 : "auto" }) + '">' + U.ActionBar(confirming
          ? U.ConfirmPanel({
              action: "Van Moving Again", amount: PROBLEM_WORD[prob.kind] || "Van problem",
              context: "Reported " + at(prob.at) + " · the office closes it", backLabel: "Not Yet", commitLabel: "We're Moving",
              backAct: "office-moving-cancel", commitAct: "office-moving", arg: prob.id,
              processing: !!S.committing, processingLabel: "Telling the office…",
            })
          : U.BtnXL({ variant: "green", label: "🚚 We're Moving Again", actName: "office-moving-confirm" })) + "</div>";

    return U.MobileHeader({ title: "Office", subtitle: route.name + " · today", backLabel: "Delivery Stops", backAct: "back" }) +
      '<div class="rd-body" style="background:' + U.BG + '">' + U.Spacer(4) + van + replies + updates + sentList + empty + U.Spacer() + "</div>" +
      (confirming ? U.FreezeBackdrop(0.45) : "") + footer + replySheet();
  });

  /* ── Actions ───────────────────────────────────────────────────────── */
  window.RD.action("office-open", function (rid) { window.RD.state.scratch.queueMenu = false; window.RD.go("/office/" + (rid || window.RD.state.routeId)); });
  window.RD.action("office-goto-stop", function (sid) {
    const rid = window.RD.state.routeId, st = D.getStops(rid).filter(function (s) { return s.id === sid; })[0];
    if (!st) return;
    const done = st.status === "DELIVERED" || st.status === "SKIPPED" || st.isReturnOnly;
    window.RD.go((done ? "/stop-summary/" : "/delivery/") + rid + "/" + sid);
  });

  window.RD.action("office-reply-open", function (id) { const S = window.RD.state.scratch; S.officeReply = id; S.officeReplyText = ""; window.RD.render(); });
  window.RD.action("office-reply-close", function () { const S = window.RD.state.scratch; if (S.committing) return; S.officeReply = null; window.RD.render(); });
  window.RD.action("office-quick", function (i) { window.RD.state.scratch.officeReplyText = QUICK[Number(i)] || ""; window.RD.render(); });
  window.RD.action("model:office-reply-text", function (v) {
    const S = window.RD.state.scratch, had = !!(S.officeReplyText || "").trim();
    S.officeReplyText = v;
    if (had !== !!String(v).trim()) {
      window.RD.render();
      const el = document.querySelector('[data-model="office-reply-text"]');
      if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    }
  });
  window.RD.action("office-reply-send", function (id) {
    const S = window.RD.state.scratch;
    const n = O.notes.filter(function (x) { return x.id === id; })[0];
    const text = String(S.officeReplyText || "").trim();
    if (!n || !text || !window.FB_EVENTS) return;
    window.RD.commit(function () {
      const rid = window.RD.state.routeId, route = rid ? D.db.routeDetails[rid] : null;
      window.FB_EVENTS.emit("question.answered", {
        by: driverName(route) || "Driver", where: "Delivery app", how: "driver",
        subject: { incident: n.incident, customer: n.customer || null, van: route ? route.name : null },
        data: { text: text },
      });
      S.officeReply = null; S.officeReplyText = "";
      sync();
      window.RD.toast({ title: "Reply sent", detail: "The office sees it on " + (n.customer || "your route") + " now" });
    });
  });

  window.RD.action("office-moving-confirm", function () { window.RD.state.scratch.movingConfirm = true; window.RD.render(); });
  window.RD.action("office-moving-cancel", function () { window.RD.state.scratch.movingConfirm = false; window.RD.render(); });
  // The driver closes a van problem: the tower's van incident resolves on
  // van.moving ("… is moving again").
  window.RD.action("office-moving", function (id) {
    if (!window.FB_EVENTS) return;
    window.RD.commit(function () {
      const rid = window.RD.state.routeId, route = rid ? D.db.routeDetails[rid] : null;
      window.FB_EVENTS.emit("van.moving", {
        by: driverName(route) || "Driver", where: "Delivery app", how: "driver",
        subject: { incident: "ev:" + id, van: route ? route.name : null, rdRoute: rid },
        data: {},
      });
      window.RD.state.scratch.movingConfirm = false;
      sync();
      window.RD.toast({ title: "You're moving again", detail: "The office has closed the van problem" });
    });
  });

  window.RD_OFFICE = {
    sync: sync, strip: strip, rowLine: rowLine, rowFlag: rowFlag, banner: banner, replySheet: replySheet,
    openProblem: openProblem, problemWord: function (k) { return PROBLEM_WORD[k] || "Van problem"; }, at: at,
    _state: O,
  };
})();

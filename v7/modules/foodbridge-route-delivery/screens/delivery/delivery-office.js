/* ==========================================================================
   DELIVERY MANAGEMENT — what the office did, back on the driver's phone
   (24 Sep 2026)

   Not in the upstream app. The delivery app already tells the office what
   went wrong (RD_EMIT → fb.v7.events). This is the other half: when the
   owner acts in the Control Tower, the same event stream carries it here.

     reschedule for today · try again today · fix the order
                         → a skipped stop is back in the queue, with a banner
     move · send on next trip · collect later · credit · …
                         → a line on the stop (or the route) saying what to do
     ask the team        → a question the driver answers from the queue; the
                           answer goes back to the tower (question.answered)

   The office's actions name their incident; an incident raised from this
   app points at the event that raised it, and that event names the stop
   (rdStop, see RD_EMIT). Anything else is matched by the customer's name,
   and van-level problems by the route's name.

   Only today's actions count. Another tab writing the stream (the tower)
   fires a storage event, so the queue updates as the owner acts.
   ========================================================================== */

(function () {
  "use strict";
  const KEY = "fb.v7.events";
  const D = window.RD_DB, U = window.RD_UI;
  const IST = 5.5 * 3600000;
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const norm = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); };
  const dayIst = function (ms) { return new Date(ms + IST).toISOString().slice(0, 10); };
  const clock = function (ms) {
    const d = new Date(ms + IST);
    let h = d.getUTCHours(); const m = d.getUTCMinutes(), pm = h >= 12;
    h = h % 12 || 12;
    return h + ":" + String(m).padStart(2, "0") + " " + (pm ? "pm" : "am");
  };
  const inr = function (n) { return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN"); };
  function dayWord(iso) {
    if (!iso) return "another day";
    const today = dayIst(Date.now());
    if (iso === today) return "today";
    if (iso === dayIst(Date.now() + 86400000)) return "tomorrow";
    return WD[new Date(iso + "T00:00:00Z").getUTCDay()];
  }
  function read() {
    try { const v = JSON.parse(window.localStorage.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }

  /* What the driver reads for each thing the office did. `back` puts a
     skipped stop back in today's queue; `route` belongs to the whole van. */
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
      case "writeOff": return { text: "Written off " + inr(d.value) + ". Nothing more to do." };
      case "fixOrder": return { text: "Order fixed to " + inr(d.now) + ". Deliver it.", back: true };
      case "fixCustomer": return { text: "Details updated" + (d.address ? ": " + d.address : "") + (d.unload ? ". Unload at " + d.unload : "") + (d.hours ? ". Delivers " + d.hours : "") };
      case "adjust": return { text: d.decision === "refuse" ? "Collect " + inr(d.gap) + " at the next visit" : "Office approved the " + inr(d.gap) + " difference" };
      case "creditNote": return { text: inr(d.amount) + " credit note raised for the shop" };
      case "collectLater": return { text: "Collect " + inr(d.amount) + (d.when === "next" ? " at the next visit" : " this week") };
      case "credit": return { text: d.decision === "first" ? "Collect " + inr(d.ask) + " before unloading" : d.decision === "once" ? "Deliver this once" + (d.reason ? ": " + d.reason : "") : "Credit limit raised. Deliver as usual." };
      case "ask": return { text: d.question || "What happened here?", ask: true };
      case "proof": return { text: "Your photo and signature went to the shop" };
      case "close": return { text: "Closed by the office" };
      default: return null;
    }
  }

  function targetOf(ev, byId) {
    const sj = ev.subject || {};
    const m = /ev:(EV-\d+)/.exec(String(sj.incident || ""));
    const orig = m ? byId[m[1]] : null;
    const os = (orig && orig.subject) || {};
    return { stopId: os.rdStop || null, routeId: os.rdRoute || null, customer: os.customer || sj.customer || null,
             van: os.van || sj.van || null, incident: sj.incident || null, origType: orig ? orig.type : null };
  }
  function routes() { return Object.keys(D.db.routeDetails || {}); }
  function findStop(t) {
    const order = t.routeId && D.db.routeDetails[t.routeId] ? [t.routeId].concat(routes().filter(function (r) { return r !== t.routeId; })) : routes();
    if (t.stopId) for (const rid of order) { const s = D.getStops(rid).find(function (x) { return x.id === t.stopId; }); if (s) return { rid: rid, stop: s }; }
    if (t.customer) { const n = norm(t.customer); for (const rid of order) { const s = D.getStops(rid).find(function (x) { return norm(x.customerName) === n; }); if (s) return { rid: rid, stop: s }; } }
    return null;
  }
  function findRoute(t) {
    if (t.routeId && D.db.routeDetails[t.routeId]) return t.routeId;
    const n = norm(t.van);
    return routes().filter(function (rid) { return norm(D.db.routeDetails[rid].name) === n; })[0] || null;
  }
  function unskip(stop) {
    if (stop.status !== "SKIPPED") return;
    stop.status = "PENDING"; stop.skipReason = null; stop.completedAt = null;
    const det = D.db.stopDetails && D.db.stopDetails[stop.id];
    if (det) { det.status = "PENDING"; det.skipReason = null; det.completedAt = null; }
  }

  const O = { byStop: {}, byRoute: {}, applied: {} };
  const VAN_FACTS = /^(problem\.reported|loadstock\.checked|count\.submitted)$/;

  function apply() {
    const evs = read(), byId = {};
    evs.forEach(function (e) { if (e && e.id) byId[e.id] = e; });
    const today = dayIst(Date.now());
    const byStop = {}, byRoute = {}, problems = {};
    /* A van problem this app reported today stays on the route until the
       van moves again or the office closes it. */
    evs.forEach(function (ev) {
      if (!ev || ev.type !== "problem.reported" || !ev.at || dayIst(new Date(ev.at).getTime()) !== today) return;
      const inc = "ev:" + ev.id;
      const over = evs.some(function (x) { return x.subject && x.subject.incident === inc && (x.type === "van.moving" || x.type === "action.close"); });
      if (over) return;
      const rid = findRoute({ routeId: (ev.subject || {}).rdRoute, van: (ev.subject || {}).van });
      if (rid) (problems[rid] = problems[rid] || []).push({ id: ev.id, incident: inc, kind: (ev.data || {}).kind, at: ev.at });
    });
    O.problems = problems;
    evs.forEach(function (ev) {
      if (!ev || !ev.type || ev.type.indexOf("action.") !== 0) return;
      /* Today's, or one the office set for today (the next trip, a new day). */
      const forToday = (ev.data && ev.data.date === today);
      if (ev.at && dayIst(new Date(ev.at).getTime()) !== today && !forToday) return;
      const w = words(ev); if (!w) return;
      const t = targetOf(ev, byId);
      const note = { id: ev.id, at: ev.at, text: w.text, kind: ev.type.slice(7), incident: t.incident, ask: !!w.ask, customer: t.customer };
      if (w.ask) note.answer = (evs.filter(function (x) {
        return x.type === "question.answered" && x.subject && x.subject.incident === t.incident && x.at >= ev.at;
      }).slice(-1)[0] || null);
      const vanLevel = w.route || (t.origType && VAN_FACTS.test(t.origType));
      const hit = vanLevel ? null : findStop(t);
      if (hit) {
        (byStop[hit.stop.id] = byStop[hit.stop.id] || []).push(note);
        /* Back in the queue; it becomes the stop only if the van has none. */
        if (w.back && !O.applied[ev.id]) { O.applied[ev.id] = 1; unskip(hit.stop); if (D.advanceToNextStop) D.advanceToNextStop(hit.rid); }
        return;
      }
      const rid = findRoute(t);
      if (rid) (byRoute[rid] = byRoute[rid] || []).push(note);
    });
    O.byStop = byStop; O.byRoute = byRoute;
  }

  function latest(list) { return list && list.length ? list[list.length - 1] : null; }

  /* ── what the screens draw ─────────────────────────────────────────── */
  function lineFor(stopId) { const n = latest(O.byStop[stopId]); return n ? n.text : null; }

  function bannerFor(stopId) {
    const list = O.byStop[stopId] || [];
    if (!list.length) return "";
    return list.slice(-2).map(function (n) {
      return n.ask ? askCard(n) : U.Banner({ type: "orange", icon: "🚚", text: "Office: " + n.text, style: { marginTop: 10 } });
    }).join("");
  }

  const QUICK = ["Checked. It's sorted now.", "Will sort it on the next trip.", "The shop refused it."];
  function askCard(n) {
    const head = '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#1B6272", textTransform: "uppercase", letterSpacing: "0.04em" }) + '">Office asks' + (n.customer ? " · " + U.esc(n.customer) : "") + "</div>" +
      '<div style="' + U.sty({ fontSize: 15, fontWeight: 700, color: "#111", margin: "4px 0 10px" }) + '">' + U.esc(n.text) + "</div>";
    if (n.answer) {
      return '<div style="' + U.sty({ margin: "10px 12px 0", padding: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14 }) + '">' + head +
        '<div style="' + U.sty({ fontSize: 13, color: "#166534", fontWeight: 600 }) + '">✓ You answered: ' + U.esc(n.answer.data && n.answer.data.text) + "</div></div>";
    }
    return '<div style="' + U.sty({ margin: "10px 12px 0", padding: 14, background: "#ecfeff", border: "1.5px solid #1B6272", borderRadius: 14 }) + '">' + head +
      '<div style="' + U.sty({ display: "flex", flexDirection: "column", gap: 6 }) + '">' +
        QUICK.map(function (q, i) {
          return '<button type="button" class="rd-chip"' + U.act("office-answer", n.id + "::" + i) + ' style="' + U.sty({
            padding: "10px 12px", borderRadius: 10, border: "1.5px solid #cbd5e1", background: "white", color: "#111",
            fontSize: 14, fontWeight: 600, textAlign: "left", cursor: "pointer", fontFamily: "inherit" }) + '">' + U.esc(q) + "</button>";
        }).join("") + "</div></div>";
  }

  const PROBLEM_WORD = { breakdown: "Breakdown", puncture: "Puncture", accident: "Accident", fridge: "Fridge not cooling",
                         temperature: "Temperature / cold chain", traffic: "Traffic jam", road: "Road closed" };
  function problemCard(p) {
    return '<div style="' + U.sty({ margin: "10px 12px 0", padding: 14, background: "#fff7ed", border: "1.5px solid #fdba74", borderRadius: 14 }) + '">' +
      '<div style="' + U.sty({ fontSize: 12, fontWeight: 700, color: "#c2410c", textTransform: "uppercase", letterSpacing: "0.04em" }) + '">You reported · ' + U.esc(clock(new Date(p.at).getTime())) + "</div>" +
      '<div style="' + U.sty({ fontSize: 15, fontWeight: 700, color: "#111", margin: "4px 0 2px" }) + '">' + U.esc(PROBLEM_WORD[p.kind] || "A van problem") + "</div>" +
      '<div style="' + U.sty({ fontSize: 13, color: "#555", marginBottom: 10 }) + '">Tell the office the moment the van moves.</div>' +
      '<button type="button"' + U.act("office-moving", p.id) + ' style="' + U.sty({ width: "100%", padding: "12px", borderRadius: 12, border: "none",
        background: "#16a34a", color: "white", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }) + '">🚚 We\'re moving again</button></div>';
  }
  function routeCard(routeId) {
    const list = O.byRoute[routeId] || [];
    const asks = [];
    Object.keys(O.byStop).forEach(function (sid) { (O.byStop[sid] || []).forEach(function (n) { if (n.ask && !n.answer) asks.push(n); }); });
    const own = list.map(function (n) {
      return n.ask ? askCard(n) : U.Banner({ type: "orange", icon: "🚚", text: "Office: " + n.text, style: { marginTop: 10 } });
    });
    return (O.problems && O.problems[routeId] || []).map(problemCard).concat(own).concat(asks.map(askCard)).join("");
  }

  /* The driver closes a van problem: the tower's van incident resolves on
     van.moving ("… is moving again"). */
  window.RD.action("office-moving", function (id) {
    const rid = window.RD.state.routeId, route = rid ? D.db.routeDetails[rid] : null;
    if (!window.FB_EVENTS) return;
    window.FB_EVENTS.emit("van.moving", {
      by: route && route.driver ? String(route.driver.name || "").split(" ")[0] : "Driver",
      where: "Delivery app", how: "driver",
      subject: { incident: "ev:" + id, van: route ? route.name : null, rdRoute: rid },
      data: {},
    });
    apply();
    window.RD.toast("The office knows you're moving.");
    window.RD.render();
  });

  window.RD.action("office-answer", function (arg) {
    const parts = String(arg).split("::"), id = parts[0], text = QUICK[+parts[1]] || QUICK[0];
    let note = null;
    Object.keys(O.byStop).concat(Object.keys(O.byRoute)).some(function (k) {
      const l = (O.byStop[k] || O.byRoute[k] || []);
      note = l.filter(function (n) { return n.id === id; })[0] || null;
      return !!note;
    });
    if (!note || !window.FB_EVENTS) return;
    const rid = window.RD.state.routeId;
    const route = rid ? D.db.routeDetails[rid] : null;
    window.FB_EVENTS.emit("question.answered", {
      by: route && route.driver ? String(route.driver.name || "").split(" ")[0] : "Driver",
      where: "Delivery app", how: "driver",
      subject: { incident: note.incident, customer: note.customer || null, van: route ? route.name : null },
      data: { text: text },
    });
    apply();
    window.RD.toast("Sent to the office.");
    window.RD.render();
  });

  window.addEventListener("storage", function (e) {
    if (e.key !== KEY) return;
    apply();
    if (window.RD && window.RD.render) window.RD.render();
  });

  window.RD_OFFICE = { apply: apply, lineFor: lineFor, bannerFor: bannerFor, routeCard: routeCard, _state: O };
})();

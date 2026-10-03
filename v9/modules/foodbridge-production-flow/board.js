/* Production — the board (28 Sep 2026).
 *
 * One page instead of Production Plan, Shifts and Shop Floor, cut to what an
 * owner needs at a glance (owner's review, 28 Sep 2026):
 *   Needs you   one line each, and one thing to do: call the person who can
 *               sort it — the worker, the batch's supervisor, the purchase
 *               person. Lines clear themselves when the floor moves on.
 *               Its own tab since 29 Sep 2026 (owner), with a count on it.
 * Today (the floor, to start, done, crew and the worker-app QR) was retired
 * on 29 Sep 2026 (owner).
 *   Demand & supply  sales → production → purchase (29 Sep 2026, the first
 *               tab): what sales needs beyond stock, how production stands
 *               on it, and what to buy to unblock it.
 *   All shifts  a queue of shifts (29 Sep 2026, owner: not a calendar): what needs a
 *               shift, Now, Coming up (shifts with work), Free (one line). Was: a roster, a row per day and a
 *               column per shift (Morning, Evening, any added in Shift
 *               settings); Not scheduled batches get a shift here; a shift
 *               is staffed, stopped, cancelled or handed over here.
 * The board starts nothing itself. A batch starts in Batches (its own Start,
 * with the supervisor hand-over), and a new batch is made in Batches' Create
 * batch — the board opens them there.
 */
(function () {
  "use strict";

  var app = document.getElementById("app");
  /* the board's views (owner, 29 Sep 2026): Demand & supply opens the board; All shifts is the Week;
     Needs you the alerts. Today was retired — an old ?view=today opens Demand & supply. */
  var VIEWS = ["flow", "week", "needs"];
  var S = { lens: "flow", plan: "fg", puSel: {}, pr: null, prErr: "", pbSel: {}, pb: null, edit: null, open: {}, from: null, panel: null, form: {}, ask: null, rm: null, add: null, err: "" };
  /* All shifts is the next 7 days from today (owner, 29 Sep 2026: no week to page through) */
  S.from = isoDay(Date.now());
  /* #/production/production-board?view=week opens the Week (Batch detail's "Week ›") */
  function fromHash() {
    try {
      if (window.parent === window) return false;
      var h = window.parent.location.hash, q = h.indexOf("?") === -1 ? "" : h.slice(h.indexOf("?") + 1);
      /* only an address for this page: ?batch=… on the way to Batches is Batches' to read */
      if (!q || !/^#\/?production\/production-board\?/.test(h)) return false;
      var qs = new URLSearchParams(q), v = qs.get("view"), tb = qs.get("tab");
      S.lens = VIEWS.indexOf(v) !== -1 ? v : "flow";
      /* ?tab=or|fg|sf|pu opens Demand & supply on that table (the Control Tower's Production lever) */
      if (/^(or|fg|sf|pu)$/.test(tb || "")) { S.lens = "flow"; S.plan = tb; S.pb = null; S.pr = null; try { sessionStorage.setItem("fb.v7.flow.plantab", tb); } catch (e2) { /* this visit only */ } }
      window.parent.history.replaceState(null, "", window.parent.location.pathname + window.parent.location.search + h.split("?")[0]);
      return true;
    } catch (e) { return false; /* not inside the platform */ }
  }
  fromHash();
  (function ownQuery() { var v = new URLSearchParams(location.search).get("view"); if (VIEWS.indexOf(v) !== -1) S.lens = v; })();
  /* the page's views as fixed tabs (assets/production-tabs.js): Demand & supply,
     All shifts and Needs you switch here; All batches opens the Batches page */
  var tabs = window.FBProductionTabs ? FBProductionTabs.mount({ active: S.lens, onSelect: function (v) {
    if (VIEWS.indexOf(v) === -1) return false;
    S.lens = v; S.panel = null; S.err = ""; window.scrollTo(0, 0); render(); return true;
  } }) : null;
  /* the platform keeps this page when only the ?view changes */
  function onParentHash() { if (fromHash()) { S.panel = null; render(); } }
  try {
    if (window.parent !== window) {
      window.parent.addEventListener("hashchange", onParentHash);
      window.addEventListener("pagehide", function () { try { window.parent.removeEventListener("hashchange", onParentHash); } catch (e) { /* gone */ } });
    }
  } catch (e) { /* not inside the platform */ }

  /* ── small helpers ─────────────────────────────────────────────────── */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function n(v, d) { return (Math.round(v * (d || 1)) / (d || 1)).toLocaleString("en-IN"); }
  function kg(v) { return n(v, 10) + " kg"; }
  function qty(v, unit) { return unit === "kg" ? kg(v) : n(v) + " " + unit; }
  function time(iso) { return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }); }
  function mins(iso) { return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); }
  function ago(iso) { var m = mins(iso); return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + (m % 60) + " min"; }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate(); }
  function isToday(iso) { return iso && dayKey(iso) === dayKey(Date.now()); }
  function phone(p) { var d = String(p || "").replace(/\D/g, "").slice(-10); return d.length === 10 ? d.slice(0, 5) + " " + d.slice(5) : d; }

  /* One way to act: call the person. A tel: link, so a phone dials. */
  function Call(c) {
    if (!c || !c.contact) return "";
    var who = c.role === "Purchase" || c.role === "Supervisor" ? c.name + " · " + c.role.toLowerCase() : c.name;
    return '<a class="call" href="tel:+91' + esc(String(c.contact).replace(/\D/g, "").slice(-10)) + '"><span aria-hidden="true">📞</span><span>Call ' + esc(who) + "<small>" + esc(phone(c.contact)) + "</small></span></a>";
  }
  /* Another screen of the platform, through the platform (its sidebar follows). */
  function go(route) {
    try { if (window.parent !== window) { window.parent.location.hash = "#/" + route; return; } } catch (e) {}
  }


  /* ── what the page shows, read from the store in one go ─────────────── */
  function model() {
    return FB_PRODUCTION.read(function (D, d) {
      var plan = D.plan(), alerts = D.alerts();
      var live = d.shifts.filter(function (s) { return s.status === "live"; }).map(function (s) { return s._id; });
      var tasksOf = {};
      d.tasks.forEach(function (t) { (tasksOf[t.batch] = tasksOf[t.batch] || []).push(t); });

      /* on the floor: a batch with steps on a live shift, not finished */
      var floor = [], onFloor = {};
      d.batches.forEach(function (b) {
        var ts = tasksOf[b.id] || [];
        if (["completed", "closed", "rejected"].indexOf(b.stateId) !== -1) return;
        if (!ts.some(function (t) { return live.indexOf(t.shift) !== -1 && t.status !== "done"; })) return;
        var steps = D.stepsFor(b);
        var done = 0, now = null;
        steps.forEach(function (st) {
          var mine = ts.filter(function (t) { return t.stepOrder === st.order; });
          if (mine.some(function (t) { return t.status === "done"; })) { done += 1; return; }
          var run = mine.filter(function (t) { return t.status === "in_progress"; })[0];
          var av = mine.filter(function (t) { return t.status === "available"; })[0];
          if (!now && run) now = { step: st.name, who: run.assignedName, since: run.startedAt, waiting: false };
          if (!now && av) now = { step: st.name, since: av.availableAt, waiting: true };
        });
        floor.push({ b: b, done: done, of: D.stepsFor(b).length, now: now, held: b.stateId === "on-hold", office: D.recordingOf(b) === "office" });
        onFloor[b.id] = true;
      });

      /* to start today: batches in today's slots (or earlier ones not started),
         with the slot's in-charge; later days and Not scheduled are in Week */
      var today = isoDay(Date.now()), unslotted = 0;
      var planned = d.batches.filter(function (b) {
        if ((b.stateId !== "planned" && b.stateId !== "in-progress") || onFloor[b.id]) return false;
        if (b.stateId === "planned" && !b.when) { unslotted += 1; return false; }
        return b.stateId === "in-progress" || b.when.date <= today;
      }).map(function (b) { var sup = D.supervisorOf(b), px = b.when && D.pattern().slots[b.when.slot]; return Object.assign({}, b, { inCharge: sup ? sup.name : b.operator, shiftName: b.when ? D.slotName(b.when.slot) : null, shiftStart: px ? px.start : 99 }); })
        .sort(function (a, c) { return String(a.when && a.when.date).localeCompare(String(c.when && c.when.date)) || a.shiftStart - c.shiftStart || a._seq - c._seq; });

      /* done today: batches the floor finished today */
      var doneToday = d.batches.filter(function (b) {
        if (["completed", "closed"].indexOf(b.stateId) === -1) return false;
        var h = (b.statusHistory || []).filter(function (x) { return x.toStatusLabel === "Completed"; }).pop();
        return h && isToday(h.timestamp);
      }).map(function (b) {
        var bags = d.bags.filter(function (g) { return g.batchId === b.id; });
        var weighed = (tasksOf[b.id] || []).filter(function (t) { return t.status === "done" && t.weigh && t.kgIn; });
        var kin = weighed.reduce(function (s, t) { return s + t.kgIn; }, 0), kout = weighed.reduce(function (s, t) { return s + t.kgOut; }, 0);
        return { b: b, kg: bags.reduce(function (s, g) { return s + g.kg; }, 0), bags: bags.length, packets: b.packedPackets || 0,
          loss: kin ? Math.round((kin - kout) / kin * 1000) / 10 : null, over: weighed.some(function (t) { return t.loss != null && t.lossPct > t.loss; }) };
      });

      /* the crew: who is in today, and on what */
      var crew = d.workers.filter(function (w) { return w.role !== "admin"; }).map(function (w) {
        var on = d.tasks.filter(function (t) { return t.assignedTo === w._id && t.status === "in_progress"; })[0];
        return { name: w.name, in: !!w.isOnline || !!on, on: on ? on.stepName : null };
      }).sort(function (a, c) { return (c.in - a.in) || (!!c.on - !!a.on) || a.name.localeCompare(c.name); });

      return { plan: plan, alerts: alerts, floor: floor, planned: planned, unslotted: unslotted, doneToday: doneToday, crew: crew,
        buys: plan.materials.filter(function (m) { return m.buy > 0; }), purchase: D.purchase() };
    });
  }

  /* ── Today ─────────────────────────────────────────────────────────── */
  function Needs(m) {
    var what = { need_materials: "needs material", issue_found: "has a machine problem", need_help: "needs you" };
    var rows = m.alerts.map(function (a) {
      var ic, title, sub;
      if (a.type === "help") { ic = "help"; title = "<b>" + esc(a.worker || "A worker") + "</b> " + (what[a.kind] || "needs help"); sub = esc(a.step) + " · " + esc(a.product) + " · since " + time(a.createdAt); }
      else if (a.type === "weight_loss") { ic = "warn"; title = esc(a.step) + " lost <b>" + a.lossPct + "%</b> — the limit is " + a.allowed + "%"; sub = esc(a.product) + (a.worker ? " · " + esc(a.worker) : "") + " · " + time(a.createdAt); }
      else if (a.type === "waiting") { ic = "warn"; title = esc(a.step) + " has waited <b>" + ago(a.createdAt) + "</b> — nobody started it"; sub = esc(a.product); }
      else if (a.type === "to_record") { ic = "warn"; title = esc(a.step) + " is <b>not recorded</b> — " + ago(a.createdAt); sub = esc(a.product) + " · recorded in the office";
        return '<div class="row"><span class="ic warn" aria-hidden="true">✎</span><span class="txt">' + title + "<small>" + sub + '</small></span><button type="button" class="call" data-batch="' + esc(a.batch) + '">Record ›</button></div>'; }
      else { ic = "warn"; title = esc(a.product) + " is <b>on hold</b>"; sub = "Its steps are paused on the floor"; }
      return '<div class="row"><span class="ic ' + ic + '" aria-hidden="true">' + (ic === "help" ? "✋" : "!") + '</span><span class="txt">' + title + "<small>" + sub + "</small></span>" + Call(a.call) + "</div>";
    });
    /* every shortage in one line: it is one call to the purchase person */
    if (m.buys.length) {
      rows.push('<div class="row"><span class="ic buy" aria-hidden="true">🛒</span><span class="txt"><b>Short for what\'s planned:</b> ' +
        m.buys.map(function (x) { return esc(x.name) + " " + qty(x.buy, x.unit); }).join(" · ") +
        "<small>" + m.buys.map(function (x) { return esc(x.supplier || "") ; }).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; }).join(" · ") + "</small></span>" + Call(m.purchase) + "</div>");
    }
    if (!rows.length) return '<section class="card needs clear-all"><div class="clear">✓ Nothing needs you right now.</div></section>';
    /* its own tab carries the name and the count: the card is just the lines */
    return '<section class="card needs">' + rows.join("") + "</section>";
  }

  /* ── All shifts (the Week): the shifts' model and the queue (Roster) ──
     The shifts themselves — Morning, Evening, a Night if you add one — are
     set in Shift settings. A batch's own work stays in the batch. */
  function isoDay(t) { var d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function addDays(key, n) { var d = new Date(key + "T00:00:00"); d.setDate(d.getDate() + n); return isoDay(d); }
  function dayName(key, long) { return new Date(key + "T00:00:00").toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short" } : { weekday: "short", day: "numeric" }); }
  function hr(h) { h = ((h % 24) + 24) % 24; return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? " am" : " pm"); }
  function hrs(v) { return (Math.round(v * 2) / 2).toLocaleString("en-IN") + " h"; }
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var BADGE = { planned: "Planned", "in-progress": "In Progress", "on-hold": "On Hold", completed: "Completed", closed: "Closed", rejected: "Rejected" };

  function light(D, b) {
    return { id: b.id, no: b.batchNumber, name: b.displayName, size: b.kind === "packing" ? n(b.packets) + " packets · " + kg(b.batchSize) : kg(b.batchSize), state: b.stateId,
      kind: b.kind, kg: b.kind === "packing" ? 0 : b.batchSize, packets: b.packets || 0,
      /* the product itself — a packing run names its pack ("Packing · Frozen Peas 500 g") */
      product: String(b.displayName || "").replace(/^Packing · /, "").replace(/\s+[\d.]+\s*(g|kg)$/i, ""),
      office: D.recordingOf(b) === "office", due: b.expectedFinishDate ? String(b.expectedFinishDate).slice(0, 10) : null, was: b.wasScheduled || null,
      hours: Math.round(D.stepsFor(b).reduce(function (t, st) { return t + (st.expectedMinutes || 0); }, 0) / 6) / 10 };
  }
  function weekModel(from, days) {
    return FB_PRODUCTION.read(function (D, d) {
      var cur = D.currentKey(), today = isoDay(Date.now()), shifts = D.slotList();
      var order = shifts.map(function (x) { return x.id; });
      var past = function (date, slot) { return date < cur.date || (date === cur.date && order.indexOf(slot) < order.indexOf(cur.slot)); };
      var cell = function (x) {
        var sh = x.shift;
        return { key: x.date + "|" + x.slot, date: x.date, slot: x.slot, name: D.slotName(x.slot), working: x.working, status: x.status, id: sh ? sh._id : null,
          inCharge: x.inCharge, crew: (x.crew || []).slice(), hours: x.hours, batches: x.batches.map(function (b) { return light(D, b); }),
          past: past(x.date, x.slot), now: x.date === cur.date && x.slot === cur.slot,
          stopped: sh && sh.status === "stopped" && sh.stopped ? sh.stopped.reason : null,
          cancelled: sh && sh.cancelled ? sh.cancelled.reason || "" : null,
          handover: sh && sh.handover ? { to: sh.handover.toName, toInCharge: sh.handover.toInCharge, note: sh.handover.note } : null,
          takeover: sh && sh.takeover ? { from: sh.takeover.fromName, note: sh.takeover.note, taken: !!sh.takeover.takenAt, batches: sh.takeover.batches || [] } : null };
      };
      var cells = {};
      D.week(from || S.from, days || 7).forEach(function (x) { var c = cell(x); cells[c.key] = c; });
      /* where a batch can go: every shift from now for two weeks that isn't over, off or cancelled */
      var options = D.week(today, 14).map(cell).filter(function (c) { return !c.past && c.working !== false && ["cancelled", "ended", "off"].indexOf(c.status) === -1; });
      return { shifts: shifts, cells: cells, options: options, today: today, days: d.slotPattern ? D.pattern().days.slice() : [],
        tray: D.notScheduled().map(function (b) { return light(D, b); }),
        workers: d.workers.filter(function (w) { return w.role !== "admin"; }).map(function (w) { return { id: w._id, name: w.name, role: w.role }; }),
        supervisors: (d.operators || []).map(function (o) { return o.name; }) };
    });
  }
  function people(n) { return n + (n === 1 ? " person" : " people"); }
  function short(name) { return String(name || "").split(" ")[0]; }

  function dueTag(due, today) {
    if (!due) return '<span class="due">No due date</span>';
    if (due < today) return '<span class="due bad">Overdue · ' + esc(dayName(due)) + "</span>";
    if (due === today) return '<span class="due bad">Due today</span>';
    return '<span class="due' + (due <= addDays(today, 2) ? " soon" : "") + '">Due ' + esc(dayName(due)) + "</span>";
  }
  /* Not scheduled, for a long list: soonest due first, one line each, the
     suggested shift in words with one Schedule; Change shows the picker.
     Five show until "Show all". Schedule all puts every one in its
     suggested shift, after one question. */
  /* All shifts, cut down (owner, 29 Sep 2026: "remove 80%… cognitive overload"): one line for the
     batches with no shift, and one button that gives each its suggested shift. */
  /* All shifts, for a person, not a report (owner, 29 Sep 2026: "the common man can't use this";
     then "question everything… no magic like automation"). Two cards side by side, across the
     screen: who is running the floor now, and who takes over next — each with, in plain words,
     whether its work fits. A card opens the shift; the one quiet link to change shift times or
     people sits on the date's row (tabs.action).
     No auto-scheduling, no free-shift list, no grid, no codes. */
  var AV = ["#dcfce7:#166534", "#dbeafe:#1e40af", "#fef3c7:#92400e", "#fce7f3:#9d174d", "#ede9fe:#5b21b6", "#e0f2fe:#075985"];
  function avatar(name) {
    var parts = String(name || "?").trim().split(/\s+/), ini = (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
    var h = 0; for (var i = 0; i < ini.length + name.length; i++) h = (h * 31 + String(name).charCodeAt(i % name.length)) >>> 0;
    var c = AV[h % AV.length].split(":");
    return '<span class="sf-av" style="background:' + c[0] + ";color:" + c[1] + '" aria-hidden="true">' + esc(ini) + "</span>";
  }
  function first(name) { return String(name || "").split(" ")[0]; }
  /* "20 min", "an hour", "3.5 hours" — under an hour in minutes (to 5), never "0.3 hours" */
  function hoursWords(h) {
    if (h < 1) return Math.max(5, Math.round(h * 12) * 5) + " min";
    var r = Math.round(h * 2) / 2;
    return r === 1 ? "an hour" : r + " hours";
  }
  /* "this evening", "tomorrow morning", "Thursday morning" */
  function shiftWords(w, c) {
    var slot = String(c.name || "").toLowerCase();
    if (c.date === w.today) return slot === "morning" ? "this morning" : slot === "evening" ? "this evening" : "today, " + slot;
    if (c.date === addDays(w.today, 1)) return "tomorrow " + slot;
    return new Date(c.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" }) + " " + slot;
  }

  function Roster(w) {
    var list = [];
    for (var i = 0; i < 7; i++) {
      var k = addDays(w.today, i);
      w.shifts.forEach(function (x) { var c = w.cells[k + "|" + x.id]; if (c) list.push({ c: c, x: x }); });
    }
    list = list.filter(function (e) { return (!e.c.past || e.c.now) && ["off", "cancelled"].indexOf(e.c.status) === -1 && e.c.working !== false; });
    var who = function (e) { return e.c.inCharge || e.x.inCharge || ""; };
    /* the card: who, which shift and when, and on one line what it makes and whether that fits
       ("3 products · 320 kg" … "Needs 3 hours more" / "Fits the shift") — the same shape on both cards */
    function card(e, lead, headline, sub) {
      var c = e.c, over = c.hours.used - c.hours.of;
      var names = {}, made = 0, packs = 0;
      c.batches.forEach(function (b) { names[b.product] = 1; made += b.kg; packs += b.packets; });
      var np = Object.keys(names).length;
      var what = !np ? "Nothing planned yet" : np + (np === 1 ? " product" : " products") + " · " + (made ? kg(made) : n(packs) + " packets");
      var fit = !np ? "" : over > 0 ? '<span class="sf-fit warn">Needs ' + hoursWords(over) + " more</span>" : '<span class="sf-fit ok">Fits the shift</span>';
      return '<button type="button" class="sf-card" data-shift="' + c.key + '"><span class="sf-lead">' + lead + "</span>" +
        '<span class="sf-row">' + avatar(who(e)) + '<span class="sf-txt"><span class="sf-big">' + headline + '</span><span class="sf-sub">' + sub + "</span></span></span>" +
        '<span class="sf-note"><span>' + what + "</span>" + fit + "</span></button>";
    }
    /* "", "tomorrow ", "Thursday " — the day only when it isn't today */
    var dayWord = function (e) { return e.c.date === w.today ? "" : e.c.date === addDays(w.today, 1) ? "tomorrow " : new Date(e.c.date + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long" }) + " "; };
    var now = list.filter(function (e) { return e.c.now; })[0];
    var first_ = now || list[0], after = first_ ? list[list.indexOf(first_) + 1] : null;
    var left = !first_ ? "" : now
      ? card(now, "Now", esc(first(who(now))) + " is running the floor", esc(now.c.name) + " shift · till " + hr(now.x.end))
      : card(first_, "Starts next", esc(first(who(first_))) + " starts " + esc(shiftWords(w, first_.c)), esc(first_.c.name) + " shift · " + dayWord(first_) + "from " + hr(first_.x.start));
    /* Now · Next; with no shift on, the left card already says "Starts next", so the one after it is "Then" */
    var right = after ? card(after, now ? "Next" : "Then", esc(first(who(after))) + " takes over", esc(after.c.name) + " shift · " + dayWord(after) + "from " + hr(after.x.start)) : "";
    return '<div class="sf">' + (S.err && !S.panel ? '<div class="wk-err">' + esc(S.err) + "</div>" : "") +
      '<div class="sf-pair">' + left + right + "</div></div>";
  }

  /* ── a batch into the open shift: picked from the ones raised in All batches that have no shift yet ── */
  function AddBatch(w) {
    if (!S.add) return '<button type="button" class="btn sm sp-addb" data-act="addOpen">＋ Add batch</button>';
    var PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>';
    return '<div class="st-form sp-add"><div class="sp-add-h"><b>Waiting for a shift · ' + w.tray.length + '</b><button type="button" class="btn sm" data-act="addCancel">Done</button></div>' +
      (w.tray.length ? '<ul class="sp-b">' + w.tray.map(function (b) {
        return '<li><div class="sp-bi"><button type="button" class="bl" data-batch="' + b.id + '"><span class="bl-n"><b>' + esc(b.name) + "</b><small>" + esc(b.no) + " · " + esc(b.size) + (b.due ? " · due " + esc(dayName(b.due, true)) : "") + "</small></span></button>" +
          '<button type="button" class="sp-rm sp-plus" data-act="addPick" data-id="' + b.id + '" title="Add to this shift" aria-label="Add ' + esc(b.no) + ' to this shift">' + PLUS + "</button></div></li>";
      }).join("") + "</ul>" : '<div class="muted small">Every planned batch has a shift. Raise a new one in <button type="button" class="lnk" data-go="production/batch-management">All batches</button>.</div>') + "</div>";
  }

  /* ── one shift, opened ── */
  function ShiftPanel(w) {
    var c = w.cells[S.panel.key] || w.options.filter(function (o) { return o.key === S.panel.key; })[0];
    if (!c) return "";
    var F = S.form, started = c.batches.some(function (b) { return b.state !== "planned"; });
    var editable = ["ended", "cancelled"].indexOf(c.status) === -1 && (!c.past || c.status === "live" || c.status === "stopped");
    var crew = F.crew || c.crew, inCharge = F.inCharge || c.inCharge;
    var status = { live: "Running now", stopped: "Stopped" + (c.stopped ? " · " + c.stopped : ""), ended: "Handed over", scheduled: "Coming up", open: "Coming up" }[c.status] || "";
    if (c.past && ["scheduled", "open"].indexOf(c.status) !== -1) status = "Over";
    var sx = w.shifts.filter(function (x) { return x.id === c.slot; })[0] || { start: 0, end: 0 };
    var body = "";
    if (c.takeover && !c.takeover.taken) {
      body += '<div class="sp-take"><b>' + esc(c.takeover.from) + " handed over to you</b>" + (c.takeover.note ? "<p>“" + esc(c.takeover.note) + "”</p>" : "") +
        (c.takeover.batches.length ? "<p>" + c.takeover.batches.map(function (x) { return esc(x.product) + (x.step ? " · next: " + esc(x.step) : ""); }).join("<br>") + "</p>" : "") +
        '<button type="button" class="btn primary sm" data-act="takeover">Take over as ' + esc(short(c.inCharge)) + "</button></div>";
    }
    if (c.handover) body += '<div class="sp-note">Handed over to ' + esc(c.handover.toInCharge || c.handover.to) + (c.handover.note ? ": “" + esc(c.handover.note) + "”" : "") + "</div>";
    if (editable) {
      body += '<div class="sp-f"><label>In charge</label><select data-f="inCharge">' + w.supervisors.map(function (o) { return "<option" + (o === inCharge ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select></div>" +
        '<div class="sp-f"><label>People · ' + crew.length + '</label><div class="sp-crew">' + w.workers.map(function (p) {
          var on = crew.indexOf(p.id) !== -1;
          return '<button type="button" class="pp' + (on ? " on" : "") + '" data-act="crew" data-id="' + p.id + '" aria-pressed="' + on + '">' + (on ? "✓ " : "") + esc(p.name) + "<small>" + esc(p.role) + "</small></button>";
        }).join("") + "</div></div>" +
        ((F.crew || F.inCharge) ? '<div class="sp-row"><button type="button" class="btn primary sm" data-act="saveCrew">Save changes</button><button type="button" class="btn sm" data-act="resetCrew">Undo</button></div>' : "");
    } else {
      body += '<div class="sp-f"><label>In charge</label><div>' + esc(c.inCharge) + '</div></div><div class="sp-f"><label>People · ' + c.crew.length + "</label><div>" +
        c.crew.map(function (id) { var p = w.workers.filter(function (x) { return x.id === id; })[0]; return p ? esc(p.name) : ""; }).filter(Boolean).join(", ") + "</div></div>";
    }
    body += '<div class="sp-f"><label>Batches · ' + c.batches.length + (c.batches.length ? " · " + hrs(c.hours.used) + " of work in a " + hrs(c.hours.of) + " shift" : "") + "</label>" +
      (c.batches.length ? '<ul class="sp-b">' + c.batches.map(function (b) {
        /* a planned batch can come off the shift (back to Not scheduled): an icon, then a one-line confirm in place */
        var canMove = b.state === "planned" && editable, asking = S.rm === b.id;
        return '<li><div class="sp-bi"><button type="button" class="bl" data-batch="' + b.id + '"><span class="bl-n"><b>' + esc(b.name) + "</b><small>" + esc(b.no) + " · " + esc(b.size) + (b.office ? " · Office" : "") + '</small></span><span class="badge b-' + esc(b.state) + '">' + esc(BADGE[b.state] || b.state) + "</span></button>" +
          (canMove && !asking ? '<button type="button" class="sp-rm" data-act="rm" data-id="' + b.id + '" title="Remove from this shift" aria-label="Remove ' + esc(b.no) + ' from this shift"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg></button>' : "") + "</div>" +
          (canMove && asking ? '<div class="sp-rmq" role="group" aria-label="Remove ' + esc(b.no) + '"><span>Remove from this shift? It goes back to Not scheduled.</span><span class="sp-rmq-b"><button type="button" class="btn sm warn" data-act="rmYes" data-id="' + b.id + '">Remove</button><button type="button" class="btn sm" data-act="rmNo">Keep</button></span></div>' : "") + "</li>";
      }).join("") + "</ul>" : '<div class="muted">No batches yet.</div>') + (editable ? AddBatch(w) : "") + "</div>";
    /* no Hand over or Stop (owner, 29 Sep 2026): when a shift ends, its planned and running batches
       move to the next shift on their own (D.rollOver in the store) */
    var acts = [];
    if (c.status === "stopped") acts.push(["resume", "Resume"]);
    if (!c.past && !started && ["scheduled", "open"].indexOf(c.status) !== -1) acts.push(["cancel", "Cancel this shift"]);
    var ask = "";
    if (S.ask === "cancel") ask = Ask("Why cancel it?", "A holiday, no people…", "Cancel · its batches go back to Not scheduled", false);
    else if (S.ask === "resume") ask = '<div class="sp-ask"><p>Resume the shift? Its batches come off hold.</p><div class="sp-row"><button type="button" class="btn primary sm" data-act="do">Yes, resume</button><button type="button" class="btn sm" data-act="ask" data-ask="">Back</button></div></div>';
    return Panel(c.name + " shift", dayName(c.date, true) + " · " + hr(sx.start) + " – " + hr(sx.end) + (status ? " · " + status : ""), body,
      acts.length || ask ? (ask || acts.map(function (a) { return '<button type="button" class="btn sm' + (a[0] === "cancel" ? " warn" : a[0] === "resume" ? " primary" : "") + '" data-act="ask" data-ask="' + a[0] + '">' + a[1] + "</button>"; }).join("")) : "");
  }
  function Panel(title, sub, body, foot) {
    return '<div class="sp-scrim" data-act="close"></div><aside class="sp" role="dialog" aria-modal="true" aria-label="' + esc(title) + '">' +
      '<div class="sp-h"><div><b>' + esc(title) + "</b><small>" + esc(sub) + '</small></div><button type="button" class="ib" data-act="close" aria-label="Close">✕</button></div>' +
      '<div class="sp-body">' + body + (S.err ? '<div class="wk-err">' + esc(S.err) + "</div>" : "") + "</div>" + (foot ? '<div class="sp-foot">' + foot + "</div>" : "") + "</aside>";
  }
  function Ask(label, ph, go, required) {
    return '<div class="sp-ask"><label>' + esc(label) + '</label><input data-f="text" placeholder="' + esc(ph) + '" value="' + esc(S.form.text || "") + '">' +
      '<div class="sp-row"><button type="button" class="btn primary sm" data-act="do"' + (required && !S.form.text ? " disabled" : "") + ">" + esc(go) + '</button><button type="button" class="btn sm" data-act="ask" data-ask="">Back</button></div></div>';
  }

  /* ── Shift settings: the shifts every working day has ── */
  function Settings(w) {
    var F = S.form, ed = S.panel.edit;
    var hourOpts = function (v) { var o = ""; for (var h = 0; h < 24; h++) o += '<option value="' + h + '"' + (Number(v) === h ? " selected" : "") + ">" + hr(h) + "</option>"; return o; };
    function form(x) {
      var crew = F.crew || (x ? x.crew : []), inCharge = F.inCharge || (x ? x.inCharge : "");
      return '<div class="st-form"><div class="st-grid"><div class="sp-f"><label>Name</label><input data-f="name" value="' + esc(F.name != null ? F.name : x ? x.name : "") + '" placeholder="Night"></div>' +
        '<div class="sp-f"><label>Starts</label><select data-f="start">' + hourOpts(F.start != null ? F.start : x ? x.start : 23) + "</select></div>" +
        '<div class="sp-f"><label>Ends</label><select data-f="end">' + hourOpts(F.end != null ? F.end : x ? x.end : 7) + "</select></div></div>" +
        '<div class="sp-f"><label>In charge</label><select data-f="inCharge">' + (inCharge ? "" : '<option value="" selected>Pick a person</option>') + w.supervisors.map(function (o) { return "<option" + (o === inCharge ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select></div>" +
        '<div class="sp-f"><label>Usual people · ' + crew.length + '</label><div class="sp-crew">' + w.workers.map(function (p) {
          var on = crew.indexOf(p.id) !== -1;
          return '<button type="button" class="pp' + (on ? " on" : "") + '" data-act="screw" data-id="' + p.id + '" aria-pressed="' + on + '">' + (on ? "✓ " : "") + esc(p.name) + "<small>" + esc(p.role) + "</small></button>";
        }).join("") + "</div></div>" +
        '<div class="sp-row"><button type="button" class="btn primary sm" data-act="saveShift">' + (x ? "Save" : "Add shift") + '</button><button type="button" class="btn sm" data-act="editShift" data-id="">Cancel</button>' +
        (x && w.shifts.length > 1 ? '<button type="button" class="btn sm warn" data-act="removeShift" style="margin-left:auto">Remove shift</button>' : "") + "</div></div>";
    }
    var body = '<ul class="st-list">' + w.shifts.map(function (x) {
        return "<li>" + (ed === x.id ? form(x) : '<div class="st-row"><span><b>' + esc(x.name) + "</b> · " + hr(x.start) + " – " + hr(x.end) + " · " + hrs(D_hours(x)) + "<small>" + esc(x.inCharge) + " in charge · usually " + people(x.crew.length) + "</small></span>" +
          '<button type="button" class="btn sm" data-act="editShift" data-id="' + x.id + '">Edit</button></div>') + "</li>";
      }).join("") + (ed === "new" ? "<li>" + form(null) + "</li>" : "") + "</ul>" +
      (ed ? "" : '<button type="button" class="btn sm" data-act="editShift" data-id="new">＋ Add a shift</button>') +
      '<div class="sp-f"><label>Working days</label><div class="sp-crew">' + [1, 2, 3, 4, 5, 6, 0].map(function (dn) {
        var on = w.days.indexOf(dn) !== -1;
        return '<button type="button" class="pp' + (on ? " on" : "") + '" data-act="day" data-day="' + dn + '" aria-pressed="' + on + '">' + (on ? "✓ " : "") + DAYS[dn] + "</button>";
      }).join("") + "</div></div>";
    return Panel("Shift settings", w.shifts.map(function (x) { return x.name; }).join(" · "), body, "");
  }
  function D_hours(x) { return x.end > x.start ? x.end - x.start : 24 - x.start + x.end; }

  /* ── writes ── */
  function write(fn) {
    try { FB_PRODUCTION.write(fn); S.err = ""; return true; }
    catch (e) { S.err = (e && e.body && e.body.error) || (e && e.message) || "That didn't save."; return false; }
  }
  function keyOf(key) { var p = key.split("|"); return { date: p[0], slot: p[1] }; }
  function panelAct(act, el) {
    var w = S.lens === "week" ? weekModel() : weekModel(isoDay(Date.now()), 1);
    if (S.panel.kind === "settings") {
      if (act === "editShift") { S.panel.edit = el.getAttribute("data-id") || null; S.form = {}; S.err = ""; }
      else if (act === "screw") {
        var x0 = w.shifts.filter(function (x) { return x.id === S.panel.edit; })[0];
        var cr = (S.form.crew || (x0 ? x0.crew : [])).slice(), id0 = el.getAttribute("data-id"), j0 = cr.indexOf(id0);
        if (j0 === -1) cr.push(id0); else cr.splice(j0, 1);
        S.form.crew = cr;
      } else if (act === "saveShift") {
        var x = w.shifts.filter(function (y) { return y.id === S.panel.edit; })[0] || {};
        var o = { id: x.id, name: S.form.name != null ? S.form.name : x.name, start: S.form.start != null ? S.form.start : (x.id ? x.start : 23), end: S.form.end != null ? S.form.end : (x.id ? x.end : 7),
          inCharge: S.form.inCharge || x.inCharge, crew: S.form.crew || x.crew || [] };
        if (write(function (D) { D.saveShiftType(o); })) { S.panel.edit = null; S.form = {}; }
      } else if (act === "removeShift") {
        var rid = S.panel.edit;
        if (write(function (D) { D.removeShiftType(rid); })) { S.panel.edit = null; S.form = {}; }
      } else if (act === "day") {
        var dn = +el.getAttribute("data-day"), days = w.days.slice(), i = days.indexOf(dn);
        if (i === -1) days.push(dn); else days.splice(i, 1);
        write(function (D) { D.setWorkingDays(days); });
      }
      return;
    }
    var c = w.cells[S.panel.key] || w.options.filter(function (o) { return o.key === S.panel.key; })[0], k = keyOf(S.panel.key);
    var sid = function (D) { return c.id || D.ensureSlot(k.date, k.slot)._id; };
    if (act === "crew") {
      var crew = (S.form.crew || c.crew).slice(), id = el.getAttribute("data-id"), j = crew.indexOf(id);
      if (j === -1) crew.push(id); else crew.splice(j, 1);
      S.form.crew = crew;
    } else if (act === "resetCrew") S.form = {};
    else if (act === "saveCrew") {
      var ch = {}; if (S.form.crew) ch.crew = S.form.crew; if (S.form.inCharge) ch.inCharge = S.form.inCharge;
      if (write(function (D) { D.setCrew(sid(D), ch); })) S.form = {};
    } else if (act === "takeover") write(function (D) { D.takeOver(c.id, "admin"); });
    else if (act === "addOpen") { S.add = {}; S.rm = null; S.err = ""; }
    else if (act === "addCancel") { S.add = null; S.err = ""; }
    else if (act === "addPick") { var pid = el.getAttribute("data-id"); write(function (D) { D.schedule(pid, k.date, k.slot, "admin"); }); }
    else if (act === "rm") S.rm = el.getAttribute("data-id");
    else if (act === "rmNo") S.rm = null;
    else if (act === "rmYes") { var bid = el.getAttribute("data-id"); if (write(function (D) { D.unschedule(bid); })) S.rm = null; }
    else if (act === "ask") { S.ask = el.getAttribute("data-ask") || null; S.form.text = ""; S.err = ""; }
    else if (act === "do") {
      var text = (S.form.text || "").trim(), ok = false;
      if (S.ask === "resume") ok = write(function (D) { D.resumeSlot(c.id, "admin"); });
      else if (S.ask === "cancel") ok = write(function (D) { D.cancelSlot(sid(D), text, "admin"); });
      if (ok) { S.ask = null; S.form = {}; }
    }
  }


  /* ── Today's Production and Purchase Plan (owner, 3 Oct 2026) ─────────
     The owner's own sheets, as tabs with their columns, worked out from the
     store instead of typed in. One chain, the way Vasu makes things:

       Orders           what customers have ordered, per pack: packs per 30 kg
                        master carton, cartons ordered (Qty Ordered (Packs)),
                        and pouches (the sheet's "Qty Ordered (Kg)" column is
                        cartons × packs per carton — pouches).
       Finished Goods   a row per pack under its product (the product row
                        carries the recipe version and adds its packs up), in
                        pouches like the sheet:
                          Shortfall  In stock − Ordered (short is negative)
                          Approved   Ordered − In stock + MSQ + deviation
       Semi Finished    the semi-finished goods those packs are mixed from, in
                        kg: each product's Approved, in kg, × the good's share
                        of the finished recipe. Approved as above.
       Purchase         the raw material the semi-finished goods are cut from:
                        Ordered = Semi Finished Approved × (1 + wastage), the
                        semi-finished recipe's own; sticks straight from the
                        chaap. MSQ is the material's; In stock what is free.

     MSQ Deviation (+ or −) and Confirm are the planner's, per line, for the
     day, on this device. A confirmed line keeps its deviation.            */
  var PLAN_TABS = [["or", "Orders"], ["fg", "Finished Goods"], ["sf", "Semi Finished Goods"], ["pu", "Purchase"]];
  try { S.plan = sessionStorage.getItem("fb.v7.flow.plantab") || "or"; } catch (e) { S.plan = "or"; }
  function planWho() {
    try { var a = (window.parent.FBContext || window.FBContext).account(); if (a && a.name && !a.guest) return a.name; } catch (e) { /* standalone */ }
    return "Owner";
  }
  /* the four tables live in assets/production/plan-tables.js: the Control Tower reads them too */
  function planModel() { return FBPlanTables.build(FB_PRODUCTION); }
  function Plan(p) {
    var tab = PLAN_TABS.some(function (t) { return t[0] === S.plan; }) ? S.plan : "or";
    var q = function (v) { return n(v); };
    var sh = function (v) { return '<td class="num' + (v < -0.5 ? " pp-neg" : "") + '">' + (Math.abs(v) < 0.5 ? "0" : (v < 0 ? "-" : "") + n(Math.abs(v))) + "</td>"; };
    /* one colour, one meaning (owner, 3 Oct 2026: the sheet's per-vegetable colours "aren't
       making sense"): an amber edge on a line that still needs you — to confirm, or to
       order — and a green edge once it is taken care of; nothing to do, no colour */
    var st = function (l) {
      var need = l.toOrder != null ? l.toOrder > 0 : l.toProduce > 0;
      var done = l.toOrder != null ? !need && (l.requested + l.onWay) > 0 : !need && (l.wait + l.run) > 0;
      return need ? ' class="pp-row-need"' : done ? ' class="pp-row-done"' : "";
    };
    /* a standing figure (MSQ, wastage, a cut's share) or the approved quantity: a figure with
       a pencil; the pencil opens it to type, ✓ (or Enter) saves, × (or Esc) leaves it */
    var ed = function (key, value, shown, label) {
      var pen = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
      if (S.edit !== key) return '<span class="pp-ed"><span class="pp-msq-v">' + shown + '</span><button type="button" class="pp-pen" data-edit="' + esc(key) + '" aria-label="Edit ' + esc(label) + '" title="Edit">' + pen + "</button></span>";
      return '<span class="pp-msq-e"><input type="number" min="0" step="any" inputmode="decimal" data-edit-in="' + esc(key) + '" value="' + esc(value) + '" aria-label="' + esc(label) + '">' +
        '<button type="button" class="pp-msq-ok" data-edit-save aria-label="Save" title="Save">✓</button><button type="button" class="pp-msq-x" data-edit-cancel aria-label="Cancel" title="Cancel">×</button></span>';
    };
    var r2 = function (v) { return Math.round(v * 100) / 100; };
    /* Approved: on Purchase the sheet's; on Finished and Semi Finished what is in batches —
       its states under it (Batch Management's), the batches on hover, a click opens Batches */
    /* a row's recipe version opens that recipe in Recipes (owner, 3 Oct 2026: "map recipe versions here") */
    var verLink = function (recipeId, label) {
      return label ? '<a href="#" class="pp-vlink" data-go="production/configure-recipe?recipe=' + encodeURIComponent(recipeId) + '" title="Open this recipe in Recipes">' + esc(label) + "</a>" : "—";
    };
    var apprCell = function (l, u) {
      if (l.batches == null) return '<td class="num pp-big"><b>' + q(l.approved) + (u || "") + "</b></td>";
      if (!(l.approved > 0)) return '<td class="num pp-big pp-muted">0</td>';
      var tip = l.batches.map(function (x) { return x.no + " · " + q(x.qty) + " · " + x.state + " · " + x.when; }).join("\n");
      return '<td class="num pp-big"><a href="#" class="pp-blink pp-appr" ' + (l.batches.length === 1 ? 'data-batch="' + esc(l.batches[0].id) + '"' : 'data-go="production/batch-management"') + ' title="' + esc(tip) + '"><b>' + q(l.approved) + "</b>" +
        '<small>' + [l.wait ? '<span class="pp-st-wait">' + q(l.wait) + " waiting</span>" : "", l.run ? '<span class="pp-st-run">' + q(l.run) + " in progress</span>" : ""].filter(Boolean).join(" · ") + "</small></a></td>";
    };
    var devCell = function (l, u) {
      var v = (l.dev < 0 ? -1 : 1) * Math.round(Math.abs(l.dev)), tip = "InStock " + q(l.stock) + " + Approved " + q(l.approved) + " − " + (l.toOrder != null ? "Required " : "Ordered ") + q(l.ordered) + " − MSQ " + q(l.msq);
      return '<td class="num ' + (v > 0 ? "pp-dev-up" : v < 0 ? "pp-neg" : "pp-muted") + '" title="' + esc(tip) + '">' + (v > 0 ? "+" : v < 0 ? "−" : "") + n(Math.abs(v)) + (v && u ? u : "") + "</td>";
    };
    var marks = function (l) {
      return devCell(l) +
        '<td class="num pp-to">' + (l.toProduce > 0 ? "<b>" + q(l.toProduce) + "</b>"
          : l.approved > 0 ? '<span class="pp-covered">Approved</span>' : '<span class="pp-muted">—</span>') + "</td>";
    };
    var demandCell = function (l, u) {
      if (!(l.ordered > 0.5)) return '<td class="num pp-muted" title="No batch approved for production needs it">0</td>';
      var tip = "From batches approved for production:\n" + (l.demand || []).map(function (x) { return x.no + " · " + x.product + " · " + x.state + " · " + n(x.qty) + (u || " kg"); }).join("\n");
      return '<td class="num"><a href="#" class="pp-blink" ' + ((l.demand || []).length === 1 ? 'data-batch="' + esc(l.demand[0].id) + '"' : 'data-go="production/batch-management"') + ' title="' + esc(tip) + '">' + q(l.ordered) + (u || "") + "</a></td>";
    };
    var aheads = '<th class="num" title="Approved for production: what is in batches — waiting to start or in progress. What a batch makes moves to InStock.">Approved Production</th>' +
      '<th class="num" title="Where stock ends up against MSQ once the approved production is made: InStock + Approved − Ordered − MSQ">MSQ Deviation</th>';
    var bheads = '<th class="num pp-h-to" title="What the plan needs (Ordered − InStock + MSQ) that no batch covers yet">To produce</th>';
    var tabsHtml = '<div class="pp-tabs" role="tablist" aria-label="Today\'s Production and Purchase Plan">' + PLAN_TABS.map(function (t) {
      return '<button type="button" role="tab" class="pp-tab" data-ptab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + t[1] + "</button>";
    }).join("") + "</div>";
    var body;
    if (tab === "or") {
      body = '<table class="pp pp-or"><thead><tr><th>Item name</th><th class="num pp-th-ed">No. of Packs per ' + ed("carton:kg", p.cartonKg, n(p.cartonKg, 100) + "kg", "master carton size in kg") + '</th><th class="num">Qty Ordered (Packs)</th><th class="num">Qty Ordered (Kg)</th></tr></thead><tbody>' +
        p.orders.map(function (g) {
          return g.rows.map(function (r) {
            return '<tr><th scope="row">' + esc(r.name) + '</th><td class="num">' + q(r.perCarton) + '</td><td class="num">' + q(r.cartons) + '</td><td class="num">' + q(r.qty) + "</td></tr>";
          }).join("") +
            '<tr class="pp-total pp-center"><th scope="row">' + esc(g.name) + '</th><td class="num">' + q(g.total.perCarton) + '</td><td class="num">' + q(g.total.cartons) + '</td><td class="num">' + q(g.total.qty) + "</td></tr>";
        }).join("") + "</tbody></table>";
    } else if (tab === "fg") {
      body = pbBar(p, "fg") + '<table class="pp pp-fg"><thead><tr><th>Product Name</th><th>Recipe Version</th><th class="num">MSQ (Min. Stock Qty in kg)</th><th class="num">Ordered Quantity</th><th class="num">InStock</th><th class="num" title="InStock − Ordered">Shortfall</th>' + aheads + bheads + '</tr></thead><tbody>' +
        p.fg.map(function (g) {
          return g.packs.map(function (l) {
            return "<tr" + st(l) + '><th scope="row">' + esc(l.name) + '</th><td class="pp-ver">' + verLink(g.recipeId, g.version) + '</td><td class="num pp-msq">' + ed("msq:" + l.skuId, l.msq, q(l.msq), "MSQ of " + l.name) + '</td><td class="num">' + q(l.ordered) + '</td><td class="num">' + q(l.stock) + "</td>" + sh(l.short) +
              apprCell(l) + marks(l) + "</tr>";
          }).join("") +
            '<tr class="pp-total"><th scope="row">' + esc(g.name) + '</th><td class="pp-ver">' + verLink(g.recipeId, g.version) + '</td><td class="num">' + q(g.total.msq) + '</td><td class="num">' + q(g.total.ordered) + '</td><td class="num">' + q(g.total.stock) + "</td>" + sh(g.total.short) +
            '<td class="num">' + q(g.total.approved) + '</td><td class="num' + (g.total.dev < -0.5 ? " pp-neg" : g.total.dev > 0.5 ? " pp-dev-up" : "") + '">' + (g.total.dev > 0.5 ? "+" : g.total.dev < -0.5 ? "−" : "") + q(Math.round(Math.abs(g.total.dev))) + '</td><td class="num">' +
              (g.total.toProduce ? q(g.total.toProduce) : g.total.approved ? '<small class="pp-alldone">Approved</small>' : "—") + "</td></tr>";
        }).join("") + "</tbody></table>";
    } else if (tab === "sf") {
      body = pbBar(p, "sf") + '<table class="pp pp-sf"><thead><tr><th>Product Name</th><th>Cut Recipe</th><th class="num">Ingredient %age</th><th class="num">MSQ (Min. Stock Qty)</th><th class="num" title="What finished batches approved for production still need from the cold store">Ordered Qty (Kg)</th><th class="num">InStock</th><th class="num" title="InStock − Ordered">Shortfall</th>' + aheads + bheads + '</tr></thead><tbody>' +
        p.semi.map(function (l) {
          /* a cut's share of the products it goes into; a product made of this cut alone (100%) is left out
             when the cut is also part of a mix (owner, 3 Oct 2026: "keep only 20") */
          var mixed = l.shares.some(function (s) { return !s.single; });
          var pct = l.shares.filter(function (s) { return !mixed || !s.single; }).map(function (s) {
            return s.single ? '<span title="' + esc("All of " + s.of) + '">' + n(s.pct) + "</span>" : '<span title="' + esc(n(s.pct, 100) + "% of " + s.of) + '">' + ed("share:" + s.rid + ":" + l.id, r2(s.pct), n(s.pct, 100), l.name + "'s % of " + s.of) + "</span>";
          }).join(" · ") || "—";
          return "<tr" + st(l) + '><th scope="row">' + esc(l.name) + "</th><td class=\"pp-ver\">" + verLink(l.id, l.cut) + '</td><td class="num pp-msq">' + pct + '</td><td class="num pp-msq">' + (l.bulk ? "—" : ed("smsq:" + l.id, l.msq, q(l.msq), "MSQ of " + l.name)) +
            '</td>' + demandCell(l, "") + '<td class="num">' + q(l.stock) + "</td>" + sh(l.short) + apprCell(l) + marks(l) + "</tr>";
        }).join("") + "</tbody></table>";
    } else {
      /* Purchase (owner, 3 Oct 2026): not a purchase order per row. Pick what to buy
         (the boxes), Create order, and the table keeps count of what is
         requested (waiting for approval), on the way, and still to order. */
      var buyable = p.purchase.filter(function (l) { return l.toOrder > 0; });
      var picked = buyable.filter(function (l) { return S.puSel[l.id]; });
      var unitOf = function (l) { return l.unit === "kg" ? "" : " " + l.unit; };
      /* a figure's orders on hover (number · supplier · qty · state · expected); a click opens Purchase Orders */
      var poTip = function (l, waiting) {
        return l.pos.filter(function (x) { return x.waiting === waiting; }).map(function (x) {
          return x.no + " · " + x.supplier.split(/ · |, /)[0] + " · " + n(x.qty) + " " + uword(l.unit) + " · " + (PR_WORD[x.status] || x.status).toLowerCase() +
            (x.expectedAt ? " · expected " + new Date(x.expectedAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", hour12: true }) : "");
        }).join("\n");
      };
      var waitCell = function (l) {
        if (!(l.requested > 0)) return '<td class="num pp-muted">—</td>';
        return '<td class="num"><a href="#" class="pp-cnt pp-cnt-req pp-blink" data-go="procurement/purchase-orders" title="' + esc(poTip(l, true)) + '">' + q(l.requested) + unitOf(l) + "</a></td>";
      };
      /* Approved Purchase: what is with the supplier (its orders on hover) */
      var poCell = function (l, u) {
        if (!(l.approved > 0)) return '<td class="num pp-big pp-muted">0</td>';
        return '<td class="num pp-big"><a href="#" class="pp-blink pp-appr" data-go="procurement/purchase-orders" title="' + esc(poTip(l, false)) + '"><b>' + q(l.approved) + u + "</b></a></td>";
      };
      body = prBar(p, buyable, picked) +
        '<table class="pp pp-pu"><thead><tr>' +
        '<th>Product Name</th><th>Quality / Brand</th><th class="num">Wastage %age</th><th class="num">MSQ (Min Stk Qty)</th><th class="num" title="What batches approved for production — Semi Finished cuts and Finished Goods — still need from the store">Required Quantity</th><th class="num">InStock</th><th class="num" title="InStock − Required">Shortfall</th>' +
        '<th class="num" title="Approved purchase orders with the supplier, not at the gate yet. What comes in at the gate moves to InStock.">Approved Purchase</th>' +
        '<th class="num" title="Where stock ends up against MSQ once the approved purchase is in: InStock + Approved − Required − MSQ">MSQ Deviation</th>' +
        '<th class="num pp-h-req" title="Purchase orders raised and waiting for someone to approve them. Not sent to the supplier yet.">Awaiting approval</th>' +
        '<th class="num pp-h-to" title="What the plan needs (Required − InStock + MSQ) that no purchase order covers yet">To order</th></tr></thead><tbody>' +
        p.purchase.map(function (l) {
          var u = unitOf(l);
          return "<tr" + st(l) + '><th scope="row">' + esc(l.name) + "</th><td>" + esc(l.grade) + '</td><td class="num pp-msq">' + (l.wasteEdit ? ed("waste:" + l.id, l.waste, n(l.waste), "wastage % of " + l.name) : n(l.waste)) +
            '</td><td class="num pp-msq">' + ed("pmsq:" + l.id, l.msq, q(l.msq) + u, "MSQ of " + l.name) +
            '</td>' + demandCell(l, u) + '<td class="num">' + q(l.stock) + u + "</td>" + sh(l.short) + poCell(l, u) + devCell(l, u) + waitCell(l) +
            '<td class="num pp-to">' + (l.toOrder > 0 ? "<b>" + q(l.toOrder) + u + "</b>" : '<span class="pp-covered">Covered</span>') + "</td></tr>" +
            "";
        }).join("") + "</tbody></table>";
    }
    return tabsHtml + '<section class="card pp-card"><div class="tbl-wrap">' + body + "</div></section>" + (S.pr && tab === "pu" ? prPanel(p) : "") + (S.pb && S.pb.tab === tab ? pbPanel() : "");
  }

  /* ── Purchase requests (owner, 3 Oct 2026) ───────────────────────────
     "Row wise creating purchase order is not natural." A purchase request is
     made the way the purchase person thinks: what the plan still needs, from
     one supplier at a time, plus anything else regular from that supplier.

       Create order              the boxes ticked (or everything still to
                                 order) come into the order form below,
                                 one section per usual supplier.
       Order                     one purchase order per supplier, each
                                 Pending Approval: Requested in the table.
                                 Approve them right after (one tap), or in
                                 Purchase Orders: then On the way until the
                                 gate receives it.
     A request can be rejected (with a reason) and an order cancelled while
     nothing has come in on it; either way the quantity is To order again. */
  var PR_LIVE = ["Pending Approval", "InProgress", "Pending", "Partial Delivered"];
  var PR_WORD = { "Pending Approval": "Waiting for approval", InProgress: "With the supplier", Pending: "With the supplier", "Partial Delivered": "Part received" };
  function uword(u) { return u === "kg" ? "kg" : u; }
  function prCatalogue() {
    return FB_PRODUCTION.read(function (D, d) {
      var buy = {};
      D.plan().materials.forEach(function (m) { buy[m.id] = m.buy; });
      return {
        suppliers: d.suppliers.map(function (s) { return { id: s.id, name: s.name, person: s.person, contact: s.contact, terms: s.terms, supplies: s.supplies }; }),
        materials: d.materials.map(function (m) {
          var free = Math.max(0, D.onHand(m.id) - D.reserved(m.id)), pack = m.packQty || 1;
          var suggest = buy[m.id] > 0 ? buy[m.id] : Math.max(0, (m.threshold || 0) - free - D.ordered(m.id));
          return { id: m.id, name: m.name, grade: m.grade || "", unit: m.unit, price: m.price, supplierId: m.supplierId, store: m.store, kind: m.kind, free: free,
            tax: m.store === "Cold room" ? 0 : m.kind === "packaging" ? 18 : m.unit === "pcs" ? 12 : 5,
            suggest: suggest > 0 ? Math.ceil(suggest / pack) * pack : pack };
        }),
      };
    });
  }
  function prDue(lines, cat) {
    var fresh = lines.some(function (l) { var m = cat.materials.filter(function (x) { return x.id === l.materialId; })[0]; return m && m.store === "Cold room"; });
    var due = new Date(); due.setDate(due.getDate() + (fresh ? 1 : 3));
    return isoDay(due.getTime());
  }
  /* The order form (3 Oct 2026, third pass — the owner: "simple: products
     supplier wise, add supplier, add product, price, edit quantity, search
     and add product, and just order"). A plain form, nothing hidden:
       a section per supplier (change it from its name)
         a row per product: price and quantity to type in, the amount
         a search box: type, pick, it's on
       + Add supplier
       Order: one purchase order per supplier, each waiting for approval. */
  var supShort = function (name) { return String(name || "").split(/ · |, /)[0]; };
  var rupeeShort = function (v) { return v >= 1e7 ? "₹" + (v / 1e7).toFixed(2) + " Cr" : v >= 1e5 ? "₹" + (v / 1e5).toFixed(2) + " L" : rupee(v); };
  var rupee = function (v) { return "₹" + Math.round(v).toLocaleString("en-IN"); };
  /* open it: the ticked lines (or everything still to order), grouped by usual supplier, the biggest first */
  function prStart(p) {
    var ticked = Object.keys(S.puSel).filter(function (k) { return S.puSel[k]; });
    var pool = p.purchase.filter(function (l) { return l.toOrder > 0 && (!ticked.length || ticked.indexOf(l.id) !== -1); });
    var val = {};
    pool.forEach(function (l) { val[l.supplierId] = (val[l.supplierId] || 0) + l.toOrder * l.price; });
    S.pr = { err: "", groups: Object.keys(val).sort(function (a, b) { return val[b] - val[a]; }).map(function (sup) {
      return { sup: sup, lines: pool.filter(function (l) { return l.supplierId === sup; }).map(function (l) { return { materialId: l.id, qty: l.toOrder, price: l.price }; }) };
    }) };
  }
  function prTotals(cat, g) {
    var t = { taxable: 0, gst: 0 };
    g.lines.forEach(function (l) {
      var m = cat.materials.filter(function (x) { return x.id === l.materialId; })[0], v = (Number(l.qty) || 0) * (Number(l.price) || 0);
      t.taxable += v; t.gst += v * ((m && m.tax) || 0) / 100;
    });
    t.total = Math.round(t.taxable + t.gst);
    return t;
  }
  function prGroupTot(t) { return (t.gst >= 1 ? "<small>incl. " + rupee(t.gst) + " GST</small> " : "") + rupee(t.total); }
  function prGrand(cat) { return S.pr.groups.reduce(function (t, g) { return t + prTotals(cat, g).total; }, 0); }
  function prLive() { return S.pr.groups.filter(function (g) { return g.lines.some(function (l) { return Number(l.qty) > 0; }); }); }
  /* the bar above the table: what is still to order, and the one way to buy it */
  function prBar(p, buyable, picked) {
    var value = buyable.reduce(function (t, l) { return t + l.toOrder * l.price; }, 0);
    var req = p.purchase.filter(function (l) { return l.requested > 0; }).length, way = p.purchase.filter(function (l) { return l.onWay > 0; }).length;
    return '<div class="pp-bar"><div class="pp-bar-t">' +
      (buyable.length ? "<b>" + buyable.length + " to order</b> · " + rupee(value) : '<b class="pp-ok-t">Nothing left to order</b>') +
      (req ? ' · <span class="pp-chip-req">' + req + " awaiting approval</span>" : "") + (way ? ' · <span class="pp-chip-way">' + way + " with the supplier</span>" : "") + "</div>" +
      (S.pr ? "" : '<button type="button" class="btn primary" data-pr-open>' + (picked.length ? "Order the " + picked.length + " selected" : buyable.length ? "Create order" : "New order") + "</button>") + "</div>";
  }
  /* what was just ordered: one line, and approving it is one more tap */

  /* a modal with one sheet (owner, 3 Oct 2026: "make this modal and excel like"):
     gridlines, row numbers, a band per supplier with its subtotal, cells to
     type straight into (Enter or ↓ goes down the column, ↑ up), and under each
     supplier an empty row whose Product cell searches and adds */
  function prPanel(p) {
    var cat = prCatalogue(), pr = S.pr, rn = 0;
    var matOf = function (id) { return cat.materials.filter(function (m) { return m.id === id; })[0]; };
    var used = pr.groups.map(function (g) { return g.sup; });
    var body = pr.groups.map(function (g, gi) {
      var t = prTotals(cat, g);
      var opts = cat.suppliers.filter(function (s) { return s.id === g.sup || used.indexOf(s.id) === -1; })
        .map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === g.sup ? " selected" : "") + ">" + esc(s.name) + "</option>"; }).join("");
      var band = '<tr class="xl-band"><td class="xl-n"></td><td colspan="5"><select class="xl-sup" data-pr-gsup="' + gi + '" aria-label="Supplier">' + opts + "</select>" +
          '<small class="xl-cnt">' + g.lines.length + " item" + (g.lines.length === 1 ? "" : "s") + "</small></td>" +
        '<td class="xl-num xl-sub" data-pr-gt="' + gi + '">' + prGroupTot(t) + "</td>" +
        '<td class="xl-x"><button type="button" class="pp-x" data-pr-grm="' + gi + '" aria-label="Remove this supplier" title="Remove this supplier">×</button></td></tr>';
      var rows = g.lines.map(function (l, i) {
        var m = matOf(l.materialId), u = uword(m.unit), k = gi + ":" + i;
        rn++;
        return '<tr><td class="xl-n">' + rn + "</td>" +
          '<td class="xl-p">' + esc(m.name) + "</td><td class=\"xl-g\">" + esc(m.grade || "") + '</td><td class="xl-u">' + u + "</td>" +
          '<td class="xl-c"><input type="number" min="0" step="0.01" inputmode="decimal" data-prr="' + k + '" value="' + esc(l.price) + '" aria-label="Rate of ' + esc(m.name) + '"></td>' +
          '<td class="xl-c"><input type="number" min="0" step="1" inputmode="decimal" data-prq="' + k + '" value="' + esc(l.qty) + '" aria-label="Quantity of ' + esc(m.name) + '"></td>' +
          '<td class="xl-num xl-amt" data-pramt="' + k + '">' + n((Number(l.qty) || 0) * (Number(l.price) || 0)) + "</td>" +
          '<td class="xl-x"><button type="button" class="pp-x" data-pr-rm="' + k + '" aria-label="Remove ' + esc(m.name) + '" title="Remove row">×</button></td></tr>';
      }).join("");
      var add = '<tr class="xl-add"><td class="xl-n">+</td><td colspan="3" class="xl-c xl-s"><input type="search" data-prs="' + gi + '" placeholder="Type a product to add…" autocomplete="off" aria-label="Search a product to add">' +
          '<div class="po-sl" data-prsl="' + gi + '" role="listbox" hidden></div></td><td></td><td></td><td></td><td class="xl-x"></td></tr>';
      return band + rows + add;
    }).join("");
    return '<div class="xl-back"><div class="xl-modal" role="dialog" aria-modal="true" aria-label="New purchase order">' +
      '<header class="xl-h"><b>New purchase order</b><span>' + pr.groups.length + " supplier" + (pr.groups.length === 1 ? "" : "s") + " · one order each</span>" +
        '<button type="button" class="pp-x" data-pr-close aria-label="Close">×</button></header>' +
      '<div class="xl-body"><table class="xl"><colgroup><col class="c-n"><col class="c-p"><col class="c-g"><col class="c-u"><col class="c-r"><col class="c-q"><col class="c-a"><col class="c-x"></colgroup>' +
        '<thead><tr><th class="xl-n"></th><th>Product</th><th>Grade</th><th>Unit</th><th class="xl-num xl-edh"><svg class="xl-pen" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Rate (₹)</th><th class="xl-num xl-edh"><svg class="xl-pen" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg> Quantity</th><th class="xl-num">Amount (₹)</th><th></th></tr></thead>' +
        "<tbody>" + body + "</tbody></table>" +
        (used.length < cat.suppliers.length ? '<button type="button" class="xl-addsup" data-pr-gadd>+ Add supplier</button>' : "") + "</div>" +
      prFootHtml(cat) + "</div></div>";
  }
  /* the footer, and its inline confirmation: Order asks once, in place, before anything is raised */
  function prFootHtml(cat) {
    var pr = S.pr;
    if (pr.ask) {
      var live = prLive(), names = live.map(function (g) { return supShort((cat.suppliers.filter(function (s) { return s.id === g.sup; })[0] || {}).name); });
      return '<footer class="xl-f xl-ask" role="alertdialog" aria-label="Confirm the order">' +
        '<p class="xl-q"><b>Raise ' + live.length + " purchase order" + (live.length === 1 ? "" : "s") + " for " + rupee(prGrand(cat)) + "?</b>" +
          "<span>" + esc(names.join(", ")) + " · " + (live.length === 1 ? "waits" : "each waits") + " for approval in Purchase Orders</span></p>" +
        '<button type="button" class="btn" data-pr-back>Back</button>' +
        '<button type="button" class="btn primary" data-pr-yes>Yes, order</button></footer>';
    }
    return '<footer class="xl-f">' + (pr.err ? '<p class="pp-pc-err">' + esc(pr.err) + "</p>" : "") +
      '<span class="po-tot">Total <b data-prtot>' + rupee(prGrand(cat)) + "</b></span>" +
      '<button type="button" class="btn" data-pr-close>Cancel</button>' +
      '<button type="button" class="btn primary" data-pr-go' + (prLive().length ? "" : " disabled") + ">Order</button></footer>";
  }
  /* the search under a supplier: their products first, then the rest */
  function prSearch(gi, text) {
    var cat = prCatalogue(), g = S.pr.groups[gi], q0 = String(text || "").trim().toLowerCase();
    var have = g.lines.map(function (l) { return l.materialId; });
    return cat.materials.filter(function (m) { return have.indexOf(m.id) === -1 && (!q0 || (m.name + " " + (m.grade || "")).toLowerCase().indexOf(q0) !== -1); })
      .sort(function (a, b) { return (b.supplierId === g.sup) - (a.supplierId === g.sup); }).slice(0, 8);
  }
  function prSearchHtml(gi, list, text) {
    if (!list.length) {
      var q0 = String(text || "").trim().toLowerCase(), cat = prCatalogue();
      var on = S.pr.groups[gi].lines.map(function (l) { return cat.materials.filter(function (m) { return m.id === l.materialId; })[0]; })
        .filter(function (m) { return m && q0 && (m.name + " " + (m.grade || "")).toLowerCase().indexOf(q0) !== -1; })[0];
      return '<p class="po-none">' + (on ? esc(on.name) + " is already on this order — change its quantity above" : "No product called that") + "</p>";
    }
    return list.map(function (m, i) {
      return '<button type="button" role="option" class="po-opt' + (i ? "" : " is-first") + '" data-pr-pick="' + gi + ":" + esc(m.id) + '"><span>' + esc(m.name) + (m.grade ? " <small>" + esc(m.grade) + "</small>" : "") + "</span><small>₹" + n(m.price, 100) + "/" + uword(m.unit) + "</small></button>";
    }).join("");
  }
  function prPick(gi, id) {
    var cat = prCatalogue(), m = cat.materials.filter(function (x) { return x.id === id; })[0], g = S.pr.groups[gi];
    if (!m || !g) return;
    var pl = planModel().purchase.filter(function (x) { return x.id === id && x.toOrder > 0; })[0];
    g.lines.push({ materialId: id, qty: pl ? pl.toOrder : m.suggest, price: m.price });
    S.pr.err = "";
    render();
    var inp = app.querySelector('[data-prq="' + gi + ":" + (g.lines.length - 1) + '"]');
    if (inp) { inp.focus(); inp.select(); }
  }
  /* Order: one purchase order per supplier with something on it, each waiting for approval */
  function prRaise() {
    var cat = prCatalogue(), who = planWho(), live = prLive();
    if (!live.length) throw new Error("Put a quantity on at least one product.");
    live.forEach(function (g) {
      var lines = g.lines.filter(function (l) { return Number(l.qty) > 0; }).map(function (l) { return { materialId: l.materialId, qty: Number(l.qty), price: Number(l.price) }; });
      var due = new Date(prDue(lines, cat) + "T00:00:00"), fresh = lines.some(function (l) { var m = cat.materials.filter(function (x) { return x.id === l.materialId; })[0]; return m && m.store === "Cold room"; });
      due.setHours(fresh ? 6 : 11, 0, 0, 0);
      var po = FB_PRODUCTION.write(function (D) {
        var x = D.raisePO({ supplierId: g.sup, lines: lines, expectedAt: due.toISOString(), status: "Pending Approval", by: who, via: "office", where: "Production Plan",
          comments: "For today's Production and Purchase Plan" });
        return { id: x.id, no: x.number, amount: x.amount };
      });
      var sup = cat.suppliers.filter(function (s) { return s.id === g.sup; })[0];
      lines.forEach(function (l) { delete S.puSel[l.materialId]; });
      g.lines = [];
    });
    S.pr = null;
  }


  /* ── Batches from the plan (owner, 3 Oct 2026: "same pattern as the purchase
     order") ─────────────────────────────────────────────────────────────
     Tick the lines (or none, for all still to produce), Create batches, and a
     sheet opens like the purchase order's: Finished Goods by product — a band
     with the batch size and supervisor, a row per pack, the packs to type —
     and Semi Finished a row per cut, its kg to type. Create batches makes one
     finished batch per product (its packs packed in the run) and one cutting
     batch per cut, planned for today, not on a shift yet. A line's To produce
     opens the sheet with that line alone. */
  var SUPS = null;
  var free = function (D, id) { return Math.max(0, D.onHand(id) - D.reserved(id)); };
  function pbLines(p, tab) { return tab === "fg" ? [].concat.apply([], p.fg.map(function (g) { return g.packs; })) : p.semi; }
  function pbOpen(p, tab) { return pbLines(p, tab).filter(function (l) { return l.toProduce > 0; }); }
  function pbBar(p, tab) {
    var open = pbOpen(p, tab), picked = open.filter(function (l) { return S.pbSel[l.key]; });
    var kg = open.reduce(function (t, l) { return t + l.toProduce * (tab === "fg" ? l.kg : 1); }, 0);
    return '<div class="pp-bar"><div class="pp-bar-t">' + (open.length ? "<b>" + open.length + " to produce</b> · " + n(kg) + " kg" : '<b class="pp-ok-t">Everything is approved for production</b>') + "</div>" +
      (S.pb || !open.length ? "" : '<button type="button" class="btn primary" data-pb-open>' + (picked.length ? "Approve the " + picked.length + " selected" : "Approve for production") + "</button>") + "</div>";
  }
  /* open the sheet: the ticked lines, or everything still to produce */
  function pbStart(p, tab) {
    var ticked = pbOpen(p, tab).filter(function (l) { return S.pbSel[l.key]; });
    var pool = (ticked.length ? ticked : pbOpen(p, tab)).map(function (l) { return l.key; });
    S.pb = FB_PRODUCTION.read(function (D, d) {
      SUPS = d.operators.map(function (o) { return o.name; });
      if (tab === "fg") {
        return { tab: "fg", err: "", groups: p.fg.map(function (g) {
          var bk = D.book(g.recipeId), comps = bk.ingredients.filter(function (i) { return i.sfId; }), tot = comps.reduce(function (t, i) { return t + i.qty; }, 0);
          var pack = function (l) {
            var sk = D.sku(l.skuId), pm = D.material(sk.pouchId);
            return { key: l.key, skuId: sk.id, name: sk.name, grams: sk.grams, perCarton: sk.perCarton, qty: l.toProduce > 0 ? l.toProduce : sk.perCarton, pouch: pm ? { name: pm.name, have: free(D, pm.id) } : null };
          };
          var rows = g.packs.filter(function (l) { return pool.indexOf(l.key) !== -1; }).map(pack);
          if (!rows.length) return null;
          return { recipeId: g.recipeId, name: g.name, version: g.version, loss: bk.loss, sup: "Suresh Kumar", rows: rows, cartonsHave: free(D, "rm-k11"),
            spare: g.packs.map(pack),
            needs: comps.map(function (i) { return { name: D.book(i.sfId).name, share: i.qty / tot, have: D.inFreezer(i.sfId), unit: "kg" }; })
              .concat(bk.ingredients.filter(function (i) { return i.rmId; }).map(function (i) { var m = D.material(i.rmId); return { name: m.name, per: i.qty / bk.base, have: free(D, m.id), unit: m.unit }; })) };
        }).filter(Boolean) };
      }
      var cut = function (l) {
        var sb = D.book(l.id), fill = ((d.workflows.filter(function (w) { return w.recipeId === sb.id; })[0] || {}).steps || []).filter(function (s) { return s.bags; }).pop() || {};
        return { key: l.key, id: l.id, name: l.name, cut: l.cut, qty: l.toProduce > 0 ? l.toProduce : (fill.bags || 50), sup: "Priya Sharma", bag: fill.bags || 50,
          raw: sb.ingredients.filter(function (i) { return i.rmId; }).map(function (i) { var m = D.material(i.rmId); return { name: m.name, per: i.qty / sb.base, have: free(D, m.id), unit: m.unit }; }) };
      };
      return { tab: "sf", err: "", groups: [{ rows: p.semi.filter(function (l) { return pool.indexOf(l.key) !== -1; }).map(cut), spare: p.semi.map(cut) }] };
    });
  }
  /* a finished batch's size: its packs' kg over the mix's loss, to the next 10 kg */
  function pbSize(g) {
    var kg = g.rows.reduce(function (t, r) { return t + (Number(r.qty) || 0) * r.grams / 1000; }, 0);
    return kg > 0 ? Math.ceil(kg / (1 - ((g.loss || 0.5) + 0.5) / 100) / 10) * 10 : 0;
  }
  function pbCount() { return S.pb.groups.reduce(function (t, g) { return t + (S.pb.tab === "fg" ? (pbSize(g) ? 1 : 0) : g.rows.filter(function (r) { return Number(r.qty) > 0; }).length); }, 0); }
  function pbKg() { return S.pb.groups.reduce(function (t, g) { return t + (S.pb.tab === "fg" ? pbSize(g) : g.rows.reduce(function (s, r) { return s + (Number(r.qty) || 0); }, 0)); }, 0); }
  function pbFoot() { var c = pbCount(); return "<span>" + c + " batch" + (c === 1 ? "" : "es") + " to approve</span> <b>" + n(pbKg()) + " kg</b>"; }
  var supOpts = function (cur) { return (SUPS || []).map(function (nm) { return "<option" + (nm === cur ? " selected" : "") + ">" + esc(nm) + "</option>"; }).join(""); };
  /* the sheet, cut to what is decided (owner, 3 Oct 2026: "too much clutter"): Finished — a
     band per product (name, supervisor, batch size), a row per pack (packs to type, weight);
     Semi Finished — a row per cut (kg to type, bags, supervisor) */
  function pbPanel() {
    var pb = S.pb, rn = 0, fg = pb.tab === "fg", body;
    var x = function (attr, label) { return '<td class="xl-x"><button type="button" class="pp-x" ' + attr + ' aria-label="' + esc(label) + '" title="' + esc(label) + '">×</button></td>'; };
    if (fg) {
      body = pb.groups.map(function (g, gi) {
        var have = g.rows.map(function (r) { return r.skuId; }), spare = g.spare.filter(function (r) { return have.indexOf(r.skuId) === -1; });
        return '<tr class="xl-band"><td class="xl-n"></td><td><b>' + esc(g.name) + "</b>" +
            '<label class="xl-who">Supervisor <select data-pb-gsup="' + gi + '" aria-label="Supervisor of the ' + esc(g.name) + ' batch">' + supOpts(g.sup) + "</select></label></td>" +
          '<td colspan="2" class="xl-num xl-sub" data-pb-size="' + gi + '">Batch ' + n(pbSize(g)) + " kg</td>" + x('data-pb-grm="' + gi + '"', "Leave out " + g.name) + "</tr>" +
          g.rows.map(function (r, i) {
            var k = gi + ":" + i; rn++;
            return '<tr><td class="xl-n">' + rn + '</td><td class="xl-p">' + esc(r.name) + "</td>" +
              '<td class="xl-c"><input type="number" min="0" step="1" inputmode="numeric" data-pbq="' + k + '" value="' + esc(r.qty) + '" aria-label="Packs of ' + esc(r.name) + '"></td>' +
              '<td class="xl-num xl-amt" data-pbkg="' + k + '">' + n((Number(r.qty) || 0) * r.grams / 1000) + "</td>" + x('data-pb-rm="' + k + '"', "Remove " + r.name) + "</tr>";
          }).join("") +
          (spare.length ? '<tr class="xl-add"><td class="xl-n">+</td><td class="xl-c xl-s"><select class="xl-addsel" data-pb-add="' + gi + '" aria-label="Add a pack"><option value="">Add a pack…</option>' +
            spare.map(function (r) { return '<option value="' + esc(r.skuId) + '">' + esc(r.name) + "</option>"; }).join("") + '</select></td><td></td><td></td><td class="xl-x"></td></tr>' : "");
      }).join("");
    } else {
      var g = pb.groups[0], have = g.rows.map(function (r) { return r.id; }), spare = g.spare.filter(function (r) { return have.indexOf(r.id) === -1; });
      body = g.rows.map(function (r, i) {
        var k = "0:" + i; rn++;
        return '<tr><td class="xl-n">' + rn + '</td><td class="xl-p">' + esc(r.name) + "</td>" +
          '<td class="xl-c"><input type="number" min="0" step="1" inputmode="numeric" data-pbq="' + k + '" value="' + esc(r.qty) + '" aria-label="Kg of ' + esc(r.name) + '"></td>' +
          '<td class="xl-num" data-pbbag="' + k + '">' + n(Math.ceil((Number(r.qty) || 0) / r.bag)) + "</td>" +
          '<td class="xl-c xl-selc"><select data-pb-rsup="' + k + '" aria-label="Supervisor of ' + esc(r.name) + '">' + supOpts(r.sup) + "</select></td>" + x('data-pb-rm="' + k + '"', "Remove " + r.name) + "</tr>";
      }).join("") +
        (spare.length ? '<tr class="xl-add"><td class="xl-n">+</td><td class="xl-c xl-s"><select class="xl-addsel" data-pb-add="0" aria-label="Add a cut"><option value="">Add a cut…</option>' +
          spare.map(function (r) { return '<option value="' + esc(r.id) + '">' + esc(r.name) + "</option>"; }).join("") + '</select></td><td></td><td></td><td></td><td class="xl-x"></td></tr>' : "");
    }
    var pen = '<svg class="xl-pen" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
    var head = fg
      ? '<colgroup><col class="c-n"><col><col style="width:150px"><col style="width:150px"><col class="c-x"></colgroup>' +
        '<thead><tr><th class="xl-n"></th><th>Pack</th><th class="xl-num xl-edh">' + pen + ' Packs</th><th class="xl-num">Weight (kg)</th><th></th></tr></thead>'
      : '<colgroup><col class="c-n"><col><col style="width:150px"><col style="width:90px"><col style="width:170px"><col class="c-x"></colgroup>' +
        '<thead><tr><th class="xl-n"></th><th>Cut</th><th class="xl-num xl-edh">' + pen + ' Batch (kg)</th><th class="xl-num">Bags</th><th class="xl-edh">' + pen + " Supervisor</th><th></th></tr></thead>";
    return '<div class="xl-back"><div class="xl-modal xl-narrow" role="dialog" aria-modal="true" aria-label="Approve for production">' +
      '<header class="xl-h"><b>Approve for production</b><span>planned for today</span>' +
        '<button type="button" class="pp-x" data-pb-close aria-label="Close">×</button></header>' +
      '<div class="xl-body"><table class="xl">' + head + "<tbody>" + (body || '<tr><td class="xl-n"></td><td colspan="4" class="pp-muted">Nothing on this sheet.</td></tr>') + "</tbody></table></div>" +
      pbFootHtml() + "</div></div>";
  }
  /* the footer, and its inline confirmation: Approve for production asks once, in place */
  function pbFootHtml() {
    var pb = S.pb;
    if (pb.ask) {
      var c = pbCount(), names = pb.tab === "fg"
        ? pb.groups.filter(function (g) { return pbSize(g); }).map(function (g) { return g.name + " " + n(pbSize(g)) + " kg"; })
        : [].concat.apply([], pb.groups.map(function (g) { return g.rows.filter(function (r) { return Number(r.qty) > 0; }).map(function (r) { return r.name + " " + n(Number(r.qty)) + " kg"; }); }));
      return '<footer class="xl-f xl-ask" role="alertdialog" aria-label="Confirm approval">' +
        '<p class="xl-q"><b>Approve ' + c + " batch" + (c === 1 ? "" : "es") + " · " + n(pbKg()) + " kg for today?</b>" +
          "<span>" + esc(names.join(", ")) + "</span></p>" +
        '<button type="button" class="btn" data-pb-back>Back</button>' +
        '<button type="button" class="btn primary" data-pb-yes>Yes, approve</button></footer>';
    }
    return '<footer class="xl-f">' + (pb.err ? '<p class="pp-pc-err">' + esc(pb.err) + "</p>" : "") +
      '<span class="po-tot" data-pbtot>' + pbFoot() + "</span>" +
      '<button type="button" class="btn" data-pb-close>Cancel</button>' +
      '<button type="button" class="btn primary" data-pb-go' + (pbCount() ? "" : " disabled") + ">Approve for production</button></footer>";
  }
  /* an edit while the footer is asking takes the question back: the figures it named have moved */
  function unask(o, html) {
    if (!o || !o.ask) return;
    o.ask = false;
    var f = app.querySelector(".xl-f");
    if (f) f.outerHTML = html();
  }
  /* create: one finished batch per product, one cutting batch per cut */
  function pbGo() {
    var pb = S.pb, who = planWho(), today = isoDay(Date.now()), made = [];
    if (!pbCount()) throw new Error("Put a quantity on at least one row.");
    FB_PRODUCTION.write(function (D) {
      pb.groups.forEach(function (g) {
        if (pb.tab === "fg") {
          var size = pbSize(g), rows = g.rows.filter(function (r) { return Number(r.qty) > 0; });
          if (!size) return;
          var b = D.createProductionOrder({ recipeId: g.recipeId, batchSize: size, plannedDate: today, expectedFinishDate: today, supervisor: g.sup, actor: who, where: "Production Plan",
            packs: rows.map(function (r) { return { skuId: r.skuId, qty: Math.round(Number(r.qty)) }; }) }).batch;
          made.push({ id: b.id, no: b.batchNumber, name: g.name, kg: size, keys: rows.map(function (r) { return r.key; }) });
        } else {
          g.rows.filter(function (r) { return Number(r.qty) > 0; }).forEach(function (r) {
            var c = D.createProductionOrder({ recipeId: r.id, batchSize: Math.round(Number(r.qty)), plannedDate: today, expectedFinishDate: today, supervisor: r.sup, actor: who, where: "Production Plan" }).batch;
            made.push({ id: c.id, no: c.batchNumber, name: r.name, kg: Math.round(Number(r.qty)), keys: [r.key] });
          });
        }
      });
    });
    made.forEach(function (x) { x.keys.forEach(function (k) { delete S.pbSel[k]; }); });
    S.pb = null;
  }
  /* a pencil's save: the standing figures go to the store */
  function editSave() {
    var inp = app.querySelector("[data-edit-in]");
    if (!inp) { S.edit = null; return true; }
    var key = inp.getAttribute("data-edit-in"), kind = key.slice(0, key.indexOf(":")), rest = key.slice(key.indexOf(":") + 1), v = inp.value === "" ? 0 : Number(inp.value), who = planWho();
    try {
      if (!isFinite(v) || v < 0) throw new Error("Enter a number, 0 or more");
      FB_PRODUCTION.write(function (D) {
        var o = { actor: who };
        if (kind === "msq") D.setPackMsq(rest, v, o);
        else if (kind === "smsq") D.setRecipeMsq(rest, v, o);
        else if (kind === "pmsq") D.setMaterialMsq(rest, v, o);
        else if (kind === "waste") D.setWastage(rest, v, o);
        else if (kind === "share") D.setRecipeShare(rest.split(":")[0], rest.split(":")[1], v, o);
        else if (kind === "carton") D.setCartonKg(v, o);
      });
      S.edit = null;
    } catch (err) { inp.classList.add("is-bad"); inp.title = (err && err.body && err.body.error) || err.message || ""; inp.focus(); return false; }
    return true;
  }
  app.addEventListener("keydown", function (e) {
    if (!e.target.getAttribute || !e.target.getAttribute("data-edit-in")) return;
    if (e.key === "Enter") { e.preventDefault(); if (editSave()) render(); }
    else if (e.key === "Escape") { e.stopPropagation(); S.edit = null; render(); }
  });

  /* the form's fields: kept as they are typed; only the figures around them move */
  function prKey(t, attr) { var k = t.getAttribute(attr).split(":"); return { g: S.pr.groups[+k[0]], gi: +k[0], i: +k[1] }; }
  app.addEventListener("input", function (e) {
    if (!S.pr) return;
    var t = e.target, k;
    if (t.hasAttribute("data-prs")) {
      var gi = +t.getAttribute("data-prs"), box = app.querySelector('[data-prsl="' + gi + '"]');
      if (box) { box.innerHTML = prSearchHtml(gi, prSearch(gi, t.value), t.value); box.hidden = false; }
      return;
    }
    if (t.hasAttribute("data-prq") || t.hasAttribute("data-prr")) unask(S.pr, function () { return prFootHtml(prCatalogue()); });
    if (t.hasAttribute("data-prq")) { k = prKey(t, "data-prq"); k.g.lines[k.i].qty = t.value; }
    else if (t.hasAttribute("data-prr")) { k = prKey(t, "data-prr"); k.g.lines[k.i].price = t.value; }
    else return;
    var l = k.g.lines[k.i], cat = prCatalogue();
    var amt = app.querySelector('[data-pramt="' + k.gi + ":" + k.i + '"]'), gt = app.querySelector('[data-pr-gt="' + k.gi + '"]'), tot = app.querySelector("[data-prtot]");
    if (amt) amt.textContent = n((Number(l.qty) || 0) * (Number(l.price) || 0));
    if (gt) gt.innerHTML = prGroupTot(prTotals(cat, k.g));
    if (tot) tot.textContent = rupee(prGrand(cat));
  });
  /* the search opens its list on focus, closes when left */
  function prHideLists(except) { [].forEach.call(app.querySelectorAll("[data-prsl]"), function (b) { if (b !== except) b.hidden = true; }); }
  function prOpenList(e) {
    if (S.pr && e.type === "click" && !e.target.closest(".xl-s")) prHideLists();
    if (!S.pr || !e.target.hasAttribute || !e.target.hasAttribute("data-prs")) return;
    var gi = +e.target.getAttribute("data-prs"), box = app.querySelector('[data-prsl="' + gi + '"]');
    if (box) { prHideLists(box); box.innerHTML = prSearchHtml(gi, prSearch(gi, e.target.value), e.target.value); box.hidden = false; }
  }
  app.addEventListener("focusin", prOpenList);
  app.addEventListener("click", prOpenList);
  app.addEventListener("focusout", function (e) {
    if (!e.target.hasAttribute || !e.target.hasAttribute("data-prs")) return;
    var box = app.querySelector('[data-prsl="' + e.target.getAttribute("data-prs") + '"]');
    setTimeout(function () { if (box && !box.contains(document.activeElement)) box.hidden = true; }, 150);
  });
  app.addEventListener("keydown", function (e) {
    if (!S.pr || !e.target.hasAttribute || !e.target.hasAttribute("data-prs")) return;
    var gi = +e.target.getAttribute("data-prs");
    if (e.key === "Enter") { e.preventDefault(); var first = prSearch(gi, e.target.value)[0]; if (first) prPick(gi, first.id); }
    else if (e.key === "Escape") { e.target.value = ""; prHideLists(); e.target.blur(); }
  });
  /* the batch sheet's cells: kept as typed; the figures around them move */
  function pbKey(t, attr) { var k = t.getAttribute(attr).split(":"); return { gi: +k[0], i: +k[1], g: S.pb.groups[+k[0]] }; }
  app.addEventListener("input", function (e) {
    var t = e.target;
    if (!S.pb || !t.hasAttribute || !t.hasAttribute("data-pbq")) return;
    unask(S.pb, pbFootHtml);
    var k = pbKey(t, "data-pbq"), r = k.g.rows[k.i], id = k.gi + ":" + k.i, q0 = Number(t.value) || 0;
    r.qty = t.value;
    var set = function (sel, html) { var el = app.querySelector(sel); if (el) el.innerHTML = html; };
    if (S.pb.tab === "fg") {
      set('[data-pbkg="' + id + '"]', n(q0 * r.grams / 1000));
      set('[data-pb-size="' + k.gi + '"]', "Batch " + n(pbSize(k.g)) + " kg");
    } else {
      set('[data-pbbag="' + id + '"]', n(Math.ceil(q0 / r.bag)));
    }
    set("[data-pbtot]", pbFoot());
    var go = app.querySelector("[data-pb-go]"); if (go) go.disabled = !pbCount();
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (!S.pb || !t.hasAttribute) return;
    if (t.hasAttribute("data-pb-gsup")) { S.pb.groups[+t.getAttribute("data-pb-gsup")].sup = t.value; return; }
    if (t.hasAttribute("data-pb-rsup")) { var k = pbKey(t, "data-pb-rsup"); k.g.rows[k.i].sup = t.value; return; }
    if (t.hasAttribute("data-pb-add") && t.value) {
      var g = S.pb.groups[+t.getAttribute("data-pb-add")], r = g.spare.filter(function (x) { return (x.skuId || x.id) === t.value; })[0];
      if (r) g.rows.push(Object.assign({}, r));
      render();
      var inp = app.querySelector('[data-pbq="' + t.getAttribute("data-pb-add") + ":" + (g.rows.length - 1) + '"]');
      if (inp) { inp.focus(); inp.select(); }
    }
  });
  /* the sheet's keys: Enter or ↓ down the column, ↑ up; Esc closes */
  app.addEventListener("keydown", function (e) {
    if (!S.pr && !S.pb) return;
    var t = e.target, col = t.hasAttribute && (t.hasAttribute("data-prq") ? "data-prq" : t.hasAttribute("data-prr") ? "data-prr" : t.hasAttribute("data-pbq") ? "data-pbq" : "");
    if (col && (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      var all = [].slice.call(app.querySelectorAll("[" + col + "]")), at = all.indexOf(t) + (e.key === "ArrowUp" ? -1 : 1);
      if (all[at]) { all[at].focus(); all[at].select(); } else if (e.key !== "ArrowUp") t.blur();
      return;
    }
    if (e.key === "Escape" && ((S.pr && S.pr.ask) || (S.pb && S.pb.ask))) { if (S.pr) S.pr.ask = false; if (S.pb) S.pb.ask = false; render(); return; }
    if (e.key === "Escape" && !(t.hasAttribute && t.hasAttribute("data-prs"))) { S.pr = null; S.pb = null; render(); }
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (!S.pr || !t.hasAttribute || !t.hasAttribute("data-pr-gsup")) return;
    S.pr.groups[+t.getAttribute("data-pr-gsup")].sup = t.value;
    render();
  });

  /* touching the sheet while the footer asks takes the question back */
  function unaskAll() {
    if (S.pb) unask(S.pb, pbFootHtml);
    if (S.pr) unask(S.pr, function () { return prFootHtml(prCatalogue()); });
  }
  app.addEventListener("change", function (e) { if (e.target.closest && e.target.closest(".xl-body")) unaskAll(); }, true);
  /* the question takes the footer; Enter says yes, Esc goes back */
  function askFocus() { render(); var y = app.querySelector("[data-pb-yes],[data-pr-yes]"); if (y) y.focus(); }

  /* ── render ────────────────────────────────────────────────────────── */
  function render() {
    var m = model(), w = S.lens === "week" ? weekModel() : weekModel(isoDay(Date.now()), 1);
    var needN = m.alerts.length + (m.buys.length ? 1 : 0);
    if (tabs) {
      tabs.set(S.lens);
      tabs.count("needs", needN);
      /* All shifts' one link sits on the date's row (owner, 29 Sep 2026) */
      tabs.action(S.lens === "week" ? { label: "Shift settings", icon: "settings", quiet: true, onClick: function () { S.panel = { kind: "settings", edit: null }; S.form = {}; S.err = ""; render(); } } : null);
    }
    var xlb = app.querySelector(".xl-body"), xlTop = xlb ? xlb.scrollTop : 0;
    app.innerHTML =
      (S.lens === "needs" ? Needs(m)
        : S.lens === "flow" ? Plan(planModel())
        : Roster(w)) +
      (S.panel ? (S.panel.kind === "settings" ? Settings(w) : ShiftPanel(w)) : "");
    /* the order sheet is a modal: the page behind stays put, the sheet keeps its scroll */
    document.documentElement.classList.toggle("xl-lock", !!app.querySelector(".xl-back"));
    if (xlTop && app.querySelector(".xl-body")) app.querySelector(".xl-body").scrollTop = xlTop;
  }

  /* ── the page only navigates: batches start and are made in Batches ── */
  app.addEventListener("click", function (e) {
    var bt = e.target.closest("[data-batch]");
    if (bt) { go("production/batch-management?batch=" + encodeURIComponent(bt.getAttribute("data-batch"))); return; }
    var cr = e.target.closest("[data-create]");
    if (cr) { go("production/batch-management?create=" + encodeURIComponent(cr.getAttribute("data-create")) + "&size=" + encodeURIComponent(cr.getAttribute("data-size"))); return; }
    var gl = e.target.closest("[data-go]");
    if (gl) { go(gl.getAttribute("data-go")); return; }
    var sh = e.target.closest("[data-shift]");
    if (sh) { S.panel = { kind: "shift", key: sh.getAttribute("data-shift") }; S.form = {}; S.ask = null; S.rm = null; S.add = null; S.err = ""; render(); return; }
    var pt = e.target.closest("[data-ptab]");
    if (pt) { S.plan = pt.getAttribute("data-ptab"); try { sessionStorage.setItem("fb.v7.flow.plantab", S.plan); } catch (e2) { /* this visit only */ } render(); return; }
    /* purchase requests: the boxes, the builder, and the orders behind a figure */
    var t0 = e.target;
    if (t0.closest(".xl-body")) unaskAll();
    var me = t0.closest("[data-edit]");
    if (me) { S.edit = me.getAttribute("data-edit"); render(); var mi = app.querySelector("[data-edit-in]"); if (mi) { mi.focus(); mi.select(); } return; }
    if (t0.closest("[data-edit-save]")) { if (editSave()) render(); return; }
    if (t0.closest("[data-edit-cancel]")) { S.edit = null; render(); return; }
    if (t0.closest("[data-pb-open]")) { pbStart(planModel(), S.plan); render(); return; }
    if (t0.closest("[data-pb-close]")) { S.pb = null; render(); return; }
    var pbr = t0.closest("[data-pb-rm]");
    if (pbr && S.pb) { var rk2 = pbKey(pbr, "data-pb-rm"); rk2.g.rows.splice(rk2.i, 1); render(); return; }
    var pbg = t0.closest("[data-pb-grm]");
    if (pbg && S.pb) { S.pb.groups.splice(+pbg.getAttribute("data-pb-grm"), 1); render(); return; }
    if (t0.closest("[data-pb-go]") && S.pb) { if (pbCount()) { S.pb.ask = true; S.pb.err = ""; } askFocus(); return; }
    if (t0.closest("[data-pb-back]") && S.pb) { S.pb.ask = false; render(); return; }
    if (t0.closest("[data-pb-yes]") && S.pb) {
      try { pbGo(); } catch (err) { if (S.pb) { S.pb.ask = false; S.pb.err = (err && err.body && err.body.error) || err.message || "That didn't go through."; } }
      render(); return;
    }
    if (t0.closest("[data-pr-open]")) { prStart(planModel()); if (!S.pr.groups.length) S.pr.groups.push({ sup: (prCatalogue().suppliers[0] || {}).id, lines: [] }); render(); return; }
    if (t0.closest("[data-pr-close]")) { S.pr = null; render(); return; }
    var pick = t0.closest("[data-pr-pick]");
    if (pick && S.pr) { var pk2 = pick.getAttribute("data-pr-pick"), cut = pk2.indexOf(":"); prPick(+pk2.slice(0, cut), pk2.slice(cut + 1)); return; }
    var rm = t0.closest("[data-pr-rm]");
    if (rm && S.pr) { var rk = prKey(rm, "data-pr-rm"); rk.g.lines.splice(rk.i, 1); render(); return; }
    var grm = t0.closest("[data-pr-grm]");
    if (grm && S.pr) { S.pr.groups.splice(+grm.getAttribute("data-pr-grm"), 1); render(); return; }
    if (t0.closest("[data-pr-gadd]") && S.pr) {
      var usedS = S.pr.groups.map(function (g) { return g.sup; }), free = prCatalogue().suppliers.filter(function (s2) { return usedS.indexOf(s2.id) === -1; })[0];
      if (free) S.pr.groups.push({ sup: free.id, lines: [] });
      render();
      var sel = app.querySelector('[data-pr-gsup="' + (S.pr.groups.length - 1) + '"]');
      if (sel) sel.focus();
      return;
    }
    if (t0.closest("[data-pr-go]") && S.pr) { if (prLive().length) { S.pr.ask = true; S.pr.err = ""; } askFocus(); return; }
    if (t0.closest("[data-pr-back]") && S.pr) { S.pr.ask = false; render(); return; }
    if (t0.closest("[data-pr-yes]") && S.pr) {
      try { prRaise(); } catch (err) { if (S.pr) { S.pr.ask = false; S.pr.err = (err && err.body && err.body.error) || err.message || "That didn't go through."; } }
      render(); return;
    }
    var b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    var act = b.getAttribute("data-act");
    if (act === "lens") { S.lens = b.getAttribute("data-lens"); S.panel = null; S.err = ""; window.scrollTo(0, 0); }
    else if (act === "settings") { S.panel = { kind: "settings", edit: null }; S.form = {}; S.err = ""; }
    else if (act === "xp") { var xid = b.getAttribute("data-id"); if (S.open[xid]) delete S.open[xid]; else S.open[xid] = true; }
    else if (act === "close") { S.panel = null; S.ask = null; S.rm = null; S.add = null; S.form = {}; S.err = ""; }
    else if (S.panel) panelAct(act, b);
    render();
  });
  app.addEventListener("input", function (e) {
    var f = e.target.getAttribute("data-f");
    if (!f) return;
    S.form[f] = e.target.value;
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    var f = t.getAttribute("data-f");
    if (f && f !== "text" && f !== "name") { S.form[f] = t.value; render(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && S.panel) { S.panel = null; S.ask = null; S.rm = null; S.add = null; S.form = {}; S.err = ""; render(); }
  });

  /* the floor moves while the office watches */
  window.addEventListener("storage", function (e) { if (e.key === FB_PRODUCTION.KEY && !S.panel) render(); });
  setInterval(function () { if (document.visibilityState === "visible" && !S.panel && !(document.activeElement && /^(SELECT|INPUT)$/.test(document.activeElement.tagName))) render(); }, 30000);
  render();
})();

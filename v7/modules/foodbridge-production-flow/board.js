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
  var S = { lens: "flow", dept: "sales", open: {}, from: null, panel: null, form: {}, ask: null, rm: null, add: null, err: "" };
  try { S.dept = sessionStorage.getItem("fb.v7.flow.dept") || "sales"; } catch (e) { /* a private window: start on Sales */ }
  /* All shifts is the next 7 days from today (owner, 29 Sep 2026: no week to page through) */
  S.from = isoDay(Date.now());
  /* #/production/production-board?view=week opens the Week (Batch detail's "Week ›") */
  function fromHash() {
    try {
      if (window.parent === window) return false;
      var h = window.parent.location.hash, q = h.indexOf("?") === -1 ? "" : h.slice(h.indexOf("?") + 1);
      /* only an address for this page: ?batch=… on the way to Batches is Batches' to read */
      if (!q || !/^#\/?production\/production-board\?/.test(h)) return false;
      var v = new URLSearchParams(q).get("view");
      S.lens = VIEWS.indexOf(v) !== -1 ? v : "flow";
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


  /* ── the plan: sell, make, buy ─────────────────────────────────────── */


  /* ── Flow: sales → production → purchase (29 Sep 2026, owner) ─────────
     Only what stops a customer packet, in packets: left, the packs with a
     gap (of their demand: orders in hand + next week) and what holds each;
     right, the materials whose purchase frees them, and how many packets.
     A booked batch the store cannot cover is found by walking the store
     forward (on hand, less each booked batch's remaining need at its
     shift's start, plus each open order on its day; an overdue, undated or
     unapproved order has not come).                                       */
  function flowModel() {
    return FB_PRODUCTION.read(function (D, d) {
      var plan = D.plan(), pat = D.pattern(), now = Date.now();
      function at(w, edge) {
        var x = w && pat.slots[w.slot];
        if (!x) return null;
        var t = new Date(w.date + "T00:00:00");
        if (edge === "end" && x.end <= x.start) t.setDate(t.getDate() + 1);
        t.setHours(edge === "end" ? x.end : x.start, 0, 0, 0);
        return t.getTime();
      }
      var open = d.batches.filter(function (b) { return ["planned", "in-progress", "on-hold"].indexOf(b.stateId) !== -1; });
      function timing(list) {
        var ends = list.map(function (b) { return at(b.when, "end"); });
        return { eta: ends.length && ends.indexOf(null) === -1 ? Math.max.apply(null, ends) : null, noShift: ends.filter(function (e) { return e === null; }).length,
          late: list.filter(function (b, i) { return b.stateId !== "planned" && ends[i] !== null && ends[i] < now; }).length };
      }
      var bookName = {};
      plan.products.forEach(function (p) { bookName[p.recipeId] = p.name; });

      /* purchase first: it tells production whether its material is in */
      var blocked = {};            /* recipeId → its booked batches the store cannot cover */
      var matOf = {};
      plan.materials.forEach(function (m) { matOf[m.id] = m; });
      var shortFor = {};           /* recipeId → [{ name, qty, unit, t }] for its booked batches */
      var buy = plan.materials.map(function (m) {
        var mat = D.material(m.id), ev = [];
        open.forEach(function (b) {
          if (b.kind !== "production") return;
          (b.ingredientSummary || []).forEach(function (r) {
            var left = Math.max(0, r.recommendedQty - r.netConsumed);
            if (r.ingredientId === m.id && left > 0) ev.push({ t: b.stateId === "planned" ? at(b.when, "start") : now, q: -left, b: b });
          });
        });
        var arrives = null, overdue = false, pending = 0;
        (d.purchaseOrders || []).forEach(function (p) {
          var q = D.openOnPO(p, m.id);
          if (!(q > 0)) return;
          if (p.status === "Pending Approval") pending += q;
          /* an order with no day (or still waiting for approval) comes after every batch with a shift */
          if (!p.expectedAt || p.status === "Pending Approval") { ev.push({ t: null, q: q }); return; }
          var due = new Date(p.expectedAt).getTime();
          if (due < now) overdue = true;
          ev.push({ t: Math.max(due, now + 1), q: q });
          arrives = arrives === null ? due : Math.min(arrives, due);
        });
        ev.sort(function (a, b) { return (a.t === null ? Infinity : a.t) - (b.t === null ? Infinity : b.t) || b.q - a.q; });
        var stock = m.onHand, by = null, forR = [];
        ev.forEach(function (e) {
          stock += e.q;
          if (e.q < 0 && stock < -0.001 && e.b) {
            var short = r2(Math.min(-stock, -e.q));
            (shortFor[e.b.recipeId] = shortFor[e.b.recipeId] || []).push({ id: m.id, name: m.name, qty: short, unit: m.unit, t: e.t });
            var bl = (blocked[e.b.recipeId] = blocked[e.b.recipeId] || []);
            if (bl.indexOf(e.b) === -1) bl.push(e.b);
            if (forR.indexOf(e.b.recipeId) === -1) forR.push(e.b.recipeId);
            if (by === null) by = { t: e.t, recipeId: e.b.recipeId };
          }
        });
        var free = r2(m.onHand - m.reserved), low = mat.threshold && free < mat.threshold;
        var order = m.buy > 0 ? m.buy : low ? r2(Math.max(0, mat.threshold - free - m.ordered)) : 0;
        /* by: a booked batch with a shift runs short; noShift: one with no shift yet; new: only batches still to plan */
        var status = m.buy > 0 ? (by && by.t !== null ? "by" : by ? "noShift" : "new") : by && by.t !== null ? "late" : order > 0 ? "low" : null;
        /* on order in time for what production needs: Purchase still sees it, as on the way */
        if (!status && m.ordered > 0 && m.need > 0) status = "onOrder";
        if (!status) return null;
        /* for what: every product whose batch runs short, and the products still to plan that use it */
        if (m.buy > 0) plan.products.forEach(function (p) {
          if (p.toMakeKg > 0 && forR.indexOf(p.recipeId) === -1 && D.book(p.recipeId).ingredients.some(function (i) { return i.rmId === m.id; })) forR.push(p.recipeId);
        });
        /* a pouch is for the packs short that it fills */
        if (m.buy > 0) plan.skus.forEach(function (k) { if (k.shortPackets > 0 && D.sku(k.skuId).pouchId === m.id && forR.indexOf(k.recipeId) === -1) forR.push(k.recipeId); });
        var forWhat = status === "low" ? "Minimum " + (m.unit === "kg" ? n(mat.threshold, 10) + " kg" : n(mat.threshold) + " " + m.unit) : forR.map(function (r) { return bookName[r]; }).filter(Boolean).join(", ");
        return { id: m.id, name: m.name, unit: m.unit, supplier: m.supplier, order: order, by: by, status: status, forWhat: forWhat,
          onHand: m.onHand, reserved: m.reserved, ordered: m.ordered, arrives: arrives, overdue: overdue, pending: pending };
      }).filter(Boolean).sort(function (a, b) {
        var rank = { by: 0, late: 1, noShift: 2, new: 3, low: 4, onOrder: 5 };
        return rank[a.status] - rank[b.status] || (a.by && b.by ? a.by.t - b.by.t : 0) || b.order - a.order;
      });

      /* Only what stops a customer packet (owner, 29 Sep 2026: "too much waste
         data"). Per product (recipe, in kg), the packets still to come are
         covered in this order: the freezer, then batches whose material is in
         the store. What is left is the gap, and what holds it:
           a booked batch the store cannot cover  → held by that material
           nothing planned, material to buy first → held by that material
           nothing planned                        → "Not planned"
         Each pack gets its share of the gap by its packets short, at its own
         pack weight. A material counts only for the packets it would free.   */
      var rows = [], frees = {}, forWhom = {};
      plan.products.forEach(function (p) {
        var skus = plan.skus.filter(function (s) { return s.recipeId === p.recipeId && s.need > 0; });
        var kgOf = function (s) { return s.grams / 1000; };
        var own = function (s) { return Math.max(0, s.shortPackets - Math.min(s.packing, Math.max(0, s.need - s.packets))); };
        var rem = skus.reduce(function (t, s) { return t + own(s) * kgOf(s); }, 0);
        if (rem < 0.05) return;
        /* production, in the same kg as sales, split three ways that add up to it (owner: sales must see how
           much is being made, purchase where it is blocked):
             covered      the freezer, then batches whose material is in the store — with the ETA
             blocked      batches the store cannot cover, and what cannot be planned until a material comes
             not planned  the rest                                                                              */
        var t = timing(open.filter(function (b) { return b.kind === "production" && b.recipeId === p.recipeId; }));
        var blockedKg = Math.min(p.plannedKg, (blocked[p.recipeId] || []).reduce(function (t, b) { return t + b.batchSize; }, 0));
        var shortMats = (shortFor[p.recipeId] || []).map(function (w) { return w.id; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
        var bk = D.book(p.recipeId);
        var firstMats = buy.filter(function (b) { return (b.status === "new" || b.status === "noShift") && bk.ingredients.some(function (i) { return i.rmId === b.id; }); }).map(function (b) { return b.id; });
        var fz = Math.min(p.freezerKg, rem), okB = Math.min(Math.max(0, p.plannedKg - blockedKg), rem - fz), covered = fz + okB;
        var blkB = Math.min(blockedKg, rem - covered), unpl = rem - covered - blkB;
        var names = (blkB > 0.05 ? shortMats : []).concat(unpl > 0.05 && firstMats.length ? firstMats : []).filter(function (v, i, a) { return a.indexOf(v) === i; }).map(function (id) { return matOf[id].name; });
        rows.push({ recipeId: p.recipeId, name: p.name, needKg: r2(rem), mats: [],
          covered: r2(covered), eta: okB > 0.05 ? (t.late ? "late" : t.noShift ? "no shift yet" : when(t.eta)) : fz > 0.05 ? "in freezer" : null,
          blocked: r2(blkB + (firstMats.length ? unpl : 0)), blockedBy: names, notPlanned: r2(firstMats.length ? 0 : unpl),
          packs: skus.filter(function (s) { return own(s) > 0; }).sort(function (a, b) { return a.grams - b.grams; })
            .map(function (s) { return { size: s.grams < 1000 ? s.grams + " g" : s.grams / 1000 + " kg", count: own(s) }; }) });
        var row = rows[rows.length - 1];
        /* the gap — what production does not cover — feeds the purchase chit */
        var gapKg = rem - covered;
        if (gapKg < 0.05) return;
        var viaBlocked = blkB;
        var mats = row.mats;
        skus.forEach(function (s) {
          var share = own(s) * kgOf(s) / rem, gap = Math.round(gapKg * share / kgOf(s));
          if (gap < 1) return;
          var fromBlocked = Math.round(viaBlocked * share / kgOf(s)), fromNew = gap - fromBlocked;
          var m = (fromBlocked > 0 ? shortMats : []).concat(fromNew > 0 ? firstMats : []);
          buy.forEach(function (b) { if (D.sku(s.skuId).pouchId === b.id && (b.status === "new" || b.status === "noShift")) m.push(b.id); });
          m.forEach(function (id) {
            if (mats.indexOf(id) === -1) mats.push(id);
            frees[id] = (frees[id] || 0) + (shortMats.indexOf(id) !== -1 ? fromBlocked : 0) + (firstMats.indexOf(id) !== -1 || D.sku(s.skuId).pouchId === id ? fromNew : 0);
            (forWhom[id] = forWhom[id] || []).indexOf(p.name) === -1 && forWhom[id].push(p.name);
          });
        });
      });
      /* purchase: only the materials that free a customer packet, as a chit */
      var purchase = buy.filter(function (b) { return frees[b.id] > 0; }).map(function (b) {
        return { id: b.id, name: b.name, order: b.order, unit: b.unit, frees: frees[b.id], forWhom: forWhom[b.id] || [] };
      }).sort(function (a, b) { return b.frees - a.frees; });
      var rank = {};
      purchase.forEach(function (b, i) { rank[b.id] = i; });
      var rk = function (r) { return r.mats.length ? Math.min.apply(null, r.mats.map(function (id) { return id in rank ? rank[id] : 99; })) : 100; };
      /* the products production covers least first */
      rows.sort(function (a, b) { return (b.blocked + b.notPlanned) - (a.blocked + a.notPlanned) || rk(a) - rk(b); });

      /* ── the same chain, per department (owner, 29 Sep 2026: Sales | Production | Purchase) ──
         Each reads its own part in its own unit, and what it waits on from the others. */
      var rowOf = {};
      rows.forEach(function (r) { rowOf[r.recipeId] = r; });
      var size = function (g) { return g < 1000 ? g + " g" : g / 1000 + " kg"; };
      /* Sales, in packets: per pack, ordered + next week against what is packed */
      var sales = plan.products.map(function (p) {
        var packs = p.skus.filter(function (k) { return k.need > 0; }).sort(function (a, b) { return a.grams - b.grams; });
        if (!packs.length) return null;
        return { recipeId: p.recipeId, name: p.name, row: rowOf[p.recipeId] || null,
          packs: packs.map(function (k) { return { size: size(k.grams), open: k.open, forecast: k.forecast, stock: k.packets, packing: k.packing, short: k.shortPackets }; }) };
      }).filter(Boolean);
      /* Production, in kg: what Sales needs, what covers it (freezer, batches), what waits on Purchase */
      var making = plan.products.map(function (p) {
        var r = rowOf[p.recipeId];
        var mine = open.filter(function (b) { return b.kind === "production" && b.recipeId === p.recipeId; }).map(function (b) {
          return { id: b.id, no: b.batchNumber, kg: b.batchSize, state: b.stateId, start: b.when ? when(at(b.when, "start")) : null,
            held: (blocked[p.recipeId] || []).indexOf(b) !== -1 };
        });
        if (!r && !mine.length) return null;
        return { recipeId: p.recipeId, name: p.name, needKg: r ? r.needKg : 0, freezerKg: p.freezerKg, batches: mine, row: r, toMakeKg: p.toMakeKg };
      }).filter(Boolean);
      /* Purchase, in its units: what production waits on, and where each order stands */
      var holds = {};
      rows.forEach(function (r) { if (r.blocked > 0.05) r.blockedBy.forEach(function (nm) { (holds[nm] = holds[nm] || []).push({ name: r.name, kg: r.blocked }); }); });
      var buying = buy.map(function (b) {
        var mat = D.material(b.id), sup = D.supplier(mat.supplierId || mat.supplier);
        return Object.assign({}, b, { holds: holds[b.name] || [], supplierName: sup ? sup.name : (b.supplier || ""), supplierId: sup ? sup.id : null });
      });

      return { rows: rows, purchase: purchase, sales: sales, making: making, buying: buying };
    });
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  /* "today 3 pm", "tomorrow 7 am", "Thu, 1 Oct 7 am" */
  function when(t) {
    if (t === null || t === undefined || !isFinite(t)) return null;
    var dt = new Date(t), k = isoDay(t), today = isoDay(Date.now());
    var h = dt.toLocaleTimeString("en-IN", dt.getMinutes() ? { hour: "numeric", minute: "2-digit", hour12: true } : { hour: "numeric", hour12: true });
    return (k === today ? "today" : k === addDays(today, 1) ? "tomorrow" : dt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })) + " " + h;
  }
  function soon(t) { return t !== null && isFinite(t) && t - Date.now() < 24 * 3600000; }

  /* Owner, 29 Sep 2026: one chain, three departments — Sales | Production | Purchase.
     Each tab is one department's view in its own unit (packets, kg, material):
     what it is asked for, where it stands, what it waits on from the others
     (the column names the department). No actions here. The tabs carry each
     department's headline, so every head sees the others' state at a glance. */
  var DEPTS = ["sales", "production", "purchase"];
  function day(t) { return t == null || !isFinite(t) ? null : new Date(t).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }); }
  var STATE = { planned: "planned", "in-progress": "in progress", "on-hold": "on hold" };
  /* where a material stands with Purchase, in a few words */
  function standing(b) {
    var out = [];
    var free = Math.max(0, b.onHand - (b.reserved || 0));
    if (b.onHand > 0) out.push({ t: qty(b.onHand, b.unit) + " in store" + (b.reserved > 0 ? (free > 0 ? " · " + qty(free, b.unit) + " free" : " · all reserved") : "") });
    if (b.ordered > 0) {
      var onWay = b.ordered - b.pending;
      if (b.pending > 0) out.push({ t: qty(b.pending, b.unit) + " awaiting approval", c: "np" });
      if (onWay > 0) out.push(b.overdue ? { t: qty(onWay, b.unit) + " overdue", c: "blk" } : { t: qty(onWay, b.unit) + " on order" + (b.arrives ? " · arrives " + day(b.arrives) : ""), c: "ok" });
    }
    if (b.order > 0) out.push({ t: "Not ordered", c: "blk" });
    return out;
  }
  function Flow(f) {
    var dept = DEPTS.indexOf(S.dept) !== -1 ? S.dept : "sales";
    var bySales = f.sales.reduce(function (t, p) { p.packs.forEach(function (k) { t.short += k.short; t.open += k.open; t.next += k.forecast; }); return t; }, { short: 0, open: 0, next: 0 });
    var needKg = f.rows.reduce(function (t, r) { return t + r.needKg; }, 0), covKg = f.rows.reduce(function (t, r) { return t + r.covered; }, 0);
    var heldKg = f.rows.reduce(function (t, r) { return t + r.blocked; }, 0), npKg = f.rows.reduce(function (t, r) { return t + r.notPlanned; }, 0);
    var toBuy = f.buying.filter(function (b) { return b.order > 0; }), onOrder = f.buying.filter(function (b) { return !b.holds.length && b.status !== "low" && !(b.order > 0); });
    var holding = toBuy.filter(function (b) { return b.holds.length; }), low = toBuy.filter(function (b) { return b.status === "low"; });
    var head = {
      sales: { big: bySales.short ? n(bySales.short) + " packets short" : "All packed", sub: n(bySales.open) + " ordered · " + n(bySales.next) + " next week", tone: bySales.short ? "warn" : "ok" },
      production: { big: needKg > 0.05 ? kg(covKg) + " of " + kg(needKg) + " covered" : "Nothing to make", sub: [heldKg > 0.05 ? kg(heldKg) + " waits on Purchase" : "", npKg > 0.05 ? kg(npKg) + " not planned" : ""].filter(Boolean).join(" · ") || "On track", tone: heldKg > 0.05 ? "bad" : npKg > 0.05 ? "warn" : "ok" },
      purchase: { big: holding.length ? holding.length + (holding.length === 1 ? " item holds" : " items hold") + " production" : toBuy.length ? toBuy.length + " to buy" : "Nothing to buy",
        sub: [holding.length && heldKg > 0.05 ? "unblocks " + kg(heldKg) : "", toBuy.length - holding.length - low.length > 0 ? (toBuy.length - holding.length - low.length) + " for planned batches" : "", low.length ? low.length + " below minimum" : "", onOrder.length ? onOrder.length + " on order" : ""].filter(Boolean).join(" · ") || "Production has what it needs",
        tone: holding.length ? "bad" : toBuy.length ? "warn" : "ok" },
    };
    var NAME = { sales: "Sales", production: "Production", purchase: "Purchase" };
    var tabsHtml = '<div class="dx-tabs" role="tablist" aria-label="Departments">' + DEPTS.map(function (k, i) {
      return (i ? '<span class="dx-arr" aria-hidden="true">→</span>' : "") +
        '<button type="button" role="tab" class="dx-t ' + head[k].tone + '" data-act="dept" data-dept="' + k + '" aria-selected="' + (k === dept) + '"><span class="dx-k">' + NAME[k] + "</span><b>" + esc(head[k].big) + "</b><small>" + esc(head[k].sub) + "</small></button>";
    }).join("") + "</div>";
    var body = dept === "sales" ? SalesTab(f) : dept === "production" ? MakeTab(f) : BuyTab(f);
    return tabsHtml + (S.err ? '<div class="wk-err dx-err">' + esc(S.err) + "</div>" : "") + body;
  }
  /* Production's answer, in Sales' terms (owner, 29 Sep 2026: kg of production did not tell Sales
     anything): of the packets short, how many can ship and by when, and how many are stuck and why.
     The kg split (coming / held / not planned) is shared out over the short packets. */
  function shipParts(r, short) {
    if (!short) return [];
    if (!r || r.needKg < 0.05) return [{ q: short, t: "being packed", c: "ok" }];
    var part = function (v) { return Math.round(short * v / r.needKg); };
    var blk = part(r.blocked), np = part(r.notPlanned), cov = Math.max(0, short - blk - np);
    var eta = r.eta === "in freezer" ? "after packing" : r.eta === "no shift yet" ? "being made · no date yet" : r.eta === "late" ? "running late" : r.eta ? "by " + r.eta : "being made";
    return [cov ? { q: cov, t: eta, c: r.eta === "late" ? "blk" : "" } : null,
      blk ? { q: blk, t: "stuck · waiting on " + r.blockedBy.join(", "), c: "blk" } : null,
      np ? { q: np, t: "not planned yet", c: "np" } : null].filter(Boolean);
  }
  function shipAll(r, short) {
    if (!short) return '<span class="fx-pm ok">In stock</span>';
    return shipParts(r, short).map(function (x) { return '<span class="fx-pm' + (x.c ? " " + x.c : "") + '"><b>' + n(x.q) + "</b> " + esc(x.t) + "</span>"; }).join("");
  }
  /* the one line: the worst part first, out of the total; or all of it when it all comes the same way */
  function shipOne(r, short) {
    if (!short) return '<span class="fx-pm ok">In stock</span>';
    var parts = shipParts(r, short), worst = parts.filter(function (x) { return x.c === "blk"; })[0] || parts.filter(function (x) { return x.c === "np"; })[0];
    if (!worst) return '<span class="fx-pm' + (parts[0].c ? " " + parts[0].c : "") + '"><b>All ' + n(short) + "</b> " + esc(parts[0].t) + "</span>";
    return '<span class="fx-pm ' + worst.c + '"><b>' + n(worst.q) + " of " + n(short) + "</b> " + esc(worst.t) + "</span>";
  }
  /* one line per product (owner, 29 Sep 2026: less to take in); a click opens its packs and the full production picture */
  function SalesTab(f) {
    if (!f.sales.length) return '<section class="card fx"><div class="fx-none-msg">No customer demand in hand or next week.</div></section>';
    var sum = function (list, k) { return list.reduce(function (t, x) { return t + x[k]; }, 0); };
    return '<section class="card fx dx"><div class="tbl-wrap"><table class="dx-sales dx-xp"><thead><tr><th>Product</th><th class="num">Ordered</th><th class="num">Next week</th><th class="num">In stock</th><th class="num">Short</th><th>When you can ship</th></tr></thead><tbody>' +
      f.sales.map(function (p) {
        var open = !!S.open[p.recipeId], short = sum(p.packs, "short");
        var head = '<tr class="dx-p' + (open ? " on" : "") + '" data-act="xp" data-id="' + p.recipeId + '"><th scope="row"><button type="button" class="dx-x" aria-expanded="' + open + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>' + esc(p.name) + "</button></th>" +
          '<td class="num">' + n(sum(p.packs, "open")) + '</td><td class="num">' + n(sum(p.packs, "forecast")) + '</td><td class="num">' + n(sum(p.packs, "stock")) +
          '</td><td class="num ' + (short ? "blk" : "ok") + '">' + (short ? n(short) : "—") + "</td><td>" + (open ? shipAll(p.row, short) : shipOne(p.row, short)) + "</td></tr>";
        if (!open) return head;
        return head + p.packs.map(function (k, i) {
          return '<tr class="dx-k2' + (i === p.packs.length - 1 ? " end" : "") + '"><th scope="row">' + esc(k.size) + '</th><td class="num">' + n(k.open) + '</td><td class="num">' + n(k.forecast) + '</td><td class="num">' + n(k.stock) + '</td><td class="num ' + (k.short ? "blk" : "ok") + '">' + (k.short ? n(k.short) : "—") + "</td><td></td></tr>";
        }).join("");
      }).join("") + "</tbody></table></div></section>";
  }
  /* Production, one line per product (owner, 29 Sep 2026): what Sales needs made, how much is covered,
     what is short, and the one next step — worst first. A click opens where each kg stands. */
  function MakeTab(f) {
    if (!f.making.length) return '<section class="card fx"><div class="fx-none-msg">Nothing to make: packed stock covers what customers need.</div></section>';
    var mat = {};
    f.buying.forEach(function (b) { mat[b.name] = b; });
    var matSt = function (nm) { var b = mat[nm], st = b ? standing(b).filter(function (x) { return x.c; })[0] : null; return st ? st.t.toLowerCase() : ""; };
    return '<section class="card fx dx"><div class="tbl-wrap"><table class="dx-make dx-xp"><thead><tr><th>Product</th><th class="num">To make</th><th class="num">Covered</th><th class="num">Short</th><th>What\'s next</th></tr></thead><tbody>' +
      f.making.map(function (p) {
        var r = p.row, key = "m:" + p.recipeId, open = !!S.open[key];
        var cov = r ? r.covered : 0, gap = r ? Math.max(0, r.needKg - r.covered) : 0;
        var noShiftKg = p.batches.filter(function (b) { return b.state === "planned" && !b.start; }).reduce(function (t, b) { return t + b.kg; }, 0);
        /* the one next step, worst first */
        var next = !r ? '<span class="fx-pm ok">Nothing more needed</span>'
          : r.blocked > 0.05 ? '<span class="fx-pm blk"><b>' + kg(r.blocked) + "</b> waiting on " + esc(r.blockedBy.map(function (nm) { var t = matSt(nm); return nm + (t ? " (" + t + ")" : ""); }).join(", ")) + "</span>"
          : r.notPlanned > 0.05 ? '<span class="fx-pm np">Plan <b>' + kg(r.notPlanned) + "</b></span>"
          : noShiftKg > 0.05 ? '<span class="fx-pm np"><b>' + kg(noShiftKg) + "</b> needs a shift</span>"
          : r.eta === "late" ? '<span class="fx-pm blk">Running late</span>'
          : r.eta === "in freezer" ? '<span class="fx-pm ok">Pack from freezer</span>'
          : '<span class="fx-pm ok">Done by ' + esc(r.eta || "—") + "</span>";
        var head = '<tr class="dx-p' + (open ? " on" : "") + '" data-act="xp" data-id="' + key + '"><th scope="row"><button type="button" class="dx-x" aria-expanded="' + open + '">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>' + esc(p.name) + "</button></th>" +
          '<td class="num">' + (p.needKg > 0.05 ? kg(p.needKg) : "—") + '</td><td class="num">' + (cov > 0.05 ? kg(cov) : "—") + '</td><td class="num ' + (gap > 0.05 ? "blk" : "ok") + '">' + (gap > 0.05 ? kg(gap) : "—") + "</td><td>" + next + "</td></tr>";
        if (!open) return head;
        /* where each kg stands: what Sales asked for, then the freezer, each batch, and what waits on Purchase */
        var lines = [];
        if (r) lines.push(["For Sales", '<span class="fx-pm">' + r.packs.map(function (k) { return n(k.count) + " × " + esc(k.size); }).join(" · ") + "</span>"]);
        if (p.freezerKg > 0.05 && p.needKg > 0.05) lines.push([kg(Math.min(p.freezerKg, p.needKg)) + " in freezer", '<span class="fx-pm ok">ready to pack</span>']);
        p.batches.forEach(function (b) {
          var t = b.state !== "planned" ? (STATE[b.state] || b.state) : b.start ? "planned · " + b.start : "planned · needs a shift";
          lines.push([kg(b.kg) + " batch", '<span class="fx-pm' + (b.held ? " blk" : b.state === "planned" && !b.start ? " np" : "") + '">' + esc(t) + (b.held ? " · material short" : "") + "</span>"]);
        });
        if (r && r.blocked > 0.05) r.blockedBy.forEach(function (nm) { var t = matSt(nm); lines.push([kg(r.blocked) + " held", '<span class="fx-pm blk">waiting on ' + esc(nm) + (t ? " · " + esc(t) : "") + "</span>"]); });
        if (r && r.notPlanned > 0.05) lines.push([kg(r.notPlanned) + " not planned", '<span class="fx-pm np">no batch yet</span>']);
        return head + lines.map(function (x, i) {
          return '<tr class="dx-k2' + (i === lines.length - 1 ? " end" : "") + '"><th scope="row" colspan="4">' + x[0] + "</th><td>" + x[1] + "</td></tr>";
        }).join("");
      }).join("") + "</tbody></table></div></section>";
  }
  /* Purchase, one line per situation (owner, 29 Sep 2026) — not per material: what holds production up,
     what planned batches need soon, what is below its minimum, what is already on its way. Each line
     is asked as a question, with how many; a click opens the answer — its materials. */
  function BuyTab(f) {
    if (!f.buying.length) return '<section class="card fx"><div class="fx-none-msg">Production has every material it needs.</div></section>';
    var group = function (b) { return b.holds.length ? "hold" : b.status === "low" ? "low" : b.order > 0 ? "plan" : "way"; };
    var GROUPS = [
      { k: "hold", name: "What is holding up production?", tone: "bad" },
      { k: "plan", name: "What do planned batches need urgently?", tone: "warn" },
      { k: "low", name: "What is below minimum stock?", tone: "warn" },
      { k: "way", name: "What is already on order?", tone: "ok" },
    ];
    var CHEV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>';
    return '<section class="card fx dx"><div class="tbl-wrap"><table class="dx-buy dx-xp"><colgroup><col class="c1"><col class="c2"><col class="c3"><col></colgroup><tbody>' +
      GROUPS.map(function (g) {
        var list = f.buying.filter(function (b) { return group(b) === g.k; });
        if (!list.length) return "";
        var key = "b:" + g.k, open = !!S.open[key];
        var head = '<tr class="dx-p dx-sit ' + g.tone + (open ? " on" : "") + '" data-act="xp" data-id="' + key + '"><th scope="rowgroup" colspan="4"><span class="dx-sit-in">' +
          '<button type="button" class="dx-x" aria-expanded="' + open + '">' + CHEV + esc(g.name) + '</button><span class="dx-n">' + list.length + "</span></span></th></tr>";
        if (!open) return head;
        /* the column names, only where there are columns to read */
        return head + '<tr class="dx-k2 dx-cols"><th scope="col">Material</th><th scope="col">For Production</th><th scope="col" class="num">To buy</th><th scope="col">Where it stands</th></tr>' + list.map(function (b, i) {
          var forP = b.holds.length ? b.holds.map(function (h) { return '<span class="fx-pm blk">' + esc(h.name) + " · <b>" + kg(h.kg) + "</b> held</span>"; }).join("")
            : '<span class="fx-pm">' + esc(b.forWhat || "—") + "</span>";
          var st = standing(b).map(function (x) { return '<span class="fx-pm' + (x.c ? " " + x.c : "") + '">' + esc(x.t) + "</span>"; }).join("");
          return '<tr class="dx-k2 dx-m' + (i === list.length - 1 ? " end" : "") + '"><th scope="row">' + esc(b.name) + (b.supplierName ? '<small class="dx-no">' + esc(b.supplierName) + "</small>" : "") + "</th><td>" + forP +
            '</td><td class="num">' + (b.order > 0 ? "<b>" + esc(qty(b.order, b.unit)) + "</b>" : "—") + "</td><td>" + st + "</td></tr>";
        }).join("");
      }).join("") + "</tbody></table></div></section>";
  }

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
    app.innerHTML =
      (S.lens === "needs" ? Needs(m)
        : S.lens === "flow" ? Flow(flowModel())
        : Roster(w)) +
      (S.panel ? (S.panel.kind === "settings" ? Settings(w) : ShiftPanel(w)) : "");
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
    var b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    var act = b.getAttribute("data-act");
    if (act === "lens") { S.lens = b.getAttribute("data-lens"); S.panel = null; S.err = ""; window.scrollTo(0, 0); }
    else if (act === "settings") { S.panel = { kind: "settings", edit: null }; S.form = {}; S.err = ""; }
    else if (act === "xp") { var xid = b.getAttribute("data-id"); if (S.open[xid]) delete S.open[xid]; else S.open[xid] = true; }
    else if (act === "dept") { S.dept = b.getAttribute("data-dept"); S.err = ""; try { sessionStorage.setItem("fb.v7.flow.dept", S.dept); } catch (e2) { /* remembered for this visit only */ } }
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

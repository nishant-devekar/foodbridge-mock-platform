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
  var S = { lens: "flow", plan: "fg", open: {}, from: null, panel: null, form: {}, ask: null, rm: null, add: null, err: "" };
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
  /* the sheet's colours: a product's packs and its total; each vegetable down Semi Finished and Purchase */
  var TINT = { "mix-veg": "peach", "green-peas": "green", "sf-cauliflower": "cyan", "sf-broccoli": "pink", "sf-carrots": "lime", "sf-beans": "violet", "sf-peas": "orange",
    "rm-p03": "cyan", "rm-p10": "pink", "rm-p02": "lime", "rm-p04": "violet", "rm-p01": "orange" };
  function planKey() { return "fb.v7.plan." + isoDay(Date.now()); }
  function planMarks() { try { return JSON.parse(localStorage.getItem(planKey()) || "null") || { dev: {}, ok: {} }; } catch (e) { return { dev: {}, ok: {} }; } }
  function savePlanMarks(m) { try { localStorage.setItem(planKey(), JSON.stringify(m)); } catch (e) { /* this visit only */ } }
  function planWho() {
    try { var a = (window.parent.FBContext || window.FBContext).account(); if (a && a.name && !a.guest) return a.name; } catch (e) { /* standalone */ }
    return "Owner";
  }
  /* a pack's name as the sheet writes it: "Mixed Veg 200G / 30 kg pack" (the chaap's bag is its own outer) */
  function packLabel(s) { return s.perCarton > 1 ? s.name + " / " + n(s.perCarton * s.grams / 1000) + " kg pack" : s.name; }
  function planModel() {
    var mk = planMarks();
    var dev = function (k) { return Number(mk.dev[k]) || 0; };
    var line = function (key, msq, ordered, stock) {
      var d = dev(key);
      return { key: key, msq: msq, ordered: ordered, stock: stock, short: stock - ordered, approved: Math.max(0, ordered - stock + msq + d), dev: d, ok: mk.ok[key] || null };
    };
    return FB_PRODUCTION.read(function (D, d) {
      var plan = D.plan();
      var rowOf = {};
      plan.skus.forEach(function (r) { rowOf[r.skuId] = r; });
      /* Orders and Finished Goods: a row per pack under its finished product */
      var orders = [], fg = [];
      d.recipeOrder.forEach(function (rid) {
        var bk = D.book(rid), packs = D.packs(rid);
        var oRows = packs.map(function (s) { var r = rowOf[s.id] || { open: 0 }; return { id: s.id, name: packLabel(s), perCarton: s.perCarton, cartons: r.open / (s.perCarton || 1), qty: r.open }; });
        var sumO = function (k) { return oRows.reduce(function (t, x) { return t + x[k]; }, 0); };
        orders.push({ recipeId: rid, name: bk.name, rows: oRows, total: { perCarton: sumO("perCarton"), cartons: sumO("cartons"), qty: sumO("qty") } });
        var fRows = packs.map(function (s) {
          var r = rowOf[s.id] || { open: 0, free: 0 };
          var l = line("fg:" + s.id, s.msq || 0, r.open, r.free);
          l.name = packLabel(s); l.kg = s.grams / 1000;
          return l;
        });
        var sum = function (k) { return fRows.reduce(function (t, x) { return t + x[k]; }, 0); };
        fg.push({ recipeId: rid, name: bk.name, version: bk.label, packs: fRows,
          approvedKg: fRows.reduce(function (t, x) { return t + x.approved * x.kg; }, 0),
          total: { msq: sum("msq"), ordered: sum("ordered"), stock: sum("stock"), short: sum("short"), approved: sum("approved") } });
      });
      /* Semi Finished: each product's Approved (kg) × the good's share of its recipe */
      var need = {}, shares = {};
      fg.forEach(function (g) {
        var bk = D.book(g.recipeId), comps = bk.ingredients.filter(function (i) { return i.sfId; }), tot = comps.reduce(function (t, i) { return t + i.qty; }, 0);
        comps.forEach(function (i) {
          need[i.sfId] = (need[i.sfId] || 0) + g.approvedKg * i.qty / tot;
          (shares[i.sfId] = shares[i.sfId] || []).push({ pct: i.qty / tot * 100, of: bk.name });
        });
      });
      var semi = (d.semiOrder || []).map(function (sid) {
        var bk = D.book(sid);
        var l = line("sf:" + sid, bk.msq || 0, need[sid] || 0, D.inFreezer(sid));
        l.id = sid; l.name = bk.name; l.cut = bk.label; l.shares = shares[sid] || [];
        return l;
      });
      /* Purchase: the raw material each semi-finished good is cut from, by its wastage */
      var buy = {}, order = [];
      var add = function (rmId, qty, waste) {
        if (!buy[rmId]) { buy[rmId] = { qty: 0, waste: waste }; order.push(rmId); }
        buy[rmId].qty += qty;
      };
      semi.forEach(function (s) {
        var bk = D.book(s.id);
        bk.ingredients.forEach(function (i) { if (i.rmId) add(i.rmId, s.approved * i.qty / bk.base, i.wastage != null ? i.wastage : Math.max(0, 100 - (i.yield || 100))); });
      });
      fg.forEach(function (g) {
        var bk = D.book(g.recipeId);
        bk.ingredients.forEach(function (i) { if (i.rmId) add(i.rmId, g.approvedKg * i.qty / bk.base, 0); });
      });
      var purchase = order.map(function (id) {
        var m = D.material(id);
        var l = line("pu:" + id, m.threshold || 0, buy[id].qty, Math.max(0, D.onHand(id) - D.reserved(id)));
        l.id = id; l.name = m.name; l.unit = m.unit; l.grade = m.grade || "—"; l.waste = buy[id].waste;
        return l;
      });
      return { orders: orders, fg: fg, semi: semi, purchase: purchase };
    });
  }

  function Plan(p) {
    var tab = PLAN_TABS.some(function (t) { return t[0] === S.plan; }) ? S.plan : "or";
    var q = function (v) { return n(v); };
    var sh = function (v) { return '<td class="num' + (v < -0.5 ? " pp-neg" : "") + '">' + (Math.abs(v) < 0.5 ? "0" : (v < 0 ? "-" : "") + n(Math.abs(v))) + "</td>"; };
    var tint = function (id) { return TINT[id] ? ' data-tint="' + TINT[id] + '"' : ""; };
    /* MSQ Deviation and Confirm: the planner's, per line */
    var marks = function (l) {
      var ok = l.ok;
      return '<td class="num pp-dev"><input type="number" step="1" inputmode="decimal" data-dev="' + esc(l.key) + '" value="' + (l.dev ? l.dev : "") + '" placeholder="0" aria-label="MSQ deviation"' + (ok ? " disabled" : "") + "></td>" +
        '<td class="pp-ok">' + (ok ? '<button type="button" class="pp-done" data-pok="' + esc(l.key) + '" title="Undo">✓ ' + esc(ok.by) + "<small>" + esc(time(ok.at)) + "</small></button>"
          : '<button type="button" class="pp-conf" data-pok="' + esc(l.key) + '">Confirm</button>') + "</td>";
    };
    var tabsHtml = '<div class="pp-tabs" role="tablist" aria-label="Today\'s Production and Purchase Plan">' + PLAN_TABS.map(function (t) {
      return '<button type="button" role="tab" class="pp-tab" data-ptab="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + t[1] + "</button>";
    }).join("") + "</div>";
    var body;
    if (tab === "or") {
      body = '<table class="pp pp-or"><thead><tr><th>Item name</th><th class="num">No. of Packs per 30kg</th><th class="num">Qty Ordered (Packs)</th><th class="num">Qty Ordered (Kg)</th></tr></thead><tbody>' +
        p.orders.map(function (g) {
          return g.rows.map(function (r) {
            return "<tr" + tint(g.recipeId) + '><th scope="row">' + esc(r.name) + '</th><td class="num">' + q(r.perCarton) + '</td><td class="num">' + q(r.cartons) + '</td><td class="num">' + q(r.qty) + "</td></tr>";
          }).join("") +
            '<tr class="pp-total pp-center"' + tint(g.recipeId) + '><th scope="row">' + esc(g.name) + '</th><td class="num">' + q(g.total.perCarton) + '</td><td class="num">' + q(g.total.cartons) + '</td><td class="num">' + q(g.total.qty) + "</td></tr>";
        }).join("") + "</tbody></table>";
    } else if (tab === "fg") {
      body = '<table class="pp pp-fg"><thead><tr><th>Product Name</th><th>Recipe Version</th><th class="num">MSQ (Min. Stock Qty in kg)</th><th class="num">Ordered Quantity</th><th class="num">InStock</th><th class="num">Shortfall</th><th class="num">Approved Production</th><th class="num">MSQ Deviation</th><th>ConfirmBy</th></tr></thead><tbody>' +
        p.fg.map(function (g) {
          return g.packs.map(function (l) {
            return "<tr" + tint(g.recipeId) + '><th scope="row">' + esc(l.name) + '</th><td></td><td class="num">' + q(l.msq) + '</td><td class="num">' + q(l.ordered) + '</td><td class="num">' + q(l.stock) + "</td>" + sh(l.short) +
              '<td class="num"><b>' + q(l.approved) + "</b></td>" + marks(l) + "</tr>";
          }).join("") +
            '<tr class="pp-total"' + tint(g.recipeId) + '><th scope="row">' + esc(g.name) + "</th><td>" + esc(g.version) + '</td><td class="num">' + q(g.total.msq) + '</td><td class="num">' + q(g.total.ordered) + '</td><td class="num">' + q(g.total.stock) + "</td>" + sh(g.total.short) +
            '<td class="num">' + q(g.total.approved) + "</td><td></td><td></td></tr>";
        }).join("") + "</tbody></table>";
    } else if (tab === "sf") {
      body = '<table class="pp pp-sf"><thead><tr><th>Product Name</th><th>Cut Recipe</th><th class="num">Ingredient %age</th><th class="num">MSQ (Min. Stock Qty)</th><th class="num">Ordered Qty (Kg)</th><th class="num">InStock</th><th class="num">Shortfall</th><th class="num">Approved Production</th><th class="num">MSQ Deviation</th><th>Confirm</th></tr></thead><tbody>' +
        p.semi.map(function (l) {
          var pct = l.shares.map(function (s) { return n(s.pct); }).join(" · ") || "—";
          return "<tr" + tint(l.id) + '><th scope="row">' + esc(l.name) + "</th><td>" + esc(l.cut) + '</td><td class="num" title="' + esc(l.shares.map(function (s) { return n(s.pct) + "% of " + s.of; }).join(" · ")) + '">' + pct + '</td><td class="num">' + q(l.msq) +
            '</td><td class="num">' + q(l.ordered) + '</td><td class="num">' + q(l.stock) + "</td>" + sh(l.short) + '<td class="num"><b>' + q(l.approved) + "</b></td>" + marks(l) + "</tr>";
        }).join("") + "</tbody></table>";
    } else {
      body = '<table class="pp pp-pu"><thead><tr><th>Product Name</th><th>Quality / Brand</th><th class="num">Wastage %age</th><th class="num">MSQ (Min Stk Qty)</th><th class="num">Ordered Quantity</th><th class="num">InStock</th><th class="num">Shortfall</th><th class="num">Approved Purchase</th><th class="num">MSQ Deviation</th><th>Confirm</th></tr></thead><tbody>' +
        p.purchase.map(function (l) {
          var u = l.unit === "kg" ? "" : " " + l.unit;
          return "<tr" + tint(l.id) + '><th scope="row">' + esc(l.name) + "</th><td>" + esc(l.grade) + '</td><td class="num">' + n(l.waste) + '</td><td class="num">' + q(l.msq) + u +
            '</td><td class="num">' + q(l.ordered) + u + '</td><td class="num">' + q(l.stock) + u + "</td>" + sh(l.short) + '<td class="num pp-big"><b>' + q(l.approved) + u + "</b></td>" + marks(l) + "</tr>";
        }).join("") + "</tbody></table>";
    }
    return tabsHtml + '<section class="card pp-card"><div class="tbl-wrap">' + body + "</div></section>";
  }

  /* the planner's marks: a deviation as it is typed in, a confirm on a click */
  app.addEventListener("change", function (e) {
    var k = e.target.getAttribute && e.target.getAttribute("data-dev");
    if (!k) return;
    var m = planMarks(), v = Number(e.target.value);
    if (e.target.value === "" || !isFinite(v) || !v) delete m.dev[k]; else m.dev[k] = v;
    savePlanMarks(m); render();
  });
  app.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.getAttribute && e.target.getAttribute("data-dev")) e.target.blur();
  });

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
        : S.lens === "flow" ? Plan(planModel())
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
    var pt = e.target.closest("[data-ptab]");
    if (pt) { S.plan = pt.getAttribute("data-ptab"); try { sessionStorage.setItem("fb.v7.flow.plantab", S.plan); } catch (e2) { /* this visit only */ } render(); return; }
    var pk = e.target.closest("[data-pok]");
    if (pk) {
      var mk = planMarks(), key = pk.getAttribute("data-pok");
      if (mk.ok[key]) delete mk.ok[key]; else mk.ok[key] = { by: planWho(), at: new Date().toISOString() };
      savePlanMarks(mk); render(); return;
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

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
 *   All shifts  the Week (29 Sep 2026): a roster, a row per day and a
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
  var S = { lens: "flow", from: null, panel: null, sched: {}, change: null, nsAll: false, nsAsk: false, form: {}, ask: null, err: "" };
  S.from = monday(Date.now());
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

  /* ── Week: the shifts (29 Sep 2026, simplified after the owner's review) ──
     A roster: a row per day, a column per shift. Each shift shows who runs
     it, its batches in the words All batches uses (number, size, status),
     and how full it is. Not scheduled batches get a shift from a list. The
     shifts themselves — Morning, Evening, a Night if you add one — are set in
     Shift settings. A batch's own work stays in the batch. */
  function isoDay(t) { var d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function monday(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDay(d); }
  function addDays(key, n) { var d = new Date(key + "T00:00:00"); d.setDate(d.getDate() + n); return isoDay(d); }
  function dayName(key, long) { return new Date(key + "T00:00:00").toLocaleDateString("en-IN", long ? { weekday: "short", day: "numeric", month: "short" } : { weekday: "short", day: "numeric" }); }
  function hr(h) { h = ((h % 24) + 24) % 24; return (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? " am" : " pm"); }
  function hrs(v) { return (Math.round(v * 2) / 2).toLocaleString("en-IN") + " h"; }
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var BADGE = { planned: "Planned", "in-progress": "In Progress", "on-hold": "On Hold", completed: "Completed", closed: "Closed", rejected: "Rejected" };

  function light(D, b) {
    return { id: b.id, no: b.batchNumber, name: b.displayName, size: b.kind === "packing" ? n(b.packets) + " packets · " + kg(b.batchSize) : kg(b.batchSize), state: b.stateId,
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
  function optLabel(c) { return dayName(c.date, true) + " · " + c.name + " · " + short(c.inCharge) + " · " + (c.hours.used ? hrs(c.hours.used) + " of " + hrs(c.hours.of) + " booked" : "free"); }
  function people(n) { return n + (n === 1 ? " person" : " people"); }
  function short(name) { return String(name || "").split(" ")[0]; }
  /* Suggestions for the whole list at once, soonest due first: each batch
     takes the first shift before it's due that still has room, counting
     the batches suggested ahead of it — so "Schedule all" never overfills. */
  function suggestAll(w) {
    var load = {}, out = {};
    w.options.forEach(function (c) { load[c.key] = c.hours.used; });
    w.tray.forEach(function (b) {
      var before = w.options.filter(function (c) { return !b.due || c.date <= b.due; });
      var room = before.filter(function (c) { return c.hours.of - load[c.key] >= b.hours; })[0];
      var pick = room || before[0] || w.options[0];
      if (!pick) return;
      load[pick.key] += b.hours;
      out[b.id] = { key: pick.key, ok: !!room, late: !before.length };
    });
    return out;
  }
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
  var NS_SHOWN = 5;
  function NotScheduled(w) {
    if (!w.tray.length) return '<div class="ns ns-done">✓ Every batch has a shift.</div>';
    w.tray.sort(function (a, c) { return String(a.due || "9999").localeCompare(String(c.due || "9999")); });
    var sug = suggestAll(w), byKey = {};
    w.options.forEach(function (c) { byKey[c.key] = c; });
    var shown = S.nsAll ? w.tray : w.tray.slice(0, NS_SHOWN);
    var noRoom = w.tray.filter(function (b) { return sug[b.id] && !sug[b.id].ok; }).length;
    var head = '<div class="ns-h"><span><b>Not scheduled · ' + w.tray.length + "</b> <span>need a shift" + (noRoom ? ' · <span class="late">' + noRoom + " can't fit before due</span>" : "") + "</span></span>" +
      (w.tray.length > 1 ? (S.nsAsk ? '<span class="ns-ask">Put all ' + w.tray.length + ' in their suggested shifts? <button type="button" class="btn primary sm" data-act="schedAll">Yes, schedule ' + w.tray.length + '</button><button type="button" class="btn sm" data-act="nsAsk" data-on="">Back</button></span>'
        : '<button type="button" class="btn sm" data-act="nsAsk" data-on="1">Schedule all as suggested</button>') : "") + "</div>";
    var rows = shown.map(function (b) {
      var sg = sug[b.id] || {}, pick = S.sched[b.id] || sg.key, c = byKey[pick];
      var where = S.change === b.id
        ? '<select data-sched="' + b.id + '" aria-label="Shift for ' + esc(b.no) + '">' + w.options.map(function (o) {
            return '<option value="' + o.key + '"' + (o.key === pick ? " selected" : "") + ">" + esc(optLabel(o)) + (b.due && o.date > b.due ? " · after due" : "") + "</option>";
          }).join("") + "</select>"
        : '<span class="ns-sg' + (c && b.due && c.date > b.due ? " late" : sg.ok === false && !S.sched[b.id] ? " late" : "") + '">' + (c ? esc(dayName(c.date) + " · " + c.name + " · " + short(c.inCharge)) : "No shift free") + "</span>" +
          '<button type="button" class="linkbtn" data-act="change" data-id="' + b.id + '">Change</button>';
      return '<div class="ns-r">' + dueTag(b.due, w.today) +
        '<button type="button" class="ns-b" data-batch="' + b.id + '"><b>' + esc(b.name) + "</b> <span>" + esc(b.size) + " · " + esc(b.no.replace(/^[A-Z]+-\d{4}-/, "")) + " · " + hrs(b.hours) + "</span>" +
          (b.was ? ' <span class="late">· its ' + esc(dayName(b.was.date)) + " shift was cancelled</span>" : "") + "</button>" +
        '<span class="ns-go">' + where + (c ? '<button type="button" class="btn primary sm" data-act="schedule" data-id="' + b.id + '" data-key="' + pick + '">Schedule</button>' : "") + "</span></div>";
    }).join("");
    var more = w.tray.length > NS_SHOWN ? '<button type="button" class="linkbtn ns-more" data-act="nsAll">' + (S.nsAll ? "Show fewer" : "Show all " + w.tray.length + " ›") + "</button>" : "";
    return '<div class="ns">' + head + '<div class="ns-list">' + rows + "</div>" + more + "</div>";
  }
  function BatchLine(b) {
    return '<li><button type="button" class="bl" data-batch="' + b.id + '"><span class="bl-n"><b>' + esc(b.name) + "</b><small>" + esc(b.no.replace(/^[A-Z]+-\d{4}-/, "")) + " · " + esc(b.size) + (b.office ? " · Office" : "") + "</small></span>" +
      '<span class="badge b-' + esc(b.state) + '">' + esc(BADGE[b.state] || b.state) + "</span></button></li>";
  }
  function Load(c) {
    if (!c.batches.length) return "";
    var over = c.hours.used - c.hours.of;
    return '<div class="load' + (over > 0 ? " over" : "") + '"><span class="bar"><i style="width:' + Math.min(100, Math.round(c.hours.used / c.hours.of * 100)) + '%"></i></span><span>' +
      (over > 0 ? hrs(c.hours.used) + " of work · " + hrs(over) + " more than the shift" : hrs(c.hours.used) + " of " + hrs(c.hours.of) + " booked") + "</span></div>";
  }
  function ShiftCell(c) {
    if (!c) return "<td></td>";
    var label = ' data-label="' + esc(c.name) + '"';
    if (c.status === "off") return "<td" + label + ' class="c-off"><span>Day off</span>' + (c.past ? "" : '<button type="button" class="linkbtn" data-act="openday" data-date="' + c.date + '">Work this day</button>') + "</td>";
    if (c.status === "cancelled") return "<td" + label + ' class="c-off"><span>Cancelled' + (c.cancelled ? " · " + esc(c.cancelled) : "") + "</span>" + (c.past ? "" : '<button type="button" class="linkbtn" data-act="restore" data-key="' + c.key + '">Put back</button>') + "</td>";
    var st = c.status === "live" ? '<span class="st live"><i></i>Running now</span>'
      : c.status === "stopped" ? '<span class="st bad">Stopped' + (c.stopped ? " · " + esc(c.stopped) : "") + "</span>"
      : c.status === "ended" ? '<span class="st">Handed over to ' + esc(short(c.handover && c.handover.toInCharge)) + "</span>" : "";
    if (c.takeover && !c.takeover.taken) st += '<span class="st warn">Waiting for ' + esc(short(c.inCharge)) + " to take over</span>";
    return "<td" + label + ' class="' + (c.now ? "c-now" : "") + (c.past ? " c-past" : "") + '">' +
      '<button type="button" class="sc-h" data-shift="' + c.key + '"><span><b>' + esc(c.inCharge) + "</b> · " + people(c.crew.length) + "</span><span class=\"chev\">Manage ›</span></button>" +
      (st ? '<div class="sc-st">' + st + "</div>" : "") +
      (c.batches.length ? '<ul class="bls">' + c.batches.map(BatchLine).join("") + "</ul>" : '<p class="none">No batches</p>') + Load(c) + "</td>";
  }
  /* the roster table: a row per day, a column per shift — the Week, and
     Today's one row (29 Sep 2026, owner: Today looks the same as Week) */
  function rosterTable(w, days) {
    var head = "<thead><tr><th>Day</th>" + w.shifts.map(function (x) { return "<th>" + esc(x.name) + "<small>" + hr(x.start) + " – " + hr(x.end) + "</small></th>"; }).join("") + "</tr></thead>";
    var body = days.map(function (k) {
      return '<tr class="' + (k === w.today ? "r-today" : "") + (k < w.today ? " r-past" : "") + '"><th>' + esc(dayName(k)) + (k === w.today ? "<small>Today</small>" : "") + "</th>" +
        w.shifts.map(function (x) { return ShiftCell(w.cells[k + "|" + x.id]); }).join("") + "</tr>";
    }).join("");
    return '<div class="tbl-wrap"><table class="roster">' + head + "<tbody>" + body + "</tbody></table></div>";
  }
  function Roster(w) {
    var days = [];
    for (var i = 0; i < 7; i++) days.push(addDays(S.from, i));
    var end = addDays(S.from, 6), thisWeek = S.from === monday(Date.now());
    return '<section class="card wk"><header><h2>Shifts · ' + esc(dayName(S.from, true)) + " – " + esc(dayName(end, true)) + "</h2>" +
      '<span class="wk-nav"><button type="button" class="btn sm" data-act="wk" data-by="-7" aria-label="Previous week">‹</button>' +
      '<button type="button" class="btn sm" data-act="wk" data-by="0"' + (thisWeek ? " disabled" : "") + ">This week</button>" +
      '<button type="button" class="btn sm" data-act="wk" data-by="7" aria-label="Next week">›</button>' +
      '<button type="button" class="btn sm" data-act="settings">Shift settings</button></span></header>' +
      NotScheduled(w) + (S.err && !S.panel ? '<div class="wk-err">' + esc(S.err) + "</div>" : "") +
      rosterTable(w, days) + "</section>";
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
    var moves = w.options.filter(function (o) { return o.key !== c.key; });
    body += '<div class="sp-f"><label>Batches · ' + c.batches.length + (c.batches.length ? " · " + hrs(c.hours.used) + " of work in a " + hrs(c.hours.of) + " shift" : "") + "</label>" +
      (c.batches.length ? '<ul class="sp-b">' + c.batches.map(function (b) {
        var canMove = b.state === "planned" && editable;
        return '<li><button type="button" class="bl" data-batch="' + b.id + '"><span class="bl-n"><b>' + esc(b.name) + "</b><small>" + esc(b.no) + " · " + esc(b.size) + (b.office ? " · Office" : "") + '</small></span><span class="badge b-' + esc(b.state) + '">' + esc(BADGE[b.state] || b.state) + "</span></button>" +
          (canMove ? '<span class="sp-mv"><select data-move="' + b.id + '" aria-label="Move ' + esc(b.no) + '"><option value="">Move to another shift…</option>' + moves.map(function (o) { return '<option value="' + o.key + '">' + esc(optLabel(o)) + "</option>"; }).join("") +
            '<option value="none">Not scheduled</option></select></span>' : "") + "</li>";
      }).join("") + "</ul>" : '<div class="muted">No batches yet. Give one a shift from Not scheduled.</div>') + "</div>";
    var acts = [];
    if (c.status === "live") acts.push(["handover", "Hand over to the next shift"], ["stop", "Stop the shift"]);
    if (c.status === "stopped") acts.push(["resume", "Resume"], ["handover", "Hand over to the next shift"]);
    if (!c.past && !started && ["scheduled", "open"].indexOf(c.status) !== -1) acts.push(["cancel", "Cancel this shift"]);
    var ask = "";
    if (S.ask === "stop") ask = Ask("Why did it stop?", "A power cut, a breakdown…", "Stop · running batches go on hold", true);
    else if (S.ask === "cancel") ask = Ask("Why cancel it?", "A holiday, no people…", "Cancel · its batches go back to Not scheduled", false);
    else if (S.ask === "handover") ask = Ask("Note for the next in-charge", "Where things are, what to watch", "Hand over", false);
    else if (S.ask === "resume") ask = '<div class="sp-ask"><p>Resume the shift? Its batches come off hold.</p><div class="sp-row"><button type="button" class="btn primary sm" data-act="do">Yes, resume</button><button type="button" class="btn sm" data-act="ask" data-ask="">Back</button></div></div>';
    return Panel(c.name + " shift", dayName(c.date, true) + " · " + hr(sx.start) + " – " + hr(sx.end) + (status ? " · " + status : ""), body,
      acts.length || ask ? (ask || acts.map(function (a) { return '<button type="button" class="btn sm' + (a[0] === "stop" || a[0] === "cancel" ? " warn" : a[0] === "handover" || a[0] === "resume" ? " primary" : "") + '" data-act="ask" data-ask="' + a[0] + '">' + a[1] + "</button>"; }).join("")) : "");
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
    var body = '<p class="muted small" style="margin:0">Every working day has these shifts. A change applies to the coming days; to change one day, open that day\'s shift in the week.</p>' +
      '<ul class="st-list">' + w.shifts.map(function (x) {
        return "<li>" + (ed === x.id ? form(x) : '<div class="st-row"><span><b>' + esc(x.name) + "</b> · " + hr(x.start) + " – " + hr(x.end) + " · " + hrs(D_hours(x)) + "<small>" + esc(x.inCharge) + " in charge · usually " + people(x.crew.length) + "</small></span>" +
          '<button type="button" class="btn sm" data-act="editShift" data-id="' + x.id + '">Edit</button></div>') + "</li>";
      }).join("") + (ed === "new" ? "<li>" + form(null) + "</li>" : "") + "</ul>" +
      (ed ? "" : '<button type="button" class="btn sm" data-act="editShift" data-id="new">＋ Add a shift</button>') +
      '<div class="sp-f"><label>Working days</label><div class="sp-crew">' + [1, 2, 3, 4, 5, 6, 0].map(function (dn) {
        var on = w.days.indexOf(dn) !== -1;
        return '<button type="button" class="pp' + (on ? " on" : "") + '" data-act="day" data-day="' + dn + '" aria-pressed="' + on + '">' + (on ? "✓ " : "") + DAYS[dn] + "</button>";
      }).join("") + '</div><p class="muted small">A day off can still be worked: open it in the week and pick Work this day.</p></div>';
    return Panel("Shift settings", w.shifts.map(function (x) { return x.name; }).join(" · "), body, "");
  }
  function D_hours(x) { return x.end > x.start ? x.end - x.start : 24 - x.start + x.end; }

  /* ── writes ── */
  function write(fn) {
    try { FB_PRODUCTION.write(fn); S.err = ""; return true; }
    catch (e) { S.err = (e && e.body && e.body.error) || (e && e.message) || "That didn't save."; return false; }
  }
  function keyOf(key) { var p = key.split("|"); return { date: p[0], slot: p[1] }; }
  function schedule(batchId, key) {
    if (key === "none") return write(function (D) { D.unschedule(batchId); });
    var k = keyOf(key);
    return write(function (D) { D.schedule(batchId, k.date, k.slot, "admin"); });
  }
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
    else if (act === "ask") { S.ask = el.getAttribute("data-ask") || null; S.form.text = ""; S.err = ""; }
    else if (act === "do") {
      var text = (S.form.text || "").trim(), ok = false;
      if (S.ask === "stop") ok = write(function (D) { D.stopSlot(c.id, text, "admin"); });
      else if (S.ask === "resume") ok = write(function (D) { D.resumeSlot(c.id, "admin"); });
      else if (S.ask === "cancel") ok = write(function (D) { D.cancelSlot(sid(D), text, "admin"); });
      else if (S.ask === "handover") ok = write(function (D) { D.handOver(c.id, { note: text, actor: "admin" }); });
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
        var arrives = null, overdue = false;
        (d.purchaseOrders || []).forEach(function (p) {
          var q = D.openOnPO(p, m.id);
          if (!(q > 0)) return;
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
        if (!status) return null;
        /* for what: every product whose batch runs short, and the products still to plan that use it */
        if (m.buy > 0) plan.products.forEach(function (p) {
          if (p.toMakeKg > 0 && forR.indexOf(p.recipeId) === -1 && D.book(p.recipeId).ingredients.some(function (i) { return i.rmId === m.id; })) forR.push(p.recipeId);
        });
        /* a pouch is for the packs short that it fills */
        if (m.buy > 0) plan.skus.forEach(function (k) { if (k.shortPackets > 0 && D.sku(k.skuId).pouchId === m.id && forR.indexOf(k.recipeId) === -1) forR.push(k.recipeId); });
        var forWhat = status === "low" ? "Minimum " + (m.unit === "kg" ? n(mat.threshold, 10) + " kg" : n(mat.threshold) + " " + m.unit) : forR.map(function (r) { return bookName[r]; }).filter(Boolean).join(", ");
        return { id: m.id, name: m.name, unit: m.unit, supplier: m.supplier, order: order, by: by, status: status, forWhat: forWhat,
          onHand: m.onHand, ordered: m.ordered, arrives: arrives, overdue: overdue };
      }).filter(Boolean).sort(function (a, b) {
        var rank = { by: 0, late: 1, noShift: 2, new: 3, low: 4 };
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

      return { rows: rows, purchase: purchase };
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

  /* Owner, 29 Sep 2026: two tables side by side, only what stops a customer
     packet. Left, the packs with a gap and what holds each; right, the
     materials that would free them. A line runs from each material to the
     packs it frees. No actions, no highlight. */
  function Flow(f) {
    if (!f.rows.length) return '<section class="card fx"><div class="fx-none-msg">Every pack customers need is packed.</div></section>';
    /* product | sales: what customers need beyond what is packed in stock — the production demand, in kg,
       with the packs it is | production for it */
    var sp = '<section class="card fx"><div class="tbl-wrap"><table><thead><tr><th>Product</th><th>Sales over stock</th><th>Production for it</th></tr></thead><tbody>' +
      f.rows.map(function (r) {
        return '<tr><th scope="row">' + esc(r.name) + '</th><td data-label="Sales over stock"><span class="fx-need"><b>' + kg(r.needKg) + "</b> to produce</span>" +
          '<span class="fx-pks">' + r.packs.map(function (k) { return n(k.count) + " × " + esc(k.size); }).join(" · ") + "</span></td>" +
          '<td data-label="Production">' +
            (r.covered > 0.05 ? '<span class="fx-pm"><b>' + kg(r.covered) + '</b> covered' + (r.eta ? " · " + esc(r.eta) : "") + "</span>" : "") +
            (r.blocked > 0.05 ? '<span class="fx-pm blk"><b>' + kg(r.blocked) + "</b> blocked · " + esc(r.blockedBy.join(", ")) + "</span>" : "") +
            (r.notPlanned > 0.05 ? '<span class="fx-pm np"><b>' + kg(r.notPlanned) + "</b> not planned</span>" : "") + "</td></tr>";
      }).join("") + "</tbody></table></div></section>";
    /* purchase: a panel docked to the table — what to buy, and how much production it unblocks */
    var unblocks = f.rows.reduce(function (t, r) { return t + r.blocked; }, 0);
    var chit = '<aside class="fx-buy" aria-label="Buy to unblock production"><div class="fx-buy-h">Buy to unblock production</div>' + (f.purchase.length
      ? '<ul class="fx-buy-l">' + f.purchase.map(function (b) { return "<li><span>" + esc(b.name) + "</span><b>" + qty(b.order, b.unit) + "</b></li>"; }).join("") + "</ul>" +
        (unblocks > 0.05 ? '<div class="fx-buy-f">Unblocks <b>' + kg(unblocks) + "</b> of production</div>" : "")
      : '<div class="fx-buy-f">Nothing — no production waits on material.</div>') + "</aside>";
    return '<div class="fx-pair">' + sp + chit + "</div>";
  }

  /* ── render ────────────────────────────────────────────────────────── */
  function render() {
    var m = model(), w = S.lens === "week" ? weekModel() : weekModel(isoDay(Date.now()), 1);
    var needN = m.alerts.length + (m.buys.length ? 1 : 0);
    if (tabs) {
      tabs.set(S.lens);
      tabs.count("needs", needN);
      tabs.sub(S.lens === "needs" ? "What only you can sort, and who to call about it. Lines clear when the floor moves on."
        : S.lens === "flow" ? "What sales needs beyond the stock on the shelf, and how production stands on it: covered, blocked by material, or not planned." : "Who works which shift, and what each shift makes");
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
    if (sh) { S.panel = { kind: "shift", key: sh.getAttribute("data-shift") }; S.form = {}; S.ask = null; S.err = ""; render(); return; }
    var b = e.target.closest("[data-act]");
    if (!b || b.disabled) return;
    var act = b.getAttribute("data-act");
    if (act === "lens") { S.lens = b.getAttribute("data-lens"); S.panel = null; S.err = ""; window.scrollTo(0, 0); }
    else if (act === "wk") { var by = +b.getAttribute("data-by"); S.from = by ? addDays(S.from, by) : monday(Date.now()); }
    else if (act === "settings") { S.panel = { kind: "settings", edit: null }; S.form = {}; S.err = ""; }
    else if (act === "close") { S.panel = null; S.ask = null; S.form = {}; S.err = ""; }
    else if (act === "schedule") { var id = b.getAttribute("data-id"), sel = app.querySelector('[data-sched="' + id + '"]'); if (schedule(id, sel ? sel.value : b.getAttribute("data-key"))) { delete S.sched[id]; S.change = null; } }
    else if (act === "change") S.change = b.getAttribute("data-id");
    else if (act === "nsAll") S.nsAll = !S.nsAll;
    else if (act === "nsAsk") S.nsAsk = !!b.getAttribute("data-on");
    else if (act === "schedAll") {
      var w0 = weekModel(), sg = suggestAll(w0), picks = w0.tray.map(function (x) { return [x.id, S.sched[x.id] || (sg[x.id] && sg[x.id].key)]; }).filter(function (x) { return x[1]; });
      write(function (D) { picks.forEach(function (x) { var k = keyOf(x[1]); D.schedule(x[0], k.date, k.slot, "admin"); }); });
      S.nsAsk = false; S.sched = {}; S.change = null;
    }
    else if (act === "openday") { var dt = b.getAttribute("data-date"); write(function (D) { D.openDay(dt); }); }
    else if (act === "restore") { var rk = keyOf(b.getAttribute("data-key")); write(function (D) { var x = D.findSlot(rk.date, rk.slot); if (x) { x.status = "scheduled"; delete x.cancelled; } }); }
    else if (S.panel) panelAct(act, b);
    render();
  });
  app.addEventListener("input", function (e) {
    var f = e.target.getAttribute("data-f");
    if (!f) return;
    S.form[f] = e.target.value;
    if (f === "text") { var go_ = app.querySelector('.sp-ask [data-act="do"]'); if (go_ && S.ask === "stop") go_.disabled = !e.target.value.trim(); }
  });
  app.addEventListener("change", function (e) {
    var t = e.target;
    if (t.hasAttribute("data-sched")) { S.sched[t.getAttribute("data-sched")] = t.value; return; }
    if (t.hasAttribute("data-move")) { if (t.value) { schedule(t.getAttribute("data-move"), t.value); render(); } return; }
    var f = t.getAttribute("data-f");
    if (f && f !== "text" && f !== "name") { S.form[f] = t.value; render(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && S.panel) { S.panel = null; S.ask = null; S.form = {}; S.err = ""; render(); }
  });

  /* the floor moves while the office watches */
  window.addEventListener("storage", function (e) { if (e.key === FB_PRODUCTION.KEY && !S.panel) render(); });
  setInterval(function () { if (document.visibilityState === "visible" && !S.panel && !(document.activeElement && /^(SELECT|INPUT)$/.test(document.activeElement.tagName))) render(); }, 30000);
  render();
})();

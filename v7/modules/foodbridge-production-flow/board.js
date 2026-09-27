/* Production — the board (28 Sep 2026).
 *
 * One page instead of Production Plan, Shifts and Shop Floor, cut to what an
 * owner needs at a glance (owner's review, 28 Sep 2026):
 *   Needs you   one line each, and one thing to do: call the person who can
 *               sort it — the worker, the batch's supervisor, the purchase
 *               person. Lines clear themselves when the floor moves on.
 *   On the floor → To start → Done today   a batch's life, one line of "what
 *               is happening now" per batch.
 *   Crew today  who is in, and on what; the worker-app QR.
 *   This week   the plan: sell, make, buy.
 * The board starts nothing itself. A batch starts in Batches (its own Start,
 * with the supervisor hand-over), and a new batch is made in Batches' Create
 * batch — the board opens them there.
 */
(function () {
  "use strict";

  var app = document.getElementById("app");
  var S = { lens: "today", qr: false };

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
  function spark(weekly) {
    var max = Math.max.apply(null, weekly.concat([1]));
    return '<span class="spark">' + weekly.map(function (w) { return '<i style="height:' + Math.max(3, Math.round(w / max * 22)) + 'px"></i>'; }).join("") + "</span>";
  }
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
  function workerAppUrl() {
    try { if (window.parent !== window && window.parent.document.querySelector("[data-frame]")) return window.parent.location.href.split("#")[0] + "#/worker-app"; } catch (e) {}
    return new URL("../jobflow-worker-management/worker-app/index.html", location.href).href;
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
        var wf = D.workflowFor(b), steps = (wf ? wf.steps.slice() : []).sort(function (a, c) { return a.order - c.order; });
        var done = 0, now = null;
        steps.forEach(function (st) {
          var mine = ts.filter(function (t) { return t.stepOrder === st.order; });
          if (mine.some(function (t) { return t.status === "done"; })) { done += 1; return; }
          var run = mine.filter(function (t) { return t.status === "in_progress"; })[0];
          var av = mine.filter(function (t) { return t.status === "available"; })[0];
          if (!now && run) now = { step: st.name, who: run.assignedName, since: run.startedAt, waiting: false };
          if (!now && av) now = { step: st.name, since: av.availableAt, waiting: true };
        });
        floor.push({ b: b, done: done, of: steps.length, now: now, held: b.stateId === "on-hold" });
        onFloor[b.id] = true;
      });

      /* to start: planned batches, soonest first */
      var planned = d.batches.filter(function (b) { return (b.stateId === "planned" || b.stateId === "in-progress") && !onFloor[b.id]; })
        .sort(function (a, c) { return String(a.plannedDate).localeCompare(String(c.plannedDate)) || a._seq - c._seq; });

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

      return { plan: plan, alerts: alerts, floor: floor, planned: planned, doneToday: doneToday, crew: crew,
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
    return '<section class="card needs"><header><h2>Needs you · ' + rows.length + "</h2></header>" + rows.join("") + "</section>";
  }

  function Floor(m) {
    var cards = m.floor.map(function (f) {
      var b = f.b, late = f.now && f.now.waiting && mins(f.now.since) > 20;
      var line = f.held ? '<span class="now bad">On hold</span>'
        : !f.now ? '<span class="now">Finishing up</span>'
        : f.now.waiting ? '<span class="now ' + (late ? "late" : "") + '">' + esc(f.now.step) + " · waiting for someone · " + ago(f.now.since) + "</span>"
        : '<span class="now"><i></i>' + esc(f.now.who) + " · " + esc(f.now.step) + " · since " + time(f.now.since) + "</span>";
      return '<button type="button" class="bc link" data-batch="' + b.id + '"><span class="t"><b>' + esc(b.displayName) + '</b><span class="m">' + (b.kind === "packing" ? n(b.packets) + " packets" : kg(b.batchSize)) + "</span></span>" +
        '<span class="prog"><span class="track"><i style="width:' + (f.of ? Math.round(f.done / f.of * 100) : 0) + '%"></i></span><span class="m">' + f.done + " of " + f.of + "</span></span>" + line + "</button>";
    });
    return '<div class="col"><h2>On the floor <span>' + cards.length + '</span></h2><div class="stack">' +
      (cards.length ? cards.join("") : '<div class="empty">Nothing on the floor right now.</div>') + "</div></div>";
  }

  function ToStart(m) {
    var t0 = new Date(), today = t0.getFullYear() + "-" + String(t0.getMonth() + 1).padStart(2, "0") + "-" + String(t0.getDate()).padStart(2, "0");
    var cards = m.planned.map(function (b) {
      var when = !b.plannedDate || b.plannedDate.slice(0, 10) <= today ? "Planned for today" : "Planned for " + new Date(b.plannedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      return '<button type="button" class="bc link" data-batch="' + b.id + '"><span class="t"><b>' + esc(b.displayName) + '</b><span class="m">' + (b.kind === "packing" ? n(b.packets) + " packets" : kg(b.batchSize)) + "</span></span>" +
        '<span class="now">' + when + (b.operator ? " · " + esc(b.operator) : "") + '</span><span class="open">Open to start ›</span></button>';
    });
    return '<div class="col"><h2>To start <span>' + cards.length + '</span></h2><div class="stack">' +
      (cards.length ? cards.join("") : '<div class="empty">Nothing waiting to start. Plan what to make in This week.</div>') + "</div></div>";
  }

  function Done(m) {
    var cards = m.doneToday.map(function (x) {
      var b = x.b;
      return '<button type="button" class="bc link" data-batch="' + b.id + '"><span class="t"><b>' + esc(b.displayName) + '</b><span class="m">✓</span></span>' +
        '<span class="now">' + (b.kind === "packing" ? n(x.packets) + " packets packed" : kg(x.kg) + " into the freezer · " + x.bags + " bag" + (x.bags === 1 ? "" : "s")) +
        (x.loss != null ? ' · <span class="' + (x.over ? "late" : "") + '">lost ' + x.loss + "%</span>" : "") + "</span></button>";
    });
    return '<div class="col"><h2>Done today <span>' + cards.length + '</span></h2><div class="stack">' +
      (cards.length ? cards.join("") : '<div class="empty">Nothing finished yet today.</div>') + "</div></div>";
  }

  function Crew(m) {
    var ins = m.crew.filter(function (c) { return c.in; });
    return '<section class="card"><div class="crew"><span class="cap">Crew today<small>' + ins.length + " in</small></span>" +
      ins.map(function (c) { return '<span class="p ' + (c.on ? "" : "free") + '"><i></i>' + esc(c.name) + " <em>· " + (c.on ? esc(c.on) : "free") + "</em></span>"; }).join("") +
      '<button type="button" class="linkbtn qrbtn" data-act="qr">' + (S.qr ? "Hide worker app QR" : "Worker app QR") + "</button></div>" +
      (S.qr ? '<div class="qr"><div class="box" data-qr></div><div><p>Workers scan this and sign in with their phone number and PIN.</p><a href="' + esc(workerAppUrl()) + '" target="_top">Open worker app ›</a></div></div>' : "") +
      "</section>";
  }

  /* ── This week ─────────────────────────────────────────────────────── */
  function Week(m) {
    var p = m.plan;
    var sell = p.skus.map(function (s) {
      return "<tr><td><b>" + esc(s.name) + "</b></td><td>" + spark(s.weekly) + '</td><td class="num">' + n(s.open) + '</td><td class="num">' + n(s.forecast) + '</td><td class="num">' + n(s.packets + s.packing) + '</td><td class="num">' +
        (s.shortPackets ? '<span class="pill short">' + n(s.shortPackets) + "</span>" : '<span class="pill ok">Covered</span>') + "</td></tr>";
    }).join("");
    var make = p.products.map(function (x) {
      return "<tr><td><b>" + esc(x.name) + '</b></td><td class="num">' + kg(x.needKg) + '</td><td class="num">' + kg(x.freezerKg + x.plannedKg) + '</td><td class="num"><b>' + kg(x.toMakeKg) + "</b></td><td>" +
        (x.batches.length ? x.batches.map(function (z) { return '<button type="button" class="btn sm" data-create="' + x.recipeId + '" data-size="' + z + '">Create ' + kg(z) + " batch ›</button>"; }).join(" ") : '<span class="pill ok">Covered</span>') + "</td></tr>";
    }).join("");
    var buy = m.buys.map(function (x) {
      return "<tr><td><b>" + esc(x.name) + '</b></td><td class="num">' + qty(x.need, x.unit) + '</td><td class="num">' + qty(x.onHand + x.ordered, x.unit) + '</td><td class="num"><b>' + qty(x.buy, x.unit) + "</b></td><td class=\"muted small\">" + esc(x.supplier || "") + "</td></tr>";
    }).join("");
    return '<section class="card"><header><h2>1 · What will we sell</h2><span class="sub">Last 4 weeks and orders in hand, in packets</span></header><div class="tbl-wrap"><table><thead><tr><th>Pack</th><th>Last 4 weeks</th><th class="num">Orders in hand</th><th class="num">Next week</th><th class="num">Packed or packing</th><th class="num">Short</th></tr></thead><tbody>' + sell + "</tbody></table></div></section>" +
      '<section class="card"><header><h2>2 · What to make</h2><span class="sub">Short, less the freezer and what is already planned. Create opens Batches.</span></header><div class="tbl-wrap"><table><thead><tr><th>Product</th><th class="num">Short</th><th class="num">Have or planned</th><th class="num">To make</th><th></th></tr></thead><tbody>' + make + "</tbody></table></div></section>" +
      '<section class="card"><header><h2>3 · What to buy</h2>' + (m.buys.length ? Call(m.purchase) : "") + "</header>" +
      (m.buys.length ? '<div class="tbl-wrap"><table><thead><tr><th>Material</th><th class="num">Needed</th><th class="num">In store or ordered</th><th class="num">Short</th><th>Supplier</th></tr></thead><tbody>' + buy + "</tbody></table></div>" : '<div class="body muted">Nothing to buy: the store and what is already ordered cover the plan.</div>') + "</section>";
  }

  /* ── render ────────────────────────────────────────────────────────── */
  function render() {
    var m = model();
    var day = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
    var needN = m.alerts.length + (m.buys.length ? 1 : 0);
    var glance = m.floor.length + " on the floor · " + m.planned.length + " to start · " + (needN ? needN + (needN === 1 ? " needs you" : " need you") : "nothing needs you");
    app.innerHTML =
      '<div class="head"><div><h1>Production</h1><p>' + esc(day) + " · " + (S.lens === "today" ? esc(glance) : "the plan for this week") + "</p></div>" +
      '<div class="lens" role="tablist"><button role="tab" data-act="lens" data-lens="today" class="' + (S.lens === "today" ? "on" : "") + '">Today</button><button role="tab" data-act="lens" data-lens="week" class="' + (S.lens === "week" ? "on" : "") + '">This week</button></div></div>' +
      (S.lens === "today" ? Needs(m) + '<div class="cols">' + Floor(m) + ToStart(m) + Done(m) + "</div>" + Crew(m) : Week(m));
    if (S.qr) drawQr();
  }
  function drawQr() {
    var el = app.querySelector("[data-qr]");
    if (!el || typeof QRCode === "undefined") return;
    el.innerHTML = "";
    new QRCode(el, { text: workerAppUrl(), width: 200, height: 200, colorDark: "#0f172a", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
  }

  /* ── the page only navigates: batches start and are made in Batches ── */
  app.addEventListener("click", function (e) {
    var bt = e.target.closest("[data-batch]");
    if (bt) { go("production/batch-management?batch=" + encodeURIComponent(bt.getAttribute("data-batch"))); return; }
    var cr = e.target.closest("[data-create]");
    if (cr) { go("production/batch-management?create=" + encodeURIComponent(cr.getAttribute("data-create")) + "&size=" + encodeURIComponent(cr.getAttribute("data-size"))); return; }
    var b = e.target.closest("[data-act]");
    if (!b) return;
    if (b.getAttribute("data-act") === "lens") { S.lens = b.getAttribute("data-lens"); window.scrollTo(0, 0); }
    else if (b.getAttribute("data-act") === "qr") S.qr = !S.qr;
    render();
  });

  /* the floor moves while the office watches */
  window.addEventListener("storage", function (e) { if (e.key === FB_PRODUCTION.KEY) render(); });
  setInterval(function () { if (document.visibilityState === "visible") render(); }, 30000);
  render();
})();

/* JobFlow Admin, without React — and, since 26 Sep 2026, part of Production.
 *
 * Started as a port of jobflow-admin-web/src, class for class (see
 * ../README.md for what still matches the React build). The owner's
 * "JobFlow in Production" decisions then made it the office side of the
 * shop floor, over the one production store (assets/production):
 *   · Shop Floor (was Dashboard): every batch on a live shift, step by step,
 *     grouped by line, with who · how much · when, and the floor's alerts.
 *   · Process Steps (was Workflow Editor): one set of steps per recipe, and
 *     what each step records — weight in/out, what it takes from the store,
 *     the bags it fills, the packets it packs.
 *   · Shifts: people from the roster, batches from Batch Management.
 *   · The app's own Batches page is gone: Batch Management owns batches.
 *
 * Keep tags on one line: the html`` tag drops line breaks the way JSX does,
 * and a break inside a tag would join its attributes.
 */
(function () {
  "use strict";

  var html = JF.html, raw = JF.raw;
  var api = JobFlowAPI.createClient({ server: FB_PRODUCTION.server, sessionKey: "fb.v7.jobflow.admin.session" });
  /* Signing out is remembered, so the platform's own sign-in (below) does not
     undo it on the next load. */
  var OUT_KEY = "fb.v7.jobflow.admin.signedOut";
  /* The seeded admin (jobflow-api/src/seed.js, SEED_ADMIN_*). */
  var ADMIN_EMAIL = "admin@jobflow.local", ADMIN_PASSWORD = "admin1234";

  var rootEl = document.getElementById("root");
  var app = { admin: null, ready: false, page: null, pageName: null };

  function render() { JF.morph(rootEl, App()); drawQr(); }
  function set(patch) { Object.assign(app.page, patch); render(); }
  /* For async results: update the page that asked, and redraw only if it is
     still the page on screen (React's "if (!cancelled)"). */
  function upd(s, patch) { Object.assign(s, patch); if (s === app.page) render(); }

  /* ── context/AuthContext.jsx ────────────────────────────────────────── */
  function establishSession(data) {
    api.saveSession({ admin: data.worker, accessToken: data.accessToken, refreshToken: data.refreshToken });
    app.admin = data.worker;
    try { localStorage.removeItem(OUT_KEY); } catch (e) {}
    return data.worker;
  }
  function login(email, password) { return api.adminLogin(email, password).then(establishSession); }
  function logout() {
    api.clearSession();
    app.admin = null;
    try { localStorage.setItem(OUT_KEY, "1"); } catch (e) {}
    route();
  }

  /* ── components/Button.jsx ──────────────────────────────────────────── */
  var VARIANTS = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-400",
    go: "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-600 disabled:bg-slate-200 disabled:text-slate-400",
    outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:text-slate-300",
    ghost: "bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100 disabled:text-slate-300",
  };
  function attrs(o) {
    var out = "";
    Object.keys(o || {}).forEach(function (k) {
      var v = o[k];
      if (v === false || v == null) return;
      out += " " + k + (v === true ? "" : '="' + JF.esc(v) + '"');
    });
    return raw(out);
  }
  function Button(p, children) {
    var variant = p.variant || "primary", className = p.className || "";
    var a = Object.assign({}, p); delete a.variant; delete a.className;
    return html`<button class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}"${attrs(a)}>${children}</button>`;
  }

  /* ── components/Card.jsx ────────────────────────────────────────────── */
  function Card(p, children) {
    var className = p.className || "";
    return html`<section class="rounded-2xl border border-slate-200 bg-white shadow-sm ${className}">
      ${(p.title || p.action) && html`<header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        ${p.title && html`<h2 class="text-sm font-semibold tracking-wide text-slate-700 uppercase">${p.title}</h2>`}
        ${p.action}
      </header>`}
      <div class="p-5">${children}</div>
    </section>`;
  }

  /* ── components/Modal.jsx ───────────────────────────────────────────── */
  var modalClose = null;
  function Modal(p, children) {
    if (!p.open) return "";
    modalClose = p.onClose;
    return html`<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" data-act="modal-backdrop">
      <div class="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl" data-stop role="dialog" aria-modal="true">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 class="text-base font-semibold text-slate-900">${p.title}</h2>
          <button class="text-slate-400 hover:text-slate-700" aria-label="Close" data-act="modal-close">✕</button>
        </header>
        <div class="flex-1 overflow-y-auto px-5 py-4">${children}</div>
        ${p.footer && html`<footer class="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">${p.footer}</footer>`}
      </div>
    </div>`;
  }

  /* ── components/StatCard.jsx ────────────────────────────────────────── */
  var TONES = {
    brand: "bg-brand-50 text-brand-700",
    accent: "bg-green-50 text-accent-600",
    warn: "bg-amber-50 text-warn-500",
    danger: "bg-red-50 text-danger-600",
  };
  function StatCard(label, value, icon, tone, hint) {
    return html`<div class="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${TONES[tone || "brand"]}" aria-hidden="true">${icon}</div>
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-slate-500">${label}</p>
        <p class="text-2xl font-bold text-slate-900">${value}</p>
        ${hint && html`<p class="truncate text-xs text-slate-400">${hint}</p>`}
      </div>
    </div>`;
  }

  /* ── components/StatusBadge.jsx ─────────────────────────────────────── */
  var BADGE = {
    scheduled: "bg-amber-50 text-warn-500",
    live: "bg-green-50 text-accent-600",
    ended: "bg-slate-100 text-slate-500",
  };
  function StatusBadge(status) {
    return html`<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${BADGE[status] || "bg-slate-100 text-slate-500"}">${status === "live" && html`<span class="h-1.5 w-1.5 rounded-full bg-accent-500"></span>`}${status}</span>`;
  }

  var INPUT = "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
  function errorBox(msg) {
    return msg && html`<div class="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger-600">${msg}</div>`;
  }
  function formError(msg) {
    return msg && html`<p class="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600">${msg}</p>`;
  }
  function hhmm(iso) { return iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : ""; }
  function minsSince(iso) { return iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : 0; }
  function kg(n) { return (Math.round(n * 10) / 10).toLocaleString("en-IN") + " kg"; }

  /* ── The worker app, by QR ──────────────────────────────────────────
     The worker's phone, not an office screen: opened from a QR here and on
     Shifts. Inside the platform it is the platform's own #/worker-app
     route; on its own, the app's page next to this one. */
  function workerAppUrl() {
    try {
      if (window.parent !== window && window.parent.document.querySelector("[data-frame]")) return window.parent.location.href.split("#")[0] + "#/worker-app";
    } catch (e) {}
    return new URL("../worker-app/index.html", location.href).href;
  }
  function drawQr() {
    document.querySelectorAll("[data-qr]").forEach(function (el) {
      if (el.getAttribute("data-drawn") === "1" || typeof QRCode === "undefined") return;
      el.innerHTML = "";
      new QRCode(el, { text: workerAppUrl(), width: 200, height: 200, colorDark: "#0f172a", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
      el.setAttribute("data-drawn", "1");
    });
  }
  function WorkerAppQr() {
    return html`<div class="jf-qr"><div class="jf-qr-box" data-qr data-morph-skip></div><div><p>Workers scan this on their phone and sign in with their name and PIN.</p><a href="${workerAppUrl()}" target="_top" data-open-app>Open worker app ›</a></div></div>`;
  }

  /* ── components/Sidebar.jsx (seen only outside the platform) ────────── */
  var NAV = [
    { to: "/", label: "Shop Floor", icon: "▩", end: true },
    { to: "/steps", label: "Process Steps", icon: "✎" },
    { to: "/shifts", label: "Shifts", icon: "🗓" },
  ];
  function Sidebar() {
    var here = JF.path();
    return html`<aside class="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div class="flex items-center gap-2 px-5 py-5">
        <img src="logo.svg" alt="" class="h-8 w-8">
        <span class="text-lg font-bold tracking-tight text-slate-900">Job<span class="text-brand-600">Flow</span></span>
      </div>
      <nav class="flex-1 space-y-1 px-3">
        ${NAV.map(function (item) {
          var active = item.end ? here === item.to : here === item.to || here.indexOf(item.to + "/") === 0;
          return html`<a href="#${item.to}"${attrs({ "aria-current": active ? "page" : null })} class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}"><span class="w-5 text-center text-base" aria-hidden="true">${item.icon}</span>${item.label}</a>`;
        })}
      </nav>
      <p class="px-5 py-4 text-xs text-slate-400">JobFlow Admin v1.0</p>
    </aside>`;
  }

  /* ── components/AdminLayout.jsx ─────────────────────────────────────── */
  function AdminLayout(outlet) {
    var initial = (app.admin && app.admin.name && app.admin.name[0] ? app.admin.name[0].toUpperCase() : "A");
    return html`<div class="flex h-dvh w-full overflow-hidden">
      ${Sidebar()}
      <div class="flex min-w-0 flex-1 flex-col">
        <header class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
          <div class="text-sm text-slate-500">Signed in as <span class="font-medium text-slate-700">${app.admin && app.admin.name}</span></div>
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">${initial}</div>
            <button class="text-sm font-medium text-slate-500 hover:text-slate-900" data-act="logout">Sign out</button>
          </div>
        </header>
        <main class="flex-1 overflow-y-auto p-6">${outlet}</main>
      </div>
    </div>`;
  }

  /* ── pages/Login.jsx ────────────────────────────────────────────────── */
  var Login = {
    init: function () { return { email: "", password: "", error: "", busy: false }; },
    view: function (s) {
      return html`<div class="flex min-h-dvh items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800 p-4">
        <div class="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
          <div class="mb-6 flex items-center gap-2">
            <img src="logo.svg" alt="" class="h-9 w-9">
            <span class="text-xl font-bold tracking-tight text-slate-900">Job<span class="text-brand-600">Flow</span> Admin</span>
          </div>
          <form class="space-y-4" data-form="login">
            <div>
              <label for="email" class="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input id="email" type="email" autocomplete="username" required value="${s.email}" data-model="email" class="${INPUT}" placeholder="admin@jobflow.local">
            </div>
            <div>
              <label for="password" class="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input id="password" type="password" autocomplete="current-password" required value="${s.password}" data-model="password" class="${INPUT}" placeholder="••••••••">
            </div>
            ${s.error && html`<p class="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger-600">${s.error}</p>`}
            ${Button({ type: "submit", disabled: s.busy, className: "w-full" }, s.busy ? "Signing in…" : "Sign in")}
          </form>
        </div>
      </div>`;
    },
    submit: function (s) {
      set({ error: "", busy: true });
      login(s.email.trim(), s.password)
        .then(function () { route(); })
        .catch(function (err) { upd(s, { error: err.message }); })
        .then(function () { upd(s, { busy: false }); });
    },
  };

  /* ── Shop Floor (was pages/Dashboard.jsx) ───────────────────────────── */
  var ALERT_TAG = { weight_loss: ["weight loss", "bad"], waiting: ["waiting", "warn"], on_hold: ["on hold", "warn"] };
  function stepChip(t) {
    var over = t.status === "done" && t.weigh && t.loss != null && t.lossPct > t.loss;
    var cls = t.status === "done" ? (over ? "done over" : "done") : t.status === "in_progress" ? "now" : t.status === "available" ? "avail" : "lock";
    var lines = [];
    if (t.status === "done") {
      lines.push(html`<span class="x">${t.assignedName || "—"} · ${hhmm(t.completedAt)}</span>`);
      if (t.kgIn) lines.push(html`<span class="k">${t.kgIn} → ${t.kgOut} kg</span>`);
      if (t.kgIn) lines.push(html`<span class="k ${over ? "loss" : ""}">−${t.lossPct}%${t.loss != null ? " (≤" + t.loss + "%)" : ""}</span>`);
      if (t.lots && t.lots.length && !t.sticksUsed) lines.push(html`<span class="k">lot ${t.lots.slice(0, 2).map(function (l) { return l.lotNo; }).join(", ")}${t.lots.length > 2 ? " +" + (t.lots.length - 2) : ""}</span>`);
      if (t.sticksUsed) lines.push(html`<span class="k">${t.sticksUsed} sticks</span>`);
      if (t.bagsMade) lines.push(html`<span class="k">${t.bagsMade.length} bags · ${t.kgOut} kg</span>`);
      if (t.packets) lines.push(html`<span class="k">${t.packets} packets</span>`);
      if (t.cartonsPacked) lines.push(html`<span class="k">${t.cartonsPacked} cartons</span>`);
    } else if (t.status === "in_progress") {
      lines.push(html`<span class="x">${t.assignedName || "—"} · since ${hhmm(t.startedAt)}</span>`);
    } else if (t.status === "available") {
      lines.push(html`<span class="x">waiting ${minsSince(t.availableAt)} min</span>`);
    } else {
      lines.push(html`<span class="x">${t.bags ? t.bags + " kg bags" : "locked"}</span>`);
    }
    return html`<div class="jf-step ${cls}"><span class="n">${t.stepName}</span>${lines}</div>`;
  }
  function lanePill(b, tasks) {
    if (b.stateId === "on-hold") return html`<span class="jf-pill warn">On hold</span>`;
    if (b.stateId === "completed" || b.stateId === "closed") return html`<span class="jf-pill done">Done</span>`;
    var done = tasks.filter(function (t) { return t.status === "done"; }).length;
    if (!tasks.some(function (t) { return t.status === "in_progress" || t.status === "done"; })) return html`<span class="jf-pill wait">Not started</span>`;
    return html`<span class="jf-pill run">In progress · ${done} / ${tasks.length}</span>`;
  }
  var ShopFloor = {
    init: function () { return { loading: true, error: "", shifts: [], lanes: [], alerts: [], freezer: [] }; },
    load: function (s) {
      Promise.all([api.listShifts("live"), api.listAlerts()]).then(function (r) {
        var shifts = r[0];
        var ids = [], shiftOf = {};
        shifts.forEach(function (sh) { sh.batches.forEach(function (b) { if (ids.indexOf(b._id) === -1) { ids.push(b._id); shiftOf[b._id] = sh; } }); });
        return Promise.all(ids.map(function (id) { return api.listTasks({ batch: id, shift: shiftOf[id]._id }); })).then(function (lists) {
          var batches = FB_PRODUCTION.read(function (D, d) {
            s.freezer = d.recipeOrder.map(function (rid) { var bags = D.bagsFIFO(rid); return { name: D.book(rid).name, kg: D.inFreezer(rid), bags: bags.length, oldest: bags[0] ? bags[0].madeAt : null }; });
            return ids.map(function (id) { return D.batch(id); });
          });
          s.shifts = shifts; s.alerts = r[1];
          s.lanes = ids.map(function (id, i) { return { batch: batches[i], tasks: lists[i], shift: shiftOf[id] }; }).filter(function (l) { return l.batch; });
        });
      }).catch(function (err) { s.error = err.message; })
        .then(function () { upd(s, { loading: false }); drawQr(); });
    },
    view: function (s) {
      var online = {};
      s.shifts.forEach(function (sh) { sh.workers.forEach(function (w) { if (w.isOnline) online[w._id] = 1; }); });
      var active = s.lanes.filter(function (l) { return ["completed", "closed"].indexOf(l.batch.stateId) === -1; }).length;
      var lines = [];
      s.lanes.forEach(function (l) { var name = l.batch.line || "Other"; if (lines.indexOf(name) === -1) lines.push(name); });
      return html`<div class="mx-auto max-w-7xl space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Shop Floor</h1>
            <p class="text-sm text-slate-500">Every batch on a live shift, step by step: who did it, how much, and when.</p>
          </div>
          ${Button({ "data-go": "/shifts" }, "+ New Shift")}
        </div>
        ${errorBox(s.error)}
        ${s.loading ? html`<p class="text-sm text-slate-400">Loading the floor…</p>` : [
          html`<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            ${StatCard("Live Shifts", s.shifts.length, "🟢", "accent")}
            ${StatCard("Batches on the floor", active, "📦", "brand")}
            ${StatCard("Workers Online", Object.keys(online).length, "👷", "brand")}
            ${StatCard("Needs you", s.alerts.length, "⚠️", s.alerts.length > 0 ? "danger" : "accent")}
          </div>`,
          html`<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="space-y-6 lg:col-span-2">
              ${Card({ title: "On the floor now" }, s.lanes.length === 0 ? html`<p class="jf-empty">No live shift right now. Publish one on Shifts.</p>` : lines.map(function (line) {
                var mine = s.lanes.filter(function (l) { return (l.batch.line || "Other") === line; });
                return html`<div class="jf-line">
                  <div class="jf-line-h"><h3>${line}</h3><span>${mine.length} ${mine.length === 1 ? "batch" : "batches"}</span></div>
                  ${mine.map(function (l) {
                    var b = l.batch;
                    return html`<div class="jf-lane">
                      <div class="jf-lane-h">
                        <div class="jf-lane-t"><b>${b.displayName}</b><span class="jf-code">${b.batchNumber} · ${b.kind === "packing" ? b.packets + " packets" : b.batchSize + " kg"} · ${l.shift.name}</span></div>
                        ${lanePill(b, l.tasks)}
                      </div>
                      <div class="jf-steps">${l.tasks.map(stepChip)}</div>
                    </div>`;
                  })}
                </div>`;
              }))}
            </div>
            <div class="space-y-6">
              ${Card({ title: "Needs you" }, s.alerts.length === 0 ? html`<p class="py-2 text-sm text-slate-400">All clear on the floor.</p>` : html`<ul class="space-y-3">${s.alerts.map(function (a) {
                var tag = ALERT_TAG[a.type] || [a.type, "warn"];
                return html`<li class="flex items-start gap-3"><span class="jf-alert-tag ${tag[1]}">${tag[0]}</span><p class="text-sm text-slate-700">${a.message}</p></li>`;
              })}</ul>`)}
              ${Card({ title: "In the freezer" }, [
                s.freezer.map(function (f) { return html`<div class="jf-kv"><span>${f.name}<small>${f.bags} ${f.bags === 1 ? "bag" : "bags"}${f.oldest ? " · oldest " + new Date(f.oldest).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : ""}</small></span><b>${kg(f.kg)}</b></div>`; }),
                html`<p class="jf-hint" style="margin-top:10px">Packing takes the oldest bags first.</p>`,
              ])}
              ${Card({ title: "Worker app" }, WorkerAppQr())}
            </div>
          </div>`,
        ]}
      </div>`;
    },
  };

  /* ── Shifts (pages/Shifts.jsx + components/ShiftForm.jsx) ───────────── */
  function toLocalInput(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var p2 = function (n) { return String(n).padStart(2, "0"); };
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) + "T" + p2(d.getHours()) + ":" + p2(d.getMinutes());
  }
  var ROLE_ORDER = FB_PRODUCTION.FACTORY_ROLES;
  function shiftFormState(initial) {
    return {
      name: (initial && initial.name) || "",
      startTime: toLocalInput(initial && initial.startTime),
      assigned: ((initial && initial.workers) || []).map(function (w) { return w._id || w; }),
      assignedBatches: ((initial && initial.batches) || []).map(function (b) { return b._id || b; }),
    };
  }
  function toggleIn(list, id) {
    var i = list.indexOf(id);
    return i === -1 ? list.concat([id]) : list.slice(0, i).concat(list.slice(i + 1));
  }
  var STATE_TONE = { planned: "text-slate-400", "in-progress": "text-accent-600", "on-hold": "text-warn-500" };
  function ShiftForm(f, workers, batches, formId) {
    var byRole = {};
    workers.forEach(function (w) { (byRole[w.role] = byRole[w.role] || []).push(w); });
    var roles = ROLE_ORDER.filter(function (r) { return byRole[r]; })
      .concat(Object.keys(byRole).filter(function (r) { return ROLE_ORDER.indexOf(r) === -1; }));
    /* a batch already on this shift stays listed even once it is done */
    var list = batches.filter(function (b) { return ["planned", "in-progress", "on-hold"].indexOf(b.stateId) !== -1 || f.assignedBatches.indexOf(b._id) !== -1; });
    var CHECK = "h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500";
    return html`<form id="${formId}" class="space-y-5" data-form="shift">
      <div>
        <label for="shift-name" class="mb-1 block text-sm font-medium text-slate-700">Shift name</label>
        <input id="shift-name" type="text" required value="${f.name}" data-model="form.name" placeholder="Morning Shift — Day 3" class="${INPUT}">
      </div>
      <div>
        <label for="shift-start" class="mb-1 block text-sm font-medium text-slate-700">Start time</label>
        <input id="shift-start" type="datetime-local" required value="${f.startTime}" data-model="form.startTime" class="${INPUT}">
      </div>
      <div>
        <div class="mb-1 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-700">Assign workers</span>
          <span class="text-xs text-slate-400">${f.assigned.length} selected</span>
        </div>
        ${workers.length === 0 ? html`<p class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">No factory staff yet. Add them in Workforce Management.</p>` : html`<div class="max-h-56 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3">${roles.map(function (role) {
          return html`<div>
            <p class="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">${role}</p>
            <div class="space-y-1">${byRole[role].map(function (w) {
              return html`<label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50"><input type="checkbox"${attrs({ checked: f.assigned.indexOf(w._id) !== -1 })} data-toggle="assigned" data-id="${w._id}" class="${CHECK}"><span class="text-sm text-slate-700">${w.name}</span>${w.isOnline && html`<span class="ml-auto text-xs text-accent-600">online</span>`}</label>`;
            })}</div>
          </div>`;
        })}</div>`}
      </div>
      <div>
        <div class="mb-1 flex items-center justify-between">
          <span class="text-sm font-medium text-slate-700">Assign batches</span>
          <span class="text-xs text-slate-400">${f.assignedBatches.length} selected</span>
        </div>
        ${list.length === 0 ? html`<p class="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-400">No planned batches. Create a production order in Recipes, or a batch in Batch Management.</p>` : html`<div class="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-3">${list.map(function (b) {
          return html`<label class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50"><input type="checkbox"${attrs({ checked: f.assignedBatches.indexOf(b._id) !== -1 })} data-toggle="assignedBatches" data-id="${b._id}" class="${CHECK}"><span class="text-sm font-medium text-slate-700">${b.code}</span><span class="truncate text-sm text-slate-500">${b.product} · ${b.quantity}</span><span class="ml-auto text-xs ${STATE_TONE[b.stateId] || "text-slate-400"}">${b.statusLabel}</span></label>`;
        })}</div>`}
        <p class="jf-hint" style="margin-top:6px">Batches come from Batch Management. Publishing gives each one its process steps.</p>
      </div>
    </form>`;
  }
  var SHIFT_FORM = "shift-form";
  var Shifts = {
    init: function () {
      return { shifts: [], workers: [], batches: [], loading: true, error: "", mode: null, editing: null, saving: false, formError: "", busyId: null, form: null, qr: false };
    },
    load: function (s) {
      s.loading = true; s.error = ""; render();
      return Promise.all([api.listShifts(), api.listWorkers(), api.listBatches()])
        .then(function (r) { Object.assign(s, { shifts: r[0], workers: r[1], batches: r[2] }); })
        .catch(function (err) { s.error = err.message; })
        .then(function () { upd(s, { loading: false }); });
    },
    open: function (s, shift) { set({ editing: shift || null, formError: "", mode: shift ? "edit" : "create", form: shiftFormState(shift) }); },
    close: function () { set({ mode: null, editing: null, qr: false }); },
    submit: function (s) {
      var f = s.form;
      var payload = { name: f.name.trim(), startTime: new Date(f.startTime).toISOString(), workers: f.assigned.slice(), batches: f.assignedBatches.slice() };
      set({ saving: true, formError: "" });
      (s.mode === "edit" && s.editing ? api.updateShift(s.editing._id, payload) : api.createShift(payload))
        .then(function () { Shifts.close(); return Shifts.load(s); })
        .catch(function (err) { s.formError = err.message; })
        .then(function () { upd(s, { saving: false }); });
    },
    run: function (s, id, fn) {
      set({ busyId: id, error: "" });
      fn().then(function () { return Shifts.load(s); })
        .catch(function (err) { s.error = err.message; })
        .then(function () { upd(s, { busyId: null }); });
    },
    view: function (s) {
      return html`<div class="mx-auto max-w-7xl space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Shifts</h1>
            <p class="text-sm text-slate-500">Who works when, on which batches. Publishing puts the steps on the floor.</p>
          </div>
          <div class="flex items-center gap-2">
            ${Button({ variant: "outline", "data-act": "show-qr" }, "Worker app")}
            ${Button({ "data-act": "shift-new" }, "+ New Shift")}
          </div>
        </div>
        ${errorBox(s.error)}
        ${Card({}, s.loading ? html`<p class="text-sm text-slate-400">Loading shifts…</p>` : s.shifts.length === 0 ? html`<div class="py-10 text-center">
            <p class="text-sm text-slate-500">No shifts yet.</p>
            ${Button({ variant: "outline", className: "mt-3", "data-act": "shift-new" }, "Create your first shift")}
          </div>` : html`<ul class="divide-y divide-slate-100">${s.shifts.slice().reverse().map(function (shift) { return ShiftRow(shift, s.busyId === shift._id); })}</ul>`)}
        ${Modal({
          open: s.mode !== null,
          title: s.mode === "edit" ? "Edit Shift" : "New Shift",
          onClose: Shifts.close,
          footer: [
            Button({ variant: "outline", "data-act": "modal-close", disabled: s.saving }, "Cancel"),
            Button({ type: "submit", form: SHIFT_FORM, disabled: s.saving }, s.saving ? "Saving…" : s.mode === "edit" ? "Save changes" : "Create shift"),
          ],
        }, [formError(s.formError), s.form && ShiftForm(s.form, s.workers, s.batches, SHIFT_FORM)])}
        ${Modal({ open: s.qr, title: "Worker app", onClose: Shifts.close }, WorkerAppQr())}
      </div>`;
    },
  };
  function ShiftRow(shift, busy) {
    var scheduled = shift.status === "scheduled", live = shift.status === "live";
    var when = new Date(shift.startTime).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    var all = (shift.batches || []).map(function (b) { return b.code; }), codes = all.slice(0, 3).join(", ") + (all.length > 3 ? " +" + (all.length - 3) + " more" : "");
    return html`<li class="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <p class="font-medium text-slate-900">${shift.name}</p>
          ${StatusBadge(shift.status)}
        </div>
        <p class="text-xs text-slate-500">${when} · ${(shift.workers || []).length} workers · ${(shift.batches || []).length}${" "}batches${codes ? " · " + codes : ""}</p>
      </div>
      <div class="flex items-center gap-2">
        ${(scheduled || live) && Button({ variant: "outline", "data-act": "shift-edit", "data-id": shift._id, disabled: busy }, "Edit")}
        ${scheduled && [
          Button({ variant: "go", "data-act": "shift-publish", "data-id": shift._id, disabled: busy }, busy ? "Working…" : "Publish"),
          html`<button${attrs({ disabled: busy })} class="px-2 text-sm font-medium text-slate-400 hover:text-danger-600 disabled:opacity-50" title="Delete shift" data-act="shift-delete" data-id="${shift._id}">Delete</button>`,
        ]}
        ${live && html`<span class="text-xs text-slate-400">In progress</span>`}
        ${!scheduled && !live && html`<span class="text-xs text-slate-400">Completed</span>`}
      </div>
    </li>`;
  }

  /* ── Process Steps (was pages/Editor.jsx + components/StepForm.jsx) ─── */
  var STEP_FORM = "step-form";
  function stepFlags(step, materials) {
    var name = function (id) { var m = materials.filter(function (x) { return x.id === id; })[0]; return m ? m.name : id; };
    var out = [];
    if (step.weigh) out.push(html`<span class="jf-flag">kg in → out${step.loss != null ? " · ≤" + step.loss + "% loss" : ""}</span>`);
    if (step.takes && step.takes.length) out.push(html`<span class="jf-flag store">takes ${step.takes.map(name).join(", ")}</span>`);
    if (step.sticks) out.push(html`<span class="jf-flag store">counts sticks</span>`);
    if (step.bags) out.push(html`<span class="jf-flag bag">fills ${step.bags} kg bags</span>`);
    if (step.pack) out.push(html`<span class="jf-flag bag">packs from oldest bags</span>`);
    if (step.cartons) out.push(html`<span class="jf-flag bag">cartons → finished goods</span>`);
    return out.length ? html`<span class="jf-flags">${out}</span>` : "";
  }
  var Steps = {
    init: function () {
      return {
        workflows: [], recipes: [], materials: [], selectedId: null, selected: null, loadingList: true, loadingWf: false, error: "", busy: false,
        newOpen: false, newRecipe: "", creating: false,
        stepMode: null, editingStep: null, savingStep: false, stepError: "", step: null,
      };
    },
    load: function (s) {
      s.loadingList = true; s.error = ""; render();
      Promise.all([api.listWorkflows(), api.listRecipes(), api.listMaterials()])
        .then(function (r) {
          s.workflows = r[0]; s.recipes = r[1]; s.materials = r[2];
          Steps.select(s, s.selectedId != null ? s.selectedId : (r[0][0] && r[0][0]._id) || null, true);
        })
        .catch(function (err) { s.error = err.message; })
        .then(function () { upd(s, { loadingList: false }); });
    },
    select: function (s, id, quiet) {
      if (s.selectedId === id && s.selected) { if (!quiet) render(); return; }
      s.selectedId = id;
      if (!id) { s.selected = null; if (!quiet) render(); return; }
      s.loadingWf = true;
      if (!quiet) render();
      api.getWorkflow(id)
        .then(function (wf) { if (s.selectedId === id) s.selected = wf; })
        .catch(function (err) { if (s.selectedId === id) s.error = err.message; })
        .then(function () { if (s.selectedId === id) upd(s, { loadingWf: false }); });
    },
    apply: function (s, wf) {
      s.selected = wf;
      s.workflows = s.workflows.map(function (w) { return w._id === wf._id ? wf : w; });
    },
    runStep: function (s, fn) {
      set({ busy: true, error: "" });
      return fn().then(function (wf) { Steps.apply(s, wf); })
        .catch(function (err) { s.error = err.message; })
        .then(function () { upd(s, { busy: false }); });
    },
    createWorkflow: function (s) {
      set({ creating: true, error: "" });
      api.createWorkflow({ recipeId: s.newRecipe })
        .then(function (wf) {
          s.workflows = s.workflows.concat([wf]);
          s.recipes = s.recipes.map(function (r) { return r.id === wf.recipeId ? Object.assign({}, r, { hasSteps: true }) : r; });
          s.newOpen = false; s.newRecipe = "";
          Steps.select(s, wf._id, true);
        })
        .catch(function (err) { s.error = err.message; })
        .then(function () { upd(s, { creating: false }); });
    },
    removeWorkflow: function (s) {
      if (!s.selected) return;
      var id = s.selected._id, rid = s.selected.recipeId;
      set({ busy: true, error: "" });
      api.deleteWorkflow(id)
        .then(function () {
          var remaining = s.workflows.filter(function (w) { return w._id !== id; });
          s.workflows = remaining;
          s.recipes = s.recipes.map(function (r) { return r.id === rid ? Object.assign({}, r, { hasSteps: false }) : r; });
          Steps.select(s, (remaining[0] && remaining[0]._id) || null, true);
        })
        .catch(function (err) { s.error = err.message; })
        .then(function () { upd(s, { busy: false }); });
    },
    openStep: function (s, step) {
      set({
        editingStep: step || null, stepError: "", stepMode: step ? "edit" : "create",
        step: {
          name: (step && step.name) || "",
          role: (step && step.role) || ROLE_ORDER[0],
          expectedMinutes: step && step.expectedMinutes != null ? String(step.expectedMinutes) : "45",
          instructions: (step && step.instructions) || "",
          unlocksNext: step && step.unlocksNext != null ? step.unlocksNext : true,
          weigh: !!(step && step.weigh),
          loss: step && step.loss != null ? String(step.loss) : "",
          takes: (step && step.takes) ? step.takes.slice() : [],
          sticks: !!(step && step.sticks),
          bags: step && step.bags ? String(step.bags) : "",
          pack: !!(step && step.pack),
          cartons: !!(step && step.cartons),
        },
      });
    },
    closeStep: function () { set({ stepMode: null, editingStep: null, newOpen: false }); },
    submitStep: function (s) {
      if (!s.selected) return;
      var f = s.step;
      var payload = { name: f.name.trim(), role: f.role, expectedMinutes: Number(f.expectedMinutes), instructions: f.instructions.trim(), unlocksNext: f.unlocksNext,
        weigh: f.weigh, loss: f.weigh && f.loss !== "" ? Number(f.loss) : null, takes: f.weigh ? f.takes.slice() : [], sticks: f.sticks, bags: f.bags ? Number(f.bags) : null, pack: f.pack, cartons: f.cartons };
      set({ savingStep: true, stepError: "" });
      (s.stepMode === "edit" ? api.updateStep(s.selected._id, s.editingStep._id, payload) : api.addStep(s.selected._id, payload))
        .then(function (wf) { Steps.apply(s, wf); s.stepMode = null; s.editingStep = null; })
        .catch(function (err) { s.stepError = err.message; })
        .then(function () { upd(s, { savingStep: false }); });
    },
    move: function (s, index, dir) {
      var steps = s.selected.steps, target = index + dir;
      if (target < 0 || target >= steps.length) return;
      var ids = steps.map(function (x) { return x._id; });
      var t = ids[index]; ids[index] = ids[target]; ids[target] = t;
      Steps.runStep(s, function () { return api.reorderSteps(s.selected._id, ids); });
    },
    view: function (s) {
      var sel = s.selected;
      var free = s.recipes.filter(function (r) { return !r.hasSteps; });
      var recipe = sel && s.recipes.filter(function (r) { return r.id === sel.recipeId; })[0];
      return html`<div class="mx-auto max-w-7xl space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">Process Steps</h1>
            <p class="text-sm text-slate-500">How each recipe is made on the floor: steps, who does them, and what each one records.</p>
          </div>
          ${Button({ "data-act": "wf-new", disabled: free.length === 0, title: free.length === 0 ? "Every recipe has its steps" : null }, "+ Steps for a recipe")}
        </div>
        ${errorBox(s.error)}
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          ${Card({ title: "Recipes", className: "lg:col-span-1" }, s.loadingList ? html`<p class="text-sm text-slate-400">Loading…</p>`
            : s.workflows.length === 0 ? html`<p class="py-2 text-sm text-slate-400">No steps yet.</p>`
            : html`<ul class="space-y-1">${s.workflows.map(function (wf) {
              return html`<li><button class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${wf._id === s.selectedId ? "bg-brand-50 font-medium text-brand-700" : "text-slate-600 hover:bg-slate-50"}" data-act="wf-select" data-id="${wf._id}"><span class="truncate">${wf.product}</span><span class="ml-2 shrink-0 text-xs text-slate-400">${(wf.steps || []).length} steps</span></button></li>`;
            })}</ul>`)}
          <div class="lg:col-span-2">
            ${!sel ? Card({}, html`<p class="py-10 text-center text-sm text-slate-400">${s.loadingWf ? "Loading…" : "Pick a recipe to see its steps."}</p>`)
              : Card({ title: "Steps", action: Button({ variant: "outline", "data-act": "step-new", disabled: s.busy }, "+ Add Step") }, [
                html`<div class="mb-5 flex items-end gap-3">
                  <div class="flex-1">
                    <p class="mb-1 block text-xs font-medium text-slate-500">${sel.kind === "packing" ? "Used by" : "Recipe"}</p>
                    <p class="text-sm font-medium text-slate-900">${sel.kind === "packing" ? "Every packing order, whatever the product" : sel.product}${recipe ? " · " + recipe.line : ""}</p>
                  </div>
                  ${sel.kind !== "packing" && html`<button${attrs({ disabled: s.busy })} class="pb-2 text-sm font-medium text-slate-400 hover:text-danger-600 disabled:opacity-50" data-act="wf-delete">Delete</button>`}
                </div>`,
                sel.steps.length === 0 ? html`<p class="rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-400">No steps yet — add the first one.</p>`
                  : html`<ol class="space-y-2">${sel.steps.map(function (step, i) { return StepRow(step, i, sel.steps.length, s.busy, s.materials); })}</ol>`,
              ])}
          </div>
        </div>
        ${Modal({
          open: s.newOpen,
          title: "Steps for a recipe",
          onClose: Steps.closeStep,
          footer: [
            Button({ variant: "outline", "data-act": "modal-close", disabled: s.creating }, "Cancel"),
            Button({ type: "submit", form: "new-workflow-form", disabled: s.creating || !s.newRecipe }, s.creating ? "Creating…" : "Create"),
          ],
        }, html`<form id="new-workflow-form" data-form="new-workflow">
          <label for="new-recipe" class="mb-1 block text-sm font-medium text-slate-700">Recipe</label>
          <select id="new-recipe" required data-value="${s.newRecipe}" data-model="newRecipe" class="${INPUT}"><option value=""${attrs({ selected: !s.newRecipe })}>Pick a recipe</option>${free.map(function (r) { return html`<option value="${r.id}"${attrs({ selected: r.id === s.newRecipe })}>${r.name} · ${r.line}</option>`; })}</select>
          <p class="jf-hint" style="margin-top:8px">Recipes come from Configure Recipe. A recipe gets one set of steps.</p>
        </form>`)}
        ${Modal({
          open: s.stepMode !== null,
          title: s.stepMode === "edit" ? "Edit Step" : "Add Step",
          onClose: Steps.closeStep,
          footer: [
            Button({ variant: "outline", "data-act": "modal-close", disabled: s.savingStep }, "Cancel"),
            Button({ type: "submit", form: STEP_FORM, disabled: s.savingStep }, s.savingStep ? "Saving…" : s.stepMode === "edit" ? "Save changes" : "Add step"),
          ],
        }, [formError(s.stepError), s.step && StepForm(s.step, sel, recipe, s.materials)])}
      </div>`;
    },
  };
  function StepForm(f, wf, recipe, materials) {
    var mats = recipe ? recipe.ingredients.filter(function (i) { return i.rmId; }).map(function (i) { return materials.filter(function (m) { return m.id === i.rmId; })[0]; }).filter(Boolean) : [];
    var packing = wf && wf.kind === "packing";
    return html`<form id="${STEP_FORM}" class="space-y-4" data-form="step">
      <div>
        <label for="step-name" class="mb-1 block text-sm font-medium text-slate-700">Step name</label>
        <input id="step-name" type="text" required value="${f.name}" data-model="step.name" placeholder="Peel · cut · wash" class="${INPUT}">
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label for="step-role" class="mb-1 block text-sm font-medium text-slate-700">Usually done by</label>
          <select id="step-role" data-value="${f.role}" data-model="step.role" class="${INPUT}">${ROLE_ORDER.map(function (r) {
            return html`<option value="${r}"${attrs({ selected: r === f.role })} class="capitalize">${r}</option>`;
          })}</select>
        </div>
        <div>
          <label for="step-minutes" class="mb-1 block text-sm font-medium text-slate-700">Expected time (min)</label>
          <input id="step-minutes" type="number" min="1" required value="${f.expectedMinutes}" data-model="step.expectedMinutes" class="${INPUT}">
        </div>
      </div>
      <div>
        <label for="step-instructions" class="mb-1 block text-sm font-medium text-slate-700">Instructions <span class="font-normal text-slate-400">(optional)</span></label>
        <textarea id="step-instructions" rows="3" data-model="step.instructions" placeholder="Weigh the crates before you start…" class="${INPUT}">${f.instructions}</textarea>
      </div>
      <div class="jf-fieldset">
        <p>What the worker records</p>
        ${packing ? [
          html`<label class="jf-check"><input type="checkbox"${attrs({ checked: f.pack })} data-model="step.pack">Packs packets from the oldest bags in the freezer</label>`,
          html`<label class="jf-check"><input type="checkbox"${attrs({ checked: f.cartons })} data-model="step.cartons">Packets into cartons, into Finished Goods</label>`,
        ] : [
          html`<label class="jf-check"><input type="checkbox"${attrs({ checked: f.weigh })} data-model="step.weigh">Weight before and after (kg)</label>`,
          f.weigh && html`<div class="jf-row2">
            <div><label for="step-loss" class="mb-1 block text-sm font-medium text-slate-700">Loss allowed (%)</label><input id="step-loss" type="number" min="0" max="50" step="0.5" value="${f.loss}" data-model="step.loss" placeholder="10" class="${INPUT}"></div>
            <div><span class="mb-1 block text-sm font-medium text-slate-700">Takes from the store</span>${mats.length ? html`<div class="jf-mats">${mats.map(function (m) { return html`<label class="jf-check"><input type="checkbox"${attrs({ checked: f.takes.indexOf(m.id) !== -1 })} data-toggle-take="${m.id}">${m.name}</label>`; })}</div>` : html`<p class="jf-hint">This recipe lists no stocked materials.</p>`}</div>
          </div>`,
          html`<label class="jf-check"><input type="checkbox"${attrs({ checked: f.sticks })} data-model="step.sticks">Sticks used (taken from the store)</label>`,
          html`<div><label for="step-bags" class="mb-1 block text-sm font-medium text-slate-700">Fills big bags of (kg) <span class="font-normal text-slate-400">(leave empty if it doesn't)</span></label><input id="step-bags" type="number" min="1" value="${f.bags}" data-model="step.bags" placeholder="30" class="${INPUT}"></div>`,
        ]}
      </div>
      <label class="flex cursor-pointer items-center gap-2.5"><input type="checkbox"${attrs({ checked: f.unlocksNext })} data-model="step.unlocksNext" class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"><span class="text-sm text-slate-700">Completing this step unlocks the next one</span></label>
    </form>`;
  }
  function StepRow(step, index, count, busy, materials) {
    return html`<li class="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5">
      <div class="flex flex-col">
        <button${attrs({ disabled: busy || index === 0 })} class="text-slate-400 hover:text-brand-600 disabled:opacity-30" aria-label="Move step up" data-act="step-up" data-i="${index}">▲</button>
        <button${attrs({ disabled: busy || index === count - 1 })} class="text-slate-400 hover:text-brand-600 disabled:opacity-30" aria-label="Move step down" data-act="step-down" data-i="${index}">▼</button>
      </div>
      <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">${step.order}</span>
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-slate-900">${step.name}</p>
        <p class="flex flex-wrap items-center gap-x-2 text-xs text-slate-500"><span class="capitalize">${step.role}</span><span>·</span><span>${step.expectedMinutes} min</span><span>·</span><span class="${step.unlocksNext ? "text-accent-600" : "text-slate-400"}">${step.unlocksNext ? "unlocks next" : "no unlock"}</span></p>
        ${stepFlags(step, materials)}
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <button${attrs({ disabled: busy })} class="text-sm font-medium text-brand-700 hover:text-brand-800 disabled:opacity-50" data-act="step-edit" data-i="${index}">Edit</button>
        <button${attrs({ disabled: busy })} class="text-sm font-medium text-slate-400 hover:text-danger-600 disabled:opacity-50" data-act="step-delete" data-i="${index}">Delete</button>
      </div>
    </li>`;
  }

  /* ── App.jsx: routes ────────────────────────────────────────────────── */
  var PAGES = { "/": ShopFloor, "/steps": Steps, "/shifts": Shifts, "/login": Login };
  /* The first cut's addresses still land somewhere sensible. */
  var MOVED = { "/editor": "/steps", "/batches": "/", "/live": "/", "/analytics": "/" };

  function route() {
    var p = JF.path();
    if (!app.ready) return render();
    if (MOVED[p]) return JF.go(MOVED[p], true);
    if (p === "/login" && app.admin) return JF.go("/", true);
    if (p !== "/login" && !app.admin) return JF.go("/login", true);
    if (!PAGES[p]) return JF.go("/", true);
    var Page = PAGES[p];
    if (app.pageName !== p || !app.page) {
      app.pageName = p;
      app.page = Page.init();
      modalClose = null;
      render();
      if (Page.load) Page.load(app.page);
      return;
    }
    render();
  }

  function App() {
    if (!app.ready) return "";
    var Page = PAGES[app.pageName];
    if (!Page || !app.page) return "";
    if (Page === Login) return Login.view(app.page);
    return AdminLayout(Page.view(app.page));
  }

  /* Inside the FoodBridge platform this app's sidebar is clipped away and
     its pages are Production leaves (assets/modules.json). A jump between
     them goes through the platform, so its sidebar marks where you are. On
     its own, or if the leaf is not there, it is the app's own hash route. */
  var PLATFORM_LEAF = { "/": "shop-floor", "/steps": "process-steps", "/shifts": "shifts" };
  function navigate(to) {
    var leaf = "#/production/" + PLATFORM_LEAF[to];
    try {
      if (window.parent !== window && PLATFORM_LEAF[to] && window.parent.document.querySelector('a[href="' + leaf + '"]')) {
        window.parent.location.hash = leaf;
        return;
      }
    } catch (e) { /* cross-origin parent: stay in the app */ }
    JF.go(to);
  }

  /* ── Events: the JSX's onClick / onChange / onSubmit, delegated ─────── */
  function setPath(obj, path, value) {
    var keys = path.split("."), o = obj;
    for (var i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
  }
  rootEl.addEventListener("input", function (e) {
    var el = e.target, key = el.getAttribute("data-model");
    if (!key || !app.page || el.type === "checkbox" || el.nodeName === "SELECT") return;
    setPath(app.page, key, el.value);
    render();
  });
  rootEl.addEventListener("change", function (e) {
    var el = e.target, s = app.page;
    if (!s) return;
    if (el.getAttribute("data-model") && (el.type === "checkbox" || el.nodeName === "SELECT")) {
      setPath(s, el.getAttribute("data-model"), el.type === "checkbox" ? el.checked : el.value);
      render();
      return;
    }
    var take = el.getAttribute("data-toggle-take");
    if (take && s.step) { s.step.takes = toggleIn(s.step.takes, take); render(); return; }
    var list = el.getAttribute("data-toggle");
    if (list && s.form) { s.form[list] = toggleIn(s.form[list], el.getAttribute("data-id")); render(); }
  });
  rootEl.addEventListener("submit", function (e) {
    e.preventDefault();
    var s = app.page, which = e.target.getAttribute("data-form");
    if (which === "login") Login.submit(s);
    else if (which === "shift") Shifts.submit(s);
    else if (which === "new-workflow") Steps.createWorkflow(s);
    else if (which === "step") Steps.submitStep(s);
  });
  rootEl.addEventListener("click", function (e) {
    var s = app.page;
    if (e.target.closest("[data-stop]") && !e.target.closest("[data-act]") && !e.target.closest("[data-open-app]")) return;
    var goEl = e.target.closest("[data-go]");
    if (goEl) { navigate(goEl.getAttribute("data-go")); return; }
    var el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    var act = el.getAttribute("data-act"), id = el.getAttribute("data-id"), i = Number(el.getAttribute("data-i"));
    if (act === "modal-backdrop") { if (e.target === el && modalClose) modalClose(); return; }
    if (act === "modal-close") { if (modalClose) modalClose(); return; }
    if (act === "logout") return logout();
    if (act === "show-qr") { set({ qr: true }); drawQr(); return; }
    if (act === "shift-new") return Shifts.open(s, null);
    if (act === "shift-edit") return Shifts.open(s, s.shifts.filter(function (x) { return x._id === id; })[0]);
    if (act === "shift-publish") return Shifts.run(s, id, function () { return api.publishShift(id); });
    if (act === "shift-delete") return Shifts.run(s, id, function () { return api.deleteShift(id); });
    if (act === "wf-new") return set({ newOpen: true, newRecipe: "" });
    if (act === "wf-select") return Steps.select(s, id);
    if (act === "wf-delete") return Steps.removeWorkflow(s);
    if (act === "step-new") return Steps.openStep(s, null);
    if (act === "step-edit") return Steps.openStep(s, s.selected.steps[i]);
    if (act === "step-delete") { var st = s.selected.steps[i]; return Steps.runStep(s, function () { return api.deleteStep(s.selected._id, st._id); }); }
    if (act === "step-up") return Steps.move(s, i, -1);
    if (act === "step-down") return Steps.move(s, i, +1);
  });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape" && modalClose && document.querySelector('[role="dialog"]')) modalClose(); });
  window.addEventListener("hashchange", route);
  /* The floor moves while the office watches: the Shop Floor redraws when
     another screen (the worker app, Batch Management) writes the store. */
  window.addEventListener("storage", function (e) {
    if (e.key === FB_PRODUCTION.KEY && app.pageName === "/" && app.page && !app.page.loading) ShopFloor.load(app.page);
  });
  var tick = setInterval(function () { if (app.pageName === "/" && app.page && !app.page.loading && document.visibilityState === "visible") ShopFloor.load(app.page); }, 30000);

  /* ── Boot: hydrate the stored session (AuthContext's first effect) ──── */
  var session = api.loadSession();
  if (session && session.admin) app.admin = session.admin;
  var signedOut = false;
  try { signedOut = localStorage.getItem(OUT_KEY) === "1"; } catch (e) {}
  if (!app.admin && !signedOut) {
    /* Inside the platform the owner is already signed in: open on the
       floor, as the seeded admin, rather than on a second sign-in. */
    login(ADMIN_EMAIL, ADMIN_PASSWORD).then(function () { app.ready = true; route(); }, function () { app.ready = true; route(); });
  } else {
    app.ready = true;
    route();
  }
})();

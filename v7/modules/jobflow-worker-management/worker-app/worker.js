/* JobFlow Worker, without React.
 *
 * Port of jobflow-worker-app/src: every component below is the JSX of the
 * file named in its comment, class for class and text for text, so the
 * compiled Tailwind build (worker.css) styles it exactly as it styles the
 * React app. Routes are hash routes (#/task/<id> for /task/<id>).
 *
 * Keep tags on one line: the html`` tag drops line breaks the way JSX does,
 * and a break inside a tag would join its attributes.
 */
(function () {
  "use strict";

  var html = JF.html, raw = JF.raw;
  var api = JobFlowAPI.createClient({ server: FB_PRODUCTION.server, sessionKey: "fb.v7.jobflow.session", logoutOn401: true });

  var rootEl = document.getElementById("root");
  var app = { worker: null, ready: false, page: null, pageName: null, taskId: null };

  function render() { JF.morph(rootEl, App()); }
  function set(patch) { Object.assign(app.page, patch); render(); }
  function upd(s, patch) { Object.assign(s, patch); if (s === app.page) render(); }

  /* ── context/AuthContext.jsx ────────────────────────────────────────── */
  function login(name, pin) {
    return api.workerLogin(name, pin).then(function (data) {
      api.saveSession({ worker: data.worker, accessToken: data.accessToken, refreshToken: data.refreshToken });
      app.worker = data.worker;
      return data.worker;
    });
  }
  function logout() { api.clearSession(); app.worker = null; route(); }
  api.setUnauthorizedHandler(function () { app.worker = null; route(); });

  /* In-app history, so Back never walks out of the frame into the page
     around it (navigate(-1) in the React app). */
  var depth = 0;
  function navigate(to, replace) { if (!replace) depth += 1; JF.go(to, replace); }
  function back() { if (depth > 0) { depth -= 1; history.back(); } else JF.go("/", true); }

  function attrs(o) {
    var out = "";
    Object.keys(o || {}).forEach(function (k) {
      var v = o[k];
      if (v === false || v == null) return;
      out += " " + k + (v === true ? "" : '="' + JF.esc(v) + '"');
    });
    return raw(out);
  }

  /* ── components/AppShell.jsx ────────────────────────────────────────── */
  function AppShell(header, children, footer) {
    return html`<div class="flex min-h-dvh w-full flex-col bg-slate-50">
      ${header && html`<header class="safe-top sticky top-0 z-10 bg-brand-600 text-white shadow-sm"><div class="w-full px-4 sm:px-6">${header}</div></header>`}
      <main class="w-full flex-1 px-4 py-6 sm:px-6 sm:py-8">${children}</main>
      ${footer && html`<footer class="safe-bottom w-full border-t border-slate-200 bg-white"><div class="w-full px-4 py-4 sm:px-6">${footer}</div></footer>`}
    </div>`;
  }

  /* ── components/Avatar.jsx ──────────────────────────────────────────── */
  function Avatar(name, size) {
    name = name || ""; size = size || 72;
    var initial = name.trim().charAt(0).toUpperCase() || "?";
    return html`<div class="flex items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 ring-4 ring-white shadow-md select-none" style="width: ${size}px; height: ${size}px; font-size: ${size * 0.4}px;" aria-hidden="true">${initial}</div>`;
  }

  /* ── components/Button.jsx ──────────────────────────────────────────── */
  var VARIANTS = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-slate-200 disabled:text-slate-400",
    go: "bg-accent-500 text-white hover:bg-accent-600 active:bg-accent-600 disabled:bg-slate-200 disabled:text-slate-400",
    ghost: "bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100 disabled:text-slate-300",
  };
  function Button(p, children) {
    var variant = p.variant || "primary", className = p.className || "";
    var a = Object.assign({}, p); delete a.variant; delete a.className;
    return html`<button class="w-full rounded-cta px-5 py-4 text-base font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}"${attrs(a)}>${children}</button>`;
  }

  /* ── components/Keypad.jsx ──────────────────────────────────────────── */
  var BACKSPACE = raw('<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Z"></path><path d="m18 9-6 6"></path><path d="m12 9 6 6"></path></svg>');
  function Key(label, digit, disabled, children) {
    return html`<button type="button"${attrs({ disabled: disabled })} aria-label="${label}" data-digit="${digit}" class="flex h-16 items-center justify-center rounded-2xl bg-slate-50 text-2xl font-semibold text-ink transition-colors hover:bg-brand-50 active:bg-brand-100 disabled:opacity-40">${children}</button>`;
  }
  function Keypad(disabled) {
    return html`<div class="grid grid-cols-3 gap-3">
      ${["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(function (k) { return Key(k, k, disabled, k); })}
      <div aria-hidden="true"></div>
      ${Key("0", "0", disabled, "0")}
      ${Key("Delete", "back", disabled, BACKSPACE)}
    </div>`;
  }

  /* ── components/PinDots.jsx ─────────────────────────────────────────── */
  function PinDots(length, filled, error) {
    var dots = [];
    for (var i = 0; i < length; i++) {
      dots.push(html`<span class="h-4 w-4 rounded-full border-2 transition-colors ${error ? "border-red-400 bg-red-400" : i < filled ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-transparent"}"></span>`);
    }
    return html`<div class="flex items-center justify-center gap-4 ${error ? "animate-pulse" : ""}" role="status" aria-label="${filled} of ${length} digits entered">${dots}</div>`;
  }

  /* ── pages/Login.jsx ────────────────────────────────────────────────── */
  var PIN_LENGTH = 4;
  var Login = {
    init: function () { return { name: "", pin: "", error: "", submitting: false }; },
    ready: function (s) { return s.name.trim().length > 0; },
    digit: function (s, d) {
      if (s.submitting || s.pin.length >= PIN_LENGTH) return;
      s.error = ""; s.pin += d;
      render();
      Login.maybeSubmit(s);
    },
    backspace: function (s) {
      if (s.submitting) return;
      set({ error: "", pin: s.pin.slice(0, -1) });
    },
    /* Auto-submit once the 4-digit PIN is complete. */
    maybeSubmit: function (s) {
      if (s.pin.length !== PIN_LENGTH || !Login.ready(s)) return;
      set({ submitting: true });
      login(s.name.trim(), s.pin)
        .then(function () { if (app.page === s) navigate("/", true); })
        .catch(function (err) { upd(s, { error: err.message || "Login failed", pin: "" }); })
        .then(function () { upd(s, { submitting: false }); });
    },
    view: function (s) {
      var nameReady = Login.ready(s);
      return html`<div class="grid min-h-dvh w-full lg:grid-cols-2">
        <div class="relative hidden flex-col overflow-hidden bg-linear-to-br from-brand-600 to-brand-800 p-12 text-white lg:flex">
          <p class="relative z-10 text-lg font-bold uppercase tracking-widest">JobFlow</p>
          <div class="relative z-10 flex flex-1 flex-col justify-end pb-10">
            <img src="login-illustration.svg" alt="" class="w-full max-w-md drop-shadow-xl pb-20">
            <h2 class="mt-10 text-4xl font-bold leading-tight">Run your shift.</h2>
            <p class="mt-3 max-w-sm text-brand-100">Sign in to view today's tasks, batches and updates.</p>
          </div>
          <p class="relative z-10 text-sm text-brand-200">© JobFlow</p>
        </div>
        <div class="flex min-h-dvh flex-col items-center justify-center bg-white px-6 py-10">
          <div class="w-full max-w-sm">
            <div class="mb-6 text-center">
              <p class="text-sm font-semibold uppercase tracking-widest text-brand-600 lg:hidden">JobFlow</p>
              <h1 class="mt-1 text-2xl font-bold text-ink">Sign in</h1>
            </div>
            <div class="flex flex-col items-center">
              ${Avatar(s.name, 84)}
              <input value="${s.name}" data-model="name" placeholder="Your name" autocomplete="off" autocapitalize="words"${attrs({ disabled: s.submitting })} class="mt-4 w-56 rounded-xl border border-brand-200 bg-white px-4 py-2 text-center text-lg font-semibold text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200">
              <p class="mt-7 text-sm text-muted">Enter your 4-digit PIN</p>
              <div class="mt-4">${PinDots(PIN_LENGTH, s.pin.length, !!s.error)}</div>
              <p class="mt-3 h-5 text-sm font-medium text-red-500">${s.submitting ? "" : s.error}</p>
              <div class="mt-4 w-full max-w-xs">
                ${Keypad(s.submitting || !nameReady)}
                ${!nameReady && html`<p class="mt-4 text-center text-xs text-muted">Enter your name to begin</p>`}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    },
  };

  /* ── pages/Dashboard.jsx ────────────────────────────────────────────── */
  function greeting(now) {
    var h = (now || new Date()).getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }
  function timeLeft(endTime) {
    if (!endTime) return null;
    var ms = new Date(endTime).getTime() - Date.now();
    if (ms <= 0) return null;
    var mins = Math.round(ms / 60000), h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + "h " + m + "m" : m + "m";
  }
  function timeLeftSince(startedAt) {
    if (!startedAt) return null;
    var mins = Math.round((Date.now() - new Date(startedAt).getTime()) / 60000);
    if (mins <= 0) return null;
    var h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + "h " + m + "m" : m + "m";
  }
  function StatusChip(tone, children) {
    var tones = { brand: "bg-brand-100 text-brand-700", accent: "bg-accent-500/15 text-accent-600", muted: "bg-slate-100 text-slate-500" };
    return html`<span class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone || "brand"]}">${children}</span>`;
  }
  function ProgressCard(progress, endTime) {
    var done = (progress && progress.done) || 0, total = (progress && progress.total) || 0;
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var left = timeLeft(endTime);
    return html`<section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-end justify-between">
        <div>
          <p class="text-sm text-muted">Shift progress</p>
          <p class="mt-0.5 text-2xl font-bold text-ink">${done}<span class="text-base font-semibold text-muted"> / ${total} tasks</span></p>
        </div>
        <div class="text-right">
          <p class="text-sm text-muted">Time left</p>
          <p class="mt-0.5 text-2xl font-bold text-ink">${left || "—"}</p>
        </div>
      </div>
      <div class="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100"><div class="h-full rounded-full bg-accent-500 transition-[width] duration-500" style="width: ${pct}%;"></div></div>
    </section>`;
  }
  function CurrentTaskCard(task) {
    if (!task) {
      return html`<section class="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center">
        <p class="text-sm font-medium text-ink">No active task</p>
        <p class="mt-1 text-sm text-muted">Pick one from the available list below to get started.</p>
      </section>`;
    }
    var elapsed = timeLeftSince(task.startedAt);
    return html`<section class="rounded-2xl border border-brand-200 bg-brand-50 p-5 shadow-sm">
      <div class="flex items-center justify-between">
        ${StatusChip("brand", "In progress")}
        ${task.batch && task.batch.code && html`<span class="text-xs font-semibold text-muted">${task.batch.code}</span>`}
      </div>
      <h2 class="mt-3 text-xl font-bold text-ink">${task.stepName}</h2>
      <p class="mt-1 text-sm text-muted">${task.batch && task.batch.product}${task.expectedMinutes ? " · expected " + task.expectedMinutes + " min" : ""}${elapsed ? " · " + elapsed + " elapsed" : ""}</p>
      <div class="mt-4">${Button({ variant: "go", "data-open": task._id }, "Continue task")}</div>
    </section>`;
  }
  function PoolList(tasks) {
    if (!tasks || !tasks.length) {
      return html`<p class="rounded-2xl border border-slate-200 bg-white p-5 text-center text-sm text-muted">Nothing available right now. Check back soon.</p>`;
    }
    return html`<ul class="flex flex-col gap-3">${tasks.map(function (task) {
      return html`<li class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="min-w-0">
          <p class="truncate font-semibold text-ink">${task.stepName}</p>
          <p class="mt-0.5 truncate text-sm text-muted">${task.batch && task.batch.code ? task.batch.code + " · " : ""}${task.batch && task.batch.product}${task.expectedMinutes ? " · " + task.expectedMinutes + " min" : ""}</p>
        </div>
        <button type="button" data-open="${task._id}" class="shrink-0 rounded-cta bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 active:bg-brand-800">Start</button>
      </li>`;
    })}</ul>`;
  }
  /* lib/api.js getDashboard(): one section per live shift I'm on. */
  function getDashboard(worker) {
    return api.listShifts("live").then(function (liveShifts) {
      var mine = (liveShifts || []).filter(function (s) {
        return (s.workers || []).some(function (w) { return String(w._id || w) === String(worker && worker._id); });
      }).sort(function (a, b) { return new Date(b.startTime) - new Date(a.startTime); });
      return api.getMyTask().catch(function () { return null; }).then(function (currentTask) {
        return Promise.all(mine.map(function (shift) {
          return Promise.all([
            /* No role filter (owner, 26 Sep 2026): every available task on the
               shift is open to every worker on it. The React app asks for
               role: worker.role here. */
            api.listTasks({ shift: shift._id, status: "available", open: "1" }),
            api.listTasks({ shift: shift._id }),
          ]).then(function (r) {
            var done = r[1].filter(function (t) { return t.status === "done"; }).length;
            return { shift: shift, pool: r[0], progress: { done: done, total: r[1].length } };
          });
        })).then(function (sections) { return { currentTask: currentTask, sections: sections }; });
      });
    });
  }
  var Dashboard = {
    init: function () { return { data: null, error: "", loading: true }; },
    load: function (s) {
      getDashboard(app.worker)
        .then(function (payload) { s.data = payload; })
        .catch(function (err) { s.error = err.message || "Couldn't load your shift."; })
        .then(function () { upd(s, { loading: false }); });
    },
    view: function (s) {
      var w = app.worker || {};
      var header = html`<div class="flex items-center justify-between py-3">
        <div class="flex items-center gap-3">
          ${Avatar(w.name, 40)}
          <div>
            <p class="text-base font-semibold leading-tight">${w.name}</p>
            <p class="text-xs capitalize text-brand-100">${w.role}</p>
          </div>
        </div>
        <button data-act="logout" class="rounded-lg px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/10">Log out</button>
      </div>`;
      var sections = (s.data && s.data.sections) || [];
      var first = (w.name && w.name.split(" ")[0]) || "there";
      return AppShell(header, html`<div class="mx-auto w-full max-w-2xl">
        <div class="mb-5">
          <h1 class="text-2xl font-bold text-ink sm:text-3xl">${greeting()}, ${first} 👋</h1>
          ${sections.length > 0 && html`<p class="mt-1 text-sm text-muted">${sections.length === 1 ? sections[0].shift.name : sections.length + " live shifts"}</p>`}
        </div>
        ${s.loading && html`<p class="py-16 text-center text-sm text-muted">Loading your shift…</p>`}
        ${!s.loading && s.error && html`<p class="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm font-medium text-red-600">${s.error}</p>`}
        ${!s.loading && !s.error && sections.length === 0 && html`<p class="py-16 text-center text-sm text-muted">No live shift right now. Your tasks will appear here once a shift starts.</p>`}
        ${!s.loading && !s.error && sections.length > 0 && html`<div class="flex flex-col gap-6">
          <div>
            <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Current task</h2>
            ${CurrentTaskCard(s.data.currentTask)}
          </div>
          ${sections.map(function (sec) {
            return html`<section class="flex flex-col gap-3">
              <div class="flex items-center gap-2">
                <h2 class="text-sm font-semibold text-ink">${sec.shift.name}</h2>
                ${StatusChip(sec.shift.status === "live" ? "accent" : "muted", sec.shift.status)}
              </div>
              ${ProgressCard(sec.progress, sec.shift.endTime)}
              <div>
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Available for you</h3>
                ${PoolList(sec.pool)}
              </div>
            </section>`;
          })}
        </div>`}
      </div>`);
    },
  };

  /* ── pages/TaskDetail.jsx ───────────────────────────────────────────── */
  function InfoRow(label, value) {
    return html`<div class="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"><span class="text-sm text-muted">${label}</span><span class="text-sm font-semibold text-ink">${value}</span></div>`;
  }
  function WorkersOnThis(workers) {
    if (!workers || !workers.length) return "";
    return html`<section>
      <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Workers on this step</h2>
      <ul class="flex flex-col gap-2">${workers.map(function (w) {
        return html`<li class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">${Avatar(w.name, 32)}<span class="flex-1 font-medium text-ink">${w.name}</span><span class="inline-flex items-center gap-1.5 text-xs font-medium ${w.isOnline ? "text-accent-600" : "text-slate-400"}"><span class="h-2 w-2 rounded-full ${w.isOnline ? "bg-accent-500" : "bg-slate-300"}"></span>${w.isOnline ? "Online" : "Offline"}</span></li>`;
      })}</ul>
    </section>`;
  }
  function dt(iso) { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  /* What this step records, and what it will take — the Production
     integration (owner, 26 Sep 2026): who did it · how much · when. */
  function Record(task, s) {
    var f = s.form, mine = task.status === "in_progress";
    var parts = [];
    (task.store || []).forEach(function (m) {
      parts.push(html`<div class="jf-lot"><span aria-hidden="true">🏷️</span><div>Take <b>${m.name}</b> from lot <b>${m.oldest ? m.oldest.lotNo : "—"}</b><small>${m.oldest ? "Oldest in the " + m.oldest.store.toLowerCase() + " · received " + dt(m.oldest.receivedAt) + " · " + m.oldest.remaining + " " + m.unit + " left" : "None in the store"} · ${m.onHand} ${m.unit} in all</small></div></div>`);
    });
    if (task.freezer) {
      var fz = task.freezer;
      parts.push(html`<div class="jf-lot"><span aria-hidden="true">🧊</span><div>Take <b>${fz.needKg} kg</b> of ${fz.product} from the oldest bags<small>${fz.oldest.map(function (g) { return "Bag " + g.bagNo + " · " + g.remaining + " kg · made " + dt(g.madeAt); }).join(" · ") || "No bags in the freezer"} · ${fz.onHand} kg in all</small></div></div>`);
    }
    if (mine && task.weigh) {
      var kin = num(f.kgIn), kout = num(f.kgOut), loss = kin > 0 && kout > 0 ? Math.round((kin - kout) / kin * 1000) / 10 : null;
      var over = loss != null && task.loss != null && loss > task.loss;
      parts.push(html`<div class="jf-in-row"><label for="kg-in">Weight before</label><div class="jf-in"><input id="kg-in" inputmode="decimal" value="${f.kgIn}" data-f="kgIn" placeholder="0.0"><span>kg</span></div></div>`);
      parts.push(html`<div class="jf-in-row"><label for="kg-out">Weight after</label><div class="jf-in"><input id="kg-out" inputmode="decimal" value="${f.kgOut}" data-f="kgOut" placeholder="0.0"><span>kg</span></div></div>`);
      if (loss != null) parts.push(html`<div class="jf-loss ${over ? "over" : ""}"><span>Lost ${Math.round((kin - kout) * 10) / 10} kg · ${loss}%</span><small>${task.loss != null ? (over ? "Over the " + task.loss + "% the recipe allows. The office will see it." : "Within the " + task.loss + "% allowed") : ""}</small></div>`);
    }
    if (mine && task.sticks) parts.push(html`<div class="jf-in-row"><label for="sticks">Sticks used</label><div class="jf-in"><input id="sticks" inputmode="numeric" value="${f.sticks}" data-f="sticks" placeholder="0"><span>pcs</span></div></div>`);
    if (mine && task.bags) {
      var kb = num(f.kgOut), n = kb > 0 ? Math.ceil(kb / task.bags) : 0, last = kb > 0 ? Math.round((kb - (n - 1) * task.bags) * 10) / 10 : 0;
      parts.push(html`<div class="jf-in-row"><label for="kg-bag">Kg into bags</label><div class="jf-in"><input id="kg-bag" inputmode="decimal" value="${f.kgOut}" data-f="kgOut" placeholder="0.0"><span>kg</span></div></div>`);
      parts.push(html`<p class="text-sm text-muted">${task.bagPlan ? "About " + task.bagPlan.expectedKg + " kg expected · " : ""}${task.bags} kg to a bag${n ? " · makes " + n + " bag" + (n > 1 ? "s" : "") + (n > 1 && last < task.bags ? ", the last " + last + " kg" : "") : ""}. Each bag gets the batch, date made and use-by.</p>`);
    }
    if (mine && task.pack) parts.push(html`<div class="jf-in-row"><label for="packets">Packets packed</label><div class="jf-in"><input id="packets" inputmode="numeric" value="${f.packets}" data-f="packets" placeholder="0"><span>pcs</span></div></div>`);
    if (task.cartons && task.cartonPlan) parts.push(html`<p class="text-sm text-muted">${task.cartonPlan.packets} packets · ${task.cartonPlan.perCarton} to a carton · ${Math.ceil(task.cartonPlan.packets / task.cartonPlan.perCarton)} cartons into the freezer.</p>`);
    if (task.status === "done") {
      var rows = [];
      if (task.kgIn) rows.push(["Weight", task.kgIn + " → " + task.kgOut + " kg"], ["Lost", task.lossPct + "%" + (task.loss != null ? " (allowed " + task.loss + "%)" : "")]);
      if (task.lots && task.lots.length) rows.push(["From lots", task.lots.map(function (l) { return l.lotNo; }).join(", ")]);
      if (task.sticksUsed) rows.push(["Sticks", task.sticksUsed + " pcs"]);
      if (task.bagsMade) rows.push(["Bags", task.bagsMade.map(function (g) { return g.bagNo; }).join(", ")]);
      if (task.packets) rows.push(["Packets", task.packets + ""]);
      if (task.bagsTaken) rows.push(["From bags", task.bagsTaken.map(function (g) { return g.bagNo; }).join(", ")]);
      if (task.cartonsPacked) rows.push(["Cartons", task.cartonsPacked + ""]);
      rows.push(["By", (task.assignedName || "—") + " · " + new Date(task.completedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })]);
      parts.push(html`<dl class="jf-done-rec">${rows.map(function (r) { return html`<dt>${r[0]}</dt><dd>${r[1]}</dd>`; })}</dl>`);
    }
    if (!parts.length) return "";
    return html`<section class="jf-rec"><h2>${task.status === "done" ? "Recorded" : mine ? "Record" : "This step"}</h2>${parts}</section>`;
  }
  var TaskDetail = {
    init: function () { return { task: null, loading: true, error: "", acting: false, form: { kgIn: "", kgOut: "", sticks: "", packets: "" } }; },
    load: function (s) {
      api.getTask(app.taskId)
        .then(function (t) { s.task = t; TaskDetail.prefill(s); })
        .catch(function (err) { s.error = err.message || "Couldn't load this task."; })
        .then(function () { upd(s, { loading: false }); });
    },
    /* The planned quantity is the likely one: packets default to the order. */
    prefill: function (s) {
      var t = s.task;
      if (t && t.pack && !s.form.packets && t.batch && t.batch.packets) s.form.packets = String(t.batch.packets);
    },
    start: function (s) {
      set({ acting: true, error: "" });
      api.claimTask(app.taskId)
        .then(function () { return api.getTask(app.taskId); })
        .then(function (t) { s.task = t; TaskDetail.prefill(s); })
        .catch(function (err) { s.error = err.message || "Couldn't start the task."; })
        .then(function () { upd(s, { acting: false }); });
    },
    complete: function (s) {
      var f = s.form, input = {};
      ["kgIn", "kgOut", "sticks", "packets"].forEach(function (k) { if (f[k] !== "") input[k] = Number(f[k]); });
      set({ acting: true, error: "" });
      api.completeTask(app.taskId, input)
        .then(function () { if (app.page === s) navigate("/", true); })
        .catch(function (err) { upd(s, { error: err.message || "Couldn't complete the task.", acting: false }); });
    },
    view: function (s) {
      var task = s.task;
      var header = html`<div class="flex items-center gap-3 py-3"><button data-act="back" aria-label="Back" class="-ml-2 rounded-lg px-2 py-1 text-2xl leading-none text-white/90 hover:bg-white/10">‹</button><p class="text-base font-semibold">Task detail</p></div>`;
      var isMine = task && (!task.assignedTo || task.assignedTo === (app.worker && app.worker._id));
      var held = task && task.batch && ["on-hold", "rejected"].indexOf(task.batch.stateId) !== -1;
      var cta = null;
      if (task && task.status === "available" && !held) cta = Button({ "data-act": "start", disabled: s.acting }, s.acting ? "Starting…" : "Start task");
      else if (task && task.status === "in_progress" && isMine) cta = Button({ variant: "go", "data-act": "complete", disabled: s.acting }, s.acting ? "Completing…" : "Mark complete");
      return AppShell(header, html`<div class="mx-auto w-full max-w-2xl">
        ${s.loading && html`<p class="py-16 text-center text-sm text-muted">Loading task…</p>`}
        ${!s.loading && s.error && !task && html`<p class="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm font-medium text-red-600">${s.error}</p>`}
        ${!s.loading && task && html`<div class="flex flex-col gap-6">
          <div>
            ${task.stepCount > 0 && html`<p class="text-sm font-semibold text-brand-600">Step ${task.stepOrder} of ${task.stepCount}</p>`}
            <h1 class="mt-1 text-2xl font-bold text-ink sm:text-3xl">${task.stepName}</h1>
            <p class="mt-1 text-sm text-muted">${task.batch && task.batch.code ? task.batch.code + " · " : ""}${task.batch && task.batch.product}${task.batch && task.batch.kind === "production" ? " · " + task.batch.batchSize + " kg" : ""}</p>
          </div>
          ${held && html`<p class="jf-held">This batch is ${task.batch.statusLabel.toLowerCase()}. Its steps are paused. Ask your supervisor.</p>`}
          ${task.instructions && html`<section>
            <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">Instructions</h2>
            <p class="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-ink">${task.instructions}</p>
          </section>`}
          ${Record(task, s)}
          <section class="rounded-2xl border border-slate-200 bg-white px-4">
            ${task.expectedMinutes != null && InfoRow("Expected time", task.expectedMinutes + " min")}
            ${InfoRow("Unlocks next step", task.unlocksNext ? "Yes" : "No")}
            ${InfoRow("Role", html`<span class="capitalize">${task.role}</span>`)}
          </section>
          ${WorkersOnThis(task.workersOnThis)}
          ${s.error && task && html`<p class="text-center text-sm font-medium text-red-600">${s.error}</p>`}
          ${task.status === "done" && html`<p class="rounded-2xl border border-accent-500/30 bg-accent-500/10 p-4 text-center text-sm font-semibold text-accent-600">This task is complete. 🎉</p>`}
        </div>`}
      </div>`, cta);
    },
  };

  /* ── App.jsx: routes ────────────────────────────────────────────────── */
  function route() {
    var p = JF.path();
    if (!app.ready) return render();
    var m = /^\/task\/([^/]+)$/.exec(p);
    var name = p === "/login" ? "login" : p === "/" ? "dashboard" : m ? "task" : null;
    if (!name) return JF.go("/", true);
    if (name === "login" && app.worker) return JF.go("/", true);
    if (name !== "login" && !app.worker) return JF.go("/login", true);
    var Page = name === "login" ? Login : name === "task" ? TaskDetail : Dashboard;
    var key = name + (m ? ":" + m[1] : "");
    if (app.pageName !== key || !app.page) {
      app.pageName = key;
      app.taskId = m ? m[1] : null;
      app.page = Page.init();
      app.view = Page;
      window.scrollTo(0, 0);
      render();
      if (Page.load) Page.load(app.page);
      return;
    }
    render();
  }
  function App() {
    if (!app.ready || !app.page) return "";
    return app.view.view(app.page);
  }

  /* ── Events ─────────────────────────────────────────────────────────── */
  rootEl.addEventListener("input", function (e) {
    var el = e.target;
    if (el.getAttribute("data-f") && app.view === TaskDetail) { app.page.form[el.getAttribute("data-f")] = el.value; render(); return; }
    if (el.getAttribute("data-model") !== "name" || app.view !== Login) return;
    app.page.name = el.value;
    render();
  });
  rootEl.addEventListener("click", function (e) {
    var s = app.page;
    var open = e.target.closest("[data-open]");
    if (open) { navigate("/task/" + open.getAttribute("data-open")); return; }
    var key = e.target.closest("[data-digit]");
    if (key && !key.disabled && app.view === Login) {
      var k = key.getAttribute("data-digit");
      if (k === "back") Login.backspace(s); else Login.digit(s, k);
      return;
    }
    var el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    var act = el.getAttribute("data-act");
    if (act === "logout") logout();
    else if (act === "back") back();
    else if (act === "start") TaskDetail.start(s);
    else if (act === "complete") TaskDetail.complete(s);
  });
  /* Type the PIN on a physical keyboard, not just the on-screen keypad. */
  window.addEventListener("keydown", function (e) {
    var s = app.page;
    if (app.view !== Login || s.submitting || !Login.ready(s)) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key >= "0" && e.key <= "9" && e.key.length === 1) { e.preventDefault(); Login.digit(s, e.key); }
    else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); Login.backspace(s); }
  });
  window.addEventListener("hashchange", route);

  var session = api.loadSession();
  if (session && session.worker) app.worker = session.worker;
  app.ready = true;
  route();
})();

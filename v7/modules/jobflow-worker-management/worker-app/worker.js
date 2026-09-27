/* JobFlow Worker — the Job Workflow worker mockup (28 Sep 2026), on the
 * JobFlow API in ../../../assets/production/production-api.js.
 *
 * One screen, one action, the action at the thumb:
 *   PIN → Shift dashboard → Task detail → In progress ⇄ Add update
 *       → Step complete → … → My shift (close shift)
 * Routes are hash routes: #/login, #/, #/task/<id>, #/task/<id>/update,
 * #/done/<id>, #/shift. Styles are app.css.
 *
 * Keep tags on one line: the html`` tag drops line breaks the way JSX does,
 * and a break inside a tag would join its attributes.
 */
(function () {
  "use strict";

  var html = JF.html, raw = JF.raw;
  var api = JobFlowAPI.createClient({ server: FB_PRODUCTION.server, sessionKey: "fb.v7.jobflow.session", logoutOn401: true });

  var rootEl = document.getElementById("root");
  var app = { worker: null, ready: false, page: null, pageName: null, view: null, params: null };

  function render() { JF.morph(rootEl, App()); }
  function set(patch) { Object.assign(app.page, patch); render(); }
  function upd(s, patch) { Object.assign(s, patch); if (s === app.page) render(); }

  /* ── session ────────────────────────────────────────────────────────── */
  /* The phone remembers who last signed in on it, so next time it asks only
     for the PIN (mockup: "Not Ramesh? Switch worker"). */
  var LAST_KEY = "fb.v7.jobflow.lastWorker";
  function lastWorker() { try { var w = JSON.parse(localStorage.getItem(LAST_KEY)); return w && w.name ? w : null; } catch (e) { return null; } }
  function remember(w) { try { if (w) localStorage.setItem(LAST_KEY, JSON.stringify({ name: w.name, role: w.role })); else localStorage.removeItem(LAST_KEY); } catch (e) { /* private window */ } }
  function signedIn(data) {
    api.saveSession({ worker: data.worker, accessToken: data.accessToken, refreshToken: data.refreshToken });
    app.worker = data.worker;
    remember(data.worker);
    return data.worker;
  }
  function login(name, pin) { return api.workerLogin(name, pin).then(signedIn); }
  /* "Sign in as": straight in as a worker, no PIN (owner, 26 Sep 2026). */
  function loginAs(id) { return api.workerLoginAs(id).then(signedIn); }
  function logout() { api.clearSession(); app.worker = null; depth = 0; JF.go("/login", true); }
  api.setUnauthorizedHandler(function () { app.worker = null; route(); });

  /* In-app history, so Back never walks out of the frame into the page
     around it. */
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

  /* ── little formatters ──────────────────────────────────────────────── */
  function initials(name) {
    var p = String(name || "").trim().split(/\s+/).filter(Boolean);
    return ((p[0] || "?").charAt(0) + (p[1] ? p[1].charAt(0) : "")).toUpperCase();
  }
  function dur(mins) {
    mins = Math.max(0, Math.round(mins || 0));
    var h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + "h " + (m < 10 ? "0" : "") + m + "m" : m + " min";
  }
  function clock(ms) {
    var t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
    return [h, m, s].map(function (n) { return (n < 10 ? "0" : "") + n; }).join(":");
  }
  function sinceMin(iso) { return iso ? (Date.now() - new Date(iso).getTime()) / 60000 : 0; }
  function timeOf(iso) { return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }); }
  function dt(iso) { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" }); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function cap(s) { s = String(s || ""); return s.charAt(0).toUpperCase() + s.slice(1); }
  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }
  function batchLine(task) {
    var b = task.batch || {};
    return [b.product, b.code].filter(Boolean).join(" — ") + (b.kind === "production" && b.batchSize ? " · " + b.batchSize + " kg" : b.packets ? " · " + b.packets + " packets" : "");
  }
  function stepLabel(task) { return "Step " + task.stepOrder + ": " + task.stepName; }

  /* The six quick check-ins the API takes (POST /api/tasks/:id/updates). */
  var QUICK = [
    ["just_started", "🆕", "Just started"], ["halfway", "⏳", "Halfway done"], ["almost_done", "✅", "Almost done"],
    ["need_materials", "📦", "Need materials"], ["issue_found", "⚠️", "Issue found"], ["need_help", "🙋", "Need help"],
  ];
  function quick(key) { for (var i = 0; i < QUICK.length; i++) if (QUICK[i][0] === key) return QUICK[i]; return ["", "💬", "Update"]; }
  /* No check-in for this long on a running task, and the app asks for one. */
  var UPDATE_DUE_MIN = 20;

  /* ── shared pieces ──────────────────────────────────────────────────── */
  function Screen(cls, top, body, bar) {
    return html`<div class="wk ${cls || ""}">${top && html`<header class="wk-top">${top}</header>`}<main class="wk-body">${body}</main>${bar && html`<footer class="wk-bar">${bar}</footer>`}</div>`;
  }
  function Head(backLabel, title, sub) {
    return html`<div class="wk-head">${backLabel && html`<button type="button" class="wk-back" data-act="back">← ${backLabel}</button>`}<h1>${title}</h1>${sub && html`<p class="wk-sub">${sub}</p>`}</div>`;
  }
  function Avatar(name, size) {
    size = size || 56;
    return html`<div class="wk-av" style="width: ${size}px; height: ${size}px; font-size: ${Math.round(size * 0.39)}px;" aria-hidden="true">${initials(name)}</div>`;
  }
  function Progress(done, total, left) {
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return html`<div class="wk-prog"><div class="wk-prog-row"><span>${done} / ${total} tasks done</span><span>${left ? left + " left" : ""}</span></div><div class="wk-track"><i style="width: ${pct}%;"></i></div></div>`;
  }
  function Row(label, value, tone) { return html`<div class="wk-row"><span>${label}</span><b class="${tone || ""}">${value}</b></div>`; }
  function Status(task, held) {
    if (held) return html`<span class="wk-st held">On hold</span>`;
    if (task.status === "available") return html`<span class="wk-st avail">Available</span>`;
    if (task.status === "in_progress") return html`<span class="wk-st run">● In progress${task.assignedName ? " · " + task.assignedName : ""}</span>`;
    if (task.status === "done") return html`<span class="wk-st done">Done ✓</span>`;
    return html`<span class="wk-st wait">Waiting</span>`;
  }
  function timeLeft(endTime) {
    if (!endTime) return null;
    var mins = (new Date(endTime).getTime() - Date.now()) / 60000;
    return mins > 0 ? dur(mins).replace(" min", "m") : null;
  }
  /* Shift progress across the live shifts I'm on: tasks done of all, and
     the time left on the one that ends first. */
  function shiftProgress(sections) {
    var done = 0, total = 0, ends = [];
    sections.forEach(function (sec) { done += sec.progress.done; total += sec.progress.total; if (sec.shift.endTime) ends.push(sec.shift.endTime); });
    ends.sort(function (a, b) { return new Date(a) - new Date(b); });
    return { done: done, total: total, left: timeLeft(ends[0]) };
  }

  /* lib/api.js getDashboard(): one section per live shift I'm on. */
  function getDashboard(worker) {
    return api.listShifts("live").then(function (liveShifts) {
      var mine = (liveShifts || []).filter(function (s) {
        return (s.workers || []).some(function (w) { return String(w._id || w) === String(worker && worker._id); });
      }).sort(function (a, b) { return new Date(b.startTime) - new Date(a.startTime); });
      return api.getMyTask().catch(function () { return null; }).then(function (currentTask) {
        return Promise.all(mine.map(function (shift) {
          /* No role filter (owner, 26 Sep 2026): every available task on the
             shift is open to every worker on it. */
          return Promise.all([
            api.listTasks({ shift: shift._id, status: "available", open: "1" }),
            api.listTasks({ shift: shift._id }),
          ]).then(function (r) {
            var done = r[1].filter(function (t) { return t.status === "done"; }).length;
            return { shift: shift, pool: r[0], all: r[1], progress: { done: done, total: r[1].length } };
          });
        })).then(function (sections) { return { currentTask: currentTask, sections: sections }; });
      });
    });
  }

  /* ── 1 · Sign in ────────────────────────────────────────────────────── */
  var PIN_LENGTH = 4;
  var Login = {
    init: function () {
      var known = lastWorker();
      return { known: known, name: known ? known.name : "", pin: "", error: "", submitting: false, workers: [], mode: "pin", asId: "" };
    },
    load: function (s) {
      api.listSignInWorkers().then(function (list) { upd(s, { workers: list }); }).catch(function () {});
    },
    ready: function (s) { return s.name.trim().length > 0; },
    digit: function (s, d) {
      if (s.submitting || s.pin.length >= PIN_LENGTH) return;
      s.error = ""; s.pin += d;
      render();
      if (s.pin.length === PIN_LENGTH) Login.submit(s);
    },
    backspace: function (s) {
      if (s.submitting) return;
      set({ error: "", pin: s.pin.slice(0, -1) });
    },
    /* Signs in as soon as the 4th digit lands; ✓ does the same. */
    submit: function (s) {
      if (s.submitting || s.pin.length !== PIN_LENGTH || !Login.ready(s)) return;
      set({ submitting: true });
      login(s.name.trim(), s.pin)
        .then(function () { if (app.page === s) navigate("/", true); })
        .catch(function (err) { upd(s, { error: err.message || "Login failed", pin: "" }); })
        .then(function () { upd(s, { submitting: false }); });
    },
    signInAs: function (s, id) {
      if (!id || s.submitting) return;
      set({ submitting: true, error: "", pin: "", asId: id });
      loginAs(id)
        .then(function () { if (app.page === s) navigate("/", true); })
        .catch(function (err) { upd(s, { error: err.message || "Login failed", asId: "" }); })
        .then(function () { upd(s, { submitting: false }); });
    },
    /* "Not Asha? Switch worker": forget this phone's worker, ask for a name. */
    switchWorker: function (s) {
      if (s.submitting) return;
      remember(null);
      set({ known: null, name: "", pin: "", error: "" });
    },
    /* "Don't have an account?": the PIN form gives way to the sample
       workers, one tap each — never both at once (owner, 26 Sep 2026). */
    mode: function (s, mode) {
      if (s.submitting) return;
      set({ mode: mode, error: "", pin: "", asId: "" });
    },
    pad: function (s) {
      var off = s.submitting || !Login.ready(s);
      function key(d) { return html`<button type="button" data-digit="${d}" aria-label="${d}"${attrs({ disabled: off })}>${d}</button>`; }
      return html`<div class="wk-pad">${["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(key)}<button type="button" class="del" data-digit="back" aria-label="Delete"${attrs({ disabled: off || !s.pin })}>⌫</button>${key("0")}<button type="button" class="ok" data-act="submit" aria-label="Sign in"${attrs({ disabled: off || s.pin.length !== PIN_LENGTH })}>✓</button></div>`;
    },
    sampleView: function (s) {
      return html`<h2 class="wk-sec">Sign in as</h2>
        <ul class="wk-people">${s.workers.map(function (w) {
          return html`<li><button type="button" data-act="as" data-id="${w._id}"${attrs({ disabled: s.submitting })} class="${s.asId === w._id ? "on" : ""}">${Avatar(w.name, 40)}<span><b>${w.name}</b><small>${w.role}</small></span>${w.onShift && html`<em>On shift</em>`}</button></li>`;
        })}</ul>
        <p class="wk-msg">${s.submitting ? "" : s.error}</p>
        <p class="wk-switch">Have a PIN? <button type="button" class="wk-link" data-act="pin">Sign in with your name</button></p>`;
    },
    pinView: function (s) {
      var dots = [];
      for (var i = 0; i < PIN_LENGTH; i++) dots.push(html`<i class="${i < s.pin.length ? "on" : ""}"></i>`);
      var first = s.known ? s.known.name.split(" ")[0] : "";
      return html`<div class="wk-me">${s.known
          ? html`${Avatar(s.known.name, 56)}<b>${s.known.name}</b><small>${s.known.role}</small>`
          : html`<label for="wk-name">Your name</label><input id="wk-name" class="wk-name-in" value="${s.name}" data-model="name" placeholder="Type your name" autocomplete="off" autocapitalize="words"${attrs({ disabled: s.submitting })}>`}</div>
        <div class="wk-pin ${s.error ? "err" : ""}" role="status" aria-label="${s.pin.length} of ${PIN_LENGTH} digits entered">${dots}</div>
        <p class="wk-msg">${s.submitting ? "" : s.error}</p>
        ${Login.pad(s)}
        ${!Login.ready(s) && html`<p class="wk-hint">Type your name to begin</p>`}
        <p class="wk-switch">${s.known
          ? html`<button type="button" class="wk-link" data-act="switch">Not ${first}? Switch worker</button>`
          : s.workers.length > 0 && html`Don't have an account? <button type="button" class="wk-link" data-act="sample">Use a sample worker</button>`}</p>`;
    },
    view: function (s) {
      var sample = s.mode === "sample";
      var top = html`<div class="wk-hello"><div class="wk-hello-i" aria-hidden="true">🏭</div><h1>नमस्ते</h1><p>${sample ? "Pick a sample worker. No PIN needed." : "Enter your PIN to start your shift"}</p></div>`;
      return Screen("login", top, sample ? Login.sampleView(s) : Login.pinView(s));
    },
  };

  /* ── 2 · Shift dashboard ────────────────────────────────────────────── */
  function CurrentTask(task) {
    if (!task) {
      return html`<div class="wk-card wk-empty"><b>No task in hand</b>Pick one up from the list below to get started.</div>`;
    }
    var mins = sinceMin(task.startedAt);
    return html`<article class="wk-task">
      <div class="wk-task-h"><span class="wk-badge">${task.role}</span><span class="wk-st run">● In progress</span></div>
      <p class="wk-name">${stepLabel(task)}</p>
      <p class="wk-meta">${batchLine(task)}</p>
      ${task.startedAt && html`<p class="wk-when"><span>Started ${timeOf(task.startedAt)}</span><b>· ${dur(mins)} elapsed</b></p>`}
      <button type="button" class="wk-btn teal md" data-open="${task._id}">Continue task →</button>
    </article>`;
  }
  function PoolTask(task, busy) {
    return html`<article class="wk-task pool ${busy ? "dim" : ""}">
      <div class="wk-task-h"><span class="wk-badge green">${task.role}</span><span class="wk-st pool">Pool task</span></div>
      <p class="wk-name">${stepLabel(task)}</p>
      <p class="wk-meta">${batchLine(task)}${task.expectedMinutes ? " · ~" + task.expectedMinutes + " min" : ""}</p>
      ${busy
        ? html`<button type="button" class="wk-btn grey sm" disabled>Finish your current task first</button>`
        : html`<button type="button" class="wk-btn go sm" data-open="${task._id}">Pick up task</button>`}
    </article>`;
  }
  var Dashboard = {
    init: function () { return { data: null, error: "", loading: true }; },
    load: function (s) {
      getDashboard(app.worker)
        .then(function (payload) { s.data = payload; })
        .catch(function (err) { s.error = err.message || "Couldn't load your shift."; })
        .then(function () { upd(s, { loading: false }); });
    },
    tick: function (s) { return !!(s.data && s.data.currentTask); },
    view: function (s) {
      var w = app.worker || {};
      var sections = (s.data && s.data.sections) || [];
      var current = s.data && s.data.currentTask;
      var online = navigator.onLine !== false;
      var sub = s.loading ? "" : sections.length === 1 ? sections[0].shift.name : sections.length > 1 ? sections.length + " live shifts" : "No live shift";
      var p = shiftProgress(sections);
      var top = html`<div class="wk-sync"><i class="${online ? "" : "off"}"></i>${online ? "Synced" : "Offline · saved on this phone"}</div>
        <div class="wk-head wk-head-row"><div><p class="wk-hi">${greeting()} 👋</p><h1>${w.name}</h1><p class="wk-sub">${sub ? sub + " · " : ""}<span>${w.role}</span></p></div><button type="button" class="wk-pill" data-act="shift">My shift</button></div>
        ${sections.length > 0 && Progress(p.done, p.total, p.left)}`;
      var body;
      if (s.loading) body = html`<p class="wk-note">Loading your shift…</p>`;
      else if (s.error) body = html`<div class="wk-banner r" style="margin-top: 12px;">${s.error}</div>`;
      else if (!sections.length) body = html`<p class="wk-note">No live shift right now. Your tasks will appear here once a shift starts.</p>`;
      else {
        body = html`<h2 class="wk-sec">My current task</h2>${CurrentTask(current)}
          ${sections.map(function (sec) {
            var n = sec.pool.length;
            return html`<h2 class="wk-sec">Available for you${sections.length > 1 ? " · " + sec.shift.name : ""} · ${n}</h2>
              ${n ? sec.pool.map(function (t) { return PoolTask(t, !!current); }) : html`<div class="wk-card wk-empty">Nothing open right now. Check back soon.</div>`}`;
          })}`;
      }
      return Screen("", top, body);
    },
  };

  /* ── 3 · Task detail  /  4 · In progress ────────────────────────────── */
  /* What this step records, and what it will take — the Production
     integration (owner, 26 Sep 2026): who did it · how much · when. */
  function Record(task, s) {
    var f = s.form, mine = task.status === "in_progress";
    var parts = [];
    (task.store || []).forEach(function (m) {
      parts.push(html`<div class="wk-lot"><span aria-hidden="true">🏷️</span><div>Take <b>${m.name}</b> from lot <b>${m.oldest ? m.oldest.lotNo : "—"}</b><small>${m.oldest ? "Oldest in the " + m.oldest.store.toLowerCase() + " · received " + dt(m.oldest.receivedAt) + " · " + m.oldest.remaining + " " + m.unit + " left" : "None in the store"} · ${m.onHand} ${m.unit} in all</small></div></div>`);
    });
    if (task.freezer) {
      var fz = task.freezer;
      parts.push(html`<div class="wk-lot"><span aria-hidden="true">🧊</span><div>Take <b>${fz.needKg} kg</b> of ${fz.product} from the oldest bags<small>${fz.oldest.map(function (g) { return "Bag " + g.bagNo + " · " + g.remaining + " kg · made " + dt(g.madeAt); }).join(" · ") || "No bags in the freezer"} · ${fz.onHand} kg in all</small></div></div>`);
    }
    if (mine && task.weigh) {
      var kin = num(f.kgIn), kout = num(f.kgOut), loss = kin > 0 && kout > 0 ? Math.round((kin - kout) / kin * 1000) / 10 : null;
      var over = loss != null && task.loss != null && loss > task.loss;
      parts.push(html`<div class="wk-in-row"><label for="kg-in">Weight before</label><div class="wk-in"><input id="kg-in" inputmode="decimal" value="${f.kgIn}" data-f="kgIn" placeholder="0.0"><span>kg</span></div></div>`);
      parts.push(html`<div class="wk-in-row"><label for="kg-out">Weight after</label><div class="wk-in"><input id="kg-out" inputmode="decimal" value="${f.kgOut}" data-f="kgOut" placeholder="0.0"><span>kg</span></div></div>`);
      if (loss != null) parts.push(html`<div class="wk-loss ${over ? "over" : ""}"><span>Lost ${Math.round((kin - kout) * 10) / 10} kg · ${loss}%</span><small>${task.loss != null ? (over ? "Over the " + task.loss + "% the recipe allows. The office will see it." : "Within the " + task.loss + "% allowed") : ""}</small></div>`);
    }
    if (mine && task.sticks) parts.push(html`<div class="wk-in-row"><label for="sticks">Sticks used</label><div class="wk-in"><input id="sticks" inputmode="numeric" value="${f.sticks}" data-f="sticks" placeholder="0"><span>pcs</span></div></div>`);
    if (mine && task.bags) {
      var kb = num(f.kgOut), n = kb > 0 ? Math.ceil(kb / task.bags) : 0, last = kb > 0 ? Math.round((kb - (n - 1) * task.bags) * 10) / 10 : 0;
      parts.push(html`<div class="wk-in-row"><label for="kg-bag">Kg into bags</label><div class="wk-in"><input id="kg-bag" inputmode="decimal" value="${f.kgOut}" data-f="kgOut" placeholder="0.0"><span>kg</span></div></div>`);
      parts.push(html`<p class="wk-plan">${task.bagPlan ? "About " + task.bagPlan.expectedKg + " kg expected · " : ""}${task.bags} kg to a bag${n ? " · makes " + n + " bag" + (n > 1 ? "s" : "") + (n > 1 && last < task.bags ? ", the last " + last + " kg" : "") : ""}. Each bag gets the batch, date made and use-by.</p>`);
    }
    if (mine && task.pack) parts.push(html`<div class="wk-in-row"><label for="packets">Packets packed</label><div class="wk-in"><input id="packets" inputmode="numeric" value="${f.packets}" data-f="packets" placeholder="0"><span>pcs</span></div></div>`);
    if (task.cartons && task.cartonPlan) parts.push(html`<p class="wk-plan">${task.cartonPlan.packets} packets · ${task.cartonPlan.perCarton} to a carton · ${Math.ceil(task.cartonPlan.packets / task.cartonPlan.perCarton)} cartons into the freezer.</p>`);
    if (task.status === "done") {
      var rows = recordedRows(task);
      rows.push(["By", (task.assignedName || "—") + " · " + timeOf(task.completedAt)]);
      parts.push(html`<div>${rows.map(function (r) { return Row(r[0], r[1]); })}</div>`);
    }
    if (!parts.length) return "";
    return html`<h2 class="wk-sec">${task.status === "done" ? "Recorded" : mine ? "Record" : "This step takes"}</h2><section class="wk-card wk-rec">${parts}</section>`;
  }
  function recordedRows(task) {
    var rows = [];
    if (task.kgIn) rows.push(["Weight", task.kgIn + " → " + task.kgOut + " kg"], ["Lost", task.lossPct + "%" + (task.loss != null ? " (allowed " + task.loss + "%)" : "")]);
    if (task.lots && task.lots.length) rows.push(["From lots", task.lots.map(function (l) { return l.lotNo; }).join(", ")]);
    if (task.sticksUsed) rows.push(["Sticks", task.sticksUsed + " pcs"]);
    if (task.bagsMade) rows.push(["Bags", task.bagsMade.map(function (g) { return g.bagNo; }).join(", ")]);
    if (task.packets) rows.push(["Packets", task.packets + ""]);
    if (task.bagsTaken) rows.push(["From bags", task.bagsTaken.map(function (g) { return g.bagNo; }).join(", ")]);
    if (task.cartonsPacked) rows.push(["Cartons", task.cartonsPacked + ""]);
    return rows;
  }

  var TaskDetail = {
    init: function () { return { task: null, loading: true, error: "", acting: false, form: { kgIn: "", kgOut: "", sticks: "", packets: "" }, shift: null }; },
    load: function (s) {
      api.getTask(app.params.id)
        .then(function (t) { s.task = t; TaskDetail.prefill(s); TaskDetail.loadShift(s); })
        .catch(function (err) { s.error = err.message || "Couldn't load this task."; })
        .then(function () { upd(s, { loading: false }); });
    },
    /* The header's shift progress while a task runs. */
    loadShift: function (s) {
      var t = s.task;
      if (!t || !t.shift) return;
      Promise.all([api.getShift(t.shift), api.listTasks({ shift: t.shift })]).then(function (r) {
        upd(s, { shift: { endTime: r[0].endTime, done: r[1].filter(function (x) { return x.status === "done"; }).length, total: r[1].length } });
      }).catch(function () {});
    },
    /* The planned quantity is the likely one: packets default to the order. */
    prefill: function (s) {
      var t = s.task;
      if (t && t.pack && !s.form.packets && t.batch && t.batch.packets) s.form.packets = String(t.batch.packets);
    },
    mine: function (s) { var t = s.task; return t && t.status === "in_progress" && t.assignedTo === (app.worker && app.worker._id); },
    tick: function (s) { return TaskDetail.mine(s); },
    start: function (s) {
      set({ acting: true, error: "" });
      api.claimTask(app.params.id)
        .then(function () { return api.getTask(app.params.id); })
        .then(function (t) { s.task = t; TaskDetail.prefill(s); TaskDetail.loadShift(s); })
        .catch(function (err) { s.error = err.message || "Couldn't start the task."; })
        .then(function () { upd(s, { acting: false }); });
    },
    complete: function (s) {
      var f = s.form, input = {};
      ["kgIn", "kgOut", "sticks", "packets"].forEach(function (k) { if (f[k] !== "") input[k] = Number(f[k]); });
      set({ acting: true, error: "" });
      api.completeTask(app.params.id, input)
        .then(function () { if (app.page === s) navigate("/done/" + app.params.id, true); })
        .catch(function (err) { upd(s, { error: err.message || "Couldn't complete the task.", acting: false }); });
    },
    detailView: function (s) {
      var task = s.task;
      var held = task && task.batch && ["on-hold", "rejected"].indexOf(task.batch.stateId) !== -1;
      var sub = task ? (task.stepCount > 0 ? "Step " + task.stepOrder + " of " + task.stepCount : "") + (task.batch && task.batch.code ? " · " + task.batch.code : "") : "";
      var top = Head("Shift dashboard", "Task detail", sub);
      var body;
      if (s.loading) body = html`<p class="wk-note">Loading task…</p>`;
      else if (!task) body = html`<div class="wk-banner r" style="margin-top: 12px;">${s.error}</div>`;
      else {
        var mates = (task.workersOnThis || []).filter(function (w) { return w._id !== (app.worker && app.worker._id); });
        body = html`<section class="wk-hero">
            <div class="wk-task-h"><span class="wk-badge">${task.role}</span>${Status(task, held)}</div>
            <h2 class="wk-big">${task.stepName}</h2>
            <p class="wk-meta">${batchLine(task)}</p>
            ${task.instructions && html`<hr class="wk-hr"><p class="wk-instr">${task.instructions}</p>`}
            <hr class="wk-hr">
            <div>
              ${task.stepCount > 0 && Row("Step", task.stepOrder + " of " + task.stepCount)}
              ${task.expectedMinutes != null && Row("Expected time", "~" + task.expectedMinutes + " min")}
              ${Row("Unlocks next", task.unlocksNext === false ? "Nothing" : task.nextStep ? "Step " + task.nextStep.order + ": " + task.nextStep.name + " →" : "Batch done 🎉", "teal")}
              ${mates.length > 0 && Row("Also " + (/^[aeiou]/i.test(task.role) ? "an " : "a ") + task.role + " on shift", mates.map(function (w) { return w.name.split(" ")[0]; }).join(", "))}
            </div>
          </section>
          ${held && html`<div class="wk-banner o"><span>⏸</span><span>This batch is ${task.batch.statusLabel.toLowerCase()}. Its steps are paused. Ask your supervisor.</span></div>`}
          ${task.status === "available" && !held && html`<div class="wk-banner b"><span>ℹ️</span><span>Once started, this task is yours. Mark it done when complete — the next step opens for the team.</span></div>`}
          ${task.status === "done" && html`<div class="wk-banner g"><span>✅</span><span>This task is complete.</span></div>`}
          ${Record(task, s)}
          ${s.error && html`<div class="wk-banner r">${s.error}</div>`}`;
      }
      var bar = task && task.status === "available" && !held && html`<button type="button" class="wk-btn go" data-act="start"${attrs({ disabled: s.acting })}>${s.acting ? "Starting…" : "▶ Start this task"}</button>`;
      return Screen("", top, body, bar);
    },
    progressView: function (s) {
      var task = s.task, ms = Date.now() - new Date(task.startedAt).getTime();
      var over = task.expectedMinutes && ms / 60000 > task.expectedMinutes;
      var lastU = (task.updates || [])[0];
      var quiet = sinceMin(lastU ? lastU.createdAt : task.startedAt);
      var sh = s.shift;
      var top = html`<div class="wk-head" style="padding-bottom: 10px;"><button type="button" class="wk-back" data-act="back">← Shift dashboard</button></div>${sh && Progress(sh.done, sh.total, timeLeft(sh.endTime))}`;
      var q = lastU && quick(lastU.quickSelect);
      var body = html`<section class="wk-hero">
          <p class="wk-live">● In progress</p>
          <h2 class="wk-big sm">${task.stepName}</h2>
          <p class="wk-meta">${batchLine(task)}${task.stepCount > 0 ? " · Step " + task.stepOrder + " of " + task.stepCount : ""}</p>
          <div class="wk-timer ${over ? "over" : ""}"><b>${clock(ms)}</b><small>Time on this task${task.expectedMinutes ? " · expected " + task.expectedMinutes + " min" : ""}</small></div>
          ${quiet >= UPDATE_DUE_MIN && html`<div class="wk-nudge"><span aria-hidden="true">🔔</span><div><b>Update due</b><small>No update for ${dur(quiet)}. Tap “Add update” to log your progress.</small></div></div>`}
        </section>
        ${lastU && html`<h2 class="wk-sec">Last update</h2><div class="wk-card wk-upd"><small>${timeOf(lastU.createdAt)} · ${lastU.by}</small><b>${q[1]} ${q[2]}</b>${lastU.note && html`<q>${lastU.note}</q>`}</div>`}
        ${Record(task, s)}
        ${task.instructions && html`<h2 class="wk-sec">How to do it</h2><div class="wk-card wk-instr">${task.instructions}</div>`}
        ${s.error && html`<div class="wk-banner r">${s.error}</div>`}`;
      var bar = html`<button type="button" class="wk-btn go" data-act="complete"${attrs({ disabled: s.acting })}>${s.acting ? "Saving…" : "✅ Mark done"}</button><button type="button" class="wk-btn2 blue" data-act="update"${attrs({ disabled: s.acting })}>💬 Add update</button>`;
      return Screen("", top, body, bar);
    },
    view: function (s) { return TaskDetail.mine(s) ? TaskDetail.progressView(s) : TaskDetail.detailView(s); },
  };

  /* ── 5 · Add update ─────────────────────────────────────────────────── */
  var AddUpdate = {
    init: function () { return { task: null, pick: "", note: "", saving: false, error: "" }; },
    load: function (s) {
      api.getTask(app.params.id).then(function (t) { upd(s, { task: t }); }).catch(function (err) { upd(s, { error: err.message || "Couldn't load this task." }); });
    },
    save: function (s) {
      if (!s.pick || s.saving) return;
      set({ saving: true, error: "" });
      api.postTaskUpdate(app.params.id, { quickSelect: s.pick, note: s.note.trim() || undefined })
        .then(function () { if (app.page === s) back(); })
        .catch(function (err) { upd(s, { error: err.message || "Couldn't save the update.", saving: false }); });
    },
    view: function (s) {
      var top = Head(s.task ? s.task.stepName : "Back", "Add update", "What's happening with this task?");
      var body = html`<h2 class="wk-sec">Quick select</h2>
        <div class="wk-chips">${QUICK.map(function (q) { return html`<button type="button" class="wk-chip ${s.pick === q[0] ? "on" : ""}" data-q="${q[0]}" aria-pressed="${s.pick === q[0] ? "true" : "false"}">${q[1]} ${q[2]}</button>`; })}</div>
        <div class="wk-gap"></div>
        <h2 class="wk-sec">Note <small>· optional</small></h2>
        <div class="wk-area"><textarea data-f="note" placeholder="Type a note… (optional)" maxlength="280">${s.note}</textarea></div>
        ${s.error && html`<div class="wk-banner r">${s.error}</div>`}`;
      var bar = html`<button type="button" class="wk-btn teal" data-act="save"${attrs({ disabled: !s.pick || s.saving })}>${s.saving ? "Saving…" : s.pick ? "💾 Save update" : "Pick what's happening"}</button>`;
      return Screen("", top, body, bar);
    },
  };

  /* ── 6 · Step complete ──────────────────────────────────────────────── */
  var Done = {
    init: function () { return { task: null, error: "" }; },
    load: function (s) {
      api.getTask(app.params.id).then(function (t) { upd(s, { task: t }); }).catch(function (err) { upd(s, { error: err.message || "Couldn't load this task." }); });
    },
    view: function (s) {
      var t = s.task;
      if (!t) return Screen("win", null, html`<div class="wk-win">${s.error ? html`<p>${s.error}</p><button type="button" class="wk-btn white" data-act="back">Back to dashboard →</button>` : ""}</div>`);
      var took = t.durationMinutes != null ? t.durationMinutes : t.startedAt && t.completedAt ? (new Date(t.completedAt) - new Date(t.startedAt)) / 60000 : null;
      var rows = recordedRows(t).slice(0, 3);
      var code = t.batch && t.batch.code;
      var next = t.unlocksNext === false ? "" : t.nextStep
        ? html`<div class="wk-glass"><h2>Next step unlocked</h2><div class="wk-flow"><span>Step ${t.stepOrder} ✓</span><i>→</i><span class="next">Step ${t.nextStep.order}: ${t.nextStep.name}</span></div><p>For: <span style="text-transform: capitalize;">${t.nextStep.role}</span>${code ? " · " + code : ""}</p></div>`
        : html`<div class="wk-glass"><h2>Batch complete</h2><p>That was the last step${code ? " of " + code : ""}. 🎉</p></div>`;
      return Screen("win", null, html`<div class="wk-win">
        <div class="wk-win-i" aria-hidden="true">✅</div>
        <h1>Step complete!</h1>
        <p>${t.stepName}<br>${code || ""}${took != null ? (code ? " · " : "") + (took < 1 ? "Took under a minute" : "Took " + dur(took)) : ""}</p>
        ${rows.length > 0 && html`<div class="wk-glass"><h2>Recorded</h2>${rows.map(function (r) { return Row(r[0], r[1]); })}</div>`}
        ${next}
        <button type="button" class="wk-btn white" data-act="back">Back to dashboard →</button>
      </div>`);
    },
  };

  /* ── 7 · My shift ───────────────────────────────────────────────────── */
  var Shift = {
    init: function () { return { data: null, loading: true, error: "" }; },
    load: function (s) {
      getDashboard(app.worker)
        .then(function (payload) { s.data = payload; })
        .catch(function (err) { s.error = err.message || "Couldn't load your shift."; })
        .then(function () { upd(s, { loading: false }); });
    },
    view: function (s) {
      var w = app.worker || {}, me = w._id;
      var sections = (s.data && s.data.sections) || [];
      var current = s.data && s.data.currentTask;
      var mine = [];
      sections.forEach(function (sec) { sec.all.forEach(function (t) { if (t.status === "done" && t.assignedTo === me) mine.push(t); }); });
      mine.sort(function (a, b) { return new Date(b.completedAt) - new Date(a.completedAt); });
      var worked = mine.reduce(function (m, t) { return m + (t.durationMinutes || 0); }, 0) + (current ? sinceMin(current.startedAt) : 0);
      var batches = {};
      mine.concat(current ? [current] : []).forEach(function (t) { if (t.batch && t.batch.code) batches[t.batch.code] = true; });
      var codes = Object.keys(batches);
      var updates = mine.reduce(function (n, t) { return n + (t.updateCount || 0); }, 0) + (current ? current.updateCount || 0 : 0);
      var first = (w.name || "").split(" ")[0];
      var names = sections.map(function (sec) { return sec.shift.name; }).join(" · ");
      var today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
      var top = Head("Shift dashboard", mine.length ? "Well done, " + first + " 🎉" : "Your shift", (names ? names + " · " : "") + today);
      var body;
      if (s.loading) body = html`<p class="wk-note">Loading your shift…</p>`;
      else if (s.error) body = html`<div class="wk-banner r" style="margin-top: 12px;">${s.error}</div>`;
      else {
        body = html`<div class="wk-stats">
            <div class="wk-tile teal"><b>${mine.length}</b><small>Tasks done</small></div>
            <div class="wk-tile go"><b>${dur(worked).replace(" min", "m")}</b><small>Time on tasks</small></div>
            <div class="wk-tile"><b class="${codes.length === 1 ? "sm" : ""}">${codes.length === 1 ? codes[0] : codes.length}</b><small>${codes.length === 1 ? "Batch" : "Batches"}</small></div>
            <div class="wk-tile"><b>${updates}</b><small>Updates logged</small></div>
          </div>
          ${current && html`<div class="wk-banner o" style="margin-top: 12px;"><span>⏳</span><span>${current.stepName} is still in your hands. Mark it done first, or it stays open under your name.</span></div>`}
          <h2 class="wk-sec">Tasks you did</h2>
          ${mine.length
            ? html`<div class="wk-card rows">${mine.map(function (t) { return Row(html`✅ ${stepLabel(t)}${t.batch && t.batch.code && html`<small>${t.batch.product} · ${t.batch.code}</small>`}`, t.durationMinutes != null ? dur(t.durationMinutes) : "—", "go"); })}</div>`
            : html`<div class="wk-card wk-empty">No tasks done yet on this shift.</div>`}`;
      }
      var bar = html`<button type="button" class="wk-btn teal" data-act="logout">✅ Close shift</button>`;
      return Screen("", top, body, bar);
    },
  };

  /* ── routes ─────────────────────────────────────────────────────────── */
  var ROUTES = [
    [/^\/login$/, "login", Login],
    [/^\/$/, "dashboard", Dashboard],
    [/^\/shift$/, "shift", Shift],
    [/^\/task\/([^/]+)\/update$/, "update", AddUpdate],
    [/^\/task\/([^/]+)$/, "task", TaskDetail],
    [/^\/done\/([^/]+)$/, "done", Done],
  ];
  function route() {
    var p = JF.path();
    if (!app.ready) return render();
    var hit = null;
    for (var i = 0; i < ROUTES.length && !hit; i++) { var m = ROUTES[i][0].exec(p); if (m) hit = { name: ROUTES[i][1], Page: ROUTES[i][2], id: m[1] || null }; }
    if (!hit) return JF.go("/", true);
    if (hit.name === "login" && app.worker) return JF.go("/", true);
    if (hit.name !== "login" && !app.worker) return JF.go("/login", true);
    var key = hit.name + (hit.id ? ":" + hit.id : "");
    if (app.pageName !== key || !app.page) {
      app.pageName = key;
      app.params = { id: hit.id };
      app.page = hit.Page.init();
      app.view = hit.Page;
      window.scrollTo(0, 0);
      render();
      if (hit.Page.load) hit.Page.load(app.page);
      return;
    }
    render();
  }
  function App() {
    if (!app.ready || !app.page) return "";
    return app.view.view(app.page);
  }

  /* ── events ─────────────────────────────────────────────────────────── */
  rootEl.addEventListener("input", function (e) {
    var el = e.target, f = el.getAttribute("data-f");
    if (f && app.view === TaskDetail) { app.page.form[f] = el.value; render(); return; }
    if (f === "note" && app.view === AddUpdate) { app.page.note = el.value; render(); return; }
    if (el.getAttribute("data-model") === "name" && app.view === Login) { app.page.name = el.value; render(); }
  });
  rootEl.addEventListener("click", function (e) {
    var s = app.page;
    var open = e.target.closest("[data-open]");
    if (open && !open.disabled) { navigate("/task/" + open.getAttribute("data-open")); return; }
    var key = e.target.closest("[data-digit]");
    if (key && !key.disabled && app.view === Login) {
      var k = key.getAttribute("data-digit");
      if (k === "back") Login.backspace(s); else Login.digit(s, k);
      return;
    }
    var chip = e.target.closest("[data-q]");
    if (chip && app.view === AddUpdate) { set({ pick: chip.getAttribute("data-q"), error: "" }); return; }
    var el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    var act = el.getAttribute("data-act");
    if (act === "logout") logout();
    else if (act === "back") back();
    else if (act === "shift") navigate("/shift");
    else if (app.view === Login) {
      if (act === "submit") Login.submit(s);
      else if (act === "switch") Login.switchWorker(s);
      else if (act === "sample") Login.mode(s, "sample");
      else if (act === "pin") Login.mode(s, "pin");
      else if (act === "as") Login.signInAs(s, el.getAttribute("data-id"));
    }
    else if (act === "start") TaskDetail.start(s);
    else if (act === "complete") TaskDetail.complete(s);
    else if (act === "update") navigate("/task/" + app.params.id + "/update");
    else if (act === "save") AddUpdate.save(s);
  });
  /* Type the PIN on a physical keyboard, not just the on-screen keypad. */
  window.addEventListener("keydown", function (e) {
    var s = app.page;
    if (app.view !== Login || s.mode !== "pin" || s.submitting || !Login.ready(s)) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key >= "0" && e.key <= "9" && e.key.length === 1) { e.preventDefault(); Login.digit(s, e.key); }
    else if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); Login.backspace(s); }
    else if (e.key === "Enter") { e.preventDefault(); Login.submit(s); }
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
  /* Clocks: the running task's timer, the dashboard's "elapsed". */
  setInterval(function () { if (app.page && app.view && app.view.tick && app.view.tick(app.page)) render(); }, 1000);

  var session = api.loadSession();
  if (session && session.worker) app.worker = session.worker;
  app.ready = true;
  route();
})();

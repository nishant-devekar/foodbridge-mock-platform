/* JobFlow Worker — the Job Workflow worker mockup (28 Sep 2026), on the
 * JobFlow API in ../../../assets/production/production-api.js.
 *
 * Written for the worker, not the office (review, 28 Sep 2026): what to do
 * now, proof of what I did, help when I ask. No timers, no nags, no loss
 * verdicts, no codes — the office screens judge; this one helps.
 *   PIN → Home (my work, or my next work) → Work → Done → Next work …
 *       Work ⇄ Need help;  Home → My day → End my day
 * Routes are hash routes: #/login, #/, #/task/<id>, #/task/<id>/help,
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
  /* When this worker first signed in today: "My day" shows it as proof of
     attendance. A second sign-in the same day keeps the first time. */
  var SINCE_KEY = "fb.v7.jobflow.since";
  function today() { return new Date().toDateString(); }
  function since() { try { var o = JSON.parse(localStorage.getItem(SINCE_KEY)); return o && app.worker && o.id === app.worker._id && o.day === today() ? o.at : null; } catch (e) { return null; } }
  function markSince(w) { try { if (!since()) localStorage.setItem(SINCE_KEY, JSON.stringify({ id: w._id, day: today(), at: new Date().toISOString() })); } catch (e) { /* private window */ } }
  function signedIn(data) {
    api.saveSession({ worker: data.worker, accessToken: data.accessToken, refreshToken: data.refreshToken });
    app.worker = data.worker;
    remember(data.worker);
    markSince(data.worker);
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
  function timeOf(iso) { return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  }
  /* What the worker knows the work by: the product and how much. No batch
     codes, no step numbers — those are the office's words. */
  function productLine(task) {
    var b = task.batch || {};
    return (b.product || "") + (b.kind === "production" && b.batchSize ? " · " + b.batchSize + " kg" : b.packets ? " · " + b.packets + " packets" : "");
  }
  function about(task) { return task.expectedMinutes ? "about " + task.expectedMinutes + " min" : ""; }

  /* "Problem? Need help": three calls, each an alert on Shop Floor until the
     worker says it is sorted (POST /api/tasks/:id/updates). */
  var HELP = [["need_materials", "📦", "Material finished"], ["issue_found", "⚙️", "Machine problem"], ["need_help", "🙋", "Call supervisor"]];
  function helpOf(key) { for (var i = 0; i < HELP.length; i++) if (HELP[i][0] === key) return HELP[i]; return HELP[2]; }

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
  function Row(label, value) { return html`<div class="wk-row"><span>${label}</span><b>${value}</b></div>`; }
  function Offline() {
    return navigator.onLine === false ? html`<div class="wk-sync"><i class="off"></i>No internet · your work is saved on this phone</div>` : "";
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
          ]).then(function (r) { return { shift: shift, pool: r[0], all: r[1] }; });
        })).then(function (sections) { return { currentTask: currentTask, sections: sections }; });
      });
    });
  }
  /* Open work, my own role's first (the owner lifted the role rule; the
     worker still reaches for their own kind of work first). */
  function openWork(data, worker) {
    var list = [];
    ((data && data.sections) || []).forEach(function (sec) { list = list.concat(sec.pool); });
    var role = worker && worker.role;
    return list.filter(function (t) { return t.role === role; }).concat(list.filter(function (t) { return t.role !== role; }));
  }
  function doneByMe(data, worker) {
    var out = [], me = worker && worker._id;
    ((data && data.sections) || []).forEach(function (sec) { sec.all.forEach(function (t) { if (t.status === "done" && t.assignedTo === me) out.push(t); }); });
    return out.sort(function (a, b) { return new Date(b.completedAt) - new Date(a.completedAt); });
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


  /* ── 2 · Home ───────────────────────────────────────────────────────── */
  /* Working: only that work. Free: one card, my next work; the rest folded. */
  var Dashboard = {
    init: function () { return { data: null, error: "", loading: true }; },
    load: function (s) {
      getDashboard(app.worker)
        .then(function (payload) { s.data = payload; })
        .catch(function (err) { s.error = err.message || "Couldn't load your work."; })
        .then(function () { upd(s, { loading: false }); });
    },
    view: function (s) {
      var w = app.worker || {};
      var sections = (s.data && s.data.sections) || [];
      var current = s.data && s.data.currentTask;
      var done = doneByMe(s.data, w).length;
      var sub = s.loading ? "" : sections.length ? sections.map(function (sec) { return sec.shift.name; }).join(" · ") + (done ? " · " + done + " done ✓" : "") : "No shift right now";
      var top = html`${Offline()}<div class="wk-head"><p class="wk-hi">${greeting()} 👋</p><h1>${w.name}</h1>${sub && html`<p class="wk-sub">${sub}</p>`}</div>`;
      var body, bar = null;
      if (s.loading) body = html`<p class="wk-note">Loading your work…</p>`;
      else if (s.error) body = html`<div class="wk-banner r" style="margin-top: 12px;">${s.error}</div>`;
      else if (!sections.length) body = html`<p class="wk-note">No shift right now. Your work will show here when your shift starts.</p>`;
      else if (current) {
        body = html`<h2 class="wk-sec">Your work now</h2>
          <article class="wk-task">
            <p class="wk-live">● Working</p>
            <p class="wk-name">${current.stepName}</p>
            <p class="wk-meta">${productLine(current)}</p>
            <p class="wk-when">Started ${timeOf(current.startedAt)}${about(current) ? " · " + about(current) : ""}</p>
            <button type="button" class="wk-btn teal" data-open="${current._id}">Continue →</button>
          </article>`;
      } else {
        var open = openWork(s.data, w), next = open[0], rest = open.slice(1);
        body = next
          ? html`<h2 class="wk-sec">Your next work</h2>
            <article class="wk-task pool">
              <p class="wk-name">${next.stepName}</p>
              <p class="wk-meta">${productLine(next)}${about(next) ? " · " + about(next) : ""}</p>
              <button type="button" class="wk-btn go" data-open="${next._id}">Start →</button>
            </article>
            ${rest.length > 0 && html`<details class="wk-more"><summary>Other work (${rest.length})</summary>${rest.map(function (t) {
              return html`<button type="button" class="wk-other" data-open="${t._id}"><span><b>${t.stepName}</b><small>${productLine(t)}</small></span><i aria-hidden="true">›</i></button>`;
            })}</details>`}`
          : html`<div class="wk-card wk-empty" style="margin-top: 12px;"><b>No work open right now</b>Check again in a few minutes.</div>`;
        bar = html`<button type="button" class="wk-btn2 plain" data-act="shift">End my day</button>`;
      }
      return Screen("", top, body, bar);
    },
  };

  /* ── 3 · Work (to start, or running) ────────────────────────────────── */
  function TakeList(task) {
    var lines = [];
    (task.store || []).forEach(function (m) {
      lines.push(html`<div class="wk-take"><span aria-hidden="true">🏷️</span><div><b>${m.name}</b>${m.oldest ? html`<small>Lot ${m.oldest.lotNo} · oldest first</small>` : html`<small>None in the store — tell your supervisor</small>`}</div></div>`);
    });
    if (task.freezer) {
      var fz = task.freezer, bags = fz.oldest.map(function (g) { return g.bagNo; });
      lines.push(html`<div class="wk-take"><span aria-hidden="true">🧊</span><div><b>${fz.needKg} kg ${fz.product}</b><small>${bags.length ? "Bags " + bags.join(", ") + " · oldest first" : "No bags in the freezer — tell your supervisor"}</small></div></div>`);
    }
    if (!lines.length) return "";
    return html`<h2 class="wk-sec">Take</h2><section class="wk-card wk-takes">${lines}</section>`;
  }
  /* The time is shown once: here before starting, beside "Started" after. */
  function How(task, withTime) {
    withTime = withTime && task.expectedMinutes > 0;
    if (!task.instructions && !withTime) return "";
    return html`<h2 class="wk-sec">How to do it</h2><section class="wk-card">${task.instructions && html`<p class="wk-instr">${task.instructions}</p>`}${withTime && html`<p class="wk-time">⏱ ${cap(about(task))}</p>`}</section>`;
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
  function Field(id, label, f, key, unit, mode) {
    return html`<div class="wk-in-row"><label for="${id}">${label}</label><div class="wk-in"><input id="${id}" inputmode="${mode || "decimal"}" value="${f[key]}" data-f="${key}"><span>${unit}</span></div></div>`;
  }
  /* What was entered, read back as proof — never a verdict (the loss % and
     its limit are the office's, on Shop Floor and Month End). */
  function recordedRows(task) {
    var rows = [];
    if (task.kgIn) rows.push(["Weight", task.kgIn + " → " + task.kgOut + " kg"]);
    if (task.lots && task.lots.length) rows.push(["Lots", task.lots.map(function (l) { return l.lotNo; }).join(", ")]);
    if (task.sticksUsed) rows.push(["Sticks", task.sticksUsed + " pcs"]);
    if (task.bagsMade) rows.push(["Bags made", task.bagsMade.map(function (g) { return g.bagNo; }).join(", ")]);
    if (task.packets) rows.push(["Packets", task.packets + ""]);
    if (task.bagsTaken) rows.push(["Bags used", task.bagsTaken.map(function (g) { return g.bagNo; }).join(", ")]);
    if (task.cartonsPacked) rows.push(["Cartons", task.cartonsPacked + ""]);
    return rows;
  }

  var TaskDetail = {
    init: function () { return { task: null, loading: true, error: "", acting: false, form: { kgIn: "", kgOut: "", sticks: "", packets: "" } }; },
    load: function (s) {
      api.getTask(app.params.id)
        .then(function (t) { s.task = t; TaskDetail.prefill(s); })
        .catch(function (err) { s.error = err.message || "Couldn't load this work."; })
        .then(function () { upd(s, { loading: false }); });
    },
    reload: function (s) {
      return api.getTask(app.params.id).then(function (t) { s.task = t; TaskDetail.prefill(s); render(); });
    },
    /* The planned quantity is the likely one: packets default to the order. */
    prefill: function (s) {
      var t = s.task;
      if (t && t.pack && !s.form.packets && t.batch && t.batch.packets) s.form.packets = String(t.batch.packets);
    },
    mine: function (s) { var t = s.task; return t && t.status === "in_progress" && t.assignedTo === (app.worker && app.worker._id); },
    held: function (t) { return t && t.batch && ["on-hold", "rejected"].indexOf(t.batch.stateId) !== -1; },
    /* What still has to be filled before Start / Done — the button says it. */
    missingToStart: function (s) { var t = s.task; return t.weigh && !(num(s.form.kgIn) > 0) ? "Enter weight before" : ""; },
    missingToFinish: function (s) {
      var t = s.task, f = s.form;
      if (t.weigh) {
        var kin = t.kgInStart || num(f.kgIn);
        if (!(kin > 0)) return "Enter weight before";
        if (!(num(f.kgOut) > 0)) return "Enter weight after";
        if (num(f.kgOut) > kin) return "Weight after is more than before";
      }
      if (t.bags && !(num(f.kgOut) > 0)) return "Enter kg into bags";
      if (t.sticks && !(num(f.sticks) >= 0)) return "Enter sticks used";
      if (t.pack && !(num(f.packets) > 0)) return "Enter packets packed";
      return "";
    },
    start: function (s) {
      if (TaskDetail.missingToStart(s)) return;
      set({ acting: true, error: "" });
      api.claimTask(app.params.id, s.task.weigh ? { kgIn: Number(s.form.kgIn) } : {})
        .then(function () { return TaskDetail.reload(s); })
        .catch(function (err) { s.error = err.message || "Couldn't start. Try again."; })
        .then(function () { upd(s, { acting: false }); });
    },
    complete: function (s) {
      if (TaskDetail.missingToFinish(s)) return;
      var f = s.form, input = {};
      ["kgIn", "kgOut", "sticks", "packets"].forEach(function (k) { if (f[k] !== "") input[k] = Number(f[k]); });
      set({ acting: true, error: "" });
      api.completeTask(app.params.id, input)
        .then(function () { if (app.page === s) navigate("/done/" + app.params.id, true); })
        .catch(function (err) { upd(s, { error: err.message || "Couldn't save. Try again.", acting: false }); });
    },
    sorted: function (s) {
      set({ acting: true });
      api.postTaskUpdate(app.params.id, { quickSelect: "sorted" })
        .then(function () { return TaskDetail.reload(s); })
        .catch(function () {})
        .then(function () { upd(s, { acting: false }); });
    },
    view: function (s) {
      var task = s.task;
      var top = Head("Home", task ? task.stepName : "", task ? productLine(task) : "");
      if (s.loading) return Screen("", top, html`<p class="wk-note">Loading…</p>`);
      if (!task) return Screen("", top, html`<div class="wk-banner r" style="margin-top: 12px;">${s.error}</div>`);
      return TaskDetail.mine(s) ? TaskDetail.working(s, top) : TaskDetail.toStart(s, top);
    },
    toStart: function (s, top) {
      var task = s.task, held = TaskDetail.held(task), canStart = task.status === "available" && !held;
      var state = held ? html`<div class="wk-banner o" style="margin-top: 12px;"><span>✋</span><span>Stop. This batch is on hold. Ask your supervisor.</span></div>`
        : task.status === "in_progress" ? html`<div class="wk-banner b" style="margin-top: 12px;"><span>👷</span><span>${task.assignedName || "Someone"} is doing this.</span></div>`
        : task.status === "done" ? html`<div class="wk-banner g" style="margin-top: 12px;"><span>✅</span><span>Done by ${task.assignedName || "—"} at ${timeOf(task.completedAt)}.</span></div>`
        : task.status !== "available" ? html`<div class="wk-banner o" style="margin-top: 12px;"><span>⏳</span><span>Not ready yet. The work before this is still going.</span></div>` : "";
      var missing = canStart && TaskDetail.missingToStart(s);
      var body = html`${state}
        ${How(task, true)}
        ${task.status !== "done" && TakeList(task)}
        ${canStart && task.weigh && html`<h2 class="wk-sec">Before you start</h2><section class="wk-card wk-rec">${Field("kg-in", "Weight before", s.form, "kgIn", "kg")}</section>`}
        ${task.status === "done" && recordedRows(task).length > 0 && html`<h2 class="wk-sec">What was entered</h2><section class="wk-card rows">${recordedRows(task).map(function (r) { return Row(r[0], r[1]); })}</section>`}
        ${s.error && html`<div class="wk-banner r">${s.error}</div>`}`;
      var bar = canStart && html`<button type="button" class="wk-btn go" data-act="start"${attrs({ disabled: s.acting || !!missing })}>${s.acting ? "Starting…" : missing || "▶ Start now"}</button>`;
      return Screen("", top, body, bar);
    },
    working: function (s, top) {
      var task = s.task, f = s.form, h = task.help;
      var fields = [];
      if (task.weigh) {
        fields.push(task.kgInStart ? Row("Weight before", task.kgInStart + " kg") : Field("kg-in", "Weight before", f, "kgIn", "kg"));
        fields.push(Field("kg-out", "Weight after", f, "kgOut", "kg"));
      }
      if (task.sticks) fields.push(Field("sticks", "Sticks used", f, "sticks", "pcs", "numeric"));
      if (task.bags) {
        var kb = num(f.kgOut), n = kb > 0 ? Math.ceil(kb / task.bags) : 0;
        fields.push(Field("kg-bag", "Kg into bags", f, "kgOut", "kg"));
        fields.push(html`<p class="wk-plan">${task.bags} kg in each bag${n ? " · makes " + n + " bag" + (n > 1 ? "s" : "") : ""}. The bag stickers print after Done.</p>`);
      }
      if (task.pack) fields.push(Field("packets", "Packets packed", f, "packets", "pcs", "numeric"));
      if (task.cartons && task.cartonPlan) fields.push(html`<p class="wk-plan">${task.cartonPlan.packets} packets · ${task.cartonPlan.perCarton} in each carton · ${Math.ceil(task.cartonPlan.packets / task.cartonPlan.perCarton)} cartons into the freezer.</p>`);
      var missing = TaskDetail.missingToFinish(s);
      var body = html`<section class="wk-hero slim"><p class="wk-live">● Working</p><p class="wk-when">Started ${timeOf(task.startedAt)}${about(task) ? " · " + about(task) : ""}</p></section>
        ${h && html`<div class="wk-banner g"><span>✅</span><span class="grow">Supervisor told: ${h.label.toLowerCase()} · ${timeOf(h.at)}</span><button type="button" class="wk-mini" data-act="sorted"${attrs({ disabled: s.acting })}>Sorted</button></div>`}
        ${How(task, false)}
        ${TakeList(task)}
        ${fields.length > 0 && html`<h2 class="wk-sec">Enter</h2><section class="wk-card wk-rec">${fields}</section>`}
        ${s.error && html`<div class="wk-banner r">${s.error}</div>`}`;
      var bar = html`<button type="button" class="wk-btn go" data-act="complete"${attrs({ disabled: s.acting || !!missing })}>${s.acting ? "Saving…" : missing || "✅ Done"}</button>${!h && html`<button type="button" class="wk-btn2 warn" data-act="help"${attrs({ disabled: s.acting })}>🙋 Problem? Need help</button>`}`;
      return Screen("", top, body, bar);
    },
  };

  /* ── 4 · Need help ──────────────────────────────────────────────────── */
  /* One tap sends it — nothing to confirm (Ruthless panes, 24 Sep 2026). */
  var Help = {
    init: function () { return { task: null, sent: "", sending: "", error: "" }; },
    load: function (s) {
      api.getTask(app.params.id).then(function (t) { upd(s, { task: t }); }).catch(function () {});
    },
    send: function (s, key) {
      if (s.sending || s.sent) return;
      set({ sending: key, error: "" });
      api.postTaskUpdate(app.params.id, { quickSelect: key })
        .then(function () { upd(s, { sent: key, sending: "" }); })
        .catch(function () { upd(s, { error: "Couldn't send. Try again.", sending: "" }); });
    },
    view: function (s) {
      if (s.sent) {
        var h = helpOf(s.sent);
        return Screen("", null, html`<div class="wk-sent"><div class="wk-win-i" aria-hidden="true">✅</div><h1>Supervisor told</h1><p>${h[1]} ${h[2]}</p><p class="wk-sent-sub">Keep working if you can. They will come to you.</p></div>`,
          html`<button type="button" class="wk-btn teal" data-act="back">Back to work</button>`);
      }
      var top = Head(s.task ? s.task.stepName : "Back", "What's the problem?", "");
      var body = html`<div class="wk-opts">${HELP.map(function (h) {
          return html`<button type="button" class="wk-opt" data-help="${h[0]}"${attrs({ disabled: !!s.sending })}><span aria-hidden="true">${h[1]}</span>${s.sending === h[0] ? "Sending…" : h[2]}</button>`;
        })}</div>
        ${s.error && html`<div class="wk-banner r">${s.error}</div>`}`;
      return Screen("", top, body);
    },
  };

  /* ── 5 · Done ───────────────────────────────────────────────────────── */
  /* A win, the numbers read back, and straight on to the next work. */
  var Done = {
    init: function () { return { task: null, error: "", count: null, next: null, ready: false }; },
    load: function (s) {
      api.getTask(app.params.id).then(function (t) { upd(s, { task: t }); }).catch(function (err) { upd(s, { error: err.message || "Couldn't load this work." }); });
      getDashboard(app.worker).then(function (d) {
        upd(s, { count: doneByMe(d, app.worker).length, next: d.currentTask ? null : openWork(d, app.worker)[0] || null, ready: true });
      }).catch(function () { upd(s, { ready: true }); });
    },
    view: function (s) {
      var t = s.task;
      if (!t) return Screen("win", null, html`<div class="wk-win">${s.error ? html`<p>${s.error}</p><button type="button" class="wk-btn white" data-act="home">Home →</button>` : ""}</div>`);
      var rows = recordedRows(t);
      return Screen("win", null, html`<div class="wk-win">
        <div class="wk-win-i" aria-hidden="true">✅</div>
        <h1>Well done!</h1>
        <p>${t.stepName}${s.count ? html`<br><b>${s.count} done today</b>` : ""}</p>
        ${rows.length > 0 && html`<div class="wk-glass"><h2>What you entered</h2>${rows.map(function (r) { return Row(r[0], r[1]); })}</div>`}
        ${!s.ready ? "" : s.next
          ? html`<button type="button" class="wk-btn white" data-act="next" data-id="${s.next._id}">Next: ${s.next.stepName} →</button><button type="button" class="wk-btn ghost-light" data-act="home">Home</button>`
          : html`<button type="button" class="wk-btn white" data-act="home">Home →</button>`}
      </div>`);
    },
  };

  /* ── 6 · My day ─────────────────────────────────────────────────────── */
  var Shift = {
    init: function () { return { data: null, loading: true, error: "" }; },
    load: function (s) {
      getDashboard(app.worker)
        .then(function (payload) { s.data = payload; })
        .catch(function (err) { s.error = err.message || "Couldn't load your day."; })
        .then(function () { upd(s, { loading: false }); });
    },
    view: function (s) {
      var w = app.worker || {};
      var current = s.data && s.data.currentTask;
      var mine = doneByMe(s.data, w);
      var first = (w.name || "").split(" ")[0];
      var dayName = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
      var top = Head("Home", mine.length ? "Well done, " + first + " 🎉" : "Your day", dayName);
      var body;
      if (s.loading) body = html`<p class="wk-note">Loading your day…</p>`;
      else if (s.error) body = html`<div class="wk-banner r" style="margin-top: 12px;">${s.error}</div>`;
      else {
        var at = since();
        body = html`<section class="wk-hero wk-count"><b>${mine.length}</b><span>${mine.length === 1 ? "work" : "works"} done today</span>${at && html`<small>Signed in at ${timeOf(at)}</small>`}</section>
          ${current && html`<div class="wk-banner o"><span>⏳</span><span>Finish ${current.stepName} first.</span></div>`}
          ${mine.length > 0 && html`<h2 class="wk-sec">What you did</h2><div class="wk-card rows">${mine.map(function (t) { return Row(html`${t.stepName}<small>${productLine(t)}</small>`, timeOf(t.completedAt)); })}</div>`}`;
      }
      var bar = html`<button type="button" class="wk-btn teal" data-act="logout"${attrs({ disabled: !!current || s.loading })}>${current ? "Finish your work first" : "End my day"}</button>`;
      return Screen("", top, body, bar);
    },
  };

  /* ── routes ─────────────────────────────────────────────────────────── */
  var ROUTES = [
    [/^\/login$/, "login", Login],
    [/^\/$/, "dashboard", Dashboard],
    [/^\/shift$/, "shift", Shift],
    [/^\/task\/([^/]+)\/help$/, "help", Help],
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
    var help = e.target.closest("[data-help]");
    if (help && !help.disabled && app.view === Help) { Help.send(s, help.getAttribute("data-help")); return; }
    var el = e.target.closest("[data-act]");
    if (!el || el.disabled) return;
    var act = el.getAttribute("data-act");
    if (act === "logout") logout();
    else if (act === "back") back();
    else if (act === "home") { depth = 0; JF.go("/", true); }
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
    else if (act === "sorted") TaskDetail.sorted(s);
    else if (act === "help") navigate("/task/" + app.params.id + "/help");
    else if (act === "next") navigate("/task/" + el.getAttribute("data-id"), true);
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

  var session = api.loadSession();
  if (session && session.worker) app.worker = session.worker;
  app.ready = true;
  route();
})();

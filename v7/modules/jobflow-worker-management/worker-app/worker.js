/* JobFlow Worker — the Job Workflow worker mockup (28 Sep 2026), on the
 * JobFlow API in ../../../assets/production/production-api.js.
 *
 * Written for the worker, not the office (review, 28 Sep 2026): what to do
 * now, proof of what I did, help when I ask. No timers, no nags, no loss
 * verdicts, no codes — the office screens judge; this one helps.
 *   Phone + PIN → Home (my work, or my next work) → Work → Done → Next …
 *       Work ⇄ Need help;  Home → My day → End my day
 * In English, Hindi or Marathi: every fixed word is in i18n.js, through t().
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

  /* ── language ───────────────────────────────────────────────────────── */
  /* The phone keeps the worker's language; English until one is picked. */
  var I18N = WK_I18N, LANG_KEY = "fb.v7.jobflow.lang";
  var lang = (function () { try { var l = localStorage.getItem(LANG_KEY); return I18N.dict[l] ? l : "en"; } catch (e) { return "en"; } })();
  function setLang(l) {
    if (!I18N.dict[l]) return;
    lang = l;
    try { localStorage.setItem(LANG_KEY, l); } catch (e) { /* private window */ }
    document.documentElement.lang = l;
    render();
  }
  document.documentElement.lang = lang;
  function t(key, vars) {
    var s = I18N.dict[lang][key];
    if (s == null) s = I18N.dict.en[key];
    if (s == null) return key;
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }) : s;
  }
  function role(r) { var k = "role:" + r; return I18N.dict.en[k] ? t(k) : r; }
  /* An API message as the worker's words: a known one translated, any
     other replaced by the screen's own "couldn't …" line (English keeps the
     API's own words, which say more). */
  function said(err, fallback) {
    var m = err && err.message, k = m && I18N.API[m];
    if (k) return t(k);
    return lang === "en" && m ? m : t(fallback);
  }
  function LangSwitch() {
    return html`<div class="wk-lang" role="group" aria-label="${t("language")}">${I18N.LANGS.map(function (l) {
      return html`<button type="button" data-lang="${l[0]}" class="${l[0] === lang ? "on" : ""}" lang="${l[0]}" aria-pressed="${l[0] === lang ? "true" : "false"}">${l[1]}</button>`;
    })}</div>`;
  }

  /* ── session ────────────────────────────────────────────────────────── */
  /* The phone remembers who last signed in on it, and their number, so next
     time it asks only for the PIN (mockup: "Not Ramesh? Switch worker"). */
  var LAST_KEY = "fb.v7.jobflow.lastWorker";
  function lastWorker() { try { var w = JSON.parse(localStorage.getItem(LAST_KEY)); return w && w.name && w.phone ? w : null; } catch (e) { return null; } }
  function remember(w) { try { if (w && w.phone) localStorage.setItem(LAST_KEY, JSON.stringify({ name: w.name, role: w.role, phone: w.phone })); else localStorage.removeItem(LAST_KEY); } catch (e) { /* private window */ } }
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
  /* Phone number + PIN (28 Sep 2026): names were typed in English and
     spelt many ways; a phone number is one thing every worker knows. */
  function login(phone, pin) { return api.workerLoginPhone(phone, pin).then(signedIn); }
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
  function timeOf(iso) { return new Date(iso).toLocaleTimeString(I18N.LOCALE[lang], { hour: "numeric", minute: "2-digit", hour12: true }); }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : NaN; }
  function digitsOnly(v) { return String(v || "").replace(/\D/g, ""); }
  function greeting() {
    var h = new Date().getHours();
    return t(h < 12 ? "morning" : h < 17 ? "afternoon" : "evening");
  }
  /* What the worker knows the work by: the product and how much. No batch
     codes, no step numbers — those are the office's words. */
  function productLine(task) {
    var b = task.batch || {};
    return (b.product || "") + (b.kind === "production" && b.batchSize ? " · " + t("kgN", { n: b.batchSize }) : b.packets ? " · " + t("packetsN", { n: b.packets }) : "");
  }
  function about(task) { return task.expectedMinutes ? t("aboutMin", { n: task.expectedMinutes }) : ""; }

  /* "Problem? Need help": three calls, each an alert on Shop Floor until the
     worker says it is sorted (POST /api/tasks/:id/updates). */
  /* [kind, icon, the button's words, what was asked once sent] */
  var HELP = [["need_materials", "📦", "hMat", "tMat"], ["issue_found", "⚙️", "hMach", "tMach"], ["need_help", "🙋", "hSup", "tSup"]];
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
    return navigator.onLine === false ? html`<div class="wk-sync"><i class="off"></i>${t("offline")}</div>` : "";
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
    var r = worker && worker.role;
    return list.filter(function (x) { return x.role === r; }).concat(list.filter(function (x) { return x.role !== r; }));
  }
  function doneByMe(data, worker) {
    var out = [], me = worker && worker._id;
    ((data && data.sections) || []).forEach(function (sec) { sec.all.forEach(function (x) { if (x.status === "done" && x.assignedTo === me) out.push(x); }); });
    return out.sort(function (a, b) { return new Date(b.completedAt) - new Date(a.completedAt); });
  }

  /* ── 1 · Sign in ────────────────────────────────────────────────────── */
  var PIN_LENGTH = 4, PHONE_LENGTH = 10;
  var Login = {
    init: function () {
      var known = lastWorker();
      return { known: known, phone: known ? known.phone : "", pin: "", error: "", submitting: false, workers: [], mode: "pin", asId: "" };
    },
    load: function (s) {
      api.listSignInWorkers().then(function (list) { upd(s, { workers: list }); }).catch(function () {});
    },
    ready: function (s) { return digitsOnly(s.phone).slice(-PHONE_LENGTH).length === PHONE_LENGTH; },
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
      login(digitsOnly(s.phone).slice(-PHONE_LENGTH), s.pin)
        .then(function () { if (app.page === s) navigate("/", true); })
        .catch(function (err) { upd(s, { error: said(err, "loginFail"), pin: "" }); })
        .then(function () { upd(s, { submitting: false }); });
    },
    signInAs: function (s, id) {
      if (!id || s.submitting) return;
      set({ submitting: true, error: "", pin: "", asId: id });
      loginAs(id)
        .then(function () { if (app.page === s) navigate("/", true); })
        .catch(function (err) { upd(s, { error: said(err, "loginFail"), asId: "" }); })
        .then(function () { upd(s, { submitting: false }); });
    },
    /* "Not Asha? Switch worker": forget this phone's worker, ask for a number. */
    switchWorker: function (s) {
      if (s.submitting) return;
      remember(null);
      set({ known: null, phone: "", pin: "", error: "" });
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
      return html`<div class="wk-pad">${["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(key)}<button type="button" class="del" data-digit="back" aria-label="${t("del")}"${attrs({ disabled: off || !s.pin })}>⌫</button>${key("0")}<button type="button" class="ok" data-act="submit" aria-label="${t("signIn")}"${attrs({ disabled: off || s.pin.length !== PIN_LENGTH })}>✓</button></div>`;
    },
    sampleView: function (s) {
      return html`<h2 class="wk-sec">${t("signInAs")}</h2>
        <ul class="wk-people">${s.workers.map(function (w) {
          return html`<li><button type="button" data-act="as" data-id="${w._id}"${attrs({ disabled: s.submitting })} class="${s.asId === w._id ? "on" : ""}">${Avatar(w.name, 40)}<span><b>${w.name}</b><small>${role(w.role)}</small></span>${w.onShift && html`<em>${t("onShift")}</em>`}</button></li>`;
        })}</ul>
        <p class="wk-msg">${s.submitting ? "" : s.error}</p>
        <p class="wk-switch">${t("havePin")} <button type="button" class="wk-link" data-act="pin">${t("signInPhone")}</button></p>`;
    },
    pinView: function (s) {
      var dots = [];
      for (var i = 0; i < PIN_LENGTH; i++) dots.push(html`<i class="${i < s.pin.length ? "on" : ""}"></i>`);
      var first = s.known ? s.known.name.split(" ")[0] : "";
      return html`<div class="wk-me">${s.known
          ? html`${Avatar(s.known.name, 56)}<b>${s.known.name}</b><small>${role(s.known.role)}</small>`
          : html`<label for="wk-phone">${t("yourPhone")}</label><div class="wk-phone"><span>+91</span><input id="wk-phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="10" value="${s.phone}" data-model="phone" placeholder="98XXXXXXXX"${attrs({ disabled: s.submitting })}></div>`}</div>
        <div class="wk-pin ${s.error ? "err" : ""}" role="status" aria-label="${t("digits", { n: s.pin.length, m: PIN_LENGTH })}">${dots}</div>
        <p class="wk-msg">${s.submitting ? "" : s.error}</p>
        ${Login.pad(s)}
        ${!Login.ready(s) && html`<p class="wk-hint">${t("phoneFirst")}</p>`}
        <p class="wk-switch">${s.known
          ? html`<button type="button" class="wk-link" data-act="switch">${t("notYou", { name: first })}</button>`
          : s.workers.length > 0 && html`${t("noAccount")} <button type="button" class="wk-link" data-act="sample">${t("useSample")}</button>`}</p>`;
    },
    view: function (s) {
      var sample = s.mode === "sample";
      var top = html`<div class="wk-lang-row">${LangSwitch()}</div><div class="wk-hello"><div class="wk-hello-i" aria-hidden="true">🏭</div><h1>${t("hello")}</h1><p>${sample ? t("pickSample") : t("enterPin")}</p></div>`;
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
        .catch(function (err) { s.error = said(err, "loadWorkFail"); })
        .then(function () { upd(s, { loading: false }); });
    },
    view: function (s) {
      var w = app.worker || {};
      var sections = (s.data && s.data.sections) || [];
      var current = s.data && s.data.currentTask;
      var done = doneByMe(s.data, w).length;
      var sub = s.loading ? "" : sections.length ? sections.map(function (sec) { return sec.shift.name; }).join(" · ") + (done ? " · " + t("doneN", { n: done }) : "") : t("noShiftShort");
      var top = html`${Offline()}<div class="wk-head"><p class="wk-hi">${greeting()} 👋</p><h1>${w.name}</h1>${sub && html`<p class="wk-sub">${sub}</p>`}</div>`;
      var body, bar = null;
      if (s.loading) body = html`<p class="wk-note">${t("loadingWork")}</p>`;
      else if (s.error) body = html`<div class="wk-banner r" style="margin-top: 12px;">${s.error}</div>`;
      else if (!sections.length) body = html`<p class="wk-note">${t("noShiftLong")}</p>`;
      else if (current) {
        body = html`<h2 class="wk-sec">${t("workNow")}</h2>
          <article class="wk-task">
            <p class="wk-live">${t("working")}</p>
            <p class="wk-name">${current.stepName}</p>
            <p class="wk-meta">${productLine(current)}</p>
            <p class="wk-when">${t("started", { time: timeOf(current.startedAt) })}${about(current) ? " · " + about(current) : ""}</p>
            <button type="button" class="wk-btn teal" data-open="${current._id}">${t("continue")}</button>
          </article>`;
      } else {
        var open = openWork(s.data, w), next = open[0], rest = open.slice(1);
        body = next
          ? html`<h2 class="wk-sec">${t("nextWork")}</h2>
            <article class="wk-task pool">
              <p class="wk-name">${next.stepName}</p>
              <p class="wk-meta">${productLine(next)}${about(next) ? " · " + about(next) : ""}</p>
              <button type="button" class="wk-btn go" data-open="${next._id}">${t("start")}</button>
            </article>
            ${rest.length > 0 && html`<details class="wk-more"><summary>${t("otherWork", { n: rest.length })}</summary>${rest.map(function (x) {
              return html`<button type="button" class="wk-other" data-open="${x._id}"><span><b>${x.stepName}</b><small>${productLine(x)}</small></span><i aria-hidden="true">›</i></button>`;
            })}</details>`}`
          : html`<div class="wk-card wk-empty" style="margin-top: 12px;"><b>${t("noWork")}</b>${t("checkAgain")}</div>`;
        bar = html`<button type="button" class="wk-btn2 plain" data-act="shift">${t("endDay")}</button>`;
      }
      return Screen("", top, body, bar);
    },
  };

  /* ── 3 · Work (to start, or running) ────────────────────────────────── */
  function TakeList(task) {
    var lines = [];
    (task.store || []).forEach(function (m) {
      lines.push(html`<div class="wk-take"><span aria-hidden="true">🏷️</span><div><b>${m.name}</b><small>${m.oldest ? t("lotOldest", { lot: m.oldest.lotNo }) : t("noneStore")}</small></div></div>`);
    });
    if (task.freezer) {
      var fz = task.freezer, bags = fz.oldest.map(function (g) { return g.bagNo; });
      lines.push(html`<div class="wk-take"><span aria-hidden="true">🧊</span><div><b>${t("kgN", { n: fz.needKg })} · ${fz.product}</b><small>${bags.length ? t("bagsOldest", { list: bags.join(", ") }) : t("noBags")}</small></div></div>`);
    }
    if (!lines.length) return "";
    return html`<h2 class="wk-sec">${t("take")}</h2><section class="wk-card wk-takes">${lines}</section>`;
  }
  /* The time is shown once: here before starting, beside "Started" after. */
  function How(task, withTime) {
    withTime = withTime && task.expectedMinutes > 0;
    if (!task.instructions && !withTime) return "";
    return html`<h2 class="wk-sec">${t("howTo")}</h2><section class="wk-card">${task.instructions && html`<p class="wk-instr">${task.instructions}</p>`}${withTime && html`<p class="wk-time">⏱ ${t("aboutMinCap", { n: task.expectedMinutes })}</p>`}</section>`;
  }
  function Field(id, label, f, key, unit, mode) {
    return html`<div class="wk-in-row"><label for="${id}">${label}</label><div class="wk-in"><input id="${id}" inputmode="${mode || "decimal"}" value="${f[key]}" data-f="${key}"><span>${unit}</span></div></div>`;
  }
  /* What was entered, read back as proof — never a verdict (the loss % and
     its limit are the office's, on Shop Floor and Month End). */
  function recordedRows(task) {
    var rows = [];
    if (task.kgIn) rows.push([t("rWeight"), task.kgIn + " → " + t("kgN", { n: task.kgOut })]);
    if (task.lots && task.lots.length) rows.push([t("rLots"), task.lots.map(function (l) { return l.lotNo; }).join(", ")]);
    if (task.sticksUsed) rows.push([t("rSticks"), t("pcsN", { n: task.sticksUsed })]);
    if (task.bagsMade) rows.push([t("rBagsMade"), task.bagsMade.map(function (g) { return g.bagNo; }).join(", ")]);
    if (task.packets) rows.push([t("rPackets"), task.packets + ""]);
    if (task.bagsTaken) rows.push([t("rBagsUsed"), task.bagsTaken.map(function (g) { return g.bagNo; }).join(", ")]);
    if (task.cartonsPacked) rows.push([t("rCartons"), task.cartonsPacked + ""]);
    return rows;
  }

  var TaskDetail = {
    init: function () { return { task: null, loading: true, error: "", acting: false, form: { kgIn: "", kgOut: "", sticks: "", packets: "" } }; },
    load: function (s) {
      api.getTask(app.params.id)
        .then(function (x) { s.task = x; TaskDetail.prefill(s); })
        .catch(function (err) { s.error = said(err, "loadFail"); })
        .then(function () { upd(s, { loading: false }); });
    },
    reload: function (s) {
      return api.getTask(app.params.id).then(function (x) { s.task = x; TaskDetail.prefill(s); render(); });
    },
    /* The planned quantity is the likely one: packets default to the order. */
    prefill: function (s) {
      var x = s.task;
      if (x && x.pack && !s.form.packets && x.batch && x.batch.packets) s.form.packets = String(x.batch.packets);
    },
    mine: function (s) { var x = s.task; return x && x.status === "in_progress" && x.assignedTo === (app.worker && app.worker._id); },
    held: function (x) { return x && x.batch && ["on-hold", "rejected"].indexOf(x.batch.stateId) !== -1; },
    /* What still has to be filled before Start / Done — the button says it. */
    missingToStart: function (s) { return s.task.weigh && !(num(s.form.kgIn) > 0) ? t("mBefore") : ""; },
    missingToFinish: function (s) {
      var x = s.task, f = s.form;
      if (x.weigh) {
        var kin = x.kgInStart || num(f.kgIn);
        if (!(kin > 0)) return t("mBefore");
        if (!(num(f.kgOut) > 0)) return t("mAfter");
        if (num(f.kgOut) > kin) return t("mMore");
      }
      if (x.bags && !(num(f.kgOut) > 0)) return t("mBags");
      if (x.sticks && !(num(f.sticks) >= 0)) return t("mSticks");
      if (x.pack && !(num(f.packets) > 0)) return t("mPackets");
      return "";
    },
    start: function (s) {
      if (TaskDetail.missingToStart(s)) return;
      set({ acting: true, error: "" });
      api.claimTask(app.params.id, s.task.weigh ? { kgIn: Number(s.form.kgIn) } : {})
        .then(function () { return TaskDetail.reload(s); })
        .catch(function (err) { s.error = said(err, "startFail"); })
        .then(function () { upd(s, { acting: false }); });
    },
    complete: function (s) {
      if (TaskDetail.missingToFinish(s)) return;
      var f = s.form, input = {};
      ["kgIn", "kgOut", "sticks", "packets"].forEach(function (k) { if (f[k] !== "") input[k] = Number(f[k]); });
      set({ acting: true, error: "" });
      api.completeTask(app.params.id, input)
        .then(function () { if (app.page === s) navigate("/done/" + app.params.id, true); })
        .catch(function (err) { upd(s, { error: said(err, "saveFail"), acting: false }); });
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
      var top = Head(t("home"), task ? task.stepName : "", task ? productLine(task) : "");
      if (s.loading) return Screen("", top, html`<p class="wk-note">${t("loading")}</p>`);
      if (!task) return Screen("", top, html`<div class="wk-banner r" style="margin-top: 12px;">${s.error}</div>`);
      return TaskDetail.mine(s) ? TaskDetail.working(s, top) : TaskDetail.toStart(s, top);
    },
    toStart: function (s, top) {
      var task = s.task, held = TaskDetail.held(task), canStart = task.status === "available" && !held;
      var state = held ? html`<div class="wk-banner o" style="margin-top: 12px;"><span>✋</span><span>${t("held")}</span></div>`
        : task.status === "in_progress" ? html`<div class="wk-banner b" style="margin-top: 12px;"><span>👷</span><span>${t("doing", { name: task.assignedName || t("someone") })}</span></div>`
        : task.status === "done" ? html`<div class="wk-banner g" style="margin-top: 12px;"><span>✅</span><span>${t("doneBy", { name: task.assignedName || "—", time: timeOf(task.completedAt) })}</span></div>`
        : task.status !== "available" ? html`<div class="wk-banner o" style="margin-top: 12px;"><span>⏳</span><span>${t("notReady")}</span></div>` : "";
      var missing = canStart && TaskDetail.missingToStart(s);
      var rows = task.status === "done" ? recordedRows(task) : [];
      var body = html`${state}
        ${How(task, true)}
        ${task.status !== "done" && TakeList(task)}
        ${canStart && task.weigh && html`<h2 class="wk-sec">${t("beforeStart")}</h2><section class="wk-card wk-rec">${Field("kg-in", t("wBefore"), s.form, "kgIn", t("unitKg"))}</section>`}
        ${rows.length > 0 && html`<h2 class="wk-sec">${t("whatEntered")}</h2><section class="wk-card rows">${rows.map(function (r) { return Row(r[0], r[1]); })}</section>`}
        ${s.error && html`<div class="wk-banner r">${s.error}</div>`}`;
      var bar = canStart && html`<button type="button" class="wk-btn go" data-act="start"${attrs({ disabled: s.acting || !!missing })}>${s.acting ? t("starting") : missing || t("startNow")}</button>`;
      return Screen("", top, body, bar);
    },
    working: function (s, top) {
      var task = s.task, f = s.form, h = task.help;
      var fields = [];
      if (task.weigh) {
        fields.push(task.kgInStart ? Row(t("wBefore"), t("kgN", { n: task.kgInStart })) : Field("kg-in", t("wBefore"), f, "kgIn", t("unitKg")));
        fields.push(Field("kg-out", t("wAfter"), f, "kgOut", t("unitKg")));
      }
      if (task.sticks) fields.push(Field("sticks", t("sticksUsed"), f, "sticks", t("unitPcs"), "numeric"));
      if (task.bags) {
        var kb = num(f.kgOut), n = kb > 0 ? Math.ceil(kb / task.bags) : 0;
        fields.push(Field("kg-bag", t("kgBags"), f, "kgOut", t("unitKg")));
        fields.push(html`<p class="wk-plan">${t("eachBag", { kg: task.bags })}${n ? (n === 1 ? t("makesBag") : t("makesBags", { n: n })) : ""}. ${t("stickers")}</p>`);
      }
      if (task.pack) fields.push(Field("packets", t("packetsPacked"), f, "packets", t("unitPcs"), "numeric"));
      if (task.cartons && task.cartonPlan) fields.push(html`<p class="wk-plan">${t("cartonPlan", { p: task.cartonPlan.packets, per: task.cartonPlan.perCarton, n: Math.ceil(task.cartonPlan.packets / task.cartonPlan.perCarton) })}</p>`);
      var missing = TaskDetail.missingToFinish(s);
      var body = html`<section class="wk-hero slim"><p class="wk-live">${t("working")}</p><p class="wk-when">${t("started", { time: timeOf(task.startedAt) })}${about(task) ? " · " + about(task) : ""}</p></section>
        ${h && html`<div class="wk-banner g"><span>✅</span><span class="grow">${t("told", { label: t(helpOf(h.kind)[3]), time: timeOf(h.at) })}</span><button type="button" class="wk-mini" data-act="sorted"${attrs({ disabled: s.acting })}>${t("sorted")}</button></div>`}
        ${How(task, false)}
        ${TakeList(task)}
        ${fields.length > 0 && html`<h2 class="wk-sec">${t("enter")}</h2><section class="wk-card wk-rec">${fields}</section>`}
        ${s.error && html`<div class="wk-banner r">${s.error}</div>`}`;
      var bar = html`<button type="button" class="wk-btn go" data-act="complete"${attrs({ disabled: s.acting || !!missing })}>${s.acting ? t("saving") : missing || t("doneBtn")}</button>${!h && html`<button type="button" class="wk-btn2 warn" data-act="help"${attrs({ disabled: s.acting })}>${t("needHelp")}</button>`}`;
      return Screen("", top, body, bar);
    },
  };

  /* ── 4 · Need help ──────────────────────────────────────────────────── */
  /* One tap sends it — nothing to confirm (Ruthless panes, 24 Sep 2026). */
  var Help = {
    init: function () { return { task: null, sent: "", sending: "", error: "" }; },
    load: function (s) {
      api.getTask(app.params.id).then(function (x) { upd(s, { task: x }); }).catch(function () {});
    },
    send: function (s, key) {
      if (s.sending || s.sent) return;
      set({ sending: key, error: "" });
      api.postTaskUpdate(app.params.id, { quickSelect: key })
        .then(function () { upd(s, { sent: key, sending: "" }); })
        .catch(function () { upd(s, { error: t("sendFail"), sending: "" }); });
    },
    view: function (s) {
      if (s.sent) {
        var h = helpOf(s.sent);
        return Screen("", null, html`<div class="wk-sent"><div class="wk-win-i" aria-hidden="true">✅</div><h1>${t("toldTitle")}</h1><p>${h[1]} ${t(h[3])}</p><p class="wk-sent-sub">${t("keepWorking")}</p></div>`,
          html`<button type="button" class="wk-btn teal" data-act="back">${t("backToWork")}</button>`);
      }
      var top = Head(s.task ? s.task.stepName : t("back"), t("problem"), "");
      var body = html`<div class="wk-opts">${HELP.map(function (h) {
          return html`<button type="button" class="wk-opt" data-help="${h[0]}"${attrs({ disabled: !!s.sending })}><span aria-hidden="true">${h[1]}</span>${s.sending === h[0] ? t("sending") : t(h[2])}</button>`;
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
      api.getTask(app.params.id).then(function (x) { upd(s, { task: x }); }).catch(function (err) { upd(s, { error: said(err, "loadFail") }); });
      getDashboard(app.worker).then(function (d) {
        upd(s, { count: doneByMe(d, app.worker).length, next: d.currentTask ? null : openWork(d, app.worker)[0] || null, ready: true });
      }).catch(function () { upd(s, { ready: true }); });
    },
    view: function (s) {
      var x = s.task;
      if (!x) return Screen("win", null, html`<div class="wk-win">${s.error ? html`<p>${s.error}</p><button type="button" class="wk-btn white" data-act="home">${t("homeArrow")}</button>` : ""}</div>`);
      var rows = recordedRows(x);
      return Screen("win", null, html`<div class="wk-win">
        <div class="wk-win-i" aria-hidden="true">✅</div>
        <h1>${t("wellDone")}</h1>
        <p>${x.stepName}${s.count ? html`<br><b>${s.count === 1 ? t("doneToday1") : t("doneToday", { n: s.count })}</b>` : ""}</p>
        ${rows.length > 0 && html`<div class="wk-glass"><h2>${t("youEntered")}</h2>${rows.map(function (r) { return Row(r[0], r[1]); })}</div>`}
        ${!s.ready ? "" : s.next
          ? html`<button type="button" class="wk-btn white" data-act="next" data-id="${s.next._id}">${t("nextName", { name: s.next.stepName })}</button><button type="button" class="wk-btn ghost-light" data-act="home">${t("home")}</button>`
          : html`<button type="button" class="wk-btn white" data-act="home">${t("homeArrow")}</button>`}
      </div>`);
    },
  };

  /* ── 6 · My day ─────────────────────────────────────────────────────── */
  var Shift = {
    init: function () { return { data: null, loading: true, error: "" }; },
    load: function (s) {
      getDashboard(app.worker)
        .then(function (payload) { s.data = payload; })
        .catch(function (err) { s.error = said(err, "loadDayFail"); })
        .then(function () { upd(s, { loading: false }); });
    },
    view: function (s) {
      var w = app.worker || {};
      var current = s.data && s.data.currentTask;
      var mine = doneByMe(s.data, w);
      var first = (w.name || "").split(" ")[0];
      var dayName = new Date().toLocaleDateString(I18N.LOCALE[lang], { weekday: "long", day: "numeric", month: "long" });
      var top = Head(t("home"), mine.length ? t("wellDoneName", { name: first }) : t("yourDay"), dayName);
      var body;
      if (s.loading) body = html`<p class="wk-note">${t("loadingDay")}</p>`;
      else if (s.error) body = html`<div class="wk-banner r" style="margin-top: 12px;">${s.error}</div>`;
      else {
        var at = since();
        body = html`<section class="wk-hero wk-count"><b>${mine.length}</b><span>${mine.length === 1 ? t("workDone1") : t("worksDone")}</span>${at && html`<small>${t("signedAt", { time: timeOf(at) })}</small>`}</section>
          ${current && html`<div class="wk-banner o"><span>⏳</span><span>${t("finishFirst", { name: current.stepName })}</span></div>`}
          ${mine.length > 0 && html`<h2 class="wk-sec">${t("whatYouDid")}</h2><div class="wk-card rows">${mine.map(function (x) { return Row(html`${x.stepName}<small>${productLine(x)}</small>`, timeOf(x.completedAt)); })}</div>`}
          <h2 class="wk-sec">${t("language")}</h2><div class="wk-lang-card">${LangSwitch()}</div>`;
      }
      var bar = html`<button type="button" class="wk-btn teal" data-act="logout"${attrs({ disabled: !!current || s.loading })}>${current ? t("finishWork") : t("endDay")}</button>`;
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
    if (el.getAttribute("data-model") === "phone" && app.view === Login) {
      var v = digitsOnly(el.value).slice(0, PHONE_LENGTH);
      if (el.value !== v) el.value = v;
      app.page.phone = v; app.page.error = "";
      /* all 10 digits in: put the phone's keyboard away so the PIN pad shows */
      if (v.length === PHONE_LENGTH) el.blur();
      render();
    }
  });
  rootEl.addEventListener("click", function (e) {
    var s = app.page;
    var lg = e.target.closest("[data-lang]");
    if (lg) { setLang(lg.getAttribute("data-lang")); return; }
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

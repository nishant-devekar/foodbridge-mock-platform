/* ==========================================================================
   EXIT DEMO — the footer bar, and the way out of the demo behind it.

   THE FLOW, as it stands (21 Sep 2026):

       EXIT DEMO ─▶ ┌ 👋 Share feedback before you go ──────┐
                    │  faces ─(a face)─▶ comment (type/speak)│
                    │  Set up my account  →  sign-up        │
                    │  Keep exploring     →  stays here     │
                    │  ✕  →  back to the screen             │
                    └───────────────────────────────────────┘

   IT STAYS ON THE PLATFORM. The exit used to end in the WhatsApp chat; it
   no longer leaves at all (21 Sep 2026, product owner). So "exit demo" means
   leaving the DEMO — the sample business — for the real thing: setting up
   their own account (or, with one, opening it). The only other answer is
   "not yet", and that keeps them where they were.

   · One question first: the faces. Everything else appears only once they
     have answered, so nothing on the sheet is ever greyed out.
   · The ask follows the answer: after Bad or Meh, "Keep exploring" leads and
     the question is "What went wrong?" — no sign-up pushed at someone
     unhappy.
   · Asked once a visit: rated already, a second EXIT DEMO goes straight to
     the two ways on.
   · The sheet is dismissible: the ✕, a scrim tap or Escape goes back.
   · Feedback is QUEUED FIRST, sent second, and never waited on: it is in
     localStorage before the request leaves, so a dead network or an
     unconfigured bridge delays it instead of losing it.

   AND IT IS ON EVERY DESTINATION. The platform shell mounts it once for all
   of them; a module that draws its own (Raw Material Inventory, which passes
   a Receive Stock tab through it) wins, and the shell stands its bar down.

   Everything here is one file, no dependencies, no build step, and it draws
   its own styles — the same rules as every other module in this cut.
   ========================================================================== */

(function () {
  "use strict";

  /* ── Where things point ──────────────────────────────────────────────── */
  var DEFAULT_BASE = "https://zoho-function-nu.vercel.app";
  var LOCAL_BASE = "http://localhost:8787";
  var API_KEY = "tFcdYY4RepvrSmvdLsmG3jls3_1J2epW";   // same shared key the other screens carry
  var QUEUE_KEY = "fb.v7.feedback.queue";   // not yet delivered
  var LOG_KEY = "fb.v7.feedback.log";       // everything ever given on THIS device
  var WHO_KEY = "fb.v7.account";           // what onboarding wrote, if this browser has been through it
  var RATED_KEY = "fb.v7.rated";           // this visit has answered the faces already (sessionStorage)

  function apiBase() {
    var stored = ls.get("fb-api-base");
    if (stored) return String(stored).replace(/\/+$/, "");
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) ? LOCAL_BASE : DEFAULT_BASE;
  }

  /* ── Storage, never allowed to throw ─────────────────────────────────── */
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    json: function (k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  };

  var esc = function (s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };

  /* ── Going somewhere on the platform ─────────────────────────────────── */
  /* The window that owns the platform's hash is not always `top`: the IVR
     simulator frames the platform, so `top` is the simulator there. Climb
     until a frame answers to FBPlatform; fall back to `top`. */
  function platformWin() {
    var w = window;
    for (var i = 0; i < 5; i++) {
      try { if (w.FBPlatform) return w; } catch (e) { /* not ours to read */ }
      var up; try { up = w.parent; } catch (e) { break; }
      if (!up || up === w) break;
      w = up;
    }
    try { return window.top; } catch (e) { return window; }
  }
  function goPlatform(route) {
    try { platformWin().location.hash = "#/" + route; return true; } catch (e) { return false; }
  }
  /* ── The log ─────────────────────────────────────────────────────────────
     The queue empties as entries are delivered, which would leave the operator
     of a demo with nothing to read while no store is configured — the exact
     situation this cut is in. So every submission is ALSO written to a log
     that delivery never empties, and /v7/feedback.html falls back to it. Same
     origin as the screens, so the page can read what the modules wrote. */
  function logged() { var l = ls.json(LOG_KEY); return Array.isArray(l) ? l : []; }
  function record(entry) {
    var l = logged();
    l.push(entry);
    ls.set(LOG_KEY, JSON.stringify(l.slice(-500)));
  }

  /* ── The queue ───────────────────────────────────────────────────────── */
  function queued() { var q = ls.json(QUEUE_KEY); return Array.isArray(q) ? q : []; }
  function enqueue(entry) { var q = queued(); q.push(entry); ls.set(QUEUE_KEY, JSON.stringify(q.slice(-50))); }
  function dequeue(entry) {
    ls.set(QUEUE_KEY, JSON.stringify(queued().filter(function (e) { return e.local !== entry.local; })));
  }

  function send(entry) {
    return fetch(apiBase() + "/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-FB-Key": API_KEY },
      body: JSON.stringify(entry),
    }).then(function (r) {
      if (r.ok) { dequeue(entry); return true; }
      /* Drop ONLY what the server has judged about this entry — a malformed
         payload never becomes valid on a retry. Everything else is about the
         deployment, not the entry: a bridge that 404s because the route is not
         deployed yet is exactly the case where keeping it matters, and treating
         that as "unfixable" would throw away real feedback. */
      if (r.status === 400 || r.status === 422) dequeue(entry);
      return false;
    }, function () { return false; });   // offline: it stays queued
  }

  function flush() {
    var q = queued();
    if (!q.length) return;
    q.slice(0, 5).forEach(function (e) { send(e); });
  }

  /* ── Who they are, when we already know ──────────────────────────────── */
  function known() {
    var a = ls.json(WHO_KEY) || {};
    /* No account yet: the number they came from WhatsApp with, if onboarding
       has kept it for this tab (fb.ob.waPhone). */
    var wa = ""; try { wa = sessionStorage.getItem("fb.ob.waPhone") || ""; } catch (e) { /* storage off */ }
    return { name: a.guest ? "" : (a.name || ""), phone: String(a.mobile || wa).replace(/\D/g, "").slice(-10),
             account: !a.guest && !!a.name };
  }

  /* ── Styles ──────────────────────────────────────────────────────────── */
  var CSS = [
    "#fbx-foot{display:none}",
    "#fbx-foot .fbx-tab{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 8px;border:none;background:transparent;cursor:pointer;font-family:inherit}",
    "#fbx-foot .fbx-tab span{font-size:10px;font-weight:600;color:#9ca3af;white-space:nowrap}",
    /* These two carry a class AND sit where the grey label rule above
       matches, so they are written to out-specify it rather than to rely
       on source order — the label rule is `#id .class element`. */
    "#fbx-foot .fbx-tab span.fbx-chip{display:block;padding:4px 12px;border-radius:8px;background:#059669;color:#fff}",
    "#fbx-foot .fbx-tab span.fbx-green{color:#047857;font-weight:600}",
    "@media (max-width:1023.98px){",
    "  #fbx-foot{position:fixed;left:0;right:0;bottom:0;z-index:var(--fbx-z,39);box-sizing:border-box;height:58px;padding:0 8px;",
    "    background:#fff;border-top:1px solid #e5e7eb;display:flex;align-items:center;justify-content:center;gap:30px;",
    "    font-family:system-ui,-apple-system,sans-serif}",
    /* `hidden` has to out-specify the rule above it. The browser's own
       [hidden]{display:none} is beaten by an ID selector, so the shell could
       set the attribute — and did — while the bar stayed on screen. Both
       callers rely on this: the destination that asks for no bar, and the one
       that draws its own. */
    "  #fbx-foot[hidden]{display:none}",
    /* Only a page that HAS the bar pays for it. The sheet is used on its own
       by screens with a footer of their own — Delivery Management — and 58px
       of padding there would be a gap under a full-height app. */
    "  body.fbx-has-foot{padding-bottom:58px}",
    /* ── "there is more this way" ──────────────────────────────────────
       A bar with more in it than fits scrolls sideways, and nothing says so
       until somebody tries it (owner, 23 Sep 2026). The end that has more
       carries a soft fade with a chevron in it — and the chevron is a
       button, so the cue is also the way to use it. It is drawn beside the
       bar rather than inside it: an absolute child of a scroller travels
       with the content it is meant to sit over. */
    "  .fbx-onmore{position:fixed;bottom:0;z-index:calc(var(--fbx-z,39) + 1);width:46px;display:flex;align-items:center;",
    "    border:0;padding:0;background:none;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s ease}",
    "  .fbx-onmore.is-on{opacity:1;pointer-events:auto}",
    "  .fbx-onmore.is-l{left:0;justify-content:flex-start;padding-left:5px;",
    "    background:linear-gradient(to right,rgba(255,255,255,.97) 45%,rgba(255,255,255,0))}",
    "  .fbx-onmore.is-r{right:0;justify-content:flex-end;padding-right:5px;",
    "    background:linear-gradient(to left,rgba(255,255,255,.97) 45%,rgba(255,255,255,0))}",
    "  .fbx-onmore svg{width:17px;height:17px;color:#6b7280;display:block}",
    "  .fbx-onmore:active svg{color:#111418}",
    "}",
    /* The sheet is its own layer, above everything including the module's own
       drawers: it is the one thing on screen while it is open. */
    ".fbx-scrim{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:2147483000;animation:fbx-fade .18s ease}",
    ".fbx-sheet{position:fixed;left:0;right:0;bottom:0;z-index:2147483001;max-height:92vh;overflow:auto;",
    "  background:#fff;border-radius:18px 18px 0 0;box-shadow:0 -12px 40px rgba(15,23,42,.24);",
    "  font-family:system-ui,-apple-system,sans-serif;color:#0d0f12;animation:fbx-rise .22s cubic-bezier(.2,.8,.3,1)}",
    "@media (min-width:640px){.fbx-sheet{left:50%;right:auto;transform:translateX(-50%);width:420px;bottom:0;border-radius:18px 18px 0 0}}",
    "@keyframes fbx-rise{from{transform:translateY(14px);opacity:.6}to{transform:none;opacity:1}}",
    "@media (min-width:640px){@keyframes fbx-rise{from{transform:translateX(-50%) translateY(14px);opacity:.6}to{transform:translateX(-50%);opacity:1}}}",
    "@keyframes fbx-fade{from{opacity:0}to{opacity:1}}",
    ".fbx-grip{width:36px;height:4px;border-radius:99px;background:#e2e5ea;margin:8px auto 0}",
    ".fbx-head{display:flex;align-items:flex-start;gap:10px;padding:14px 18px 4px}",
    ".fbx-head h2{margin:0;font-size:17px;line-height:22px;font-weight:700}",
    ".fbx-head p{margin:3px 0 0;font-size:12.5px;line-height:17px;color:#5b616b}",
    ".fbx-x{margin-left:auto;flex:0 0 auto;width:30px;height:30px;display:grid;place-items:center;border:0;border-radius:50%;background:#f1f3f5;color:#3a3f47;cursor:pointer;font-size:16px;line-height:1}",
    ".fbx-form{padding:4px 18px 18px}",
    ".fbx-label{margin:12px 0 6px;font-size:12px;font-weight:600;color:#3a3f47}",
    ".fbx-rate{display:flex;gap:6px}",
    ".fbx-rate button{flex:1;padding:8px 0 6px;border:1px solid #e6e8eb;border-radius:11px;background:#fff;cursor:pointer;font:inherit;line-height:1.1}",
    ".fbx-rate .em{display:block;font-size:19px}",
    ".fbx-rate .lb{display:block;margin-top:3px;font-size:9.5px;color:#6b7079}",
    ".fbx-rate button[aria-pressed=true]{border-color:#0e8a3c;background:#f3faf5;box-shadow:inset 0 0 0 1px #0e8a3c}",
    ".fbx-in{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #e6e8eb;border-radius:10px;font:inherit;font-size:16px;background:#fff;color:#0d0f12}",
    ".fbx-in:focus{outline:none;border-color:#0e8a3c;box-shadow:0 0 0 3px #e8f5ec}",
    "textarea.fbx-in{min-height:74px;resize:vertical}",
    /* Speak instead of type: a mic in the comment box's corner. */
    ".fbx-talk{position:relative}",
    ".fbx-talk textarea.fbx-in{padding-right:52px}",
    ".fbx-mic{position:absolute;right:8px;bottom:10px;width:36px;height:36px;display:grid;place-items:center;border:0;border-radius:50%;background:#f1f3f5;color:#3a3f47;cursor:pointer}",
    ".fbx-mic.is-on{background:#e03a3e;color:#fff;animation:fbx-pulse 1.3s ease-out infinite}",
    "@keyframes fbx-pulse{0%{box-shadow:0 0 0 0 rgba(224,58,62,.45)}100%{box-shadow:0 0 0 12px rgba(224,58,62,0)}}",
    "@media (prefers-reduced-motion:reduce){.fbx-mic.is-on{animation:none}}",
    ".fbx-cta{width:100%;min-height:46px;margin-top:16px;border:0;border-radius:11px;background:#0e8a3c;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer}",
    ".fbx-cta[disabled]{background:#e3e5e8;color:#9ca1a9;cursor:default}",
    ".fbx-more{animation:fbx-in .22s ease both}",
    "@keyframes fbx-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}",
    "@media (prefers-reduced-motion:reduce){.fbx-more{animation:none}}",
    ".fbx-cta.is-alt{margin-top:10px;background:#fff;color:#0e8a3c;box-shadow:inset 0 0 0 1.5px #0e8a3c}",
    ".fbx-cta.is-alt[disabled]{background:#fff;color:#b8bcc3;box-shadow:inset 0 0 0 1.5px #e3e5e8}",
    ".fbx-err{margin:10px 0 0;font-size:12.5px;color:#c0392b}",
    ".fbx-done{padding:22px 18px 26px;text-align:center}",
    ".fbx-done .tick{width:52px;height:52px;margin:0 auto 10px;display:grid;place-items:center;border-radius:50%;background:#e8f5ec;color:#0e8a3c;font-size:26px}",
    ".fbx-done h3{margin:0;font-size:16px}",
    ".fbx-done p{margin:5px 0 0;font-size:12.5px;color:#5b616b}",
  ].join("\n");

  function injectCss() {
    if (document.getElementById("fbx-css")) return;
    var st = document.createElement("style");
    st.id = "fbx-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ── Icons, 24-grid, stroked like the rest of the cut ─────────────────── */
  var ICON = {
    mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>',
  };

  /* ── The sheet ───────────────────────────────────────────────────────── */
  var open = false, rating = 0, sending = false;

  function close() {
    open = false;
    stopTalk();
    var s = document.getElementById("fbx-scrim"), h = document.getElementById("fbx-sheet");
    if (s) s.remove();
    if (h) h.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function shell(inner) {
    var scrim = document.getElementById("fbx-scrim");
    if (!scrim) {
      scrim = document.createElement("div");
      scrim.id = "fbx-scrim";
      scrim.className = "fbx-scrim";
      scrim.addEventListener("click", close);
      document.body.appendChild(scrim);
    }
    var sheet = document.getElementById("fbx-sheet");
    if (!sheet) {
      sheet = document.createElement("section");
      sheet.id = "fbx-sheet";
      sheet.className = "fbx-sheet";
      sheet.setAttribute("role", "dialog");
      sheet.setAttribute("aria-modal", "true");
      sheet.setAttribute("aria-label", "End of demo");
      document.body.appendChild(sheet);
    }
    sheet.innerHTML = '<div class="fbx-grip"></div>' + inner;
    var x = sheet.querySelector(".fbx-x");
    if (x) x.addEventListener("click", close);
    return sheet;
  }

  /* 21 Sep 2026 — ONE SHEET. EXIT DEMO opens the form itself (titled
     "Share feedback before you go" since 22 Sep); the menu in front of it offered a single row and
     cost a tap for nothing. Send ends in the chat; the ✕, a scrim tap or
     Escape goes back to the screen. There is no Skip (21 Sep 2026).

     NOT "you've completed the demo". EXIT DEMO is on every destination, so
     most taps come from the middle of a look around — nothing here knows
     whether anyone finished anything. */
  function openMenu() {
    injectCss();
    open = true;
    document.addEventListener("keydown", onKey);
    openForm();
  }

  /* ── Speak instead of type ──────────────────────────────────────────────
     The browser's own speech-to-text (Web Speech API): words land in the box
     as they are heard, and stay there to be edited like anything typed. No
     server of ours is involved. Where the browser has none (Firefox), there
     is no mic at all rather than one that fails. Indian English by default;
     what is typed alongside is kept — speech is appended, never replaces. */
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var rec = null;

  function startTalk(ta, btn, err) {
    if (!SR || rec) return;
    var base = ta.value && !/\s$/.test(ta.value) ? ta.value + " " : ta.value;
    var heard = "";
    try { rec = new SR(); } catch (e) { rec = null; return; }
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = function (ev) {
      var fin = "", part = "";
      for (var i = 0; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) fin += ev.results[i][0].transcript; else part += ev.results[i][0].transcript;
      }
      heard = fin;
      ta.value = (base + fin + part).slice(0, 1200);
    };
    rec.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        err.hidden = false; err.textContent = "The microphone is blocked — type your answer instead.";
      } else if (ev.error === "network") {
        err.hidden = false; err.textContent = "Speech needs a connection — type your answer instead.";
      }
    };
    rec.onend = function () {
      ta.value = (base + heard).replace(/\s+$/, "").slice(0, 1200);
      btn.classList.remove("is-on"); btn.setAttribute("aria-pressed", "false"); btn.setAttribute("aria-label", "Speak your answer");
      rec = null;
    };
    err.hidden = true;
    btn.classList.add("is-on"); btn.setAttribute("aria-pressed", "true"); btn.setAttribute("aria-label", "Stop");
    try { rec.start(); } catch (e) { rec.onend(); }
  }
  function stopTalk() { if (rec) { try { rec.stop(); } catch (e) { /* already stopping */ } } }

  var FACES = [
    { v: 1, em: "😡", lb: "Bad" },
    { v: 2, em: "🙁", lb: "Meh" },
    { v: 3, em: "😐", lb: "OK" },
    { v: 4, em: "🙂", lb: "Good" },
    { v: 5, em: "🤩", lb: "Great" },
  ];

  var rated = function () { try { return !!sessionStorage.getItem(RATED_KEY); } catch (e) { return false; } };
  var markRated = function () { try { sessionStorage.setItem(RATED_KEY, "1"); } catch (e) { /* storage off */ } };

  /* One question at a time, in one sheet: the faces; then, once answered,
     the comment and the two ways on. See the header for why. */
  function openForm() {
    var who = known();
    rating = 0;
    var again = rated();
    var sheet = shell(
      /* One ask on every EXIT DEMO, answered by the faces right under it
         (owner, 22 Sep 2026). The first time a visit the faces come first;
         after that they are there but optional, and the ways on show at once:
         nobody is made to rate twice. */
      '<header class="fbx-head"><div><h2>👋 Share feedback before you go</h2></div>' +
        '<button class="fbx-x" aria-label="Close">✕</button></header>' +
      '<div class="fbx-form">' +
        '<div class="fbx-rate" role="group" aria-label="Rating">' +
          FACES.map(function (f) {
            return '<button type="button" data-r="' + f.v + '" aria-pressed="false" aria-label="' + f.lb + '">' +
              '<span class="em">' + f.em + '</span><span class="lb">' + f.lb + "</span></button>";
          }).join("") +
        "</div>" +
        '<div class="fbx-more" id="fbx-more"' + (again ? "" : " hidden") + ">" +
          '<p class="fbx-label" id="fbx-ask">What would you change?</p>' +
          '<div class="fbx-talk">' +
            '<textarea class="fbx-in" id="fbx-comment" placeholder="' + (SR ? "Type or speak — optional" : "Optional") + '" maxlength="1200"></textarea>' +
            (SR ? '<button type="button" class="fbx-mic" id="fbx-mic" aria-label="Speak your answer" aria-pressed="false">' + ICON.mic + "</button>" : "") +
          "</div>" +
          /* No name or phone fields: who they are comes from what we already
             hold — the account on this browser, or the WhatsApp number they
             arrived with. */
          '<p class="fbx-err" id="fbx-err" hidden></p>' +
          '<div class="fbx-ways" id="fbx-ways"></div>' +
        "</div>" +
      "</div>"
    );

    var more = sheet.querySelector("#fbx-more"), ways = sheet.querySelector("#fbx-ways"), ask = sheet.querySelector("#fbx-ask");
    /* Someone who already has an account on this browser is taken into it:
       sign-up starts over, which would lose what they built. */
    var account = function (primary) {
      return '<button class="fbx-cta' + (primary ? "" : " is-alt") + '" data-next="' + (who.account ? "account" : "setup") + '">' +
        (who.account ? "Open my account" : "Set up my account") + "</button>";
    };
    var stay = function (primary) {
      return '<button class="fbx-cta' + (primary ? "" : " is-alt") + '" data-next="stay">Keep exploring</button>';
    };
    var paintWays = function () {
      var low = rating > 0 && rating <= 2;
      if (ask) ask.textContent = low ? "What went wrong?" : "What would you change?";
      ways.innerHTML = low ? stay(true) + account(false) : account(true) + stay(false);
    };
    if (again) paintWays();

    sheet.querySelectorAll(".fbx-rate button").forEach(function (b) {
      b.addEventListener("click", function () {
        rating = Number(b.getAttribute("data-r"));
        sheet.querySelectorAll(".fbx-rate button").forEach(function (o) {
          o.setAttribute("aria-pressed", o === b ? "true" : "false");
        });
        paintWays();
        more.hidden = false;
      });
    });
    ways.addEventListener("click", function (e) {
      var t = e.target.closest("[data-next]");
      if (!t) return;
      /* Rated earlier this visit and nothing new said: straight on. A face
         or a comment this time is feedback, and is sent. */
      if (again && !rating && !sheet.querySelector("#fbx-comment").value.trim()) return go(t.getAttribute("data-next"), who);
      submit(sheet, t.getAttribute("data-next"), again);
    });
    var mic = sheet.querySelector("#fbx-mic");
    if (mic) mic.addEventListener("click", function () {
      if (rec) stopTalk(); else startTalk(sheet.querySelector("#fbx-comment"), mic, sheet.querySelector("#fbx-err"));
    });
  }

  /* Where each answer leads. Everything stays on the platform. */
  function go(next, who) {
    close();
    if (next === "stay") return;
    if (next === "account") { if (!goPlatform("control-tower")) location.href = "/#/control-tower"; return; }
    /* Sign-up, with what we know carried in. It rides in the hash, so it
       never reaches a server log, and onboarding wipes it once read. */
    var q = "onboarding?signup=1" + (who.phone ? "&phone=" + who.phone : "") + (who.name ? "&name=" + encodeURIComponent(who.name) : "");
    if (!goPlatform(q)) location.href = "/#/" + q;
  }

  /* The first time a visit a face is required; after that a comment alone
     is feedback too (the reader shows it with "•" for no face). */
  function submit(sheet, next, optional) {
    if (sending || (!rating && !optional)) return;
    stopTalk();
    sending = true;
    var who = known();
    var entry = {
      local: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      rating: rating || null,
      comment: sheet.querySelector("#fbx-comment").value,
      next: next,
      name: who.name,
      phone: who.phone,
      screen: (document.title || "").slice(0, 120),
      version: "v7",
    };

    /* Kept BEFORE the request, twice: the queue is what still owes delivery,
       the log is what was said. From here on the entry survives a dead
       network, a closed tab and an unconfigured bridge. */
    entry.at = new Date().toISOString();
    record(entry);
    enqueue(entry);
    send(entry);
    markRated();

    shell(
      '<div class="fbx-done"><div class="tick">✓</div>' +
        "<h3>" + (next === "setup" ? "Thanks! Setting up your account…" : next === "account" ? "Thanks! Opening your account…" : "Thanks!") + "</h3></div>"
    );
    setTimeout(function () { sending = false; go(next, who); }, next === "stay" ? 900 : 700);
  }

  /* ── "there is more this way" ────────────────────────────────────────
     (`fbx-onmore`, not `fbx-more`: the sheet already owns that name for its
     other ways out, and its animation would hold this one open.) 
     Shown only while the bar actually overflows, on the end that has more,
     and taken away as soon as it does not. The first time a bar turns out
     to be scrollable it also nudges itself a few pixels: nothing explains a
     scroll like seeing it move once. */
  var CHEV = {
    l: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
    r: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
  };
  function scrollCue(foot) {
    var ends = {}, nudged = false, step = 170;
    ["l", "r"].forEach(function (side) {
      var b = document.createElement("button");
      b.type = "button";
      b.id = "fbx-onmore-" + side;
      b.className = "fbx-onmore is-" + side;
      b.setAttribute("aria-label", side === "l" ? "Show what is to the left" : "Show what is to the right");
      b.innerHTML = CHEV[side];
      b.addEventListener("click", function () {
        foot.scrollBy({ left: side === "l" ? -step : step, behavior: "smooth" });
      });
      document.body.appendChild(b);
      ends[side] = b;
    });
    function sync() {
      var box = foot.getBoundingClientRect();
      var room = foot.scrollWidth - foot.clientWidth;
      var live = !foot.hidden && box.height > 0 && room > 8;
      ends.l.style.height = ends.r.style.height = box.height + "px";
      ends.l.classList.toggle("is-on", live && foot.scrollLeft > 6);
      ends.r.classList.toggle("is-on", live && foot.scrollLeft < room - 6);
      if (live && !nudged) { nudged = true; nudge(); }
    }
    function nudge() {
      foot.scrollTo({ left: 28, behavior: "smooth" });
      setTimeout(function () { foot.scrollTo({ left: 0, behavior: "smooth" }); }, 430);
    }
    foot.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    /* The bar changes as the owner moves around: items come and go, and a
       tab can simply be hidden — an attribute, not a child — so watch for
       both, or the cue outlives what it was pointing at. */
    try {
      new MutationObserver(sync).observe(foot, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ["hidden", "class", "style"],
      });
    } catch (e) { /* older engine */ }
    setTimeout(sync, 0);
  }

  /* ── The footer ──────────────────────────────────────────────────────── */
  /* opts.tabs: extra tabs to the LEFT of EXIT DEMO, each
     { id, label, icon, green?, onClick } — Raw Material Inventory puts its
     Receive Stock control here. opts.z: stacking, per module (see each page). */
  function mount(opts) {
    opts = opts || {};
    injectCss();
    if (new URLSearchParams(location.search).has("bare")) { flush(); return; }
    if (document.getElementById("fbx-foot")) return;

    if (opts.z) document.documentElement.style.setProperty("--fbx-z", String(opts.z));

    /* `pad: false` — the caller has its own room for the bar.

       The padding assumes a document that flows: 58px at the end keeps the
       last line clear of the bar. The platform shell is not that. Its content
       is a full-height iframe, so the padding shrinks nothing and simply makes
       the shell itself 58px taller than the window — the whole app slides up
       and down over a white strip. Framed screens reserve their own room
       instead (screens.css). */
    if (opts.pad !== false) document.body.classList.add("fbx-has-foot");
    var foot = document.createElement("div");
    foot.id = "fbx-foot";
    foot.innerHTML =
      (opts.tabs || []).map(function (t, i) {
        return '<button type="button" class="fbx-tab" data-x="' + i + '">' +
          (t.green ? '<span class="fbx-chip">' + t.icon + "</span>" : t.icon) +
          '<span class="' + (t.green ? "fbx-green" : "") + '">' + esc(t.label) + "</span></button>";
      }).join("") +
      '<button type="button" class="fbx-tab" id="fbx-exit">' + ICON.back + "<span>EXIT DEMO</span></button>";
    document.body.appendChild(foot);

    (opts.tabs || []).forEach(function (t, i) {
      foot.querySelector('[data-x="' + i + '"]').addEventListener("click", t.onClick);
    });
    foot.querySelector("#fbx-exit").addEventListener("click", openMenu);
    scrollCue(foot);

    /* Anything an earlier visit could not deliver goes now. */
    flush();
  }

  window.FB_EXIT = { mount: mount, open: openMenu, flush: flush, apiBase: apiBase, log: logged, pending: queued };
})();

/* ==========================================================================
   EXIT DEMO — the footer bar, and the three ways out of the demo behind it.

   THE FLOW, as the product owner drew it (End of Demo Journey):

       EXIT DEMO ─▶ ┌ You've completed the demo ────────────┐
                    │  Give feedback      → form → WhatsApp │
                    │  Become part of FB  → onboarding S01  │
                    │  Back to WhatsApp   → the IVR         │
                    └───────────────────────────────────────┘

   WHAT WAS REFINED, and why:

   · The sheet is DISMISSIBLE. Tapping the way out must not be a trap; a scrim
     tap, the X, or Escape returns to the screen they were on.
   · The form is THREE fields and one tap. A rating is the only required
     answer, because a rating everyone gives beats a paragraph nobody writes.
     Name and number are prefilled from the onboarding account when this
     browser has one, so a returning user just taps Send.
   · Feedback is QUEUED FIRST, sent second. The entry goes into localStorage
     before the request leaves, so a dead network, a closed tab or an
     unconfigured bridge delays it instead of losing it. The queue is flushed
     on the next load of any screen carrying this footer.
   · Sending NEVER blocks the exit. The WhatsApp hand-off happens whether or
     not the POST has come back — the user has already given their answer, and
     making them wait for our server is our problem, not theirs.

   Everything here is one file, no dependencies, no build step, and it draws
   its own styles — the same rules as every other module in this cut.
   ========================================================================== */

(function () {
  "use strict";

  /* ── Where things point ──────────────────────────────────────────────── */
  var WA_NUMBER = "919988087779";          // FoodBridge WhatsApp IVR
  var WA_TEXT = "Hi";                      // opens the IVR's menu
  var DEFAULT_BASE = "https://zoho-function-nu.vercel.app";
  var LOCAL_BASE = "http://localhost:8787";
  var API_KEY = "tFcdYY4RepvrSmvdLsmG3jls3_1J2epW";   // same shared key the other screens carry
  var QUEUE_KEY = "fb.v7.feedback.queue";   // not yet delivered
  var LOG_KEY = "fb.v7.feedback.log";       // everything ever given on THIS device
  var WHO_KEY = "fb.v7.account";           // what onboarding wrote, if this browser has been through it

  /* TWO WAYS TO THE SAME CHAT, and the difference is a screen of WhatsApp's.
     `wa.me` is a web PAGE: handed an https link, a browser renders it, and it
     answers with "Open app / Download it now" — a second tap between the demo
     and the chat. It has to, because a scripted navigation never gets the
     universal-link handling that would pass the address to the app instead.
     The app's own scheme is not a page at all: the OS hands it straight to
     WhatsApp, already open on the FoodBridge thread. */
  var waApp = function () {
    return "whatsapp://send?phone=" + WA_NUMBER + "&text=" + encodeURIComponent(WA_TEXT);
  };
  var waLink = function () {
    return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(WA_TEXT);
  };

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

  /* ── Leaving ─────────────────────────────────────────────────────────── */
  /* In the platform these screens are an iframe, so a route change belongs to
     the TOP window. Opened on their own they are the whole page. */
  function goPlatform(route) {
    try {
      if (window.top && window.top !== window.self) { window.top.location.hash = "#/" + route; return true; }
    } catch (e) { /* a parent we may not touch */ }
    return false;
  }
  function goWhatsApp() {
    /* The IVR is not ours to frame: open it at the top, which is also what a
       phone needs for the WhatsApp app itself to take over. */
    var w = window;
    try { if (window.top && window.top !== window.self) w = window.top; } catch (e) { /* a parent we may not touch */ }
    var go = function (url) {
      try { w.location.href = url; } catch (e) { window.location.href = url; }
    };

    /* The scheme is tried first and nothing confirms it worked — there is no
       such answer to be had. What IS observable is this document going away:
       when WhatsApp comes to the front the page is hidden or unloaded within a
       moment. Still here after that, and no app took it, so `wa.me` is the
       honest second choice — it is also the only one that helps someone
       without WhatsApp installed, which is the case the scheme cannot serve.

       Only leaving counts as leaving. `blur` looks like the same signal and is
       not: it fires when the window merely loses focus — a tap on browser
       chrome, an OS prompt, a click into another pane — and treating that as
       success strands someone on the demo with nothing happening at all. The
       two mistakes are not the same size. Falling back when the app DID open
       costs a wa.me page loading in a tab nobody is looking at; not falling
       back costs the handoff entirely. So this listens only for the page
       actually going away, and errs toward navigating. */
    var settled = false;
    var settle = function () { settled = true; };
    document.addEventListener("visibilitychange", function () { if (document.hidden) settle(); });
    window.addEventListener("pagehide", settle);

    setTimeout(function () {
      if (settled) return;
      go(waLink());
    }, 1400);

    go(waApp());
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
    return { name: a.guest ? "" : (a.name || ""), phone: String(a.mobile || "").replace(/\D/g, "").slice(-10) };
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
    /* Only a page that HAS the bar pays for it. The sheet is used on its own
       by screens with a footer of their own — Delivery Management — and 58px
       of padding there would be a gap under a full-height app. */
    "  body.fbx-has-foot{padding-bottom:58px}",
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
    ".fbx-list{padding:10px 14px 16px;display:flex;flex-direction:column;gap:8px}",
    ".fbx-row{display:flex;align-items:center;gap:12px;width:100%;padding:13px 14px;border:1px solid #e6e8eb;border-radius:12px;background:#fff;cursor:pointer;text-align:left;font:inherit}",
    ".fbx-row:active{background:#f7f8fa}",
    ".fbx-row .fbx-ic{flex:0 0 auto;width:34px;height:34px;display:grid;place-items:center;border-radius:9px;background:#eef2ff;color:#2540d6}",
    ".fbx-row.is-go .fbx-ic{background:#e8f5ec;color:#0e8a3c}",
    ".fbx-row.is-wa .fbx-ic{background:#e7f8ef;color:#1d9e5d}",
    ".fbx-row b{display:block;font-size:14px;font-weight:600}",
    ".fbx-row small{display:block;margin-top:1px;font-size:11.5px;color:#6b7079}",
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
    ".fbx-two{display:flex;gap:8px}.fbx-two>div{flex:1;min-width:0}",
    ".fbx-cta{width:100%;min-height:46px;margin-top:16px;border:0;border-radius:11px;background:#0e8a3c;color:#fff;font:inherit;font-size:15px;font-weight:600;cursor:pointer}",
    ".fbx-cta[disabled]{background:#e3e5e8;color:#9ca1a9;cursor:default}",
    ".fbx-skip{width:100%;min-height:40px;margin-top:8px;border:0;background:none;color:#6b7079;font:inherit;font-size:13px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}",
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
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="width:22px;height:22px" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>',
    form: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/></svg>',
    join: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/></svg>',
    wa: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  };

  /* ── The sheet ───────────────────────────────────────────────────────── */
  var open = false, rating = 0, sending = false;

  function close() {
    open = false;
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

  function openMenu() {
    injectCss();
    open = true; rating = 0;
    document.addEventListener("keydown", onKey);
    var sheet = shell(
      '<header class="fbx-head"><div><h2>🏁 You\'ve completed the demo</h2>' +
        "<p>What would you like to do next?</p></div>" +
        '<button class="fbx-x" aria-label="Close">✕</button></header>' +
      '<div class="fbx-list">' +
        row("fbx-feedback", "", ICON.form, "Give feedback", "30 seconds — one tap and you're done") +
        row("fbx-join", "is-go", ICON.join, "Become a part of FoodBridge", "Create your account and set up your business") +
        row("fbx-wa", "is-wa", ICON.wa, "Back to WhatsApp menu", "Return to the FoodBridge menu on WhatsApp") +
      "</div>"
    );
    sheet.querySelector("#fbx-feedback").addEventListener("click", openForm);
    sheet.querySelector("#fbx-join").addEventListener("click", function () {
      close();
      /* Onboarding starts at its own first screen — `signup` tells it to begin
         a new account rather than resume whatever this browser was doing. */
      if (!goPlatform("onboarding?signup=1")) {
        window.location.href = "../../../index.html#/onboarding?signup=1";
      }
    });
    sheet.querySelector("#fbx-wa").addEventListener("click", function () { close(); goWhatsApp(); });
  }

  function row(id, cls, icon, title, sub) {
    return '<button type="button" class="fbx-row ' + cls + '" id="' + id + '">' +
      '<span class="fbx-ic">' + icon + "</span>" +
      "<span><b>" + esc(title) + "</b><small>" + esc(sub) + "</small></span></button>";
  }

  var FACES = [
    { v: 1, em: "😡", lb: "Bad" },
    { v: 2, em: "🙁", lb: "Meh" },
    { v: 3, em: "😐", lb: "OK" },
    { v: 4, em: "🙂", lb: "Good" },
    { v: 5, em: "🤩", lb: "Great" },
  ];

  function openForm() {
    var who = known();
    rating = 0;
    var sheet = shell(
      '<header class="fbx-head"><div><h2>How was the demo?</h2>' +
        "<p>One tap is enough. The rest is optional.</p></div>" +
        '<button class="fbx-x" aria-label="Close">✕</button></header>' +
      '<div class="fbx-form">' +
        '<div class="fbx-rate" role="group" aria-label="Rating">' +
          FACES.map(function (f) {
            return '<button type="button" data-r="' + f.v + '" aria-pressed="false" aria-label="' + f.lb + '">' +
              '<span class="em">' + f.em + '</span><span class="lb">' + f.lb + "</span></button>";
          }).join("") +
        "</div>" +
        '<p class="fbx-label">Anything you would change?</p>' +
        '<textarea class="fbx-in" id="fbx-comment" placeholder="Optional — what worked, what did not" maxlength="1200"></textarea>' +
        '<div class="fbx-two">' +
          '<div><p class="fbx-label">Your name</p>' +
            '<input class="fbx-in" id="fbx-name" value="' + esc(who.name) + '" maxlength="80" autocomplete="name" placeholder="Name"></div>' +
          '<div><p class="fbx-label">Phone</p>' +
            '<input class="fbx-in" id="fbx-phone" value="' + esc(who.phone) + '" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="10 digits"></div>' +
        "</div>" +
        '<p class="fbx-err" id="fbx-err" hidden></p>' +
        '<button class="fbx-cta" id="fbx-send" disabled>Send &amp; open WhatsApp</button>' +
        '<button class="fbx-skip" id="fbx-skip">Skip — just take me back</button>' +
      "</div>"
    );

    var send$ = sheet.querySelector("#fbx-send");
    sheet.querySelectorAll(".fbx-rate button").forEach(function (b) {
      b.addEventListener("click", function () {
        rating = Number(b.getAttribute("data-r"));
        sheet.querySelectorAll(".fbx-rate button").forEach(function (o) {
          o.setAttribute("aria-pressed", o === b ? "true" : "false");
        });
        send$.disabled = false;
      });
    });
    sheet.querySelector("#fbx-phone").addEventListener("input", function () {
      this.value = this.value.replace(/\D/g, "").slice(0, 10);
    });
    sheet.querySelector("#fbx-skip").addEventListener("click", function () { close(); goWhatsApp(); });
    send$.addEventListener("click", function () { submit(sheet); });
  }

  function submit(sheet) {
    if (sending) return;
    var err = sheet.querySelector("#fbx-err");
    var phone = sheet.querySelector("#fbx-phone").value.replace(/\D/g, "");
    var name = sheet.querySelector("#fbx-name").value.trim();
    if (!rating) return;
    /* Name and number are what make a reply possible, so they are asked for —
       but a wrong-looking number is said plainly rather than swallowed. */
    if (phone && phone.length !== 10) {
      err.hidden = false; err.textContent = "That phone number needs 10 digits — or leave it blank.";
      return;
    }
    err.hidden = true;
    sending = true;

    var entry = {
      local: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      rating: rating,
      comment: sheet.querySelector("#fbx-comment").value,
      name: name,
      phone: phone,
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

    shell(
      '<div class="fbx-done"><div class="tick">✓</div>' +
        "<h3>Thank you — that helps</h3>" +
        "<p>Taking you back to the FoodBridge menu on WhatsApp…</p></div>"
    );
    setTimeout(function () { sending = false; close(); goWhatsApp(); }, 1100);
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

    document.body.classList.add("fbx-has-foot");
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

    /* Anything an earlier visit could not deliver goes now. */
    flush();
  }

  window.FB_EXIT = { mount: mount, open: openMenu, flush: flush, waLink: waLink, waApp: waApp,
                     apiBase: apiBase, log: logged, pending: queued };
})();

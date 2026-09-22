/* ==========================================================================
   CONTROL TOWER · ASSISTANT — the floating button and the chat. (22 Sep 2026)

   The owner asked for an assistant floating over the tower's screens: tap it
   and a chat opens that looks and works like WhatsApp and a WhatsApp
   Business bot — reply buttons, a list menu, "reply with a number". Built
   new for this; it borrows nothing from the platform's IVR or any earlier
   assistant.

   What it says is ../assets/ct/chat.js (pure, tested headless). This file
   only draws and listens. It reads the business through
   FBControlTower.api and never changes a record: a button opens the lever,
   or the lever's own confirm sheet.

   The conversation lasts the browser session (sessionStorage), the way a
   chat stays where you left it. The hint beside the button shows once per
   device.
   ========================================================================== */

(function () {
  "use strict";

  const BASE = "../assets/ct/mascot/";
  const KEY = "fb.v7.ct.chat";                   // this session's conversation
  const HINT = "fb.v7.ct.chat.hinted";           // the one-time hint, per device
  const CAP = 120;

  const esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  /* WhatsApp's own marks: *bold*, _italic_, and line breaks. */
  const md = function (s) { return esc(s).replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/(^|\s)_([^_\n]+)_/g, "$1<i>$2</i>").replace(/\n/g, "<br>"); };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const $ = function (s, r) { return (r || document).querySelector(s); };
  function clock(t) {
    const d = new Date(t), h = d.getHours(), m = d.getMinutes();
    return (h % 12 || 12) + ":" + String(m).padStart(2, "0") + " " + (h < 12 ? "am" : "pm");
  }

  const I = {
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l1.4 1.4L7.8 11H20v2H7.8l5.6 5.6L12 20l-8-8z" fill="currentColor"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" fill="currentColor"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 20.9 12 3.4 3.6 3.4 10.1 15.9 12 3.4 13.9z" fill="currentColor"/></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h2v2H4zm4 0h12v2H8zM4 11h2v2H4zm4 0h12v2H8zm-4 5h2v2H4zm4 0h12v2H8z" fill="currentColor"/></svg>',
    reply: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" fill="currentColor"/></svg>',
    ticks: '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M17.4 4.3 16.7 3.8a.4.4 0 0 0-.5.1L9.5 12.3 7.9 10.8l-.7.8 2 2a.4.4 0 0 0 .6 0l7.6-8.7a.4.4 0 0 0 0-.6zM12.6 4.3 12 3.8a.4.4 0 0 0-.5.1L4.8 12.3 1.9 9.6a.4.4 0 0 0-.5 0l-.6.6a.4.4 0 0 0 0 .5l3.7 3.5a.4.4 0 0 0 .6 0l7.6-9.3a.4.4 0 0 0-.1-.6z" fill="currentColor"/></svg>',
    lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 9h-1V7a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 0 1 4 0v2h-4z" fill="currentColor"/></svg>',
  };

  let S = { msgs: [], greeted: false };
  let root, body, input, status, open = false, talking = Promise.resolve();

  function load() { try { const v = JSON.parse(sessionStorage.getItem(KEY) || "null"); if (v && Array.isArray(v.msgs)) S = v; } catch (e) { /* a new conversation */ } }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify({ msgs: S.msgs.slice(-CAP), greeted: S.greeted })); } catch (e) { /* this tab only */ } }
  const api = function () { return window.FBControlTower && window.FBControlTower.api; };
  function ctx() { const a = api(); return { model: a.model(), timeline: a.timeline() }; }

  /* ── mount: once the tower has its records ─────────────────────────── */
  function mount() {
    let tries = 0;
    (function wait() {
      const a = api();
      if (a && a.ready() && window.CTChat) return build();
      if (++tries < 100) setTimeout(wait, 150);
    })();
  }

  function build() {
    load();
    const fab = document.createElement("button");
    fab.type = "button";
    fab.className = "cb-fab";
    fab.setAttribute("aria-label", "Open FoodBridge Assistant");
    fab.innerHTML = '<span class="cb-face" style="background-image:url(' + BASE + 'hello-128.png)"></span><i class="cb-online" aria-hidden="true"></i>';
    fab.addEventListener("click", function () { hideHint(); openChat(); });
    document.body.appendChild(fab);

    root = document.createElement("section");
    root.className = "cb-chat";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "FoodBridge Assistant");
    root.innerHTML =
      '<header class="cb-head">' +
        '<button type="button" class="cb-hbtn cb-back" data-close aria-label="Close chat">' + I.back + "</button>" +
        '<span class="cb-ava" style="background-image:url(' + BASE + 'hello-128.png)" aria-hidden="true"></span>' +
        '<span class="cb-who"><b>FoodBridge Assistant</b><small class="cb-status">online</small></span>' +
        '<button type="button" class="cb-hbtn cb-x" data-close aria-label="Close chat">' + I.close + "</button>" +
      "</header>" +
      '<div class="cb-body" role="log" aria-live="polite" aria-label="Conversation"></div>' +
      '<form class="cb-bar" autocomplete="off">' +
        '<input class="cb-input" type="text" enterkeyhint="send" placeholder="Message" aria-label="Message the assistant" maxlength="300">' +
        '<button type="submit" class="cb-send" aria-label="Send" disabled>' + I.send + "</button>" +
      "</form>" +
      '<div class="cb-sheetwrap" hidden></div>';
    document.body.appendChild(root);
    body = $(".cb-body", root); input = $(".cb-input", root); status = $(".cb-status", root);
    const send = $(".cb-send", root);

    root.addEventListener("click", onClick);
    input.addEventListener("input", function () { send.disabled = !input.value.trim(); });
    $(".cb-bar", root).addEventListener("submit", function (e) {
      e.preventDefault();
      const t = input.value.trim(); if (!t) return;
      input.value = ""; send.disabled = true;
      ask(t, function () { return window.CTChat.reply({ text: t }, ctx()); });
    });
    /* Esc closes the menu sheet, then the chat — and stops there, so the
       tower underneath doesn't also go back. */
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || !open) return;
      e.stopPropagation(); e.preventDefault();
      if (!$(".cb-sheetwrap", root).hidden) closeSheet(); else closeChat();
    }, true);

    showHint();
  }

  /* ── the one-time hint beside the button ──────────────────────────── */
  function showHint() {
    try { if (localStorage.getItem(HINT)) return; } catch (e) { return; }
    setTimeout(function () {
      if (open || document.body.classList.contains("ct-locked")) return;
      const h = document.createElement("button");
      h.type = "button"; h.className = "cb-hint";
      h.innerHTML = "Ask me about your business 👋";
      h.addEventListener("click", function () { hideHint(); openChat(); });
      document.body.appendChild(h);
      try { localStorage.setItem(HINT, "1"); } catch (e) { /* shows again next time */ }
      setTimeout(hideHint, 7000);
    }, 1500);
  }
  function hideHint() { const h = $(".cb-hint"); if (h) h.remove(); }

  /* ── open and close ────────────────────────────────────────────────── */
  function openChat() {
    if (open) return;
    open = true;
    root.hidden = false;
    document.documentElement.classList.add("cb-open");
    render();
    if (window.matchMedia("(min-width: 768px)").matches) input.focus({ preventScroll: true });
    if (!S.greeted) { S.greeted = true; save(); say(window.CTChat.welcome()); }
  }
  function closeChat() {
    if (!open) return;
    open = false;
    closeSheet();
    root.hidden = true;
    document.documentElement.classList.remove("cb-open");
    const f = $(".cb-fab"); if (f) f.focus({ preventScroll: true });
  }

  /* ── talking ───────────────────────────────────────────────────────── */
  /* The owner's message, as a bubble with ticks; blue once it's read. */
  function mine(text) { S.msgs.push({ from: "me", kind: "text", text: text, at: Date.now(), read: false }); save(); render(); }
  /* The assistant's answer: typing…, then each message in turn. Answers
     queue behind each other, so two quick taps never interleave. */
  function say(list) {
    talking = talking.then(async function () {
      S.msgs.forEach(function (m) { if (m.from === "me") m.read = true; });
      for (let i = 0; i < list.length; i++) {
        typing(true);
        const m = list[i];
        await sleep(i ? 450 : 650 + Math.min(600, (m.text || "").length * 3));
        typing(false);
        S.msgs.push(Object.assign({ from: "bot", at: Date.now() }, m));
        save(); render();
      }
    });
    return talking;
  }
  function ask(text, answer) { mine(text); return say(answer()); }
  function typing(on) {
    status.textContent = on ? "typing…" : "online";
    const t = $(".cb-typing", body);
    if (on && !t) { body.insertAdjacentHTML("beforeend", '<div class="cb-row in"><div class="cb-bub cb-typing" aria-label="typing"><i></i><i></i><i></i></div></div>'); stick(); }
    if (!on && t) t.parentNode.remove();
  }

  /* A reply button, or a row of the menu: said as the owner's reply, then
     answered — or, for Open and the prepared action, handed to the tower. */
  function onClick(e) {
    if (e.target.closest("[data-close]")) return closeChat();
    const b = e.target.closest("[data-btn]");
    if (b) return press(b.dataset.btn, b.dataset.label);
    const l = e.target.closest("[data-list]");
    if (l) return openSheet(+l.dataset.list);
    const r = e.target.closest("[data-row]");
    if (r) { closeSheet(); return press("intent:" + r.dataset.row, r.dataset.label); }
    if (e.target.closest("[data-sheet-close]") || e.target.classList.contains("cb-sheetwrap")) return closeSheet();
  }
  function press(id, label) {
    const C = window.CTChat, a = api();
    if (id === "menu") return ask(label || "Main menu", function () { return C.reply({ intent: "menu" }, ctx()); });
    if (id.indexOf("intent:") === 0) return ask(label, function () { return C.reply({ intent: id.slice(7) }, ctx()); });
    const handoff = function (text, go) {
      mine(label);
      say([{ kind: "text", text: text }]).then(function () { return sleep(700); }).then(function () { closeChat(); go(); });
    };
    if (id === "open:timeline") return handoff("Opening your *Business Timeline*.", function () { a.openTimeline(); });
    const p = id.split(":"), lv = a.model().levers.filter(function (x) { return x.id === p[1]; })[0];
    const name = lv ? lv.label : p[1];
    if (p[0] === "open") return handoff("Opening *" + name + "*.", function () { a.openLever(p[1], p[2] || null); });
    if (p[0] === "act") return handoff("Here it is, prepared for you in *" + name + "*. Check it and confirm — nothing goes out until you do.", function () { a.act(p[1]); });
  }

  /* ── WhatsApp's list: a bottom sheet of the menu, inside the chat ──── */
  function openSheet(i) {
    const m = S.msgs[i]; if (!m || !m.list) return;
    const w = $(".cb-sheetwrap", root);
    w.innerHTML = '<div class="cb-sheet" role="dialog" aria-label="' + esc(m.list.title) + '">' +
      '<div class="cb-sh"><button type="button" class="cb-hbtn" data-sheet-close aria-label="Close menu">' + I.close + "</button><b>" + esc(m.list.title) + "</b></div>" +
      '<div class="cb-rows">' + m.list.rows.map(function (r) {
        return '<button type="button" class="cb-rowbtn" data-row="' + esc(r.id) + '" data-label="' + esc(r.label) + '">' +
          '<span class="cb-rn">' + r.n + '</span><span class="cb-rt"><b>' + esc(r.label) + "</b><small>" + esc(r.desc) + '</small></span><i class="cb-radio" aria-hidden="true"></i></button>';
      }).join("") + "</div></div>";
    w.hidden = false;
  }
  function closeSheet() { const w = root && $(".cb-sheetwrap", root); if (w) { w.hidden = true; w.innerHTML = ""; } }

  /* ── drawing the conversation ──────────────────────────────────────── */
  function render() {
    if (!open) return;
    let html = '<div class="cb-chip">Today</div>' +
      '<div class="cb-chip cb-note">' + I.lock + "Answers come only from your business records. Nothing you type leaves this device.</div>";
    S.msgs.forEach(function (m, i) {
      const prev = S.msgs[i - 1];
      const tail = !prev || prev.from !== m.from || prev.kind === "sticker";
      const side = m.from === "me" ? "out" : "in";
      const t = '<span class="cb-time">' + clock(m.at) + (m.from === "me" ? '<span class="cb-ticks' + (m.read ? " is-read" : "") + '">' + I.ticks + "</span>" : "") + "</span>";
      if (m.kind === "sticker") {
        html += '<div class="cb-row in cb-tail"><div class="cb-stk"><img src="' + BASE + esc(m.image) + '" alt="' + esc(m.alt || "") + '" width="120" height="120">' + t + "</div></div>";
        return;
      }
      let inner = "";
      if (m.kind === "image") inner += '<span class="cb-img"><img src="' + BASE + esc(m.image) + '" alt="' + esc(m.alt || "") + '" width="240" height="240"></span>';
      if (m.text) inner += '<span class="cb-txt">' + md(m.text) + "</span>";
      inner += t;
      if (m.list) inner += '<button type="button" class="cb-listbtn" data-list="' + i + '">' + I.list + esc(m.list.button) + "</button>";
      const btns = m.buttons && m.buttons.length ? '<div class="cb-btns">' + m.buttons.map(function (b) {
        return '<button type="button" class="cb-btn" data-btn="' + esc(b.id) + '" data-label="' + esc(b.label) + '">' + I.reply + "<span>" + esc(b.label) + "</span></button>";
      }).join("") + "</div>" : "";
      html += '<div class="cb-row ' + side + (tail ? " cb-tail" : "") + '"><div class="cb-grp"><div class="cb-bub' + (m.kind === "image" ? " is-img" : "") + '">' + inner + "</div>" + btns + "</div></div>";
    });
    body.innerHTML = html;
    stick();
  }
  function stick() { body.scrollTop = body.scrollHeight; }

  window.FBChat = { mount: mount, open: function () { openChat(); }, close: function () { closeChat(); } };
})();
